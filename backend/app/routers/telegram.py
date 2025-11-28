"""
Telegram router
Handles Telegram account management and operations
"""
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import datetime
from app.database import get_db
from app.models import User, TelegramSession, MessageLog
from app.schemas import (
    TelegramLoginRequest, TelegramOTPRequest, Telegram2FARequest,
    TelegramSessionResponse, MessageResponse, ProfileLookupResponse,
    GroupLookupResponse
)
from app.dependencies import get_current_user
from app.telegram_service import TelegramManager
import json

router = APIRouter(prefix="/telegram", tags=["Telegram"])


@router.post("/login/send-code")
async def send_otp_code(
    request: TelegramLoginRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 1: Send OTP code to phone number
    """
    result = await TelegramManager.send_code(
        phone_number=request.phone_number,
        api_id=request.api_id,
        api_hash=request.api_hash,
        session_name=request.session_name
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to send code")
        )
    
    return result


@router.post("/login/verify-code")
async def verify_otp_code(
    request: TelegramOTPRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 2: Verify OTP code
    """
    result = await TelegramManager.verify_code(
        session_name=request.session_name,
        code=request.code
    )
    
    if result.get("requires_2fa"):
        return {
            "requires_2fa": True,
            "message": "2FA password required"
        }
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Invalid code")
        )
    
    # Save session to database (would need additional data from frontend)
    return {
        "success": True,
        "message": "Login successful",
        "session_string": result["session_string"]
    }


@router.post("/login/verify-2fa")
async def verify_2fa_password(
    request: Telegram2FARequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 3: Verify 2FA password (if required)
    """
    result = await TelegramManager.verify_2fa(
        session_name=request.session_name,
        password=request.password
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Invalid password")
        )
    
    return {
        "success": True,
        "message": "Login successful",
        "session_string": result["session_string"]
    }


@router.post("/sessions", response_model=TelegramSessionResponse)
async def create_session(
    session_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save Telegram session after successful login
    """
    new_session = TelegramSession(
        user_id=current_user.id,
        session_name=session_data["session_name"],
        session_string=session_data["session_string"],
        phone_number=session_data["phone_number"],
        api_id=session_data["api_id"],
        api_hash=session_data["api_hash"],
        is_active=True
    )
    
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    
    return new_session


@router.get("/sessions", response_model=List[TelegramSessionResponse])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all Telegram sessions for current user
    """
    result = await db.execute(
        select(TelegramSession).where(TelegramSession.user_id == current_user.id)
    )
    sessions = result.scalars().all()
    return sessions


@router.get("/sessions/{session_id}/chats")
async def list_chats(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all chats/groups for a Telegram session
    """
    from app.auth import decrypt_session_string
    from pyrogram import Client
    
    # Verify session belongs to user
    result = await db.execute(
        select(TelegramSession).where(
            TelegramSession.id == session_id,
            TelegramSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Check if client is already active
    client = TelegramManager.get_client(session_id)
    
    # If not active, create and start client
    if not client:
        try:
            import os
            workdir = f"./sessions/{session_id}"
            os.makedirs(workdir, exist_ok=True)
            
            # Decrypt session string
            session_string = decrypt_session_string(session.session_string)
            
            # Create client from session string
            client = Client(
                name=session.session_name,
                api_id=int(session.api_id),
                api_hash=session.api_hash,
                workdir=workdir,
                session_string=session_string
            )
            
            # Start client
            await client.start()
            
            # Store in active clients
            from app.telegram_service import active_clients
            active_clients[session_id] = client
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to start Telegram client: {str(e)}"
            )
    
    # Get chats from Telegram
    result = await TelegramManager.get_dialogs(session_id)
    
    if "error" in result and not result.get("chats"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["error"]
        )
    
    return result


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a Telegram session
    """
    result = await db.execute(
        select(TelegramSession).where(
            TelegramSession.id == session_id,
            TelegramSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Stop client if active
    await TelegramManager.stop_client(session_id)
    
    await db.delete(session)
    await db.commit()
    
    return {"message": "Session deleted successfully"}


@router.get("/profile/{username_or_phone}", response_model=ProfileLookupResponse)
async def lookup_profile(
    username_or_phone: str,
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    OSINT: Lookup user profile
    """
    result = await TelegramManager.get_profile_info(session_id, username_or_phone)
    
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )
    
    return result


@router.get("/group/{group_link}", response_model=GroupLookupResponse)
async def lookup_group(
    group_link: str,
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    OSINT: Lookup group/channel info
    """
    result = await TelegramManager.get_group_info(session_id, group_link)
    
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )
    
    return result


@router.websocket("/ws/feed/{session_id}")
async def websocket_feed(websocket: WebSocket, session_id: int):
    """
    WebSocket endpoint for real-time message feed
    """
    await websocket.accept()
    
    try:
        client = TelegramManager.get_client(session_id)
        if not client:
            await websocket.send_json({"error": "Session not active"})
            await websocket.close()
            return
        
        # Keep connection alive
        while True:
            try:
                # Wait for messages from frontend (ping/pong)
                data = await websocket.receive_text()
                
                # Echo back (you would implement actual message streaming here)
                await websocket.send_json({"status": "connected"})
                
            except WebSocketDisconnect:
                break
                
    except Exception as e:
        await websocket.send_json({"error": str(e)})
    finally:
        await websocket.close()

