# backend/app/api/v1/router.py
import sys
import os

# Ensure backend root is on sys.path so quiz routes can import database, config etc.
_backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

from fastapi import APIRouter

router = APIRouter()

# ── Team routes (Supabase auth/user) ─────────────────────────────────────────
try:
    from app.api.v1.endpoints import auth, user
    router.include_router(auth.router, prefix="/auth", tags=["auth"])
    router.include_router(user.router, prefix="/users", tags=["users"])
    print("✅ Auth/user routes loaded")
except ImportError as e:
    print(f"⚠️  Auth/user routes skipped (missing dependency: {e}). Run: pip install supabase")

# ── Quiz routes (SQLAlchemy — always loaded) ──────────────────────────────────
try:
    from routes.quiz_routes import router as quiz_router
    from routes.history_routes import router as history_router
    from routes.health_routes import router as health_router

    router.include_router(health_router)
    router.include_router(quiz_router)
    router.include_router(history_router)
    print("✅ Quiz routes loaded")
except ImportError as e:
    print(f"❌ Quiz routes failed to load: {e}")
