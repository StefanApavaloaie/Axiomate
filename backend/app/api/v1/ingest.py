import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from starlette.concurrency import run_in_threadpool

from app.dependencies import get_api_key_workspace_id
from app.schemas.event import BatchEventPayload, EventIngestionResponse
from app.workers.celery_app import celery_app

router = APIRouter(prefix="/ingest")


@router.post("/", response_model=EventIngestionResponse, status_code=202)
async def ingest_events(
    payload: BatchEventPayload,
    workspace_id: uuid.UUID = Depends(get_api_key_workspace_id),
):
    """
    High-throughput endpoint for ingesting analytics events.
    Events are placed into a Redis queue and processed asynchronously by Celery workers.
    """
    # Capture the exact time the server received the batch
    received_at = datetime.now(timezone.utc).isoformat()
    workspace_str = str(workspace_id)

    # Prepare events for Celery (JSON serializable)
    events_to_queue = []
    for event in payload.events:
        event_dict = event.model_dump(exclude_unset=True)
        # Ensure occurred_at is a string for JSON serialization in Celery
        if isinstance(event_dict.get("occurred_at"), datetime):
            event_dict["occurred_at"] = event_dict["occurred_at"].isoformat()
        
        # Inject server-side data
        event_dict["workspace_id"] = workspace_str
        event_dict["received_at"] = received_at
        
        events_to_queue.append(event_dict)

    # Dispatch to background worker using a threadpool to prevent freezing the asyncio loop
    await run_in_threadpool(
        celery_app.send_task,
        "app.workers.event_tasks.process_events_batch",
        args=[events_to_queue]
    )

    return EventIngestionResponse(
        received=len(events_to_queue),
        queued=len(events_to_queue),
        message="Events queued for processing"
    )
