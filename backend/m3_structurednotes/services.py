"""
NeuraNote - Member 3: Structured Note Generation
services.py - FULL REBUILD (5-Phase Mind Map Pipeline)
"""

import os
import re
import uuid
import math
import json
import base64
from io import BytesIO
from collections import Counter, defaultdict
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

from .database import get_db_connection

load_dotenv()

STOPWORDS = {
    "the","is","in","and","to","of","a","for","on","with","as","by",
    "this","that","it","at","from","or","an","be","are","can","will",
    "which","was","has","have","had","not","but","its","also","been",
    "more","than","when","there","they","their","about","into",
    "through","during","before","after","above","below","between",
    "each","other","such","then","these","those","would","could",
    "should","may","might","must","shall","very","just","all","any",
    "both","few","most","some","so","yet","if","do","did","does",
    "how","what","why","who","where","used","use","using","one",
    "two","three","our","we","you","your","him","her","his","them",
    "us","my","me","he","she","am","get","make","like","know","see",
    "come","go","give","take","same","different","way","time","part",
    "type","set","based","given","called","known","well","new",
    "first","second","third","often","always","key",
}

class AIService:
    def __init__(self):
        self._embeddings = None
        self._llm = None

    @property
    def embeddings(self):
        if self._embeddings is None:
            import os as _os
            from langchain_huggingface import HuggingFaceEmbeddings
            _os.environ["SENTENCE_TRANSFORMERS_HOME"] = "./model_cache"
            _os.makedirs("./model_cache", exist_ok=True)
            print("[AIService] Loading HuggingFace embeddings (all-MiniLM-L6-v2)...")
            self._embeddings = HuggingFaceEmbeddings(
                model_name="all-MiniLM-L6-v2",
                cache_folder="./model_cache",
            )
        return self._embeddings

    @property
    def llm(self):
        if self._llm is None:
            from langchain_openai import ChatOpenAI
            api_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
            print(f"[Auth] API key loaded: {bool(api_key)}")
            print(f"[Auth] Key length: {len(api_key) if api_key else 0}")
            model_name = (os.getenv("OPENROUTER_MODEL") or "openai/gpt-4o-mini").strip()
            if not api_key:
                raise EnvironmentError("OPENROUTER_API_KEY is not set.")
            print(f"[AIService] Initializing LLM: {model_name}")
            self._llm = ChatOpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1",
                model=model_name,
                temperature=0.1,
                timeout=180,
                max_tokens=1500,
                default_headers={
                    "Authorization": f"Bearer {api_key}",
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "NeuraNote"
                }
            )
        return self._llm

def _get_conn():
    conn = get_db_connection()
    if not conn:
        raise RuntimeError("Database connection failed. Check DB_URL in .env")
    return conn

def _fetch_images(pdf_ids: list) -> list[dict]:
    """Helper to fetch all images for multiple PDF IDs."""
    if not pdf_ids: return []
    try:
        conn = _get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT image_data, media_type, page_number, caption, pdf_id FROM document_images WHERE pdf_id IN %s ORDER BY page_number ASC",
            (tuple(pdf_ids),)
        )
        rows = [dict(r) for r in cur.fetchall()]
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        print(f"[_fetch_images] {e}")
        return []

def _inject_images(text: str, images: list) -> str:
    """Replaces [IMG: page X] markers with HTML image tags (base64)."""
    if not images: return text
    for img in images:
        page = img.get("page_number")
        if page:
            marker = f"[IMG: page {page}]"
            tag = f'<img src="data:{img["media_type"]};base64,{img["image_data"]}" alt="Slide {page}" style="max-width:100%; border-radius:8px; margin:10px 0;" />'
            text = text.replace(marker, tag)
    return text

def clean_note_formatting(text: str) -> str:
    text = re.sub(r"([^\n])(##)", r"\1\n\n\2", text)
    text = re.sub(r"(## .+)\n([^\n])", r"\1\n\n\2", text)
    text = re.sub(r"\n{4,}", "\n\n\n", text)
    return text.strip()

# Jaccard functions
def title_similar(a: str, b: str) -> bool:
    wa = set(a.lower().split())
    wb = set(b.lower().split())
    if not (wa | wb): return False
    j = len(wa & wb) / len(wa | wb)
    return j > 0.4

def line_similar(a: str, b: str) -> bool:
    wa = set(a.lower().split())
    wb = set(b.lower().split())
    if not (wa | wb): return False
    j = len(wa & wb) / len(wa | wb)
    return j > 0.6

def classify_line(line: str) -> dict | None:
    line = line.strip()
    if not line: return None
    if '|' in line:
        return {"type": "table_row", "text": line}
    if re.match(r'^\d+[\.\)]', line):
        return {"type": "numbered", "text": line}
    if line.startswith(('-','•','*','→','>')):
        return {"type": "bullet", "text": line.lstrip('-•*→> ').strip()}
    if len(line) > 40:
        return {"type": "paragraph", "text": line}
    if len(line) > 10:
        return {"type": "short", "text": line}
    return None

