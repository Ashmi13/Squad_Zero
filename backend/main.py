"""
NeuraNote Quiz Module -  Backend
"""

from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json
import os
import io
from dotenv import load_dotenv

load_dotenv()

from config.database import get_db, engine
from models import quizmodels as models
from db import schemas

# AI/LangChain imports
from PyPDF2 import PdfReader
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Document processing
import openpyxl
from docx import Document

# PDF generation
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER

app = FastAPI(title="NeuraNote Quiz API - Submission Fix")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        filename = uploaded_file.filename.lower()
        
        if filename.endswith(".pdf"):
            reader = PdfReader(uploaded_file.file)
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
            return text.strip()
            
        elif filename.endswith(".xlsx") or filename.endswith(".xls"):
            workbook = openpyxl.load_workbook(uploaded_file.file)
            text = ""
            for sheet in workbook.worksheets:
                for row in sheet.iter_rows(values_only=True):
                    row_text = " ".join([str(cell) for cell in row if cell is not None])
                    text += row_text + "\n"
            return text.strip()
            
        elif filename.endswith(".docx"):
            doc = Document(uploaded_file.file)
            text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
            return text.strip()
            
        else:
            content = uploaded_file.file.read()
            return content.decode("utf-8", errors="ignore").strip()
            
    except Exception as e:
        print(f"Error extracting text: {e}")
        return ""


def chunk_text(text: str, chunk_size: int = 3000, chunk_overlap: int = 200):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )
    return splitter.split_text(text)


def generate_ai_questions(context: str, num_questions: int, difficulty: str, question_type: str = "mixed"):
    """Generate questions using AI"""
    if not llm:
        raise Exception("LLM not initialized")
    
    if question_type == "mcq":
        types_instruction = "Generate ONLY multiple-choice questions with 4 options each."
    elif question_type == "short_answer":
        types_instruction = "Generate ONLY short answer questions."
    else:
        types_instruction = "Generate a MIX of multiple-choice (70%) and short answer (30%) questions."
    
    prompt = PromptTemplate(
        input_variables=["context", "num_questions", "difficulty", "types_instruction"],
        template="""You are an expert educator creating quiz questions.

Study Material:
{context}

Create {num_questions} questions at {difficulty} difficulty.
{types_instruction}

Return ONLY valid JSON:

[
  {{
    "question_text": "Question based on material...",
    "question_type": "multiple_choice",
    "code_snippet": null,
    "difficulty": "{difficulty}",
    "options": [
      {{"letter": "A", "text": "Option A"}},
      {{"letter": "B", "text": "Option B"}},
      {{"letter": "C", "text": "Option C"}},
      {{"letter": "D", "text": "Option D"}}
    ],
    "correct_answer": "A"
  }}
]
"""
    )
    
    response = llm.invoke(
        prompt.format(
            context=context[:3000],
            num_questions=num_questions,
            difficulty=difficulty.capitalize(),
            types_instruction=types_instruction
        )
    )
    
    content = response.content.strip()
    
    if content.startswith("```"):
        lines = content.split("\n")
        content = "\n".join(lines[1:-1])
        if content.startswith("json"):
            content = content[4:].strip()
    
    try:
        questions = json.loads(content)
        return questions
    except:
        start = content.find("[")
        end = content.rfind("]") + 1
        if start != -1 and end > start:
            try:
                questions = json.loads(content[start:end])
                return questions
            except:
                pass
        raise HTTPException(500, "AI generated invalid JSON")


def generate_mock_questions(num_questions: int, difficulty: str, content: str, question_type: str = "mixed"):
    """Generate mock questions"""
    words = content.split()[:100] if content else ["example"]
    questions = []
    
    for i in range(min(num_questions, 25)):
        if question_type == "short_answer" or (question_type == "mixed" and i % 3 == 2):
            questions.append({
                "question_text": f"Explain the concept of {words[i % len(words)]} mentioned in the material.",
                "question_type": "short_answer",
                "code_snippet": None,
                "difficulty": difficulty.capitalize(),
                "options": [],
                "correct_answer": f"Expected answer should explain {words[i % len(words)]} in detail."
            })
        else:
            questions.append({
                "question_text": f"Question {i+1}: Based on the material, which statement is correct?",
                "question_type": "multiple_choice",
                "code_snippet": None,
                "difficulty": difficulty.capitalize(),
                "options": [
                    {"letter": "A", "text": f"Statement about {words[(i*4) % len(words)]}"},
                    {"letter": "B", "text": f"Statement about {words[(i*4+1) % len(words)]}"},
                    {"letter": "C", "text": f"Statement about {words[(i*4+2) % len(words)]}"},
                    {"letter": "D", "text": f"Statement about {words[(i*4+3) % len(words)]}"}
                ],
                "correct_answer": "A"
            })
    
    return questions


