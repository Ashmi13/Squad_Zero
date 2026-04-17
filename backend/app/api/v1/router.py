"""FastAPI v1 API router"""
from fastapi import APIRouter
from app.api.v1.endpoints import auth, user, tasks

router = APIRouter(prefix="/api/v1")

# Health check
@router.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0"}

# Auth endpoints (M1)
router.include_router(auth.router)

# User endpoints (M1)
router.include_router(user.router)

# Tasks endpoints (M5)
router.include_router(tasks.router)