# backend/services/ai_service.py
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from config.config import settings
import json
import re

class AIService:
    """Service for AI-powered question generation"""

    def __init__(self):
        # Lazy init — don't crash on import if OPENAI_API_KEY is missing.
        # LLM is only created when generate_questions() is actually called.
        self._llm = None

    @property
    def llm(self):
        """Create LLM on first use."""
        if self._llm is None:
            if not settings.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY is not set. Add it to backend/.env")
            self._llm = ChatOpenAI(
                model=settings.AI_MODEL,
                api_key=settings.OPENAI_API_KEY,
                temperature=settings.AI_TEMPERATURE,
            )
        return self._llm

    async def generate_questions(self, text, num_questions, difficulty, question_type):
        prompt = self._build_prompt(text, num_questions, difficulty, question_type)
        try:
            response = await self.llm.ainvoke(prompt)
            questions = self._parse_response(response.content, question_type)
            if not questions:
                raise ValueError("Empty parsed response")
            return questions[:num_questions]
        except Exception as e:
            print(f"⚠️  AI generation failed ({e}), using fallback mock questions")
            return self._generate_mock_questions(num_questions, difficulty, question_type)

    def _build_prompt(self, text, num_questions, difficulty, question_type):
        if question_type == 'mcq':
            type_instruction = "ALL questions must be multiple_choice type."
        elif question_type == 'short_answer':
            type_instruction = "ALL questions must be short_answer type."
        else:
            type_instruction = "Mix of multiple_choice and short_answer questions."

        diff_desc = {"easy": "simple recall and basic concepts",
                     "medium": "application and understanding",
                     "hard": "analysis, synthesis and evaluation"}.get(difficulty, "")

        return f"""Generate exactly {num_questions} {difficulty} level quiz questions based on the content below.
{type_instruction}
Content: {text[:4000]}

Return ONLY a valid JSON array (no markdown) like this:
[
  {{"number":1,"text":"Question?","type":"multiple_choice","options":[{{"letter":"A","text":"...","is_correct":false}},{{"letter":"B","text":"...","is_correct":true}},{{"letter":"C","text":"...","is_correct":false}},{{"letter":"D","text":"...","is_correct":false}}],"correct_answer":"B"}},
  {{"number":2,"text":"Question?","type":"short_answer","options":[],"correct_answer":"Expected answer"}}
]
Difficulty "{difficulty}": {diff_desc}. Return ONLY the JSON array."""

    def _parse_response(self, response: str, question_type: str):
        try:
            cleaned = re.sub(r'^```(?:json)?\s*', '', response.strip())
            cleaned = re.sub(r'\s*```$', '', cleaned).strip()
            start, end = cleaned.find('['), cleaned.rfind(']') + 1
            if start == -1 or end == 0:
                return None
            raw_questions = json.loads(cleaned[start:end])
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
                    opts = [{'letter': o.get('letter', chr(65+j)),
                             'text': o.get('text', ''),
                             'is_correct': bool(o.get('is_correct', False))}
                            for j, o in enumerate(raw_opts)]
                    if opts and not has_correct:
                        opts[0]['is_correct'] = True
                    parsed['options'] = opts
                questions.append(parsed)
            return questions or None
        except Exception as e:
            print(f"❌ Failed to parse AI response: {e}")
            return None

    def _generate_mock_questions(self, num_questions, difficulty, question_type):
        sample_mcq = [
            {'text': f'Which best describes a key concept in the material ({difficulty})?',
             'options': [{'letter':'A','text':'Sequential processing approach','is_correct':True},
                         {'letter':'B','text':'Random sampling approach','is_correct':False},
                         {'letter':'C','text':'Recursive algorithm approach','is_correct':False},
                         {'letter':'D','text':'Parallel execution approach','is_correct':False}]},
            {'text': f'Which statement is correct according to the material ({difficulty})?',
             'options': [{'letter':'A','text':'All data must be pre-processed','is_correct':False},
                         {'letter':'B','text':'Validation is optional','is_correct':False},
                         {'letter':'C','text':'Structured approaches improve consistency','is_correct':True},
                         {'letter':'D','text':'Documentation is only needed at the end','is_correct':False}]},
        ]
        questions = []
        for i in range(num_questions):
            use_short = (question_type == 'short_answer') or (question_type == 'mixed' and i % 3 == 2)
            if use_short:
                questions.append({'number': i+1,
                    'text': f'Briefly explain one important concept from the material ({difficulty}).',
                    'type': 'short_answer', 'options': [],
                    'code_snippet': None, 'correct_answer': 'Based on study material.'})
            else:
                t = sample_mcq[i % len(sample_mcq)]
                questions.append({'number': i+1, 'text': t['text'],
                    'type': 'multiple_choice', 'options': t['options'],
                    'code_snippet': None, 'correct_answer': 'C'})
        return questions