def validate_questions(questions):
    valid_questions = []
    for q in questions:
        if "question_text" in q and "question_type" in q and "correct_answer" in q:
            if q["question_type"] == "multiple_choice":
                if "options" in q and len(q["options"]) == 4:
                    valid_questions.append(q)
            elif q["question_type"] == "short_answer":
                valid_questions.append(q)
    return valid_questions


def generate_pdf_review(results_data: dict) -> bytes:
    """Generate PDF with proper answer review"""
    buffer = io.BytesIO()
    
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72,
                           topMargin=72, bottomMargin=18)
    
    story = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#9333ea'),
        spaceAfter=30,
        alignment=TA_CENTER
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#9333ea'),
        spaceAfter=12,
        spaceBefore=12
    )
    
    story.append(Paragraph("Quiz Results Review", title_style))
    story.append(Spacer(1, 12))
    
    # Summary
    summary_data = [
        ['Score', f"{results_data['score_percentage']:.1f}%"],
        ['Correct Answers', f"{results_data['correct_answers']}/{results_data['total_questions']}"],
        ['Time Taken', f"{results_data['time_taken'] // 60}m {results_data['time_taken'] % 60}s"],
        ['Date', datetime.now().strftime('%Y-%m-%d %H:%M')]
    ]
    
    summary_table = Table(summary_data, colWidths=[2*inch, 3*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f3f4f6')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.white)
    ]))
    
    story.append(summary_table)
    story.append(Spacer(1, 20))
    
    # Detailed Review
    story.append(Paragraph("Detailed Answer Review", heading_style))
    story.append(Spacer(1, 12))
    
    if 'detailed_results' in results_data and results_data['detailed_results']:
        for idx, item in enumerate(results_data['detailed_results'], 1):
            if item.get('is_correct') is True:
                status = "✓ Correct"
                status_color = colors.green
            elif item.get('is_correct') is False:
                status = "✗ Incorrect"
                status_color = colors.red
            else:
                status = "⚠ Needs Review"
                status_color = colors.orange
            
            q_type = item.get('question_type', 'multiple_choice')
            type_label = " (Short Answer)" if q_type == 'short_answer' else ""
            
            story.append(Paragraph(
                f"<b>Question {idx}{type_label}</b> - <font color='{status_color.hexval()}'>{status}</font>", 
                styles['Heading3']
            ))
            story.append(Spacer(1, 6))
            
            story.append(Paragraph(f"<b>Q:</b> {item['question_text']}", styles['Normal']))
            story.append(Spacer(1, 6))
            
            if q_type == 'multiple_choice':
                user_display = f"{item.get('user_answer', 'N/A')}. {item.get('user_answer_text', 'Not answered')}"
                correct_display = f"{item.get('correct_answer', '')}. {item.get('correct_answer_text', '')}"
            else:
                user_display = item.get('user_answer_text', 'Not answered')
                correct_display = item.get('correct_answer_text', 'Instructor will review')
            
            if item.get('is_correct') is True:
                story.append(Paragraph(
                    f"<b>Your Answer:</b> <font color='green'>{user_display}</font>", 
                    styles['Normal']
                ))
            else:
                story.append(Paragraph(
                    f"<b>Your Answer:</b> <font color='red'>{user_display}</font>", 
                    styles['Normal']
                ))
                story.append(Spacer(1, 4))
                
                if item.get('is_correct') is False:
                    story.append(Paragraph(
                        f"<b>Correct Answer:</b> <font color='green'>{correct_display}</font>", 
                        styles['Normal']
                    ))
                elif item.get('is_correct') is None:
                    story.append(Paragraph(
                        f"<b>Expected Answer:</b> {correct_display}", 
                        styles['Normal']
                    ))
            
            story.append(Spacer(1, 16))
    else:
        story.append(Paragraph("No detailed results available.", styles['Normal']))
    
    doc.build(story)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes


# ==================== API ENDPOINTS ====================

