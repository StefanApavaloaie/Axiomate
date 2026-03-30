import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.schemas.workspace import WorkspaceCreate, WorkspaceResponse

router = APIRouter(prefix="/workspaces")

@router.post("/", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    data: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creates a new workspace and sets the current user as the owner."""
    
    # Check if a workspace with the given slug already exists globally
    slug_check = await db.execute(select(Workspace).where(Workspace.slug == data.slug))
    if slug_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A workspace with that slug already exists.",
        )

    # 1. Create the Workspace
    new_workspace = Workspace(
        name=data.name,
        slug=data.slug,
        owner_id=current_user.id
    )
    db.add(new_workspace)
    await db.flush() # Secure a new UUID without closing the transaction

    # 2. Automatically link the creator as an "owner"
    owner_member = WorkspaceMember(
        user_id=current_user.id,
        workspace_id=new_workspace.id,
        role="owner"
    )
    db.add(owner_member)
    
    # 3. Finalize all changes
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
