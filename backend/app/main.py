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

# Startup DB Schema Creation
@app.on_event("startup")
def startup_event():
    init_db()

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
