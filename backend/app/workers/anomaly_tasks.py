import asyncio
from datetime import date, timedelta
import statistics
import logging
from typing import Dict, List, Tuple

from celery import shared_task
from sqlalchemy import select, func, insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.session import AsyncSessionLocal
from app.models.event import Event
from app.models.workspace import Workspace
from app.models.anomaly import Anomaly

logger = logging.getLogger(__name__)

async def _detect_all_workspaces():
    async with AsyncSessionLocal() as session:
        # Get all workspaces
        workspaces_result = await session.execute(select(Workspace.id))
        workspace_ids = workspaces_result.scalars().all()

        today = date.today()
        # We look back 14 days. 
        # Baseline = (today - 14 days) to (today - 1 day)
        # Target = today (or yesterday if today just started)
        # Commonly, anomaly detection on daily batch runs right after midnight for the *previous* complete day.
        # So Target = today - 1 day, Baseline = days -2 to -15.
        target_date = today - timedelta(days=1)
        start_date = target_date - timedelta(days=14)

        for w_id in workspace_ids:
            try:
                await _detect_anomalies_for_workspace(session, w_id, start_date, target_date)
            except Exception as e:
                logger.error(f"Anomaly detection failed for workspace {w_id}: {e}")

async def _detect_anomalies_for_workspace(session: AsyncSession, workspace_id, start_date: date, target_date: date):
    # Get daily counts grouped by event_name and date for the last 15 days
    stmt = (
        select(
            Event.event_name,
            func.date(Event.occurred_at).label("day"),
            func.count(Event.id).label("total")
        )
        .where(
            Event.workspace_id == workspace_id,
            func.date(Event.occurred_at) >= start_date,
            func.date(Event.occurred_at) <= target_date
        )
        .group_by(Event.event_name, func.date(Event.occurred_at))
    )
    
    rows = (await session.execute(stmt)).all()
    
    # Organize data: { "event_name": { date_obj: count } }
    event_data: Dict[str, Dict[date, int]] = {}
    for event_name, day, total in rows:
        # Cast to standard python date just in case
        if hasattr(day, "date"): day = day.date()
        if type(day) is not date: day = day
        
        if event_name not in event_data:
            event_data[event_name] = {}
        event_data[event_name][day] = total
        
    new_anomalies = []
    
    for event_name, days_counts in event_data.items():
        # Build baseline array (counts for days strictly before target_date)
        baseline_counts = []
        for i in range(1, 15):
            d = target_date - timedelta(days=i)
            baseline_counts.append(days_counts.get(d, 0))
            
        target_count = days_counts.get(target_date, 0)
        
        # Calculate stats
        mean = statistics.mean(baseline_counts) if len(baseline_counts) > 0 else 0
        stddev = statistics.stdev(baseline_counts) if len(baseline_counts) > 1 else 0
        
        # Avoid division by zero
        if stddev < 1.0:
            stddev = 1.0
            
        z_score = (target_count - mean) / stddev
        
        # Identify thresholds
        # e.g., > 2.5 standard deviations is a warning, > 4.0 is critical
        abs_z = abs(z_score)
        severity = None
        if abs_z >= 4.0:
            severity = "critical"
        elif abs_z >= 2.5:
            severity = "warning"
            
        # Ignore if the baseline mean is really low (e.g. noise like 0-3 events)
        if mean < 5 and target_count < 10:
            continue
            
        if severity:
            new_anomalies.append(
                Anomaly(
                    workspace_id=workspace_id,
                    event_name=event_name,
                    detected_date=target_date,
                    metric="daily_volume",
                    expected_value=round(mean, 1),
                    actual_value=float(target_count),
                    z_score=round(z_score, 2),
                    severity=severity,
                    is_acknowledged=False
                )
            )
            
    if new_anomalies:
        session.add_all(new_anomalies)
        await session.commit()
    

@shared_task(name="app.workers.anomaly_tasks.detect_all_workspaces")
def detect_all_workspaces() -> str:
    """
    Celery beat scheduling target to run anomaly detection across all workspaces.
    """
    asyncio.run(_detect_all_workspaces())
    return "anomaly detection complete"
