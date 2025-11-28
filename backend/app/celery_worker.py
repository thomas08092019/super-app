from celery import Celery
from app.config import settings
from app.storage_service import StorageManager
from app.auth import decrypt_session_string
from pyrogram import Client
from datetime import datetime
import asyncio
import os
import random
import mimetypes
import asyncpg

# Create Celery app
celery_app = Celery(
    "superapp",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

async def run_in_thread(func, *args, **kwargs):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, lambda: func(*args, **kwargs))

async def get_db_connection():
    dsn = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    return await asyncpg.connect(dsn)

async def get_session_string_safe(session_id: int):
    conn = None
    try:
        conn = await get_db_connection()
        row = await conn.fetchrow(
            'SELECT session_string, api_id, api_hash FROM telegram_sessions WHERE id = $1',
            session_id
        )
        if row:
            return decrypt_session_string(row['session_string']), row['api_id'], row['api_hash']
        return None, None, None
    except Exception as e:
        print(f"DB Error in Worker: {e}")
        return None, None, None
    finally:
        if conn:
            await conn.close()

async def save_file_metadata(session_id, chat_id, chat_name, message_id, file_name, file_path, file_type, file_size):
    conn = None
    try:
        conn = await get_db_connection()
        await conn.execute('''
            INSERT INTO downloaded_files (session_id, chat_id, chat_name, message_id, file_name, file_path, file_type, file_size, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (file_path) DO NOTHING
        ''', session_id, str(chat_id), chat_name, message_id, file_name, file_path, file_type, file_size, datetime.utcnow())
    except Exception as e:
        print(f"Error saving metadata: {e}")
    finally:
        if conn:
            await conn.close()

def is_archive(filename: str) -> bool:
    if not filename: return False
    ext = filename.split('.')[-1].lower() if '.' in filename else ''
    return ext in ['zip', 'rar', '7z', 'tar', 'gz', 'iso', 'dmg']

async def process_download(self, session_id: int, chat_id: str, media_types: list, start_time=None, end_time=None, limit=None):
    session_string, api_id, api_hash = await get_session_string_safe(session_id)
    
    if not session_string:
        return {'status': 'failed', 'error': 'Session not found'}

    try:
        target_chat = int(chat_id)
    except ValueError:
        target_chat = chat_id

    start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00')) if start_time else None
    end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00')) if end_time else None

    workdir = f"./sessions/worker_{session_id}"
    os.makedirs(workdir, exist_ok=True)
    
    client = Client(
        name=f"worker_downloader_{session_id}",
        api_id=int(api_id),
        api_hash=api_hash,
        session_string=session_string,
        workdir=workdir,
        no_updates=True
    )

    downloaded_files = []
    
    try:
        await client.start()
        
        chat_title = "Unknown Chat"
        try:
            me = await client.get_me()
            self.update_state(state='PROGRESS', meta={'status': f'Connected as {me.first_name}... Verifying chat...', 'progress': 0})
            
            chat_info = await client.get_chat(target_chat)
            chat_title = chat_info.title or f"{chat_info.first_name} {chat_info.last_name or ''}".strip()
            self.update_state(state='PROGRESS', meta={'status': f'Found chat: {chat_title}. Scanning history...', 'progress': 5})
        except Exception as e:
            return {'status': 'failed', 'error': f'Cannot access chat {target_chat}: {str(e)}'}

        target_messages = []
        scanned_count = 0
        
        async for message in client.get_chat_history(target_chat):
            scanned_count += 1
            if scanned_count % 50 == 0:
                self.update_state(state='PROGRESS', meta={'status': f'Scanned {scanned_count} messages... Found {len(target_messages)} matches.', 'progress': 10})

            if end_dt and message.date > end_dt:
                continue
            if start_dt and message.date < start_dt:
                break 
            
            is_match = False
            
            # 1. Photo
            if 'photo' in media_types and message.photo: 
                is_match = True
            
            # 2. Video
            elif 'video' in media_types and (message.video or message.video_note): 
                is_match = True
            
            # 3. Audio / Voice
            elif 'audio' in media_types and (message.audio or message.voice): 
                is_match = True
            
            # 4. Document / Archive logic
            elif message.document:
                file_name = message.document.file_name or ""
                is_file_archive = is_archive(file_name)
                
                if 'archive' in media_types and is_file_archive:
                    is_match = True
                elif 'document' in media_types and not is_file_archive:
                    # If 'document' is selected, we include non-archive documents (pdf, txt, etc.)
                    # If user wants EVERYTHING, they should select both 'document' and 'archive'
                    is_match = True
                # If both are selected, it matches either way
            
            if is_match:
                target_messages.append(message)
                if limit and len(target_messages) >= limit:
                    break
        
        total_files = len(target_messages)
        
        if total_files == 0:
            return {
                'status': 'completed', 
                'total_files': 0, 
                'message': f'Scan finished. Scanned {scanned_count} messages but found NO matching media.'
            }

        temp_dir = "/app/media/temp_downloads"
        os.makedirs(temp_dir, exist_ok=True)

        for i, message in enumerate(target_messages):
            try:
                file_name = "unknown"
                mime_type = "application/octet-stream"
                file_type_simple = "other"
                
                if message.photo:
                    file_name = f"photo_{message.id}.jpg"
                    mime_type = "image/jpeg"
                    file_type_simple = "image"
                elif message.video:
                    file_name = message.video.file_name or f"video_{message.id}.mp4"
                    mime_type = message.video.mime_type or "video/mp4"
                    file_type_simple = "video"
                elif message.video_note:
                    file_name = f"videonote_{message.id}.mp4"
                    mime_type = "video/mp4"
                    file_type_simple = "video"
                elif message.audio:
                    file_name = message.audio.file_name or f"audio_{message.id}.mp3"
                    mime_type = message.audio.mime_type or "audio/mpeg"
                    file_type_simple = "audio"
                elif message.voice:
                    file_name = f"voice_{message.id}.ogg"
                    mime_type = message.voice.mime_type or "audio/ogg"
                    file_type_simple = "audio"
                elif message.document:
                    file_name = message.document.file_name or f"doc_{message.id}"
                    mime_type = message.document.mime_type or "application/octet-stream"
                    if is_archive(file_name):
                        file_type_simple = "archive"
                    else:
                        file_type_simple = "document"

                self.update_state(
                    state='PROGRESS',
                    meta={
                        'current': i + 1,
                        'total': total_files,
                        'progress': int(((i) / total_files) * 100),
                        'status': f'Downloading {file_name} ({i+1}/{total_files})...'
                    }
                )

                local_path = await client.download_media(message, file_name=os.path.join(temp_dir, file_name))
                
                if local_path:
                    self.update_state(state='PROGRESS', meta={'status': f'Uploading {file_name}...', 'progress': int(((i) / total_files) * 100)})
                    
                    file_size = os.path.getsize(local_path)
                    object_name = f"{session_id}/{chat_id}/{os.path.basename(local_path)}"
                    
                    await run_in_thread(StorageManager.upload_file, local_path, object_name, mime_type)
                    
                    await save_file_metadata(
                        session_id, chat_id, chat_title, message.id, 
                        os.path.basename(local_path), object_name, file_type_simple, file_size
                    )
                    
                    downloaded_files.append(object_name)
                    os.remove(local_path)

            except Exception as e:
                print(f"Error processing message {message.id}: {e}")
                continue

        return {
            'status': 'completed',
            'total_files': total_files,
            'uploaded_files': downloaded_files,
            'message': f'Done! Scanned {scanned_count} msgs. Downloaded {len(downloaded_files)} files.'
        }

    except Exception as e:
        return {'status': 'failed', 'error': str(e)}
    finally:
        if client.is_connected:
            await client.stop()

