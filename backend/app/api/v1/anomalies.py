import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.anomaly import Anomaly
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.schemas.anomaly import AnomalyListResponse, AnomalyResponse

router = APIRouter(prefix="/anomalies")


async def _verify_member(workspace_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession):
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")


@router.get("/{workspace_id}", response_model=AnomalyListResponse)
async def list_anomalies(
    workspace_id: uuid.UUID,
    severity: str | None = Query(default=None, pattern="^(info|warning|critical)$"),
    unacknowledged_only: bool = Query(default=False),
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists anomalies detected by background Celery jobs for a workspace.
    Supports filtering by severity and acknowledgement status.
    """
    await _verify_member(workspace_id, current_user.id, db)

    stmt = select(Anomaly).where(Anomaly.workspace_id == workspace_id)

    if severity:
        stmt = stmt.where(Anomaly.severity == severity)
    if unacknowledged_only:
        stmt = stmt.where(Anomaly.is_acknowledged == False)

    stmt = stmt.order_by(Anomaly.created_at.desc()).limit(limit)
    anomalies = (await db.execute(stmt)).scalars().all()

    return AnomalyListResponse(
        anomalies=[AnomalyResponse.model_validate(a) for a in anomalies],
        total=len(anomalies),
    )


@router.patch("/{workspace_id}/{anomaly_id}/acknowledge", response_model=AnomalyResponse)
async def acknowledge_anomaly(
    workspace_id: uuid.UUID,
    anomaly_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Marks an anomaly as acknowledged so it stops appearing in alerts."""
    await _verify_member(workspace_id, current_user.id, db)

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
    return AnomalyResponse.model_validate(anomaly)
