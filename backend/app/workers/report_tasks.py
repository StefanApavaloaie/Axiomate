"""
Report Tasks
============
Celery tasks for sending scheduled reports and notifications to workspace members.

Status: Stub implementation — tasks are registered so Beat doesn't crash.
        Full email/webhook notification logic to be implemented in Phase 3 (Alerts).
"""
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="app.workers.report_tasks.send_daily_summaries")
def send_daily_summaries() -> str:
    """
    Daily task: sends a summary email/webhook to workspace owners with key metrics.
    Currently a no-op stub. Full implementation will fire when the webhook/email
    notification system is built in Phase 3.
    """
    logger.info("[report_tasks] send_daily_summaries called (stub — no-op)")
    return "reports stub: no-op"