@app.get("/")
async def root():
    return {
        "message": "NeuraNote Quiz API - Submission Fix",
        "status": "running",
        "ai_enabled": llm is not None
    }


@app.get("/health")
async def health():
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
    question_type: str = Form("mixed"),
    user_id: int = Form(1),
    note_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """Generate quiz"""
    
    if num_questions > 25:
        raise HTTPException(400, "Number of questions must not exceed 25")
    if num_questions < 1:
        raise HTTPException(400, "Number of questions must be at least 1")
    if time_limit < 1:
        raise HTTPException(400, "Time limit must be at least 1 minute")
    if time_limit > 180:
        raise HTTPException(400, "Time limit must not exceed 180 minutes")
    
    for file in files:
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        
        if file_size > 25 * 1024 * 1024:
            raise HTTPException(400, f"File {file.filename} exceeds 25MB limit")
    
    print(f"📝 Generating quiz: {num_questions} questions, {difficulty}, type: {question_type}")
    
    try:
        file_texts = []
        for file in files:
            text = extract_text_from_file(file)
            if text:
                file_texts.append(text)
        
        if not file_texts:
            raise HTTPException(400, "No text could be extracted")
        
        combined_text = " ".join(file_texts)
        
        try:
            if llm:
                chunks = chunk_text(combined_text)
                context = " ".join(chunks[:2])
                questions_data = generate_ai_questions(context, num_questions, difficulty, question_type)
            else:
                raise Exception("No LLM")
        except Exception as e:
            print(f"⚠️ AI failed: {e}, using mock")
            questions_data = generate_mock_questions(num_questions, difficulty, combined_text, question_type)
        
        questions_data = validate_questions(questions_data)
        if not questions_data:
            raise HTTPException(500, "No valid questions generated")
        
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
        
        for idx, q_data in enumerate(questions_data):
            question = models.Question(
                quiz_id=quiz.quiz_id,
                question_number=idx + 1,
                question_text=q_data['question_text'],
                code_snippet=q_data.get('code_snippet'),
                difficulty=q_data.get('difficulty', difficulty.capitalize()),
                question_type=q_data.get('question_type', 'multiple_choice')
            )
            db.add(question)
            db.flush()
            
            if q_data.get('question_type') == 'multiple_choice' and q_data.get('options'):
                for option_data in q_data['options']:
                    option = models.AnswerOption(
                        question_id=question.question_id,
                        option_letter=option_data['letter'],
                        option_text=option_data['text'],
                        is_correct=(option_data['letter'] == q_data['correct_answer'])
                    )
                    db.add(option)
            elif q_data.get('question_type') == 'short_answer':
                # Store expected answer
                option = models.AnswerOption(
                    question_id=question.question_id,
                    option_letter='SA_EXP',  # Shorter code
                    option_text=q_data['correct_answer'],
                    is_correct=True
                )
                db.add(option)
        
        db.commit()
        db.refresh(quiz)
        
        questions = db.query(models.Question).filter(
            models.Question.quiz_id == quiz.quiz_id
        ).all()
        
        print(f"✅ Quiz created (ID: {quiz.quiz_id})")
        
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
                    "question_type": q.question_type,
                    "options": [
                        {
                            "option_id": opt.option_id,
                            "option_letter": opt.option_letter,
                            "option_text": opt.option_text
                        }
                        for opt in q.options if not opt.option_letter.startswith('SA_')
                    ] if q.question_type == 'multiple_choice' else []
                }
                for q in questions
            ]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, str(e))


