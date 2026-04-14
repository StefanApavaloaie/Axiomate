import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
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


# ── Notification Settings ─────────────────────────────────────────────────────

class NotificationSettingsUpdate(BaseModel):
    alert_webhook_url: str | None = None


class NotificationSettingsResponse(BaseModel):
    alert_webhook_url: str | None
    model_config = {"from_attributes": True}


@router.get("/{workspace_id}/notifications", response_model=NotificationSettingsResponse)
async def get_notification_settings(
    workspace_id: uuid.UUID,
    member: WorkspaceMember = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Returns the current notification/webhook settings for the workspace."""
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id, Workspace.deleted_at.is_(None))
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    return NotificationSettingsResponse(alert_webhook_url=ws.alert_webhook_url)


@router.patch("/{workspace_id}/notifications", response_model=NotificationSettingsResponse)
async def update_notification_settings(
    workspace_id: uuid.UUID,
    data: NotificationSettingsUpdate,
    member: WorkspaceMember = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Saves a Slack or Discord webhook URL for the workspace.
    When a critical/warning anomaly is detected, Axiomate will POST to this URL.
    Owner or Admin only.
    """
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id, Workspace.deleted_at.is_(None))
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    ws.alert_webhook_url = data.alert_webhook_url
    await db.commit()
    await db.refresh(ws)
    return NotificationSettingsResponse(alert_webhook_url=ws.alert_webhook_url)


@router.post("/{workspace_id}/notifications/test", status_code=200)
async def test_notification_webhook(
    workspace_id: uuid.UUID,
    member: WorkspaceMember = Depends(require_role("owner", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Sends a test notification to the configured webhook URL to verify it works.
    Returns 400 if no webhook URL is configured, 502 if the webhook call fails.
    """
    import httpx

    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id, Workspace.deleted_at.is_(None))
    )
    ws = result.scalar_one_or_none()
    if not ws or not ws.alert_webhook_url:
        raise HTTPException(status_code=400, detail="No webhook URL configured for this workspace.")

    payload = _build_webhook_payload(
        workspace_name=ws.name,
        event_name="test_event",
        severity="warning",
        z_score=3.1,
        expected=500.0,
        actual=120.0,
        is_test=True,
        webhook_url=ws.alert_webhook_url,
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(ws.alert_webhook_url, json=payload)
            resp.raise_for_status()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Webhook delivery failed: {exc}. Check that the URL is a valid Slack or Discord Incoming Webhook."
        )

    return {"message": "Test notification sent successfully."}


def _build_webhook_payload(
    workspace_name: str,
    event_name: str,
    severity: str,
    z_score: float,
    expected: float,
    actual: float,
    is_test: bool = False,
    webhook_url: str = "",
) -> dict:
    """
    Builds a webhook payload for either Slack or Discord.

    The key fix: Discord and Slack use incompatible JSON schemas.
    Sending Slack's `attachments` field to Discord causes a 400 Bad Request
    because Discord interprets `attachments` as file upload metadata, not
    rich message formatting. We detect the target platform by URL and send
    ONLY the matching format.

    - Discord URLs contain `discord.com/api/webhooks/`  → Discord format
    - All other URLs                                     → Slack format
    """
    severity_emoji = {"warning": "⚠️", "critical": "🚨"}.get(severity, "ℹ️")
    severity_color = {"warning": 16776960, "critical": 16711680}.get(severity, 3447003)
    test_prefix = "[TEST] " if is_test else ""
    direction = "spike 📈" if z_score > 0 else "drop 📉"

    title = f"{test_prefix}{severity_emoji} Axiomate Alert — {workspace_name}"
    body_md = (                                   # Discord supports markdown
        f"**Event:** `{event_name}`\n"
        f"**Severity:** {severity.upper()}\n"
        f"**Expected volume:** {expected:.0f} events\n"
        f"**Actual volume:** {actual:.0f} events\n"
        f"**Z-score:** {z_score:+.2f} ({direction})"
    )
    body_plain = body_md.replace("**", "*")       # Slack uses mrkdwn (*bold*)

    is_discord = "discord.com/api/webhooks" in webhook_url

    if is_discord:
        return {
            "content": title,
            "embeds": [{
                "title": f"Anomaly Detected: {event_name}",
                "description": body_md,
                "color": severity_color,
                "footer": {"text": "Axiomate Analytics"},
            }],
        }
    else:
        # Slack Incoming Webhook format
        return {
            "text": title,
            "attachments": [{
                "color": "danger" if severity == "critical" else "warning",
                "text": body_plain,
            }],
        }
