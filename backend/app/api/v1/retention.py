import csv
import io
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
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
    Groups users by the day/week/month they first fired `initial_event`,
    then tracks how many came back and fired `return_event` in subsequent periods.
    """
    await _verify_member(workspace_id, current_user.id, db)

    if not date_to:
        date_to = date.today()
    if not date_from:
        date_from = date_to - timedelta(days=83)

    # Convert to timezone-aware datetimes for filtering
    dt_from = datetime(date_from.year, date_from.month, date_from.day, tzinfo=timezone.utc)
    dt_to = datetime(date_to.year, date_to.month, date_to.day, 23, 59, 59, tzinfo=timezone.utc)

    # ── Step 1: Get each user's cohort date (first initial_event in range) ──────
    cohort_result = await db.execute(
        select(Event.user_id, func.min(Event.occurred_at).label("first_event"))
        .where(
            Event.workspace_id == workspace_id,
            Event.event_name == initial_event,
            Event.user_id.is_not(None),
            Event.occurred_at >= dt_from,
            Event.occurred_at <= dt_to,
        )
        .group_by(Event.user_id)
    )
    cohort_rows = cohort_result.all()

    if not cohort_rows:
        return RetentionResponse(
            initial_event=initial_event,
            return_event=return_event,
            granularity=granularity,
            date_from=date_from,
            date_to=date_to,
            cohorts=[],
            computed_at=datetime.now(timezone.utc),
        )

    # Build user_id → cohort_date dict, truncated to the chosen granularity
    def truncate_date(d: date, gran: str) -> date:
        if gran == "day":
            return d
        elif gran == "week":
            return d - timedelta(days=d.weekday())  # Monday of that week
        else:  # month
            return d.replace(day=1)

    user_cohort: dict[str, date] = {}
    for row in cohort_rows:
        raw = row.first_event
        as_date = raw.date() if hasattr(raw, "date") else raw
        user_cohort[row.user_id] = truncate_date(as_date, granularity)

    # ── Step 2: Get all return events for the cohort users ─────────────────────
    user_ids = list(user_cohort.keys())
    activity_result = await db.execute(
        select(Event.user_id, Event.occurred_at)
        .where(
            Event.workspace_id == workspace_id,
            Event.event_name == return_event,
            Event.user_id.in_(user_ids),
        )
    )
    activity_rows = activity_result.all()

    # ── Step 3: Build cohort matrix in Python ──────────────────────────────────
    # cohort_date → period_idx → set of unique users
    cohort_user_counts: dict[date, dict[int, set]] = {}
    cohort_sizes: dict[date, set] = {}  # track unique users per cohort

    # Count cohort sizes (unique users per cohort period)
    for uid, cohort_date in user_cohort.items():
        if cohort_date not in cohort_sizes:
            cohort_sizes[cohort_date] = set()
        cohort_sizes[cohort_date].add(uid)

    # Map return events to cohort periods
    for row in activity_rows:
        uid = row.user_id
        if uid not in user_cohort:
            continue

        cohort_date = user_cohort[uid]
        raw = row.occurred_at
        activity_date = raw.date() if hasattr(raw, "date") else raw
        activity_period = truncate_date(activity_date, granularity)

        if granularity == "day":
            period_idx = (activity_period - cohort_date).days
        elif granularity == "week":
            period_idx = (activity_period - cohort_date).days // 7
        else:
            period_idx = (activity_period.year - cohort_date.year) * 12 + (
                activity_period.month - cohort_date.month
            )

        if period_idx < 0:
            continue  # skip events before cohort date (data anomalies)

        if cohort_date not in cohort_user_counts:
            cohort_user_counts[cohort_date] = {}
        if period_idx not in cohort_user_counts[cohort_date]:
            cohort_user_counts[cohort_date][period_idx] = set()
        cohort_user_counts[cohort_date][period_idx].add(uid)

    # ── Step 4: Assemble the response ──────────────────────────────────────────
    cohorts = [
        CohortRow(
            cohort_date=cp,
            cohort_size=len(cohort_sizes.get(cp, set())),
            periods={str(k): len(v) for k, v in sorted(periods.items())},
        )
        for cp, periods in sorted(cohort_user_counts.items())
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


@router.get("/{workspace_id}/export")
async def export_retention_csv(
    workspace_id: uuid.UUID,
    initial_event: str = Query(...),
    return_event: str = Query(...),
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    granularity: str = Query(default="day", pattern="^(day|week)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download retention cohort matrix as a CSV file."""
    result = await get_retention(
        workspace_id=workspace_id,
        initial_event=initial_event,
        return_event=return_event,
        date_from=date_from,
        date_to=date_to,
        granularity=granularity,
        current_user=current_user,
        db=db,
    )

    # Determine max periods
    max_period = max(
        (int(p) for c in result.cohorts for p in c.periods.keys()),
        default=0,
    )

    output = io.StringIO()
    output.write("sep=,\n")
    writer = csv.writer(output)
    writer.writerow(
        ["cohort_date", "cohort_size"] + [f"period_{i}" for i in range(max_period + 1)]
    )
    for cohort in result.cohorts:
        row = [cohort.cohort_date, cohort.cohort_size]
        for i in range(max_period + 1):
            row.append(cohort.periods.get(str(i), 0))
        writer.writerow(row)
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=retention_{date_from}_{date_to}.csv"},
    )
