import os
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user_payload
from app.models import Document
from app.schemas import DocumentResponse
from app.services.parsing import document_parser
from app.services.embedding import embedding_service
from app.core.vector_store import vector_store

router = APIRouter(prefix="/documents", tags=["Documents Management"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    visibility: str = Form("private"),  # 'private', 'community', or 'global'
    department: Optional[str] = Form(None),
    semester: Optional[int] = Form(None),
    subject: Optional[str] = Form(None),
    unit: Optional[str] = Form(None),
    topic: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    user_id = user_payload.get("id")
    user_role = user_payload.get("role")

    # Access validation for Visibility parameters
    if visibility == "global" and user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin accounts can publish global academic knowledge."
        )

    # Determine validation status
    # Student community uploads start in pending approval state
    approval_status = "approved"
    if user_role == "student" and visibility == "community":
        approval_status = "pending_approval"

    # Save file on disk
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "txt"
    file_uuid_name = f"{user_id}_{file.filename}"
    saved_file_path = os.path.join(UPLOAD_DIR, file_uuid_name)
    
    try:
        with open(saved_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed writing file output: {e}"
        )

    # Parse and chunk document content
    try:
        pages = document_parser.parse_file(saved_file_path, file_ext)
        page_count = len(pages)
        chunks = document_parser.chunk_document(pages)
    except Exception as e:
        # Cleanup file if parsing fails
        if os.path.exists(saved_file_path):
            os.remove(saved_file_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document parsing error: {e}"
        )

    # Write document tracking entry to relational database
    db_doc = Document(
        name=file.filename,
        owner_id=user_id,
        visibility=visibility,
        status=approval_status,
        department=department,
        semester=semester,
        subject=subject,
        unit=unit,
        topic=topic,
        file_path=saved_file_path,
        file_type=file_ext,
        page_count=page_count
    )
    
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    # If document is approved, index in Vector Database immediately
    # If student community note, vector indexing will trigger only upon Admin Approval
    if approval_status == "approved":
        try:
            chunk_payloads = []
            chunk_texts = []
            
            for chunk in chunks:
                chunk_payloads.append({
                    "doc_id": db_doc.id,
                    "owner_id": user_id,
                    "visibility": visibility,
                    "status": approval_status,
                    "name": db_doc.name,
                    "text": chunk["text"],
                    "page_number": chunk["page_number"],
                    "department": department,
                    "semester": semester,
                    "subject": subject,
                    "unit": unit,
                    "topic": topic
                })
                chunk_texts.append(chunk["text"])

            if chunk_texts:
                vectors = embedding_service.get_embeddings(chunk_texts)
                vector_store.add_chunks(chunk_payloads, vectors)
        except Exception as e:
            # We fail gracefully but print warning
            print(f"Warning: Failed to upload vectors to Qdrant for document {db_doc.id}: {e}")

    return db_doc


@router.get("", response_model=List[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Lists documents that are visible to the currently authenticated user.
    """
    user_id = user_payload.get("id")
    user_role = user_payload.get("role")

    if user_role == "admin":
        return db.query(Document).all()

    # Students see:
    # 1. Global documents
    # 2. Approved community documents
    # 3. Their own personal uploads (private or community)
    visible_docs = db.query(Document).filter(
        (Document.visibility == "global") |
        ((Document.visibility == "community") & (Document.status == "approved")) |
        (Document.owner_id == user_id)
    ).all()
    
    return visible_docs


@router.delete("/{doc_id}", status_code=status.HTTP_200_OK)
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Permanently deletes a document, its local file, and Qdrant vector index chunks.
    """
    user_id = user_payload.get("id")
    user_role = user_payload.get("role")

    db_doc = db.query(Document).filter(Document.id == doc_id).first()
    if not db_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requested document does not exist."
        )

    # Permission check: admin or owner
    if user_role != "admin" and db_doc.owner_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this file."
        )

    # 1. Delete vector index chunks from Qdrant
    try:
        vector_store.delete_document_chunks(doc_id)
    except Exception as e:
        print(f"Warning: Failed deleting Qdrant points for doc {doc_id}: {e}")

    # 2. Delete file from local uploads storage
    if db_doc.file_path and os.path.exists(db_doc.file_path):
        try:
            os.remove(db_doc.file_path)
        except Exception as e:
            print(f"Warning: Failed deleting file from filesystem: {e}")

    # 3. Delete database record
    db.delete(db_doc)
    db.commit()

    return {"detail": "Document successfully deleted."}


@router.get("/{doc_id}/download")
def download_document(
    doc_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Downloads/returns the file content for viewing.
    """
    from fastapi.responses import FileResponse
    from app.core.security import decode_access_token
    from app.models import User
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is required as a query parameter."
        )
    
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token."
        )
        
    user_id = payload.get("sub") or payload.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user identity."
        )

    user = db.query(User).filter(User.id == str(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    db_doc = db.query(Document).filter(Document.id == doc_id).first()
    if not db_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requested document does not exist."
        )

    # Permission check: admin or owner or approved community or global
    is_owner = db_doc.owner_id == user.id
    is_admin = user.role == "admin"
    is_global = db_doc.visibility == "global"
    is_approved_community = db_doc.visibility == "community" and db_doc.status == "approved"

    if not (is_admin or is_owner or is_global or is_approved_community):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this file."
        )

    if not db_doc.file_path or not os.path.exists(db_doc.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on server disk."
        )

    # Map file_type/extension to standard MIME types where possible
    media_types = {
        "pdf": "application/pdf",
        "txt": "text/plain",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg"
    }
    ext = db_doc.file_type.lower() if db_doc.file_type else ""
    mime_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=db_doc.file_path,
        filename=db_doc.name,
        media_type=mime_type
    )

