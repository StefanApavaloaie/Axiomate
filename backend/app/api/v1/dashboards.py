import csv
import io
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
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
from app.services.cache_service import cache
from app.config import settings

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
    Defaults to the last 30 days. Results are Redis-cached for 10 minutes.
    """
    await _verify_workspace_member(workspace_id, current_user.id, db)

    # Default: last 30 days
    if not date_to:
        date_to = date.today()
    if not date_from:
        date_from = date_to - timedelta(days=29)

    # ── Cache check ────────────────────────────────────────────────────────────
    cache_key = f"axiomate:dashboard:overview:{workspace_id}:{date_from}:{date_to}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return OverviewResponse(**cached)

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

    result = OverviewResponse(
        date_from=date_from,
        date_to=date_to,
        total_events=totals.total_events,
        total_unique_users=totals.total_unique_users,
        daily_series=daily_series,
    )

    # ── Store in cache ─────────────────────────────────────────────────────────
    await cache.set(cache_key, result.model_dump(), ttl=settings.CACHE_TTL_OVERVIEW)

    return result


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
    Results are Redis-cached for 10 minutes.
    """
    await _verify_workspace_member(workspace_id, current_user.id, db)

    if not date_to:
        date_to = date.today()
    if not date_from:
        date_from = date_to - timedelta(days=29)

    # ── Cache check ────────────────────────────────────────────────────────────
    cache_key = f"axiomate:dashboard:breakdown:{workspace_id}:{date_from}:{date_to}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return EventBreakdownResponse(**cached)

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

    result = EventBreakdownResponse(
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

    # ── Store in cache ─────────────────────────────────────────────────────────
    await cache.set(cache_key, result.model_dump(), ttl=settings.CACHE_TTL_OVERVIEW)

    return result


@router.get("/{workspace_id}/overview/export")
async def export_overview_csv(
    workspace_id: uuid.UUID,
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download the daily overview as a CSV file."""
    await _verify_workspace_member(workspace_id, current_user.id, db)
    if not date_to:
        date_to = date.today()
    if not date_from:
        date_from = date_to - timedelta(days=29)

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
    rows = (await db.execute(daily_stmt)).all()

    output = io.StringIO()
    output.write("sep=,\n")
    writer = csv.writer(output)
    writer.writerow(["date", "event_count", "unique_users"])
    for row in rows:
        writer.writerow([row.date, row.event_count, row.unique_users])
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=overview_{date_from}_{date_to}.csv"},
    )


@router.get("/{workspace_id}/event-breakdown/export")
async def export_event_breakdown_csv(
    workspace_id: uuid.UUID,
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download event breakdown counts as a CSV file."""
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

    output = io.StringIO()
    output.write("sep=,\n")
    writer = csv.writer(output)
    writer.writerow(["event_name", "total_count", "unique_users"])
    for row in rows:
        writer.writerow([row.event_name, row.total_count, row.unique_users])
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=events_{date_from}_{date_to}.csv"},
    )
