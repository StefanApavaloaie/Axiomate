from celery import Celery
from celery.schedules import crontab

from app.config import settings

# ── Celery app instance ───────────────────────────────────────────────────────
celery_app = Celery(
    "axiomate",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.event_tasks",
        # "app.workers.aggregation_tasks",
        # "app.workers.anomaly_tasks",
        # "app.workers.report_tasks",
        # "app.workers.ai_tasks",
    ],
)

# ── Celery configuration ──────────────────────────────────────────────────────
celery_app.conf.update(
    broker_url=settings.CELERY_BROKER_URL,
    result_backend=settings.CELERY_RESULT_BACKEND,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,              # Re-queue task if worker crashes mid-task
    worker_prefetch_multiplier=1,     # Process one task at a time per worker
)

# ── Beat schedule (periodic tasks) ───────────────────────────────────────────
celery_app.conf.beat_schedule = {
    # Process unprocessed events every 5 minutes
    "process-events-every-5min": {
        "task": "app.workers.event_tasks.process_raw_events_all_workspaces",
        "schedule": crontab(minute="*/5"),
    },
    # Nightly metric rollup at 00:30 UTC
    "nightly-rollup": {
        "task": "app.workers.aggregation_tasks.rollup_all_workspaces",
        "schedule": crontab(hour=0, minute=30),
    },
    # Anomaly detection at 01:00 UTC
    "anomaly-detection": {
        "task": "app.workers.anomaly_tasks.detect_all_workspaces",
        "schedule": crontab(hour=1, minute=0),
    },
    # Daily summary reports at 08:00 UTC
    "daily-reports": {
        "task": "app.workers.report_tasks.send_daily_summaries",
        "schedule": crontab(hour=8, minute=0),
    },
}
