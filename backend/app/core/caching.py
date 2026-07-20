import json
import hashlib
import threading
from typing import Optional, Any
import redis
from app.config import settings

class LocalMemoryCache:
    """
    A thread-safe, in-memory backup cache system used when Redis is unavailable.
    """
    def __init__(self):
        self._data = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[str]:
        with self._lock:
            return self._data.get(key)

    def set(self, key: str, value: str, expire_seconds: Optional[int] = None):
        with self._lock:
            self._data[key] = value

    def flush(self):
        with self._lock:
            self._data.clear()


class CacheManager:
    def __init__(self):
        self.redis_client = None
        self.local_cache = LocalMemoryCache()
        
        if settings.REDIS_URL:
            try:
                self.redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
                # Test connection
                self.redis_client.ping()
                print("Redis connected successfully for caching.")
            except Exception as e:
                print(f"Warning: Failed to connect to Redis ({e}). Falling back to local memory cache.")
                self.redis_client = None

    def _hash_key(self, prefix: str, raw_key: str) -> str:
        """
        Creates a hashed cache key to avoid space or length constraints.
        """
        hash_digest = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
        return f"{prefix}:{hash_digest}"

    def get_embedding(self, text: str) -> Optional[list]:
        key = self._hash_key("embedding", text)
        cached_str = None
        
        if self.redis_client:
            try:
                cached_str = self.redis_client.get(key)
            except Exception:
                pass
        
        if not cached_str:
            cached_str = self.local_cache.get(key)
            
        if cached_str:
            return json.loads(cached_str)
        return None

    def set_embedding(self, text: str, embedding: list):
        key = self._hash_key("embedding", text)
        value_str = json.dumps(embedding)
        
        if self.redis_client:
            try:
                # Cache embeddings for 30 days
                self.redis_client.setex(key, 30 * 86400, value_str)
                return
            except Exception:
                pass
        
        self.local_cache.set(key, value_str)

    def get_answer(self, prompt: str, search_filters: Optional[dict] = None) -> Optional[dict]:
        """
        Retrieves cached answer payload. Cache-key accounts for query terms + active filters.
        """
        filters_str = json.dumps(search_filters or {}, sort_keys=True)
        key_input = f"{prompt}:{filters_str}"
        key = self._hash_key("answer", key_input)
        
        cached_str = None
        if self.redis_client:
            try:
                cached_str = self.redis_client.get(key)
            except Exception:
                pass
        
        if not cached_str:
            cached_str = self.local_cache.get(key)
            
        if cached_str:
            return json.loads(cached_str)
        return None

    def set_answer(self, prompt: str, answer_payload: dict, search_filters: Optional[dict] = None, expire_seconds: int = 3600):
        """
        Stores answers for rapid retrieval, default timeout is 1 hour.
        """
        filters_str = json.dumps(search_filters or {}, sort_keys=True)
        key_input = f"{prompt}:{filters_str}"
        key = self._hash_key("answer", key_input)
        value_str = json.dumps(answer_payload)
        
        if self.redis_client:
            try:
                self.redis_client.setex(key, expire_seconds, value_str)
                return
            except Exception:
                pass
        
        self.local_cache.set(key, value_str)

cache_manager = CacheManager()