class NoteService:
    def __init__(self):
        self._ai = AIService()

    def _llm_call(self, prompt: str, json_mode=False) -> str:
        # Note: ChatOpenAI doesn't strictly support json_mode universally without passing kwargs
        kwargs = {}
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        try:
            response = self._ai.llm.invoke(prompt, **kwargs)
            text = response.content.strip()
            if json_mode:
                text = re.sub(r"^```json\n|```$", "", text, flags=re.MULTILINE).strip()
            return text
        except Exception as e:
            print(f"[LLM ERROR] {type(e).__name__}")
            raise e

    def _llm_call_with_retry(
        self,
        prompt: str,
        max_retries: int = 4,
        initial_wait: int = 15
    ) -> str:
        """
        Central LLM call wrapper with exponential
        backoff retry on rate limit errors.

        Retries up to max_retries times.
        Waits initial_wait seconds on first retry.
        Doubles wait time on each subsequent retry.
        Returns empty string only if all retries fail.
        Never raises an exception.
        """
        import time

        wait_time = initial_wait

        for attempt in range(max_retries):
            try:
                response = self._ai.llm.invoke(prompt)
                return response.content.strip()

            except Exception as e:
                error_str = str(e)
                is_rate_limit = any(x in error_str for x in [
                    '429', '504', 'rate', 'Rate',
                    'timeout', 'Timeout', 'overloaded'
                ])

                if is_rate_limit and \
                        attempt < max_retries - 1:
                    print(
                        f"[LLM] Rate limited. "
                        f"Waiting {wait_time}s "
                        f"(attempt {attempt+1}"
                        f"/{max_retries})..."
                    )
                    time.sleep(wait_time)
                    wait_time *= 2
                else:
                    print(
                        f"[LLM] Failed after "
                        f"{attempt+1} attempts: "
                        f"{type(e).__name__}"
                    )
                    return ""

        return ""

    def safe_parse_json(self, raw: str) -> dict:
        """
        Strips markdown fences then parses JSON.
        If json.loads fails, searches for JSON object
        inside the response text.
        Always returns a dict, never raises.
        """
        text = raw.strip()
        text = re.sub(r'^```(json)?\s*', '', text, flags=re.MULTILINE)
        text = re.sub(r'```\s*$', '', text, flags=re.MULTILINE)
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except Exception:
                    pass
            print(f"[MindMap] JSON parse failed.")
            print(f"[MindMap] Raw was: {text[:400]}")
            return {"lecture_title": "", "chapters": []}

    def _merge_chapters(self, chapters: list) -> list:
        """
        MANUAL ALGORITHM - Jaccard chapter merging.
        Merges chapters with similar titles using
        Jaccard similarity threshold 0.4.
        Combines their sections.
        Keeps the longer title.
        """
        merged = []
        for chapter in chapters:
            if not chapter.get("title"):
                continue
            title_words = set(chapter["title"].lower().split())
            matched = False
            for existing in merged:
                ex_words = set(existing["title"].lower().split())
                union = len(title_words | ex_words)
                inter = len(title_words & ex_words)
                jaccard = inter / union if union > 0 else 0
                if jaccard >= 0.4:
                    existing["sections"].extend(chapter.get("sections", []))
                    if len(chapter["title"]) > len(existing["title"]):
                        existing["title"] = chapter["title"]
                    matched = True
                    break
            if not matched:
                merged.append({
                    "title": chapter["title"],
                    "sections": list(chapter.get("sections", []))
                })
        return merged

    def _mindmap_single_chunk(self, chunk_text: str, is_first: bool) -> dict:
        """
        Sends one chunk of text to LLM for mind map
        extraction. Returns parsed dict.
        Instructs LLM to return raw JSON only.
        """
        prompt = f"""You are an expert academic 
document analyser.

Your job: Extract the COMPLETE topic structure
from this lecture material.

CRITICAL INSTRUCTION:
Cover every single heading and subheading in 
the source document without skipping any concept.
Do not stop until ALL topics are captured.

Return ONLY raw JSON starting with {{
No markdown. No explanation. Start with {{ now.

{{
  "lecture_title": "short lecture name",
  "chapters": [
    {{
      "title": "Short Topic Name — max 5 words",
      "sections": [
        {{
          "title": "Sub-topic — max 5 words",
          "content_lines": [
            "every content line exactly as written"
          ],
          "has_code": false,
          "code_blocks": [],
          "image_pages": [],
          "is_emphasised": false
        }}
      ]
    }}
  ]
}}

RULES FOR TITLES:
  CORRECT: "Encapsulation", "Types of Inheritance"
  WRONG: "• Encapsulation is a mechanism where..."
  Titles must be SHORT TOPIC NAMES only.
  Content goes in content_lines not in titles.

RULES FOR COVERAGE:
  - Every heading in the source becomes a chapter
  - Every subheading becomes a section
  - Every bullet point goes into content_lines
  - NOTHING is skipped — not even short points
  - If source has 10 topics you must return 10 chapters

RULES FOR is_emphasised:
  Set is_emphasised to true if the content:
  - Was repeated more than once in the material
  - Appears in a summary or review slide
  - Has special formatting (bold, underline, caps)
  - Is a definition or key formula
  - Appears near the end as a summary point

SELF-CHECK before returning JSON:
  Count the headings in the source material.
  Count the chapters in your JSON.
  They must match. If not, add the missing ones.

LECTURE MATERIAL:
{chunk_text}

Start with {{ immediately. No other text."""
        raw = self._llm_call_with_retry(
            prompt,
            max_retries=3,
            initial_wait=10
        )

        if not raw:
            return {"lecture_title": "", "chapters": []}

        return self.safe_parse_json(raw)

    def extract_mindmap_chunked(self, full_text: str) -> dict:
        """
        Splits full_text into 3000-char chunks.
        Calls LLM on each chunk separately.
        Merges results using _merge_chapters.
        Returns combined mind map dict.
        Caps at 5 chunks to prevent excessive LLM calls.
        """
        import time
        CHUNK_SIZE = 3000
        MAX_CHUNKS = 5

        text = full_text.strip()
        chunks = []
        for i in range(0, len(text), CHUNK_SIZE):
            chunks.append(text[i:i + CHUNK_SIZE])
            if len(chunks) >= MAX_CHUNKS:
                break

        print(f"[MindMap] Processing {len(chunks)} chunks")
        t0 = time.time()

        all_chapters = []
        lecture_title = "Study Notes"

        for i, chunk in enumerate(chunks):
            print(f"[MindMap] Chunk {i+1}/{len(chunks)}...")
            result = self._mindmap_single_chunk(chunk, is_first=(i == 0))
            if i == 0 and result.get("lecture_title"):
                lecture_title = result["lecture_title"]
            all_chapters.extend(result.get("chapters", []))

        merged = self._merge_chapters(all_chapters)

        print(f"[MindMap] Done in {time.time()-t0:.1f}s")
        print(f"[MindMap] {len(merged)} chapters found")
        for ch in merged:
            sec_count = len(ch.get("sections", []))
            print(f"  - {ch['title']} ({sec_count} sections)")

        return {
            "lecture_title": lecture_title,
            "chapters": merged
        }

    def classify_section_content(self, section: dict) -> list:
        """
        MANUAL ALGORITHM - Content line classifier.
        Returns list of {type, text} dicts.
        """
        classified = []
        for line in section.get("content_lines", []):
            line = line.strip()
            if not line or len(line) < 10:
                continue
            if re.match(r'^\d+[\.\)]', line):
                classified.append({"type": "numbered", "text": line})
            elif line[0] in '-•*→>':
                classified.append({"type": "bullet", "text": line.lstrip('-•*→> ').strip()})
            elif len(line) > 40:
                words = line.split()
                if len(words) > 60:
                    sentences = line.split('. ')
                    for s in sentences:
                        s = s.strip()
                        if len(s) > 15:
                            classified.append({"type": "bullet", "text": s})
                else:
                    classified.append({"type": "paragraph", "text": line})
            elif len(line) >= 10:
                classified.append({"type": "short", "text": line})

        for item in classified:
            item['source'] = {
                'doc_id': section.get('doc_id', ''),
                'page_hint': section.get(
                    'image_pages', [0]
                )[0] if section.get('image_pages') else 0
            }

        return classified

    def is_already_detailed_note(self, content: str) -> bool:
        """Detects if content is already a properly generated detailed note."""
        signals = ["**", "##", "- ⚡", "> 📚", "### "]
        count = sum(1 for s in signals if s in content)
        return count >= 3

    def expand_section(self, section_title: str, classified_lines: list,
                       language: str = "English") -> str:
        """Sends classified content lines to AI for expansion. Returns markdown string."""
        if not classified_lines:
            return ""

        content_str = ""
        for item in classified_lines:
            if item["type"] == "numbered":
                content_str += item["text"] + "\n"
            else:
                content_str += "- " + item["text"] + "\n"

        if len(content_str) > 3000:
            mid = len(classified_lines) // 2
            part1 = self.expand_section(section_title, classified_lines[:mid], language)
            part2 = self.expand_section(section_title, classified_lines[mid:], language)
            return part1 + "\n" + part2

        prompt = f"""You are NotesGPT — an expert exam
preparation note writer in {language}.

SECTION TOPIC: {section_title}

RAW LECTURE CONTENT:
{content_str}

YOUR MISSION:
Transform raw lecture content into exam revision
bullets that a student can read the night before
an exam to recall everything quickly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COVERAGE RULE — most important rule:
Cover every single point in the raw content
above without skipping any concept.
Do not stop until ALL points are covered.
If there are 10 points in the raw content,
there must be at least 10 bullets in your output.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BULLET FORMAT RULE:
Every bullet must follow this exact pattern:

  - ⚡ **Term**: One-line definition.
    WHY it matters or HOW it works in one sentence.

  The first line = what it is (under 10 words)
  The second line = why/how (under 15 words)
  Total reading time per bullet: under 5 seconds
  Total recall from bullet: complete idea

CORRECT bullet example:
  - ⚡ **Encapsulation**: Bundles data and methods
    in one class. WHY: prevents external code from
    corrupting internal data — access controlled
    through getters and setters only.

WRONG bullet example (too vague):
  - Encapsulation is an important OOP concept.

WRONG bullet example (too long):
  - Encapsulation is a mechanism in object oriented
    programming where you combine the data and the
    code that operates on that data into a single
    unit which is known as a class and you hide the
    internal details from the outside world...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMPHASIS RULE:
Treat anything that was repeated, bolded, or
appeared in a summary as HIGH PRIORITY.
Mark these with ⚡ at the start.
All other points get standard bullet •
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MARKER RULES:
  ⚡ = critical exam point, must know
  💡 = real-world example or analogy
  ⚠️ = common mistake or confusion point

EXPANSION RULE:
If any raw content line is under 15 words OR
only states WHAT without WHY or HOW:
  Expand it using your knowledge of {section_title}
  Add the WHY or HOW so student understands fully
  Student must NOT need slides after reading this

COMPARISON RULE:
When two concepts contrast (A vs B, X or Y):
  Write one bullet per concept
  Then write ⚠️ bullet on the key difference
  Example:
    - ⚡ **private**: only same class can access
    - ⚡ **protected**: same class + subclasses
    - ⚠️ **Difference**: private blocks subclasses,
      protected allows them — choose based on
      whether child classes need access

CODE RULE:
If source has code examples:
  Keep the code in a code block
  Add one comment line explaining what it shows
  Example:
```java
    // extends keyword creates inheritance link
    class Dog extends Animal {{ }}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPLETENESS CHECK — do this before END_SECTION:
List the main topics from the raw content above.
Confirm each one appears in your bullets.
If any topic is missing add it now.
Do not include this checklist in your output —
just use it to verify before finishing.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Keep total response under 700 words.
End with exactly: END_SECTION

Start with first bullet directly.
No intro sentence. No heading. Just bullets.
"""
        try:
            response = self._ai.llm.invoke(prompt)
            result = response.content.strip()
            result = result.replace("END_SECTION", "").strip()
            result = re.sub(r'^```(markdown)?\n|```$', '', result, flags=re.MULTILINE)
            return result
        except Exception as e:
            print(f"[Expand] Failed for {section_title}: {e}")
            return "\n".join(
                f"- **{item['text'][:60]}**: {item['text']}"
                for item in classified_lines[:5]
            )

    def extract_headings_manual(
        self, full_text: str
    ) -> list:
        """
        MANUAL ALGORITHM — detects headings in
        lecture text without using AI.

        Detects these heading patterns:
        1. ALL CAPS lines under 80 chars
        2. Lines that end with : under 60 chars
        3. Numbered lines: 1. or 1) or Chapter 1
        4. Short lines under 50 chars that are
           followed by bullet content
        5. Lines starting with common heading words:
           Introduction, Overview, Types, Definition,
           Advantages, Disadvantages, Example,
           Summary, Conclusion, Applications

        Returns ordered list of heading strings
        preserving document order.
        """
        import re
        lines = full_text.split('\n')
        headings = []
        seen = set()

        HEADING_STARTERS = {
            'introduction', 'overview', 'types',
            'definition', 'advantages', 'disadvantages',
            'example', 'examples', 'summary',
            'conclusion', 'applications', 'features',
            'properties', 'methods', 'syntax',
            'concept', 'concepts', 'principles',
            'objectives', 'what is', 'how to',
            'difference', 'comparison', 'uses',
            'characteristics', 'importance'
        }

        for i, line in enumerate(lines):
            stripped = line.strip()
            if not stripped or len(stripped) < 3:
                continue

            is_heading = False
            lower = stripped.lower()

            # Pattern 1: ALL CAPS under 80 chars
            if (stripped.isupper() and
                    5 < len(stripped) < 80 and
                    not stripped.startswith('•')):
                is_heading = True

            # Pattern 2: ends with colon under 60 chars
            elif (stripped.endswith(':') and
                  len(stripped) < 60 and
                  not stripped.startswith('•') and
                  not stripped.startswith('-')):
                is_heading = True

            # Pattern 3: numbered heading
            elif re.match(
                r'^\d+[\.\)]\s+[A-Z][a-zA-Z\s]{3,40}$',
                stripped
            ):
                is_heading = True

            # Pattern 4: starts with heading word
            elif any(
                lower.startswith(w)
                for w in HEADING_STARTERS
            ) and len(stripped) < 60:
                is_heading = True

            # Pattern 5: short title-case line
            # followed by bullet content
            elif (len(stripped.split()) <= 6 and
                  len(stripped) < 50 and
                  stripped[0].isupper() and
                  not stripped.endswith('.') and
                  not stripped.startswith('•') and
                  not stripped.startswith('-') and
                  i + 1 < len(lines) and
                  lines[i+1].strip().startswith('•')):
                is_heading = True

            if is_heading:
                # Clean the heading
                clean = stripped.rstrip(':').strip()
                clean = re.sub(
                    r'^\d+[\.\)]\s+', '', clean
                )
                if clean not in seen and len(clean) > 3:
                    headings.append(clean)
                    seen.add(clean)

        print(
            f"[Headings] Found {len(headings)} headings:"
        )
        for h in headings:
            print(f"  - {h}")

        return headings

    def _is_duplicate_line(
        self,
        line: str,
        existing_lines: list,
        threshold: float = 0.7
    ) -> bool:
        """
        MANUAL ALGORITHM — Jaccard similarity check.
        Returns True if line is too similar to any
        existing line (duplicate content).
        """
        words_a = set(line.lower().split())
        if len(words_a) < 3:
            return False
        for existing in existing_lines:
            words_b = set(existing.lower().split())
            if not words_b:
                continue
            union = len(words_a | words_b)
            inter = len(words_a & words_b)
            if union > 0 and inter/union >= threshold:
                return True
        return False

    def collect_content_under_headings(
        self,
        full_text: str,
        headings: list
    ) -> dict:
        """
        MANUAL ALGORITHM — collects all content lines
        that belong to each heading.

        For each heading, takes all text between
        that heading and the next heading.
        Returns dict: {heading: [content lines]}

        Rules:
        - Content lines are non-empty lines that
          are not themselves headings
        - Bullet markers (•, -, *) are kept
        - Short lines under 10 chars are skipped
        - Maximum 50 lines per heading to avoid
          context overflow
        """
        lines = full_text.split('\n')
        result = {}
        current_heading = "Introduction"
        current_content = []
        heading_set = set(
            h.lower() for h in headings
        )

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Check if this line is a heading
            clean = stripped.rstrip(':').strip()
            is_current_heading = (
                clean.lower() in heading_set or
                stripped.lower() in heading_set
            )

            if is_current_heading and clean in headings:
                # Save previous heading's content
                if current_content:
                    if current_heading not in result:
                        result[current_heading] = []
                    result[current_heading].extend(
                        current_content[:50]
                    )
                current_heading = clean
                current_content = []
            else:
                # Add as content if meaningful
                if (len(stripped) >= 10 and
                    not self._is_duplicate_line(
                        stripped, current_content
                    )):
                    current_content.append(stripped)

        # Save last heading's content
        if current_content and current_heading:
            if current_heading not in result:
                result[current_heading] = []
            result[current_heading].extend(
                current_content[:50]
            )

        print(
            f"[Content] Collected content for "
            f"{len(result)} headings:"
        )
        for h, lines in result.items():
            print(f"  {h}: {len(lines)} lines")

        return result

    def expand_heading_content(
        self,
        heading: str,
        content_lines: list,
        language: str = "English"
    ) -> str:
        """
        AI call — one per heading.
        AI only writes precise bullets from
        the EXACT content lines provided.
        Cannot invent topics. Cannot skip topics.
        Only job: make each point precise and clear.
        """
        if not content_lines:
            return ""

        # Build content string from exact lines
        content_str = "\n".join(
            f"- {line}" if not line.startswith(
                ('•', '-', '*', '→')
            ) else line
            for line in content_lines
        )

        # Truncate at sentence boundary not character limit
        if len(content_str) > 2500:
            # Find last complete sentence before 2500
            truncation_point = 2500
            # Look for sentence end before limit
            for punct in ['. ', '.\n', '! ', '? ']:
                last_punct = content_str.rfind(
                    punct, 0, 2500
                )
                if last_punct > 1500:
                    truncation_point = last_punct + 1
                    break
            content_str = content_str[:truncation_point]
            print(
                f"[Expand] Content truncated at "
                f"sentence boundary: "
                f"{truncation_point} chars"
            )

        prompt = f"""You are NotesGPT. Your job is to
TRANSFORM raw lecture bullets into exam revision
notes. This is NOT summarising. This is NOT
copying. This is TRANSFORMATION.

TOPIC: {heading}

RAW LECTURE CONTENT — transform every line below:
{content_str}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSFORMATION RULES — follow all strictly:

RULE 1 — NEVER copy the raw line as-is.
Every bullet must be REWRITTEN and EXPANDED.

WRONG (copying):
  raw: "Encapsulation binds data and code"
  output: "- Encapsulation binds data and code"

CORRECT (transformed):
  raw: "Encapsulation binds data and code"
  output: "- ⚡ **Encapsulation**: Bundles data
    (variables) and methods into one class unit.
    WHY: prevents external code from directly
    modifying internal state — all access goes
    through controlled getter/setter methods."

RULE 2 — Every bullet must have 2 parts:
  Part 1: WHAT it is — max 10 words
  Part 2: WHY it matters or HOW it works — max 15 words
  If the raw content only has Part 1, you MUST
  add Part 2 from your knowledge of {heading}.

RULE 3 — Every bullet readable in 5 seconds.
  Maximum 30 words per bullet total.
  Complete enough to recall the full concept.

RULE 4 — Bold ALL key terms: **term**

RULE 5 — Use markers:
  ⚡ = critical exam point
  💡 = real example or analogy
  ⚠️ = common mistake or comparison

RULE 6 — For comparisons write:
  - ⚡ **TermA**: definition. WHY/HOW.
  - ⚡ **TermB**: definition. WHY/HOW.
  - ⚠️ **Key difference**: A does X, B does Y.

RULE 7 — For code examples:
  Keep in code block. Add one comment line.

RULE 8 — Cover EVERY point. Skip nothing.

RULE 9 — Never cut a sentence mid-way.
  If a point cannot be completed, skip it.
  Partial bullets are useless.

RULE 10 — No repetition. Each concept once.

RULE 11 — NUMBERED LIST RULE:
If the source content has numbered items
(1. 2. 3. or 1) 2) 3)), keep them as a
numbered list in your output.
Do NOT convert numbered lists to bullets.
Example:
  Source: 1. Declaration 2. Initialization
  Output:
  1. ⚡ **Declaration**: define variable type
     and name. Allocates memory slot.
  2. ⚡ **Initialization**: assign first value
     to declared variable. Sets starting state.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Keep total under 600 words.
End with: END_SECTION
Start with first bullet directly. No intro.
"""

        import time as _time
        import random as _random
        _time.sleep(_random.uniform(0.3, 0.8))

        result = self._llm_call_with_retry(prompt)

        if not result:
            print(
                f"[Expand] All retries failed "
                f"for: {heading}. Using raw content."
            )
            return "\n".join(
                f"- {line}"
                for line in content_lines[:10]
            )

        result = result.replace("END_SECTION", "").strip()
        result = re.sub(
            r'^```\w*\n|```$', '',
            result,
            flags=re.MULTILINE
        )
        return result.strip()

    def verify_and_complete_headings(
        self,
        headings: list,
        full_text: str,
        domain_keywords: list = None
    ) -> list:
        """
        MANUAL ALGORITHM — ensures critical topics
        are not missed.

        Searches full_text for important terms that
        did not get detected as headings.
        Adds them to the headings list if found
        in the text but missing from headings.
        """
        if not domain_keywords:
            return headings

        headings_lower = [h.lower() for h in headings]
        additions = []

        for keyword in domain_keywords:
            kw_lower = keyword.lower()
            # Check if keyword is already covered
            already_covered = any(
                kw_lower in h for h in headings_lower
            )
            if not already_covered:
                # Check if keyword appears in text
                if kw_lower in full_text.lower():
                    print(
                        f"[Coverage] Adding missing "
                        f"topic: {keyword}"
                    )
                    additions.append(keyword)

        # Insert additions in a logical position
        if additions:
            return headings + additions
        return headings

    def verify_takeaways_coverage(
        self,
        takeaways: str,
        headings: list
    ) -> str:
        """
        Checks that key headings appear in takeaways.
        Appends any missing critical topics.
        """
        missing = []
        tk_lower = takeaways.lower()

        for heading in headings:
            # Check if heading concept is mentioned
            key_word = heading.split()[0].lower()
            if key_word not in tk_lower:
                missing.append(heading)

        if missing:
            print(
                f"[Takeaways] Missing topics: "
                f"{missing}"
            )
            additions = "\n".join(
                f"- ⚡ **{h}**: "
                f"[Review this topic in the note above]"
                for h in missing[:3]
            )
            return takeaways + "\n" + additions

        return takeaways

    def generate_detailed_note(self, pdf_id: str, user_id: str,
                                language: str = "English", job_id: str = None) -> str:
        """
        Full pipeline for one PDF:
        Phase 1 - fetch chunks, Phase 2 - mind map,
        Phase 3 - classify, Phase 4 - expand, Phase 5 - assemble.
        """
        import time
        import concurrent.futures
        t0 = time.time()
        self._update_job(job_id, "retrieving")

        conn = _get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT content, chunk_index,
            COALESCE((metadata->>'page')::int, 0) AS page_hint
            FROM document_chunks WHERE pdf_id = %s ORDER BY chunk_index ASC
        """, (pdf_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        if not rows:
            return "# Error\n\nNo content found for this document."

        full_text = " ".join(r["content"] for r in rows)
        print(f"[DetailedNote] {len(rows)} chunks, {len(full_text)} chars")

        self._update_job(job_id, "analyzing")

        lecture_title = "Study Notes"

        # Pass 1: Manual heading detection
        headings = self.extract_headings_manual(
            full_text
        )

        if not headings:
            print(
                "[DetailedNote] No headings found. "
                "Using fallback single section."
            )
            headings = ["Main Content"]

        # Detect domain from content
        opp_keywords = [
            "Encapsulation", "Inheritance",
            "Polymorphism", "Abstraction",
            "Method Overloading", "Method Overriding",
            "Abstract Class", "Interface"
        ]

        java_keywords = [
            "Variables", "Data Types", "Operators",
            "Control Structures", "Loops", "Arrays",
            "Methods", "Classes", "Objects"
        ]

        # Check if this is OOP content
        is_oop = any(
            kw.lower() in full_text.lower()
            for kw in ["encapsulation", "inheritance",
                       "polymorphism", "abstraction"]
        )

        if is_oop:
            headings = self.verify_and_complete_headings(
                headings, full_text, opp_keywords
            )

        # Pass 2: Collect content under each heading
        heading_content = \
            self.collect_content_under_headings(
                full_text, headings
            )

        self._update_job(job_id, "expanding")

        # Pass 3: AI expands each heading's content
        # Run in parallel for speed
        import concurrent.futures
        import time

        def expand_one(heading):
            content = heading_content.get(heading, [])
            if not content:
                return heading, ""
            # Small delay to avoid rate limiting
            time.sleep(0.5)
            expanded = self.expand_heading_content(
                heading, content, language
            )
            return heading, expanded

        expanded_results = {}
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=2
        ) as executor:
            futures = {}
            for h in headings:
                future = executor.submit(expand_one, h)
                futures[future] = h
                time.sleep(1.0)
            for future in concurrent.futures.as_completed(
                futures
            ):
                heading, expanded = future.result()
                expanded_results[heading] = expanded
                print(
                    f"[Expand] Done: {heading} — "
                    f"{len(expanded)} chars"
                )

        self._update_job(job_id, "assembling")

        # Assembly — preserve original heading order
        note_lines = [
            f"# 🎯 {lecture_title}",
            f"> 📚 Complete exam notes · "
            f"{len(headings)} topics",
            "",
            "---",
            ""
        ]

        sections_added = 0
        for heading in headings:
            expanded = expanded_results.get(heading, "")
            if not expanded or len(
                expanded.strip()
            ) < 20:
                continue

            note_lines.append(f"## 📌 {heading}")
            note_lines.append("")
            note_lines.append(expanded)
            note_lines.append("")
            note_lines.append("---")
            note_lines.append("")
            sections_added += 1

        print(
            f"[DetailedNote] sections_added: "
            f"{sections_added}"
        )

        if sections_added == 0:
            return (
                f"# {lecture_title}\n\n"
                f"Could not extract content. "
                f"Please try again."
            )

        combined_preview = "\n".join(note_lines)[:2000]
        try:
            tk_prompt = f"""You are writing the Key Takeaways