@celery_app.task(bind=True)
def download_media_task(self, session_id: int, chat_id: str, media_types: list, start_time=None, end_time=None, limit=None):
    return asyncio.run(process_download(self, session_id, chat_id, media_types, start_time, end_time, limit))

async def process_broadcast(self, session_id: int, message: str, target_chat_ids: list, delay_min: int, delay_max: int):
    session_string, api_id, api_hash = await get_session_string_safe(session_id)
    if not session_string: return {'status': 'failed', 'error': 'Session not found'}

    workdir = f"./sessions/worker_broadcast_{session_id}"
    os.makedirs(workdir, exist_ok=True)
    
    client = Client(name=f"worker_broadcaster_{session_id}", api_id=int(api_id), api_hash=api_hash, session_string=session_string, workdir=workdir, no_updates=True)
    
    try:
        await client.start()
        total = len(target_chat_ids)
        sent = 0
        failed = 0
        
        for idx, chat_id in enumerate(target_chat_ids):
            try:
                target = chat_id
                if isinstance(chat_id, str):
                    if chat_id.startswith('-') or chat_id.isdigit():
                        try: target = int(chat_id)
                        except: pass
                
                await client.send_message(target, message)
                sent += 1
                
            except Exception as e:
                print(f"[BROADCAST ERROR] Failed to send to {chat_id}: {e}")
                failed += 1
            
            self.update_state(state='PROGRESS', meta={
                'current': idx+1, 'total': total, 'sent': sent, 'failed': failed, 
                'progress': int((idx+1)/total*100), 
                'status': f'Sending to {chat_id}... (Success: {sent}, Fail: {failed})'
            })
            
            if idx < total - 1:
                await asyncio.sleep(random.uniform(delay_min, delay_max))
        
        return {
            'status': 'completed', 
            'sent': sent, 
            'failed': failed, 
            'message': f'Broadcast Finished. Sent: {sent}, Failed: {failed}'
        }
    except Exception as e:
        return {'status': 'failed', 'error': str(e)}
    finally:
        if client.is_connected: await client.stop()

@celery_app.task(bind=True)
def broadcast_message_task(self, session_id: int, message: str, target_chat_ids: list, delay_min: int = 2, delay_max: int = 5):
    return asyncio.run(process_broadcast(self, session_id, message, target_chat_ids, delay_min, delay_max))