import datetime
import uuid
import time
import random
from typing import Optional
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON, Boolean
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

def generate_numeric_id():
    return str(int(time.time() * 1000) + random.randint(0, 999))

class User(Base):
    __tablename__ = "users"

    id = Column(String(100), primary_key=True, index=True, default=generate_numeric_id)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(100), nullable=True)  # Managed by Supabase

    role = Column(String(20), default="student", nullable=False)  # 'admin' or 'student'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")
    bookmarks = relationship("Bookmark", back_populates="user", cascade="all, delete-orphan")
    chat_histories = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="user", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    owner_id = Column(String(100), ForeignKey("users.id"), nullable=False)
    visibility = Column(String(20), default="private", nullable=False)  # 'private', 'community', 'global'
    status = Column(String(20), default="approved", nullable=False)      # 'pending_approval', 'approved', 'rejected'
    
    # Hierarchical Organization
    department = Column(String(100), nullable=True)
    semester = Column(Integer, nullable=True)
    subject = Column(String(100), nullable=True)
    unit = Column(String(100), nullable=True)
    topic = Column(String(100), nullable=True)

    file_path = Column(String(512), nullable=True)
    file_type = Column(String(50), nullable=True)  # 'pdf', 'pptx', 'docx', 'txt', etc.
    page_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="documents")

    @property
    def uploader_username(self) -> Optional[str]:
        return self.owner.username if self.owner else None

    @property
    def uploader_role(self) -> Optional[str]:
        return self.owner.role if self.owner else None


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), ForeignKey("users.id"), nullable=False)
    query = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    citations = Column(JSON, nullable=True)  # List of dicts representing page/doc sources
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="bookmarks")


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), ForeignKey("users.id"), nullable=False)
    session_id = Column(String(100), index=True, nullable=False)
    role = Column(String(20), nullable=False)  # 'user', 'assistant'
    content = Column(Text, nullable=False)
    citations = Column(JSON, nullable=True)
    intent = Column(String(50), nullable=True)      # 'factual', 'reasoning', etc.
    decision = Column(String(50), nullable=True)    # 'retrieval_only', 'llm_reasoning'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="chat_histories")


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    questions = Column(JSON, nullable=False)  # List of structured questions
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="quizzes")
