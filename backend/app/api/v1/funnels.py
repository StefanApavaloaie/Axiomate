import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
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

router = APIRouter(prefix="/funnels")


async def _verify_member(workspace_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession):
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")


@router.post("/{workspace_id}", response_model=FunnelResponse, status_code=status.HTTP_201_CREATED)
async def create_funnel(
    workspace_id: uuid.UUID,
    data: FunnelCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Saves a named funnel definition (list of ordered steps) for later analysis."""
    await _verify_member(workspace_id, current_user.id, db)

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
):
    """Returns all saved funnel definitions for a workspace."""
    await _verify_member(workspace_id, current_user.id, db)

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
):
    """
    Computes live drop-off rates for each step of a funnel.
    Uses a sequential query: counts distinct users who fired step N 
    AND previously fired step N-1 within the date range.
    """
    await _verify_member(workspace_id, current_user.id, db)

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

    return FunnelResultResponse(
        funnel_id=funnel_id,
        date_from=date_from,
        date_to=date_to,
        steps=step_results,
        computed_at=datetime.now(timezone.utc),
    )
