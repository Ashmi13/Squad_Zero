"""
NeuraNote Quiz Module - FastAPI Backend with LangChain AI
"""

from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json
import os
import tempfile
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Local imports
from config.database import get_db, engine
from models import quizmodels as models
from db import schemas

# AI/LangChain imports
from PyPDF2 import PdfReader
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Initialize FastAPI
app = FastAPI(title="NeuraNote Quiz API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables
models.Base.metadata.create_all(bind=engine)

# Initialize LLM
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
llm = None
if OPENAI_API_KEY and OPENAI_API_KEY.startswith("sk-"):
    try:
        llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0.7, api_key=OPENAI_API_KEY)
        print("✅ LangChain LLM initialized successfully")
    except Exception as e:
        print(f"⚠️ LLM initialization failed: {e}")
else:
    print("⚠️ No valid OpenAI API key found - will use mock questions")


# ==================== HELPER FUNCTIONS ====================

def extract_text_from_file(uploaded_file: UploadFile) -> str:
    """Extract text from uploaded files"""
    try:
        if uploaded_file.filename.endswith(".pdf"):
            reader = PdfReader(uploaded_file.file)
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
            return text.strip()
        else:
            # Text files
            content = uploaded_file.file.read()
            return content.decode("utf-8", errors="ignore").strip()
    except Exception as e:
        print(f"Error extracting text from {uploaded_file.filename}: {e}")
        return ""


def chunk_text(text: str, chunk_size: int = 3000, chunk_overlap: int = 200):
    """Split text into chunks"""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )
    return splitter.split_text(text)


def generate_ai_questions(context: str, num_questions: int, difficulty: str):
    """Generate questions using AI"""
    if not llm:
        raise Exception("LLM not initialized")
    
    prompt = PromptTemplate(
        input_variables=["context", "num_questions", "difficulty"],
        template="""You are an expert educator creating quiz questions from study material.

Study Material:
{context}

Create {num_questions} multiple-choice questions at {difficulty} difficulty level.

IMPORTANT RULES:
1. Questions MUST be based on ACTUAL content from the study material above
2. Each question should test understanding of specific concepts mentioned in the material
3. Options should be plausible but clearly distinguishable
4. Only ONE option should be correct
5. Avoid generic questions - be specific to the material

Return ONLY valid JSON with NO markdown formatting, NO explanation:

[
  {{
    "question_text": "Specific question about a concept from the material...",
    "code_snippet": null,
    "difficulty": "{difficulty}",
    "options": [
      {{"letter": "A", "text": "Specific answer based on material"}},
      {{"letter": "B", "text": "Plausible wrong answer"}},
      {{"letter": "C", "text": "Another plausible wrong answer"}},
      {{"letter": "D", "text": "Another plausible wrong answer"}}
    ],
    "correct_answer": "A"
  }}
]

Generate {num_questions} questions now:
"""
    )
    
    # Call LLM
    response = llm.invoke(
        prompt.format(
            context=context[:3000],  # Increased context length
            num_questions=num_questions,
            difficulty=difficulty.capitalize()
        )
    )
    
    # Parse response
    content = response.content.strip()
    
    # Remove markdown code blocks if present
    if content.startswith("```"):
        lines = content.split("\n")
        content = "\n".join(lines[1:-1])  # Remove first and last line
        if content.startswith("json"):
            content = content[4:].strip()
    
    # Parse JSON
    try:
        questions = json.loads(content)
        return questions
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        print(f"Content: {content[:500]}")
        # Try to find JSON array in the content
        start = content.find("[")
        end = content.rfind("]") + 1
        if start != -1 and end > start:
            try:
                questions = json.loads(content[start:end])
                return questions
            except:
                pass
        raise HTTPException(status_code=500, detail="AI generated invalid JSON")


def generate_mock_questions(num_questions: int, difficulty: str, content: str):
    """Generate mock questions as fallback"""
    words = content.split()[:100]
    questions = []
    
    for i in range(min(num_questions, 10)):
        questions.append({
            "question_text": f"Question {i+1}: Based on the material, which statement is correct?",
            "code_snippet": None,
            "difficulty": difficulty.capitalize(),
            "options": [
                {"letter": "A", "text": f"Statement related to {words[i*4 % len(words)] if words else 'concept'} (A)"},
                {"letter": "B", "text": f"Statement related to {words[(i*4+1) % len(words)] if words else 'concept'} (B)"},
                {"letter": "C", "text": f"Statement related to {words[(i*4+2) % len(words)] if words else 'concept'} (C)"},
                {"letter": "D", "text": f"Statement related to {words[(i*4+3) % len(words)] if words else 'concept'} (D)"}
            ],
            "correct_answer": "A"
        })
    
    return questions


