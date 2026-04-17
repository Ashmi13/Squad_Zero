# backend/services/quiz_service.py
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List
from fastapi import UploadFile, HTTPException
import json
from models.quizmodels import Quiz, Question, AnswerOption, QuizAttempt
from services.ai_service import AIService
from utils.file_processor import FileProcessor

class QuizService:
    """Business logic for quiz operations"""
    
    def __init__(self, db: Session):
        self.db = db
        self.ai_service = AIService()
        self.file_processor = FileProcessor()
    
    async def generate_quiz(self, files, num_questions, difficulty, time_limit, 
                          question_type, user_id, note_id=None, source_content=None):
        """Generate a quiz from files or source content"""
        
        try:
            # Extract text from files or use source content
            if source_content:
                text = source_content
            else:
                text = await self.file_processor.process_files(files)
            
            # Generate questions using AI
            questions_data = await self.ai_service.generate_questions(
                text, num_questions, difficulty, question_type
            )
            
            # Create quiz in database
            quiz = Quiz(
                user_id=user_id,
                note_id=note_id,
                title=f"{difficulty.capitalize()} Quiz - {num_questions} Questions",
                description=f"AI-generated {difficulty} level quiz",
                total_questions=num_questions,
                time_limit=time_limit,  # stored in minutes
                difficulty=difficulty,
                source_content=text
            )
            self.db.add(quiz)
            self.db.commit()
            self.db.refresh(quiz)
            
            # Save questions and options
            saved_questions = []
            for q_data in questions_data:
                question = Question(
                    quiz_id=quiz.quiz_id,
                    question_number=q_data['number'],
                    question_text=q_data['text'],
                    difficulty=difficulty,
                    question_type=q_data['type'],
                    code_snippet=q_data.get('code_snippet')
                )
                self.db.add(question)
                self.db.commit()
                self.db.refresh(question)
                
                # Save options if MCQ — commit then refresh to get real option_ids
                options_list = []
                if q_data['type'] == 'multiple_choice':
                    saved_options = []
                    for opt in q_data['options']:
                        option = AnswerOption(
                            question_id=question.question_id,
                            option_letter=opt['letter'],
                            option_text=opt['text'],
                            is_correct=opt['is_correct']
                        )
                        self.db.add(option)
                        saved_options.append(option)
                    
                    self.db.commit()
                    # Refresh each to get the real DB-assigned option_id
                    for option in saved_options:
                        self.db.refresh(option)
                        options_list.append({
                            'option_id': option.option_id,
                            'option_letter': option.option_letter,
                            'option_text': option.option_text
                        })
                else:
                    self.db.commit()
                
                saved_questions.append({
                    'question_id': question.question_id,
                    'question_number': q_data['number'],
                    'question_text': q_data['text'],
                    'question_type': q_data['type'],
                    'difficulty': difficulty,
                    'code_snippet': q_data.get('code_snippet'),
                    'options': options_list if q_data['type'] == 'multiple_choice' else None
                })
            
            return {
                "quiz_id": quiz.quiz_id,
                "title": quiz.title,
                "description": quiz.description,
                "total_questions": quiz.total_questions,
                "time_limit": quiz.time_limit,  # minutes — frontend will multiply by 60
                "difficulty": quiz.difficulty,
                "questions": saved_questions,
                "source_content": text
            }
            
        except Exception as e:
            self.db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    async def submit_quiz(self, quiz_id, user_id, answers_json, time_taken):
        """Submit quiz and calculate score"""
        try:
            # Parse answers: { "0": "A", "1": "C", ... } (index → chosen letter/text)
            answers = json.loads(answers_json)

            # Load quiz + questions + options
            quiz = self.db.query(Quiz).filter(Quiz.quiz_id == quiz_id).first()
            if not quiz:
                raise HTTPException(status_code=404, detail="Quiz not found")

            questions = (
                self.db.query(Question)
                .filter(Question.quiz_id == quiz_id)
                .order_by(Question.question_number)
                .all()
            )

            correct_count = 0
            detailed_results = []

            for idx, question in enumerate(questions):
                user_answer = answers.get(str(idx))  # key is string index from frontend
                is_correct = None
                user_answer_text = ""
                correct_answer = None
                correct_answer_text = ""

                if question.question_type == 'multiple_choice':
                    options = (
                        self.db.query(AnswerOption)
                        .filter(AnswerOption.question_id == question.question_id)
                        .all()
                    )
                    correct_option = next((o for o in options if o.is_correct), None)
                    correct_answer = correct_option.option_letter if correct_option else ""
                    correct_answer_text = correct_option.option_text if correct_option else ""

                    # Find user's chosen option text
                    chosen_option = next((o for o in options if o.option_letter == user_answer), None)
                    user_answer_text = chosen_option.option_text if chosen_option else ""

                    if user_answer and user_answer == correct_answer:
                        is_correct = True
                        correct_count += 1
                    else:
                        is_correct = False

                else:
                    # Short answer — mark as needs-review (null)
                    user_answer_text = user_answer or ""
                    is_correct = None  # needs manual/AI review
                    # Still count unanswered short answers as incorrect for scoring
                    if not user_answer or user_answer.strip() == "":
                        is_correct = False
                    else:
                        # Give benefit of the doubt for short answers — they get credit
                        is_correct = None  # shown as "Needs Review"
                        correct_count += 0.5  # partial credit

                detailed_results.append({
                    "question_text": question.question_text,
                    "question_type": question.question_type,
                    "user_answer": user_answer,
                    "user_answer_text": user_answer_text,
                    "correct_answer": correct_answer,
                    "correct_answer_text": correct_answer_text,
                    "is_correct": is_correct
                })

            total_questions = len(questions)
            score_percentage = (correct_count / total_questions * 100) if total_questions > 0 else 0
            passed = score_percentage >= 50  # 50% threshold to unlock next level

            # Save attempt
            attempt = QuizAttempt(
                quiz_id=quiz_id,
                user_id=user_id,
                score_percentage=round(score_percentage, 2),
                correct_answers=int(correct_count),
                total_questions=total_questions,
                time_taken=time_taken,
                answers_json=answers_json
            )
            self.db.add(attempt)
            self.db.commit()
            self.db.refresh(attempt)

            # Determine level progression
            difficulty_order = ['easy', 'medium', 'hard']
            current_diff = quiz.difficulty.lower()
            current_idx = difficulty_order.index(current_diff) if current_diff in difficulty_order else 0
            can_progress = passed and current_idx < len(difficulty_order) - 1
            next_difficulty = difficulty_order[current_idx + 1] if can_progress else None

            return {
                "attempt_id": attempt.attempt_id,
                "quiz_id": quiz_id,
                "score_percentage": float(score_percentage),
                "correct_answers": int(correct_count),
                "total_questions": total_questions,
                "time_taken": time_taken,
                "passed": passed,
                "current_difficulty": current_diff,
                "can_progress": can_progress,
                "next_difficulty": next_difficulty,
                "source_content": quiz.source_content,
                "detailed_results": detailed_results
            }

        except HTTPException:
            raise
        except Exception as e:
            self.db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    async def get_history(self, user_id, limit, offset):
        """Get quiz history for a user"""
        try:
            total_count = (
                self.db.query(func.count(QuizAttempt.attempt_id))
                .filter(QuizAttempt.user_id == user_id)
                .scalar()
            )

            attempts = (
                self.db.query(QuizAttempt, Quiz)
                .join(Quiz, QuizAttempt.quiz_id == Quiz.quiz_id)
                .filter(QuizAttempt.user_id == user_id)
                .order_by(desc(QuizAttempt.attempt_date))
                .offset(offset)
                .limit(limit)
                .all()
            )

            history = []
            for attempt, quiz in attempts:
                history.append({
                    "attempt_id": attempt.attempt_id,
                    "quiz_id": quiz.quiz_id,
                    "quiz_title": quiz.title,
                    "quiz_description": quiz.description,
                    "difficulty": quiz.difficulty,
                    "score_percentage": float(attempt.score_percentage),
                    "correct_answers": attempt.correct_answers,
                    "total_questions": attempt.total_questions,
                    "time_taken": attempt.time_taken,
                    "attempt_date": attempt.attempt_date.isoformat(),
                    "passed": float(attempt.score_percentage) >= 70
                })

            return {
                "history": history,
                "total_count": total_count,
                "limit": limit,
                "offset": offset
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    async def get_analytics(self, user_id):
        """Get analytics for a user"""
        try:
            attempts = (
                self.db.query(QuizAttempt, Quiz)
                .join(Quiz, QuizAttempt.quiz_id == Quiz.quiz_id)
                .filter(QuizAttempt.user_id == user_id)
                .order_by(desc(QuizAttempt.attempt_date))
                .all()
            )

            if not attempts:
                return {
                    "total_attempts": 0,
                    "overall_stats": {
                        "average_score": 0,
                        "best_score": 0,
                        "pass_rate": 0
                    },
                    "by_difficulty": {},
                    "recent_trend": [],
                    "best_attempts": [],
                    "time_stats": {
                        "average_time": 0,
                        "fastest_time": 0,
                        "slowest_time": 0
                    }
                }

            scores = [float(a.score_percentage) for a, _ in attempts]
            times = [a.time_taken for a, _ in attempts if a.time_taken]

            # By difficulty
            by_difficulty = {}
            for attempt, quiz in attempts:
                diff = quiz.difficulty.lower()
                if diff not in by_difficulty:
                    by_difficulty[diff] = {"scores": [], "attempts": 0, "best_score": 0}
                by_difficulty[diff]["scores"].append(float(attempt.score_percentage))
                by_difficulty[diff]["attempts"] += 1

            by_difficulty_summary = {}
            for diff, data in by_difficulty.items():
                by_difficulty_summary[diff] = {
                    "attempts": data["attempts"],
                    "average_score": sum(data["scores"]) / len(data["scores"]),
                    "best_score": max(data["scores"])
                }

            # Recent trend (last 7)
            recent = attempts[:7]
            recent_trend = []
            for attempt, quiz in reversed(recent):
                recent_trend.append({
                    "score": float(attempt.score_percentage),
                    "difficulty": quiz.difficulty,
                    "date": attempt.attempt_date.isoformat()
                })

            # Best 5 attempts
            sorted_by_score = sorted(attempts, key=lambda x: float(x[0].score_percentage), reverse=True)
            best_attempts = []
            for attempt, quiz in sorted_by_score[:5]:
                best_attempts.append({
                    "quiz_title": quiz.title,
                    "difficulty": quiz.difficulty,
                    "score": float(attempt.score_percentage),
                    "date": attempt.attempt_date.isoformat()
                })

            passed_count = sum(1 for s in scores if s >= 70)

            return {
                "total_attempts": len(attempts),
                "overall_stats": {
                    "average_score": sum(scores) / len(scores),
                    "best_score": max(scores),
                    "pass_rate": (passed_count / len(scores)) * 100
                },
                "by_difficulty": by_difficulty_summary,
                "recent_trend": recent_trend,
                "best_attempts": best_attempts,
                "time_stats": {
                    "average_time": int(sum(times) / len(times)) if times else 0,
                    "fastest_time": min(times) if times else 0,
                    "slowest_time": max(times) if times else 0
                }
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    async def get_attempt_details(self, attempt_id, user_id):
        """Get detailed view of a specific attempt"""
        try:
            attempt = (
                self.db.query(QuizAttempt)
                .filter(QuizAttempt.attempt_id == attempt_id, QuizAttempt.user_id == user_id)
                .first()
            )
            if not attempt:
                raise HTTPException(status_code=404, detail="Attempt not found")

            quiz = self.db.query(Quiz).filter(Quiz.quiz_id == attempt.quiz_id).first()
            questions = (
                self.db.query(Question)
                .filter(Question.quiz_id == attempt.quiz_id)
                .order_by(Question.question_number)
                .all()
            )

            saved_answers = json.loads(attempt.answers_json) if attempt.answers_json else {}
            detailed_results = []

            for idx, question in enumerate(questions):
                user_answer = saved_answers.get(str(idx))
                is_correct = None
                user_answer_text = ""
                correct_answer = None
                correct_answer_text = ""

                if question.question_type == 'multiple_choice':
                    options = (
                        self.db.query(AnswerOption)
                        .filter(AnswerOption.question_id == question.question_id)
                        .all()
                    )
                    correct_option = next((o for o in options if o.is_correct), None)
                    correct_answer = correct_option.option_letter if correct_option else ""
                    correct_answer_text = correct_option.option_text if correct_option else ""
                    chosen_option = next((o for o in options if o.option_letter == user_answer), None)
                    user_answer_text = chosen_option.option_text if chosen_option else ""
                    is_correct = bool(user_answer and user_answer == correct_answer)
                else:
                    user_answer_text = user_answer or ""
                    is_correct = None if user_answer else False

                detailed_results.append({
                    "question_text": question.question_text,
                    "question_type": question.question_type,
                    "user_answer": user_answer,
                    "user_answer_text": user_answer_text,
                    "correct_answer": correct_answer,
                    "correct_answer_text": correct_answer_text,
                    "is_correct": is_correct
                })

            return {
                "attempt_id": attempt.attempt_id,
                "quiz_title": quiz.title,
                "quiz_description": quiz.description,
                "difficulty": quiz.difficulty,
                "score_percentage": float(attempt.score_percentage),
                "correct_answers": attempt.correct_answers,
                "total_questions": attempt.total_questions,
                "time_taken": attempt.time_taken,
                "attempt_date": attempt.attempt_date.isoformat(),
                "detailed_results": detailed_results
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    async def delete_attempt(self, attempt_id, user_id):
        """Delete a quiz attempt"""
        try:
            attempt = (
                self.db.query(QuizAttempt)
                .filter(QuizAttempt.attempt_id == attempt_id, QuizAttempt.user_id == user_id)
                .first()
            )
            if not attempt:
                raise HTTPException(status_code=404, detail="Attempt not found")

            self.db.delete(attempt)
            self.db.commit()
            return {"message": "Attempt deleted successfully"}

        except HTTPException:
            raise
        except Exception as e:
            self.db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
