"""
Pydantic Schemas
"""

from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class OptionResponse(BaseModel):
    option_id: int
    option_letter: str
    option_text: str
    
    class Config:
        from_attributes = True


class QuestionResponse(BaseModel):
    question_id: int
    question_number: int
    question_text: str
    code_snippet: Optional[str] = None
    difficulty: str
    options: List[OptionResponse]
    
    class Config:
        from_attributes = True


class QuizResponse(BaseModel):
    quiz_id: int
    title: str
    description: str
    total_questions: int
    time_limit: int
    difficulty: str
    questions: List[QuestionResponse]
