import uuid
from datetime import date, datetime

from pydantic import BaseModel


class AnomalyResponse(BaseModel):
    id: uuid.UUID
    event_name: str
    detected_date: date
    metric: str
    expected_value: float | None
    actual_value: float | None
    z_score: float | None
    severity: str
    is_acknowledged: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AnomalyListResponse(BaseModel):
    anomalies: list[AnomalyResponse]
    total: int
