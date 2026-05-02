"""
Flashcard Routes - AI-powered flashcard generation from PDF text.
Falls back to a local NLP-style extractor when the AI API is unavailable.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from typing import List
import logging
import json
import re
import os

from app.services.pdf_reader import extract_text_from_pdf, validate_pdf
from app.api.deps import get_current_user_id

router = APIRouter(tags=["flashcards"])
logger = logging.getLogger(__name__)

from app.services.openai_service import OPENROUTER_PRIMARY_MODEL, OPENROUTER_FALLBACK_MODEL


# ──────────────────────────────────────────────
# Pydantic models
# ──────────────────────────────────────────────

class Flashcard(BaseModel):
    question: str
    answer: str


class FlashcardsResponse(BaseModel):
    status: str
    flashcards: List[Flashcard]


# ──────────────────────────────────────────────
# Local fallback flashcard generator
# ──────────────────────────────────────────────

def _clean_sentence(s: str) -> str:
    return re.sub(r'\s+', ' ', s).strip()


def _generate_local_flashcards(text: str, target: int = 12) -> List[Flashcard]:
    """
    Generate flashcards from text without AI using heuristic extraction.
    Looks for:
    1. Definition patterns  (X is/are Y, X refers to Y, X means Y)
    2. Key-term bold/caps phrases with explanatory sentences
    3. Numbered or bulleted list items
    4. Important factual sentences
    """
    cards: List[Flashcard] = []
    seen_questions: set = set()

    # ── 1. Definition patterns ─────────────────────────────────────────
    definition_patterns = [
        # "X is defined as Y" / "X is Y"
        r'([A-Z][^.]{3,60}?)\s+(?:is defined as|refers to|is known as|is called|means?)\s+([^.]{10,200})\.',
        # "X: Y" (glossary style)
        r'\b([A-Z][A-Za-z\s\-]{2,40}):\s+([A-Z][^.]{15,200})\.',
        # "The term X is Y"
        r'[Tt]he\s+(?:term|concept|principle|law|theory)\s+["\']?([A-Za-z][^"\']{2,40})["\']?\s+(?:is|refers to|means?)\s+([^.]{10,200})\.',
    ]

    for pattern in definition_patterns:
        for m in re.finditer(pattern, text):
            term = _clean_sentence(m.group(1))
            definition = _clean_sentence(m.group(2))
            if len(term) < 3 or len(definition) < 10:
                continue
            q = f"What is {term}?"
            norm_q = q.lower()
            if norm_q not in seen_questions:
                seen_questions.add(norm_q)
                cards.append(Flashcard(question=q, answer=definition))
            if len(cards) >= target:
                break
        if len(cards) >= target:
            break

    # ── 2. Numbered / bulleted list items ──────────────────────────────
    if len(cards) < target:
        list_pattern = re.compile(
            r'(?:^|\n)\s*(?:\d+[\.\)]\s*|[•\-\*]\s*)([A-Z][^.\n]{15,180}\.)',
            re.MULTILINE
        )
        # Find a heading before each list block
        heading_pattern = re.compile(
            r'(?:^|\n)([A-Z][A-Z\s]{3,50})(?:\n|:)',
            re.MULTILINE
        )
        headings = [(m.start(), _clean_sentence(m.group(1))) for m in heading_pattern.finditer(text)]

        for m in list_pattern.finditer(text):
            item = _clean_sentence(m.group(1))
            if len(item) < 20:
                continue
            # find nearest preceding heading
            pos = m.start()
            context = next((h for s, h in reversed(headings) if s < pos), None)
            if context:
                q = f"What does the document say about {context.title()}?"
            else:
                # make question from first 5 words
                words = item.split()[:5]
                q = f"What is described as \"{' '.join(words)}...\"?"
            norm_q = q.lower()
            if norm_q not in seen_questions:
                seen_questions.add(norm_q)
                cards.append(Flashcard(question=q, answer=item))
            if len(cards) >= target:
                break

    # ── 3. Important factual sentences (cause/effect, process) ─────────
    if len(cards) < target:
        fact_patterns = [
            r'([A-Z][^.]{20,150}(?:because|therefore|thus|hence|as a result|due to|caused by)[^.]{10,150}\.)',
            r'([A-Z][^.]{20,150}(?:consists? of|includes?|comprises?|contains?)[^.]{10,150}\.)',
            r'([A-Z][^.]{20,150}(?:increases?|decreases?|affects?|produces?|generates?)[^.]{10,150}\.)',
        ]
        for pattern in fact_patterns:
            for m in re.finditer(pattern, text):
                sentence = _clean_sentence(m.group(1))
                if len(sentence) < 30:
                    continue
                # Build question from start of sentence
                words = sentence.split()
                subject = ' '.join(words[:min(6, len(words))])
                q = f"Explain: \"{subject}...\""
                norm_q = q.lower()
                if norm_q not in seen_questions:
                    seen_questions.add(norm_q)
                    cards.append(Flashcard(question=q, answer=sentence))
                if len(cards) >= target:
                    break
            if len(cards) >= target:
                break

    # ── 4. Fill remaining with general content sentences ───────────────
    if len(cards) < target:
        sentences = [_clean_sentence(s) for s in re.split(r'(?<=[.!?])\s+', text) if len(s.strip()) > 40]
        step = max(1, len(sentences) // (target - len(cards) + 1))
        for i in range(0, len(sentences), step):
            sentence = sentences[i]
            words = sentence.split()
            if len(words) < 8:
                continue
            # Make a cloze-style question using the last meaningful word cluster
            q = f"Complete or explain: \"{' '.join(words[:7])}...\""
            norm_q = q.lower()
            if norm_q not in seen_questions:
                seen_questions.add(norm_q)
                cards.append(Flashcard(question=q, answer=sentence))
            if len(cards) >= target:
                break

    return cards[:target]


# ──────────────────────────────────────────────
# AI-powered generator (tries OpenRouter)
# ──────────────────────────────────────────────

def _parse_flashcards(raw: str) -> List[Flashcard]:
    """Parse AI response into flashcard list."""
    # 1. Try to extract JSON array
    json_match = re.search(r'\[\s*\{.*?\}\s*\]', raw, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group(0))
            if isinstance(data, list):
                parsed = [Flashcard(question=item.get("question", ""), answer=item.get("answer", "")) for item in data if isinstance(item, dict) and "question" in item and "answer" in item]
                if parsed:
                    return parsed
        except Exception:
            pass

    # 2. Try to parse as Q: A: format if JSON fails
    cards = []
    blocks = re.split(r"\n\s*\n", raw.strip())
    for block in blocks:
        q_match = re.search(r"(?:Q:|Question:|Q\s*\d*\.?)\s*(.+?)(?=\n(?:A:|Answer:|A\s*\d*\.?)|$)", block, re.IGNORECASE | re.DOTALL)
        a_match = re.search(r"(?:A:|Answer:|A\s*\d*\.?)\s*(.+)", block, re.IGNORECASE | re.DOTALL)
        if q_match and a_match:
            cards.append(Flashcard(
                question=q_match.group(1).strip(),
                answer=a_match.group(1).strip(),
            ))
            
    # 3. Last resort fallback
    if not cards:
        lines = [line.strip() for line in raw.split('\n') if line.strip() and not line.startswith('```') and not line.startswith('{') and not line.startswith('[') and not line.startswith('}') and not line.startswith(']')]
        for i in range(0, len(lines)-1):
            if lines[i].endswith('?') or lines[i].startswith('Q:'):
                cards.append(Flashcard(question=re.sub(r'^Q:\s*', '', lines[i]), answer=re.sub(r'^A:\s*', '', lines[i+1])))
                
    return cards


def _try_ai_flashcards(text_input: str) -> List[Flashcard]:
    """Attempt AI-powered generation. Raises on failure."""
    from app.services.openai_service import _get_client, _generate_with_fallback

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert study assistant. Given document text, generate clear and concise flashcards. "
                "Return ONLY a valid JSON array with no extra text, no markdown fences. "
                "Each object must have exactly two keys: \"question\" and \"answer\". "
                "Example: [{\"question\": \"What is X?\", \"answer\": \"X is ...\"}]"
            ),
        },
        {
            "role": "user",
            "content": (
                "Generate 10-15 flashcards from the following document text. "
                "Focus on key concepts, definitions, and important facts. "
                "Return ONLY a JSON array.\n\n"
                f"{text_input}"
            ),
        },
    ]

    client = _get_client(provider="openrouter")
    raw = _generate_with_fallback(
        client=client,
        primary_model=OPENROUTER_PRIMARY_MODEL,
        fallback_model=OPENROUTER_FALLBACK_MODEL,
        messages=messages,
        max_tokens=2000,
    )
    return _parse_flashcards(raw)


# ──────────────────────────────────────────────
# Route
# ──────────────────────────────────────────────

@router.post("/generate", response_model=FlashcardsResponse)
async def generate_flashcards(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    """
    Generate flashcards from an uploaded PDF file.
    Tries AI generation first; falls back to local extraction if AI is unavailable.
    """
    try:
        filename = file.filename or ""
        content_type = file.content_type or ""
        
        # We accept PDF and plain text (or octet stream which could be either)
        is_pdf = (
            content_type == "application/pdf"
            or filename.lower().endswith(".pdf")
        )
        is_text = (
            content_type.startswith("text/")
            or filename.lower().endswith(".txt")
        )
        is_generic = content_type in ("application/octet-stream", "binary/octet-stream", "")

        if not (is_pdf or is_text or is_generic):
            raise HTTPException(status_code=400, detail="Only PDF or Text files are supported")

        file_bytes = await file.read()
        
        # Try to parse as PDF first
        extracted_text = ""
        if validate_pdf(file_bytes):
            extracted_text = extract_text_from_pdf(file_bytes)
        else:
            # Fallback: treat as plain text if it's not a valid PDF
            try:
                extracted_text = file_bytes.decode('utf-8')
            except UnicodeDecodeError:
                raise HTTPException(status_code=400, detail="Invalid file format: Not a valid PDF or UTF-8 text file")
        if not extracted_text or not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from this PDF")

        text_input = extracted_text[:12000]
        flashcards: List[Flashcard] = []
        source = "ai"

        try:
            flashcards = _try_ai_flashcards(text_input)
            if not flashcards:
                raise ValueError("AI returned empty flashcard list after parsing")
        except Exception as ai_exc:
            logger.warning(f"AI flashcard generation failed ({type(ai_exc).__name__}): {ai_exc}. Using local fallback.")
            flashcards = _generate_local_flashcards(extracted_text)
            source = "local"
            
        # If local fallback also fails (0 cards), create a generic flashcard so the UI doesn't crash with 500
        if not flashcards:
            logger.warning("Local flashcard generation also yielded 0 cards. Creating generic fallback cards.")
            flashcards = [
                Flashcard(
                    question="What is the main topic of this document?",
                    answer="Please review the document to identify its core themes and subjects, as the automated extractor could not confidently determine specific facts."
                ),
                Flashcard(
                    question="How can I get better flashcards?",
                    answer="Try uploading a document with clear definitions, headings, and bullet points. Our AI works best with structured study material."
                )
            ]
            source = "fallback_generic"

        if not flashcards:
            raise HTTPException(status_code=500, detail="Could not generate flashcards from this document")

        logger.info(f"Generated {len(flashcards)} flashcards for user {user_id} (source={source})")
        return FlashcardsResponse(status="success", flashcards=flashcards)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating flashcards: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating flashcards: {str(e)}")