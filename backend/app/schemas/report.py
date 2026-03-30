import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ReportCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: str = Field(..., pattern=r"^(dashboard|funnel|retention|custom)$")
    config: dict = Field(default_factory=dict)
    is_scheduled: bool = False
    schedule_cron: str | None = None


class ReportResponse(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    config: dict
    is_scheduled: bool
    schedule_cron: str | None
    last_run_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
