import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    SECRET_KEY: str = "super-secret-jwt-key-replace-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    DATABASE_URL: str = "sqlite:///./academic_assistant.db"

    # Supabase authentication secret (HS256)
    SUPABASE_JWT_SECRET: Optional[str] = None

    # Vector DB (Default to ":memory:" for simple local startup, can be set to Qdrant server URL)
    QDRANT_URL: str = ":memory:"
    QDRANT_API_KEY: Optional[str] = None

    # Redis cache url (e.g. redis://localhost:6379)
    REDIS_URL: Optional[str] = None

    # AI API keys
    GROQ_API_KEY: Optional[str] = None
    TAVILY_API_KEY: Optional[str] = None

    # Security configuration
    ENABLE_SECURITY_GUARDRAILS: bool = True
    PII_REDACTION_LEVEL: str = "HIGH"
    RATE_LIMIT_PER_MINUTE: int = 60

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
