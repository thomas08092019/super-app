"""
Telegram router
"""
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, distinct
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models import User, TelegramSession, MessageLog
from app.schemas import (
    TelegramLoginRequest, TelegramOTPRequest, Telegram2FARequest,
    TelegramSessionResponse, ProfileLookupResponse, GroupLookupResponse
)
from app.dependencies import get_current_user
from app.telegram_service import TelegramManager, set_broadcast_callback
from app.auth import decrypt_session_string
import asyncio

router = APIRouter(prefix="/telegram", tags=["Telegram"])

active_websockets: dict[int, List[WebSocket]] = {}

async def ws_broadcast(session_id: int, message_log: MessageLog):
    if session_id in active_websockets:
        ts_str = message_log.timestamp.isoformat() if message_log.timestamp else ""
        if not ts_str.endswith("Z"): ts_str += "Z"

        message_data = {
            "type": "message",
            "session_id": session_id,
            "message": {
                "id": message_log.id,
                "telegram_message_id": message_log.telegram_message_id,
                "chat_id": message_log.chat_id,
                "chat_name": message_log.chat_name,
                "chat_username": message_log.chat_username, # Added
                "sender_id": message_log.sender_id,
                "sender_name": message_log.sender_name,
                "sender_username": message_log.sender_username, # Added
                "content": message_log.content,
                "media_type": message_log.media_type,
                "timestamp": ts_str
            }
        }
        to_remove = []
        for ws in active_websockets[session_id]:
            try: await ws.send_json(message_data)
            except Exception: to_remove.append(ws)
        for ws in to_remove:
            if ws in active_websockets[session_id]: active_websockets[session_id].remove(ws)

set_broadcast_callback(ws_broadcast)

async def ensure_client_active(session_id: int, db: AsyncSession):
    client = TelegramManager.get_client(session_id)
    if client:
        await TelegramManager.start_client(client, session_id)
        return client
    result = await db.execute(select(TelegramSession).where(TelegramSession.id == session_id))
    session_data = result.scalar_one_or_none()
    if not session_data or not session_data.is_active: return None
    try:
        session_string = decrypt_session_string(session_data.session_string)
        client = await TelegramManager.create_client(
            session_name=session_data.session_name, api_id=session_data.api_id,
            api_hash=session_data.api_hash, phone_number=session_data.phone_number,
            session_id=session_data.id, session_string=session_string
        )
        await TelegramManager.start_client(client, session_id)
        return client
    except Exception as e:
        print(f"Failed to auto-start client {session_id}: {e}")
        return None

# --- API Endpoints ---

@router.get("/messages")
async def get_messages(
    session_id: Optional[int] = None,
    chat_id: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = 1,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(MessageLog)
    if session_id: query = query.where(MessageLog.session_id == session_id)
    else:
        subquery = select(TelegramSession.id).where(TelegramSession.user_id == current_user.id)
        query = query.where(MessageLog.session_id.in_(subquery))
    if chat_id: query = query.where(MessageLog.chat_id == chat_id)
    if search: query = query.where(MessageLog.content.ilike(f"%{search}%"))
    if start_date: query = query.where(MessageLog.timestamp >= start_date)
    if end_date: query = query.where(MessageLog.timestamp <= end_date)
    query = query.order_by(desc(MessageLog.timestamp))
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/groups")
async def get_groups_history(
    session_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(distinct(MessageLog.chat_id), MessageLog.chat_name)
    if session_id: query = query.where(MessageLog.session_id == session_id)
    else:
        subquery = select(TelegramSession.id).where(TelegramSession.user_id == current_user.id)
        query = query.where(MessageLog.session_id.in_(subquery))
    query = query.group_by(MessageLog.chat_id, MessageLog.chat_name)
    result = await db.execute(query)
    return [{"id": row[0], "name": row[1]} for row in result.all()]

@router.post("/sessions", response_model=TelegramSessionResponse)
async def create_session(session_data: dict, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_session = TelegramSession(
        user_id=current_user.id, session_name=session_data["session_name"],
        session_string=session_data["session_string"], phone_number=session_data["phone_number"],
        api_id=session_data["api_id"], api_hash=session_data["api_hash"], is_active=True
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    await ensure_client_active(new_session.id, db)
    return new_session

@router.get("/sessions", response_model=List[TelegramSessionResponse])
async def list_sessions(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(TelegramSession).where(TelegramSession.user_id == current_user.id))
    sessions = result.scalars().all()
    for session in sessions:
        if session.is_active: asyncio.create_task(ensure_client_active(session.id, db))
    return sessions

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(TelegramSession).where(TelegramSession.id == session_id, TelegramSession.user_id == current_user.id))
    session = result.scalar_one_or_none()
    if not session: raise HTTPException(status_code=404, detail="Session not found")
    await TelegramManager.stop_client(session_id)
    await db.delete(session)
    await db.commit()
    return {"message": "Deleted"}

@router.get("/sessions/{session_id}/chats")
async def list_chats(session_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await ensure_client_active(session_id, db)
    return await TelegramManager.get_dialogs(session_id)

@router.get("/profile/{username_or_phone}", response_model=ProfileLookupResponse)
async def lookup_profile(username_or_phone: str, session_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await ensure_client_active(session_id, db)
    return await TelegramManager.get_profile_info(session_id, username_or_phone)

@router.get("/group/{group_link}", response_model=GroupLookupResponse)
async def lookup_group(group_link: str, session_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await ensure_client_active(session_id, db)
    return await TelegramManager.get_group_info(session_id, group_link)

@router.post("/login/send-code")
async def send_otp_code(request: TelegramLoginRequest):
    result = await TelegramManager.send_code(request.phone_number, request.api_id, request.api_hash, request.session_name)
    if not result.get("success"): raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@router.post("/login/verify-code")
async def verify_otp_code(request: TelegramOTPRequest):
    result = await TelegramManager.verify_code(request.session_name, request.code)
    if result.get("requires_2fa"): return {"requires_2fa": True, "message": "2FA Required"}
    if not result.get("success"): raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@router.post("/login/verify-2fa")
async def verify_2fa_password(request: Telegram2FARequest):
    result = await TelegramManager.verify_2fa(request.session_name, request.password)
    if not result.get("success"): raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@router.websocket("/ws/feed/{session_id}")
async def websocket_feed(websocket: WebSocket, session_id: int, db: AsyncSession = Depends(get_db)):
    await websocket.accept()
    if session_id > 0: await ensure_client_active(session_id, db)
    
    if session_id not in active_websockets: active_websockets[session_id] = []
    active_websockets[session_id].append(websocket)
    
    try:
        while True: await websocket.receive_text()
    except WebSocketDisconnect:
        if session_id in active_websockets:
            if websocket in active_websockets[session_id]: active_websockets[session_id].remove(websocket)