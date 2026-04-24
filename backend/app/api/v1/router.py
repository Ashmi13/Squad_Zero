"""FastAPI v1 API router"""
from fastapi import APIRouter
from app.api.v1.endpoints import auth, user, tasks
from app.api.v1.endpoints.calendar import router as calendar_router

router = APIRouter(prefix="/api/v1")


@router.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0"}


router.include_router(auth.router)
router.include_router(user.router)
router.include_router(tasks.router)
router.include_router(calendar_router)