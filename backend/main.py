# backend/main.py
import sys
import os
 
# Always add backend/ to sys.path so all imports resolve
# regardless of which directory uvicorn is launched from
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
 
# ── App config (develop branch structure) ─────────────────────────────────────
try:
    from app.core.config import settings
    app_name    = settings.app_name
    cors_origins = settings.cors_origins_list if hasattr(settings, 'cors_origins_list') else ["http://localhost:3000"]
    debug        = getattr(settings, 'environment', 'development') == 'development'
except Exception:
    # Fallback to old config if app.core.config isn't available
    from config.config import settings as old_settings
    app_name    = old_settings.APP_NAME
    cors_origins = old_settings.CORS_ORIGINS
    debug        = old_settings.DEBUG
 
# ── Database table creation (SQLAlchemy) ──────────────────────────────────────
try:
    from database import engine, Base
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables ready")
except Exception as e:
    print(f"⚠️  Database init skipped: {e}")
 
# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=app_name,
    version="1.0.0",
    debug=debug,
)
 
# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 
# ── Exception handlers ────────────────────────────────────────────────────────
try:
    from fastapi.exceptions import RequestValidationError
    from sqlalchemy.exc import SQLAlchemyError
    from middleware.error_handler import (
        validation_exception_handler,
        database_exception_handler,
        general_exception_handler,
    )
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(SQLAlchemyError, database_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)
except Exception as e:
    print(f"⚠️  Custom error handlers skipped: {e}")
 
# ── Routers ───────────────────────────────────────────────────────────────────
from app.api.v1.router import router as v1_router
app.include_router(v1_router, prefix="/api/v1")
 
# Also include quiz routes directly at /api (old URL pattern used by frontend)
try:
    from routes.quiz_routes import router as quiz_router
    from routes.history_routes import router as history_router
    from routes.health_routes import router as health_router
    app.include_router(health_router)
    app.include_router(quiz_router)
    app.include_router(history_router)
except Exception as e:
    print(f"⚠️  Direct route registration skipped: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.debug)
