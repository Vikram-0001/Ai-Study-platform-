import hashlib
import random
from typing import List
from openai import OpenAI
from app.config import settings
from app.core.caching import cache_manager

class EmbeddingService:
    def __init__(self):
        self.client = None
        # Note: Groq does not provide an embedding models API.
        # Since we use GROQ_API_KEY for the main LLM, we bypass the OpenAI embedding
        # client and let the service fall back cleanly to deterministic mock embeddings.

    def get_embedding(self, text: str) -> List[float]:
        """
        Retrieves a 1536-dimensional embedding vector for the text.
        Leverages Redis/local caching. Falls back to a deterministic mock vector if API key is absent.
        """
        # 1. Check cache first
        cached = cache_manager.get_embedding(text)
        if cached:
            return cached

        # 2. Call OpenAI or Mock
        if self.client:
            try:
                response = self.client.embeddings.create(
                    input=[text],
                    model="text-embedding-3-small"
                )
                vector = response.data[0].embedding
                # Cache results
                cache_manager.set_embedding(text, vector)
                return vector
            except Exception as e:
                print(f"OpenAI embedding call failed: {e}. Falling back to mock embeddings.")
        
        # 3. Deterministic Mock Fallback
        vector = self._generate_mock_embedding(text)
        cache_manager.set_embedding(text, vector)
        return vector

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Batch fetches embeddings.
        """
        embeddings = []
        for text in texts:
            embeddings.append(self.get_embedding(text))
        return embeddings

    def _generate_mock_embedding(self, text: str) -> List[float]:
        """
        Generates a deterministic vector of size 1536 based on the SHA-256 hash of the input text.
        Normalized to unit length to ensure correct cosine similarity scores.
        """
        # Seed random with text hash
        hash_val = int(hashlib.sha256(text.encode("utf-8")).hexdigest(), 16)
        rng = random.Random(hash_val)
        
        vector = [rng.gauss(0, 1) for _ in range(1536)]
        
        # Normalize to unit length
        magnitude = sum(x**2 for x in vector) ** 0.5
        if magnitude > 0:
            vector = [x / magnitude for x in vector]
            
        return vector

embedding_service = EmbeddingService()
