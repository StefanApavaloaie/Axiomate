"""
Aggregation Tasks
=================
Celery tasks for rolling up raw events into pre-aggregated metric tables.
This reduces dashboard query time from O(events) to O(days).

Status: Stub implementation — tasks are registered so Beat doesn't crash.
        Full aggregation logic to be implemented in Phase 2 (Caching).
"""
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="app.workers.aggregation_tasks.rollup_all_workspaces")
def rollup_all_workspaces() -> str:
    """
    Nightly task: rolls up daily event counts per workspace into a summary table.
    Currently a no-op stub — the raw event queries on the dashboard are fast enough
    for the current data volume. This will be implemented when we add the
    pre-aggregated metrics table for scale.
    """
    logger.info("[aggregation_tasks] rollup_all_workspaces called (stub — no-op)")
    return "aggregation stub: no-op"
