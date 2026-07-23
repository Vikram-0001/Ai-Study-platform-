from typing import List, Dict, Any, Optional
from app.services.embedding import embedding_service
from app.core.vector_store import vector_store

class RetrievalAgent:
    def detect_subject_from_query(self, query: str) -> Optional[str]:
        """
        Looks at the distinct subjects in the database and checks if any of them
        appear in the query (case-insensitive whole-word match).
        """
        from app.core.database import SessionLocal
        from app.models import Document
        db = SessionLocal()
        try:
            # Fetch distinct non-null subjects from database
            subjects = [s[0] for s in db.query(Document.subject).distinct().all() if s[0]]
        except Exception as e:
            print(f"Error fetching subjects for auto-detection: {e}")
            subjects = []
        finally:
            db.close()

        if not subjects:
            return None

        # Sort subjects by length descending so that longer subject names are checked first
        subjects.sort(key=len, reverse=True)
        
        import re
        query_lower = query.lower()
        for subject in subjects:
            # Match whole-word boundary
            pattern = r"\b" + re.escape(subject.lower()) + r"\b"
            if re.search(pattern, query_lower):
                return subject
                
        return None

    def retrieve_context(
        self,
        query: str,
        user_id: int,
        role: str,
        limit: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Executes semantic embedding creation and queries Qdrant with filters
        applying RBAC. Returns a ranked list of relevant content chunks.
        """
        # Auto-detect subject if not explicitly filtered
        active_filters = dict(filters) if filters else {}
        if "subject" not in active_filters or not active_filters["subject"]:
            detected_subject = self.detect_subject_from_query(query)
            if detected_subject:
                active_filters["subject"] = detected_subject
                print(f"Auto-detected subject: '{detected_subject}' from query: '{query}'")

        # 1. Generate text embedding vector
        query_vector = embedding_service.get_embedding(query)

        # 2. Run Hybrid Search + Reciprocal Rank Fusion (RRF)
        chunks = vector_store.search_hybrid_rrf(
            query_vector=query_vector,
            query_text=query,
            user_id=user_id,
            role=role,
            limit=limit,
            filters=active_filters if active_filters else None
        )

        return chunks

retrieval_agent = RetrievalAgent()
