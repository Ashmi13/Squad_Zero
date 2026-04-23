import json
from collections import defaultdict

from fastapi import HTTPException, UploadFile
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from config.config import PASS_THRESHOLD
from models.quizmodels import AnswerOption, Question, Quiz, QuizAttempt
from services.ai_service import AIService
from utils.file_processor import FileProcessor


def _keyword_match_score(user_text: str, expected_text: str) -> float:
    """Return fraction of expected keywords found in user answer (0.0 – 1.0).

    Algorithm:
    - Tokenise both strings into lowercase alphabetic words ≥ 3 chars
      (strips noise like 'a', 'is', 'of', 'the')
    - Score = |expected_keywords ∩ user_keywords| / |expected_keywords|
    - Returns 0.0 if expected_text is empty or has no qualifying keywords
    """
    import re
    _STOPWORDS = {
        "the","and","for","are","but","not","you","all","can","her","was",
        "one","our","out","day","get","has","him","his","how","its","who",
        "did","let","put","say","she","too","use","with","that","this",
        "have","from","they","will","been","more","when","your","each",
        "than","then","into","some","also","just","over","such","even",
    }
    def keywords(text):
        tokens = re.findall(r"[a-z]+", text.lower())
        return {t for t in tokens if len(t) >= 3 and t not in _STOPWORDS}

    expected_kw = keywords(expected_text)
    if not expected_kw:
        return 1.0   # no measurable keywords → give benefit of the doubt
    user_kw = keywords(user_text)
    return len(expected_kw & user_kw) / len(expected_kw)