@app.post("/api/quizzes/{quiz_id}/submit")
async def submit_quiz(
    quiz_id: int,
    user_id: int = Form(...),
    answers: str = Form(...),
    time_taken: int = Form(...),
    db: Session = Depends(get_db)
):
    """Submit quiz - FIXED for short answers"""
    
    print(f"📤 Submitting quiz {quiz_id}")
    print(f"📝 Answers received: {answers[:200]}...")
    
    try:
        answers_dict = json.loads(answers)
        print(f"📊 Parsed {len(answers_dict)} answers")
        
        questions = db.query(models.Question).filter(
            models.Question.quiz_id == quiz_id
        ).all()
        
        if not questions:
            raise HTTPException(404, "Quiz not found")
        
        print(f"❓ Found {len(questions)} questions")
        
        correct_answers = 0
        detailed_results = []
        
        for idx, question in enumerate(questions):
            user_answer = answers_dict.get(str(idx))
            print(f"Q{idx+1} ({question.question_type}): user_answer = {user_answer}")
            
            try:
                if question.question_type == 'multiple_choice':
                    correct_option = db.query(models.AnswerOption).filter(
                        models.AnswerOption.question_id == question.question_id,
                        models.AnswerOption.is_correct == True
                    ).first()
                    
                    if not correct_option:
                        print(f"⚠️ No correct option found for question {question.question_id}")
                        continue
                    
                    is_correct = (user_answer == correct_option.option_letter) if user_answer else False
                    if is_correct:
                        correct_answers += 1
                    
                    user_option = db.query(models.AnswerOption).filter(
                        models.AnswerOption.question_id == question.question_id,
                        models.AnswerOption.option_letter == user_answer
                    ).first() if user_answer else None
                    
                    detailed_results.append({
                        "question_text": question.question_text,
                        "question_type": "multiple_choice",
                        "user_answer": user_answer or "N/A",
                        "user_answer_text": user_option.option_text if user_option else "Not answered",
                        "correct_answer": correct_option.option_letter,
                        "correct_answer_text": correct_option.option_text,
                        "is_correct": is_correct
                    })
                    
                elif question.question_type == 'short_answer':
                    # Get expected answer
                    expected_option = db.query(models.AnswerOption).filter(
                        models.AnswerOption.question_id == question.question_id,
                        models.AnswerOption.option_letter.like('SA_%')
                    ).first()
                    
                    expected_text = expected_option.option_text if expected_option else "Instructor will review"
                    user_answer_text = user_answer if user_answer else "Not answered"
                    
                    detailed_results.append({
                        "question_text": question.question_text,
                        "question_type": "short_answer",
                        "user_answer": user_answer or "",
                        "user_answer_text": user_answer_text,
                        "correct_answer": "Expected",
                        "correct_answer_text": expected_text,
                        "is_correct": None  # Needs manual review
                    })
                    print(f"✅ Short answer processed for Q{idx+1}")
                    
            except Exception as e:
                print(f"❌ Error processing question {idx+1}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        score_percentage = (correct_answers / len(questions)) * 100 if questions else 0
        
        print(f"💯 Score: {score_percentage}%, Correct: {correct_answers}/{len(questions)}")
        
        # Save attempt with detailed results
        attempt = models.QuizAttempt(
            quiz_id=quiz_id,
            user_id=user_id,
            score_percentage=score_percentage,
            correct_answers=correct_answers,
            total_questions=len(questions),
            time_taken=time_taken,
            answers_json=json.dumps(detailed_results)
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        
        print(f"✅ Quiz submitted successfully (Attempt ID: {attempt.attempt_id})")
        
        return {
            "attempt_id": attempt.attempt_id,
            "quiz_id": quiz_id,
            "score_percentage": score_percentage,
            "correct_answers": correct_answers,
            "total_questions": len(questions),
            "time_taken": time_taken,
            "detailed_results": detailed_results
        }
    
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
        raise HTTPException(400, f"Invalid answers format: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Submission error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Submission failed: {str(e)}")


@app.get("/api/quizzes/{quiz_id}/results/{attempt_id}/pdf")
async def download_results_pdf(
    quiz_id: int, 
    attempt_id: int,
    db: Session = Depends(get_db)
):
    """Download PDF"""
    
    try:
        attempt = db.query(models.QuizAttempt).filter(
            models.QuizAttempt.attempt_id == attempt_id,
            models.QuizAttempt.quiz_id == quiz_id
        ).first()
        
        if not attempt:
            raise HTTPException(404, "Quiz attempt not found")
        
        # Load detailed results from stored JSON
        detailed_results = []
        if hasattr(attempt, 'answers_json') and attempt.answers_json:
            try:
                detailed_results = json.loads(attempt.answers_json)
            except:
                pass
        
        results_data = {
            "score_percentage": attempt.score_percentage,
            "correct_answers": attempt.correct_answers,
            "total_questions": attempt.total_questions,
            "time_taken": attempt.time_taken,
            "detailed_results": detailed_results
        }
        
        pdf_bytes = generate_pdf_review(results_data)
        
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=quiz_results_{quiz_id}_{attempt_id}.pdf"
            }
        )
        
    except Exception as e:
        print(f"❌ PDF Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
