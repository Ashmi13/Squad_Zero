from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List

from config.config import settings
from database import get_db
from middleware.auth import get_current_user
from models.quizmodels import QuizAttempt
from schemas.quiz_schemas import FileUploadValidator
from services.quiz_service import QuizService
from services.pdf_service import PDFService

# Optional rate limiting
try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    _limiter = Limiter(key_func=get_remote_address)
    _RATE_LIMITING = True
except ImportError:
    _RATE_LIMITING = False

router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])

_VALID_DIFFICULTIES   = {"easy", "medium", "hard"}
_VALID_QUESTION_TYPES = {"mcq", "short_answer", "mixed"}
_VALID_CONTENT_FOCUS  = {"theoretical", "practical", "both"}


def _validate_generate_inputs(
    num_questions: int,
    difficulty: str,
    time_limit: int,
    question_type: str,
    content_focus: str,
) -> None:
    """Raise HTTP 422 for any invalid generation parameter"""
    errors = []

    if difficulty not in _VALID_DIFFICULTIES:
        errors.append(f"difficulty must be one of: {', '.join(sorted(_VALID_DIFFICULTIES))}")

    if question_type not in _VALID_QUESTION_TYPES:
        errors.append(f"question_type must be one of: {', '.join(sorted(_VALID_QUESTION_TYPES))}")

    if content_focus not in _VALID_CONTENT_FOCUS:
        errors.append(f"content_focus must be one of: {', '.join(sorted(_VALID_CONTENT_FOCUS))}")

    if not (settings.MIN_QUESTIONS <= num_questions <= settings.MAX_QUESTIONS):
        errors.append(
            f"num_questions must be between {settings.MIN_QUESTIONS} and {settings.MAX_QUESTIONS}"
        )

    if not (settings.MIN_TIME_LIMIT <= time_limit <= settings.MAX_TIME_LIMIT):
        errors.append(
            f"time_limit must be between {settings.MIN_TIME_LIMIT} and {settings.MAX_TIME_LIMIT} minutes"
        )

    if errors:
        raise HTTPException(status_code=422, detail=errors)


@router.post("/generate")
async def generate_quiz(
    request: Request,
    files: List[UploadFile] = File(...),
    num_questions: int = Form(...),
    difficulty: str = Form(...),
    time_limit: int = Form(...),
    question_type: str = Form(...),
    content_focus: str = Form("both"),
    note_id: int = Form(None),
    source_content: str = Form(None),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),  # from verified JWT — not form data
):
    """Generate a new quiz from uploaded files or source content (max 10/min per IP)"""
    # Rate limit if slowapi is available
    if _RATE_LIMITING:
        try:
            await _limiter._check_request(request, "10/minute", generate_quiz)
        except Exception:
            pass

    # Validate inputs
    _validate_generate_inputs(num_questions, difficulty, time_limit, question_type, content_focus)

    # Validate files (count, size, extension)
    FileUploadValidator.validate(files)

    service = QuizService(db)
    result = await service.generate_quiz(
        files=files,
        num_questions=num_questions,
        difficulty=difficulty,
        time_limit=time_limit,
        question_type=question_type,
        content_focus=content_focus,
        user_id=user_id,
        note_id=note_id,
        source_content=source_content,
    )
    # Strip source_content — large payload
    result.pop("source_content", None)
    return result


@router.post("/{quiz_id}/submit")
async def submit_quiz(
    quiz_id: int,
    request: Request,
    answers: str = Form(...),
    time_taken: int = Form(...),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """Submit quiz answers and get results"""
    import json
    try:
        parsed_answers = json.loads(answers)
    except Exception:
        raise HTTPException(status_code=422, detail="answers must be valid JSON")

    service = QuizService(db)
    return await service.submit_quiz(quiz_id, user_id, parsed_answers, time_taken)


@router.get("/{quiz_id}/results/{attempt_id}/pdf")
async def download_results_pdf(
    quiz_id: int,
    attempt_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """Generate and download quiz results as PDF (caller must own the attempt)"""
    attempt = db.query(QuizAttempt).filter(
        QuizAttempt.attempt_id == attempt_id,
        QuizAttempt.user_id == user_id,  # ownership check
    ).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    quiz_service = QuizService(db)
    details = await quiz_service.get_attempt_details(attempt_id, user_id)

    pdf_service = PDFService()
    pdf_bytes = pdf_service.generate_results_pdf(details)

    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=quiz_results_{attempt_id}.pdf"
        },
    )