section of a university exam study note
in {language}.

FULL NOTE CONTENT:
{combined_preview}

YOUR TASK:
Write the 8 most exam-critical points a student
MUST know before walking into the exam.

SELECTION RULES:
1. Pick points that were emphasised or repeated
   in the material — these are highest priority.
2. Pick definitions that are likely to appear
   in exam questions.
3. Pick points that students commonly get wrong.
4. Pick points that connect multiple concepts.

FORMAT RULES:
1. Start with: ## 🗝️ Must Know For Exam
2. Write exactly 8 bullets.
3. Each bullet follows this pattern:
   - ⚡ **Term**: complete idea in under 10 words.
   
   CORRECT: 
   - ⚡ **extends keyword**: creates inheritance —
     child class gets all non-private parent members
   
   WRONG:
   - Understand how inheritance works in Java

4. Every bullet must be specific and factual.
   No generic study advice.
   No "understand", "remember", "know about".
   Only specific technical facts.

5. Bold all key terms.
6. Use ⚡ on every bullet — all are critical.
7. Keep total under 200 words.
8. End with: END_SECTION
"""
            tk_resp = self._ai.llm.invoke(tk_prompt)
            takeaways = tk_resp.content.strip().replace("END_SECTION", "").strip()
            takeaways = self.verify_takeaways_coverage(takeaways, headings)
            note_lines.append(f"\n{takeaways}")
        except Exception as e:
            print(f"[DetailedNote] Takeaways failed: {e}")

        final = "\n".join(note_lines)
        images = _fetch_images([pdf_id])
        final = _inject_images(final, images)
        final = clean_note_formatting(final)
        print(f"[DEBUG DetailedNote] sections_added: {sections_added}")
        print(f"[DEBUG DetailedNote] final note length: {len(final)}")
        print(f"[DetailedNote] DONE in {time.time()-t0:.1f}s - {len(final)} chars")
        return final

    def generate_structured_note(self, input_items: list, user_id: str,
                                  language: str = "English", job_id: str = None) -> str:
        """
        Generates one combined structured exam note from multiple inputs.
        input_items: list of {type: 'pdf_id'|'note_content', value: str}
        """
        import time
        t0 = time.time()
        self._update_job(job_id, "retrieving")

        all_detailed_content = []
        import concurrent.futures
        import time as _time

        def process_single_item(item):
            if item["type"] == "pdf_id":
                print(f"[StructuredNote] Starting PDF: {item['value'][:8]}...")
                return self.generate_detailed_note(
                    pdf_id=item["value"],
                    user_id=user_id,
                    language=language,
                    job_id=None
                )
            elif item["type"] == "note_content":
                content = item["value"]
                if self.is_already_detailed_note(content):
                    print("[StructuredNote] Skipping - already detailed note")
                    return content
                return content
            return None

        pdf_items = [i for i in input_items if i["type"] == "pdf_id"]
        note_items = [i for i in input_items if i["type"] == "note_content"]

        completed = 0
        total = len(pdf_items)
        t_parallel = _time.time()

        def process_with_counter(item):
            nonlocal completed
            result = process_single_item(item)
            if item["type"] == "pdf_id":
                completed += 1
                print(f"[StructuredNote] {completed}/{total} PDFs done")
            return result

        # Process PDFs in parallel - max 4 at once
        MAX_WORKERS = 4
        pdf_results = []
        if pdf_items:
            with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                pdf_results = list(executor.map(process_with_counter, pdf_items))

        # Note content items added directly (or could be parallelized too, but user asked for this)
        note_results = [process_with_counter(i) for i in note_items]

        all_detailed_content = [c for c in (pdf_results + note_results) if c]
        print(f"[DEBUG] all_detailed_content count: {len(all_detailed_content)}")
        for i, c in enumerate(all_detailed_content):
            print(f"[DEBUG] item {i}: {len(c) if c else 0} chars")
            if c:
                print(f"[DEBUG] item {i} preview: {c[:100]}")
        
        if pdf_items:
            print(f"[StructuredNote] All PDFs processed in {_time.time()-t_parallel:.1f}s")

        if not all_detailed_content:
            return "# Error\n\nNo content to process."

        self._update_job(job_id, "generating")
        combined = "\n\n---\n\n".join(all_detailed_content)
        print(f"[DEBUG] combined length: {len(combined)}")
        print(f"[DEBUG] combined preview: {combined[:200]}")
        
        raw_sections = re.split(r'\n## ', combined)
        print(f"[GEN] raw_sections count: {len(raw_sections)}")

        # If no ## headings found split by \n\n instead
        if len(raw_sections) <= 1:
            print("[GEN] No ## headings found. Splitting by paragraph breaks.")
            raw_sections = [
                s for s in combined.split('\n\n')
                if len(s.strip()) > 100
            ]
            print(f"[GEN] paragraph sections: {len(raw_sections)}")
            
        structured_sections = []

        for section in raw_sections:
            section_text = section[:3000]
            first_line = section.split('\n')[0].strip()
            heading = re.sub(r'^#+\s*📌?\s*', '', first_line).strip()
            
            if not heading or len(heading) < 3:
                heading = f"Section {len(structured_sections)+1}"
                print(f"[GEN] Empty heading, using: {heading}")

            condense_prompt = f"""You are condensing a
