from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models import Base

# Determine connect arguments based on database URL (SQLite requires different threading arguments)
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """
    FastAPI dependency that provides a thread-local database session.
    Automatically closes the session after request completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """
    Creates tables inside the database if they do not exist.
    """
    Base.metadata.create_all(bind=engine)

    # Seed default admin user
    from sqlalchemy.orm import Session
    from app.models import User
    from app.core.security import hash_password
    import uuid

    db = SessionLocal()
    try:
        admin_email = "yadav.vikram.2406@gmail.com"
        admin_user = db.query(User).filter(User.email == admin_email).first()
        if not admin_user:
            admin_user = User(
                id="9999",
                username="yadav.vikram",
                email=admin_email,
                password_hash=hash_password("hello1234"),
                role="admin"
            )
            db.add(admin_user)
            db.commit()
            print("Admin user successfully seeded.")
        else:
            admin_user.password_hash = hash_password("hello1234")
            admin_user.role = "admin"
            db.commit()
            print("Admin credentials verified and updated.")
    except Exception as e:
        print(f"Error seeding admin user: {e}")
        db.rollback()
    finally:
        db.close()

