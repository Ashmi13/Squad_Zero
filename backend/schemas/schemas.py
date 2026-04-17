# backend/schemas/schemas.py
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# Quiz Schemas
class QuizGenerateRequest(BaseModel):
    num_questions: int = Field(..., ge=1, le=25)
    difficulty: str = Field(..., regex="^(easy|medium|hard)$")
    time_limit: int = Field(..., ge=1, le=180)
    question_type: str = Field(..., regex="^(mcq|short_answer|mixed)$")
    user_id: int
    note_id: Optional[int] = None
    source_content: Optional[str] = None

class QuizResponse(BaseModel):
    quiz_id: int
    title: str
    description: str
    total_questions: int
    time_limit: int
    difficulty: str
    questions: List[dict]
    source_content: Optional[str] = None

# Question Schemas
class AnswerOptionSchema(BaseModel):
    option_letter: str
    option_text: str
    is_correct: bool

class QuestionSchema(BaseModel):
    question_number: int
    question_text: str
    code_snippet: Optional[str] = None
    difficulty: str
    question_type: str
    options: Optional[List[AnswerOptionSchema]] = None

# Quiz Attempt Schemas
class QuizSubmitRequest(BaseModel):
    user_id: int
    answers: dict
    time_taken: int

class QuizSubmitResponse(BaseModel):
    attempt_id: int
    score_percentage: float
    correct_answers: int
    total_questions: int
    time_taken: int
    detailed_results: List[dict]
    can_progress: bool
    next_difficulty: Optional[str] = None
    current_difficulty: str
    source_content: Optional[str] = None

# History Schemas
class QuizHistoryItem(BaseModel):
    attempt_id: int
    quiz_id: int
    quiz_title: str
    quiz_description: str
    difficulty: str
    total_questions: int
    correct_answers: int
    score_percentage: float
    time_taken: int
    attempt_date: datetime
    passed: bool

class QuizHistoryResponse(BaseModel):
    history: List[QuizHistoryItem]
    total_count: int
    limit: int
    offset: int
    has_more: bool
