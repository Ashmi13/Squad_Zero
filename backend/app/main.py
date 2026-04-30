import sys
import os
import importlib

# Ensure stdout uses UTF-8 to prevent UnicodeEncodeError with emojis on Windows
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# Adding backend/ to sys.path so all imports are resolved
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# App config
try:
    from app.core.config import settings
    app_name     = settings.app_name
    cors_origins = settings.cors_origins.split(",") if hasattr(settings, "cors_origins") else ["http://localhost:3000", "http://localhost:5173"]
    debug        = getattr(settings, "environment", "development") == "development"
except Exception:
    try:
        from config.config import settings as old_settings
        app_name     = old_settings.APP_NAME
        cors_origins = old_settings.CORS_ORIGINS
        debug        = old_settings.DEBUG
    except Exception as e:
        print(f"[WARN] Config load failed: {e}")
        app_name     = "NeuraNote"
        cors_origins = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000"]
        debug        = True

# Database table creation
try:
    from database import engine, Base
    print("⏳ Connecting to database... (this may take a minute if Supabase is waking up)")
    Base.metadata.create_all(bind=engine)
    print("[OK] Database tables ready")
except Exception as e:
    print(f"[WARN] Database init skipped: {e}")

# FastAPI app
app = FastAPI(
    title=app_name,
    version="1.0.0",
    debug=debug,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Request size limit (DOS protection)
try:
    from middleware.size_limit import RequestSizeLimitMiddleware
    app.add_middleware(RequestSizeLimitMiddleware, max_size=50 * 1024 * 1024)
    print("[OK] Request size limit middleware loaded (50 MB)")
except Exception as e:
    print(f"[WARN] Size limit middleware skipped: {e}")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],  # explicit, not "*"
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "User-Agent",
        "X-Guest-Session-ID",
    ],
    expose_headers=["Content-Disposition"],  # needed for PDF downloads
    max_age=600,                             # cache preflight for 10 minutes
)

# Rate limiting
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded

    limiter = Limiter(key_func=get_remote_address)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    print("[OK] Rate limiting loaded")
except ImportError:
    print("[WARN] Rate limiting skipped (slowapi not installed). Run: pip install slowapi")

# Exception handlers
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
    print(f"[WARN] Custom error handlers skipped: {e}")

# Core v1 router (Auth/User/FileManager)
try:
    from app.api.v1.router import router as v1_router
    app.include_router(v1_router, prefix="/api/v1")
    print("[OK] Auth/user routes loaded")
except ImportError as e:
    missing = str(e).replace("No module named ", "").strip("'")
    print(f"[WARN] Auth/user routes skipped (missing: {missing}). Run: pip install supabase")
except Exception as e:
    print(f"[WARN] Auth/user routes skipped: {e}")

# Quiz routes (M4)
try:
    from routes.quiz_routes import router as quiz_router
    from routes.history_routes import router as history_router
    from routes.health_routes import router as health_router
    app.include_router(health_router)
    app.include_router(quiz_router)
    app.include_router(history_router)
    print("[OK] Quiz routes loaded")
except ImportError as e:
    missing = str(e).replace("No module named ", "").strip("'")
    print(f"[WARN] Quiz routes skipped (missing: {missing}). Run: pip install -r requirements-m4quiz.txt")
except Exception as e:
    print(f"[WARN] Quiz routes skipped: {e}")

    # Flashcards routes
try:
    from routes.flashcards import router as flashcards_router
    app.include_router(flashcards_router, prefix="/api/v1/flashcards", tags=["flashcards"])
    print("[OK] Flashcards routes loaded")
except Exception as e:
    print(f"[WARN] Flashcards routes skipped: {e}")

# Structured Notes routes (M3)
try:
    from m3_structurednotes.router import router as notes_router
    app.include_router(notes_router, prefix="/api/m3", tags=["notes"])
    print("[OK] Structured notes routes loaded")
except ImportError as e:
    missing = str(e).replace("No module named ", "").strip("'")
    print(f"[WARN] Notes routes skipped (missing: {missing}). Run: pip install -r requirements-m3m4.txt")
except Exception as e:
    print(f"[WARN] Notes routes skipped: {e}")

# Optional routes (Tasks, Calendar, Notifications — M5 + M2)
_optional_routes = [
    ("routes.tasks",         "router", "/api/v1/tasks",         ["tasks"]),
    ("routes.calendar",      "router", "/api/v1/calendar",      ["calendar"]),
    ("routes.notifications", "router", "/api/v1/notifications", ["notifications"]),
    ("routes.task_list",     "router", "/api/v1/task-list",     ["task-list"]),
]

for _module, _attr, _prefix, _tags in _optional_routes:
    try:
        _mod = importlib.import_module(_module)
        app.include_router(getattr(_mod, _attr), prefix=_prefix, tags=_tags)
    except Exception as e:
        print(f"[WARN] {_module} skipped: {e}")

@app.get("/")
async def root():
    return {
        "message": f"Welcome to {app_name}",
        "version": "1.0.0",
        "docs": "/docs",
    }

@app.on_event("startup")
async def startup_event():
    print(f"[STARTUP] Starting {app_name}")
    # Warm up the column-detection cache so the first real request doesn't pay
    # the cost of 18 individual Supabase probes.
    try:
        from app.db.supabase import get_supabase_client as _get_supabase
        from app.services.workspace_service import WorkspaceService
        _sb = _get_supabase()
        _svc = WorkspaceService(_sb)
        _svc._detect_files_columns()
        print("[STARTUP] WorkspaceService column cache warmed up")
    except Exception as _e:
        print(f"[STARTUP] Column warmup skipped: {_e}")

@app.on_event("shutdown")
async def shutdown_event():
    print(f"[SHUTDOWN] Shutting down {app_name}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=debug,
    )
