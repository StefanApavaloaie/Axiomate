from datetime import date
from pydantic import BaseModel


class DailyMetricPoint(BaseModel):
    date: date
    event_count: int
    unique_users: int


class EventBreakdownItem(BaseModel):
    event_name: str
    total_count: int
    unique_users: int


class OverviewResponse(BaseModel):
    date_from: date
    date_to: date
    total_events: int
    total_unique_users: int
    daily_series: list[DailyMetricPoint]


class EventBreakdownResponse(BaseModel):
    date_from: date
    date_to: date
    events: list[EventBreakdownItem]
