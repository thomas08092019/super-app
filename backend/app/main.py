"""
FastAPI main application
Entry point for the Super App backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.database import init_db
from app.routers import auth, admin, telegram, ai_summary, downloader, broadcaster


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan events
    """
    # Startup
    print("🚀 Starting Super App Backend...")
    await init_db()
    print("✅ Database initialized")
    yield
    # Shutdown
    print("👋 Shutting down Super App Backend...")


# Create FastAPI application
app = FastAPI(
    title="My Super App API",
    description="Personal Telegram OSINT & Automation Center",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(telegram.router)
app.include_router(ai_summary.router)
app.include_router(downloader.router)
app.include_router(broadcaster.router)


@app.get("/")
async def root():
    """
    Root endpoint
    """
    return {
        "name": "My Super App API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    return {
        "status": "healthy",
        "service": "superapp-backend"
    }

