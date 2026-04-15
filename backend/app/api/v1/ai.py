import json
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import AsyncIterator, List

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.dependencies import get_current_user, get_workspace_member
from app.models.anomaly import Anomaly
from app.models.event import Event
from app.models.saved_query import SavedQuery
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember

router = APIRouter(prefix="/ai")

# Re-use the same limiter instance created in main.py.
# 10 requests/minute per IP on the AI endpoint — stricter than the global
# 600/minute because each call holds an Ollama thread for up to 15 seconds.
_limiter = Limiter(key_func=get_remote_address)


class AiQueryRequest(BaseModel):
    question: str
    workspace_id: uuid.UUID


# ── Context builder ───────────────────────────────────────────────────────────

async def _build_analytics_context(workspace_id: uuid.UUID, db: AsyncSession) -> dict:
    """
    Builds a rich analytics context snapshot to give the LLM useful data.
    Fetches: total events, 7-day daily breakdown, top-10 events, active anomalies.
    """
    today = date.today()
    week_ago = today - timedelta(days=6)

    # Total events (all time)
    total_events = (
        await db.execute(
            select(func.count(Event.id)).where(Event.workspace_id == workspace_id)
        )
    ).scalar() or 0

    # Total unique users (all time)
    total_users = (
        await db.execute(
            select(func.count(func.distinct(Event.user_id))).where(
                Event.workspace_id == workspace_id
            )
        )
    ).scalar() or 0

    # Daily event counts for the last 7 days
    daily_rows = (
        await db.execute(
            select(
                func.date(Event.occurred_at).label("day"),
                func.count(Event.id).label("count"),
            )
            .where(
                Event.workspace_id == workspace_id,
                func.date(Event.occurred_at) >= week_ago,
                func.date(Event.occurred_at) <= today,
            )
            .group_by(func.date(Event.occurred_at))
            .order_by(func.date(Event.occurred_at))
        )
    ).all()

    daily_breakdown = {
        str(row.day): row.count for row in daily_rows
    }

    # Top 10 events by volume
    top_events_rows = (
        await db.execute(
            select(Event.event_name, func.count(Event.id).label("cnt"))
            .where(Event.workspace_id == workspace_id)
            .group_by(Event.event_name)
            .order_by(func.count(Event.id).desc())
            .limit(10)
        )
    ).all()

    top_events = {row.event_name: row.cnt for row in top_events_rows}

    # Active (unacknowledged) anomalies
    anomaly_rows = (
        await db.execute(
            select(Anomaly)
            .where(
                Anomaly.workspace_id == workspace_id,
                Anomaly.is_acknowledged == False,  # noqa: E712
            )
            .order_by(Anomaly.severity.desc(), Anomaly.created_at.desc())
            .limit(10)
        )
    ).scalars().all()

    active_anomalies = [
        {
            "event": a.event_name,
            "severity": a.severity,
            "date": str(a.detected_date),
            "expected": a.expected_value,
            "actual": a.actual_value,
            "z_score": a.z_score,
        }
        for a in anomaly_rows
    ]

    return {
        "date_range": f"{week_ago} to {today}",
        "total_events_all_time": total_events,
        "total_unique_users_all_time": total_users,
        "daily_event_counts_last_7_days": daily_breakdown,
        "top_10_events_by_volume": top_events,
        "active_unacknowledged_anomalies": active_anomalies,
    }


# ── Streaming generator ───────────────────────────────────────────────────────

