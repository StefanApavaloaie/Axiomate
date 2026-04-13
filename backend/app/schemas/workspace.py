import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")


class WorkspaceUpdate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")


class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceMemberResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceMemberWithUserResponse(BaseModel):
    """Member row with joined user info for the Settings > Team tab."""
    id: uuid.UUID
    user_id: uuid.UUID
    role: str
    created_at: datetime
    user_name: str | None
    user_email: str
    user_avatar_url: str | None

    model_config = {"from_attributes": True}


class InviteMemberRequest(BaseModel):
    email: str
    role: str = Field(default="member", pattern=r"^(owner|admin|member|viewer)$")


class WorkspaceMemberUpdate(BaseModel):
    role: str = Field(..., pattern=r"^(owner|admin|member|viewer)$")
