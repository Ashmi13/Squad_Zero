from datetime import datetime, timezone
from sqlalchemy.sql import func

from sqlalchemy import (
    Boolean, Column, ForeignKey, Index,
    Integer, Numeric, String, Text,
    DateTime, BigInteger
)

from database import Base


def _utcnow():
    """Timezone-aware UTC timestamp — replaces deprecated datetime.utcnow."""
    return datetime.now(timezone.utc)


class Quiz(Base):
    """Quiz table model"""
    __tablename__ = "quizzes"
    __table_args__ = (
        Index("ix_quizzes_user_id", "user_id"),
    )

    quiz_id        = Column(Integer, primary_key=True, autoincrement=True)
    user_id        = Column(BigInteger, nullable=False)
    note_id        = Column(Integer, nullable=True)
    title          = Column(String(255), nullable=False)
    description    = Column(Text)
    total_questions = Column(Integer)
    time_limit     = Column(Integer)
    difficulty     = Column(String(50))
    created_at     = Column(DateTime(timezone=True), default=_utcnow)
    source_content = Column(Text)


class Question(Base):
    """Question table model"""
    __tablename__ = "questions"
    __table_args__ = (
        Index("ix_questions_quiz_id", "quiz_id"),
    )

    question_id     = Column(Integer, primary_key=True, autoincrement=True)
    quiz_id         = Column(Integer, ForeignKey("quizzes.quiz_id", ondelete="CASCADE"))
    question_number = Column(Integer, nullable=False)
    question_text   = Column(Text, nullable=False)
    code_snippet    = Column(Text, nullable=True)
    difficulty      = Column(String(50))
    question_type   = Column(String(50), default="multiple_choice")
    expected_answer = Column(Text, nullable=True)   # AI-generated answer for short_answer questions


class AnswerOption(Base):
    """Answer options table model"""
    __tablename__ = "answer_options"
    __table_args__ = (
        Index("ix_answer_options_question_id", "question_id"),
    )

    option_id     = Column(Integer, primary_key=True, autoincrement=True)
    question_id   = Column(Integer, ForeignKey("questions.question_id", ondelete="CASCADE"))
    option_letter = Column(String(20), nullable=False)
    option_text   = Column(Text, nullable=False)
    is_correct    = Column(Boolean, default=False)


class QuizAttempt(Base):
    """Quiz attempts table model"""
    __tablename__ = "quiz_attempts"
    __table_args__ = (
        Index("ix_quiz_attempts_user_id", "user_id"),
        Index("ix_quiz_attempts_attempt_date", "attempt_date"),
    )

    attempt_id       = Column(Integer, primary_key=True, autoincrement=True)
    quiz_id          = Column(Integer, ForeignKey("quizzes.quiz_id", ondelete="CASCADE"))
    user_id          = Column(BigInteger, nullable=False)
    score_percentage = Column(Numeric(5, 2))
    correct_answers  = Column(Integer)
    total_questions  = Column(Integer)
    time_taken       = Column(Integer)
    attempt_date     = Column(DateTime(timezone=True), default=_utcnow)
    answers_json     = Column(Text, nullable=True)   # stored as JSON string (TEXT column)
