from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.database import init_db, AsyncSessionLocal
from app.routers import auth, admin, telegram, ai_summary, downloader, broadcaster, storage, dumper
from app.models import TelegramSession, DumpTask
from app.celery_worker import dump_messages_task
from sqlalchemy import select, and_
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

async def auto_dump_job():
    print("[SCHEDULER] Checking for missing dumps...")
    async with AsyncSessionLocal() as db:
        sessions = (await db.execute(select(TelegramSession).where(TelegramSession.is_active == True))).scalars().all()
        
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = datetime.utcnow().replace(hour=23, minute=59, second=59, microsecond=999999)

        for s in sessions:
            query = select(DumpTask).where(
                and_(
                    DumpTask.session_id == s.id,
                    DumpTask.status == 'completed',
                    DumpTask.target_date >= today_start,
                    DumpTask.target_date <= today_end
                )
            )
            existing_task = (await db.execute(query)).scalar_one_or_none()
            
            if not existing_task:
                print(f"[SCHEDULER] No dump found for today for session {s.session_name}. Starting auto-dump...")
                dump_messages_task.apply_async(args=[s.id, None, today_start.isoformat(), today_end.isoformat()], kwargs={'is_auto': True})
            else:
                print(f"[SCHEDULER] Dump for today already exists for {s.session_name}. Skipping.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Starting Super App Backend...")
    await init_db()
    scheduler.add_job(auto_dump_job, 'cron', hour=0, minute=1)
    scheduler.start()
    yield
    print("👋 Shutting down...")

app = FastAPI(title="Super App API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(telegram.router)
app.include_router(ai_summary.router)
app.include_router(downloader.router)
app.include_router(broadcaster.router)
app.include_router(storage.router)
app.include_router(dumper.router)

@app.get("/")
async def root(): return {"status": "running"}
@app.get("/health")
async def health(): return {"status": "healthy"}