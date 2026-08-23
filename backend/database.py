import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from config.config import settings

db_url = settings.DATABASE_URL
if not db_url:
    # Print a warning instead of raising a fatal RuntimeError
    print("[WARN] DATABASE_URL is not set in backend/.env. SQLAlchemy database features will fall back to SQLite.")
    db_url = "sqlite:///./sqlite_fallback.db"

# SSL for cloud databases (only apply if using postgresql)
_connect_args = {"connect_timeout": 10}
if "postgresql" in db_url:
    _use_ssl = any(host in db_url for host in ("neon.tech", "supabase", "amazonaws"))
    if _use_ssl:
        _connect_args["sslmode"] = "require"
else:
    if "sqlite" in db_url:
        _connect_args = {"check_same_thread": False}

# SQLite compatibility check for create_engine parameters:
engine_kwargs = {
    "connect_args": _connect_args,
}
if "postgresql" in db_url:
    engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_size": 5,
        "max_overflow": 10,
    })

engine = create_engine(db_url, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """
    Database session dependency.
    Usage in routes: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

