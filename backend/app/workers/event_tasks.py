import asyncio
import sys
import uuid
from typing import Dict, List

from celery import shared_task
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.event import Event

# Ensure Celery app config is loaded so @shared_task uses the correct broker URL
from app.workers.celery_app import celery_app

# Apply Windows event loop fix for psycopg if running on Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


async def _process_events_batch(events_payload: List[Dict]) -> str:
    """
    Asynchronous coroutine that actually performs the database bulk insert.
    """
    if not events_payload:
        return "No events to process"

    # Pre-process rows: ensure UUIDs are strings instead of pydantic strings? 
    # Actually SQLAlchemy can accept correctly formatted strings for UUID columns.
    
    async with AsyncSessionLocal() as session:
        # High-throughput PostgreSQL bulk INSERT via SQLAlchemy 2.0 Core
        await session.execute(
            insert(Event).values(events_payload)
        )
        await session.commit()
        
    return f"Successfully inserted {len(events_payload)} events"


@shared_task(name="app.workers.event_tasks.process_events_batch")
def process_events_batch(events_payload: List[Dict]) -> str:
    """
    Celery task that receives a batch of serialized events and executes
    the bulk insert synchronously wrapping the async call.
    """
    # Simply run the coroutine in the synchronous worker thread
    return asyncio.run(_process_events_batch(events_payload))


@shared_task(name="app.workers.event_tasks.process_raw_events_all_workspaces")
def process_raw_events_all_workspaces() -> str:
    """
    Scheduled task (cron) to sweep and process any stuck events.
    (Stubbed for future periodic reconciliation)
    """
    return "periodic sweep complete"
