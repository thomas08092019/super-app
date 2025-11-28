"""
Telegram service using Pyrogram
Handles multi-account management and message streaming
"""
from pyrogram import Client, filters
from pyrogram.types import Message
from pyrogram.errors import FloodWait, SessionPasswordNeeded
from typing import Dict, Optional
import asyncio
import os
from app.auth import encrypt_session_string, decrypt_session_string

# Global storage for active Telegram clients
active_clients: Dict[int, Client] = {}

# Global storage for pending authentication sessions
pending_auth: Dict[str, Dict] = {}


class TelegramManager:
    """
    Telegram client manager for multi-account support
    """
    
    @staticmethod
    def get_client(session_id: int) -> Optional[Client]:
        """
        Get an active Telegram client by session ID
        """
        return active_clients.get(session_id)
    
    @staticmethod
    async def create_client(
        session_name: str,
        api_id: str,
        api_hash: str,
        phone_number: str,
        session_id: int
    ) -> Client:
        """
        Create a new Telegram client instance
        """
        workdir = f"./sessions/{session_id}"
        os.makedirs(workdir, exist_ok=True)
        
        client = Client(
            name=session_name,
            api_id=int(api_id),
            api_hash=api_hash,
            workdir=workdir,
            phone_number=phone_number
        )
        
        return client
    
    @staticmethod
    async def start_client(client: Client, session_id: int):
        """
        Start a Telegram client and store in active clients
        """
        await client.start()
        active_clients[session_id] = client
        return client
    
    @staticmethod
    async def stop_client(session_id: int):
        """
        Stop and remove a Telegram client
        """
        client = active_clients.get(session_id)
        if client:
            await client.stop()
            del active_clients[session_id]
    
    @staticmethod
    async def send_code(phone_number: str, api_id: str, api_hash: str, session_name: str) -> dict:
        """
        Send OTP code to phone number
        """
        try:
            # Ensure sessions directory exists
            workdir = "./sessions/temp"
            os.makedirs(workdir, exist_ok=True)
            
            client = Client(
                name=f"temp_{session_name}",
                api_id=int(api_id),
                api_hash=api_hash,
                workdir=workdir,
                phone_number=phone_number
            )
            
            await client.connect()
            sent_code = await client.send_code(phone_number)
            
            # Store session temporarily
            pending_auth[session_name] = {
                "client": client,
                "phone_code_hash": sent_code.phone_code_hash,
                "phone_number": phone_number
            }
            
            return {
                "success": True,
                "phone_code_hash": sent_code.phone_code_hash,
                "message": "OTP sent successfully"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    async def verify_code(session_name: str, code: str) -> dict:
        """
        Verify OTP code
        """
        if session_name not in pending_auth:
            return {
                "success": False,
                "error": "Session not found. Please request code again."
            }
        
        try:
            auth_data = pending_auth[session_name]
            client = auth_data["client"]
            phone_number = auth_data["phone_number"]
            phone_code_hash = auth_data["phone_code_hash"]
            
            # Sign in with code
            await client.sign_in(phone_number, phone_code_hash, code)
            
            # Get session string
            session_string = await client.export_session_string()
            
            await client.disconnect()
            del pending_auth[session_name]
            
            return {
                "success": True,
                "session_string": encrypt_session_string(session_string),
                "requires_2fa": False
            }
        except SessionPasswordNeeded:
            return {
                "success": False,
                "requires_2fa": True,
                "message": "2FA password required"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    async def verify_2fa(session_name: str, password: str) -> dict:
        """
        Verify 2FA password
        """
        if session_name not in pending_auth:
            return {
                "success": False,
                "error": "Session not found"
            }
        
        try:
            auth_data = pending_auth[session_name]
            client = auth_data["client"]
            
            # Check 2FA password
            await client.check_password(password)
            
            # Get session string
            session_string = await client.export_session_string()
            
            await client.disconnect()
            del pending_auth[session_name]
            
            return {
                "success": True,
                "session_string": encrypt_session_string(session_string)
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    async def get_profile_info(session_id: int, username_or_phone: str) -> dict:
        """
        Get user profile information (OSINT)
        """
        client = active_clients.get(session_id)
        if not client:
            return {"error": "Client not active"}
        
        try:
            user = await client.get_users(username_or_phone)
            common_chats = await client.get_common_chats(user.id)
            
            return {
                "user_id": user.id,
                "username": user.username,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "phone": user.phone_number,
                "bio": user.bio,
                "dc_id": user.dc_id,
                "common_chats_count": len(common_chats)
            }
        except Exception as e:
            return {"error": str(e)}
    
    @staticmethod
    async def get_group_info(session_id: int, group_link: str) -> dict:
        """
        Get group/channel information (OSINT)
        """
        client = active_clients.get(session_id)
        if not client:
            return {"error": "Client not active"}
        
        try:
            chat = await client.get_chat(group_link)
            
            return {
                "chat_id": chat.id,
                "title": chat.title,
                "username": chat.username,
                "member_count": chat.members_count,
                "description": chat.description,
                "is_verified": chat.is_verified
            }
        except Exception as e:
            return {"error": str(e)}
    
    @staticmethod
    async def get_dialogs(session_id: int, limit: int = 50) -> dict:
        """
        Get all chats/dialogs for a session
        """
        client = active_clients.get(session_id)
        if not client:
            return {"error": "Client not active", "chats": []}
        
        try:
            chats = []
            async for dialog in client.get_dialogs(limit=limit):
                chat = dialog.chat
                chat_type = "private"
                
                if chat.type.name == "SUPERGROUP":
                    chat_type = "group"
                elif chat.type.name == "CHANNEL":
                    chat_type = "channel"
                elif chat.type.name == "GROUP":
                    chat_type = "group"
                elif chat.type.name == "BOT":
                    chat_type = "bot"
                
                chats.append({
                    "id": str(chat.id),
                    "name": chat.title or f"{chat.first_name or ''} {chat.last_name or ''}".strip() or "Unknown",
                    "type": chat_type,
                    "username": chat.username if hasattr(chat, 'username') else None,
                    "members_count": chat.members_count if hasattr(chat, 'members_count') else None,
                })
            
            return {"chats": chats, "success": True}
        except Exception as e:
            return {"error": str(e), "chats": []}


# Message handler for live feed
@filters.create
def custom_filter(_, __, message: Message):
    """Custom filter to capture all messages"""
    return True


async def setup_message_handlers(client: Client, callback):
    """
    Setup message handlers for live feed
    """
    @client.on_message(custom_filter)
    async def message_handler(client, message: Message):
        await callback(message)

