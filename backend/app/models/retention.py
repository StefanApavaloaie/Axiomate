import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin


class RetentionCohort(Base, UUIDMixin):
    __tablename__ = "retention_cohorts"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cohort_date: Mapped[date] = mapped_column(Date, nullable=False)
    granularity: Mapped[str] = mapped_column(String(20), nullable=False, default="week")
    initial_event: Mapped[str] = mapped_column(String(255), nullable=False)
    return_event: Mapped[str] = mapped_column(String(255), nullable=False)
    periods: Mapped[dict] = mapped_column(JSONB, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
