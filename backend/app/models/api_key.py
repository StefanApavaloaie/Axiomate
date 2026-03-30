import uuid
from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin, UUIDMixin

class ApiKey(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "api_keys"

    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by: Mapped[uuid.UUID|None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    key_prefix: Mapped[str] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_used_at: Mapped[str|None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[str|None] = mapped_column(Text, nullable=True)

    workspace: Mapped["Workspace"] =  relationship("Workspace", back_populates="api_keys")
