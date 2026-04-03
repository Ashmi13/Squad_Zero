# backend/services/quiz_service.py
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from fastapi import HTTPException
import json
from models.quizmodels import Quiz, Question, AnswerOption, QuizAttempt
from services.ai_service import AIService
from utils.file_processor import FileProcessor


class QuizService:
    """Business logic for quiz operations"""

    def __init__(self, db: Session):
        self.db = db
        # AIService is lazy — it won't touch OPENAI_API_KEY until generate_quiz is called
        self._ai_service = None
        self.file_processor = FileProcessor()

    @property
    def ai_service(self):
        if self._ai_service is None:
            self._ai_service = AIService()
        return self._ai_service

    # ── Generate ──────────────────────────────────────────────────────────────

    async def generate_quiz(self, files, num_questions, difficulty, time_limit,
                            question_type, user_id, note_id=None, source_content=None):
        try:
            text = source_content if source_content else await self.file_processor.process_files(files)

            questions_data = await self.ai_service.generate_questions(
                text, num_questions, difficulty, question_type)

            quiz = Quiz(
                user_id=user_id, note_id=note_id,
                title=f"{difficulty.capitalize()} Quiz - {num_questions} Questions",
                description=f"AI-generated {difficulty} level quiz",
                total_questions=num_questions, time_limit=time_limit,
                difficulty=difficulty, source_content=text)
            self.db.add(quiz)
            self.db.commit()
            self.db.refresh(quiz)

            saved_questions = []
            for q_data in questions_data:
                question = Question(
                    quiz_id=quiz.quiz_id,
                    question_number=q_data['number'],
                    question_text=q_data['text'],
                    difficulty=difficulty,
                    question_type=q_data['type'],
                    code_snippet=q_data.get('code_snippet'))
                self.db.add(question)
                self.db.commit()
                self.db.refresh(question)

                options_list = []
                if q_data['type'] == 'multiple_choice':
                    saved_opts = []
                    for opt in q_data['options']:
                        o = AnswerOption(
                            question_id=question.question_id,
                            option_letter=opt['letter'],
                            option_text=opt['text'],
                            is_correct=opt['is_correct'])
                        self.db.add(o)
                        saved_opts.append(o)
                    self.db.commit()
                    for o in saved_opts:
                        self.db.refresh(o)
                        options_list.append({
                            'option_id': o.option_id,
                            'option_letter': o.option_letter,
                            'option_text': o.option_text})
                else:
                    self.db.commit()

                saved_questions.append({
                    'question_id': question.question_id,
                    'question_number': q_data['number'],
                    'question_text': q_data['text'],
                    'question_type': q_data['type'],
                    'difficulty': difficulty,
                    'code_snippet': q_data.get('code_snippet'),
                    'options': options_list if q_data['type'] == 'multiple_choice' else None})

            return {
                "quiz_id": quiz.quiz_id, "title": quiz.title,
                "description": quiz.description,
                "total_questions": quiz.total_questions,
                "time_limit": quiz.time_limit,   # minutes — frontend multiplies by 60
                "difficulty": quiz.difficulty,
                "questions": saved_questions,
                "source_content": text}

        except Exception as e:
            self.db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    # ── Submit ────────────────────────────────────────────────────────────────

    async def submit_quiz(self, quiz_id, user_id, answers_json, time_taken):
        try:
            answers = json.loads(answers_json)

            quiz = self.db.query(Quiz).filter(Quiz.quiz_id == quiz_id).first()
            if not quiz:
                raise HTTPException(status_code=404, detail="Quiz not found")

            questions = (self.db.query(Question)
                         .filter(Question.quiz_id == quiz_id)
                         .order_by(Question.question_number).all())

            correct_count = 0
            detailed_results = []

            for idx, question in enumerate(questions):
                user_answer = answers.get(str(idx))
                is_correct = None
                user_answer_text = ""
                correct_answer = None
                correct_answer_text = ""

                if question.question_type == 'multiple_choice':
                    options = (self.db.query(AnswerOption)
                               .filter(AnswerOption.question_id == question.question_id).all())
                    correct_opt = next((o for o in options if o.is_correct), None)
                    correct_answer = correct_opt.option_letter if correct_opt else ""
                    correct_answer_text = correct_opt.option_text if correct_opt else ""
                    chosen = next((o for o in options if o.option_letter == user_answer), None)
                    user_answer_text = chosen.option_text if chosen else ""
                    if user_answer and user_answer == correct_answer:
                        is_correct = True
                        correct_count += 1
                    else:
                        is_correct = False
                else:
                    user_answer_text = user_answer or ""
                    if not user_answer or user_answer.strip() == "":
                        is_correct = False
                    else:
                        is_correct = None   # short answer: needs review
                        correct_count += 0.5

                detailed_results.append({
                    "question_text": question.question_text,
                    "question_type": question.question_type,
                    "user_answer": user_answer,
                    "user_answer_text": user_answer_text,
                    "correct_answer": correct_answer,
                    "correct_answer_text": correct_answer_text,
                    "is_correct": is_correct})

            total = len(questions)
            score_pct = (correct_count / total * 100) if total > 0 else 0
            passed = score_pct >= 50

            attempt = QuizAttempt(
                quiz_id=quiz_id, user_id=user_id,
                score_percentage=round(score_pct, 2),
                correct_answers=int(correct_count),
                total_questions=total,
                time_taken=time_taken,
                answers_json=answers_json)
            self.db.add(attempt)
            self.db.commit()
            self.db.refresh(attempt)

            diff_order = ['easy', 'medium', 'hard']
            cur = quiz.difficulty.lower()
            cur_idx = diff_order.index(cur) if cur in diff_order else 0
            can_progress = passed and cur_idx < len(diff_order) - 1
            next_diff = diff_order[cur_idx + 1] if can_progress else None

            return {
                "attempt_id": attempt.attempt_id,
                "quiz_id": quiz_id,
                "score_percentage": float(score_pct),
                "correct_answers": int(correct_count),
                "total_questions": total,
                "time_taken": time_taken,
                "passed": passed,
                "current_difficulty": cur,
                "can_progress": can_progress,
                "next_difficulty": next_diff,
                "source_content": quiz.source_content,
                "detailed_results": detailed_results}

        except HTTPException:
            raise
        except Exception as e:
            self.db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    # ── History ───────────────────────────────────────────────────────────────

    async def get_history(self, user_id, limit, offset):
        try:
            total_count = (self.db.query(func.count(QuizAttempt.attempt_id))
                           .filter(QuizAttempt.user_id == user_id).scalar())

            rows = (self.db.query(QuizAttempt, Quiz)
                    .join(Quiz, QuizAttempt.quiz_id == Quiz.quiz_id)
                    .filter(QuizAttempt.user_id == user_id)
                    .order_by(desc(QuizAttempt.attempt_date))
                    .offset(offset).limit(limit).all())

            history = [{
                "attempt_id": a.attempt_id,
                "quiz_id": q.quiz_id,
                "quiz_title": q.title,
                "quiz_description": q.description,
                "difficulty": q.difficulty,
                "score_percentage": float(a.score_percentage),
                "correct_answers": a.correct_answers,
                "total_questions": a.total_questions,
                "time_taken": a.time_taken,
                "attempt_date": a.attempt_date.isoformat(),
                "passed": float(a.score_percentage) >= 50
            } for a, q in rows]

            return {"history": history, "total_count": total_count,
                    "limit": limit, "offset": offset}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ── Analytics ─────────────────────────────────────────────────────────────

    async def get_analytics(self, user_id):
        try:
            rows = (self.db.query(QuizAttempt, Quiz)
                    .join(Quiz, QuizAttempt.quiz_id == Quiz.quiz_id)
                    .filter(QuizAttempt.user_id == user_id)
                    .order_by(desc(QuizAttempt.attempt_date)).all())

            if not rows:
                return {"total_attempts": 0,
                        "overall_stats": {"average_score": 0, "best_score": 0, "pass_rate": 0},
                        "by_difficulty": {}, "recent_trend": [],
                        "best_attempts": [],
                        "time_stats": {"average_time": 0, "fastest_time": 0, "slowest_time": 0}}

            scores = [float(a.score_percentage) for a, _ in rows]
            times  = [a.time_taken for a, _ in rows if a.time_taken]

            by_diff = {}
            for a, q in rows:
                d = q.difficulty.lower()
                by_diff.setdefault(d, []).append(float(a.score_percentage))

            by_diff_summary = {
                d: {"attempts": len(s), "average_score": sum(s)/len(s), "best_score": max(s)}
                for d, s in by_diff.items()}

            recent_trend = [{"score": float(a.score_percentage),
                             "difficulty": q.difficulty,
                             "date": a.attempt_date.isoformat()}
                            for a, q in reversed(rows[:7])]

            best = sorted(rows, key=lambda x: float(x[0].score_percentage), reverse=True)
            best_attempts = [{"quiz_title": q.title, "difficulty": q.difficulty,
                              "score": float(a.score_percentage),
                              "date": a.attempt_date.isoformat()}
                             for a, q in best[:5]]

            passed_count = sum(1 for s in scores if s >= 50)
            return {
                "total_attempts": len(rows),
                "overall_stats": {"average_score": sum(scores)/len(scores),
                                  "best_score": max(scores),
                                  "pass_rate": (passed_count/len(scores))*100},
                "by_difficulty": by_diff_summary,
                "recent_trend": recent_trend,
                "best_attempts": best_attempts,
                "time_stats": {"average_time": int(sum(times)/len(times)) if times else 0,
                               "fastest_time": min(times) if times else 0,
                               "slowest_time": max(times) if times else 0}}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ── Attempt details ───────────────────────────────────────────────────────

    async def get_attempt_details(self, attempt_id, user_id):
        try:
            attempt = (self.db.query(QuizAttempt)
                       .filter(QuizAttempt.attempt_id == attempt_id,
                               QuizAttempt.user_id == user_id).first())
            if not attempt:
                raise HTTPException(status_code=404, detail="Attempt not found")

            quiz = self.db.query(Quiz).filter(Quiz.quiz_id == attempt.quiz_id).first()
            questions = (self.db.query(Question)
                         .filter(Question.quiz_id == attempt.quiz_id)
                         .order_by(Question.question_number).all())

            saved_answers = json.loads(attempt.answers_json) if attempt.answers_json else {}
            detailed_results = []

            for idx, question in enumerate(questions):
                user_answer = saved_answers.get(str(idx))
                is_correct, user_answer_text = None, ""
                correct_answer, correct_answer_text = None, ""

                if question.question_type == 'multiple_choice':
                    options = (self.db.query(AnswerOption)
                               .filter(AnswerOption.question_id == question.question_id).all())
                    correct_opt = next((o for o in options if o.is_correct), None)
                    correct_answer = correct_opt.option_letter if correct_opt else ""
                    correct_answer_text = correct_opt.option_text if correct_opt else ""
                    chosen = next((o for o in options if o.option_letter == user_answer), None)
                    user_answer_text = chosen.option_text if chosen else ""
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
                    "is_correct": is_correct})

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
                "detailed_results": detailed_results}

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ── Delete attempt ────────────────────────────────────────────────────────

    async def delete_attempt(self, attempt_id, user_id):
        try:
            attempt = (self.db.query(QuizAttempt)
                       .filter(QuizAttempt.attempt_id == attempt_id,
                               QuizAttempt.user_id == user_id).first())
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
