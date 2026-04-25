import csv
import io
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.dependencies import get_current_user, get_workspace_member, require_role
from app.models.event import Event
from app.models.funnel import Funnel
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.schemas.funnel import (
    FunnelCreate,
    FunnelResponse,
    FunnelResultResponse,
    FunnelStep,
    FunnelStepResult,
)
from app.services.cache_service import cache

router = APIRouter(prefix="/funnels")


# Helper _verify_member is removed in favor of standard dependencies


@router.post("/{workspace_id}", response_model=FunnelResponse, status_code=status.HTTP_201_CREATED)
async def create_funnel(
    workspace_id: uuid.UUID,
    data: FunnelCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    member: WorkspaceMember = Depends(require_role("owner", "admin", "member")),
):
    """Saves a named funnel definition (list of ordered steps) for later analysis."""

    # Store steps as plain dicts in the JSONB column
    steps_json = [s.model_dump() for s in data.steps]

    funnel = Funnel(
        workspace_id=workspace_id,
        created_by=current_user.id,
        name=data.name,
        steps=steps_json,
    )
    db.add(funnel)
    await db.commit()
    await db.refresh(funnel)

    return FunnelResponse(
        id=funnel.id,
        name=funnel.name,
        steps=[FunnelStep(**s) for s in funnel.steps],
        created_at=funnel.created_at,
    )


@router.get("/{workspace_id}", response_model=List[FunnelResponse])
async def list_funnels(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    member: WorkspaceMember = Depends(get_workspace_member),
):
    """Returns all saved funnel definitions for a workspace."""

    result = await db.execute(
        select(Funnel)
        .where(Funnel.workspace_id == workspace_id)
        .order_by(Funnel.created_at.desc())
    )
    funnels = result.scalars().all()

    return [
        FunnelResponse(
            id=f.id,
            name=f.name,
            steps=[FunnelStep(**s) for s in f.steps],
            created_at=f.created_at,
        )
        for f in funnels
    ]


@router.get("/{workspace_id}/{funnel_id}/results", response_model=FunnelResultResponse)
async def compute_funnel_results(
    workspace_id: uuid.UUID,
    funnel_id: uuid.UUID,
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    member: WorkspaceMember = Depends(get_workspace_member),
):
    """
    Computes live drop-off rates for each step of a funnel.
    Results are Redis-cached for 30 minutes per funnel+date-range combination.
    """

    # Fetch funnel definition
    result = await db.execute(
        select(Funnel).where(Funnel.id == funnel_id, Funnel.workspace_id == workspace_id)
    )
    funnel = result.scalar_one_or_none()
    if not funnel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Funnel not found.")

    if not date_to:
        date_to = date.today()
    if not date_from:
        date_from = date_to - timedelta(days=29)

    # ── Cache check ────────────────────────────────────────────────────────────
    cache_key = f"axiomate:funnel:results:{workspace_id}:{funnel_id}:{date_from}:{date_to}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return FunnelResultResponse(**cached)

    steps = sorted(funnel.steps, key=lambda s: s["step"])
    step_results: List[FunnelStepResult] = []
    first_step_count = 0

    for i, step_def in enumerate(steps):
        event_name = step_def["event_name"]

        if i == 0:
            # Step 1: count all distinct users who fired the first event
            stmt = select(func.count(func.distinct(Event.user_id))).where(
                Event.workspace_id == workspace_id,
                Event.event_name == event_name,
                func.date(Event.occurred_at) >= date_from,
                func.date(Event.occurred_at) <= date_to,
                Event.user_id.is_not(None),
            )
            count = (await db.execute(stmt)).scalar() or 0
            first_step_count = count
            conversion = 1.0
        else:
            # Step N: count users who fired this event AND fired the previous step's event
            prev_event = steps[i - 1]["event_name"]
            # Subquery: users who completed the previous step
            prev_user_subq = (
                select(Event.user_id)
                .where(
                    Event.workspace_id == workspace_id,
                    Event.event_name == prev_event,
                    func.date(Event.occurred_at) >= date_from,
                    func.date(Event.occurred_at) <= date_to,
                    Event.user_id.is_not(None),
                )
                .scalar_subquery()
            )
            stmt = select(func.count(func.distinct(Event.user_id))).where(
                Event.workspace_id == workspace_id,
                Event.event_name == event_name,
                func.date(Event.occurred_at) >= date_from,
                func.date(Event.occurred_at) <= date_to,
                Event.user_id.in_(prev_user_subq),
            )
            count = (await db.execute(stmt)).scalar() or 0
            conversion = (count / first_step_count) if first_step_count > 0 else 0.0

        step_results.append(
            FunnelStepResult(
                step=step_def["step"],
                event_name=event_name,
                user_count=count,
                conversion_rate=round(conversion, 4),
            )
        )

    funnel_result = FunnelResultResponse(
        funnel_id=funnel_id,
        date_from=date_from,
        date_to=date_to,
        steps=step_results,
        computed_at=datetime.now(timezone.utc),
    )

    # ── Store in cache ─────────────────────────────────────────────────────────
    await cache.set(cache_key, funnel_result.model_dump(), ttl=settings.CACHE_TTL_FUNNEL)

    return funnel_result


@router.get("/{workspace_id}/{funnel_id}/results/export")
async def export_funnel_results_csv(
    workspace_id: uuid.UUID,
    funnel_id: uuid.UUID,
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download funnel step results as a CSV file."""
    # Reuse existing logic by calling the compute endpoint
    result = await compute_funnel_results(
        workspace_id=workspace_id,
        funnel_id=funnel_id,
        date_from=date_from,
        date_to=date_to,
        current_user=current_user,
        db=db,
    )

    output = io.StringIO()
    output.write("sep=,\n")
    writer = csv.writer(output)
    writer.writerow(["step", "event_name", "user_count", "conversion_rate_pct"])
    for s in result.steps:
        writer.writerow([s.step, s.event_name, s.user_count, round(s.conversion_rate * 100, 2)])
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=funnel_{funnel_id}.csv"},
    )


@router.delete("/{workspace_id}/{funnel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_funnel(
    workspace_id: uuid.UUID,
    funnel_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    # Only owners and admins ("team leaders") may delete funnels.
    # Members and viewers receive 403 Forbidden.
    member: WorkspaceMember = Depends(require_role("owner", "admin")),
):
    """
    Permanently deletes a funnel and clears its cached results.
    Restricted to workspace owners and admins.
    """
    result = await db.execute(
        select(Funnel).where(Funnel.id == funnel_id, Funnel.workspace_id == workspace_id)
    )
    funnel = result.scalar_one_or_none()
    if not funnel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Funnel not found.")

    await db.delete(funnel)
    await db.commit()

    # Evict all cached result keys for this funnel
    cache_pattern = f"axiomate:funnel:results:{workspace_id}:{funnel_id}:*"
    await cache.delete_pattern(cache_pattern)
