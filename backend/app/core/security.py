import re
import datetime
import bcrypt
import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, List
from app.config import settings

security_scheme = HTTPBearer()

# Cryptographic password hashing
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

# JWT utilities
def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    # 1. Try decoding with Supabase JWT Secret if configured
    if settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated"
            )
            return payload
        except jwt.PyJWTError as e:
            # Let it try local fallback below
            pass

    # 2. Local signature fallback
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

# FastAPI Route Security and Dependency Injection
def get_current_user_payload(credentials: HTTPAuthorizationCredentials = Security(security_scheme)) -> dict:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Extract user identity from payload claims (Supabase puts UUID in 'sub')
    user_id = payload.get("sub")
    email = payload.get("email")
    
    # Fallback to local keys if sub is missing
    if not user_id:
        user_id = payload.get("id")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identity token claims missing required User UUID (sub)."
        )

    # Perform automated database profile synchronization
    from app.core.database import SessionLocal
    from app.models import User

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == str(user_id)).first()
        if not user:
            # Generate temporary username from email or ID segment
            email_str = str(email) if email else f"{user_id}@supabase.io"
            username = email_str.split("@")[0]
            
            # Ensure unique username
            orig_username = username
            counter = 1
            while db.query(User).filter(User.username == username).first():
                username = f"{orig_username}_{counter}"
                counter += 1

            # Determine role: default is student. Only the specific admin email gets admin role.
            role = "student"
            if email_str.lower() == "yadav.vikram.2406@gmail.com":
                role = "admin"

            user = User(
                id=str(user_id),
                email=email_str,
                username=username,
                role=role
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # Return sanitized dictionary mapping profile representation
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role
        }
    finally:
        db.close()

def get_admin_user(credentials: HTTPAuthorizationCredentials = Security(security_scheme)) -> dict:
    payload = get_current_user_payload(credentials)
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation requires Admin privilege status",
        )
    return payload


# --- SECURITY WORKFLOW PIPELINE ---

# PII Detection Patterns (Email, Phone numbers, generic SSN/National IDs)
EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_PATTERN = re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")
SSN_PATTERN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")

def redact_pii(text: str) -> str:
    """
    Scrubs typical Personal Identifiable Information (PII) from user inputs.
    """
    if not settings.ENABLE_SECURITY_GUARDRAILS:
        return text
    
    text = EMAIL_PATTERN.sub("[REDACTED_EMAIL]", text)
    text = PHONE_PATTERN.sub("[REDACTED_PHONE]", text)
    text = SSN_PATTERN.sub("[REDACTED_ID]", text)
    return text


# Prompt Injection Defense
INJECTION_KEYWORDS = [
    r"ignore\s+(?:all\s+)?previous\s+instructions",
    r"system\s+prompt\s+override",
    r"you\s+are\s+now\s+a\s+different\s+ai",
    r"bypass\s+restrictions",
    r"forget\s+what\s+i\s+said",
    r"dan\s+mode",
    r"jailbreak",
    r"do\s+anything\s+now",
    r"instructions\s+below\s+this\s+line\s+should\s+be\s+ignored"
]

def check_prompt_injection(text: str) -> bool:
    """
    Scans the text for common jailbreak or injection patterns.
    Returns True if an injection attempt is detected.
    """
    if not settings.ENABLE_SECURITY_GUARDRAILS:
        return False
    
    normalized = text.lower()
    for pattern in INJECTION_KEYWORDS:
        if re.search(pattern, normalized):
            return True
    return False


# In-Memory Rate Limiting Fallback (IP/User-based rate counter)
class InMemoryRateLimiter:
    def __init__(self):
        self.requests: Dict[str, List[float]] = {}

    def is_rate_limited(self, identifier: str, limit: int = 60, window_secs: int = 60) -> bool:
        now = datetime.datetime.utcnow().timestamp()
        if identifier not in self.requests:
            self.requests[identifier] = []
        
        # Clean expired timestamps
        self.requests[identifier] = [
            t for t in self.requests[identifier] if now - t < window_secs
        ]

        if len(self.requests[identifier]) >= limit:
            return True
        
        self.requests[identifier].append(now)
        return False

rate_limiter = InMemoryRateLimiter()
