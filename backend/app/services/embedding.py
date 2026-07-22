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

        # 2. Call HuggingFace Serverless API if token is configured
        if settings.HF_TOKEN:
            try:
                import httpx
                api_url = "https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5"
                headers = {"Authorization": f"Bearer {settings.HF_TOKEN}"}
                
                with httpx.Client() as client:
                    response = client.post(
                        api_url,
                        headers=headers,
                        json={"inputs": text, "options": {"wait_for_model": True}},
                        timeout=15.0
                    )
                    if response.status_code == 200:
                        vector = response.json()
                        if isinstance(vector, list) and len(vector) > 0:
                            # Flatten if nested list
                            if isinstance(vector[0], list):
                                vector = vector[0]
                            # Pad vector to 1536 dimensions for compatibility
                            if len(vector) < 1536:
                                vector = vector + [0.0] * (1536 - len(vector))
                            elif len(vector) > 1536:
                                vector = vector[:1536]
                            
                            cache_manager.set_embedding(text, vector)
                            return vector
                    else:
                        print(f"HuggingFace embedding API returned status {response.status_code}: {response.text}")
            except Exception as e:
                print(f"HuggingFace embedding API call failed: {e}. Falling back to mock embeddings.")

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
