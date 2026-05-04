import json
import re
from typing import Optional

from openai import AsyncOpenAI

from config.config import settings


class AIService:
    """Service for AI-powered question generation via OpenRouter"""

    # Primary model
    MODEL = "google/gemini-3.1-flash-lite-preview"
    # Fallback model (if primary fails)
    FALLBACK_MODEL = "openai/gpt-oss-20b:free"

    def __init__(self) -> None:
        api_key = settings.OPENROUTER_API_KEY or settings.OPENAI_API_KEY

        if not api_key:
            raise ValueError(
                "OPENROUTER_API_KEY is not set. Add it to backend/.env"
            )

        # AsyncOpenAI pointed at OpenRouter
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            default_headers={
                # Use config value instead of hardcoded localhost
                "HTTP-Referer": settings.APP_NAME,
                "X-Title": settings.APP_NAME,
            },
        )

    async def generate_questions(
        self,
        text: str,
        num_questions: int,
        difficulty: str,
        question_type: str,
        content_focus: str = "both",
    ) -> list:
        """Generate quiz questions using OpenRouter

        Args:
            text: Extracted text from uploaded study materials
            num_questions: Number of questions to generate
            difficulty: One of 'easy', 'medium', 'hard'
            question_type: One of 'mcq', 'short_answer', 'mixed'
            content_focus: One of 'theoretical', 'practical', 'both'

        Returns:
            List of structured question dicts, or mock questions on failure
        """
        prompt = self._build_prompt(
            text, num_questions, difficulty, question_type, content_focus
        )

        try:
            response = await self.client.chat.completions.create(
                model=self.MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a quiz generator. "
                            "You ONLY respond with a valid JSON array. "
                            "No markdown, no explanation, no code fences — "
                            "just the raw JSON array."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=4096,
                temperature=settings.AI_TEMPERATURE,
            )

            raw = response.choices[0].message.content or ""
            questions = self._parse_response(raw, question_type)

            if not questions:
                raise ValueError("Empty or unparseable response from model")

            return questions[:num_questions]

        except Exception as primary_err:
            print(f"⚠️  Primary model ({self.MODEL}) failed: {primary_err}. Trying fallback...")
            try:
                response = await self.client.chat.completions.create(
                    model=self.FALLBACK_MODEL,
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You are a quiz generator. "
                                "You ONLY respond with a valid JSON array. "
                                "No markdown, no explanation, no code fences — "
                                "just the raw JSON array."
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                    max_tokens=4096,
                    temperature=settings.AI_TEMPERATURE,
                )
                raw = response.choices[0].message.content or ""
                questions = self._parse_response(raw, question_type)
                if questions:
                    print("✅ Fallback model succeeded")
                    return questions[:num_questions]
            except Exception as fallback_err:
                print(f"⚠️  Fallback model also failed: {fallback_err}")
            print("⚠️  Both models failed — returning mock questions")
            return self._generate_mock_questions(num_questions, difficulty, question_type)

    # Private helpers

    def _build_prompt(
        self,
        text: str,
        num_questions: int,
        difficulty: str,
        question_type: str,
        content_focus: str = "both",
    ) -> str:
        """Build the AI prompt from parameters"""

        if question_type == "mcq":
            type_instruction = "ALL questions must be multiple_choice type."
        elif question_type == "short_answer":
            type_instruction = "ALL questions must be short_answer type."
        else:
            type_instruction = "Mix of multiple_choice and short_answer questions."

        difficulty_desc = {
            "easy": "simple recall and basic concepts",
            "medium": "application and understanding",
            "hard": "analysis, synthesis and evaluation",
        }.get(difficulty, "application and understanding")

        focus_instruction = {
            "theoretical": (
                "FOCUS ONLY on theoretical questions — definitions, concepts, "
                "principles, explanations of how/why things work, and factual "
                "knowledge. Do NOT include practical application or code questions."
            ),
            "practical": (
                "FOCUS ONLY on practical questions — real-world applications, "
                "problem-solving, worked examples, calculations, and how to apply "
                "concepts in practice. Do NOT include pure theory recall questions."
            ),
            "both": (
                "Include a balanced MIX of both theoretical questions "
                "(concepts, definitions) and practical questions "
                "(applications, problem-solving). Aim for roughly equal split."
            ),
        }.get(content_focus, "")

        truncated = self._smart_truncate(text)
        return f"""Generate exactly {num_questions} {difficulty} level quiz questions based on the content below.

{type_instruction}
Content Focus: {focus_instruction}

Content:
{truncated}

Return ONLY a valid JSON array (no markdown, no explanation) with this exact structure:
[
  {{
    "number": 1,
    "text": "Question text here?",
    "type": "multiple_choice",
    "options": [
      {{"letter": "A", "text": "Option A text", "is_correct": false}},
      {{"letter": "B", "text": "Option B text", "is_correct": true}},
      {{"letter": "C", "text": "Option C text", "is_correct": false}},
      {{"letter": "D", "text": "Option D text", "is_correct": false}}
    ],
    "correct_answer": "B"
  }},
  {{
    "number": 2,
    "text": "Short answer question here?",
    "type": "short_answer",
    "options": [],
    "correct_answer": "Expected answer text"
  }}
]

Rules:
- For multiple_choice: always provide exactly 4 options (A, B, C, D), exactly one must have is_correct=true
- For short_answer: options array must be empty []
- Difficulty "{difficulty}": {difficulty_desc}
- Return ONLY the JSON array, nothing else
"""

    @staticmethod
    def _smart_truncate(text: str, limit: int = 6000) -> str:
        """Truncate at a sentence boundary to avoid cutting mid-word."""
        if len(text) <= limit:
            return text
        cut = text[:limit]
        last = max(cut.rfind('. '), cut.rfind('.\n'), cut.rfind('! '), cut.rfind('? '))
        if last > limit * 0.7:
            cut = cut[:last + 1]
        return cut + "\n[content truncated]"

    def _parse_response(self, response: str, question_type: str) -> Optional[list]:
        """Parse AI response into a structured question list

        Args:
            response: Raw string response from the model
            question_type: Enforced question type override

        Returns:
            List of question dicts, or None if parsing fails
        """
        try:
            cleaned = response.strip()
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
            cleaned = cleaned.strip()

            start = cleaned.find("[")
            end = cleaned.rfind("]") + 1
            if start == -1 or end == 0:
                print(f"❌ No JSON array found in response: {cleaned[:200]}")
                return None

            raw_questions = json.loads(cleaned[start:end])
            questions = []

            for i, q in enumerate(raw_questions):
                q_type = q.get("type", "multiple_choice")

                # Normalise unknown types
                if q_type not in ("multiple_choice", "short_answer"):
                    q_type = "multiple_choice"

                # Override if a specific type was requested
                if question_type == "mcq":
                    q_type = "multiple_choice"
                elif question_type == "short_answer":
                    q_type = "short_answer"

                parsed = {
                    "number": q.get("number", i + 1),
                    "text": q.get("text", q.get("question", f"Question {i + 1}")),
                    "type": q_type,
                    "code_snippet": q.get("code_snippet"),
                    "options": [],
                    "correct_answer": q.get("correct_answer", ""),
                }

                if q_type == "multiple_choice":
                    raw_options = q.get("options", [])
                    has_correct = any(o.get("is_correct") for o in raw_options)
                    options = []
                    for j, opt in enumerate(raw_options):
                        letter = opt.get("letter", chr(65 + j))
                        options.append({
                            "letter": letter,
                            "text": opt.get("text", f"Option {letter}"),
                            "is_correct": bool(opt.get("is_correct", False)),
                        })
                    # Safety: ensure at least one correct option is marked
                    if options and not has_correct:
                        options[0]["is_correct"] = True
                    parsed["options"] = options

                questions.append(parsed)

            return questions if questions else None

        except Exception as e:
            print(f"❌ Failed to parse AI response: {e}\nResponse snippet: {response[:300]}")
            return None

    def _generate_mock_questions(
        self,
        num_questions: int,
        difficulty: str,
        question_type: str,
    ) -> list:
        """Generate mock questions as fallback when AI is unavailable

        Args:
            num_questions: Number of questions to generate
            difficulty: Difficulty level label for question text
            question_type: Controls whether to generate MCQ, short answer, or mixed

        Returns:
            List of mock question dicts
        """
        sample_mcq = [
            {
                "text": f"Which of the following best describes a key concept in the uploaded material ({difficulty} level)?",
                "options": [
                    {"letter": "A", "text": "The first approach involves sequential processing", "is_correct": True},
                    {"letter": "B", "text": "The second approach relies on random sampling", "is_correct": False},
                    {"letter": "C", "text": "The third approach uses recursive algorithms", "is_correct": False},
                    {"letter": "D", "text": "The fourth approach applies parallel execution", "is_correct": False},
                ],
            },
            {
                "text": f"According to the material, which statement is correct ({difficulty} level)?",
                "options": [
                    {"letter": "A", "text": "All data must be pre-processed before analysis", "is_correct": False},
                    {"letter": "B", "text": "Validation is an optional step in most workflows", "is_correct": False},
                    {"letter": "C", "text": "Structured approaches improve consistency and accuracy", "is_correct": True},
                    {"letter": "D", "text": "Documentation is only needed at the final stage", "is_correct": False},
                ],
            },
        ]

        mock_questions = []
        for i in range(num_questions):
            use_short = (question_type == "short_answer") or (
                question_type == "mixed" and i % 3 == 2
            )

            if use_short:
                mock_questions.append({
                    "number": i + 1,
                    "text": f"Briefly explain one important concept from the uploaded material. ({difficulty} level, question {i + 1})",
                    "type": "short_answer",
                    "options": [],
                    "code_snippet": None,
                    "correct_answer": "Answer based on the study material provided.",
                })
            else:
                template = sample_mcq[i % len(sample_mcq)]
                mock_questions.append({
                    "number": i + 1,
                    "text": template["text"],
                    "type": "multiple_choice",
                    "options": template["options"],
                    "code_snippet": None,
                    "correct_answer": "A",
                })

        return mock_questions
