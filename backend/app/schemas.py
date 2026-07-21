from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional
from datetime import datetime

# Auth Schemas
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: Optional[str] = "student"  # 'student' or 'admin'

class UserLogin(BaseModel):
    username_or_email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str

# Document Schemas
class DocumentResponse(BaseModel):
    id: int
    name: str
    owner_id: int
    visibility: str
    status: str
    department: Optional[str] = None
    semester: Optional[int] = None
    subject: Optional[str] = None
    unit: Optional[str] = None
    topic: Optional[str] = None
    file_type: Optional[str] = None
    page_count: int
    created_at: datetime
    uploader_username: Optional[str] = None
    uploader_role: Optional[str] = None

    class Config:
        from_attributes = True

# Chat Schemas
class ChatQuery(BaseModel):
    query: str
    session_id: str
    department: Optional[str] = None
    semester: Optional[int] = None
    subject: Optional[str] = None
    unit: Optional[str] = None
    topic: Optional[str] = None

class Citation(BaseModel):
    source_index: int
    document_name: str
    page: Any
    visibility: str
    subject: Optional[str] = None
    unit: Optional[str] = None
    topic: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    decision: str
    citations: List[Citation]
    grounding_score: float

# Study Tools Schemas
class QuizRequest(BaseModel):
    topic: str
    document_id: Optional[int] = None

class VivaRequest(BaseModel):
    topic: str
    document_id: Optional[int] = None

class RevisionRequest(BaseModel):
    topic: str
    document_id: Optional[int] = None

class PlannerRequest(BaseModel):
    topic: str
    document_id: Optional[int] = None

class PYQRequest(BaseModel):
    topic: str
    document_id: Optional[int] = None

# Bookmark Schema
class BookmarkCreate(BaseModel):
    query: str
    answer: str
    citations: Optional[List[Dict[str, Any]]] = None

class BookmarkResponse(BaseModel):
    id: int
    user_id: int
    query: str
    answer: str
    citations: Optional[List[Dict[str, Any]]] = None
    created_at: datetime

    class Config:
        from_attributes = True
        
# Admin Schemas
class DocumentApproval(BaseModel):
    document_id: int
    action: str  # 'approve' or 'reject'
