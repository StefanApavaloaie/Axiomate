import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.dependencies import get_current_user, get_workspace_member, require_role
from app.models.anomaly import Anomaly
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.schemas.anomaly import AnomalyListResponse, AnomalyResponse
from app.services.cache_service import cache

router = APIRouter(prefix="/anomalies")


# Standard verification used below


@router.get("/{workspace_id}", response_model=AnomalyListResponse)
async def list_anomalies(
    workspace_id: uuid.UUID,
    severity: str | None = Query(default=None, pattern="^(info|warning|critical)$"),
    unacknowledged_only: bool = Query(default=False),
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    member: WorkspaceMember = Depends(get_workspace_member),
):
    """
    Lists anomalies detected by background Celery jobs for a workspace.
    Supports filtering by severity and acknowledgement status.
    Results are Redis-cached for 1 hour (invalidated when an anomaly is acknowledged).
    """

    # ── Cache check ────────────────────────────────────────────────────────────
    cache_key = f"axiomate:anomalies:{workspace_id}:{severity}:{unacknowledged_only}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return AnomalyListResponse(**cached)

    stmt = select(Anomaly).where(Anomaly.workspace_id == workspace_id)

    if severity:
        stmt = stmt.where(Anomaly.severity == severity)
    if unacknowledged_only:
        stmt = stmt.where(Anomaly.is_acknowledged == False)

    stmt = stmt.order_by(Anomaly.created_at.desc()).limit(limit)
    anomalies = (await db.execute(stmt)).scalars().all()

    result = AnomalyListResponse(
        anomalies=[AnomalyResponse.model_validate(a) for a in anomalies],
        total=len(anomalies),
    )

    # ── Store in cache ─────────────────────────────────────────────────────────
    await cache.set(cache_key, result.model_dump(), ttl=settings.CACHE_TTL_ANOMALIES)

    return result


@router.patch("/{workspace_id}/{anomaly_id}/acknowledge", response_model=AnomalyResponse)
async def acknowledge_anomaly(
    workspace_id: uuid.UUID,
    anomaly_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    member: WorkspaceMember = Depends(require_role("owner", "admin", "member")),
):
    """Marks an anomaly as acknowledged. Member+ only."""

    result = await db.execute(
        select(Anomaly).where(
            Anomaly.id == anomaly_id,
            Anomaly.workspace_id == workspace_id,
        )
    )
    anomaly = result.scalar_one_or_none()
    if not anomaly:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anomaly not found.")

    anomaly.is_acknowledged = True
    await db.commit()
    await db.refresh(anomaly)

    # ── Invalidate cache ────────────────────────────────────────────────────────
    # The acknowledge action changes what list_anomalies returns, so we delete
    # all anomaly cache entries for this workspace (covers all filter combos).
    await cache.invalidate_workspace(str(workspace_id))

    return AnomalyResponse.model_validate(anomaly)
