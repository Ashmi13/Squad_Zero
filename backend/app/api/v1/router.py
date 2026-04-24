"""FastAPI v1 API router"""
from fastapi import APIRouter
from app.api.v1.endpoints import auth, user, tasks, admin, announcements

router = APIRouter(prefix="/api/v1")

# Health check
@router.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0"}

# Auth endpoints (M1)
router.include_router(auth.router)

# User endpoints (M1)
router.include_router(user.router)

# Admin endpoints
router.include_router(admin.router)

# Public announcements
router.include_router(announcements.router)

# Tasks endpoints (M5)
router.include_router(tasks.router)