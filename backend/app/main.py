from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.core.database import init_db
from app.api import auth, documents, chat, study, admin

app = FastAPI(
    title="AI Academic Study Assistant",
    description="RAG-First AI study platform for students and administrators.",
    version="1.0.0"
)

# CORS configuration to allow local/production frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Swap with ['http://localhost:3000'] in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def sync_approved_documents_to_qdrant():
    from app.core.database import SessionLocal
    from app.models import Document
    from app.core.vector_store import vector_store
    from app.services.parsing import document_parser
    from app.services.embedding import embedding_service
    from qdrant_client.http import models as qmodels
    
    db = SessionLocal()
    try:
        docs = db.query(Document).filter(Document.status == "approved").all()
        for doc in docs:
            # Check if doc exists in Qdrant
            res = vector_store.client.scroll(
                collection_name=vector_store.collection_name,
                scroll_filter=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="doc_id",
                            match=qmodels.MatchValue(value=doc.id)
                        )
                    ]
                ),
                limit=1,
                with_payload=False,
                with_vectors=False
            )[0]
            
            if res:
                continue
                
            print(f"Startup Sync: Re-indexing document {doc.id} ({doc.name}) to Qdrant...")
            try:
                pages = document_parser.parse_file(doc.file_path, doc.file_type)
                chunks = document_parser.chunk_document(pages)
                
                chunk_payloads = []
                chunk_texts = []
                for chunk in chunks:
                    chunk_payloads.append({
                        "doc_id": doc.id,
                        "owner_id": doc.owner_id,
                        "visibility": doc.visibility,
                        "status": doc.status,
                        "name": doc.name,
                        "text": chunk["text"],
                        "page_number": chunk["page_number"],
                        "department": doc.department,
                        "semester": doc.semester,
                        "subject": doc.subject,
                        "unit": doc.unit,
                        "topic": doc.topic
                    })
                    chunk_texts.append(chunk["text"])
                    
                if chunk_texts:
                    vectors = embedding_service.get_embeddings(chunk_texts)
                    vector_store.add_chunks(chunk_payloads, vectors)
                    print(f"Startup Sync: Successfully indexed {doc.name}")
            except Exception as inner_e:
                print(f"Startup Sync Error indexing {doc.name}: {inner_e}")
    except Exception as e:
        print(f"Startup Sync Error: {e}")
    finally:
        db.close()

# Startup DB Schema Creation
@app.on_event("startup")
def startup_event():
    init_db()
    sync_approved_documents_to_qdrant()

# Mount API Routers
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(study.router)
app.include_router(admin.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "AI Academic Study Assistant API",
        "version": "1.0.0"
    }

@app.get("/debug-docs")
def debug_docs():
    from app.core.database import SessionLocal
    from app.models import Document
    db = SessionLocal()
    try:
        docs = db.query(Document).all()
        return [{
            "id": d.id,
            "name": d.name,
            "subject": d.subject,
            "unit": d.unit,
            "visibility": d.visibility,
            "status": d.status,
            "file_path": d.file_path,
            "file_type": d.file_type
        } for d in docs]
    finally:
        db.close()

@app.get("/debug-qdrant")
def debug_qdrant():
    from app.core.vector_store import vector_store
    res = vector_store.client.scroll(
        collection_name=vector_store.collection_name,
        limit=100,
        with_payload=True,
        with_vectors=False
    )[0]
    return [{
        "id": hit.id,
        "doc_id": hit.payload.get("doc_id") if hit.payload else None,
        "name": hit.payload.get("name") if hit.payload else None,
        "subject": hit.payload.get("subject") if hit.payload else None,
        "unit": hit.payload.get("unit") if hit.payload else None,
        "visibility": hit.payload.get("visibility") if hit.payload else None
    } for hit in res]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
