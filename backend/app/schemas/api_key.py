import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class ApiKeyCreatedResponse(BaseModel):
    """Returned only once when a key is created — includes the raw key."""
    id: uuid.UUID
    name: str
    key_prefix: str
    raw_key: str        # shown ONCE, never stored
    created_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyResponse(BaseModel):
    """Safe to return any time — raw key is NOT included."""
    id: uuid.UUID
    name: str
    key_prefix: str
    is_active: bool
    last_used_at: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
