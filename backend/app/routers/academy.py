from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List
import random
from app.database import get_db, AsyncSessionLocal
from app.models import User, JapaneseCharacter, StudySession, StudyDetail
from app.schemas import JapaneseCharacterResponse, QuizQuestion, QuizSubmission, AcademyStatsResponse
from app.dependencies import get_current_user
from app.academy_data import HIRAGANA_DATA, KATAKANA_DATA

router = APIRouter(prefix="/academy", tags=["Academy"])

async def seed_japanese_characters(db: AsyncSession):
    """Checks if data exists, if not, seeds it."""
    result = await db.execute(select(func.count()).select_from(JapaneseCharacter))
    count = result.scalar()
    
    if count == 0:
        print("🌱 Seeding Japanese Characters...")
        chars_to_add = []
        for item in HIRAGANA_DATA:
            chars_to_add.append(JapaneseCharacter(character=item["character"], romaji=item["romaji"], type="hiragana", group_name=item["group_name"]))
        for item in KATAKANA_DATA:
            chars_to_add.append(JapaneseCharacter(character=item["character"], romaji=item["romaji"], type="katakana", group_name=item["group_name"]))
        
        db.add_all(chars_to_add)
        await db.commit()
        print(f"✅ Added {len(chars_to_add)} characters.")
    else:
        print(f"ℹ️ Japanese characters already seeded ({count}).")

@router.post("/setup-data")
async def trigger_seeding(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Admin endpoint to force seed data"""
    await seed_japanese_characters(db)
    return {"message": "Seeding process completed."}

@router.get("/japanese/characters", response_model=List[JapaneseCharacterResponse])
async def get_characters(
    char_type: str = "hiragana", 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of characters for learning mode"""
    query = select(JapaneseCharacter).where(JapaneseCharacter.type == char_type)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/japanese/quiz", response_model=List[QuizQuestion])
async def generate_quiz(
    limit: int = 10,
    char_type: str = "hiragana",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate random quiz questions"""
    # 1. Get all characters of requested type
    query = select(JapaneseCharacter).where(JapaneseCharacter.type == char_type)
    result = await db.execute(query)
    all_chars = result.scalars().all()

    if len(all_chars) < 4:
        raise HTTPException(status_code=400, detail="Not enough data to generate quiz")

    # 2. Select random targets
    selected_chars = random.sample(all_chars, min(limit, len(all_chars)))
    
    quiz_data = []
    for correct_char in selected_chars:
        # 3. Select 3 distractors (wrong answers)
        distractors = random.sample([c.romaji for c in all_chars if c.id != correct_char.id], 3)
        options = distractors + [correct_char.romaji]
        random.shuffle(options)
        
        quiz_data.append({
            "char_id": correct_char.id,
            "question_char": correct_char.character,
            "options": options,
            "correct_answer": correct_char.romaji
        })
    
    return quiz_data

@router.post("/japanese/submit")
async def submit_quiz_result(
    submission: QuizSubmission,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit quiz results and save history"""
    total_q = len(submission.details)
    score = sum(1 for d in submission.details if d.is_correct)
    
    # 1. Create session record
    session = StudySession(
        user_id=current_user.id,
        subject="japanese",
        mode="quiz",
        score=score,
        total_questions=total_q
    )
    db.add(session)
    await db.flush() # Get ID
    
    # 2. Save details
    for detail in submission.details:
        db_detail = StudyDetail(
            session_id=session.id,
            question_content=detail.question_content,
            user_answer=detail.user_answer,
            is_correct=detail.is_correct,
            correct_answer="HIDDEN" 
        )
        db.add(db_detail)
        
    await db.commit()
    return {"message": "Saved", "score": score, "total": total_q}

@router.get("/dashboard/stats", response_model=AcademyStatsResponse)
async def get_learning_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get statistics for dashboard"""
    
    # 1. Total sessions
    total_sessions_query = select(func.count(StudySession.id)).where(StudySession.user_id == current_user.id)
    total_sessions = (await db.execute(total_sessions_query)).scalar() or 0
    
    # 2. Total questions & Score
    stats_query = select(
        func.sum(StudySession.total_questions),
        func.sum(StudySession.score)
    ).where(StudySession.user_id == current_user.id)
    
    result = (await db.execute(stats_query)).one()
    total_questions = result[0] or 0
    total_score = result[1] or 0
    
    accuracy = (total_score / total_questions * 100) if total_questions > 0 else 0.0
    
    # 3. Recent history
    history_query = select(StudySession).where(
        StudySession.user_id == current_user.id
    ).order_by(desc(StudySession.created_at)).limit(5)
    
    history_rows = (await db.execute(history_query)).scalars().all()
    recent_history = [
        {
            "date": s.created_at.isoformat(),
            "score": f"{s.score}/{s.total_questions}",
            "mode": s.mode
        } for s in history_rows
    ]
    
    return {
        "total_sessions": total_sessions,
        "total_questions_answered": total_questions,
        "average_accuracy": round(accuracy, 2),
        "recent_history": recent_history
    }