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
import shutil
import json
import re

celery_app = Celery("superapp", broker=settings.REDIS_URL, backend=settings.REDIS_URL)
celery_app.conf.update(task_serializer="json", accept_content=["json"], result_serializer="json", timezone="UTC", enable_utc=True)

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
        row = await conn.fetchrow('SELECT session_string, api_id, api_hash FROM telegram_sessions WHERE id = $1', session_id)
        if row: return decrypt_session_string(row['session_string']), row['api_id'], row['api_hash']
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

async def save_dumped_message(session_id, chat_id, chat_name, msg):
    conn = None
    try:
        conn = await get_db_connection()
        media_type = None
        if msg.photo: media_type = 'photo'
        elif msg.video: media_type = 'video'
        elif msg.document: media_type = 'document'
        
        content = msg.text or msg.caption or ""
        sender_id = str(msg.from_user.id) if msg.from_user else str(msg.sender_chat.id) if msg.sender_chat else None
        sender_name = f"{msg.from_user.first_name} {msg.from_user.last_name or ''}" if msg.from_user else msg.sender_chat.title if msg.sender_chat else "Unknown"
        sender_username = msg.from_user.username if msg.from_user else msg.sender_chat.username if msg.sender_chat else None
        
        await conn.execute('''
            INSERT INTO dumped_messages (session_id, chat_id, chat_name, telegram_message_id, sender_id, sender_name, sender_username, content, media_type, message_date, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (session_id, chat_id, telegram_message_id) DO NOTHING
        ''', session_id, str(chat_id), chat_name, msg.id, sender_id, sender_name.strip(), sender_username, content, media_type, msg.date, datetime.utcnow())
    except Exception as e:
        print(f"Error saving dump msg: {e}")
    finally:
        if conn:
            await conn.close()

async def update_dump_task_status(task_db_id, status, progress=0, error=None, total=0):
    if not task_db_id: return
    conn = None
    try:
        conn = await get_db_connection()
        await conn.execute('''
            UPDATE dump_tasks 
            SET status=$1, progress=$2, error_message=$3, total_messages=$4
            WHERE id=$5
        ''', status, progress, error, total, task_db_id)
    except Exception as e:
        print(f"Error updating task status: {e}")
    finally:
        if conn:
            await conn.close()

def is_archive(filename: str) -> bool:
    if not filename: return False
    ext = filename.split('.')[-1].lower() if '.' in filename else ''
    return ext in ['zip', 'rar', '7z', 'tar', 'gz', 'iso', 'dmg']

def sanitize_filename(name):
    return re.sub(r'[<>:"/\\|?*]', '_', name).strip()

def parse_ts(ts):
    if not ts: return None
    if isinstance(ts, datetime): return ts
    try:
        return datetime.fromisoformat(str(ts).replace('Z', '+00:00'))
    except:
        return None

