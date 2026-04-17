# backend/services/ai_service.py
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from config.config import settings
import json
import re

class AIService:
    """Service for AI-powered question generation"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model=settings.AI_MODEL,
            api_key=settings.OPENAI_API_KEY,
            temperature=settings.AI_TEMPERATURE
        )
    
    async def generate_questions(self, text, num_questions, difficulty, question_type):
        """Generate quiz questions using AI"""
        
        prompt = self._build_prompt(text, num_questions, difficulty, question_type)
        
        try:
            response = await self.llm.ainvoke(prompt)
            questions = self._parse_response(response.content, question_type)
            if not questions:
                raise ValueError("Empty parsed response")
            return questions[:num_questions]
        except Exception as e:
            print(f"⚠️ AI generation failed ({e}), using fallback mock questions")
            return self._generate_mock_questions(num_questions, difficulty, question_type)
    
    def _build_prompt(self, text, num_questions, difficulty, question_type):
        """Build AI prompt"""

        if question_type == 'mcq':
            type_instruction = "ALL questions must be multiple_choice type."
        elif question_type == 'short_answer':
            type_instruction = "ALL questions must be short_answer type."
        else:
            type_instruction = "Mix of multiple_choice and short_answer questions."

        return f"""Generate exactly {num_questions} {difficulty} level quiz questions based on the content below.

{type_instruction}

Content:
{text[:4000]}

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
- Difficulty "{difficulty}": {"simple recall and basic concepts" if difficulty == "easy" else "application and understanding" if difficulty == "medium" else "analysis, synthesis and evaluation"}
- Return ONLY the JSON array, nothing else
"""
    
    def _parse_response(self, response: str, question_type: str):
        """Parse AI response into structured question list"""
        try:
            # Strip markdown code fences if present
            cleaned = response.strip()
            cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
            cleaned = re.sub(r'\s*```$', '', cleaned)
            cleaned = cleaned.strip()

            # Find the JSON array
            start = cleaned.find('[')
            end = cleaned.rfind(']') + 1
            if start == -1 or end == 0:
                print(f"❌ No JSON array found in response: {cleaned[:200]}")
                return None

            json_str = cleaned[start:end]
            raw_questions = json.loads(json_str)

            questions = []
            for i, q in enumerate(raw_questions):
                q_type = q.get('type', 'multiple_choice')

                # Normalise type
                if q_type not in ('multiple_choice', 'short_answer'):
                    q_type = 'multiple_choice'

                # Override if forced
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
                    raw_options = q.get('options', [])
                    has_correct = any(o.get('is_correct') for o in raw_options)
                    options = []
                    for j, opt in enumerate(raw_options):
                        letter = opt.get('letter', chr(65 + j))
                        options.append({
                            'letter': letter,
                            'text': opt.get('text', f'Option {letter}'),
                            'is_correct': bool(opt.get('is_correct', False))
                        })
                    # Safety: if no correct answer marked, mark first as correct
                    if options and not has_correct:
                        options[0]['is_correct'] = True
                    parsed['options'] = options

                questions.append(parsed)

            return questions if questions else None

        except Exception as e:
            print(f"❌ Failed to parse AI response: {e}\nResponse snippet: {response[:300]}")
            return None

    def _generate_mock_questions(self, num_questions, difficulty, question_type):
        """Generate mock questions as fallback when AI is unavailable"""
        mock_questions = []
        
        sample_mcq = [
            {
                'text': f'Which of the following best describes a key concept in the uploaded material ({difficulty} level)?',
                'options': [
                    {'letter': 'A', 'text': 'The first approach involves sequential processing', 'is_correct': True},
                    {'letter': 'B', 'text': 'The second approach relies on random sampling', 'is_correct': False},
                    {'letter': 'C', 'text': 'The third approach uses recursive algorithms', 'is_correct': False},
                    {'letter': 'D', 'text': 'The fourth approach applies parallel execution', 'is_correct': False},
                ]
            },
            {
                'text': f'According to the material, which statement is correct ({difficulty} level)?',
                'options': [
                    {'letter': 'A', 'text': 'All data must be pre-processed before analysis', 'is_correct': False},
                    {'letter': 'B', 'text': 'Validation is an optional step in most workflows', 'is_correct': False},
                    {'letter': 'C', 'text': 'Structured approaches improve consistency and accuracy', 'is_correct': True},
                    {'letter': 'D', 'text': 'Documentation is only needed at the final stage', 'is_correct': False},
                ]
            },
        ]
        
        for i in range(num_questions):
            use_short = (question_type == 'short_answer') or (question_type == 'mixed' and i % 3 == 2)
            
            if use_short:
                mock_questions.append({
                    'number': i + 1,
                    'text': f'Briefly explain one important concept from the uploaded material. ({difficulty} level, question {i+1})',
                    'type': 'short_answer',
                    'options': [],
                    'code_snippet': None,
                    'correct_answer': 'Answer based on the study material provided.'
                })
            else:
                template = sample_mcq[i % len(sample_mcq)]
                mock_questions.append({
                    'number': i + 1,
                    'text': template['text'],
                    'type': 'multiple_choice',
                    'options': template['options'],
                    'code_snippet': None,
                    'correct_answer': 'A'
                })
        
        return mock_questions