def validate_questions(questions):
    """Validate question structure"""
    valid_questions = []
    for q in questions:
        if all(k in q for k in ["question_text", "options", "correct_answer"]):
            if len(q["options"]) == 4:
                valid_questions.append(q)
    return valid_questions


# ==================== API ENDPOINTS ====================

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "NeuraNote Quiz API",
        "status": "running",
        "ai_enabled": llm is not None
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "ai_configured": llm is not None
    }


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
    """Generate quiz from uploaded files using AI"""
    
    print(f"📝 Generating quiz: {num_questions} questions, {difficulty} difficulty")
    print(f"📁 Received {len(files)} file(s)")
    
    try:
        # 1. Extract text from all files
        file_texts = []
        for file in files:
            print(f"📄 Processing: {file.filename}")
            text = extract_text_from_file(file)
            if text:
                file_texts.append(text)
                print(f"✅ Extracted {len(text)} characters")
        
        if not file_texts:
            raise HTTPException(status_code=400, detail="No text could be extracted from files")
        
        combined_text = " ".join(file_texts)
        print(f"📚 Total content: {len(combined_text)} characters")
        
        # 2. Generate questions
        try:
            if llm:
                print("🤖 Using AI to generate questions...")
                # Chunk text for better context
                chunks = chunk_text(combined_text)
                context = " ".join(chunks[:2])  # Use first 2 chunks
                
                questions_data = generate_ai_questions(context, num_questions, difficulty)
                print(f"✅ AI generated {len(questions_data)} questions")
            else:
                raise Exception("No LLM available")
        except Exception as e:
            print(f"⚠️ AI generation failed: {e}")
            print("🔄 Falling back to mock questions...")
            questions_data = generate_mock_questions(num_questions, difficulty, combined_text)
        
        # 3. Validate questions
        questions_data = validate_questions(questions_data)
        if not questions_data:
            raise HTTPException(status_code=500, detail="No valid questions were generated")
        
        # 4. Create quiz in database
        quiz = models.Quiz(
            user_id=user_id,
            note_id=note_id,
            title=f"AI Quiz - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            description=f"Generated from {len(files)} file(s)",
            total_questions=len(questions_data),
            time_limit=time_limit * 60,
            difficulty=difficulty
        )
        db.add(quiz)
        db.flush()
        
        # 5. Create questions and options
        for idx, q_data in enumerate(questions_data):
            question = models.Question(
                quiz_id=quiz.quiz_id,
                question_number=idx + 1,
                question_text=q_data['question_text'],
                code_snippet=q_data.get('code_snippet'),
                difficulty=q_data.get('difficulty', difficulty.capitalize()),
                question_type='multiple_choice'
            )
            db.add(question)
            db.flush()
            
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
        
        # 6. Return quiz with questions
        questions = db.query(models.Question).filter(
            models.Question.quiz_id == quiz.quiz_id
        ).all()
        
        print(f"✅ Quiz created successfully (ID: {quiz.quiz_id})")
        
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
                        }
                        for opt in q.options
                    ]
                }
                for q in questions
            ]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/quizzes/{quiz_id}/submit")
async def submit_quiz(
    quiz_id: int,
    user_id: int = Form(...),
    answers: str = Form(...),
    time_taken: int = Form(...),
    db: Session = Depends(get_db)
):
    """Submit quiz answers"""
    
    print(f"📤 Submitting quiz {quiz_id} for user {user_id}")
    
    try:
        # Parse answers
        answers_dict = json.loads(answers)
        
        # Get questions
        questions = db.query(models.Question).filter(
            models.Question.quiz_id == quiz_id
        ).all()
        
        if not questions:
            raise HTTPException(status_code=404, detail="Quiz not found")
        
        # Check answers
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
        
        # Save attempt
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
        
        print(f"✅ Quiz submitted. Score: {score_percentage}%")
        
        return {
            "attempt_id": attempt.attempt_id,
            "quiz_id": quiz_id,
            "score_percentage": score_percentage,
            "correct_answers": correct_answers,
            "total_questions": len(questions),
            "time_taken": time_taken,
            "detailed_results": detailed_results
        }
    
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid answers format")
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
