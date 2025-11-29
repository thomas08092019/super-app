from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, distinct, delete
from app.database import get_db
from app.models import User, DumpTask, DumpedMessage, TelegramSession
from app.schemas import DumpRequest, DumpTaskResponse
from app.dependencies import get_current_user
from app.celery_worker import celery_app, dump_messages_task
from typing import List, Optional
from datetime import datetime, timezone

router = APIRouter(prefix="/dumper", tags=["Message Dumper"])

@router.post("/start", response_model=DumpTaskResponse)
async def start_dump(
    request: DumpRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_date_naive = request.start_time.replace(tzinfo=None) if request.start_time else datetime.utcnow()
    chat_label = "Multiple Chats" if len(request.chat_ids) > 1 else request.chat_ids[0] if request.chat_ids else "ALL"
    
    dump_task = DumpTask(
        user_id=current_user.id,
        session_id=request.session_id,
        chat_id=chat_label,
        task_id="pending", 
        status="pending",
        target_date=target_date_naive
    )
    db.add(dump_task)
    await db.commit()
    await db.refresh(dump_task)
    
    task = dump_messages_task.apply_async(
        args=[request.session_id, request.chat_ids, request.start_time, request.end_time, dump_task.id]
    )
    
    dump_task.task_id = task.id
    await db.commit()
    await db.refresh(dump_task)
    
    return DumpTaskResponse(
        id=dump_task.id, 
        task_id=dump_task.task_id, 
        status="pending", 
        chat_name=chat_label, 
        total_messages=0, 
        progress=0, 
        created_at=dump_task.created_at
    )

@router.post("/auto-dump")
async def trigger_auto_dump_today(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sessions = (await db.execute(select(TelegramSession).where(TelegramSession.is_active == True))).scalars().all()
    
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_end = datetime.utcnow().replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
    
    triggered_tasks = []
    
    for s in sessions:
        dump_task = DumpTask(
            user_id=current_user.id,
            session_id=s.id,
            chat_id="ALL (Auto-Dump)",
            task_id="pending",
            status="pending",
            target_date=datetime.utcnow()
        )
        db.add(dump_task)
        await db.commit()
        await db.refresh(dump_task)

        task = dump_messages_task.apply_async(
            args=[s.id, [], today_start, today_end, dump_task.id]
        )
        
        dump_task.task_id = task.id
        await db.commit()
        triggered_tasks.append(task.id)

    return {"message": f"Triggered auto-dump for {len(triggered_tasks)} sessions", "task_ids": triggered_tasks}

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

@router.delete("/clear")
async def clear_all_dump_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await db.execute(delete(DumpedMessage))
    await db.execute(delete(DumpTask))
    await db.commit()
    return {"message": "All dump data cleared successfully"}

@router.get("/messages")
async def get_dumped_messages(
    session_id: Optional[int] = None,
    chat_id: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(DumpedMessage)
    if session_id: query = query.where(DumpedMessage.session_id == session_id)
    else: query = query.where(DumpedMessage.session_id.in_(select(TelegramSession.id).where(TelegramSession.user_id == current_user.id)))
    
    if chat_id: query = query.where(DumpedMessage.chat_id == chat_id)
    if search: query = query.where(DumpedMessage.content.ilike(f"%{search}%"))
    
    if start_date: query = query.where(DumpedMessage.message_date >= start_date.replace(tzinfo=None))
    if end_date: query = query.where(DumpedMessage.message_date <= end_date.replace(tzinfo=None))
    
    query = query.order_by(desc(DumpedMessage.message_date)).offset((page-1)*limit).limit(limit)
    result = await db.execute(query)
    messages = result.scalars().all()
    
    formatted = []
    for m in messages:
        if m.message_date.tzinfo is None:
             m.message_date = m.message_date.replace(tzinfo=timezone.utc)
        formatted.append(m)
    return formatted

@router.get("/groups")
async def get_dumped_groups(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(distinct(DumpedMessage.chat_id), DumpedMessage.chat_name).where(DumpedMessage.session_id.in_(select(TelegramSession.id).where(TelegramSession.user_id == current_user.id)))
    return [{"id": row[0], "name": row[1]} for row in (await db.execute(query)).all()]