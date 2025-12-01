from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, delete
from typing import List, Optional
import random
from app.database import get_db, AsyncSessionLocal
from app.models import User, JapaneseCharacter, StudySession, StudyDetail
from app.schemas import JapaneseCharacterResponse, QuizQuestion, QuizSubmission, AcademyStatsResponse, MistakeDetail
from app.dependencies import get_current_user
from app.academy_data import HIRAGANA_DATA, KATAKANA_DATA, JAPANESE_SENTENCES

router = APIRouter(prefix="/academy", tags=["Academy"])

async def seed_japanese_characters(db: AsyncSession):
    """Checks if data exists, if not, seeds it. If data is incomplete (old version), reseeds."""
    result = await db.execute(select(func.count()).select_from(JapaneseCharacter))
    count = result.scalar()
    
    # 92 là số lượng ký tự cơ bản (46 Hiragana + 46 Katakana)
    # Tổng số ký tự đầy đủ khoảng hơn 200.
    # Nếu count < 100 có nghĩa là đang dùng bộ dữ liệu cũ, cần update lại.
    if count < 100:
        print("🌱 Seeding/Updating Japanese Characters...")
        
        # Xóa dữ liệu cũ để tránh trùng lặp hoặc thiếu sót
        if count > 0:
            print(f"⚠️  Found old data ({count} chars), clearing to update...")
            await db.execute(delete(JapaneseCharacter))
            await db.commit()

        chars_to_add = []
        for item in HIRAGANA_DATA:
            chars_to_add.append(JapaneseCharacter(character=item["character"], romaji=item["romaji"], type="hiragana", group_name=item["group_name"]))
        for item in KATAKANA_DATA:
            chars_to_add.append(JapaneseCharacter(character=item["character"], romaji=item["romaji"], type="katakana", group_name=item["group_name"]))
        
        db.add_all(chars_to_add)
        await db.commit()
        print(f"✅ Added {len(chars_to_add)} characters (Full Set).")
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
    query = select(JapaneseCharacter).where(JapaneseCharacter.type == char_type)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/japanese/quiz/character", response_model=List[QuizQuestion])