detailed study note into an exam revision note
in {language}.

TOPIC: {heading}

DETAILED CONTENT:
{section_text}

YOUR TASK:
Select and keep the most exam-critical bullets.
Do NOT rewrite. Do NOT summarise.
Pick the best bullets and keep them intact.

SELECTION RULES:
1. ALWAYS keep definition bullets
   (they start with ⚡ **Term**: definition)
2. ALWAYS keep comparison bullets
   (they have ⚠️ markers)
3. ALWAYS keep code examples
4. ALWAYS keep any bullet that explains WHY or HOW
5. CUT bullets that only state WHAT without depth
6. If same concept appears twice keep the
   better explained version only

COVERAGE RULE:
Cover every distinct concept in the content.
Do not skip any topic even if the content
for that topic is thin.

DEPTH RULE:
Each kept bullet stays 2 lines.
Do NOT shorten to one line.
The explanation is what makes it valuable.

FORBIDDEN — delete any bullet containing:
  "understand", "memorize", "focus on",
  "recognize", "prepare to", "be able to"
  These are generic and useless for revision.

Keep 6-8 bullets maximum per section.
Keep response under 400 words.
If content is empty output: SKIP_SECTION
End with: END_SECTION
"""
                
            try:
                resp = self._ai.llm.invoke(condense_prompt)
                condensed = resp.content.strip()
                condensed = condensed.replace("END_SECTION", "").strip()
                print(f"[GEN] '{heading}': {len(condensed)} chars returned")
            except Exception as e:
                print(f"[GEN ERROR] '{heading}' failed: {type(e).__name__}: {str(e)[:100]}")
                # On LLM failure use raw section text instead of skipping entirely
                condensed = section_text[:500]
                print(f"[GEN] Using fallback raw text for '{heading}'")
            
            if heading and condensed:
                structured_sections.append(f"## {heading}\n\n{condensed}")

        # If still empty after all fixes, build note directly from detailed content
        if not structured_sections:
            print("[GEN] structured_sections empty. Building from detailed content directly.")
            for i, detail in enumerate(all_detailed_content):
                if detail and len(detail.strip()) > 50:
                    preview = detail[:3000]
                    heading = f"Lecture {i+1} Content"
                    structured_sections.append(f"## 📌 {heading}\n\n{preview}")
                    print(f"[GEN] Added fallback section: {heading}")

        if not structured_sections:
            return "# Error\n\nCould not generate note."

        title_match = re.search(r'^# (.+)$', combined, re.MULTILINE)
        title = title_match.group(1) if title_match else "Structured Study Notes"
        title = re.sub(r'^#+\s*', '', title).strip()

        final_lines = [
            f"# 🎯 {title} - Exam Notes",
            f"> ⚡ Structured from {len(input_items)} source(s) · Exam ready",
            ""
        ]
        final_lines.extend(structured_sections)

        try:
            all_condensed = "\n\n".join(structured_sections)[:2000]
            tk_prompt = f"""Write Key Takeaways for this exam note in {language}.

