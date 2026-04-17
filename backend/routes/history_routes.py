# backend/routes/history_routes.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from services.quiz_service import QuizService

router = APIRouter(prefix="/api/quizzes", tags=["history"])

@router.get("/history/{user_id}")
async def get_quiz_history(
    user_id: int,
    limit: int = 10,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get quiz history for a user"""
    service = QuizService(db)
    return await service.get_history(user_id, limit, offset)

@router.get("/analytics/{user_id}")
async def get_quiz_analytics(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get analytics for a user"""
    service = QuizService(db)
    return await service.get_analytics(user_id)

@router.get("/attempt/{attempt_id}/details")
async def get_attempt_details(
    attempt_id: int,
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific attempt"""
    service = QuizService(db)
    return await service.get_attempt_details(attempt_id, user_id)

@router.delete("/history/{attempt_id}")
async def delete_quiz_attempt(
    attempt_id: int,
    user_id: int,
    db: Session = Depends(get_db)
):
    """Delete a quiz attempt"""
    service = QuizService(db)
    return await service.delete_attempt(attempt_id, user_id)
