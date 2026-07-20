import uuid
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from app.config import settings

class VectorStore:
    def __init__(self):
        # Fallback logic for in-memory or server url
        if settings.QDRANT_URL == ":memory:":
            self.client = QdrantClient(":memory:")
        else:
            self.client = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY
            )
        
        self.collection_name = "academic_chunks"
        self._ensure_collection_exists()

    def _ensure_collection_exists(self):
        try:
            collections = self.client.get_collections().collections
            exists = any(c.name == self.collection_name for c in collections)
            if not exists:
                # text-embedding-3-small uses 1536 dimensions
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=qmodels.VectorParams(
                        size=1536,
                        distance=qmodels.Distance.COSINE
                    )
                )
            
            # Ensure payload indexes exist for filtered fields (required by Qdrant Cloud)
            self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name="doc_id",
                field_schema=qmodels.PayloadSchemaType.INTEGER
            )
            self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name="owner_id",
                field_schema=qmodels.PayloadSchemaType.INTEGER
            )
            self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name="visibility",
                field_schema=qmodels.PayloadSchemaType.KEYWORD
            )
            self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name="status",
                field_schema=qmodels.PayloadSchemaType.KEYWORD
            )
        except Exception as e:
            # Handle potential connection issues or mock initialization
            print(f"Warning: Failed to ensure collection/indexes exist: {e}")

    def add_chunks(self, chunks: List[Dict[str, Any]], vectors: List[List[float]]):
        """
        Saves parsed chunks and their vector embeddings to Qdrant.
        Each chunk is a dictionary containing text content and metadata fields.
        """
        points = []
        for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
            point_id = str(uuid.uuid4())
            points.append(
                qmodels.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=chunk
                )
            )
        
        if points:
            self.client.upsert(
                collection_name=self.collection_name,
                points=points
            )

    def delete_document_chunks(self, doc_id: int):
        """
        Deletes all chunks associated with a specific document ID.
        """
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=qmodels.FilterSelector(
                filter=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="doc_id",
                            match=qmodels.MatchValue(value=doc_id)
                        )
                    ]
                )
            )
        )

    def build_rbac_filter(self, user_id: int, role: str) -> qmodels.Filter:
        """
        Builds a Qdrant query filter that restricts access based on:
        1. Owner ID (students can view their own private notes)
        2. Visibility ('global' materials, or approved 'community' materials)
        3. Admins have access to search everything
        """
        if role == "admin":
            return qmodels.Filter()  # Admins see everything

        # Students see: Global + Approved Community + Their own Private/Community uploads
        return qmodels.Filter(
            should=[
                qmodels.FieldCondition(key="visibility", match=qmodels.MatchValue(value="global")),
                qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(key="visibility", match=qmodels.MatchValue(value="community")),
                        qmodels.FieldCondition(key="status", match=qmodels.MatchValue(value="approved"))
                    ]
                ),
                qmodels.FieldCondition(key="owner_id", match=qmodels.MatchValue(value=user_id))
            ]
        )

    def search_vector(self, query_vector: List[float], user_id: int, role: str, limit: int = 10, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Executes a pure dense vector search using Cosine similarity.
        Supports both legacy QdrantClient.search and new QdrantClient.query_points.
        """
        rbac_filter = self.rbac_and_custom_filter(user_id, role, filters)
        
        if hasattr(self.client, "search"):
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                query_filter=rbac_filter,
                limit=limit
            )
        else:
            response = self.client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                query_filter=rbac_filter,
                limit=limit
            )
            results = response.points
        
        return [
            {
                "id": hit.id,
                "score": hit.score,
                **hit.payload
            } for hit in results
        ]

    def rbac_and_custom_filter(self, user_id: int, role: str, filters: Optional[Dict[str, Any]] = None) -> qmodels.Filter:
        rbac = self.build_rbac_filter(user_id, role)
        if not filters:
            return rbac

        must_conditions = []
        if rbac.must:
            must_conditions.extend(rbac.must)
        elif rbac.should:
            # Wrap RBAC should conditions
            must_conditions.append(rbac)

        for k, v in filters.items():
            if v is not None:
                must_conditions.append(
                    qmodels.FieldCondition(key=k, match=qmodels.MatchValue(value=v))
                )

        return qmodels.Filter(must=must_conditions)

    def search_keyword_bm25(self, query_text: str, user_id: int, role: str, limit: int = 10, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Keyword search implementation using Qdrant full-text filtering.
        """
        rbac_filter = self.rbac_and_custom_filter(user_id, role, filters)
        
        # Add keyword text match check
        text_filter = qmodels.FieldCondition(
            key="text",
            match=qmodels.MatchText(text=query_text)
        )
        
        # Combine filters
        combined_must = [text_filter]
        if rbac_filter.must:
            combined_must.extend(rbac_filter.must)
        elif rbac_filter.should or rbac_filter.must_not:
            combined_must.append(rbac_filter)
            
        full_filter = qmodels.Filter(must=combined_must)
        
        # Execute query without a vector (defaults to scrolling with query filters)
        results = self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=full_filter,
            limit=limit,
            with_vectors=False,
            with_payload=True
        )[0]
        
        # Scoring simulated on word intersection (BM25 surrogate for scrolling results)
        query_words = set(query_text.lower().split())
        scored_results = []
        for hit in results:
            payload = hit.payload or {}
            text = payload.get("text", "").lower()
            # Calculate basic term frequency intersection
            intersection = sum(1 for w in query_words if w in text)
            score = intersection / (len(query_words) + 1)
            scored_results.append({
                "id": hit.id,
                "score": score,
                **payload
            })
            
        return sorted(scored_results, key=lambda x: x["score"], reverse=True)[:limit]

    def search_hybrid_rrf(self, query_vector: List[float], query_text: str, user_id: int, role: str, limit: int = 5, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Performs Hybrid Search combining Vector similarity and keyword BM25 queries,
        merging rankings using Reciprocal Rank Fusion (RRF).
        """
        # 1. Vector Search
        vector_results = self.search_vector(query_vector, user_id, role, limit=limit*2, filters=filters)
        
        # 2. Keyword Search
        keyword_results = self.search_keyword_bm25(query_text, user_id, role, limit=limit*2, filters=filters)
        
        # 3. Reciprocal Rank Fusion (RRF)
        # RRF formula: Score = Sum_over_runs ( 1 / (k + rank) )
        # where k is a constant, typically 60.
        rrf_scores = {}
        items = {}
        k = 60
        
        for rank, item in enumerate(vector_results):
            item_id = item["id"]
            rrf_scores[item_id] = rrf_scores.get(item_id, 0.0) + (1.0 / (k + rank + 1))
            items[item_id] = item
            
        for rank, item in enumerate(keyword_results):
            item_id = item["id"]
            rrf_scores[item_id] = rrf_scores.get(item_id, 0.0) + (1.0 / (k + rank + 1))
            items[item_id] = item

        # Sort combined results by RRF score
        sorted_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)
        
        # 4. Cross-Encoder Re-ranking Simulation
        # In a full production setup, a HuggingFace Cross-Encoder model is invoked here.
        # We simulate Cross-Encoder re-ranking by checking detailed keyword relevance + text length density
        # to boost items with cleaner syntactic alignment.
        re_ranked = []
        for index, item_id in enumerate(sorted_ids[:limit*2]):
            item = items[item_id]
            # Cross encoder heuristic: calculate semantic density
            text = item.get("text", "").lower()
            query_lower = query_text.lower()
            
            # Substring exact matches get a boost
            exact_boost = 0.2 if query_lower in text else 0.0
            
            # Final re-ranked score combining RRF index + heuristic density
            re_rank_score = rrf_scores[item_id] + exact_boost
            
            re_ranked.append((re_rank_score, item))
            
        # Re-sort and take top limits
        re_ranked.sort(key=lambda x: x[0], reverse=True)
        return [item for score, item in re_ranked[:limit]]

vector_store = VectorStore()
