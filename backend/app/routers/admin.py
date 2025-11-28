from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from app.database import get_db
from app.models import User, TelegramSession, MessageLog, DownloadedFile, DownloadTask
from app.schemas import UserResponse, UserUpdateStatus, ResetPasswordRequest
from app.dependencies import get_admin_user
from app.auth import hash_password

router = APIRouter(prefix="/admin", tags=["Admin Panel"])

@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    sessions_query = select(func.count()).select_from(TelegramSession).where(TelegramSession.is_active == True)
    sessions_count = await db.scalar(sessions_query)

    messages_query = select(func.count()).select_from(MessageLog)
    messages_count = await db.scalar(messages_query)

    files_query = select(func.count()).select_from(DownloadedFile)
    files_count = await db.scalar(files_query)

    tasks_query = select(func.count()).select_from(DownloadTask).where(DownloadTask.status.in_(['pending', 'running']))
    tasks_count = await db.scalar(tasks_query)

    return {
        "active_sessions": sessions_count or 0,
        "total_messages": messages_count or 0,
        "total_files": files_count or 0,
        "active_tasks": tasks_count or 0
    }

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return users

@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    return user

@router.patch("/users/{user_id}/status", response_model=UserResponse)
async def update_user_status(
    user_id: int,
    status_update: UserUpdateStatus,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    if user.id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change your own status")
    
    user.status = status_update.status
    await db.commit()
    await db.refresh(user)
    
    return user

@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    reset_request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    user.hashed_password = hash_password(reset_request.new_password)
    await db.commit()
    
    return {
        "message": "Password reset successfully",
        "user_id": user_id
    }

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    await db.delete(user)
    await db.commit()
    
    return {
        "message": "User deleted successfully",
        "user_id": user_id
    }