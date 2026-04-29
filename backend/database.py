from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from config.config import settings

if not settings.DATABASE_URL:
    raise RuntimeError(
        "\n"
        "DATABASE_URL is not set.\n"
        "Add it to backend/.env, for example:\n"
        "  DATABASE_URL=postgresql://neuranote:password@localhost:5432/neuranote_db\n"
        "  DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres\n"
    )

# SSL for cloud databases
_use_ssl = any(host in settings.DATABASE_URL for host in ("neon.tech", "supabase", "amazonaws"))
_connect_args = {"connect_timeout": 10}
if _use_ssl:
    _connect_args["sslmode"] = "require"

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,    # detect stale connections before using them
    pool_size=5,
    max_overflow=10,
)

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
