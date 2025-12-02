from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from app.models import UserRole, UserStatus

# ... (Các schema cũ giữ nguyên) ...
class UserResponse(BaseModel):
    id: int
    username: Optional[str]
    email: str
    role: UserRole
    status: UserStatus
    created_at: datetime
    class Config: from_attributes = True

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    username: Optional[str] = None
    email: EmailStr
    password: str = Field(..., min_length=6)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class UserUpdateStatus(BaseModel):
    status: UserStatus

class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=6)

class TelegramLoginRequest(BaseModel):
    session_name: str
    phone_number: str
    api_id: str
    api_hash: str

class TelegramOTPRequest(BaseModel):
    session_name: str
    code: str

class Telegram2FARequest(BaseModel):
    session_name: str
    password: str

class TelegramSessionResponse(BaseModel):
    id: int
    session_name: str
    phone_number: str
    is_active: bool
    created_at: datetime
    class Config: from_attributes = True

class MessageResponse(BaseModel):
    id: int
    telegram_message_id: int
    chat_id: str
    chat_name: Optional[str]
    chat_username: Optional[str]
    sender_id: Optional[str]
    sender_name: Optional[str]
    sender_username: Optional[str]
    content: Optional[str]
    media_type: Optional[str]
    media_path: Optional[str]
    timestamp: datetime
    class Config: from_attributes = True

class DownloadRequest(BaseModel):
    session_id: int
    chat_id: str
    chat_ids: List[str] = []
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    media_types: List[str] = ["photo", "video", "document"]
    limit: Optional[int] = None
    save_locally: bool = False

class DownloadTaskResponse(BaseModel):
    id: int
    task_id: str
    status: str
    chat_name: Optional[str]
    total_files: int
    downloaded_files: int
    progress: int
    created_at: datetime
    class Config: from_attributes = True

class ProfileLookupResponse(BaseModel):
    user_id: Optional[int]
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    phone: Optional[str]
    bio: Optional[str]
    dc_id: Optional[int]
    common_chats_count: int

class GroupLookupResponse(BaseModel):
    chat_id: int
    title: str
    username: Optional[str]
    member_count: int
    description: Optional[str]
    is_verified: bool

class BroadcastRequest(BaseModel):
    session_id: int
    message: str
    target_chat_ids: List[str]
    delay_min: int = Field(default=2, ge=1, le=10)
    delay_max: int = Field(default=5, ge=2, le=20)

class BroadcastResponse(BaseModel):
    task_id: str
    total_targets: int
    status: str

class DumpRequest(BaseModel):
    session_id: int
    chat_id: Optional[str] = None
    chat_ids: List[str] = []
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class DumpTaskResponse(BaseModel):
    id: int
    task_id: str
    status: str
    chat_name: str
    total_messages: int
    progress: int
    created_at: datetime
    class Config: from_attributes = True

# --- ACADEMY SCHEMAS ---

class JapaneseCharacterResponse(BaseModel):
    id: int
    character: str
    romaji: str
    type: str
    group_name: Optional[str]
    class Config: from_attributes = True

class QuizQuestion(BaseModel):
    id: Optional[int] = None # ID of character or just index
    question_text: str # Can be Character or Romaji
    question_subtext: Optional[str] = None # Vietnamese hint for Romaji
    options: List[str]
    correct_answer: str
    type: str = "character" # 'character' or 'sentence'

class QuizSubmissionDetail(BaseModel):
    question_content: str
    user_answer: str
    correct_answer: str # Add correct answer to submission to save history
    is_correct: bool

class QuizSubmission(BaseModel):
    quiz_type: str # 'character' or 'sentence'
    details: List[QuizSubmissionDetail]

class AcademyStatsResponse(BaseModel):
    total_sessions: int
    total_questions_answered: int
    average_accuracy: float
    recent_history: List[Dict[str, Any]]

class MistakeDetail(BaseModel):
    question: str
    user_answer: str
    correct_answer: str
    is_correct: bool