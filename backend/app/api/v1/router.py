"""FastAPI v1 API router"""
from fastapi import APIRouter
from app.api.v1.endpoints import auth, user, tasks, admin, announcements
from app.api.v1.endpoints.calendar import router as calendar_router
from app.api.v1.endpoints.notifications import router as notifications_router
from app.api.v1.endpoints import auth, payments, user

def _safe_import(module_path: str, label: str):
    """Import a route module without breaking unrelated routes on failure."""
    try:
        module = __import__(module_path, fromlist=["router"])
        print(f"[OK] Loaded {label} routes")
        return module
    except Exception as e:
        print(f"[WARN] Skipped {label} routes: {e}")
        return None

files = _safe_import("routes.files", "files")
summary = _safe_import("routes.summary", "summary")
highlights = _safe_import("routes.highlights", "highlights")
chat = _safe_import("routes.chat", "chat")
workspace = _safe_import("routes.workspace", "workspace")
admin_alerts = _safe_import("routes.admin_alerts", "notifications")
productivity = _safe_import("routes.productivity", "productivity")
pdf = _safe_import("routes.pdf", "pdf")

_tasks_loaded = False
_calendar_loaded = False

try:
    from app.api.v1.endpoints import tasks as tasks_endpoints
    _tasks_loaded = True
except Exception as e:
    print(f"⚠️ tasks endpoint skipped: {e}")

try:
    from app.api.v1.endpoints import calendar as calendar_endpoints
    _calendar_loaded = True
except Exception as e:
    print(f"[WARN] calendar endpoint skipped: {e}")

router = APIRouter()

@router.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0"}

router.include_router(auth.router)
router.include_router(payments.router)
router.include_router(user.router)

if _tasks_loaded:
    router.include_router(tasks_endpoints.router)
    print("[OK] Tasks routes loaded")

if _calendar_loaded:
    router.include_router(calendar_endpoints.router)
    print("[OK] Calendar routes loaded")

if files:
    router.include_router(files.router, prefix="/files", tags=["files"])

if workspace:
    router.include_router(workspace.router, prefix="/workspace", tags=["workspace"])

if summary:
    router.include_router(summary.router, prefix="/summary", tags=["summary"])

if highlights:
    router.include_router(highlights.router, prefix="/highlights", tags=["highlights"])

if chat:
    router.include_router(chat.router, prefix="/chat", tags=["chat"])

if admin_alerts:
    router.include_router(admin_alerts.router, prefix="/notifications", tags=["notifications"])

if productivity:
    router.include_router(productivity.router, prefix="/productivity", tags=["productivity"])

if pdf:
    router.include_router(pdf.router, prefix="/pdf", tags=["pdf"])

try:
    from app.api.v1.endpoints import announcements
    router.include_router(announcements.router)
    print("[OK] Announcements routes loaded")
except Exception as e:
    print(f"[ERROR] Announcements route failed: {e}")

try:
    from app.api.v1.endpoints import admin
    router.include_router(admin.router)
    print("[OK] Admin routes loaded")
except Exception as e:
    print(f"⚠️ Admin routes skipped: {e}")
    print(f"⚠️ Admin routes skipped: {e}")
