"""
Database Models
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.database import Base


class Quiz(Base):
    __tablename__ = "quizzes"
    
    quiz_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    note_id = Column(Integer, nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    total_questions = Column(Integer, nullable=False)
    time_limit = Column(Integer)
    difficulty = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"
    
    question_id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.quiz_id", ondelete="CASCADE"), nullable=False)
    question_number = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    code_snippet = Column(Text)
    difficulty = Column(String(50))
    question_type = Column(String(50), default="multiple_choice")
    
    quiz = relationship("Quiz", back_populates="questions")
    options = relationship("AnswerOption", back_populates="question", cascade="all, delete-orphan")


class AnswerOption(Base):
    __tablename__ = "answer_options"
    
    option_id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.question_id", ondelete="CASCADE"), nullable=False)
    option_letter = Column(String(1), nullable=False)
    option_text = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=False)
    
    question = relationship("Question", back_populates="options")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    
    attempt_id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.quiz_id"), nullable=False)
    user_id = Column(Integer, nullable=False)
    score_percentage = Column(Float)
    correct_answers = Column(Integer)
    total_questions = Column(Integer)
    time_taken = Column(Integer)
    attempted_at = Column(DateTime, default=datetime.utcnow)
    
    quiz = relationship("Quiz", back_populates="attempts")
