import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.report import Report
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.schemas.report import ReportCreate, ReportResponse

router = APIRouter(prefix="/reports")


async def _verify_member(workspace_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession):
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")


@router.post("/{workspace_id}", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    workspace_id: uuid.UUID,
    data: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creates a new saved report definition (optionally with a cron schedule)."""
    await _verify_member(workspace_id, current_user.id, db)

    report = Report(
        workspace_id=workspace_id,
        created_by=current_user.id,
        name=data.name,
        type=data.type,
        config=data.config,
        is_scheduled=data.is_scheduled,
        schedule_cron=data.schedule_cron,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


@router.get("/{workspace_id}", response_model=List[ReportResponse])
async def list_reports(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists all saved reports for a workspace."""
    await _verify_member(workspace_id, current_user.id, db)

    result = await db.execute(
        select(Report)
        .where(Report.workspace_id == workspace_id)
        .order_by(Report.created_at.desc())
    )
    return result.scalars().all()


@router.delete("/{workspace_id}/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    workspace_id: uuid.UUID,
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deletes a saved report."""
    await _verify_member(workspace_id, current_user.id, db)

    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.workspace_id == workspace_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    await db.delete(report)
    await db.commit()
