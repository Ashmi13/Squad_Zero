"""FastAPI v1 API router"""
from fastapi import APIRouter
from app.api.v1.endpoints import auth, user, tasks

router = APIRouter()

# Health check
@router.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0"}

# Auth endpoints
router.include_router(auth.router)

# User endpoints
router.include_router(user.router)

# Tasks endpoints
router.include_router(tasks.router)
