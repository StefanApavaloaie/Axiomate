import uuid
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB
from datetime import  datetime
from app.models.base import Base, UUIDMixin, TimestampMixin

class Event(Base, UUIDMixin):
    __tablename__ = "events"

    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id: Mapped[str] = mapped_column(String(255), nullable=False)
    event_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    #user identity
    user_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    anonymous_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    session_id: Mapped[str|None] = mapped_column(String(255), nullable=True)

    #JSONB clumns
    properties: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    context: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    #timestamps
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_processed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    __table_args__ = (
        #sa nu apara acelasi event de 2 ori in acelasi workspace
        {"schema": None},
    )
    