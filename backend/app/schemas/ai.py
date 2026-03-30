import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class AiQueryRequest(BaseModel):
    question: str = Field(..., min_length=5, max_length=1000)


class AiQueryResponse(BaseModel):
    id: uuid.UUID
    question: str
    llm_response: str
    model_used: str
    latency_ms: int
    created_at: datetime

    model_config = {"from_attributes": True}


class SavedQueryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    question: str
    last_response: str | None = None


class SavedQueryResponse(BaseModel):
    id: uuid.UUID
    name: str
    question: str
    last_response: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
