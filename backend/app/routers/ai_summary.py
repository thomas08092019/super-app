from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timedelta
from app.database import get_db
from app.models import User, AISummaryLog
from app.schemas import SummaryRequest, SummaryResponse
from app.dependencies import get_current_user
from app.config import settings
from app.telegram_service import TelegramManager
from app.routers.telegram import ensure_client_active
import google.generativeai as genai
import numpy as np

router = APIRouter(prefix="/ai", tags=["AI Summary"])

if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

def cosine_similarity(v1, v2):
    if np.linalg.norm(v1) == 0 or np.linalg.norm(v2) == 0:
        return 0
    return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))

@router.post("/summarize", response_model=SummaryResponse)
async def summarize_messages(
    request: SummaryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")
    
    client = await ensure_client_active(request.session_id, db)
    if not client:
        raise HTTPException(status_code=400, detail="Telegram session not active or invalid")

    start_dt = request.start_time.replace(tzinfo=None) if request.start_time else datetime.utcnow() - timedelta(days=1)
    end_dt = request.end_time.replace(tzinfo=None) if request.end_time else datetime.utcnow()
    
    message_lines = await TelegramManager.get_history_for_summary(
        request.session_id, request.chat_ids, start_dt, end_dt, limit=500
    )
    
    if not message_lines:
        return SummaryResponse(summary="No messages found in this period.", message_count=0, time_range={})

    selected_lines = message_lines
    
    if len(message_lines) > 100:
        try:
            embed_model = 'models/text-embedding-004'
            
            docs_subset = message_lines[:500]
            
            embeddings = genai.embed_content(
                model=embed_model,
                content=docs_subset,
                task_type="retrieval_document"
            )
            
            query_text = "Important updates, decisions, errors, announcements, key discussion points, action items"
            query_embedding = genai.embed_content(
                model=embed_model,
                content=query_text,
                task_type="retrieval_query"
            )
            
            q_vec = np.array(query_embedding['embedding'])
            doc_vecs = np.array(embeddings['embedding'])
            
            scores = []
            for i, vec in enumerate(doc_vecs):
                score = cosine_similarity(q_vec, np.array(vec))
                scores.append((score, i))
            
            scores.sort(key=lambda x: x[0], reverse=True)
            
            top_n = max(50, int(len(docs_subset) * 0.6)) 
            top_indices = [idx for score, idx in scores[:top_n]]
            
            top_indices.sort()
            selected_lines = [docs_subset[i] for i in top_indices]
            
        except Exception as e:
            print(f"Vector embedding failed, using simple truncation: {e}")
            selected_lines = message_lines[-300:]
            
    context = "\n".join(selected_lines)

    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        prompt = f"""Summarize these Telegram messages. 
        Focus on: Key discussions, Decisions, and Action items.
        Format nicely with Markdown (Bullet points, bold text).
        
        Data:
        {context}"""
        
        response = model.generate_content(prompt)
        summary_text = response.text
        
        log = AISummaryLog(
            user_id=current_user.id,
            session_id=request.session_id,
            chat_names="Multiple/Selected",
            summary_content=summary_text,
            message_count=len(message_lines),
            start_time=start_dt,
            end_time=end_dt
        )
        db.add(log)
        await db.commit()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini Error: {str(e)}")
    
    return SummaryResponse(
        summary=summary_text,
        message_count=len(message_lines),
        time_range={"start": start_dt, "end": end_dt}
    )

@router.get("/history")
async def get_summary_history(
    page: int = 1, 
    limit: int = 10,
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    query = select(AISummaryLog).where(AISummaryLog.user_id == current_user.id).order_by(desc(AISummaryLog.created_at)).offset((page-1)*limit).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()