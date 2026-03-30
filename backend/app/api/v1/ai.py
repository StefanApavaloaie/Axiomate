import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.event import Event
from app.models.user import User
from app.models.workspace import WorkspaceMember

router = APIRouter(prefix="/ai")


class AiQueryRequest(BaseModel):
    question: str
    workspace_id: uuid.UUID


class AiQueryResponse(BaseModel):
    question: str
    answer: str
    context_used: dict


async def _verify_member(workspace_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession):
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")


@router.post("/query", response_model=AiQueryResponse)
async def query_ai(
    request: AiQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lets a user ask natural-language questions about their analytics data.
    Automatically fetches live context from the database and sends it to Ollama.
    """
    await _verify_member(request.workspace_id, current_user.id, db)

    # Build a compact analytics snapshot to inject as context
    total_events = (
        await db.execute(
            select(func.count(Event.id)).where(Event.workspace_id == request.workspace_id)
        )
    ).scalar()

    top_events_rows = (
        await db.execute(
            select(Event.event_name, func.count(Event.id).label("cnt"))
            .where(Event.workspace_id == request.workspace_id)
            .group_by(Event.event_name)
            .order_by(func.count(Event.id).desc())
            .limit(5)
        )
    ).all()

    top_events = {row.event_name: row.cnt for row in top_events_rows}

    context = {
        "total_events": total_events,
        "top_events": top_events,
    }

    system_prompt = (
        "You are Axiomate AI, an expert product analytics assistant. "
        "You help product managers understand their user data. "
        "Answer concisely and clearly. If you don't know, say so. "
        f"Here is the current analytics context for this workspace:\n{context}"
    )

    # Call the self-hosted Ollama instance
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": f"System: {system_prompt}\n\nUser: {request.question}",
                    "stream": False,
                },
            )
            response.raise_for_status()
            answer = response.json().get("response", "No response from AI model.")
    except httpx.ConnectError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service (Ollama) is not running. Please start it with: ollama serve",
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service returned an error: {e.response.text}",
        )

    return AiQueryResponse(
        question=request.question,
        answer=answer,
        context_used=context,
    )
