"""
NeuraNote — Member 3: Structured Note Generation
services.py — FULL REBUILD (5-Phase Mind Map Pipeline)
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
            model_name = (os.getenv("OPENROUTER_MODEL") or "openai/gpt-4o-mini").strip()
            if not api_key:
                raise EnvironmentError("OPENROUTER_API_KEY is not set.")
            print(f"[AIService] Initializing LLM: {model_name}")
            self._llm = ChatOpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1",
                model=model_name,
                temperature=0,
                timeout=120,
                max_tokens=800
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
            print(f"[LLM ERROR] {e}")
            return "{}" if json_mode else ""

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
        MANUAL ALGORITHM — Jaccard chapter merging.
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
        prompt = f"""Read this lecture material and extract the topic structure as JSON.

CRITICAL: Return ONLY raw JSON. 
Start your response with {{ and end with }}.
No markdown fences. No explanation. Nothing before {{.

Expected JSON structure:
{{
  "lecture_title": "main lecture name if visible, else empty string",
  "chapters": [
    {{
      "title": "chapter or main heading name",
      "sections": [
        {{
          "title": "sub-section name",
          "content_lines": [
            "every single content line exactly as written in source"
          ],
          "has_code": true,
          "code_blocks": ["any code examples found"],
          "image_pages": [1, 3]
        }}
      ]
    }}
  ]
}}

Rules:
- Capture EVERY content line. Nothing skipped.
- content_lines = every bullet, sentence, numbered item exactly as written.
- Numbered lists stay as "1. text", "2. text".
- If a chapter has no sub-sections, create one section with title matching the chapter title.
- has_code is true only if actual code exists.
- image_pages lists page numbers where images appear.
- Start response with {{ immediately. Nothing before it.

MATERIAL:
{chunk_text}"""
        try:
            response = self._ai.llm.invoke(prompt)
            return self.safe_parse_json(response.content)
        except Exception as e:
            print(f"[MindMap] LLM call failed: {e}")
            return {"lecture_title": "", "chapters": []}

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
        MANUAL ALGORITHM — Content line classifier.
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

        prompt = f"""You are NotesGPT writing university exam study notes in {language}.

SECTION TOPIC: {section_title}

RAW LECTURE CONTENT:
{content_str}

YOUR TASK:
Convert the raw content into clean exam-ready bullets.

STRICT RULES — follow every one:
1. Output bullet points ONLY. Zero paragraphs.
2. Each bullet MUST be 2 to 4 lines long. One-line bullets are NOT allowed.
3. Bold ALL key terms using **term**.
4. Start critical exam points with ⚡
5. Start examples or analogies with 💡
6. Start common confusions with ⚠️
7. Include EVERY point from raw content. Do not skip any item.
8. If any line is under 15 words OR only states WHAT without explaining WHY or HOW:
   Expand it into a 2-3 sentence explanation using your own knowledge.
9. Numbered lists from source stay numbered.
10. If source has code examples, keep as code block and add one explanatory comment line.
11. If source content contains a comparison table, preserve the comparison structure.
    Format as Left concept vs Right concept with paired bullet points.
    Never flatten table rows into separate numbered items.
12. Keep response under 500 words.
13. End with exactly: END_SECTION

Output bullet points only. No heading. No intro sentence. Just bullets."""
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

    def generate_detailed_note(self, pdf_id: str, user_id: str,
                                language: str = "English", job_id: str = None) -> str:
        """
        Full pipeline for one PDF:
        Phase 1 — fetch chunks, Phase 2 — mind map,
        Phase 3 — classify, Phase 4 — expand, Phase 5 — assemble.
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
        mindmap = self.extract_mindmap_chunked(full_text)
        chapters = mindmap.get("chapters", [])
        lecture_title = mindmap.get("lecture_title", "Study Notes")

        if not chapters:
            return f"# {lecture_title}\n\nNo structure found."

        print(f"[DetailedNote] {len(chapters)} chapters")
        self._update_job(job_id, "expanding")

        all_sections = []
        for ch in chapters:
            for sec in ch.get("sections", []):
                classified = self.classify_section_content(sec)
                all_sections.append({
                    "chapter_title": ch["title"],
                    "section_title": sec["title"],
                    "classified": classified,
                    "code_blocks": sec.get("code_blocks", []),
                    "image_pages": sec.get("image_pages", []),
                })

        print(f"[DetailedNote] {len(all_sections)} sections to expand")

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
                futures = [
                    executor.submit(self.expand_section, s["section_title"], s["classified"], language)
                    for s in all_sections
                ]
                expanded_texts = [f.result() for f in futures]
        except Exception as e:
            print(f"[DetailedNote] Parallel failed, using sequential: {e}")
            expanded_texts = [
                self.expand_section(s["section_title"], s["classified"], language)
                for s in all_sections
            ]

        for i, section in enumerate(all_sections):
            section["expanded"] = expanded_texts[i]

        self._update_job(job_id, "assembling")

        note_lines = [
            f"# {lecture_title}",
            f"> 📚 Detailed notes · {len(chapters)} chapters · {len(all_sections)} sections",
            ""
        ]
        current_chapter = None
        for section in all_sections:
            ch_title = section["chapter_title"]
            if ch_title != current_chapter:
                current_chapter = ch_title
                note_lines.append(f"\n## 📌 {current_chapter}\n")
            note_lines.append(f"### {section['section_title']}\n")
            note_lines.append(section["expanded"])
            for code in section.get("code_blocks", []):
                if code.strip():
                    note_lines.append(f"\n```java\n{code}\n```\n")
            for page in section.get("image_pages", []):
                note_lines.append(f"\n[IMG: page {page}]\n")
            note_lines.append("\n---\n")

        combined_preview = "\n".join(note_lines)[:2000]
        try:
            tk_prompt = f"""Based on this study note content, write the Key Takeaways section in {language}.

CONTENT:
{combined_preview}

Rules:
- Start with: ## 🗝️ Key Takeaways
- Write exactly 6 to 8 bullet points
- Each bullet is one complete exam-ready sentence
- Bold all key terms
- Cover the most critical points across all topics
- End with: END_SECTION"""
            tk_resp = self._ai.llm.invoke(tk_prompt)
            takeaways = tk_resp.content.strip().replace("END_SECTION", "").strip()
            note_lines.append(f"\n{takeaways}")
        except Exception as e:
            print(f"[DetailedNote] Takeaways failed: {e}")

        final = "\n".join(note_lines)
        images = _fetch_images([pdf_id])
        final = _inject_images(final, images)
        final = clean_note_formatting(final)
        print(f"[DetailedNote] DONE in {time.time()-t0:.1f}s — {len(final)} chars")
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
                    print("[StructuredNote] Skipping — already detailed note")
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

        # Process PDFs in parallel — max 4 at once
        MAX_WORKERS = 4
        pdf_results = []
        if pdf_items:
            with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                pdf_results = list(executor.map(process_with_counter, pdf_items))

        # Note content items added directly (or could be parallelized too, but user asked for this)
        note_results = [process_with_counter(i) for i in note_items]

        all_detailed_content = [c for c in (pdf_results + note_results) if c]
        
        if pdf_items:
            print(f"[StructuredNote] All PDFs processed in {_time.time()-t_parallel:.1f}s")

        if not all_detailed_content:
            return "# Error\n\nNo content to process."

        self._update_job(job_id, "generating")
        combined = "\n\n---\n\n".join(all_detailed_content)
        sections = re.split(r'\n## ', combined)
        structured_sections = []

        for section in sections:
            if not section.strip() or len(section) < 50:
                continue
            section_text = section[:3000]
            condense_prompt = f"""You are creating a targeted exam revision note in {language}.

Condense this detailed content into the most important exam-ready bullet points.

CONTENT:
{section_text}

RULES:
1. Keep ONLY the most exam-critical points.
2. Maximum 6 bullets per section.
3. Each bullet 1 to 2 lines — concise not detailed.
4. Bold key terms. Use ⚡ for must-know points.
5. Keep definitions. Keep key mechanisms.
6. This is for last-minute exam revision.
7. Keep response under 300 words.
8. End with: END_SECTION

Output condensed bullets only. No heading."""
            try:
                resp = self._ai.llm.invoke(condense_prompt)
                condensed = resp.content.strip().replace("END_SECTION", "").strip()
                first_line = section.split('\n')[0].strip()
                heading = re.sub(r'^#+\s*', '', first_line).strip()
                if heading and condensed:
                    structured_sections.append(f"## {heading}\n\n{condensed}")
            except Exception as e:
                print(f"[StructuredNote] Section failed: {e}")

        if not structured_sections:
            return "# Error\n\nCould not generate note."

        title_match = re.search(r'^# (.+)$', combined, re.MULTILINE)
        title = title_match.group(1) if title_match else "Structured Study Notes"
        title = re.sub(r'^#+\s*', '', title).strip()

        final_lines = [
            f"# 🎯 {title} — Exam Notes",
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
        
        # PHASE 1 — Per-document mind map extraction
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
  "lecture_title": "string — the main lecture/module name",
  "chapters": [
    {{
      "title": "string — chapter or main heading name",
      "sections": [
        {{
          "title": "string — sub-section name",
          "content_lines": [
            "string — every single content line, bullet, sentence, or item under this section, EXACTLY as written in the source. Do not summarise. Do not skip any line."
          ],
          "has_code": true,
          "code_blocks": ["string — any code examples"],
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

        # PHASE 2 — Cross-document topic merging
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

        # PHASE 3 — Content collection per leaf node
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

        # PHASE 4 — Intelligence expansion per section
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
                    prompt = f'''You are NotesGPT — expert academic note writer for university exam preparation.

Your job is to take raw lecture content and produce clean, complete, exam-ready bullet points.

SECTION TOPIC: {sec.get("title", "")}

RAW CONTENT FROM LECTURE MATERIALS:
{chk}

RULES — follow every one exactly:
1. Output ONLY bullet points. No paragraphs. No essays.
2. Each bullet must be 2-4 lines long.
3. Bold all key terms using **term**.
4. Mark critical exam points with ⚡ at bullet start.
5. Use 💡 for examples or analogies.
6. Use ⚠️ for common confusions or mistakes.
7. Include EVERY point from the raw content above.
   Do not skip any item. Do not merge two items into one.
8. CRITICAL — if any raw content line is under 15 words or only states WHAT without WHY or HOW:
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

        # PHASE 5 — Tree-to-note assembly
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
and explaining clearly — not like a search result.
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

        res = self._llm_call(prompt)
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