async def process_download(self, session_id: int, chat_ids: list, media_types: list, start_time=None, end_time=None, limit=None, save_locally=False):
    session_string, api_id, api_hash = await get_session_string_safe(session_id)
    if not session_string: return {'status': 'failed', 'error': 'Session not found'}
    
    try:
        if limit: limit = int(limit)
    except: limit = None

    start_dt = parse_ts(start_time)
    end_dt = parse_ts(end_time)
    
    workdir = f"./sessions/worker_{session_id}"
    os.makedirs(workdir, exist_ok=True)
    client = Client(name=f"worker_downloader_{session_id}", api_id=int(api_id), api_hash=api_hash, session_string=session_string, workdir=workdir, no_updates=True)
    downloaded_files = []
    
    try:
        await client.start()
        
        target_chats = []
        if not chat_ids or not chat_ids[0]:
             async for d in client.get_dialogs(): target_chats.append(d.chat.id)
        else:
             for cid in chat_ids:
                try:
                    target_chats.append(int(cid) if str(cid).lstrip('-').isdigit() else cid)
                except: target_chats.append(cid)

        temp_dir = "/app/media/temp_downloads"
        os.makedirs(temp_dir, exist_ok=True)
        export_dir = "/app/exports"
        if save_locally: os.makedirs(export_dir, exist_ok=True)
        
        total_downloaded = 0

        for idx, target_chat in enumerate(target_chats):
            try:
                chat_info = await client.get_chat(target_chat)
                chat_title = chat_info.title or f"{chat_info.first_name} {chat_info.last_name or ''}".strip()
                chat_username = chat_info.username
                self.update_state(state='PROGRESS', meta={'status': f'Processing {chat_title} ({idx+1}/{len(target_chats)})', 'progress': 0})

                target_messages = []
                async for message in client.get_chat_history(target_chat):
                    if end_dt and message.date > end_dt: continue
                    if start_dt and message.date < start_dt: break 
                    is_match = False
                    if 'photo' in media_types and message.photo: is_match = True
                    elif 'video' in media_types and (message.video or message.video_note): is_match = True
                    elif 'audio' in media_types and (message.audio or message.voice): is_match = True
                    elif message.document:
                        fname = message.document.file_name or ""
                        is_arc = is_archive(fname)
                        if 'archive' in media_types and is_arc: is_match = True
                        elif 'document' in media_types and not is_arc: is_match = True
                    if is_match:
                        target_messages.append(message)
                        if limit and len(target_messages) >= limit: break
                
                folder_name = chat_username if chat_username else sanitize_filename(chat_title)
                folder_name = f"{session_id}_{folder_name}"

                for i, message in enumerate(target_messages):
                    try:
                        fname = "unknown"; ftype="other"; mime="application/octet-stream"
                        if message.photo: fname=f"photo_{message.id}.jpg"; mime="image/jpeg"; ftype="image"
                        elif message.video: fname=message.video.file_name or f"video_{message.id}.mp4"; mime=message.video.mime_type or "video/mp4"; ftype="video"
                        elif message.video_note: fname=f"videonote_{message.id}.mp4"; mime="video/mp4"; ftype="video"
                        elif message.audio: fname=message.audio.file_name or f"audio_{message.id}.mp3"; mime=message.audio.mime_type or "audio/mpeg"; ftype="audio"
                        elif message.voice: fname=f"voice_{message.id}.ogg"; mime=message.voice.mime_type or "audio/ogg"; ftype="audio"
                        elif message.document:
                            fname=message.document.file_name or f"doc_{message.id}"; mime=message.document.mime_type or "application/octet-stream"
                            if is_archive(fname): ftype="archive"
                            else: ftype="document"
                        
                        local_path = await client.download_media(message, file_name=os.path.join(temp_dir, fname))
                        if local_path:
                            size = os.path.getsize(local_path)
                            obj_name = f"{session_id}/{folder_name}/{os.path.basename(local_path)}"
                            await run_in_thread(StorageManager.upload_file, local_path, obj_name, mime)
                            await save_file_metadata(session_id, str(target_chat), chat_title, message.id, os.path.basename(local_path), obj_name, ftype, size)
                            total_downloaded += 1
                            if save_locally:
                                try:
                                    chat_export_dir = os.path.join(export_dir, folder_name)
                                    os.makedirs(chat_export_dir, exist_ok=True)
                                    shutil.copy2(local_path, os.path.join(chat_export_dir, os.path.basename(local_path)))
                                except: pass
                            os.remove(local_path)
                            self.update_state(state='PROGRESS', meta={'status': f'Downloaded {fname}...', 'progress': int(idx/len(target_chats)*100)})
                    except Exception: continue
            except Exception as e: 
                print(f"Error processing chat {target_chat}: {e}")
                continue
            
        return {'status': 'completed', 'total_files': total_downloaded, 'message': f'Downloaded {total_downloaded} files from {len(target_chats)} chats'}
    except Exception as e:
        return {'status': 'failed', 'error': str(e)}
    finally:
        if client.is_connected:
            await client.stop()

