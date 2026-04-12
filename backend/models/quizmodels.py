# backend/models/quizmodels.py
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Numeric, ForeignKey
from datetime import datetime
from database import Base


class Quiz(Base):
    """Quiz table model"""
    __tablename__ = 'quizzes'

    quiz_id        = Column(Integer, primary_key=True, autoincrement=True)
    user_id        = Column(Integer, nullable=False)
    note_id        = Column(Integer, nullable=True)
    title          = Column(String(255), nullable=False)
    description    = Column(Text)
    total_questions = Column(Integer)
    time_limit     = Column(Integer)
    difficulty     = Column(String(50))
    created_at     = Column(DateTime, default=datetime.now)
    source_content = Column(Text)


class Question(Base):
    """Question table model"""
    __tablename__ = 'questions'

    question_id     = Column(Integer, primary_key=True, autoincrement=True)
    quiz_id         = Column(Integer, ForeignKey('quizzes.quiz_id', ondelete='CASCADE'))
    question_number = Column(Integer, nullable=False)
    question_text   = Column(Text, nullable=False)
    code_snippet    = Column(Text, nullable=True)
    difficulty      = Column(String(50))
    question_type   = Column(String(50), default='multiple_choice')
    # Stores the AI-generated sample answer for short answer questions
    expected_answer = Column(Text, nullable=True)


class AnswerOption(Base):
    """Answer options table model"""
    __tablename__ = 'answer_options'

    option_id    = Column(Integer, primary_key=True, autoincrement=True)
    question_id  = Column(Integer, ForeignKey('questions.question_id', ondelete='CASCADE'))
    option_letter = Column(String(20), nullable=False)
    option_text  = Column(Text, nullable=False)
    is_correct   = Column(Boolean, default=False)


class QuizAttempt(Base):
    """Quiz attempts table model"""
    __tablename__ = 'quiz_attempts'

    attempt_id      = Column(Integer, primary_key=True, autoincrement=True)
    quiz_id         = Column(Integer, ForeignKey('quizzes.quiz_id', ondelete='CASCADE'))
    user_id         = Column(Integer, nullable=False)
    score_percentage = Column(Numeric(5, 2))
    correct_answers = Column(Integer)
    total_questions = Column(Integer)
    time_taken      = Column(Integer)
    attempt_date    = Column(DateTime, default=datetime.now)
    answers_json    = Column(Text)
