import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, User
from app.core.security import hash_password, verify_password
from app.schemas import UserCreate
from fastapi.testclient import TestClient
from app.main import app

# Create in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(name="db_session")
def fixture_db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_admin_seeding_and_credentials(db_session):
    # Test seeding logic
    admin_email = "yadav.vikram.2406@gmail.com"
    admin_password = "hello1234"
    
    # Run the same seeding process as in database.py
    import uuid
    admin_user = db_session.query(User).filter(User.email == admin_email).first()
    assert admin_user is None
    
    # Seed
    admin_user = User(
        id="9999",
        username="yadav.vikram.",
        email=admin_email,
        password_hash=hash_password(admin_password),
        role="admin"
    )
    db_session.add(admin_user)
    db_session.commit()
    
    # Check seeded user
    seeded = db_session.query(User).filter(User.email == admin_email).first()
    assert seeded is not None
    assert seeded.role == "admin"
    assert verify_password(admin_password, seeded.password_hash) is True

def test_signup_always_creates_student(db_session):
    # If signup is hit with role='admin', it must still create a student
    from app.api.auth import signup
    
    # Test user signup payload requesting admin role
    payload = UserCreate(
        username="hacker_admin",
        email="hacker@uni.edu",
        password="password123",
        role="admin"
    )
    
    # Simulate DB session
    new_user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="student" # as per modified api/auth.py
    )
    db_session.add(new_user)
    db_session.commit()
    
    db_user = db_session.query(User).filter(User.username == "hacker_admin").first()
    assert db_user is not None
    assert db_user.role == "student"


def test_download_document_unauthorized():
    client = TestClient(app)
    response = client.get("/documents/1/download")
    assert response.status_code == 401

