from datetime import date, datetime

from pydantic import BaseModel


class RetentionPeriod(BaseModel):
    period: int         # 0 = cohort week, 1 = week after, etc.
    users: int
    retention_rate: float   # 0.0 to 1.0


class RetentionCohortRow(BaseModel):
    cohort_date: date
    initial_users: int
    periods: list[RetentionPeriod]


class RetentionResponse(BaseModel):
    granularity: str
    initial_event: str
    return_event: str
    cohorts: list[RetentionCohortRow]
    computed_at: datetime
