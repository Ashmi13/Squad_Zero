# backend/services/ai_service.py
from openai import AsyncOpenAI
from config.config import settings
import json
import re

# ── Token budget constants ────────────────────────────────────────────────────
_CHARS_PER_TOKEN = 4
_MAX_CONTENT_TOKENS = 3000
_MAX_CONTENT_CHARS = 6000  # trimmed from 12000 — enough context, faster processing
_TOKENS_PER_QUESTION = 200
_PROMPT_OVERHEAD_TOKENS = 500


def _smart_truncate(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars]
    last_period = max(cut.rfind('. '), cut.rfind('.\n'), cut.rfind('! '), cut.rfind('? '))
    if last_period > max_chars * 0.7:
        cut = cut[:last_period + 1]
    return cut + "\n\n[Content truncated for performance — key material above]"


class AIService:
    # Primary model — free tier on OpenRouter
    MODEL = "openai/gpt-oss-20b:free"
    # Fallback model if primary fails
    FALLBACK_MODEL = "meta-llama/llama-3.3-70b-instruct:free"

    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            api_key = getattr(settings, 'OPENROUTER_API_KEY', '') or ''
            if not api_key:
                raise ValueError("OPENROUTER_API_KEY is not set. Add it to backend/.env")
            self._client = AsyncOpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1",
                default_headers={
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "NeuraNote Quiz",
                }
            )
        return self._client

    async def generate_questions(self, text, num_questions, difficulty,
                                 question_type, content_focus='both'):
        truncated_text = _smart_truncate(text, _MAX_CONTENT_CHARS)
        prompt = self._build_prompt(truncated_text, num_questions, difficulty,
                                    question_type, content_focus)
        max_tokens = _PROMPT_OVERHEAD_TOKENS + (num_questions * _TOKENS_PER_QUESTION)

        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert quiz generator. "
                    "Respond with ONLY a valid JSON array. "
                    "Do not include any text before or after the JSON array. "
                    "Do not use markdown code blocks. "
                    "Start your response directly with [ and end with ]."
                )
            },
            {"role": "user", "content": prompt}
        ]

        # Try primary model (non-streaming for reliability)
        raw = await self._call_model(self.MODEL, messages, max_tokens)

        # If primary returned nothing useful, try fallback model
        if not raw or len(raw.strip()) < 10:
            print(f"⚠️  Primary model returned empty/short response, trying fallback model...")
            raw = await self._call_model(self.FALLBACK_MODEL, messages, max_tokens)

        if not raw or len(raw.strip()) < 10:
            print(f"❌ Both models returned empty responses, using mock questions")
            return self._generate_mock_questions(num_questions, difficulty, question_type)

        questions = self._parse_response(raw, question_type)
        if not questions:
            print(f"⚠️  Parse failed on primary, retrying fallback model...")
            raw2 = await self._call_model(self.FALLBACK_MODEL, messages, max_tokens)
            questions = self._parse_response(raw2, question_type) if raw2 else None

        if not questions:
            print(f"⚠️  All parse attempts failed, using mock questions")
            return self._generate_mock_questions(num_questions, difficulty, question_type)

        print(f"✅ Successfully generated {len(questions)} questions")
        return questions[:num_questions]

    async def _call_model(self, model: str, messages: list, max_tokens: int) -> str:
        """
        Call a model non-streaming first; if that fails, try streaming.
        Returns the raw text response or empty string on failure.
        """
        # ── Attempt 1: non-streaming ─────────────────────────────────────────
        try:
            print(f"📡 Calling model (non-streaming): {model}")
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.3,
                max_tokens=max_tokens,
                stream=False,
            )
            raw = response.choices[0].message.content or ""
            print(f"🔍 [{model}] Non-stream response ({len(raw)} chars): {raw[:200]}")
            if raw.strip():
                return raw
        except Exception as e:
            print(f"⚠️  [{model}] Non-streaming call failed: {e}")

        # ── Attempt 2: streaming fallback ────────────────────────────────────
        try:
            print(f"📡 Retrying model (streaming): {model}")
            stream = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.7,
                max_tokens=max_tokens,
                stream=True,
            )
            parts = []
            async for chunk in stream:
                if (chunk.choices
                        and chunk.choices[0].delta
                        and chunk.choices[0].delta.content):
                    parts.append(chunk.choices[0].delta.content)
            raw = "".join(parts)
            print(f"🔍 [{model}] Stream response ({len(raw)} chars): {raw[:200]}")
            return raw
        except Exception as e:
            print(f"❌ [{model}] Streaming call also failed: {e}")
            return ""

    def _build_prompt(self, text, num_questions, difficulty, question_type, content_focus='both'):
        type_map = {
            'mcq':          "ALL questions: multiple_choice.",
            'short_answer': "ALL questions: short_answer.",
        }
        type_instruction = type_map.get(question_type, "Mix of multiple_choice and short_answer.")

        diff_map = {
            "easy":   "simple recall",
            "medium": "application and understanding",
            "hard":   "analysis and critical evaluation",
        }
        focus_map = {
            "theoretical": "Theory only: definitions, concepts, principles.",
            "practical":   "Practical only: applications, problem-solving, examples.",
            "both":        "Mix of theoretical and practical.",
        }

        return f"""Generate exactly {num_questions} {difficulty} quiz questions from the content below.
{type_instruction} Focus: {focus_map.get(content_focus, "")} Difficulty: {diff_map.get(difficulty, "")}

Content: {text}

Output ONLY a JSON array, no markdown, no extra text. Schema:
multiple_choice: {{"number":N,"text":"...","type":"multiple_choice","options":[{{"letter":"A","text":"...","is_correct":false}},{{"letter":"B","text":"...","is_correct":true}},{{"letter":"C","text":"...","is_correct":false}},{{"letter":"D","text":"...","is_correct":false}}],"correct_answer":"B"}}
short_answer: {{"number":N,"text":"...","type":"short_answer","options":[],"correct_answer":"..."}}
Rules: MCQ=4 options A-D one is_correct=true. Output ONLY the JSON array."""

    def _parse_response(self, response: str, question_type: str):
        if not response:
            return None
        cleaned_json = None
        try:
            cleaned = response.strip()

            # Strip markdown fences
            cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
            cleaned = re.sub(r'\s*```$', '', cleaned).strip()

            # Strip any leading prose before the array
            start = cleaned.find('[')
            if start == -1:
                print(f"❌ No '[' found in response. Full response: {cleaned[:500]}")
                return None

            end = cleaned.rfind(']')
            if end == -1 or end <= start:
                print(f"⚠️  No closing ']' — attempting repair")
                json_fragment = cleaned[start:]
                repaired = self._repair_truncated_json(json_fragment)
                if repaired is None:
                    print(f"❌ Repair failed. Fragment: {json_fragment[:300]}")
                    return None
                cleaned_json = repaired
            else:
                cleaned_json = cleaned[start:end + 1]

            raw_questions = json.loads(cleaned_json)
            if not isinstance(raw_questions, list):
                print(f"❌ Parsed JSON is not a list: {type(raw_questions)}")
                return None

            questions = []
            for i, q in enumerate(raw_questions):
                q_type = q.get('type', 'multiple_choice')
                if q_type not in ('multiple_choice', 'short_answer'):
                    q_type = 'multiple_choice'
                if question_type == 'mcq':
                    q_type = 'multiple_choice'
                elif question_type == 'short_answer':
                    q_type = 'short_answer'

                parsed = {
                    'number': q.get('number', i + 1),
                    'text': q.get('text', q.get('question', f'Question {i+1}')),
                    'type': q_type,
                    'code_snippet': q.get('code_snippet'),
                    'options': [],
                    'correct_answer': q.get('correct_answer', '')
                }

                if q_type == 'multiple_choice':
                    raw_opts = q.get('options', [])
                    has_correct = any(o.get('is_correct') for o in raw_opts)
                    opts = []
                    for j, o in enumerate(raw_opts):
                        opts.append({
                            'letter': o.get('letter', chr(65 + j)),
                            'text': o.get('text', ''),
                            'is_correct': bool(o.get('is_correct', False))
                        })
                    if opts and not has_correct:
                        opts[0]['is_correct'] = True
                    parsed['options'] = opts

                questions.append(parsed)

            return questions if questions else None

        except json.JSONDecodeError as e:
            print(f"❌ JSON decode error: {e}")
            print(f"❌ Attempted to parse: {cleaned_json[:500] if cleaned_json else 'N/A'}")
            return None
        except Exception as e:
            print(f"❌ Parse exception: {e}")
            return None

    def _repair_truncated_json(self, fragment: str):
        """Try to recover a truncated JSON array by trimming to the last complete object."""
        last_complete = fragment.rfind('},')
        if last_complete == -1:
            last_complete = fragment.rfind('}')
        if last_complete == -1:
            return None
        trimmed = fragment[:last_complete + 1].rstrip(', \n\t')
        if not trimmed.startswith('['):
            return None
        candidate = trimmed + ']'
        try:
            json.loads(candidate)
            print(f"🔧 Repaired truncated JSON successfully")
            return candidate
        except json.JSONDecodeError:
            return None

    async def score_short_answer(self, question_text: str, expected_answer: str,
                                 user_answer: str) -> dict:
        if not user_answer or not user_answer.strip():
            return {"score": 0.0, "is_correct": False, "feedback": "No answer provided."}

        prompt = f"""You are grading a short answer question.

Question: {question_text}
Expected Answer: {expected_answer}
Student's Answer: {user_answer}

Score from 0 to 1:
- 1.0 = Fully correct
- 0.7 = Mostly correct
- 0.4 = Partially correct
- 0.0 = Incorrect

Respond ONLY with JSON: {{"score": 0.8, "feedback": "brief feedback here"}}"""

        for model in [self.MODEL, self.FALLBACK_MODEL]:
            try:
                response = await self.client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": "You are a fair academic grader. Respond with valid JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.3,
                    max_tokens=200,
                    stream=False,
                )
                raw = response.choices[0].message.content.strip()
                raw = re.sub(r'^```(?:json)?\s*', '', raw)
                raw = re.sub(r'\s*```$', '', raw).strip()
                result = json.loads(raw)
                score = float(result.get("score", 0))
                score = max(0.0, min(1.0, score))
                return {
                    "score": score,
                    "is_correct": score >= 0.5,
                    "feedback": result.get("feedback", "")
                }
            except Exception as e:
                print(f"⚠️  Short answer scoring failed with {model}: {e}")
                continue

        # keyword fallback
        user_words = set(user_answer.lower().split())
        expected_words = set(expected_answer.lower().split())
        stop_words = {'the','a','an','is','are','was','were','of','in','on',
                      'at','to','for','with','and','or','but'}
        keywords = expected_words - stop_words
        if not keywords:
            return {"score": 0.5, "is_correct": True, "feedback": "Answer accepted."}
        score = min(1.0, len(keywords & user_words) / len(keywords))
        return {
            "score": score,
            "is_correct": score >= 0.5,
            "feedback": f"Keyword match score: {int(score * 100)}%"
        }

    def _generate_mock_questions(self, num_questions, difficulty, question_type):
        sample_mcq = [
            {
                'text': f'Which best describes a key concept in the uploaded material ({difficulty})?',
                'options': [
                    {'letter': 'A', 'text': 'Sequential processing approach', 'is_correct': True},
                    {'letter': 'B', 'text': 'Random sampling approach', 'is_correct': False},
                    {'letter': 'C', 'text': 'Recursive algorithm approach', 'is_correct': False},
                    {'letter': 'D', 'text': 'Parallel execution approach', 'is_correct': False},
                ]
            },
            {
                'text': f'Which statement is correct according to the material ({difficulty})?',
                'options': [
                    {'letter': 'A', 'text': 'All data must be pre-processed first', 'is_correct': False},
                    {'letter': 'B', 'text': 'Validation is optional in most workflows', 'is_correct': False},
                    {'letter': 'C', 'text': 'Structured approaches improve consistency', 'is_correct': True},
                    {'letter': 'D', 'text': 'Documentation is only needed at the end', 'is_correct': False},
                ]
            },
        ]
        questions = []
        for i in range(num_questions):
            use_short = (question_type == 'short_answer') or \
                        (question_type == 'mixed' and i % 3 == 2)
            if use_short:
                questions.append({
                    'number': i + 1,
                    'text': f'Briefly explain one important concept from the material ({difficulty}).',
                    'type': 'short_answer',
                    'options': [],
                    'code_snippet': None,
                    'correct_answer': 'Based on the uploaded study material.'
                })
            else:
                t = sample_mcq[i % len(sample_mcq)]
                questions.append({
                    'number': i + 1,
                    'text': t['text'],
                    'type': 'multiple_choice',
                    'options': t['options'],
                    'code_snippet': None,
                    'correct_answer': 'A'
                })
        return questions
