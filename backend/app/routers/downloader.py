"""
Media downloader router
Handles bulk media downloads with progress tracking
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User, DownloadTask
from app.schemas import DownloadRequest, DownloadTaskResponse
from app.dependencies import get_current_user
from app.celery_worker import celery_app, download_media_task
from typing import List
from datetime import datetime

router = APIRouter(prefix="/downloader", tags=["Downloader"])


@router.post("/start", response_model=DownloadTaskResponse)
async def start_download(
    request: DownloadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Start a media download task
    """
    # Start Celery task
    # IMPORTANT: Must pass save_locally here
    task = download_media_task.apply_async(
        args=[
            request.session_id,
            request.chat_id,
            request.media_types,
            request.start_time,
            request.end_time,
            request.limit,
            request.save_locally # <--- FIX: Truyền tham số này cho worker
        ]
    )
    
    # Create task record in database
    download_task = DownloadTask(
        user_id=current_user.id,
        session_id=request.session_id,
        chat_id=request.chat_id,
        task_id=task.id,
        status="pending"
    )
    
    db.add(download_task)
    await db.commit()
    await db.refresh(download_task)
    
    return download_task


@router.get("/tasks", response_model=List[DownloadTaskResponse])
async def list_download_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all download tasks for current user
    """
    result = await db.execute(
        select(DownloadTask)
        .where(DownloadTask.user_id == current_user.id)
        .order_by(DownloadTask.created_at.desc())
    )
    tasks = result.scalars().all()
    return tasks


@router.get("/tasks/{task_id}/status")
async def get_task_status(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get real-time status of a download task
    """
    # Get task from database
    result = await db.execute(
        select(DownloadTask).where(
            DownloadTask.task_id == task_id,
            DownloadTask.user_id == current_user.id
        )
    )
    task_record = result.scalar_one_or_none()
    
    if not task_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Get Celery task status
    celery_task = celery_app.AsyncResult(task_id)
    
    status_data = {
        "task_id": task_id,
        "status": celery_task.state,
        "info": {}
    }
    
    if celery_task.state == 'PROGRESS':
        status_data["info"] = celery_task.info
    elif celery_task.state == 'SUCCESS':
        status_data["info"] = celery_task.result
    elif celery_task.state == 'FAILURE':
        status_data["info"] = {"error": str(celery_task.info)}
    
    return status_data


@router.delete("/tasks/{task_id}")
async def cancel_download_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancel a download task
    """
    # Get task from database
    result = await db.execute(
        select(DownloadTask).where(
            DownloadTask.task_id == task_id,
            DownloadTask.user_id == current_user.id
        )
    )
    task_record = result.scalar_one_or_none()
    
    if not task_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Revoke Celery task
    celery_app.control.revoke(task_id, terminate=True)
    
    # Update database
    task_record.status = "cancelled"
    await db.commit()
    
    return {"message": "Task cancelled successfully"}