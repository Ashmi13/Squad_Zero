"""FastAPI v1 API router"""
from fastapi import APIRouter
from app.api.v1.endpoints import auth

_fm_loaded = False
_pdf_loaded = False
_tasks_loaded = False
_calendar_loaded = False

try:
    from routes import files, summary, highlights, chat, workspace, admin_alerts, productivity
    _fm_loaded = True
    print("[OK] Successfully imported file manager routes")
except Exception as e:
    print(f"[ERROR] Error importing file manager routes: {e}")

try:
    from routes import pdf
    _pdf_loaded = True
    print("[OK] Successfully imported pdf routes")
except Exception as e:
    print(f"[ERROR] Error importing pdf routes: {e}")

try:
    from app.api.v1.endpoints import tasks as tasks_endpoints
    _tasks_loaded = True
except Exception as e:
    print(f"⚠️  tasks endpoint skipped: {e}")

try:
    from app.api.v1.endpoints import calendar as calendar_endpoints
    _calendar_loaded = True
except Exception as e:
    print(f"⚠️  calendar endpoint skipped: {e}")

router = APIRouter()

@router.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0"}
router.include_router(auth.router)

if _tasks_loaded:
    router.include_router(tasks_endpoints.router)
    print("✅ Tasks routes loaded")

if _calendar_loaded:
    router.include_router(calendar_endpoints.router)
    print("✅ Calendar routes loaded")

if _fm_loaded:
    router.include_router(files.router,        prefix="/files",         tags=["files"])
    router.include_router(workspace.router,    prefix="/workspace",     tags=["workspace"])
    router.include_router(summary.router,      prefix="/summary",       tags=["summary"])
    router.include_router(highlights.router,   prefix="/highlights",    tags=["highlights"])
    router.include_router(chat.router,         prefix="/chat",          tags=["chat"])
    router.include_router(admin_alerts.router, prefix="/notifications", tags=["notifications"])
    router.include_router(productivity.router, prefix="/productivity",  tags=["productivity"])

if _pdf_loaded:
    router.include_router(pdf.router, prefix="/pdf", tags=["pdf"])

try:
    from app.api.v1.endpoints import announcements
    router.include_router(announcements.router)
    print("[OK] Announcements routes loaded")
except Exception as e:
    print(f"[ERROR] Announcements route failed: {e}")