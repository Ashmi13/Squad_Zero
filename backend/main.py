"""
NeuraNote Quiz Module - FastAPI Backend
"""

from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os
import json
import tempfile

# Imports
from config.database import get_db, engine
from models import quizmodels as models
from db import schemas

# Initialize app
app = FastAPI(title="NeuraNote Quiz API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables
models.Base.metadata.create_all(bind=engine)


# Mock AI generation (replace with real LangChain later)
def generate_mock_questions(num_questions: int, difficulty: str):
    questions = []
    for i in range(num_questions):
        questions.append({
            "question_text": f"Sample question {i+1} about the uploaded content?",
            "code_snippet": None,
            "difficulty": difficulty.capitalize(),
            "options": [
                {"letter": "A", "text": f"Option A for question {i+1}"},
                {"letter": "B", "text": f"Option B for question {i+1}"},
                {"letter": "C", "text": f"Option C for question {i+1}"},
                {"letter": "D", "text": f"Option D for question {i+1}"}
            ],
            "correct_answer": "A"
        })
    return questions


@app.get("/")
def read_root():
    return {"message": "NeuraNote Quiz API", "status": "running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/api/quizzes/generate")
async def generate_quiz(
    files: List[UploadFile] = File(...),
    num_questions: int = Form(10),
    difficulty: str = Form("medium"),
    time_limit: int = Form(30),
    user_id: int = Form(1),
    note_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """Generate quiz from uploaded files"""
    
    # For now, use mock data
    # TODO: Add file processing and LangChain integration
    questions_data = generate_mock_questions(num_questions, difficulty)
    
    # Create quiz
    quiz = models.Quiz(
        user_id=user_id,
        note_id=note_id,
        title=f"AI Quiz - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        description="Generated from uploaded materials",
        total_questions=len(questions_data),
        time_limit=time_limit * 60,
        difficulty=difficulty
    )
    db.add(quiz)
    db.flush()
    
    # Create questions
    for idx, q_data in enumerate(questions_data):
        question = models.Question(
            quiz_id=quiz.quiz_id,
            question_number=idx + 1,
            question_text=q_data['question_text'],
            code_snippet=q_data.get('code_snippet'),
            difficulty=q_data['difficulty'],
            question_type='multiple_choice'
        )
        db.add(question)
        db.flush()
        
        # Create options
        for option_data in q_data['options']:
            option = models.AnswerOption(
                question_id=question.question_id,
                option_letter=option_data['letter'],
                option_text=option_data['text'],
                is_correct=(option_data['letter'] == q_data['correct_answer'])
            )
            db.add(option)
    
    db.commit()
    db.refresh(quiz)
    
    # Get questions with options
    questions = db.query(models.Question).filter(
        models.Question.quiz_id == quiz.quiz_id
    ).all()
    
    return {
        "quiz_id": quiz.quiz_id,
        "title": quiz.title,
        "description": quiz.description,
        "total_questions": quiz.total_questions,
        "time_limit": quiz.time_limit,
        "difficulty": quiz.difficulty,
        "questions": [
            {
                "question_id": q.question_id,
                "question_number": q.question_number,
                "question_text": q.question_text,
                "code_snippet": q.code_snippet,
                "difficulty": q.difficulty,
                "options": [
                    {
                        "option_id": opt.option_id,
                        "option_letter": opt.option_letter,
                        "option_text": opt.option_text
                    } for opt in q.options
                ]
            } for q in questions
        ]
    }


@app.post("/api/quizzes/{quiz_id}/submit")
async def submit_quiz(
    quiz_id: int,
    user_id: int = Form(...),
    answers: str = Form(...),
    time_taken: int = Form(...),
    db: Session = Depends(get_db)
):
    """Submit quiz answers"""
    
    answers_dict = json.loads(answers)
    
    questions = db.query(models.Question).filter(
        models.Question.quiz_id == quiz_id
    ).all()
    
    correct_answers = 0
    detailed_results = []
    
    for idx, question in enumerate(questions):
        user_answer = answers_dict.get(str(idx))
        
        correct_option = db.query(models.AnswerOption).filter(
            models.AnswerOption.question_id == question.question_id,
            models.AnswerOption.is_correct == True
        ).first()
        
        is_correct = (user_answer == correct_option.option_letter) if user_answer else False
        if is_correct:
            correct_answers += 1
        
        user_option = db.query(models.AnswerOption).filter(
            models.AnswerOption.question_id == question.question_id,
            models.AnswerOption.option_letter == user_answer
        ).first() if user_answer else None
        
        detailed_results.append({
            "question_text": question.question_text,
            "user_answer": user_answer,
            "user_answer_text": user_option.option_text if user_option else "Not answered",
            "correct_answer": correct_option.option_letter,
            "correct_answer_text": correct_option.option_text,
            "is_correct": is_correct
        })
    
    score_percentage = (correct_answers / len(questions)) * 100 if questions else 0
    
    attempt = models.QuizAttempt(
        quiz_id=quiz_id,
        user_id=user_id,
        score_percentage=score_percentage,
        correct_answers=correct_answers,
        total_questions=len(questions),
        time_taken=time_taken
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    
    return {
        "attempt_id": attempt.attempt_id,
        "quiz_id": quiz_id,
        "score_percentage": score_percentage,
        "correct_answers": correct_answers,
        "total_questions": len(questions),
        "time_taken": time_taken,
        "detailed_results": detailed_results
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
