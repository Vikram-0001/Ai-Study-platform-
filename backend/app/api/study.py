from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user_payload
from app.models import Quiz
from app.schemas import QuizRequest, VivaRequest
from app.agents.retrieval_agent import retrieval_agent
from app.agents.quiz_agent import quiz_agent
from app.agents.viva_agent import viva_agent

router = APIRouter(prefix="/study", tags=["Study Assets & Generators"])

def _get_context_for_generation(query: str, doc_id: Optional[int], user_payload: dict) -> list:
    """
    Helper to fetch context chunks for generators. If a specific doc_id is provided,
    restricts search to that file; otherwise, runs semantic search across allowed files.
    """
    filters = None
    if doc_id:
        filters = {"doc_id": doc_id}
        
    return retrieval_agent.retrieve_context(
        query=query,
        user_id=user_payload.get("id"),
        role=user_payload.get("role"),
        limit=5,
        filters=filters
    )


# --- GENERATOR ROUTERS ---

@router.post("/quiz/generate")
def generate_assessment_quiz(
    payload: QuizRequest,
    user_payload: dict = Depends(get_current_user_payload)
):
    context = _get_context_for_generation(payload.topic, payload.document_id, user_payload)
    return quiz_agent.generate_quiz(payload.topic, context)


@router.post("/viva/generate")
def generate_viva_cards(
    payload: VivaRequest,
    user_payload: dict = Depends(get_current_user_payload)
):
    context = _get_context_for_generation(payload.topic, payload.document_id, user_payload)
    return viva_agent.generate_viva(payload.topic, context)




# --- PERSISTENCE STORE FOR GENERATED ITEMS ---

# Quizzes
@router.post("/quizzes", status_code=status.HTTP_201_CREATED)
def save_quiz(
    payload: dict,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    user_id = user_payload.get("id")
    quiz = Quiz(
        user_id=user_id,
        title=payload.get("title", "Saved Quiz"),
        questions=payload.get("questions", [])
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz

@router.get("/quizzes")
def list_saved_quizzes(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    user_id = user_payload.get("id")
    return db.query(Quiz).filter(Quiz.user_id == user_id).all()

