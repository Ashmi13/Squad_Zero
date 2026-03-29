"""FastAPI v1 API router"""
from fastapi import APIRouter
from app.api.v1.endpoints import auth, user

router = APIRouter(prefix="/api/v1")

# Health check endpoint
@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "version": "1.0"}

# Auth endpoints
router.include_router(auth.router)

# User endpoints
router.include_router(user.router)

