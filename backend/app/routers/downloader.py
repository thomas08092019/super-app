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
async def start_download(request: DownloadRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Pass CHAT_IDS (list) not chat_id
    task = download_media_task.apply_async(args=[
        request.session_id, request.chat_ids, request.media_types, 
        request.start_time, request.end_time, request.limit, request.save_locally
    ])
    
    chat_label = "Multiple Chats" if len(request.chat_ids) > 1 else request.chat_ids[0] if request.chat_ids else "All"
    
    download_task = DownloadTask(
        user_id=current_user.id, session_id=request.session_id, 
        chat_id="BATCH", chat_name=chat_label,
        task_id=task.id, status="pending"
    )
    db.add(download_task); await db.commit(); await db.refresh(download_task)
    return download_task

@router.get("/tasks", response_model=List[DownloadTaskResponse])
async def list_download_tasks(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(DownloadTask).where(DownloadTask.user_id == current_user.id).order_by(DownloadTask.created_at.desc()))
    return result.scalars().all()

@router.get("/tasks/{task_id}/status")
async def get_task_status(task_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(DownloadTask).where(DownloadTask.task_id == task_id, DownloadTask.user_id == current_user.id))
    if not result.scalar_one_or_none(): raise HTTPException(404, "Task not found")
    celery_task = celery_app.AsyncResult(task_id)
    status_data = {"task_id": task_id, "status": celery_task.state, "info": {}}
    if celery_task.state == 'PROGRESS': status_data["info"] = celery_task.info
    elif celery_task.state == 'SUCCESS': status_data["info"] = celery_task.result
    elif celery_task.state == 'FAILURE': status_data["info"] = {"error": str(celery_task.info)}
    return status_data

@router.delete("/tasks/{task_id}")
async def cancel_download_task(task_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(DownloadTask).where(DownloadTask.task_id == task_id, DownloadTask.user_id == current_user.id))
    task_record = result.scalar_one_or_none()
    if not task_record: raise HTTPException(404, "Task not found")
    celery_app.control.revoke(task_id, terminate=True)
    task_record.status = "cancelled"; await db.commit(); return {"message": "Cancelled"}