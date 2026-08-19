import os

import sqlalchemy as sa
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()


# ---------------------------------------------------------------------------
# Database URL
# ---------------------------------------------------------------------------
# Second Brain uses the shared Supabase Postgres database, but its own
# dedicated tables:
#
#   second_brain_notes
#   second_brain_tags
#   second_brain_note_tags
#   second_brain_links
#
DATABASE_URL = (
    os.environ.get("SECOND_BRAIN_DB_URL")
    or os.environ.get("DATABASE_URL")
    or "postgresql+psycopg2://postgres:postgres@localhost:5432/second_brain"
)


# ---------------------------------------------------------------------------
# Connection settings
# ---------------------------------------------------------------------------
_connect_args = {"connect_timeout": 10}

if "postgresql" in DATABASE_URL:
    if any(
        host in DATABASE_URL
        for host in ("supabase", "amazonaws", "neon.tech")
    ):
        _connect_args["sslmode"] = "require"
else:
    _connect_args = {"check_same_thread": False}


engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args=_connect_args,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)

Base = declarative_base()


# ---------------------------------------------------------------------------
# DB dependency for FastAPI
# ---------------------------------------------------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Create Second Brain tables
# ---------------------------------------------------------------------------
def init_db():
    # IMPORTANT:
    # When this file is executed with:
    #
    #     python -m second_brain.db
    #
    # this module is temporarily loaded as "__main__".
    #
    # models.py imports "second_brain.db", which can otherwise create a
    # second Base object.
    #
    # Therefore we always use the Base that the models themselves use.
    from . import models

    model_metadata = models.Base.metadata

    print(
        "Second Brain tables in metadata:",
        list(model_metadata.tables.keys()),
    )

    with engine.begin() as conn:
        model_metadata.create_all(
            bind=conn,
            tables=[
                models.Note.__table__,
                models.Tag.__table__,
                models.Link.__table__,
                models.note_tags,
            ],
            checkfirst=True,
        )

    print(f"[second_brain] Tables ready on: {engine.url}")

    # ── Auto-migrate: add color column if it doesn't exist ──
    with engine.begin() as conn:
        # PostgreSQL (Supabase): add column — safe to re-run, catches error if exists
        try:
            conn.execute(
                sa.text(
                    "ALTER TABLE second_brain_notes "
                    "ADD COLUMN color VARCHAR(7) NOT NULL DEFAULT '#6366f1'"
                )
            )
            print("[second_brain] Color column added.")
        except Exception as exc:
            # Column likely already exists — ignore
            print(f"[second_brain] Color column already exists (or skip): {exc}")


# ---------------------------------------------------------------------------
# Allow: python -m second_brain.db
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    init_db()