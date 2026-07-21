import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_admin_user
from app.models import Document, User
from app.schemas import DocumentResponse, DocumentApproval
from app.services.parsing import document_parser
from app.services.embedding import embedding_service
from app.core.vector_store import vector_store
from app.services.storage import storage_service

router = APIRouter(prefix="/admin", tags=["Admin Portal Functions"])


@router.get("/queue", response_model=list[DocumentResponse])
def get_approval_queue(
    db: Session = Depends(get_db),
    admin: dict = Depends(get_admin_user)
):
    """
    Returns student community documents awaiting approval.
    """
    queue_items = db.query(Document).filter(
        Document.visibility == "community",
        Document.status == "pending_approval"
    ).all()
    return queue_items


@router.post("/approve", response_model=DocumentResponse)
def approve_or_reject_document(
    payload: DocumentApproval,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_admin_user)
):
    """
    Approves or rejects a pending community document.
    Upon approval, triggers text parsing, embedding generation, and Qdrant vector indexing.
    """
    doc_id = payload.document_id
    action = payload.action.lower()

    db_doc = db.query(Document).filter(Document.id == doc_id).first()
    if not db_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )

    if db_doc.status != "pending_approval":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is not in pending approval state."
        )

    if action == "approve":
        db_doc.status = "approved"
        db.commit()
        db.refresh(db_doc)

        # Triggers text parsing & vector DB indexing
        try:
            pages = document_parser.parse_file(db_doc.file_path, db_doc.file_type)
            chunks = document_parser.chunk_document(pages)
            
            chunk_payloads = []
            chunk_texts = []
            
            for chunk in chunks:
                chunk_payloads.append({
                    "doc_id": db_doc.id,
                    "owner_id": db_doc.owner_id,
                    "visibility": "community",
                    "status": "approved",
                    "name": db_doc.name,
                    "text": chunk["text"],
                    "page_number": chunk["page_number"],
                    "department": db_doc.department,
                    "semester": db_doc.semester,
                    "subject": db_doc.subject,
                    "unit": db_doc.unit,
                    "topic": db_doc.topic
                })
                chunk_texts.append(chunk["text"])

            if chunk_texts:
                vectors = embedding_service.get_embeddings(chunk_texts)
                vector_store.add_chunks(chunk_payloads, vectors)
        except Exception as e:
            # Revert approved status if processing fails catastrophically
            db_doc.status = "pending_approval"
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Approval pipeline failed during indexing: {e}"
            )
            
    elif action == "reject":
        db_doc.status = "rejected"
        db.commit()
        db.refresh(db_doc)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid action. Use 'approve' or 'reject'."
        )

    return db_doc


@router.get("/analytics")
def get_system_analytics(
    db: Session = Depends(get_db),
    admin: dict = Depends(get_admin_user)
):
    """
    Returns global assistant stats and metadata for dashboard widgets.
    """
    user_count = db.query(User).count()
    student_count = db.query(User).filter(User.role == "student").count()
    
    total_docs = db.query(Document).count()
    official_docs = db.query(Document).filter(Document.visibility == "global").count()
    private_docs = db.query(Document).filter(Document.visibility == "private").count()
    community_approved = db.query(Document).filter(
        Document.visibility == "community",
        Document.status == "approved"
    ).count()
    pending_queue = db.query(Document).filter(
        Document.visibility == "community",
        Document.status == "pending_approval"
    ).count()

    # Query Qdrant collection stats
    vector_count = 0
    try:
        collection_info = vector_store.client.get_collection(vector_store.collection_name)
        vector_count = collection_info.points_count
    except Exception:
        pass

    return {
        "users": {
            "total": user_count,
            "students": student_count,
            "admins": user_count - student_count
        },
        "documents": {
            "total": total_docs,
            "official": official_docs,
            "private": private_docs,
            "community_approved": community_approved,
            "pending_approval": pending_queue
        },
        "vector_chunks": vector_count
    }


@router.get("/students")
def get_students_list(
    db: Session = Depends(get_db),
    admin: dict = Depends(get_admin_user)
):
    """
    Returns list of all students for user management.
    """
    students = db.query(User).filter(User.role == "student").all()
    return [
        {
            "id": s.id,
            "username": s.username,
            "email": s.email,
            "created_at": s.created_at
        } for s in students
    ]


@router.delete("/students/{user_id}", status_code=status.HTTP_200_OK)
async def delete_student_account(
    user_id: str,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_admin_user)
):
    """
    Deletes a student account and all of their uploaded documents/data.
    """
    user = db.query(User).filter(User.id == user_id, User.role == "student").first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student account not found."
        )

    # 1. Clean up student's uploaded documents (files and Qdrant vector chunks)
    user_docs = db.query(Document).filter(Document.owner_id == user_id).all()
    for doc in user_docs:
        # Delete Qdrant vector embeddings
        try:
            vector_store.delete_document_chunks(doc.id)
        except Exception as e:
            print(f"Warning: Failed to delete Qdrant chunks for doc {doc.id} when deleting user: {e}")
            
        # Delete storage files (local or Supabase)
        if doc.file_path:
            if doc.file_path.startswith("http://") or doc.file_path.startswith("https://"):
                try:
                    await storage_service.delete_file(doc.file_path)
                except Exception as e:
                    print(f"Warning: Failed deleting file from Supabase: {e}")
            elif os.path.exists(doc.file_path):
                try:
                    os.remove(doc.file_path)
                except Exception as e:
                    print(f"Warning: Failed deleting file from filesystem: {e}")
        
        # Delete document record
        db.delete(doc)

    # 2. Delete the user (cascades bookmarks, chat_history, quizzes, flashcards, study_plans)
    db.delete(user)
    db.commit()
    
    return {"detail": f"Student account {user_id} and all associated files/vectors deleted successfully."}
