import sys
import os
import importlib

# Ensure stdout uses UTF-8 to prevent UnicodeEncodeError with emojis on Windows
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# Adding backend/ to sys.path so all imports are resolved
# Launch directory of uvicorn
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# App config
try:
    from app.core.config import settings
    app_name     = settings.app_name
    cors_origins = settings.cors_origins_list if hasattr(settings, "cors_origins_list") else ["http://localhost:3000"]
    debug        = getattr(settings, "environment", "development") == "development"
except Exception:
    try:
        from config.config import settings as old_settings
        app_name     = old_settings.APP_NAME
        cors_origins = old_settings.CORS_ORIGINS
        debug        = old_settings.DEBUG
    except Exception as e:
        print(f"⚠️  Config load failed: {e}")
        app_name     = "NeuraNote"
        cors_origins = ["http://localhost:3000", "http://localhost:5173"]
        debug        = True

# Database table creation
try:
    from database import engine, Base
    print("⏳ Connecting to database... (this may take a minute if Supabase is waking up)")
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables ready")
except Exception as e:
    print(f"⚠️  Database init skipped: {e}")

# FastAPI app
app = FastAPI(
    title=app_name,
    version="1.0.0",
    debug=debug,
)

# Request size limit (DOS protection)
try:
    from middleware.size_limit import RequestSizeLimitMiddleware
    app.add_middleware(RequestSizeLimitMiddleware, max_size=50 * 1024 * 1024)
    print("✅ Request size limit middleware loaded (50 MB)")
except Exception as e:
    print(f"⚠️  Size limit middleware skipped: {e}")

# CORS (explicit methods and headers)
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
    ],
    expose_headers=["Content-Disposition"],  # needed for PDF downloads
    max_age=600,                             # cache preflight for 10 minutes
)

# Rate limiting (slowapi)
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded

    limiter = Limiter(key_func=get_remote_address)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    print("✅ Rate limiting loaded")
except ImportError:
    print("⚠️  Rate limiting skipped (slowapi not installed). Run: pip install slowapi")

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
    print(f"⚠️  Custom error handlers skipped: {e}")

# Core v1 router (Auth/User)
try:
    from app.api.v1.router import router as v1_router
    app.include_router(v1_router, prefix="/api/v1")
    print("✅ Auth/user routes loaded")
except ImportError as e:
    missing = str(e).replace("No module named ", "").strip("'")
    print(f"⚠️  Auth/user routes skipped (missing dependency: {missing}). Run: pip install supabase")
except Exception as e:
    print(f"⚠️  Auth/user routes skipped: {e}")

# Quiz routes (Quiz module)
try:
    from routes.quiz_routes import router as quiz_router
    from routes.history_routes import router as history_router
    from routes.health_routes import router as health_router
    app.include_router(health_router)
    app.include_router(quiz_router)
    app.include_router(history_router)
    print("✅ Quiz routes loaded")
except ImportError as e:
    missing = str(e).replace("No module named ", "").strip("'")
    print(f"⚠️  Quiz routes skipped (missing dependency: {missing}). Run: pip install -r requirements-m4quiz.txt")
except Exception as e:
    print(f"⚠️  Quiz routes skipped: {e}")

# Structured Notes routes
try:
    from m3_structurednotes.router import router as notes_router
    app.include_router(notes_router, prefix="/api/notes", tags=["notes"])
    print("✅ Structured notes routes loaded")
except ImportError as e:
    missing = str(e).replace("No module named ", "").strip("'")
    print(f"⚠️  Notes routes skipped (missing dependency: {missing}). Run: pip install -r requirements-m3m4.txt")
except Exception as e:
    print(f"⚠️  Notes routes skipped: {e}")

# ✅ FIX — routes land at /api/v1/tasks/, /api/v1/calendar/, etc.
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
        print(f"⚠️  {_module} skipped: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
