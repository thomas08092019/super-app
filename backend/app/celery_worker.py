"""
Celery worker for background tasks
Handles media downloads and broadcasting
"""
from celery import Celery
from app.config import settings
import asyncio
from typing import List
import random

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


@celery_app.task(bind=True)
def download_media_task(self, session_id: int, chat_id: str, media_types: List[str], start_time=None, end_time=None):
    """
    Background task to download media from Telegram
    """
    # This is a simplified version - actual implementation would use Pyrogram
    try:
        total_files = 10  # Mock value
        
        for i in range(total_files):
            # Simulate download
            asyncio.sleep(1)
            
            # Update progress
            self.update_state(
                state='PROGRESS',
                meta={
                    'current': i + 1,
                    'total': total_files,
                    'progress': int((i + 1) / total_files * 100),
                    'status': f'Downloading file {i + 1} of {total_files}...'
                }
            )
        
        return {
            'status': 'completed',
            'total_files': total_files,
            'message': 'Download completed successfully'
        }
    
    except Exception as e:
        return {
            'status': 'failed',
            'error': str(e)
        }


@celery_app.task(bind=True)
def broadcast_message_task(
    self,
    session_id: int,
    message: str,
    target_chat_ids: List[str],
    delay_min: int = 2,
    delay_max: int = 5
):
    """
    Background task to broadcast messages to multiple chats
    Implements random delays to avoid flood bans
    """
    try:
        total_targets = len(target_chat_ids)
        sent_count = 0
        failed_count = 0
        
        for idx, chat_id in enumerate(target_chat_ids):
            try:
                # Simulate sending message
                # In real implementation, use Pyrogram client
                asyncio.sleep(1)
                
                sent_count += 1
                
                # Update progress
                self.update_state(
                    state='PROGRESS',
                    meta={
                        'current': idx + 1,
                        'total': total_targets,
                        'sent': sent_count,
                        'failed': failed_count,
                        'progress': int((idx + 1) / total_targets * 100),
                        'status': f'Sent to {sent_count} of {total_targets} targets...'
                    }
                )
                
                # Random delay to avoid flood wait
                if idx < total_targets - 1:
                    delay = random.uniform(delay_min, delay_max)
                    asyncio.sleep(delay)
                
            except Exception as e:
                failed_count += 1
                continue
        
        return {
            'status': 'completed',
            'sent': sent_count,
            'failed': failed_count,
            'total': total_targets,
            'message': f'Broadcast completed. Sent: {sent_count}, Failed: {failed_count}'
        }
    
    except Exception as e:
        return {
            'status': 'failed',
            'error': str(e)
        }

