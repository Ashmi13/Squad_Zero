from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from middleware.auth import get_current_user
from services.quiz_service import QuizService

router = APIRouter(prefix="/api/quizzes", tags=["history"])


@router.get("/history/me")
async def get_quiz_history(
    limit:  int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0,  ge=0),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),   # from verified JWT — not URL
):
    """Get paginated quiz history for the authenticated user"""
    service = QuizService(db)
    return await service.get_history(user_id, limit, offset)


@router.get("/analytics/me")
async def get_quiz_analytics(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """Get quiz analytics for the authenticated user"""
    service = QuizService(db)
    return await service.get_analytics(user_id)


@router.get("/attempt/{attempt_id}/details")
async def get_attempt_details(
    attempt_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """Get detailed information about a specific attempt (must belong to caller)"""
    service = QuizService(db)
    return await service.get_attempt_details(attempt_id, user_id)


@router.delete("/history/{attempt_id}")
async def delete_quiz_attempt(
    attempt_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """Delete a quiz attempt (only the owning user can delete)"""
    service = QuizService(db)
    return await service.delete_attempt(attempt_id, user_id)