class QuizService:
    """Business logic for quiz operations"""

    def __init__(self, db: Session):
        self.db = db
        self._ai_service = None          # lazy — only created when generate_quiz is called
        self.file_processor = FileProcessor()

    @property
    def ai_service(self) -> AIService:
        """Lazy-load AIService so missing API key only fails on generate, not on history/analytics."""
        if self._ai_service is None:
            self._ai_service = AIService()
        return self._ai_service

    # Public API

    async def generate_quiz(
        self,
        files,
        num_questions: int,
        difficulty: str,
        time_limit: int,
        question_type: str,
        user_id: int,
        note_id: int = None,
        source_content: str = None,
        content_focus: str = "both",
    ):
        """Generate a quiz from uploaded files or existing source content"""
        try:
            text = source_content or await self.file_processor.process_files(files)

            questions_data = await self.ai_service.generate_questions(
                text, num_questions, difficulty, question_type, content_focus
            )

            # Persist quiz
            quiz = Quiz(
                user_id=user_id,
                note_id=note_id,
                title=f"{difficulty.capitalize()} Quiz - {num_questions} Questions",
                description=f"AI-generated {difficulty} level quiz",
                total_questions=num_questions,
                time_limit=time_limit,
                difficulty=difficulty,
                source_content=text,
            )
            self.db.add(quiz)
            self.db.flush()  # get quiz.quiz_id without committing

            saved_questions = []

            for q_data in questions_data:
                question = Question(
                    quiz_id=quiz.quiz_id,
                    question_number=q_data["number"],
                    question_text=q_data["text"],
                    difficulty=difficulty,
                    question_type=q_data["type"],
                    code_snippet=q_data.get("code_snippet"),
                    expected_answer=q_data.get("correct_answer") if q_data["type"] == "short_answer" else None,
                )
                self.db.add(question)
                self.db.flush()  # get question.question_id

                options_list = []
                if q_data["type"] == "multiple_choice":
                    for opt in q_data["options"]:
                        self.db.add(AnswerOption(
                            question_id=question.question_id,
                            option_letter=opt["letter"],
                            option_text=opt["text"],
                            is_correct=opt["is_correct"],
                        ))
                    # Flush to make options queryable
                    # (avoids a second SELECT — data is already in memory)
                    options_list = [
                        {
                            "option_letter": opt["letter"],
                            "option_text": opt["text"],
                        }
                        for opt in q_data["options"]
                    ]

                saved_questions.append({
                    "question_id": question.question_id,
                    "question_number": q_data["number"],
                    "question_text": q_data["text"],
                    "question_type": q_data["type"],
                    "difficulty": difficulty,
                    "code_snippet": q_data.get("code_snippet"),
                    "options": options_list if q_data["type"] == "multiple_choice" else None,
                })

            self.db.commit()  # single commit for the entire quiz
            self.db.refresh(quiz)

            return {
                "quiz_id": quiz.quiz_id,
                "title": quiz.title,
                "description": quiz.description,
                "total_questions": quiz.total_questions,
                "time_limit": quiz.time_limit,
                "difficulty": quiz.difficulty,
                "questions": saved_questions,
                "source_content": text,
            }

        except HTTPException:
            raise
        except Exception as e:
            self.db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    async def submit_quiz(
        self, quiz_id: int, user_id: int, answers_json: str | dict, time_taken: int
    ):
        """Submit quiz answers and calculate score"""
        try:
            # answers_json may arrive as a string (form field) or already parsed (JSON body)
            answers = answers_json if isinstance(answers_json, dict) else json.loads(answers_json)

            quiz = self.db.query(Quiz).filter(Quiz.quiz_id == quiz_id).first()
            if not quiz:
                raise HTTPException(status_code=404, detail="Quiz not found")

            questions = (
                self.db.query(Question)
                .filter(Question.quiz_id == quiz_id)
                .order_by(Question.question_number)
                .all()
            )

            # Load all options in ONE query
            options_by_question = self._load_options_by_question(questions)

            correct_count = 0
            detailed_results = self._build_detailed_results(
                questions, options_by_question, answers, count_ref=[]
            )
            # Recalculate correct_count from results (binary — no partial credit)
            for r in detailed_results:
                if r["is_correct"] is True:
                    correct_count += 1

            total_questions = len(questions)
            score_percentage = (correct_count / total_questions * 100) if total_questions > 0 else 0
            passed = score_percentage >= PASS_THRESHOLD

            attempt = QuizAttempt(
                quiz_id=quiz_id,
                user_id=user_id,
                score_percentage=round(score_percentage, 2),
                correct_answers=int(correct_count),
                total_questions=total_questions,
                time_taken=time_taken,
                answers_json=json.dumps(answers),   # TEXT column — must serialise
            )
            self.db.add(attempt)
            self.db.commit()
            self.db.refresh(attempt)

            difficulty_order = ["easy", "medium", "hard"]
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
                "detailed_results": detailed_results,
            }

        except HTTPException:
            raise
        except Exception as e:
            self.db.rollback()
            import traceback
            print(f"❌ submit_quiz error: {e}\n{traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_history(self, user_id: int, limit: int, offset: int):
        """Get paginated quiz history for a user"""
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

            history = [
                {
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
                    "passed": float(attempt.score_percentage) >= PASS_THRESHOLD,
                }
                for attempt, quiz in attempts
            ]

            return {
                "history": history,
                "total_count": total_count,
                "limit": limit,
                "offset": offset,
                "has_more": (offset + limit) < total_count,
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    async def get_analytics(self, user_id: int):
        """Get quiz analytics for a user"""
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
                    "overall_stats": {"average_score": 0, "best_score": 0, "pass_rate": 0},
                    "by_difficulty": {},
                    "recent_trend": [],
                    "best_attempts": [],
                    "time_stats": {"average_time": 0, "fastest_time": 0, "slowest_time": 0},
                }

            scores = [float(a.score_percentage) for a, _ in attempts]
            times  = [a.time_taken for a, _ in attempts if a.time_taken]

            # Aggregate by difficulty
            by_difficulty: dict = {}
            for attempt, quiz in attempts:
                diff = quiz.difficulty.lower()
                bucket = by_difficulty.setdefault(diff, {"scores": [], "attempts": 0})
                bucket["scores"].append(float(attempt.score_percentage))
                bucket["attempts"] += 1

            by_difficulty_summary = {
                diff: {
                    "attempts": data["attempts"],
                    "average_score": sum(data["scores"]) / len(data["scores"]),
                    "best_score": max(data["scores"]),
                }
                for diff, data in by_difficulty.items()
            }

            recent_trend = [
                {
                    "score": float(attempt.score_percentage),
                    "difficulty": quiz.difficulty,
                    "date": attempt.attempt_date.isoformat(),
                }
                for attempt, quiz in reversed(attempts[:7])
            ]

            best_attempts = [
                {
                    "quiz_title": quiz.title,
                    "difficulty": quiz.difficulty,
                    "score": float(attempt.score_percentage),
                    "date": attempt.attempt_date.isoformat(),
                }
                for attempt, quiz in sorted(
                    attempts, key=lambda x: float(x[0].score_percentage), reverse=True
                )[:5]
            ]

            passed_count = sum(1 for s in scores if s >= PASS_THRESHOLD)

            return {
                "total_attempts": len(attempts),
                "overall_stats": {
                    "average_score": sum(scores) / len(scores),
                    "best_score": max(scores),
                    "pass_rate": (passed_count / len(scores)) * 100,
                },
                "by_difficulty": by_difficulty_summary,
                "recent_trend": recent_trend,
                "best_attempts": best_attempts,
                "time_stats": {
                    "average_time": int(sum(times) / len(times)) if times else 0,
                    "fastest_time": min(times) if times else 0,
                    "slowest_time": max(times) if times else 0,
                },
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    async def get_attempt_details(self, attempt_id: int, user_id: int):
        """Get detailed view of a specific quiz attempt"""
        try:
            attempt = (
                self.db.query(QuizAttempt)
                .filter(
                    QuizAttempt.attempt_id == attempt_id,
                    QuizAttempt.user_id == user_id,
                )
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

            # answers_json is TEXT — parse from JSON string
            saved_answers = json.loads(attempt.answers_json) if attempt.answers_json else {}

            # Load all options in ONE query
            options_by_question = self._load_options_by_question(questions)

            # Reuse shared scoring helper
            detailed_results = self._build_detailed_results(
                questions, options_by_question, saved_answers
            )

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
                "detailed_results": detailed_results,
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    async def delete_attempt(self, attempt_id: int, user_id: int):
        """Delete a quiz attempt — user_id verified against DB record"""
        try:
            attempt = (
                self.db.query(QuizAttempt)
                .filter(
                    QuizAttempt.attempt_id == attempt_id,
                    QuizAttempt.user_id == user_id,
                )
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

    # Private helper

    def _load_options_by_question(self, questions: list) -> dict:
        """Load all AnswerOptions for a list of questions in ONE query.

        Returns:
            dict mapping question_id → list of AnswerOption objects
        """
        if not questions:
            return {}
        question_ids = [q.question_id for q in questions]
        all_options = (
            self.db.query(AnswerOption)
            .filter(AnswerOption.question_id.in_(question_ids))
            .all()
        )
        mapping: dict = defaultdict(list)
        for opt in all_options:
            mapping[opt.question_id].append(opt)
        return mapping

    def _build_detailed_results(
        self,
        questions: list,
        options_by_question: dict,
        answers: dict,
        count_ref: list | None = None,
    ) -> list:
        """Build per-question result dicts shared by submit_quiz and get_attempt_details.

        Args:
            questions: Ordered list of Question ORM objects
            options_by_question: Dict from _load_options_by_question
            answers: Dict of {str(idx): answer_value}
            count_ref: Optional list; if provided, appends (correct_count) for caller

        Returns:
            List of detailed result dicts
        """
        results = []
        correct_count = 0.0

        for idx, question in enumerate(questions):
            user_answer = answers.get(str(idx))
            is_correct: bool | None = None
            user_answer_text = ""
            correct_answer = None
            correct_answer_text = ""
            partial_credit = False

            if question.question_type == "multiple_choice":
                options = options_by_question.get(question.question_id, [])
                correct_option = next((o for o in options if o.is_correct), None)
                correct_answer      = correct_option.option_letter if correct_option else ""
                correct_answer_text = correct_option.option_text   if correct_option else ""
                chosen_option = next((o for o in options if o.option_letter == user_answer), None)
                user_answer_text = chosen_option.option_text if chosen_option else ""
                is_correct = bool(user_answer and user_answer == correct_answer)
                if is_correct:
                    correct_count += 1

            else:
                # Short answer: keyword match against AI's expected answer
                user_answer_text = user_answer or ""
                expected = getattr(question, "expected_answer", None) or ""
                if not user_answer or not user_answer.strip():
                    is_correct = False
                    correct_answer_text = expected
                else:
                    match_score = _keyword_match_score(user_answer_text, expected)
                    is_correct = match_score >= 0.5
                    correct_answer_text = expected
                    if is_correct:
                        correct_count += 1
                    # partial_credit stays False

            results.append({
                "question_text":      question.question_text,
                "question_type":      question.question_type,
                "user_answer":        user_answer,
                "user_answer_text":   user_answer_text,
                "correct_answer":     correct_answer,
                "correct_answer_text": correct_answer_text,
                "is_correct":         is_correct,
                "partial_credit":     partial_credit,
            })

        if count_ref is not None:
            count_ref.append(correct_count)

        return results
