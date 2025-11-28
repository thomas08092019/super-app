from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.database import init_db
from app.routers import auth, admin, telegram, ai_summary, downloader, broadcaster, storage

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Starting Super App Backend...")
    await init_db()
    print("✅ Database initialized")
    yield
    print("👋 Shutting down Super App Backend...")

app = FastAPI(
    title="My Super App API",
    description="Personal Telegram OSINT & Automation Center",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(telegram.router)
app.include_router(ai_summary.router)
app.include_router(downloader.router)
app.include_router(broadcaster.router)
app.include_router(storage.router)

@app.get("/")
async def root():
    return {
        "name": "My Super App API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "superapp-backend"}