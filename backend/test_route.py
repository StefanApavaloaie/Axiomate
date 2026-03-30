import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.api.v1.ingest import ingest_events
from app.schemas.event import BatchEventPayload, EventPayload
import uuid
from datetime import datetime, timezone

async def main():
    payload = BatchEventPayload(events=[
        EventPayload(event_id="test", event_name="test", occurred_at=datetime.now(timezone.utc))
    ])
    try:
        print("Running route handler...")
        response = await ingest_events(payload, uuid.uuid4())
        print(response)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
