import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user, get_workspace_member, require_role
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceMemberWithUserResponse,
    WorkspaceResponse,
    InviteMemberRequest,
    WorkspaceMemberUpdate
)

router = APIRouter(prefix="/workspaces")


@router.post("/", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    data: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creates a new workspace and sets the current user as the owner."""

    slug_check = await db.execute(select(Workspace).where(
        Workspace.slug == data.slug,
        Workspace.deleted_at.is_(None)
    ))
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
    """Returns all non-deleted workspaces the currently authenticated user belongs to."""
    stmt = (
        select(Workspace)
        .join(WorkspaceMember, Workspace.id == WorkspaceMember.workspace_id)
        .where(
            WorkspaceMember.user_id == current_user.id,
            Workspace.deleted_at.is_(None)
        )
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
        select(WorkspaceMember)
        .join(Workspace, Workspace.id == WorkspaceMember.workspace_id)
        .where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
            Workspace.deleted_at.is_(None)
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
            Workspace.deleted_at.is_(None)
        )
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")
    return ws


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: uuid.UUID,
    data: WorkspaceUpdate,
    member: WorkspaceMember = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Renames a workspace. Requires owner or admin role."""
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id, Workspace.deleted_at.is_(None))
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")
    
    # Check if new slug conflicts
    if data.slug != ws.slug:
        slug_check = await db.execute(select(Workspace).where(
            Workspace.slug == data.slug,
            Workspace.deleted_at.is_(None)
        ))
        if slug_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A workspace with that slug already exists.",
            )

    ws.name = data.name
    ws.slug = data.slug
    await db.commit()
    await db.refresh(ws)
    return ws


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: uuid.UUID,
    member: WorkspaceMember = Depends(require_role("owner")),
    db: AsyncSession = Depends(get_db),
):
    """Soft deletes a workspace and renames its slug to free the namespace."""
    from sqlalchemy.sql import func
    
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id, Workspace.deleted_at.is_(None))
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")
    
    ws.deleted_at = func.now()
    ws.slug = f"{ws.slug}-del-{str(uuid.uuid4())[:8]}"
    await db.commit()
    return None


@router.post("/{workspace_id}/members", status_code=status.HTTP_201_CREATED)
async def invite_workspace_member(
    workspace_id: uuid.UUID,
    data: InviteMemberRequest,
    member: WorkspaceMember = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Invites an email to the workspace. If they don't exist, creates a shadow user."""
    # Ensure workspace exists and is active
    ws_result = await db.execute(select(Workspace).where(Workspace.id == workspace_id, Workspace.deleted_at.is_(None)))
    if not ws_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Workspace not found.")

    email = data.email.lower().strip()

    # Check if user exists
    user_result = await db.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()

    if not user:
        # Create shadow user
        shadow_sub = f"shadow-{uuid.uuid4()}"
        user = User(
            email=email,
            google_sub=shadow_sub,
            name=email.split("@")[0].capitalize(),
            avatar_url=None
        )
        db.add(user)
        await db.flush()
    
    # Check if they are already in the workspace
    mem_result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.id
        )
    )
    existing_member = mem_result.scalar_one_or_none()
    if existing_member:
        raise HTTPException(status_code=400, detail="User is already in the workspace.")

    # Add them to workspace
    new_member = WorkspaceMember(
        user_id=user.id,
        workspace_id=workspace_id,
        role=data.role
    )
    db.add(new_member)
    await db.commit()
    
    return {"message": "User invited successfully."}


@router.delete("/{workspace_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_workspace_member(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    member: WorkspaceMember = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Removes a user from a workspace. Admins cannot remove owners."""
    target_result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id
        )
    )
    target_member = target_result.scalar_one_or_none()
    
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found in workspace.")
        
    if target_member.role == "owner" and member.role != "owner":
        raise HTTPException(status_code=403, detail="Admins cannot remove owners.")
        
    if target_member.user_id == member.user_id:
        raise HTTPException(status_code=400, detail="You cannot remove yourself this way.")

    await db.delete(target_member)
    await db.commit()
    return None


@router.patch("/{workspace_id}/members/{user_id}", response_model=WorkspaceMemberWithUserResponse)
async def update_workspace_member(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    data: WorkspaceMemberUpdate,
    member: WorkspaceMember = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Updates a member's role. Admins cannot promote to owner or demote owners."""
    target_result = await db.execute(
        select(WorkspaceMember, User)
        .join(User, WorkspaceMember.user_id == User.id)
        .where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id
        )
    )
    res = target_result.one_or_none()
    if not res:
        raise HTTPException(status_code=404, detail="Member not found in workspace.")
    
    target_member, target_user = res
        
    # Security Checks
    # 1. Non-Owners cannot touch Owners
    if target_member.role == "owner" and member.role != "owner":
        raise HTTPException(status_code=403, detail="Admins cannot change owner roles.")
        
    # 2. Non-Owners cannot promote anyone to Owner
    if data.role == "owner" and member.role != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can transfer ownership.")

    # 3. Prevent owners from demoting themselves (must transfer ownership first)
    if target_member.user_id == member.user_id and target_member.role == "owner" and data.role != "owner":
        raise HTTPException(status_code=400, detail="Owners must transfer ownership before demoting themselves.")

    target_member.role = data.role
    await db.commit()
    await db.refresh(target_member)
    
    return WorkspaceMemberWithUserResponse(
        id=target_member.id,
        user_id=target_member.user_id,
        role=target_member.role,
        created_at=target_member.created_at,
        user_name=target_user.name,
        user_email=target_user.email,
        user_avatar_url=target_user.avatar_url,
    )