async def process_dump(self, session_id: int, chat_ids: list, start_time=None, end_time=None, task_db_id=None):
    session_string, api_id, api_hash = await get_session_string_safe(session_id)
    if not session_string:
        if task_db_id: await update_dump_task_status(task_db_id, 'failed', error='Session not found')
        return {'status': 'failed', 'error': 'Session not found'}
    
    start_dt = parse_ts(start_time)
    end_dt = parse_ts(end_time)

    workdir = f"./sessions/worker_dump_{session_id}"
    os.makedirs(workdir, exist_ok=True)
    client = Client(name=f"worker_dumper_{session_id}", api_id=int(api_id), api_hash=api_hash, session_string=session_string, workdir=workdir, no_updates=True)
    
    count = 0
    if task_db_id: await update_dump_task_status(task_db_id, 'running')
    
    try:
        await client.start()
        self.update_state(state='PROGRESS', meta={'status': 'Resolving targets...', 'progress': 0})
        
        target_chats = []
        if not chat_ids or not chat_ids[0]:
             async for d in client.get_dialogs(): target_chats.append(d.chat)
        else:
             for cid in chat_ids:
                 try: 
                     val = int(cid) if str(cid).lstrip('-').isdigit() else cid
                     chat = await client.get_chat(val)
                     target_chats.append(chat)
                 except Exception as e: 
                     print(f"Resolve fail {cid}: {e}")

        export_dir = "/app/exports/dumps"
        os.makedirs(export_dir, exist_ok=True)

        for idx, chat in enumerate(target_chats):
            chat_title = chat.title or f"{chat.first_name or ''} {chat.last_name or ''}".strip()
            safe_title = sanitize_filename(chat_title)
            chat_username = chat.username
            folder_name = chat_username if chat_username else safe_title
            json_file_path = os.path.join(export_dir, f"{session_id}_{folder_name}_dump.jsonl")
            
            self.update_state(state='PROGRESS', meta={'status': f'Dumping {chat_title} ({idx+1}/{len(target_chats)})...', 'progress': int(idx/len(target_chats)*100)})
            
            with open(json_file_path, 'a', encoding='utf-8') as f:
                async for msg in client.get_chat_history(chat.id):
                    if end_dt and msg.date > end_dt: continue
                    if start_dt and msg.date < start_dt: break
                    
                    await save_dumped_message(session_id, str(chat.id), chat_title, msg)
                    
                    content = msg.text or msg.caption or ""
                    dump_obj = {"id": msg.id, "date": msg.date.isoformat(), "sender": msg.from_user.id if msg.from_user else None, "content": content}
                    f.write(json.dumps(dump_obj) + "\n")
                    
                    count += 1
                    if count % 100 == 0:
                        if task_db_id: await update_dump_task_status(task_db_id, 'running', progress=int(idx/len(target_chats)*100), total=count)
        
        if task_db_id: await update_dump_task_status(task_db_id, 'completed', progress=100, total=count)
        return {'status': 'completed', 'total_messages': count, 'message': f'Dumped {count} messages from {len(target_chats)} chats.'}
    except Exception as e:
        if task_db_id: await update_dump_task_status(task_db_id, 'failed', error=str(e))
        return {'status': 'failed', 'error': str(e)}
    finally:
        if client.is_connected:
            await client.stop()

async def process_broadcast(self, session_id: int, message: str, target_chat_ids: list, delay_min: int, delay_max: int):
    session_string, api_id, api_hash = await get_session_string_safe(session_id)
    if not session_string: return {'status': 'failed', 'error': 'Session not found'}
    workdir = f"./sessions/worker_broadcast_{session_id}"
    os.makedirs(workdir, exist_ok=True)
    client = Client(name=f"worker_broadcaster_{session_id}", api_id=int(api_id), api_hash=api_hash, session_string=session_string, workdir=workdir, no_updates=True)
    try:
        await client.start()
        total = len(target_chat_ids); sent = 0; failed = 0
        for idx, chat_id in enumerate(target_chat_ids):
            try:
                target = chat_id
                if isinstance(chat_id, str) and (chat_id.startswith('-') or chat_id.isdigit()):
                    try: target = int(chat_id)
                    except: pass
                await client.send_message(target, message)
                sent += 1
            except Exception as e: 
                print(f"Broadcast fail: {e}"); failed += 1
            self.update_state(state='PROGRESS', meta={'current': idx+1, 'total': total, 'sent': sent, 'failed': failed, 'progress': int((idx+1)/total*100), 'status': f'Sending to {chat_id}...'})
            if idx < total - 1: await asyncio.sleep(random.uniform(delay_min, delay_max))
        return {'status': 'completed', 'sent': sent, 'failed': failed, 'message': f'Broadcast Finished. Sent: {sent}, Failed: {failed}'}
    except Exception as e: return {'status': 'failed', 'error': str(e)}
    finally:
        if client.is_connected:
            await client.stop()

@celery_app.task(bind=True)
def download_media_task(self, session_id: int, chat_ids: list, media_types: list, start_time=None, end_time=None, limit=None, save_locally=False):
    return asyncio.run(process_download(self, session_id, chat_ids, media_types, start_time, end_time, limit, save_locally))

@celery_app.task(bind=True)
def broadcast_message_task(self, session_id: int, message: str, target_chat_ids: list, delay_min: int = 2, delay_max: int = 5):
    return asyncio.run(process_broadcast(self, session_id, message, target_chat_ids, delay_min, delay_max))

@celery_app.task(bind=True)
def dump_messages_task(self, session_id: int, chat_ids: list, start_time=None, end_time=None, task_db_id=None, is_auto=False):
    return asyncio.run(process_dump(self, session_id, chat_ids, start_time, end_time, task_db_id))