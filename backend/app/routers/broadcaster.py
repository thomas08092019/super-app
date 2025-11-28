"""
Broadcaster router
Sends messages to multiple chats with safety delays
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User
from app.schemas import BroadcastRequest, BroadcastResponse
from app.dependencies import get_current_user
from app.celery_worker import broadcast_message_task

router = APIRouter(prefix="/broadcast", tags=["Broadcaster"])


@router.post("/send", response_model=BroadcastResponse)
async def broadcast_message(
    request: BroadcastRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Broadcast a message to multiple chats
    Implements random delays to avoid Telegram flood bans
    """
    if not request.target_chat_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one target chat is required"
        )
    
    if not request.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty"
        )
    
    # Start Celery task
    task = broadcast_message_task.apply_async(
        args=[
            request.session_id,
            request.message,
            request.target_chat_ids,
            request.delay_min,
            request.delay_max
        ]
    )
    
    return BroadcastResponse(
        task_id=task.id,
        total_targets=len(request.target_chat_ids),
        status="pending"
    )


@router.get("/status/{task_id}")
async def get_broadcast_status(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get broadcast task status
    """
    from app.celery_worker import celery_app
    
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

