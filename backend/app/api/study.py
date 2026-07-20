from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user_payload
from app.models import Quiz, Flashcard, StudyPlan
from app.schemas import QuizRequest, VivaRequest, RevisionRequest, PlannerRequest, PYQRequest
from app.agents.retrieval_agent import retrieval_agent
from app.agents.quiz_agent import quiz_agent
from app.agents.viva_agent import viva_agent
from app.agents.revision_agent import revision_agent
from app.agents.study_planner_agent import study_planner_agent
from app.agents.pyq_agent import pyq_agent

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


@router.post("/revision/generate")
def generate_revision_pack(
    payload: RevisionRequest,
    user_payload: dict = Depends(get_current_user_payload)
):
    context = _get_context_for_generation(payload.topic, payload.document_id, user_payload)
    return revision_agent.generate_revision_notes(payload.topic, context)


@router.post("/planner/generate")
def generate_study_roadmap(
    payload: PlannerRequest,
    user_payload: dict = Depends(get_current_user_payload)
):
    context = _get_context_for_generation(payload.topic, payload.document_id, user_payload)
    return study_planner_agent.create_study_plan(payload.topic, context)


@router.post("/pyq/analyze")
def analyze_previous_year_papers(
    payload: PYQRequest,
    user_payload: dict = Depends(get_current_user_payload)
):
    context = _get_context_for_generation(payload.topic, payload.document_id, user_payload)
    return pyq_agent.analyze_pyqs(payload.topic, context)


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


# Flashcards (Save Deck)
@router.post("/flashcards", status_code=status.HTTP_201_CREATED)
def save_flashcards_deck(
    payload: dict,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    user_id = user_payload.get("id")
    deck = Flashcard(
        user_id=user_id,
        deck_name=payload.get("deck_name", "Saved Deck"),
        cards=payload.get("cards", [])
    )
    db.add(deck)
    db.commit()
    db.refresh(deck)
    return deck

@router.get("/flashcards")
def list_saved_flashcards(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    user_id = user_payload.get("id")
    return db.query(Flashcard).filter(Flashcard.user_id == user_id).all()


# Study Plans
@router.post("/planner", status_code=status.HTTP_201_CREATED)
def save_study_plan(
    payload: dict,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    user_id = user_payload.get("id")
    plan = StudyPlan(
        user_id=user_id,
        topic=payload.get("topic", "Saved Roadmap"),
        plan_data=payload.get("plan_data", [])
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan

@router.get("/planner")
def list_saved_plans(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    user_id = user_payload.get("id")
    return db.query(StudyPlan).filter(StudyPlan.user_id == user_id).all()
