from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, distinct
from app.database import get_db
from app.models import User, DumpTask, DumpedMessage, TelegramSession
from app.schemas import DumpRequest, DumpTaskResponse
from app.dependencies import get_current_user
from app.celery_worker import celery_app, dump_messages_task
from typing import List, Optional
from datetime import datetime, timezone

router = APIRouter(prefix="/dumper", tags=["Message Dumper"])

@router.post("/start", response_model=DumpTaskResponse)
async def start_dump(request: DumpRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    chat_label = "Multiple Chats" if len(request.chat_ids) > 1 else request.chat_ids[0] if request.chat_ids else "ALL"
    
    dump_task = DumpTask(
        user_id=current_user.id, session_id=request.session_id, chat_id=chat_label,
        task_id="pending", status="pending", target_date=request.start_time or datetime.utcnow()
    )
    db.add(dump_task); await db.commit(); await db.refresh(dump_task)
    
    task = dump_messages_task.apply_async(
        args=[request.session_id, request.chat_ids, request.start_time, request.end_time, dump_task.id]
    )
    dump_task.task_id = task.id; await db.commit(); await db.refresh(dump_task)
    return DumpTaskResponse(id=dump_task.id, task_id=dump_task.task_id, status="pending", chat_name=chat_label, total_messages=0, progress=0, created_at=dump_task.created_at)

@router.get("/status/{task_id}")
async def get_status(task_id: str):
    task = celery_app.AsyncResult(task_id)
    res = {"task_id": task_id, "status": task.state, "info": {}}
    if task.state == 'PROGRESS': res["info"] = task.info
    elif task.state == 'SUCCESS': res["info"] = task.result
    elif task.state == 'FAILURE': res["info"] = {"error": str(task.info)}
    return res

@router.delete("/stop/{task_id}")
async def stop_dump(task_id: str):
    celery_app.control.revoke(task_id, terminate=True)
    return {"message": "Stopped"}

@router.get("/messages")
async def get_dumped_messages(session_id: Optional[int]=None, chat_id: Optional[str]=None, search: Optional[str]=None, page: int=1, limit: int=20, db: AsyncSession=Depends(get_db), current_user: User=Depends(get_current_user)):
    query = select(DumpedMessage)
    if session_id: query = query.where(DumpedMessage.session_id == session_id)
    else: query = query.where(DumpedMessage.session_id.in_(select(TelegramSession.id).where(TelegramSession.user_id == current_user.id)))
    if chat_id: query = query.where(DumpedMessage.chat_id == chat_id)
    if search: query = query.where(DumpedMessage.content.ilike(f"%{search}%"))
    query = query.order_by(desc(DumpedMessage.message_date)).offset((page-1)*limit).limit(limit)
    result = await db.execute(query)
    messages = result.scalars().all()
    for m in messages:
        if m.message_date.tzinfo is None: m.message_date = m.message_date.replace(tzinfo=timezone.utc)
    return messages

@router.get("/groups")
async def get_dumped_groups(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(distinct(DumpedMessage.chat_id), DumpedMessage.chat_name).where(DumpedMessage.session_id.in_(select(TelegramSession.id).where(TelegramSession.user_id == current_user.id)))
    return [{"id": row[0], "name": row[1]} for row in (await db.execute(query)).all()]