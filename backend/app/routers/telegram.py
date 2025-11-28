from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, distinct
from typing import List, Optional
from datetime import datetime, timezone
from app.database import get_db
from app.models import User, TelegramSession, MessageLog
from app.schemas import TelegramLoginRequest, TelegramOTPRequest, Telegram2FARequest, TelegramSessionResponse, ProfileLookupResponse, GroupLookupResponse
from app.dependencies import get_current_user
from app.telegram_service import TelegramManager, set_broadcast_callback
from app.auth import decrypt_session_string
import asyncio

router = APIRouter(prefix="/telegram", tags=["Telegram"])
active_websockets: dict[int, List[WebSocket]] = {}

async def ws_broadcast(session_id: int, message_log: MessageLog):
    ts_str = message_log.timestamp.isoformat() if message_log.timestamp else ""
    if not ts_str.endswith("Z"): ts_str += "Z"
    message_data = {
        "type": "message", "session_id": session_id,
        "message": {
            "id": message_log.id, "telegram_message_id": message_log.telegram_message_id,
            "session_id": session_id, # Ensure session_id is included in message object
            "chat_id": message_log.chat_id, "chat_name": message_log.chat_name, "chat_username": message_log.chat_username,
            "sender_id": message_log.sender_id, "sender_name": message_log.sender_name, "sender_username": message_log.sender_username,
            "content": message_log.content, "media_type": message_log.media_type, "timestamp": ts_str
        }
    }
    async def broadcast_to_list(sockets):
        to_remove = []
        for ws in list(sockets):
            try: await ws.send_json(message_data)
            except: to_remove.append(ws)
        for ws in to_remove:
            if ws in sockets: sockets.remove(ws)
    if session_id in active_websockets: await broadcast_to_list(active_websockets[session_id])
    if 0 in active_websockets: await broadcast_to_list(active_websockets[0])

set_broadcast_callback(ws_broadcast)

async def ensure_client_active(session_id: int, db: AsyncSession):
    client = TelegramManager.get_client(session_id)
    if client: await TelegramManager.start_client(client, session_id); return client
    res = await db.execute(select(TelegramSession).where(TelegramSession.id == session_id))
    sess = res.scalar_one_or_none()
    if not sess or not sess.is_active: return None
    try:
        client = await TelegramManager.create_client(sess.session_name, sess.api_id, sess.api_hash, sess.phone_number, sess.id, decrypt_session_string(sess.session_string))
        await TelegramManager.start_client(client, session_id)
        return client
    except Exception as e: print(f"Auto-start fail {session_id}: {e}"); return None

async def ensure_all_active_clients(db: AsyncSession):
    res = await db.execute(select(TelegramSession).where(TelegramSession.is_active == True))
    for s in res.scalars().all():
        if not TelegramManager.get_client(s.id): await ensure_client_active(s.id, db)

