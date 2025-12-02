from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Enum, UniqueConstraint, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"

class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    BANNED = "banned"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    status = Column(Enum(UserStatus), default=UserStatus.ACTIVE, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    telegram_sessions = relationship("TelegramSession", back_populates="user", cascade="all, delete-orphan")
    study_sessions = relationship("StudySession", back_populates="user", cascade="all, delete-orphan")

class TelegramSession(Base):
    __tablename__ = "telegram_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_name = Column(String(100), nullable=False)
    session_string = Column(Text, nullable=False)
    phone_number = Column(String(20), nullable=False)
    api_id = Column(String(50), nullable=False)
    api_hash = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    user = relationship("User", back_populates="telegram_sessions")

class MessageLog(Base):
    __tablename__ = "message_logs"
    id = Column(Integer, primary_key=True, index=True)
    telegram_message_id = Column(Integer, nullable=False)
    chat_id = Column(String(100), nullable=False, index=True)
    chat_name = Column(String(255), nullable=True)
    chat_username = Column(String(255), nullable=True)
    sender_id = Column(String(100), nullable=True)
    sender_name = Column(String(255), nullable=True)
    sender_username = Column(String(255), nullable=True)
    content = Column(Text, nullable=True)
    media_type = Column(String(50), nullable=True)
    media_path = Column(String(500), nullable=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("telegram_sessions.id", ondelete="CASCADE"))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class DownloadTask(Base):
    __tablename__ = "download_tasks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(Integer, ForeignKey("telegram_sessions.id", ondelete="CASCADE"), nullable=False)
    chat_id = Column(String(100), nullable=False)
    chat_name = Column(String(255), nullable=True)
    task_id = Column(String(100), unique=True, nullable=False)
    status = Column(String(20), default="pending")
    total_files = Column(Integer, default=0)
    downloaded_files = Column(Integer, default=0)
    progress = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

class DownloadedFile(Base):
    __tablename__ = "downloaded_files"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("telegram_sessions.id", ondelete="CASCADE"), nullable=False)
    chat_id = Column(String(100), nullable=False, index=True)
    chat_name = Column(String(255), nullable=True)
    message_id = Column(Integer, nullable=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False, unique=True)
    file_type = Column(String(50), nullable=True)
    file_size = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class DumpTask(Base):
    __tablename__ = "dump_tasks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(Integer, ForeignKey("telegram_sessions.id", ondelete="CASCADE"), nullable=True)
    chat_id = Column(String(100), nullable=True)
    task_id = Column(String(100), unique=True, nullable=False)
    status = Column(String(20), default="pending")
    target_date = Column(DateTime, nullable=True)
    total_messages = Column(Integer, default=0)
    progress = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

class DumpedMessage(Base):
    __tablename__ = "dumped_messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("telegram_sessions.id", ondelete="CASCADE"), nullable=False)
    chat_id = Column(String(100), nullable=False, index=True)
    chat_name = Column(String(255), nullable=True)
    telegram_message_id = Column(Integer, nullable=False)
    sender_id = Column(String(100), nullable=True)
    sender_name = Column(String(255), nullable=True)
    sender_username = Column(String(255), nullable=True)
    content = Column(Text, nullable=True)
    media_type = Column(String(50), nullable=True)
    message_date = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    __table_args__ = (UniqueConstraint('session_id', 'chat_id', 'telegram_message_id', name='_unique_msg_uc'),)

# --- ACADEMY MODELS ---

class JapaneseCharacter(Base):
    __tablename__ = "japanese_characters"
    id = Column(Integer, primary_key=True, index=True)
    character = Column(String(10), nullable=False, index=True)
    romaji = Column(String(10), nullable=False)
    type = Column(String(20), nullable=False) # 'hiragana' or 'katakana'
    group_name = Column(String(20), nullable=True)

class StudySession(Base):
    __tablename__ = "study_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subject = Column(String(50), default="japanese")
    mode = Column(String(50)) # 'quiz', 'flashcard'
    quiz_type = Column(String(50), nullable=True) # 'character', 'sentence'
    score = Column(Integer, default=0)
    total_questions = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="study_sessions")
    details = relationship("StudyDetail", back_populates="session", cascade="all, delete-orphan")

class StudyDetail(Base):
    __tablename__ = "study_details"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("study_sessions.id", ondelete="CASCADE"), nullable=False)
    question_content = Column(Text) # Cho phép dài hơn cho câu
    user_answer = Column(Text)
    correct_answer = Column(Text)
    is_correct = Column(Boolean, default=False)
    
    session = relationship("StudySession", back_populates="details")