async def generate_character_quiz(
    alphabets: List[str] = Query(default=["hiragana"]), # hiragana, katakana
    mode: str = "jp_to_ro", # jp_to_ro (あ -> a), ro_to_jp (a -> あ)
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Fetch Characters
    query = select(JapaneseCharacter).where(JapaneseCharacter.type.in_(alphabets))
    result = await db.execute(query)
    all_chars = result.scalars().all()

    if len(all_chars) < 4:
        raise HTTPException(status_code=400, detail="Not enough data")

    # 2. Select Targets
    if limit > 0 and limit < len(all_chars):
        selected_chars = random.sample(all_chars, limit)
    else:
        selected_chars = list(all_chars)
        random.shuffle(selected_chars)
    
    quiz_data = []
    for target in selected_chars:
        # Determine Question & Answer based on mode
        if mode == "jp_to_ro":
            question_text = target.character
            correct_answer = target.romaji
            # Options are Romaji
            distractor_pool = [c.romaji for c in all_chars if c.romaji != correct_answer]
        else: # ro_to_jp
            question_text = target.romaji
            correct_answer = target.character
            # Options are Characters
            distractor_pool = [c.character for c in all_chars if c.character != correct_answer]

        distractors = random.sample(distractor_pool, 3)
        options = distractors + [correct_answer]
        random.shuffle(options)
        
        quiz_data.append({
            "id": target.id,
            "question_text": question_text,
            "options": options,
            "correct_answer": correct_answer,
            "type": "character"
        })
    
    return quiz_data

@router.get("/japanese/quiz/sentence", response_model=List[QuizQuestion])
async def generate_sentence_quiz(
    limit: int = 20,
    mode: str = "jp_to_ro", # jp_to_ro (Show JP, select Romaji), ro_to_jp (Show Romaji, select JP)
    current_user: User = Depends(get_current_user)
):
    all_sentences = JAPANESE_SENTENCES
    if len(all_sentences) < 4:
         raise HTTPException(status_code=400, detail="Not enough sentence data")

    if limit > 0 and limit < len(all_sentences):
        selected = random.sample(all_sentences, limit)
    else:
        selected = list(all_sentences)
        random.shuffle(selected)
        
    quiz_data = []
    for s in selected:
        if mode == "jp_to_ro":
            question_text = s["jp"]
            question_subtext = None # No hint if reading JP
            correct_answer = s["romaji"]
            # Distractors: Random other romaji
            distractor_pool = [x["romaji"] for x in all_sentences if x["romaji"] != correct_answer]
        else: # ro_to_jp
            question_text = s["romaji"]
            question_subtext = s["vi"] # Show VI hint for Romaji
            correct_answer = s["jp"]
            # Distractors: Random other JP
            distractor_pool = [x["jp"] for x in all_sentences if x["jp"] != correct_answer]
            
        distractors = random.sample(distractor_pool, min(3, len(distractor_pool)))
        options = distractors + [correct_answer]
        random.shuffle(options)
        
        quiz_data.append({
            "question_text": question_text,
            "question_subtext": question_subtext,
            "options": options,
            "correct_answer": correct_answer,
            "type": "sentence"
        })
        
    return quiz_data

@router.post("/japanese/submit")
async def submit_quiz_result(
    submission: QuizSubmission,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    total_q = len(submission.details)
    score = sum(1 for d in submission.details if d.is_correct)
    
    session = StudySession(
        user_id=current_user.id,
        subject="japanese",
        mode="quiz",
        quiz_type=submission.quiz_type,
        score=score,
        total_questions=total_q
    )
    db.add(session)
    await db.flush() 
    
    for detail in submission.details:
        db_detail = StudyDetail(
            session_id=session.id,
            question_content=detail.question_content,
            user_answer=detail.user_answer,
            correct_answer=detail.correct_answer,
            is_correct=detail.is_correct
        )
        db.add(db_detail)
        
    await db.commit()
    return {"message": "Saved", "score": score, "total": total_q}

@router.get("/dashboard/stats", response_model=AcademyStatsResponse)
async def get_learning_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    total_sessions = (await db.execute(select(func.count(StudySession.id)).where(StudySession.user_id == current_user.id))).scalar() or 0
    
    stats_query = select(func.sum(StudySession.total_questions), func.sum(StudySession.score)).where(StudySession.user_id == current_user.id)
    result = (await db.execute(stats_query)).one()
    total_questions = result[0] or 0
    total_score = result[1] or 0
    accuracy = (total_score / total_questions * 100) if total_questions > 0 else 0.0
    
    history_query = select(StudySession).where(StudySession.user_id == current_user.id).order_by(desc(StudySession.created_at)).limit(10)
    history_rows = (await db.execute(history_query)).scalars().all()
    
    recent_history = [{
        "id": s.id, # ADD ID FOR CLICKING
        "date": s.created_at.isoformat(),
        "score": f"{s.score}/{s.total_questions}",
        "mode": f"{s.mode} ({s.quiz_type or 'N/A'})"
    } for s in history_rows]
    
    return {
        "total_sessions": total_sessions,
        "total_questions_answered": total_questions,
        "average_accuracy": round(accuracy, 2),
        "recent_history": recent_history
    }

@router.get("/history/{session_id}", response_model=List[MistakeDetail])
async def get_session_history(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify owner
    session = await db.scalar(select(StudySession).where(StudySession.id == session_id, StudySession.user_id == current_user.id))
    if not session: raise HTTPException(404, "Session not found")
    
    details = await db.scalars(select(StudyDetail).where(StudyDetail.session_id == session_id))
    
    return [{
        "question": d.question_content,
        "user_answer": d.user_answer,
        "correct_answer": d.correct_answer,
        "is_correct": d.is_correct
    } for d in details]