{all_condensed}

Rules:
- Start with: ## 🗝️ Must Know For Exam
- Exactly 5 to 7 bullets
- Each bullet one complete sentence
- Bold all key terms
- Only the absolute most critical points
- End with: END_SECTION"""
            tk_resp = self._ai.llm.invoke(tk_prompt)
            tk = tk_resp.content.strip().replace("END_SECTION", "").strip()
            final_lines.append(f"\n{tk}")
        except Exception as e:
            print(f"[StructuredNote] Takeaways failed: {e}")

        final = clean_note_formatting("\n\n".join(final_lines))
        print(f"[StructuredNote] DONE in {time.time()-t0:.1f}s")
        self._update_job(job_id, "done")
        return final

    def _update_job(self, job_id: str | None, status: str):
        if not job_id: return
        try:
            conn = get_db_connection()
            if not conn: return
            cur = conn.cursor()
            cur.execute("UPDATE generation_jobs SET status = %s, updated_at = NOW() WHERE job_id = %s", (status, job_id))
            conn.commit()
            cur.close()
            conn.close()
        except Exception:
            pass

    def save_note_to_db(self, user_id, pdf_id, title, content):
        note_id = str(uuid.uuid4())
        try:
            conn = _get_conn()
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO notes (note_id, user_id, pdf_id, title, content) VALUES (%s, %s, %s, %s, %s)",
                (note_id, user_id, pdf_id, title, content)
            )
            conn.commit()
            cur.close()
            conn.close()
            return note_id
        except Exception as e:
            print(f"[save_note_to_db] Error: {e}")
            return None

    def update_note(self, note_id: str, content: str) -> bool:
        try:
            conn = _get_conn()
            cur = conn.cursor()
            cur.execute("UPDATE notes SET content=%s, updated_at=NOW() WHERE note_id=%s", (content, note_id))
            updated = cur.rowcount > 0
            conn.commit()
            cur.close()
            conn.close()
            return updated
        except Exception as e:
            print(f"update_note error: {e}")
            return False

    def update_note_folder(self, note_id: str, folder_id: str) -> bool:
        try:
            conn = _get_conn()
            cur = conn.cursor()
            cur.execute("UPDATE notes SET folder_id=%s, updated_at=NOW() WHERE note_id=%s", (folder_id, note_id))
            updated = cur.rowcount > 0
            conn.commit()
            cur.close()
            conn.close()
            return updated
        except Exception as e:
            print(f"update_note_folder error: {e}")
            return False

    def generate_note(self, pdf_ids: list[str], user_id: str, instruction: str = "", language: str = "English", ordering: str = "ai", job_id: str = None) -> str:
        print(f"\n{'='*60}")
        print(f"[PIPELINE START] user={user_id} docs={len(pdf_ids)}")
        print(f"[PIPELINE START] pdf_ids={pdf_ids}")
        print(f"{'='*60}")
        
        self._update_job(job_id, "analyzing")
        
        # Fetch all chunks
        conn = _get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # PHASE 1 - Per-document mind map extraction
        doc_trees = {}
        lecture_titles = set()
        for pdf_id in pdf_ids:
            cur.execute("SELECT content FROM document_chunks WHERE pdf_id = %s ORDER BY chunk_index ASC", (pdf_id,))
            chunks = cur.fetchall()
            if not chunks:
                continue
                
            merged_chunks = []
            pending_heading = ""
            for c in chunks:
                text = c["content"].strip()
                words = text.split()
                # Heading slide: < 20 words, no bullets, no numbers
                is_heading = (
                    len(words) < 20 
                    and not re.search(r'(?m)^\s*[-•*→>]\s', text) 
                    and not re.search(r'(?m)^\s*\d+[\.\)]\s', text)
                )
                
                if is_heading:
                    pending_heading += text + "\n\n"
                else:
                    if pending_heading:
                        text = pending_heading + text
                        pending_heading = ""
                    merged_chunks.append(text)
            
            if pending_heading:
                if merged_chunks:
                    merged_chunks[-1] += "\n\n" + pending_heading.strip()
                else:
                    merged_chunks.append(pending_heading.strip())
                    
            full_text = "\n".join(merged_chunks)
            
            print(f"[PHASE 1] pdf_id={pdf_id}")
            print(f"[PHASE 1] chunks fetched: {len(chunks)} (merged to {len(merged_chunks)})")
            print(f"[PHASE 1] total text length: {len(full_text)}")
            print(f"[PHASE 1] first 300 chars: {full_text[:300]}")
            
            prompt = f'''You are a document structure analyser.
Read the following lecture material and extract its complete topic hierarchy as JSON.

Return ONLY valid JSON. No explanation. No markdown fences.

JSON format:
{{
  "lecture_title": "string - the main lecture/module name",
  "chapters": [
    {{
      "title": "string - chapter or main heading name",
      "sections": [
        {{
          "title": "string - sub-section name",
          "content_lines": [
            "string - every single content line, bullet, sentence, or item under this section, EXACTLY as written in the source. Do not summarise. Do not skip any line."
          ],
          "has_code": true,
          "code_blocks": ["string - any code examples"],
          "image_pages": [1]
        }}
      ]
    }}
  ]
}}

RULES:
- Capture EVERY piece of content. Nothing skipped.
- content_lines must contain every bullet, sentence, numbered item exactly as in the source material.
- If a section has no sub-sections, put content directly in a section with title = chapter title.
- Preserve numbered lists as "1. text", "2. text" etc.
- Mark code blocks separately in code_blocks array.

Return ONLY the raw JSON object. No markdown fences. No explanation. No text before or after the JSON. Start your response with {{ and end with }}.

LECTURE MATERIAL:
{full_text}'''
            try:
                raw_response = self._llm_call(prompt, json_mode=True)
                
                print(f"[PHASE 1] raw LLM response length: {len(raw_response)}")
                print(f"[PHASE 1] raw response first 500 chars:")
                print(raw_response[:500])
                
                # Strip markdown fences
                clean_res = re.sub(r"^```(?:json)?\n|```$", "", raw_response, flags=re.MULTILINE).strip()
                
                try:
                    mindmap = json.loads(clean_res)
                except json.JSONDecodeError:
                    # Fallback: search for first { and last }
                    match = re.search(r'(\{.*\})', clean_res, re.DOTALL)
                    if match:
                        mindmap = json.loads(match.group(1))
                    else:
                        print(f"[ERROR] Failed to parse JSON. Raw response: {raw_response}")
                        raise

                print(f"[PHASE 1] parsed mindmap keys: {list(mindmap.keys())}")
                print(f"[PHASE 1] chapters found: {len(mindmap.get('chapters', []))}")
                for ch in mindmap.get('chapters', []):
                    secs = len(ch.get('sections', []))
                    print(f"  -> chapter: '{ch.get('title')}' | sections: {secs}")

                doc_trees[pdf_id] = mindmap

                if "lecture_title" in mindmap:
                    lecture_titles.add(mindmap["lecture_title"])
            except Exception as e:
                print(f"Error extracting JSON for {pdf_id}: {e}")

        # PHASE 2 - Cross-document topic merging
        self._update_job(job_id, "deduplicating")
        master_tree = []
        for pdf_id, data in doc_trees.items():
            for chapter in data.get("chapters", []):
                match_chap = None
                for m_chap in master_tree:
                    if title_similar(m_chap["title"], chapter["title"]):
                        match_chap = m_chap
                        break
                
                if match_chap:
                    # Merge sections
                    for sec in chapter.get("sections", []):
                        match_sec = None
                        for m_sec in match_chap["sections"]:
                            if title_similar(m_sec["title"], sec["title"]):
                                match_sec = m_sec
                                break
                        if match_sec:
                            match_sec["content_lines"].extend(sec.get("content_lines", []))
                            match_sec["code_blocks"].extend(sec.get("code_blocks", []))
                            match_sec["image_pages"].extend(sec.get("image_pages", []))
                        else:
                            match_chap["sections"].append(sec)
                else:
                    master_tree.append(chapter)
        
        # FALLBACK: If master_tree is empty (extraction failed), create a draft structure
        if not master_tree:
            print("[generate_note] Master tree empty, using fallback extraction...")
            all_content_lines = []
            for pdf_id in pdf_ids:
                cur.execute("SELECT content FROM document_chunks WHERE pdf_id = %s ORDER BY chunk_index ASC", (pdf_id,))
                all_content_lines.extend([c["content"] for c in cur.fetchall()])
            
            if all_content_lines:
                master_tree.append({
                    "title": "Main Content",
                    "sections": [{
                        "title": "Document Summary",
                        "content_lines": all_content_lines[:100], # Don't overwhelm, Phase 4 will split anyway
                        "code_blocks": [],
                        "image_pages": []
                    }]
                })
        
        # Deduplicate content lines within merged sections
        for chapter in master_tree:
            for sec in chapter.get("sections", []):
                unique_lines = []
                for line in sec.get("content_lines", []):
                    found_dup = False
                    for i, u_line in enumerate(unique_lines):
                        if line_similar(u_line, line):
                            found_dup = True
                            if len(line) > len(u_line):
                                unique_lines[i] = line
                            break
                    if not found_dup:
                        unique_lines.append(line)
                sec["content_lines"] = unique_lines

        # PHASE 3 - Content collection per leaf node
        self._update_job(job_id, "generating")
        for chapter in master_tree:
            for sec in chapter.get("sections", []):
                classified = []
                for line in sec.get("content_lines", []):
                    cls = classify_line(line)
                    if not cls: continue
                    if cls["type"] == "paragraph":
                        words = cls["text"].split()
                        if len(words) > 60:
                            parts = cls["text"].split(". ")
                            for p in parts:
                                if p.strip(): classified.append({"type": "bullet", "text": p.strip()})
                        else:
                            classified.append(cls)
                    else:
                        classified.append(cls)
                sec["classified"] = classified

        # PHASE 4 - Intelligence expansion per section
        for chapter in master_tree:
            for sec in chapter.get("sections", []):
                classified_lines = sec.get("classified", [])
                if not classified_lines:
                    sec["expanded_content"] = ""
                    continue

                content_str = "\n".join(c["text"] for c in classified_lines)
                
                # Split if > 3000 chars
                chunks = []
                while len(content_str) > 3000:
                    split_idx = content_str.rfind("\n", 0, 3000)
                    if split_idx == -1: split_idx = 3000
                    chunks.append(content_str[:split_idx])
                    content_str = content_str[split_idx:].strip()
                if content_str:
                    chunks.append(content_str)

                expanded_parts = []
                for chk in chunks:
                    prompt = f'''You are NotesGPT - expert academic note writer for university exam preparation.

Your job is to take raw lecture content and produce clean, complete, exam-ready bullet points.

SECTION TOPIC: {sec.get("title", "")}

RAW CONTENT FROM LECTURE MATERIALS:
{chk}

RULES - follow every one exactly:
1. Output ONLY bullet points. No paragraphs. No essays.
2. Each bullet must be 2-4 lines long.
3. Bold all key terms using **term**.
4. Mark critical exam points with ⚡ at bullet start.
5. Use 💡 for examples or analogies.
6. Use ⚠️ for common confusions or mistakes.
7. Include EVERY point from the raw content above.
   Do not skip any item. Do not merge two items into one.
8. CRITICAL - if any raw content line is under 15 words or only states WHAT without WHY or HOW:
   Expand it into a full 2-3 sentence explanation.
   Use your knowledge to make it fully understandable.
   The student must not need the original slides.
9. Numbered items from source stay numbered.
10. Code examples: keep them in a code block and add a one-line comment explaining what each part does.
11. If source content contains a comparison table, preserve the comparison structure. Format as Left concept vs Right concept with paired bullet points. Never flatten table rows into separate numbered items.
12. End with exactly: END_SECTION

Output only the bullet points. No heading. No intro text.'''
                    res = self._llm_call(prompt)
                    res = res.replace("END_SECTION", "").strip()
                    expanded_parts.append(res)
                
                sec["expanded_content"] = "\n".join(expanded_parts)

        # PHASE 5 - Tree-to-note assembly
        self._update_job(job_id, "finalising")
        
        main_title = " · ".join(list(lecture_titles)) if lecture_titles else "Study Notes"
        doc_count = len(pdf_ids)
        chap_count = len(master_tree)
        sec_count = sum(len(c.get("sections", [])) for c in master_tree)

        note_lines = []
        note_lines.append(f"# {main_title}")
        note_lines.append(f"> 📚 {doc_count} document(s) · {chap_count} chapters · {sec_count} sections\n")

        for chapter in master_tree:
            note_lines.append(f"## 📌 {chapter.get('title', '')}\n")
            for sec in chapter.get("sections", []):
                note_lines.append(f"### {sec.get('title', '')}\n")
                note_lines.append(sec.get("expanded_content", "") + "\n")
                
                for cb in sec.get("code_blocks", []):
                    note_lines.append(f"```java\n{cb}\n```\n")
                
                for p in sec.get("image_pages", []):
                    note_lines.append(f"[IMG: page {p}]\n")

        assembled_str = "\n".join(note_lines)
        
        # Takeaways
        first_2k = assembled_str[:2000]
        prompt = f'''You are NotesGPT. Read the following study notes and write the ## 🗝️ Key Takeaways section.
Write 6-8 bullet points. Start with ## 🗝️ Key Takeaways. End with END_TAKEAWAYS.

NOTES:
{first_2k}'''
        takeaways = self._llm_call(prompt).replace("END_TAKEAWAYS", "").strip()
        assembled_str += f"\n\n{takeaways}"

        # Inject images
        cur.execute("SELECT pdf_id, image_data, media_type, page_number FROM document_images WHERE pdf_id = ANY(%s)", (pdf_ids,))
        img_rows = cur.fetchall()
        img_dict = {}
        for r in img_rows:
            img_dict[r["page_number"]] = r

        def replace_img(match):
            pg = int(match.group(1))
            if pg in img_dict:
                img = img_dict[pg]
                b64 = img["image_data"]
                mt = img["media_type"]
                return (f'\n<div style="text-align:center;margin:16px 0;">'
                        f'<img src="data:{mt};base64,{b64}" '
                        f'style="max-width:100%;border-radius:8px;'
                        f'box-shadow:0 4px 12px rgba(0,0,0,0.12);" '
                        f'alt="Figure from page {pg}" />'
                        f'<p style="font-size:11px;color:#888;margin-top:6px;">'
                        f'Source: Page {pg}</p></div>\n')
            return ""

        assembled_str = re.sub(r"\[IMG: page (\d+)\]", replace_img, assembled_str)
        assembled_str = clean_note_formatting(assembled_str)

        self._update_job(job_id, "done")
        cur.close()
        conn.close()
        return assembled_str

    def refine_text(self, pdf_id: str, selected_text: str, instruction: str, loop_number: int = 1, allow_outside: bool = False, conversation_history: list = None) -> dict:
        conn = _get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT content FROM document_chunks WHERE pdf_id = %s", (pdf_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        context_chunks = []
        if loop_number == 1 or not allow_outside:
            # Manual keyword scorer first
            query = selected_text + " " + instruction
            query_words = [w.lower() for w in re.findall(r"\b[a-zA-Z]{3,}\b", query) if w.lower() not in STOPWORDS]

            def _score(chunk_text):
                lower = chunk_text.lower()
                score = sum(lower.count(w) * 2 for w in query_words)
                if selected_text.lower()[:40] in lower:
                    score += 25
                return score

            scored = sorted(rows, key=lambda r: _score(r["content"]), reverse=True)
            context_chunks = [r["content"] for r in scored[:5] if _score(r["content"]) > 0]

            # Vector fallback
            if not context_chunks:
                try:
                    qe = self._ai.embeddings.embed_query(query)
                    conn2 = _get_conn()
                    cur2 = conn2.cursor()
                    cur2.execute("SELECT content FROM document_chunks WHERE pdf_id = %s ORDER BY embedding <=> %s::vector LIMIT 5", (pdf_id, "[" + ",".join(str(x) for x in qe) + "]"))
                    context_chunks = [r[0] for r in cur2.fetchall()]
                    cur2.close()
                    conn2.close()
                except Exception:
                    pass

        context_from_chunks = "\n\n".join(context_chunks)
        hist_str = ""
        if conversation_history:
            for msg in conversation_history:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                hist_str += f"{role.capitalize()}: {content}\n"

        if allow_outside and loop_number >= 2:
            prompt = f'''You are a knowledgeable study tutor helping a student.
You have full AI knowledge.
SELECTED TEXT: "{selected_text}"
QUESTION: {instruction}
CONVERSATION SO FAR:
{hist_str}

Respond as an intelligent tutor. Format as structured bullets:
## 📌 [topic]
> [one line summary]
- ⚡ **[key point]**: explanation
- **[point]**: explanation
- 💡 **[example]**: example

End with: END_REFINE'''
        else:
            prompt = f'''You are a knowledgeable study tutor helping a student 
understand their lecture material.

The student has highlighted this part of their structured note:
"{selected_text}"

Their question or request: {instruction}

RELEVANT CONTEXT FROM THEIR UPLOADED MATERIALS:
{context_from_chunks}

CONVERSATION SO FAR:
{hist_str}

Answer as a warm, intelligent tutor would. Your answer 
should feel like a teacher sitting next to the student 
and explaining clearly - not like a search result.
Answer ONLY using the provided material context.

Format your answer as structured note bullets:
## 📌 [topic of selected text]
> [one line stating what this response covers]
- ⚡ **[key point]**: full 2-4 line explanation
- **[another point]**: explanation
- 💡 **[example]**: concrete illustration

Be thorough. If the student seems confused, explain 
from first principles. Cover WHY not just WHAT.
End with: END_REFINE'''

        res = self._llm_call_with_retry(
            prompt,
            max_retries=3,
            initial_wait=10
        )

        if not res:
            return {
                "refined_content":
                "The AI is busy. Please wait "
                "30 seconds and try again.",
                "loop_number": loop_number,
                "should_ask_outside": False
            }

        res = res.replace("END_REFINE", "").strip()

        return {
            "refined_content": res,
            "loop_number": loop_number,
            "should_ask_outside": loop_number >= 2 and not allow_outside
        }

    def summarize_prompts(self, prompts: list[str], original_text: str = None) -> str:
        text = prompts[0] if prompts else "Refined content"
        res = self._llm_call(f"Summarize this into a 2-5 word topic label: {text}")
        return res

    def discuss_note(self, note_content: str, user_question: str, pdf_id: str = None, conversation_history: list = None) -> dict:
        hist_str = ""
        if conversation_history:
            for msg in conversation_history:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                hist_str += f"{role.capitalize()}: {content}\n"
        
        prompt = f'''You are a study tutor. Answer the student's question based on their notes.
NOTE CONTENT:
{note_content[:4000]}

QUESTION: {user_question}
CONVERSATION: {hist_str}

Answer concisely.
'''
        res = self._llm_call(prompt)
        return {"refined_content": res}

    def process_file(
        self, file_bytes: bytes, file_id: str, original_filename: str
    ) -> dict:
        fname_lower = original_filename.lower()
        is_pptx = fname_lower.endswith(".pptx")
        is_md_txt = fname_lower.endswith((".md", ".txt"))
        ext = ".pptx" if is_pptx else (".pdf" if not is_md_txt else fname_lower[-3:])

        save_dir = "documents"
        os.makedirs(save_dir, exist_ok=True)
        safe_name = f"{file_id}{ext}"
        file_path = os.path.join(save_dir, safe_name)
        with open(file_path, "wb") as f:
            f.write(file_bytes)

        full_text = ""
        extracted_images = []

        try:
            if is_pptx:
                from pptx import Presentation
                prs = Presentation(BytesIO(file_bytes))
                for slide_num, slide in enumerate(prs.slides):
                    for shape in slide.shapes:
                        if hasattr(shape, "text") and shape.text.strip():
                            full_text += shape.text.strip() + "\n"
                    full_text += "\n"

            elif is_md_txt:
                full_text = file_bytes.decode("utf-8", errors="ignore")

            else:
                import fitz
                import time as _time
                _t0 = _time.time()
                doc = fitz.open(stream=file_bytes, filetype="pdf")
                for page_num, page in enumerate(doc):
                    page_text = page.get_text()
                    full_text += page_text + "\n"
                doc.close()
                print(f"[TIMER] text extraction: {_time.time()-_t0:.2f}s")

            extracted_images = self._extract_images(file_bytes, original_filename)

            import time as _time
            _t1 = _time.time()
            from langchain_text_splitters import RecursiveCharacterTextSplitter
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=1200, chunk_overlap=200
            )
            chunks = splitter.split_text(full_text) or ["No readable text found."]
            print(f"[TIMER] chunking ({len(chunks)} chunks): {_time.time()-_t1:.2f}s")

            conn = _get_conn()
            cur = conn.cursor()

            cur.execute("""
                CREATE TABLE IF NOT EXISTS document_images (
                    id TEXT PRIMARY KEY,
                    pdf_id TEXT,
                    image_data TEXT,
                    media_type TEXT,
                    page_number INTEGER,
                    caption TEXT
                )
            """)

            for img in extracted_images:
                cur.execute(
                    """
                    INSERT INTO document_images (id, pdf_id, image_data, media_type, page_number, caption)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (str(uuid.uuid4()), file_id, img["image_data"],
                     img["media_type"], img["page_or_slide"], img.get("caption", "")),
                )

            print(f"[process_file] Vectorising {len(chunks)} chunks for {file_id}...")
            _t2 = _time.time()
            embeddings = self._ai.embeddings.embed_documents(chunks)
            print(f"[TIMER] embeddings ({len(chunks)} chunks): {_time.time()-_t2:.2f}s")

            from psycopg2.extras import execute_values
            _t3 = _time.time()
            data_list = []
            for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
                page_hint = max(1, int((i / len(chunks)) * max(1, len(full_text) // 2000)))
                data_list.append((
                    str(uuid.uuid4()),
                    file_id,
                    i,
                    chunk_text,
                    "[" + ",".join(str(x) for x in embedding) + "]",
                    json.dumps({"source": original_filename, "page": page_hint}),
                ))

            execute_values(cur, """
                INSERT INTO document_chunks (id, pdf_id, chunk_index, content, embedding, metadata)
                VALUES %s
                ON CONFLICT DO NOTHING
            """, data_list)

            conn.commit()
            cur.close()
            conn.close()
            print(f"[TIMER] DB insert ({len(data_list)} rows): {_time.time()-_t3:.2f}s")

        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[process_file] ERROR for {original_filename}: {e}")
            try:
                conn.close()
            except Exception:
                pass
            return {"status": "error", "message": str(e)}

        return {
            "status": "success",
            "pdf_url": f"/documents/{safe_name}",
            "extracted_text": full_text[:500],
            "image_count": len(extracted_images),
        }

    def _extract_images(self, file_bytes: bytes, filename: str) -> list[dict]:
        results = []
        fname_lower = filename.lower()

        try:
            if fname_lower.endswith(".pdf"):
                import fitz
                doc = fitz.open(stream=file_bytes, filetype="pdf")
                for page_num, page in enumerate(doc):
                    for img in page.get_images():
                        try:
                            xref = img[0]
                            base_img = doc.extract_image(xref)
                            results.append({
                                "image_data": base64.b64encode(base_img["image"]).decode(),
                                "media_type": f"image/{base_img['ext']}",
                                "page_or_slide": page_num + 1,
                                "caption": "",
                            })
                        except Exception:
                            pass
                doc.close()

            elif fname_lower.endswith(".pptx"):
                from pptx import Presentation
                prs = Presentation(BytesIO(file_bytes))
                for slide_num, slide in enumerate(prs.slides):
                    for shape in slide.shapes:
                        if shape.shape_type == 13:
                            try:
                                results.append({
                                    "image_data": base64.b64encode(shape.image.blob).decode(),
                                    "media_type": shape.image.content_type,
                                    "page_or_slide": slide_num + 1,
                                    "caption": "",
                                })
                            except Exception:
                                pass
        except Exception as e:
            print(f"[_extract_images] {e}")

        return results[:15]

    def get_images_for_pdf(self, pdf_id: str) -> list[dict]:
        try:
            conn = _get_conn()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                "SELECT image_data, media_type, page_number, caption FROM document_images WHERE pdf_id = %s ORDER BY page_number ASC",
                (pdf_id,),
            )
            rows = [dict(r) for r in cur.fetchall()]
            cur.close()
            conn.close()
            return rows
        except Exception as e:
            print(f"[get_images_for_pdf] ERROR: {e}")
            return []

    def create_folder(self, user_id: str, name: str) -> dict | None:
        try:
            conn = _get_conn()
            cur = conn.cursor()
            folder_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO folders (id, user_id, name) VALUES (%s, %s, %s) RETURNING id",
                (folder_id, user_id, name),
            )
            conn.commit()
            cur.close()
            conn.close()
            return {"id": folder_id, "name": name}
        except Exception as e:
            print(f"[create_folder] ERROR: {e}")
            return None

    def get_all_folders(self, user_id: str) -> list[dict]:
        try:
            conn = _get_conn()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                "SELECT * FROM folders WHERE user_id = %s ORDER BY created_at DESC",
                (user_id,),
            )
            rows = [dict(r) for r in cur.fetchall()]
            cur.close()
            conn.close()
            return rows
        except Exception as e:
            print(f"[get_all_folders] ERROR: {e}")
            return []

    def get_all_notes(
        self, user_id: str, folder_id: str = None
    ) -> list[dict]:
        try:
            conn = _get_conn()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            query = "SELECT note_id, title, created_at, note_type, is_in_folder, folder_id FROM notes WHERE user_id = %s"
            params = [user_id]
            if folder_id:
                query += " AND folder_id = %s"
                params.append(folder_id)
            query += " ORDER BY updated_at DESC"
            cur.execute(query, tuple(params))
            rows = [dict(r) for r in cur.fetchall()]
            cur.close()
            conn.close()
            return rows
        except Exception as e:
            print(f"[get_all_notes] ERROR: {e}")
            return []

    def validate_note_content(
        self,
        content: str,
        pdf_ids: list = None
    ) -> bool:
        if not content or len(
            content.strip()
        ) < 30:
            print("[Validate] Empty - FAIL")
            return False
        print(
            f"[Validate] {len(content)} chars - PASS"
        )
        return True
  
    def save_note_to_db(self, user_id: str, pdf_id: str | None, title: str, content: str) -> str | None:
        try:
            conn = _get_conn()
            cur = conn.cursor()
            note_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO notes (note_id, user_id, pdf_id, title, content) VALUES (%s, %s, %s, %s, %s) RETURNING note_id",
                (note_id, user_id, pdf_id, title, content),
            )
            conn.commit()
            cur.close()
            conn.close()
            return note_id
        except Exception as e:
            print(f"[save_note_to_db] ERROR: {e}")
            return None

note_service = NoteService()
