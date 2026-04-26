"""FastAPI v1 API router"""
from fastapi import APIRouter
from app.api.v1.endpoints import auth

# File Manager routers (Member 2 - Ashmitha)
try:
    from routes import files, summary, highlights, chat, workspace, admin_alerts, productivity
    print("[OK] Successfully imported file manager routes")
except Exception as e:
    print(f"[ERROR] Error importing file manager routes: {e}")
    raise

# CHANGED: Added PDF routes for Extract Text and Generate Summary features
try:
    from routes import pdf
    print("[OK] Successfully imported pdf routes")
except Exception as e:
    print(f"[ERROR] Error importing pdf routes: {e}")
    raise

router = APIRouter(prefix="/api/v1")

# Health check
@router.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0"}

# Auth endpoints
print("Including auth router...")
router.include_router(auth.router)

# File Manager endpoints (Member 2 - Ashmitha)
print("Including file manager routers...")
router.include_router(files.router, prefix="/files", tags=["files"])
router.include_router(workspace.router, prefix="/workspace", tags=["workspace"])
router.include_router(summary.router, prefix="/summary", tags=["summary"])
router.include_router(highlights.router, prefix="/highlights", tags=["highlights"])
router.include_router(chat.router, prefix="/chat", tags=["chat"])
router.include_router(admin_alerts.router, prefix="/notifications", tags=["notifications"])
router.include_router(productivity.router, prefix="/productivity", tags=["productivity"])

# CHANGED: Added PDF routes for text extraction and summary generation
print("Including pdf router with prefix /pdf...")
print(f"PDF router object: {pdf.router}")
print(f"PDF router routes: {pdf.router.routes}")
router.include_router(pdf.router, prefix="/pdf", tags=["pdf"])
print("[OK] PDF router included successfully")