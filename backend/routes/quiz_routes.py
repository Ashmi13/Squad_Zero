# backend/routes/quiz_routes.py
import sys, os; _r = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, _r) if _r not in sys.path else None
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from services.quiz_service import QuizService
from services.pdf_service import PDFService

router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])

@router.post("/generate")
async def generate_quiz(
    files: List[UploadFile] = File(...),
    num_questions: int = Form(...),
    difficulty: str = Form(...),
    time_limit: int = Form(...),
    question_type: str = Form(...),
    content_focus: str = Form(default='both'),
    user_id: int = Form(...),
    note_id: int = Form(None),
    source_content: str = Form(None),
    db: Session = Depends(get_db)
):
    """Generate a new quiz from uploaded files or source content"""
    service = QuizService(db)
    return await service.generate_quiz(
        files=files,
        num_questions=num_questions,
        difficulty=difficulty,
        time_limit=time_limit,
        question_type=question_type,
        content_focus=content_focus,
        user_id=user_id,
        note_id=note_id,
        source_content=source_content
    )

@router.post("/{quiz_id}/submit")
async def submit_quiz(
    quiz_id: int,
    user_id: int = Form(...),
    answers: str = Form(...),
    time_taken: int = Form(...),
    db: Session = Depends(get_db)
):
    """Submit quiz answers and get results"""
    service = QuizService(db)
    return await service.submit_quiz(quiz_id, user_id, answers, time_taken)


@router.get("/{quiz_id}/results/{attempt_id}/pdf")
async def download_results_pdf(
    quiz_id: int,
    attempt_id: int,
    db: Session = Depends(get_db)
):
    """Generate and download quiz results as a PDF"""
    quiz_service = QuizService(db)
    # Reuse get_attempt_details — pass attempt_id and look up user_id from the attempt
    from models.quizmodels import QuizAttempt
    attempt = db.query(QuizAttempt).filter(QuizAttempt.attempt_id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    details = await quiz_service.get_attempt_details(attempt_id, attempt.user_id)

    pdf_service = PDFService()
    pdf_bytes = pdf_service.generate_results_pdf(details)

    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=quiz_results_{attempt_id}.pdf"
        }
    )
