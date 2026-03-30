import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class FunnelStep(BaseModel):
    step: int
    event_name: str
    filters: dict = Field(default_factory=dict)


class FunnelCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    steps: list[FunnelStep] = Field(..., min_length=2)


class FunnelResponse(BaseModel):
    id: uuid.UUID
    name: str
    steps: list[FunnelStep]
    created_at: datetime

    model_config = {"from_attributes": True}


class FunnelStepResult(BaseModel):
    step: int
    event_name: str
    user_count: int
    conversion_rate: float      # 0.0 to 1.0


class FunnelResultResponse(BaseModel):
    funnel_id: uuid.UUID
    date_from: date
    date_to: date
    steps: list[FunnelStepResult]
    computed_at: datetime