@router.get("/messages")
async def get_messages(session_id: Optional[int] = None, chat_id: Optional[str] = None, search: Optional[str] = None, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None, page: int = 1, limit: int = 50, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(MessageLog)
    if session_id and session_id > 0: query = query.where(MessageLog.session_id == session_id)
    else: query = query.where(MessageLog.session_id.in_(select(TelegramSession.id).where(TelegramSession.user_id == current_user.id)))
    if chat_id: query = query.where(MessageLog.chat_id == chat_id)
    if search: query = query.where(MessageLog.content.ilike(f"%{search}%"))
    if start_date: query = query.where(MessageLog.timestamp >= start_date)
    if end_date: query = query.where(MessageLog.timestamp <= end_date)
    query = query.order_by(desc(MessageLog.timestamp)).offset((page - 1) * limit).limit(limit)
    results = (await db.execute(query)).scalars().all()
    formatted_results = []
    for msg in results:
        ts = msg.timestamp
        if ts.tzinfo is None: ts = ts.replace(tzinfo=timezone.utc)
        msg.timestamp = ts
        formatted_results.append(msg)
    return formatted_results

@router.get("/groups")
async def get_groups_history(session_id: Optional[int] = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(distinct(MessageLog.chat_id), MessageLog.chat_name)
    if session_id and session_id > 0: query = query.where(MessageLog.session_id == session_id)
    else: query = query.where(MessageLog.session_id.in_(select(TelegramSession.id).where(TelegramSession.user_id == current_user.id)))
    return [{"id": row[0], "name": row[1]} for row in (await db.execute(query.group_by(MessageLog.chat_id, MessageLog.chat_name))).all()]

@router.post("/sessions", response_model=TelegramSessionResponse)
async def create_session(d: dict, db: AsyncSession = Depends(get_db), u: User = Depends(get_current_user)):
    s = TelegramSession(user_id=u.id, session_name=d["session_name"], session_string=d["session_string"], phone_number=d["phone_number"], api_id=d["api_id"], api_hash=d["api_hash"], is_active=True)
    db.add(s); await db.commit(); await db.refresh(s); await ensure_client_active(s.id, db); return s

@router.get("/sessions", response_model=List[TelegramSessionResponse])
async def list_sessions(db: AsyncSession = Depends(get_db), u: User = Depends(get_current_user)):
    res = await db.execute(select(TelegramSession).where(TelegramSession.user_id == u.id))
    sessions = res.scalars().all()
    for s in sessions:
        if s.is_active: asyncio.create_task(ensure_client_active(s.id, db))
    return sessions

@router.delete("/sessions/{id}")
async def delete_session(id: int, db: AsyncSession = Depends(get_db), u: User = Depends(get_current_user)):
    res = await db.execute(select(TelegramSession).where(TelegramSession.id == id, TelegramSession.user_id == u.id))
    s = res.scalar_one_or_none()
    if not s: raise HTTPException(404, "Not found")
    await TelegramManager.stop_client(id); await db.delete(s); await db.commit(); return {"message": "Deleted"}

@router.get("/sessions/{id}/chats")
async def list_chats(id: int, db: AsyncSession = Depends(get_db), u: User = Depends(get_current_user)):
    await ensure_client_active(id, db); return await TelegramManager.get_dialogs(id)

@router.get("/profile/{q}", response_model=ProfileLookupResponse)
async def lookup_profile(q: str, session_id: int, db: AsyncSession = Depends(get_db), u: User = Depends(get_current_user)):
    await ensure_client_active(session_id, db); return await TelegramManager.get_profile_info(session_id, q)

@router.get("/group/{q}", response_model=GroupLookupResponse)
async def lookup_group(q: str, session_id: int, db: AsyncSession = Depends(get_db), u: User = Depends(get_current_user)):
    await ensure_client_active(session_id, db); return await TelegramManager.get_group_info(session_id, q)

@router.post("/login/send-code")
async def send_otp(r: TelegramLoginRequest):
    res = await TelegramManager.send_code(r.phone_number, r.api_id, r.api_hash, r.session_name)
    if not res.get("success"): raise HTTPException(400, res.get("error"))
    return res

@router.post("/login/verify-code")
async def verify_otp(r: TelegramOTPRequest):
    res = await TelegramManager.verify_code(r.session_name, r.code)
    if res.get("requires_2fa"): return {"requires_2fa": True, "message": "2FA Required"}
    if not res.get("success"): raise HTTPException(400, res.get("error"))
    return res

@router.post("/login/verify-2fa")
async def verify_2fa(r: Telegram2FARequest):
    res = await TelegramManager.verify_2fa(r.session_name, r.password)
    if not res.get("success"): raise HTTPException(400, res.get("error"))
    return res

@router.websocket("/ws/feed/{sid}")
async def websocket_feed(ws: WebSocket, sid: int, db: AsyncSession = Depends(get_db)):
    await ws.accept()
    if sid == 0: await ensure_all_active_clients(db)
    else: await ensure_client_active(sid, db)
    if sid not in active_websockets: active_websockets[sid] = []
    active_websockets[sid].append(ws)
    try:
        while True: await ws.receive_text()
    except WebSocketDisconnect:
        if sid in active_websockets and ws in active_websockets[sid]: active_websockets[sid].remove(ws)