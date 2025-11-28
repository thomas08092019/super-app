"""
AI Summary router
Uses Google Gemini for message summarization
"""
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

# Configure Gemini
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)


@router.post("/summarize", response_model=SummaryResponse)
async def summarize_messages(
    request: SummaryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate AI summary of messages using Google Gemini
    """
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API key not configured"
        )
    
    # Build query
    query = select(MessageLog).where(MessageLog.session_id == request.session_id)
    
    # Filter by chat if specified
    if request.chat_id:
        query = query.where(MessageLog.chat_id == request.chat_id)
    
    # Filter by time range
    if request.start_time:
        query = query.where(MessageLog.timestamp >= request.start_time)
    else:
        # Default to last 24 hours
        query = query.where(MessageLog.timestamp >= datetime.utcnow() - timedelta(days=1))
    
    if request.end_time:
        query = query.where(MessageLog.timestamp <= request.end_time)
    
    query = query.order_by(MessageLog.timestamp.asc())
    
    # Fetch messages
    result = await db.execute(query)
    messages = result.scalars().all()
    
    if not messages:
        return SummaryResponse(
            summary="No messages found in the specified time range.",
            message_count=0,
            time_range={
                "start": request.start_time,
                "end": request.end_time
            }
        )
    
    # Prepare context for Gemini
    message_text = []
    for msg in messages:
        sender = msg.sender_name or msg.sender_id or "Unknown"
        chat = msg.chat_name or msg.chat_id
        content = msg.content or "[Media]"
        timestamp = msg.timestamp.strftime("%Y-%m-%d %H:%M")
        
        message_text.append(f"[{timestamp}] {sender} in {chat}: {content}")
    
    context = "\n".join(message_text[:100])  # Limit to 100 messages
    
    # Generate summary with Gemini
    try:
        model = genai.GenerativeModel('gemini-pro')
        prompt = f"""Analyze and summarize the following Telegram messages. 
Provide a comprehensive summary highlighting:
1. Main topics discussed
2. Important decisions or announcements
3. Key participants and their contributions
4. Any action items or follow-ups needed

Messages:
{context}

Provide a well-structured summary in markdown format."""
        
        response = model.generate_content(prompt)
        summary = response.text
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate summary: {str(e)}"
        )
    
    return SummaryResponse(
        summary=summary,
        message_count=len(messages),
        time_range={
            "start": request.start_time or (datetime.utcnow() - timedelta(days=1)),
            "end": request.end_time or datetime.utcnow()
        }
    )

