from typing import List, Dict, Any, Optional
from app.services.embedding import embedding_service
from app.core.vector_store import vector_store

class RetrievalAgent:
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
        # 1. Generate text embedding vector
        query_vector = embedding_service.get_embedding(query)

        # 2. Run Hybrid Search + Reciprocal Rank Fusion (RRF)
        chunks = vector_store.search_hybrid_rrf(
            query_vector=query_vector,
            query_text=query,
            user_id=user_id,
            role=role,
            limit=limit,
            filters=filters
        )

        return chunks

retrieval_agent = RetrievalAgent()
