import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import generate_api_key
from app.db.session import get_db
from app.dependencies import get_current_user, get_workspace_member, require_role
from app.models.api_key import ApiKey
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.schemas.api_key import ApiKeyCreate, ApiKeyCreatedResponse, ApiKeyResponse

router = APIRouter(prefix="/api-keys")


# Standardized checks used below


@router.post("/{workspace_id}", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    workspace_id: uuid.UUID,
    data: ApiKeyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    member: WorkspaceMember = Depends(require_role("owner", "admin")),
):
    """Generates a new API key for a workspace. The raw key is shown ONCE and never stored."""

    raw_key, key_hash, key_prefix = generate_api_key()

    new_key = ApiKey(
        workspace_id=workspace_id,
        created_by=current_user.id,
        name=data.name,
        key_hash=key_hash,
        key_prefix=key_prefix,
        is_active=True,
    )
    db.add(new_key)
    await db.commit()
    await db.refresh(new_key)

    # Attach the raw_key to the response — it is NEVER stored
    return ApiKeyCreatedResponse(
        id=new_key.id,
        name=new_key.name,
        key_prefix=new_key.key_prefix,
        raw_key=raw_key,
        created_at=new_key.created_at,
    )


@router.get("/{workspace_id}", response_model=List[ApiKeyResponse])
async def list_api_keys(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    member: WorkspaceMember = Depends(require_role("owner", "admin", "member")),
):
    """Lists all active API keys for a workspace (raw key is never returned). Admin/Owner/Member."""

    result = await db.execute(
        select(ApiKey).where(
            ApiKey.workspace_id == workspace_id,
            ApiKey.is_active == True,
        ).order_by(ApiKey.created_at.desc())
    )
    return result.scalars().all()


@router.delete("/{workspace_id}/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    workspace_id: uuid.UUID,
    key_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    member: WorkspaceMember = Depends(require_role("owner", "admin")),
):
    """Revokes (soft-deletes) an API key by setting is_active=False. Admin/Owner only."""

    result = await db.execute(
        select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.workspace_id == workspace_id,
        )
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found.")

    key.is_active = False
    await db.commit()
