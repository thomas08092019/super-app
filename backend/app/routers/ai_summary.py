from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timedelta
from app.database import get_db
from app.models import User, MessageLog
from app.schemas import SummaryRequest, SummaryResponse
from app.dependencies import get_current_user
from app.config import settings
import google.generativeai as genai

router = APIRouter(prefix="/ai", tags=["AI Summary"])
if settings.GEMINI_API_KEY: genai.configure(api_key=settings.GEMINI_API_KEY)

@router.post("/summarize", response_model=SummaryResponse)
async def summarize_messages(request: SummaryRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not settings.GEMINI_API_KEY: raise HTTPException(503, "Gemini key not configured")
    query = select(MessageLog).where(MessageLog.session_id == request.session_id)
    if request.chat_id: query = query.where(MessageLog.chat_id == request.chat_id)
    
    # Force Naive UTC for DB comparison
    if request.start_time: query = query.where(MessageLog.timestamp >= request.start_time.replace(tzinfo=None))
    else: query = query.where(MessageLog.timestamp >= datetime.utcnow() - timedelta(days=1))
    
    if request.end_time: query = query.where(MessageLog.timestamp <= request.end_time.replace(tzinfo=None))
    
    messages = (await db.execute(query.order_by(MessageLog.timestamp.asc()))).scalars().all()
    if not messages: return SummaryResponse(summary="No messages found.", message_count=0, time_range={"start": request.start_time, "end": request.end_time})
    
    context = "\n".join([f"[{m.timestamp}] {m.sender_name}: {m.content}" for m in messages[:100]])
    try:
        response = genai.GenerativeModel('gemini-pro').generate_content(f"Summarize:\n{context}")
        summary = response.text
    except Exception as e: raise HTTPException(500, f"Gemini Error: {e}")
    
    return SummaryResponse(summary=summary, message_count=len(messages), time_range={"start": request.start_time, "end": request.end_time})