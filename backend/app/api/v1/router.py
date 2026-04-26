"""FastAPI v1 API router"""
from fastapi import APIRouter
from app.api.v1.endpoints import auth, user, tasks, admin, announcements
from app.api.v1.endpoints.calendar import router as calendar_router
from app.api.v1.endpoints.notifications import router as notifications_router

router = APIRouter(prefix="/api/v1")

@router.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0"}

router.include_router(auth.router)
router.include_router(user.router)

# Admin endpoints
router.include_router(admin.router)

# Public announcements
router.include_router(announcements.router)

# Tasks endpoints (M5)
router.include_router(tasks.router)

# Calendar endpoints (M5)
router.include_router(calendar_router)

# Notifications endpoints (M5)
router.include_router(notifications_router)