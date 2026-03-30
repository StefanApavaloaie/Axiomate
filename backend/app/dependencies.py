import uuid

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import decode_token, hash_api_key
from app.db.session import get_db
from app.models.api_key import ApiKey
from app.models.user import User
from app.models.workspace import WorkspaceMember

# ── JWT Bearer scheme ─────────────────────────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Extracts and validates the JWT from the Authorization header.
    Returns the User object or raises 401.
    """
    if credentials is None:
        raise UnauthorizedException("Missing Authorization header")

    try:
        payload = decode_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise UnauthorizedException("Invalid token payload")
    except JWTError:
        raise UnauthorizedException("Invalid or expired token")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if user is None:
        raise UnauthorizedException("User not found")

    return user


async def get_workspace_member(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceMember:
    """
    Verifies the current user is a member of the given workspace.
    Returns the WorkspaceMember row or raises 403.
    """
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
    )
    member = result.scalar_one_or_none()

    if member is None:
        raise ForbiddenException("You are not a member of this workspace")

    return member


def require_role(*allowed_roles: str):
    """
    Role-based access control dependency factory.
    Usage: Depends(require_role("owner", "admin"))
    """
    async def check_role(
        member: WorkspaceMember = Depends(get_workspace_member),
    ) -> WorkspaceMember:
        if member.role not in allowed_roles:
            raise ForbiddenException(
                f"Required role: {' or '.join(allowed_roles)}. Your role: {member.role}"
            )
        return member

    return check_role


async def get_api_key_workspace_id(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> uuid.UUID:
    """
    Validates an API key from the X-API-Key header.
    Used exclusively on ingestion endpoints.
    Returns the workspace_id that the key belongs to.
    """
    key_hash = hash_api_key(x_api_key)

    result = await db.execute(
        select(ApiKey).where(
            ApiKey.key_hash == key_hash,
            ApiKey.is_active == True,  # noqa: E712
        )
    )
    api_key = result.scalar_one_or_none()

    if api_key is None:
        raise UnauthorizedException("Invalid or revoked API key")

    return api_key.workspace_id
