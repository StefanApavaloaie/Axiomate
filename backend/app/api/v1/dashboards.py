import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.event import Event
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.schemas.dashboard import (
    DailyMetricPoint,
    EventBreakdownItem,
    EventBreakdownResponse,
    OverviewResponse,
)

router = APIRouter(prefix="/dashboards")


async def _verify_workspace_member(
    workspace_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession
):
    """Ensures the user is a member of the workspace before returning data."""
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if not result.scalar_one_or_none():
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this workspace.",
        )


@router.get("/{workspace_id}/overview", response_model=OverviewResponse)
async def get_overview(
    workspace_id: uuid.UUID,
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns aggregate overview metrics for a workspace within a date range.
    Defaults to the last 30 days.
    """
    await _verify_workspace_member(workspace_id, current_user.id, db)

    # Default: last 30 days
    if not date_to:
        date_to = date.today()
    if not date_from:
        date_from = date_to - timedelta(days=29)

    # --- Total counts ---
    total_stmt = select(
        func.count(Event.id).label("total_events"),
        func.count(distinct(Event.user_id)).label("total_unique_users"),
    ).where(
        Event.workspace_id == workspace_id,
        func.date(Event.occurred_at) >= date_from,
        func.date(Event.occurred_at) <= date_to,
    )
    totals = (await db.execute(total_stmt)).one()

    # --- Daily breakdown series ---
    daily_stmt = (
        select(
            func.date(Event.occurred_at).label("date"),
            func.count(Event.id).label("event_count"),
            func.count(distinct(Event.user_id)).label("unique_users"),
        )
        .where(
            Event.workspace_id == workspace_id,
            func.date(Event.occurred_at) >= date_from,
            func.date(Event.occurred_at) <= date_to,
        )
        .group_by(func.date(Event.occurred_at))
        .order_by(func.date(Event.occurred_at))
    )
    daily_rows = (await db.execute(daily_stmt)).all()

    daily_series = [
        DailyMetricPoint(
            date=row.date,
            event_count=row.event_count,
            unique_users=row.unique_users,
        )
        for row in daily_rows
    ]

    return OverviewResponse(
        date_from=date_from,
        date_to=date_to,
        total_events=totals.total_events,
        total_unique_users=totals.total_unique_users,
        daily_series=daily_series,
    )


@router.get("/{workspace_id}/event-breakdown", response_model=EventBreakdownResponse)
async def get_event_breakdown(
    workspace_id: uuid.UUID,
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a breakdown of event counts grouped by event name.
    Great for a bar chart or ranking table on the frontend.
    """
    await _verify_workspace_member(workspace_id, current_user.id, db)

    if not date_to:
        date_to = date.today()
    if not date_from:
        date_from = date_to - timedelta(days=29)

    stmt = (
        select(
            Event.event_name,
            func.count(Event.id).label("total_count"),
            func.count(distinct(Event.user_id)).label("unique_users"),
        )
        .where(
            Event.workspace_id == workspace_id,
            func.date(Event.occurred_at) >= date_from,
            func.date(Event.occurred_at) <= date_to,
        )
        .group_by(Event.event_name)
        .order_by(func.count(Event.id).desc())
    )
    rows = (await db.execute(stmt)).all()

    return EventBreakdownResponse(
        date_from=date_from,
        date_to=date_to,
        events=[
            EventBreakdownItem(
                event_name=row.event_name,
                total_count=row.total_count,
                unique_users=row.unique_users,
            )
            for row in rows
        ],
    )
