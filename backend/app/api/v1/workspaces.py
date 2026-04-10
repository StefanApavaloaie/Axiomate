import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceMemberWithUserResponse,
    WorkspaceResponse,
)

router = APIRouter(prefix="/workspaces")


@router.post("/", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    data: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creates a new workspace and sets the current user as the owner."""

    slug_check = await db.execute(select(Workspace).where(Workspace.slug == data.slug))
    if slug_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A workspace with that slug already exists.",
        )

    new_workspace = Workspace(name=data.name, slug=data.slug)
    db.add(new_workspace)
    await db.flush()

    owner_member = WorkspaceMember(
        user_id=current_user.id,
        workspace_id=new_workspace.id,
        role="owner",
    )
    db.add(owner_member)
    await db.commit()
    await db.refresh(new_workspace)
    return new_workspace


@router.get("/", response_model=List[WorkspaceResponse])
async def list_my_workspaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns all workspaces the currently authenticated user belongs to."""
    stmt = (
        select(Workspace)
        .join(WorkspaceMember, Workspace.id == WorkspaceMember.workspace_id)
        .where(WorkspaceMember.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{workspace_id}/members", response_model=List[WorkspaceMemberWithUserResponse])
async def list_workspace_members(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns all members of a workspace with their user info."""
    access = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
    )
    if not access.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    rows = await db.execute(
        select(WorkspaceMember, User)
        .join(User, WorkspaceMember.user_id == User.id)
        .where(WorkspaceMember.workspace_id == workspace_id)
        .order_by(WorkspaceMember.created_at)
    )

    return [
        WorkspaceMemberWithUserResponse(
            id=member.id,
            user_id=member.user_id,
            role=member.role,
            created_at=member.created_at,
            user_name=user.name,
            user_email=user.email,
            user_avatar_url=user.avatar_url,
        )
        for member, user in rows.all()
    ]


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns details of a single workspace."""
    result = await db.execute(
        select(Workspace)
        .join(WorkspaceMember, Workspace.id == WorkspaceMember.workspace_id)
        .where(
            Workspace.id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")
    return ws
