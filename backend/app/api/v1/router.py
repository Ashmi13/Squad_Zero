"""FastAPI v1 API router"""
from fastapi import APIRouter
# from app.api.v1.endpoints import auth, user, tasks  # M1 - commented out
# File Manager routers (Member 2 - Ashmitha)
from routes import files, summary, highlights, chat

router = APIRouter(prefix="/api/v1")

# Health check
@router.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0"}

# Auth endpoints (M1) - commented out, handled by teammate
# router.include_router(auth.router)

# User endpoints (M1) - commented out
# router.include_router(user.router)

# Tasks endpoints (M2) - commented out
# router.include_router(tasks.router)

# File Manager endpoints (Member 2 - Ashmitha)
router.include_router(files.router, prefix="/files", tags=["files"])
router.include_router(summary.router, prefix="/summary", tags=["summary"])
router.include_router(highlights.router, prefix="/highlights", tags=["highlights"])
router.include_router(chat.router, prefix="/chat", tags=["chat"])