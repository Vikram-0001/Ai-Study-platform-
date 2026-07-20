from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user_payload
from app.models import ChatHistory, Bookmark
from app.schemas import ChatQuery, ChatResponse, BookmarkCreate, BookmarkResponse
from app.agents.orchestrator import orchestrator

router = APIRouter(prefix="/chat", tags=["AI Chat & History"])


@router.post("/query", response_model=ChatResponse)
async def query_assistant(
    payload: ChatQuery,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    user_id = user_payload.get("id")
    user_role = user_payload.get("role")

    # Extract filter options
    search_filters = {}
    if payload.department:
        search_filters["department"] = payload.department
    if payload.semester:
        search_filters["semester"] = payload.semester
    if payload.subject:
        search_filters["subject"] = payload.subject
    if payload.unit:
        search_filters["unit"] = payload.unit
    if payload.topic:
        search_filters["topic"] = payload.topic

    # Execute orchestrator pipeline
    result = await orchestrator.execute_query(
        query=payload.query,
        user_id=user_id,
        role=user_role,
        filters=search_filters if search_filters else None
    )

    # Save to Chat History Table
    user_chat = ChatHistory(
        user_id=user_id,
        session_id=payload.session_id,
        role="user",
        content=payload.query,
        intent=result.get("decision"),
        decision=result.get("decision")
    )
    assistant_chat = ChatHistory(
        user_id=user_id,
        session_id=payload.session_id,
        role="assistant",
        content=result.get("answer"),
        citations=result.get("citations"),
        intent=result.get("decision"),
        decision=result.get("decision")
    )
    
    db.add(user_chat)
    db.add(assistant_chat)
    db.commit()

    return result


@router.get("/sessions", response_model=List[str])
def get_user_chat_sessions(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Returns a unique list of session IDs for the user.
    """
    user_id = user_payload.get("id")
    
    sessions = db.query(ChatHistory.session_id).filter(
        ChatHistory.user_id == user_id
    ).distinct().all()
    
    return [s[0] for s in sessions]


@router.get("/history/{session_id}")
def get_chat_history(
    session_id: str,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Retrieves full transcript messages for a specific session ID.
    """
    user_id = user_payload.get("id")
    
    chats = db.query(ChatHistory).filter(
        ChatHistory.user_id == user_id,
        ChatHistory.session_id == session_id
    ).order_by(ChatHistory.created_at.asc()).all()
    
    return [
        {
            "id": c.id,
            "role": c.role,
            "content": c.content,
            "decision": c.decision,
            "citations": c.citations or [],
            "created_at": c.created_at
        } for c in chats
    ]


# --- BOOKMARKS MANAGEMENT ---

@router.post("/bookmarks", response_model=BookmarkResponse, status_code=status.HTTP_201_CREATED)
def create_bookmark(
    payload: BookmarkCreate,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    user_id = user_payload.get("id")

    bookmark = Bookmark(
        user_id=user_id,
        query=payload.query,
        answer=payload.answer,
        citations=payload.citations
    )
    db.add(bookmark)
    db.commit()
    db.refresh(bookmark)
    return bookmark


@router.get("/bookmarks", response_model=List[BookmarkResponse])
def list_bookmarks(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    user_id = user_payload.get("id")
    return db.query(Bookmark).filter(Bookmark.user_id == user_id).all()


@router.delete("/bookmarks/{bookmark_id}", status_code=status.HTTP_200_OK)
def delete_bookmark(
    bookmark_id: int,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    user_id = user_payload.get("id")
    
    bookmark = db.query(Bookmark).filter(
        Bookmark.id == bookmark_id,
        Bookmark.user_id == user_id
    ).first()
    
    if not bookmark:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bookmark not found or unauthorized access."
        )

    db.delete(bookmark)
    db.commit()
    return {"detail": "Bookmark successfully deleted."}
