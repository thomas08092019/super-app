from pyrogram import Client, filters
from pyrogram.types import Message
from pyrogram.handlers import MessageHandler
from typing import Dict, Optional, Callable
import os
from datetime import datetime, timezone
from app.database import AsyncSessionLocal
from app.models import MessageLog
from app.auth import encrypt_session_string

active_clients: Dict[int, Client] = {}
pending_auth: Dict[str, Dict] = {}
broadcast_callback: Optional[Callable] = None

def set_broadcast_callback(callback: Callable):
    global broadcast_callback
    broadcast_callback = callback

class TelegramManager:
    @staticmethod
    def get_client(session_id: int) -> Optional[Client]: return active_clients.get(session_id)
    
    @staticmethod
    async def create_client(session_name: str, api_id: str, api_hash: str, phone_number: str, session_id: int, session_string: str = None) -> Client:
        workdir = f"./sessions/{session_id}"
        os.makedirs(workdir, exist_ok=True)
        return Client(name=session_name, api_id=int(api_id), api_hash=api_hash, workdir=workdir, phone_number=phone_number, session_string=session_string)
    
    @staticmethod
    async def start_client(client: Client, session_id: int):
        async def persistence_handler(client: Client, message: Message):
            try:
                print(f"[DEBUG] New message from {message.chat.id} in session {session_id}")
                async with AsyncSessionLocal() as db:
                    # Improved Name Resolution
                    chat_name = message.chat.title
                    if not chat_name:
                        chat_name = f"{message.chat.first_name or ''} {message.chat.last_name or ''}".strip()
                    if not chat_name:
                        chat_name = message.chat.username or "Unknown"
                    
                    chat_username = message.chat.username
                    
                    sender_name = "Unknown"
                    sender_username = None
                    if message.from_user:
                        sender_name = f"{message.from_user.first_name or ''} {message.from_user.last_name or ''}".strip() or "Unknown"
                        sender_username = message.from_user.username
                    elif message.sender_chat:
                        sender_name = message.sender_chat.title or "Unknown Group/Channel"
                        sender_username = message.sender_chat.username
                    
                    media_type = None
                    if message.photo: media_type = 'photo'
                    elif message.video: media_type = 'video'
                    elif message.document: media_type = 'document'
                    elif message.sticker: media_type = 'sticker'
                    elif message.voice: media_type = 'voice'
                    elif message.audio: media_type = 'audio'
                    elif message.video_note: media_type = 'video_note'

                    content = message.text or message.caption or ""
                    if not content and media_type: content = f"[{media_type.upper()}]"
                    timestamp = datetime.now(timezone.utc).replace(tzinfo=None)

                    new_log = MessageLog(
                        telegram_message_id=message.id, chat_id=str(message.chat.id), chat_name=chat_name, chat_username=chat_username,
                        sender_id=str(message.from_user.id) if message.from_user else str(message.sender_chat.id) if message.sender_chat else None,
                        sender_name=sender_name, sender_username=sender_username,
                        content=content, media_type=media_type, timestamp=timestamp, session_id=session_id
                    )
                    db.add(new_log); await db.commit(); await db.refresh(new_log)
                    if broadcast_callback: await broadcast_callback(session_id, new_log)
            except Exception as e: print(f"[ERROR] handling message: {e}")

        if not getattr(client, "has_persistence_handler", False):
            client.add_handler(MessageHandler(persistence_handler), group=-1)
            setattr(client, "has_persistence_handler", True)
            print(f"[INFO] Handler registered for session {session_id}")
        if not client.is_connected: await client.start(); print(f"[INFO] Client {session_id} started")
        active_clients[session_id] = client
        return client
    
    @staticmethod
    async def stop_client(session_id: int):
        client = active_clients.get(session_id)
        if client:
            if client.is_connected: await client.stop()
            del active_clients[session_id]
    
    @staticmethod
    async def send_code(phone_number: str, api_id: str, api_hash: str, session_name: str) -> dict:
        try:
            workdir = "./sessions/temp"; os.makedirs(workdir, exist_ok=True)
            client = Client(name=f"temp_{session_name}", api_id=int(api_id), api_hash=api_hash, workdir=workdir, phone_number=phone_number)
            await client.connect(); sent_code = await client.send_code(phone_number)
            pending_auth[session_name] = {"client": client, "phone_code_hash": sent_code.phone_code_hash, "phone_number": phone_number}
            return {"success": True, "phone_code_hash": sent_code.phone_code_hash, "message": "OTP sent"}
        except Exception as e: return {"success": False, "error": str(e)}
    
    @staticmethod
    async def verify_code(session_name: str, code: str) -> dict:
        if session_name not in pending_auth: return {"success": False, "error": "Session not found"}
        try:
            auth = pending_auth[session_name]; client = auth["client"]
            await client.sign_in(auth["phone_number"], auth["phone_code_hash"], code)
            string = await client.export_session_string(); await client.disconnect(); del pending_auth[session_name]
            return {"success": True, "session_string": encrypt_session_string(string), "requires_2fa": False}
        except Exception as e:
            if "PASSWORD_REQUIRED" in str(e): return {"success": False, "requires_2fa": True, "message": "2FA required"}
            return {"success": False, "error": str(e)}
    
    @staticmethod
    async def verify_2fa(session_name: str, password: str) -> dict:
        if session_name not in pending_auth: return {"success": False, "error": "Session not found"}
        try:
            client = pending_auth[session_name]["client"]
            await client.check_password(password)
            string = await client.export_session_string(); await client.disconnect(); del pending_auth[session_name]
            return {"success": True, "session_string": encrypt_session_string(string)}
        except Exception as e: return {"success": False, "error": str(e)}

    @staticmethod
    async def get_dialogs(session_id: int, limit: int = 100) -> dict:
        client = active_clients.get(session_id)
        if not client: return {"error": "Client not active", "chats": []}
        try:
            chats = []
            async for d in client.get_dialogs(limit=limit):
                # Improved Name Resolution Logic
                name = d.chat.title
                if not name:
                    name = f"{d.chat.first_name or ''} {d.chat.last_name or ''}".strip()
                if not name:
                    name = d.chat.username or "Unknown"
                
                chats.append({
                    "id": str(d.chat.id),
                    "name": name,
                    "type": str(d.chat.type.name).lower(),
                    "username": d.chat.username,
                    "members_count": d.chat.members_count
                })
            return {"chats": chats, "success": True}
        except Exception as e: return {"error": str(e), "chats": []}

    @staticmethod
    async def get_profile_info(session_id: int, username_or_phone: str) -> dict:
        client = active_clients.get(session_id)
        if not client: return {"error": "Client not active"}
        try:
            user = await client.get_users(username_or_phone)
            try: common = len(await client.get_common_chats(user.id))
            except: common = 0
            return {"user_id": user.id, "username": user.username, "first_name": user.first_name, "last_name": user.last_name, "phone": user.phone_number, "bio": getattr(user, "bio", None), "dc_id": getattr(user, "dc_id", None), "common_chats_count": common}
        except Exception as e: return {"error": str(e)}

    @staticmethod
    async def get_group_info(session_id: int, group_link: str) -> dict:
        client = active_clients.get(session_id)
        if not client: return {"error": "Client not active"}
        try:
            chat = await client.get_chat(group_link)
            return {"chat_id": chat.id, "title": chat.title, "username": chat.username, "member_count": chat.members_count, "description": chat.description, "is_verified": chat.is_verified}
        except Exception as e: return {"error": str(e)}