async def _stream_ollama(system_prompt: str, question: str) -> AsyncIterator[str]:
    """
    Streams the Ollama response token by token using Server-Sent Events (SSE).
    Each chunk is formatted as:  data: <token>\n\n
    A final  data: [DONE]\n\n  signals the end of the stream.

    Why SSE instead of WebSockets? SSE is one-directional (server → client),
    much simpler to implement, works through Nginx without special config,
    and is perfectly suited to streaming LLM text output.
    """
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": f"System: {system_prompt}\n\nUser: {question}",
                    "stream": True,
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                        token = chunk.get("response", "")
                        if token:
                            # SSE format: each message is "data: ...\n\n"
                            yield f"data: {json.dumps({'token': token})}\n\n"
                        if chunk.get("done"):
                            yield "data: [DONE]\n\n"
                            return
                    except json.JSONDecodeError:
                        continue
    except httpx.ConnectError:
        yield f"data: {json.dumps({'error': 'Ollama is not running. Start it with: ollama serve'})}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as exc:
        yield f"data: {json.dumps({'error': f'AI service error: {str(exc)}'})}\n\n"
        yield "data: [DONE]\n\n"


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/query")
@_limiter.limit("10/minute")
async def query_ai(
    request: Request,               # Must be named "request" for slowapi
    payload: AiQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Streams a natural-language AI response about the workspace's analytics data.
    Returns a Server-Sent Events (SSE) stream so the frontend can render tokens
    as they arrive, rather than waiting for the full response.
    """
    # Verify workspace membership
    membership = await db.execute(
        select(WorkspaceMember)
        .join(Workspace, Workspace.id == WorkspaceMember.workspace_id)
        .where(
            WorkspaceMember.workspace_id == payload.workspace_id,
            WorkspaceMember.user_id == current_user.id,
            Workspace.deleted_at.is_(None),
        )
    )
    if not membership.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You do not have access to this workspace.")

    # Build rich analytics context
    context = await _build_analytics_context(payload.workspace_id, db)

    system_prompt = (
        "You are Axiomate Copilot, an expert product analytics assistant embedded inside "
        "the Axiomate analytics platform. You help product managers and developers understand "
        "their user behaviour data. Answer concisely, clearly, and in plain language. "
        "When discussing numbers, be specific. If data is insufficient to answer, say so. "
        "Do not make up data that isn't in the context.\n\n"
        f"Current analytics context for this workspace:\n{json.dumps(context, indent=2)}"
    )

    return StreamingResponse(
        _stream_ollama(system_prompt, payload.question),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable Nginx response buffering
        },
    )


# ── Saved Queries ─────────────────────────────────────────────────────────────

class SavedQueryCreate(BaseModel):
    name: str
    question: str
    last_response: str | None = None
    workspace_id: uuid.UUID


class SavedQueryResponse(BaseModel):
    id: uuid.UUID
    name: str
    question: str
    last_response: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/saved-queries", response_model=List[SavedQueryResponse])
async def list_saved_queries(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all saved AI queries for a workspace.
    Allows users to bookmark and quickly re-run useful questions.
    """
    # Verify membership
    mem = await db.execute(
        select(WorkspaceMember)
        .join(Workspace, Workspace.id == WorkspaceMember.workspace_id)
        .where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
            Workspace.deleted_at.is_(None),
        )
    )
    if not mem.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You do not have access to this workspace.")

    result = await db.execute(
        select(SavedQuery)
        .where(SavedQuery.workspace_id == workspace_id)
        .order_by(SavedQuery.created_at.desc())
    )
    return result.scalars().all()


@router.post("/saved-queries", response_model=SavedQueryResponse, status_code=201)
async def save_query(
    data: SavedQueryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Saves an AI question (and optionally its last response) so users can 
    quickly replay it from the copilot sidebar without retyping.
    """
    # Verify membership
    mem = await db.execute(
        select(WorkspaceMember)
        .join(Workspace, Workspace.id == WorkspaceMember.workspace_id)
        .where(
            WorkspaceMember.workspace_id == data.workspace_id,
            WorkspaceMember.user_id == current_user.id,
            Workspace.deleted_at.is_(None),
        )
    )
    if not mem.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You do not have access to this workspace.")

    saved = SavedQuery(
        workspace_id=data.workspace_id,
        user_id=current_user.id,
        name=data.name,
        question=data.question,
        last_response=data.last_response,
    )
    db.add(saved)
    await db.commit()
    await db.refresh(saved)
    return saved
