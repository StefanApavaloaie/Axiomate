import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class EventPayload(BaseModel):
    """Single event sent by client SDK."""
    event_id: str = Field(..., description="Client-generated unique ID for deduplication")
    event_name: str = Field(..., min_length=1, max_length=255)
    user_id: str | None = None
    anonymous_id: str | None = None
    session_id: str | None = None
    occurred_at: datetime
    properties: dict = Field(default_factory=dict)
    context: dict = Field(default_factory=dict)


class BatchEventPayload(BaseModel):
    """Batch of events — max 500 per request."""
    events: list[EventPayload] = Field(..., min_length=1, max_length=500)


class EventIngestionResponse(BaseModel):
    received: int
    queued: int
    message: str = "Events queued for processing"
