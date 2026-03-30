import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.event import Event
from app.models.user import User
from app.models.workspace import WorkspaceMember

router = APIRouter(prefix="/retention")


class CohortRow(BaseModel):
    cohort_date: date
    cohort_size: int
    periods: dict[str, int]  # e.g. {"0": 100, "1": 72, "2": 55}


class RetentionResponse(BaseModel):
    initial_event: str
    return_event: str
    granularity: str
    date_from: date
    date_to: date
    cohorts: List[CohortRow]
    computed_at: datetime


async def _verify_member(workspace_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession):
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")


@router.get("/{workspace_id}", response_model=RetentionResponse)
async def get_retention(
    workspace_id: uuid.UUID,
    initial_event: str = Query(..., description="The event that defines a new cohort (e.g. 'signup')"),
    return_event: str = Query(..., description="The event that counts as a return (e.g. 'page_view')"),
    granularity: str = Query(default="week", pattern="^(day|week|month)$"),
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Computes a cohort retention matrix.
    Groups users by the week/day/month they first fired `initial_event`,
    then tracks how many came back and fired `return_event` in subsequent periods.
    """
    await _verify_member(workspace_id, current_user.id, db)

    if not date_to:
        date_to = date.today()
    if not date_from:
        date_from = date_to - timedelta(days=83)  # ~12 weeks

    # Map granularity to PostgreSQL date_trunc format
    trunc = {"day": "day", "week": "week", "month": "month"}[granularity]

    # Step 1: Get all users and their cohort period (first occurrence of initial_event)
    cohort_stmt = (
        select(
            Event.user_id,
            func.date_trunc(trunc, func.min(Event.occurred_at)).label("cohort_period"),
        )
        .where(
            Event.workspace_id == workspace_id,
            Event.event_name == initial_event,
            func.date(Event.occurred_at) >= date_from,
            func.date(Event.occurred_at) <= date_to,
            Event.user_id.is_not(None),
        )
        .group_by(Event.user_id)
        .subquery()
    )

    # Step 2: Join return events back to get activity period
    activity_stmt = (
        select(
            cohort_stmt.c.cohort_period,
            func.date_trunc(trunc, Event.occurred_at).label("activity_period"),
            func.count(func.distinct(Event.user_id)).label("user_count"),
        )
        .join(Event, Event.user_id == cohort_stmt.c.user_id)
        .where(
            Event.workspace_id == workspace_id,
            Event.event_name == return_event,
        )
        .group_by(cohort_stmt.c.cohort_period, func.date_trunc(trunc, Event.occurred_at))
        .order_by(cohort_stmt.c.cohort_period)
    )
    rows = (await db.execute(activity_stmt)).all()

    # Step 3: Get cohort sizes (users in period-0 for each cohort)
    cohort_size_stmt = (
        select(
            cohort_stmt.c.cohort_period,
            func.count(cohort_stmt.c.user_id).label("size"),
        )
        .group_by(cohort_stmt.c.cohort_period)
    )
    sizes = {row.cohort_period: row.size for row in (await db.execute(cohort_size_stmt)).all()}

    # Step 4: Build the cohort matrix
    cohort_map: dict = {}
    for row in rows:
        cp = row.cohort_period.date() if hasattr(row.cohort_period, "date") else row.cohort_period
        ap = row.activity_period.date() if hasattr(row.activity_period, "date") else row.activity_period
        if cp not in cohort_map:
            cohort_map[cp] = {}
        # Period index: 0 = same period as cohort, 1 = next period, etc.
        if granularity == "day":
            period_idx = (ap - cp).days
        elif granularity == "week":
            period_idx = ((ap - cp).days) // 7
        else:
            period_idx = (ap.year - cp.year) * 12 + (ap.month - cp.month)
        cohort_map[cp][str(period_idx)] = row.user_count

    cohorts = [
        CohortRow(
            cohort_date=cp,
            cohort_size=sizes.get(datetime.combine(cp, datetime.min.time()), 0),
            periods=cohort_map.get(cp, {}),
        )
        for cp in sorted(cohort_map.keys())
    ]

    return RetentionResponse(
        initial_event=initial_event,
        return_event=return_event,
        granularity=granularity,
        date_from=date_from,
        date_to=date_to,
        cohorts=cohorts,
        computed_at=datetime.now(timezone.utc),
    )
