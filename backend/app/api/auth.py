from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import User
from app.schemas import UserCreate, UserLogin, Token
from app.core.security import hash_password, verify_password, create_access_token, get_current_user_payload

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    # Check if username exists
    existing_user = db.query(User).filter(User.username == payload.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already registered"
        )

    # Check if email exists
    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is already registered"
        )

    # Create new user
    new_user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="student"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generate JWT
    token_data = {"sub": str(new_user.id), "id": new_user.id, "role": new_user.role}
    access_token = create_access_token(token_data)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": new_user.role,
        "username": new_user.username
    }


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    # Find user by username or email
    user = db.query(User).filter(
        (User.username == payload.username_or_email) | (User.email == payload.username_or_email)
    ).first()
    
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username, email, or password credentials"
        )

    # Generate JWT
    token_data = {"sub": str(user.id), "id": user.id, "role": user.role}
    access_token = create_access_token(token_data)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username
    }


@router.post("/sync")
def sync_user(user_payload: dict = Depends(get_current_user_payload)):
    """
    Validates a Supabase JWT token, synchronizes the user profile inside
    the local database, and returns the profile details (role, username, email).
    """
    return user_payload

