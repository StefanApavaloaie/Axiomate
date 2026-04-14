"""
Anomaly Detection Tasks
=======================
Celery tasks that run nightly to detect statistical anomalies in event volumes.

Detection algorithm: z-score on the previous 14 days of daily event counts.
  - |z| >= 4.0 → critical
  - |z| >= 2.5 → warning

After saving anomalies, fires a webhook notification if the workspace has one
configured (works with Slack Incoming Webhooks and Discord webhooks).
"""
import asyncio
import logging
import statistics
from datetime import date, timedelta
from typing import Dict, Optional

import httpx
from celery import shared_task
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.anomaly import Anomaly
from app.models.event import Event
from app.models.workspace import Workspace

logger = logging.getLogger(__name__)


# ── Webhook delivery ──────────────────────────────────────────────────────────

def _build_alert_payload(
    workspace_name: str,
    event_name: str,
    severity: str,
    z_score: float,
    expected: float,
    actual: float,
    webhook_url: str = "",
) -> dict:
    """
    Builds a platform-specific webhook payload.
    Discord and Slack use incompatible schemas — we detect the URL and send
    only the matching format to avoid 400 errors.
    """
    emoji = {"warning": "⚠️", "critical": "🚨"}.get(severity, "ℹ️")
    color_int = {"warning": 16776960, "critical": 16711680}.get(severity, 3447003)
    direction = "spike 📈" if z_score > 0 else "drop 📉"

    title = f"{emoji} Axiomate Alert — {workspace_name}"
    body_md = (
        f"**Event:** `{event_name}`\n"
        f"**Severity:** {severity.upper()}\n"
        f"**Expected volume:** {expected:.0f} events\n"
        f"**Actual volume:** {actual:.0f} events\n"
        f"**Z-score:** {z_score:+.2f} ({direction})"
    )

    is_discord = "discord.com/api/webhooks" in webhook_url

    if is_discord:
        return {
            "content": title,
            "embeds": [{
                "title": f"Anomaly Detected: {event_name}",
                "description": body_md,
                "color": color_int,
                "footer": {"text": "Axiomate Analytics"},
            }],
        }
    else:
        return {
            "text": title,
            "attachments": [{
                "color": "danger" if severity == "critical" else "warning",
                "text": body_md.replace("**", "*"),
            }],
        }


async def _fire_webhook(url: str, payload: dict) -> None:
    """POST the anomaly payload to the workspace webhook. Errors are logged, not raised."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            logger.info("Webhook delivered successfully to %s", url[:40])
    except Exception as exc:
        logger.warning("Webhook delivery failed: %s", exc)


# ── Detection logic ───────────────────────────────────────────────────────────

async def _detect_all_workspaces() -> None:
    async with AsyncSessionLocal() as session:
        workspaces_result = await session.execute(
            select(Workspace.id, Workspace.name, Workspace.alert_webhook_url)
            .where(Workspace.deleted_at.is_(None))
        )
        workspaces = workspaces_result.all()

        today = date.today()
        target_date = today - timedelta(days=1)
        start_date = target_date - timedelta(days=14)

        for w_id, w_name, w_webhook in workspaces:
            try:
                new_anomalies = await _detect_for_workspace(
                    session, w_id, start_date, target_date
                )
                # Fire webhook for each new anomaly if URL is configured
                if w_webhook and new_anomalies:
                    for anomaly in new_anomalies:
                        payload = _build_alert_payload(
                            workspace_name=w_name,
                            event_name=anomaly.event_name,
                            severity=anomaly.severity,
                            z_score=float(anomaly.z_score),
                            expected=float(anomaly.expected_value),
                            actual=float(anomaly.actual_value),
                            webhook_url=w_webhook,
                        )
                        await _fire_webhook(w_webhook, payload)
            except Exception as exc:
                logger.error("Anomaly detection failed for workspace %s: %s", w_id, exc)


async def _detect_for_workspace(
    session: AsyncSession,
    workspace_id,
    start_date: date,
    target_date: date,
) -> list:
    """
    Runs z-score anomaly detection for a single workspace.
    Returns a list of newly created Anomaly ORM objects.
    """
    stmt = (
        select(
            Event.event_name,
            func.date(Event.occurred_at).label("day"),
            func.count(Event.id).label("total"),
        )
        .where(
            Event.workspace_id == workspace_id,
            func.date(Event.occurred_at) >= start_date,
            func.date(Event.occurred_at) <= target_date,
        )
        .group_by(Event.event_name, func.date(Event.occurred_at))
    )
    rows = (await session.execute(stmt)).all()

    # Organise: { event_name: { date: count } }
    event_data: Dict[str, Dict[date, int]] = {}
    for event_name, day, total in rows:
        if hasattr(day, "date"):
            day = day.date()
        event_data.setdefault(event_name, {})[day] = total

    new_anomalies = []

    for event_name, days_counts in event_data.items():
        baseline_counts = [
            days_counts.get(target_date - timedelta(days=i), 0)
            for i in range(1, 15)
        ]
        target_count = days_counts.get(target_date, 0)

        mean = statistics.mean(baseline_counts) if baseline_counts else 0
        stddev = statistics.stdev(baseline_counts) if len(baseline_counts) > 1 else 0
        if stddev < 1.0:
            stddev = 1.0

        z_score = (target_count - mean) / stddev
        abs_z = abs(z_score)

        # Ignore noise (very low volume baselines)
        if mean < 5 and target_count < 10:
            continue

        severity: Optional[str] = None
        if abs_z >= 4.0:
            severity = "critical"
        elif abs_z >= 2.5:
            severity = "warning"

        if severity:
            anomaly = Anomaly(
                workspace_id=workspace_id,
                event_name=event_name,
                detected_date=target_date,
                metric="daily_volume",
                expected_value=round(mean, 1),
                actual_value=float(target_count),
                z_score=round(z_score, 2),
                severity=severity,
                is_acknowledged=False,
            )
            new_anomalies.append(anomaly)

    if new_anomalies:
        session.add_all(new_anomalies)
        await session.commit()
        logger.info(
            "Saved %d anomalies for workspace %s", len(new_anomalies), workspace_id
        )

    return new_anomalies


# ── Celery task entry point ───────────────────────────────────────────────────

@shared_task(name="app.workers.anomaly_tasks.detect_all_workspaces")
def detect_all_workspaces() -> str:
    """
    Scheduled by Celery Beat at 01:00 UTC nightly.
    Detects anomalies across all active workspaces and fires webhook alerts.
    """
    asyncio.run(_detect_all_workspaces())
    return "anomaly detection complete"
