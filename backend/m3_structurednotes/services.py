"""
NeuraNote — Member 3: Structured Note Generation
services.py — FULL REBUILD (Production-Ready Hybrid Pipeline)
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
from psycopg2.extras import RealDictCursor, execute_values

from .database import get_db_connection

load_dotenv()

# ─────────────────────────────────────────────────────────────
#  SECTION 1 — AI SERVICE (lazy-loaded, singleton pattern)
# ─────────────────────────────────────────────────────────────

class AIService:
    def __init__(self):
        self._embeddings = None
        self._llm = None

    @property
    def embeddings(self):
        if self._embeddings is None:
            from langchain_huggingface import HuggingFaceEmbeddings
            print("[AIService] Loading HuggingFace embeddings (all-MiniLM-L6-v2)...")
            self._embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        return self._embeddings

    @property
    def llm(self):
        if self._llm is None:
            from langchain_openai import ChatOpenAI
            api_key = os.getenv("OPENROUTER_API_KEY")
            model_name = os.getenv("OPENROUTER_MODEL", "google/gemini-flash-1.5-8b")
            if not api_key:
                raise EnvironmentError("OPENROUTER_API_KEY is not set. Add it to your .env file.")
            print(f"[AIService] Initializing LLM: {model_name}")
            self._llm = ChatOpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1",
                model=model_name,
                temperature=0,
                timeout=120,
            )
        return self._llm


# ─────────────────────────────────────────────────────────────
#  SECTION 2 — MANUAL ALGORITHM: TF-IDF KEYWORD EXTRACTION
# ─────────────────────────────────────────────────────────────

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

def extract_keywords_tfidf(text: str, top_n: int = 30) -> list[str]:
    words = re.findall(r"\b[a-zA-Z]{3,}\b", text)
    words = [w.lower() for w in words if w.lower() not in STOPWORDS]

    if not words:
        return []

    sentences = [s.strip() for s in re.split(r"[.!?]", text.lower()) if len(s.strip()) > 10]
    if not sentences:
        sentences = [text.lower()]

    N = len(sentences)
    word_counts = Counter(words)
    total_words = len(words)
    tfidf_scores = {}

    for word, count in word_counts.items():
        if count < 2:
            continue
        tf = count / total_words
        doc_freq = sum(1 for s in sentences if word in s)
        idf = math.log(N / (1 + doc_freq)) + 1
        tfidf_scores[word] = tf * idf

    sorted_kw = sorted(tfidf_scores.items(), key=lambda x: x[1], reverse=True)
    return [w for w, _ in sorted_kw[:top_n]]


# ─────────────────────────────────────────────────────────────
#  SECTION 3 — MANUAL ALGORITHM: CROSS-DOCUMENT DEDUPLICATION
# ─────────────────────────────────────────────────────────────

def _shingle(text: str, k: int = 3) -> set:
    tokens = re.findall(r"\b\w+\b", text.lower())
    if len(tokens) < k:
        return {tuple(tokens)}
    return {tuple(tokens[i:i+k]) for i in range(len(tokens) - k + 1)}

def jaccard_similarity(set_a: set, set_b: set) -> float:
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0.0

def deduplicate_points(points: list[dict], threshold: float = 0.55) -> list[dict]:
    unique = []
    unique_shingles = []

    for point in points:
        shingles = _shingle(point["text"])
        is_dup = False

        for i, existing_shingles in enumerate(unique_shingles):
            sim = jaccard_similarity(shingles, existing_shingles)
            if sim >= threshold:
                is_dup = True
                if len(point["text"]) > len(unique[i]["text"]):
                    unique[i] = point
                    unique_shingles[i] = shingles
                break

        if not is_dup:
            unique.append(point)
            unique_shingles.append(shingles)

    return unique


# ─────────────────────────────────────────────────────────────
#  SECTION 4 — MANUAL ALGORITHM: IMPORTANCE SCORING
# ─────────────────────────────────────────────────────────────

def score_importance(
    point_text: str,
    keywords: list[str],
    chunk_index: int,
    total_chunks: int,
) -> int:
    score = 0
    text_lower = point_text.lower()

    kw_hits = sum(1 for k in keywords if k in text_lower)
    score += min(kw_hits * 5, 25)

    word_count = len(point_text.split())
    if 8 <= word_count <= 30:
        score += 20
    elif 5 <= word_count <= 50:
        score += 10

    DEFINITION_MARKERS = [
        " is ", " are ", " means ", " refers to ",
        " defined as ", " known as ", " called ",
        " describes ", " represents ", " stands for ",
        ":", "=", " consist of "
    ]
    if any(m in text_lower for m in DEFINITION_MARKERS):
        score += 20

    if re.search(r"\d", point_text):
        score += 10

    SIGNAL_WORDS = [
        "important", "key", "critical", "essential",
        "fundamental", "note that", "remember", "significant",
        "major", "primary", "main", "crucial", "must", "always"
    ]
    sig_hits = sum(1 for w in SIGNAL_WORDS if w in text_lower)
    score += min(sig_hits * 5, 15)

    if total_chunks > 0 and (chunk_index / total_chunks) < 0.30:
        score += 10

    return min(score, 100)


# ─────────────────────────────────────────────────────────────
#  SECTION 5 — MANUAL ALGORITHM: POINT EXTRACTION
# ─────────────────────────────────────────────────────────────

def extract_points_from_chunk(
    chunk_text: str,
    chunk_index: int,
    doc_id: str,
    page_hint: int = 0,
) -> list[dict]:
    points = []
    lines = chunk_text.split("\n")

    for line in lines:
        line = line.strip()
        
        if len(line) < 15:
            continue

        if line.isupper() and len(line) < 80:
            points.append({
                "type": "heading",
                "text": line.title(),
                "doc_id": doc_id,
                "chunk_index": chunk_index,
                "page_hint": page_hint,
                "score": 0
            })
        elif line[0] in ("-", "•", "*", "→", ">"):
            clean = line.lstrip("-•*→> ").strip()
            if len(clean) >= 5:
                points.append({
                    "type": "bullet",
                    "text": clean,
                    "doc_id": doc_id,
                    "chunk_index": chunk_index,
                    "page_hint": page_hint,
                    "score": 0
                })
        elif re.match(r"^\d{1,2}[\.\)\:]", line):
            clean = re.sub(r"^\d{1,2}[\.\)\:]\s*", "", line).strip()
            if len(clean) >= 5:
                points.append({
                    "type": "numbered",
                    "text": clean,
                    "doc_id": doc_id,
                    "chunk_index": chunk_index,
                    "page_hint": page_hint,
                    "score": 0
                })
        elif len(line) > 30:
            points.append({
                "type": "sentence",
                "text": line,
                "doc_id": doc_id,
                "chunk_index": chunk_index,
                "page_hint": page_hint,
                "score": 0
            })

    return points


# ─────────────────────────────────────────────────────────────
#  SECTION 6 — MANUAL ALGORITHM: LECTURE-ORDER TOPIC CLUSTERING
# ─────────────────────────────────────────────────────────────

def cluster_topics(
    points: list[dict],
    keywords: list[str]
) -> dict[str, list[dict]]:
    n_clusters = min(8, max(3, len(keywords) // 3))

    buckets = {}
    kw_to_bucket = {}

    step = max(1, len(keywords) // n_clusters)
    for i in range(0, len(keywords), step):
        group = keywords[i : i + step]
        if not group:
            continue
        name = " & ".join(w.capitalize() for w in group[:2])
        buckets[name] = []
        for kw in group:
            kw_to_bucket[kw] = name

    buckets["General Concepts"] = []

    for point in points:
        text_lower = point["text"].lower()
        scores = defaultdict(int)

        for kw, bucket_name in kw_to_bucket.items():
            if kw in text_lower:
                scores[bucket_name] += 1

        best = max(scores, key=scores.get) if scores else "General Concepts"
        buckets[best].append(point)

    buckets = {k: v for k, v in buckets.items() if v}

    def bucket_order(item):
        _, pts = item
        return min(p["chunk_index"] for p in pts) if pts else float('inf')

    ordered = dict(sorted(buckets.items(), key=bucket_order))
    return ordered


# ─────────────────────────────────────────────────────────────
#  SECTION 7 — MANUAL ALGORITHM: SLIDING WINDOW SECTION BUILDER
# ─────────────────────────────────────────────────────────────

def build_section_content(
    points: list[dict],
    target_chars: int = 4500,
) -> tuple[str, list[dict]]:
    sorted_pts = sorted(points, key=lambda p: p.get("score", 0), reverse=True)
    included = []
    overflow = []
    char_count = 0

    for pt in sorted_pts:
        label = "⚡HIGH" if pt.get("score", 0) >= 60 else "MED" if pt.get("score", 0) >= 30 else "LOW"
        line = f"[{label}] {pt['text']}\n"
        if char_count + len(line) > target_chars and len(included) >= 3:
            overflow.append(pt)
        else:
            included.append(pt)
            char_count += len(line)

    content_str = "".join(
        f"[{'⚡HIGH' if p.get('score',0)>=60 else 'MED' if p.get('score',0)>=30 else 'LOW'}] {p['text']}\n"
        for p in included
    )
    return content_str, overflow


# ─────────────────────────────────────────────────────────────
#  SECTION 8 — MANUAL ALGORITHM: SEMANTIC IMAGE MATCHING
# ─────────────────────────────────────────────────────────────

def match_images_to_sections(
    images: list[dict],
    topic_groups: dict[str, list[dict]],
) -> dict[str, list[dict]]:
    section_pages = {}
    for name, pts in topic_groups.items():
        hints = [p.get("page_hint", 0) for p in pts if p.get("page_hint")]
        section_pages[name] = hints if hints else [0]

    result = {name: [] for name in topic_groups}

    for img in images:
        img_page = img.get("page_number", 0)
        best_section = None
        best_distance = float("inf")

        for name, pages in section_pages.items():
            if not pages:
                continue
            dist = min(abs(img_page - p) for p in pages)
            if dist < best_distance:
                best_distance = dist
                best_section = name

        if best_section:
            result[best_section].append(img)

    return result


# ─────────────────────────────────────────────────────────────
#  SECTION 9 — TEXT CLEANING
# ─────────────────────────────────────────────────────────────

def clean_note_formatting(text: str) -> str:
    text = re.sub(r"\s+-\s+\*\*", "\n- **", text)
    text = re.sub(r"(?<=[a-z.!?])\s+-\s+(?=[A-Z\*])", "\n- ", text)

    text = re.sub(r"([^\n])(##)", r"\1\n\n\2", text)
    text = re.sub(r"(## .+)\n([^\n])", r"\1\n\n\2", text)
    text = re.sub(r"\n(##)", r"\n\n\1", text)

    text = re.sub(r"([^\n])---", r"\1\n\n---", text)
    text = re.sub(r"---([^\n])", r"---\n\n\1", text)

    text = re.sub(r"\n{4,}", "\n\n\n", text)
    for emoji in ["⚡", "⚠️", "💡"]:
        text = re.sub(rf"(?<=[a-z.!?])\s+- {re.escape(emoji)}", f"\n- {emoji}", text)

    text = re.sub(r"^```(markdown)?\n|```$", "", text, flags=re.MULTILINE)
    return text.strip()


# ─────────────────────────────────────────────────────────────
#  SECTION 10 — DATABASE HELPERS
# ─────────────────────────────────────────────────────────────

def _get_conn():
    conn = get_db_connection()
    if not conn:
        raise RuntimeError("Database connection failed. Check DB_URL in .env")
    return conn

def _fetch_all_chunks_per_doc(pdf_ids: list[str]) -> dict[str, list[dict]]:
    conn = _get_conn()
    result = {}
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        for pdf_id in pdf_ids:
            cur.execute(
                """
                SELECT chunk_index, content,
                       COALESCE((metadata->>'page')::int, 0) AS page_hint
                FROM document_chunks
                WHERE pdf_id = %s
                ORDER BY chunk_index ASC
                """,
                (pdf_id,),
            )
            rows = cur.fetchall()
            result[pdf_id] = [dict(r) for r in rows]
        cur.close()
    finally:
        conn.close()
    return result

def _fetch_images(pdf_ids: list[str]) -> list[dict]:
    conn = _get_conn()
    images = []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        for pdf_id in pdf_ids:
            cur.execute(
                """
                SELECT image_data, media_type, page_number, caption
                FROM document_images
                WHERE pdf_id = %s
                ORDER BY page_number ASC
                """,
                (pdf_id,),
            )
            images.extend([dict(r) for r in cur.fetchall()])
        cur.close()
    finally:
        conn.close()
    return images[:20]


# ─────────────────────────────────────────────────────────────
#  SECTION 11 — CORE SERVICE CLASS
# ─────────────────────────────────────────────────────────────

class NoteService:
    def __init__(self):
        self._ai = AIService()

    def _llm_call(self, prompt: str) -> str:
        response = self._ai.llm.invoke(prompt)
        text = response.content.strip()
        text = text.replace("End_of_Notes", "").strip()
        text = text.replace("|||SECTION_END|||", "").strip()
        text = re.sub(r"^```(markdown)?\n|```$", "", text, flags=re.MULTILINE)
        return text

    def generate_note(
        self,
        pdf_ids: list[str],
        user_id: str,
        instruction: str = "",
        language: str = "English",
        ordering: str = "ai",
        job_id: str = None,
    ) -> str:
        print(f"\n[generate_note] Starting for {len(pdf_ids)} doc(s), user={user_id}")

        all_points = []
        total_chunks_global = 0

        # PASS 1 — PER-DOCUMENT EXTRACTION
        self._update_job(job_id, "retrieving")
        
        for pdf_id in pdf_ids:
            try:
                doc_chunks = _fetch_all_chunks_per_doc([pdf_id])
                chunks = doc_chunks.get(pdf_id, [])
            except RuntimeError as e:
                self._update_job(job_id, "failed")
                return f"# Error\n\n{e}"

            total_chunks_global += len(chunks)

            for chunk in chunks:
                chunk_pts = extract_points_from_chunk(
                    chunk_text=chunk["content"],
                    chunk_index=chunk["chunk_index"],
                    doc_id=pdf_id,
                    page_hint=chunk.get("page_hint", 0),
                )
                
                for pt in chunk_pts:
                    pt["score"] = score_importance(
                        point_text=pt["text"],
                        keywords=[],
                        chunk_index=pt["chunk_index"],
                        total_chunks=len(chunks),
                    )
                all_points.extend(chunk_pts)
            
            del chunks

        if not all_points:
            self._update_job(job_id, "failed")
            return "# Error\n\nNo content found for the selected materials."

        # PASS 2 — GLOBAL ORGANISATION
        self._update_job(job_id, "deduplicating")
        unique_points = deduplicate_points(all_points, threshold=0.55)

        self._update_job(job_id, "analyzing")
        combined_text = " ".join(p["text"] for p in unique_points)
        keywords = extract_keywords_tfidf(combined_text, top_n=30)

        for point in unique_points:
            point["score"] = score_importance(
                point_text=point["text"],
                keywords=keywords,
                chunk_index=point["chunk_index"],
                total_chunks=total_chunks_global,
            )

        topic_groups = cluster_topics(unique_points, keywords)

        images = _fetch_images(pdf_ids)
        section_images = match_images_to_sections(images, topic_groups)

        self._update_job(job_id, "generating")
        section_notes = []
        overflow_points = []

        for topic_name, points in topic_groups.items():
            combined_for_section = overflow_points + points
            overflow_points = []

            content_str, overflow_points = build_section_content(
                combined_for_section, target_chars=4500
            )

            if not content_str.strip():
                continue

            sec_imgs = section_images.get(topic_name, [])
            img_hints = "\n".join(
                f"[IMG: page {img['page_number']}]"
                for img in sec_imgs[:3]
            ) if sec_imgs else "None"

            prompt = f"""You are NotesGPT — expert academic note writer for university
exam preparation. Write one section of a structured study note
in {language}.

TOPIC SECTION: {topic_name}

SOURCE MATERIAL (labelled by importance):
{content_str}

IMAGE HINTS (place on their own line if relevant): {img_hints}

STRICT OUTPUT FORMAT — follow exactly:
1. Start immediately with: ## 📌 {topic_name}
2. Write ONLY bullet points — absolutely no paragraphs or essays
3. Each bullet must be 2-4 lines long. One-line bullets are forbidden.
4. Bold ALL key terms using **term**
5. Mark critical points with ⚡ at the start of the bullet
6. Use 💡 for concrete examples
7. Use ⚠️ for common mistakes or confusion points
8. Include EVERY piece of information from the source material
   Do NOT skip, merge, or summarise away any point
9. If any point in the source is underdeveloped (under 15 words,
   or lacks explanation of WHY or HOW), expand it into a clear
   2-3 sentence explanation using your own knowledge so the
   student fully understands without opening the original slides
10. Connect related points to show logical flow
11. End with exactly: End_of_Notes

The student is preparing for their final exam. After reading
this section alone they must know everything about {topic_name}
without needing to look at the original lecture materials.
"""
            try:
                raw = self._llm_call(prompt)
                clean = clean_note_formatting(raw)
                section_notes.append(clean)
            except Exception as e:
                print(f"[Phase 9] ERROR on '{topic_name}': {e}")
                fallback = f"## 📌 {topic_name}\n\n"
                for pt in sorted(points, key=lambda p: p.get("score", 0), reverse=True)[:8]:
                    fallback += f"- **{pt['text'][:60]}**: {pt['text']}\n\n"
                section_notes.append(fallback)

        if overflow_points:
            overflow_content = "\n".join(
                f"- {p['text']}" for p in overflow_points[:20]
            )
            section_notes.append(f"## 📌 Additional Concepts\n\n{overflow_content}")

        kw0 = keywords[0].capitalize() if len(keywords) > 0 else "Study"
        kw1 = keywords[1].capitalize() if len(keywords) > 1 else "Notes"
        title_line = f"# 🎯 {kw0} & {kw1} — Complete Study Notes"
        subtitle = (
            f"> 📚 {len(pdf_ids)} document(s) · {len(unique_points)} concepts · {len(section_notes)} sections\n"
        )

        self._update_job(job_id, "finalising")
        takeaway_text = self._generate_takeaways(section_notes, keywords, language)

        body = "\n\n---\n\n".join(section_notes)
        final_note = (
            title_line + "\n\n"
            + subtitle + "\n\n"
            + body + "\n\n"
            + takeaway_text
        )

        final_note = self._inject_images(final_note, images)
        final_note = clean_note_formatting(final_note)
        
        self._update_job(job_id, "done")
        return final_note

    def _generate_takeaways(self, section_notes: list[str], keywords: list[str], language: str) -> str:
        merged_for_takeaways = "\n\n".join(section_notes)[:3000]
        prompt = f"""You are NotesGPT writing the Key Takeaways section
of a structured study note in {language}.

CONTENT OF THE NOTE:
{merged_for_takeaways}

Write ONLY the ## 🗝️ Key Takeaways section.
These takeaways must be MEANINGFUL complete sentences
that a student can use to review the whole topic.

BAD takeaway (do not write like this):
- Input is a core concept in this material.

GOOD takeaway (write like this):
- ⚡ **Java I/O Streams**: Java uses streams as 
  communication channels between programs and I/O 
  devices. Every input and output operation in Java 
  goes through either a byte stream or character stream.

FORMAT:
## 🗝️ Key Takeaways

- ⚡ **[Concept]**: Full sentence explaining the most 
  important idea from the whole note. Must be specific 
  to the actual content, not generic.

Write 6 to 8 takeaways.
Each must reference actual content from the note.
Never write generic sentences like "X is a core concept".
Start with ## 🗝️ immediately.
End with |||SECTION_END|||
"""
        try:
            return self._llm_call(prompt)
        except Exception as e:
            print(f"[Takeaways] ERROR: {e}")
            return (
                "## 🗝️ Key Takeaways\n\n"
                + "\n".join(f"- **{kw.capitalize()}** is a core concept in this material." for kw in keywords[:6])
            )

    def _inject_images(self, note: str, images: list[dict]) -> str:
        for img in images:
            placeholder = f"[IMG: page {img['page_number']}]"
            if placeholder not in note:
                continue
            b64 = img.get("image_data", "")
            mt = img.get("media_type", "image/png")
            block = (
                f'\n<div style="text-align:center;margin:16px 0;">'
                f'<img src="data:{mt};base64,{b64}" '
                f'style="max-width:100%;border-radius:8px;'
                f'box-shadow:0 4px 12px rgba(0,0,0,0.12);" '
                f'alt="Figure from page {img["page_number"]}" />'
                f'<p style="font-size:11px;color:#888;margin-top:6px;">'
                f'Source: Page {img["page_number"]}</p></div>\n'
            )
            note = note.replace(placeholder, block)
        return note

    def _update_job(self, job_id: str | None, status: str):
        if not job_id:
            return
        try:
            conn = get_db_connection()
            if not conn:
                return
            cur = conn.cursor()
            cur.execute(
                "UPDATE generation_jobs SET status = %s, updated_at = NOW() WHERE job_id = %s",
                (status, job_id),
            )
            conn.commit()
            cur.close()
            conn.close()
        except Exception:
            pass


    def refine_text(
        self, pdf_id: str, selected_text: str, instruction: str
    ) -> dict:
        """
        HYBRID: Manual relevance scoring picks best context chunks.
        AI rewrites in structured note format.

        Refinement types (auto-detected from instruction):
          DEEP_EXPLAIN  — "explain", "confused", "what is"
          GIVE_EXAMPLE  — "example", "eg", "show me"
          REORGANIZE    — "organize", "structure", "format"
          SIMPLIFY      — "simpler", "shorter", "brief"
          GENERAL       — anything else
        """
        # ── Manual relevance scorer ──
        query = selected_text + " " + instruction
        query_words = [
            w.lower()
            for w in re.findall(r"\b[a-zA-Z]{3,}\b", query)
            if w.lower() not in STOPWORDS
        ]

        context_chunks = []
        try:
            conn = _get_conn()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                "SELECT content, chunk_index FROM document_chunks WHERE pdf_id = %s ORDER BY chunk_index ASC",
                (pdf_id,),
            )
            rows = cur.fetchall()
            cur.close()
            conn.close()

            def _score(chunk_text):
                lower = chunk_text.lower()
                score = sum(lower.count(w) * 2 for w in query_words)
                if selected_text.lower()[:40] in lower:
                    score += 25
                return score

            scored = sorted(rows, key=lambda r: _score(r["content"]), reverse=True)
            context_chunks = [r["content"] for r in scored[:5] if _score(r["content"]) > 0]

            # Vector fallback if keyword scoring finds nothing
            if not context_chunks:
                try:
                    qe = self._ai.embeddings.embed_query(query)
                    conn2 = _get_conn()
                    cur2 = conn2.cursor()
                    cur2.execute(
                        """
                        SELECT content FROM document_chunks WHERE pdf_id = %s
                        ORDER BY embedding <=> %s::vector LIMIT 5
                        """,
                        (pdf_id, "[" + ",".join(str(x) for x in qe) + "]"),
                    )
                    context_chunks = [r[0] for r in cur2.fetchall()]
                    cur2.close()
                    conn2.close()
                except Exception as ve:
                    print(f"[refine_text] Vector fallback error: {ve}")

        except Exception as e:
            print(f"[refine_text] DB error: {e}")

        context_text = "\n\n".join(context_chunks)

        # ── Instruction type detection ──
        il = instruction.lower()
        if any(w in il for w in ["example", "eg", "show me", "instance"]):
            task = "Provide 2–3 concrete real-world examples that illustrate the concept clearly."
        elif any(w in il for w in ["explain", "confused", "understand", "what is", "elaborate"]):
            task = "Give a thorough step-by-step explanation. Start from basics, explain why and how, use an analogy if helpful."
        elif any(w in il for w in ["organize", "structure", "format", "arrange"]):
            task = "Reorganize the content into a cleaner, more logical and scannable structure."
        elif any(w in il for w in ["simpler", "shorter", "brief", "simplify", "concise"]):
            task = "Rewrite in simpler, shorter language a student can understand instantly. Keep all key facts."
        else:
            task = f"The student asked: {instruction}. Answer this specific request thoroughly."

        prompt = f"""You are NotesGPT — expert academic note writer.
A student is refining a section of their structured study note.

CONTEXT FROM ORIGINAL DOCUMENT:
{context_text or "No additional context available."}

SELECTED TEXT FROM THEIR NOTE:
\"\"\"{selected_text}\"\"\"

TASK: {task}

OUTPUT FORMAT (match the note's existing style exactly):
## 📌 [Short Topic Title]

> [One line describing what this response covers]

- ⚡ **[Key Term]**: Full explanation, 2–4 lines.
  Connect to the original concept and add context.

- **[Another Point]**: Detailed explanation.
  Include why this matters for the exam.

- 💡 **[Example or Insight]**: Concrete illustration.
  Make it memorable and easy to recall.

## 🗝️ Key Takeaways from This Section
- ⚡ **[Point 1]**: Complete sentence.
- **[Point 2]**: Complete sentence.
- **[Point 3]**: Complete sentence.

RULES: Bullets only. Each 2–4 lines. Bold all key terms.
Start with ## 📌 immediately. End with End_of_Notes.
"""
        try:
            result = self._llm_call(prompt)
            return {"refined_content": result}
        except Exception as e:
            return {
                "refined_content": f"## 📌 Context Found\n\n"
                + "\n".join(f"- {c[:200]}" for c in context_chunks[:3]),
                "error": str(e),
            }

    # ─────────────────────────────────────────────────────────
    #  PUBLIC: discuss_note
    #  Chat popup — looped conversation about the note
    # ─────────────────────────────────────────────────────────
    def discuss_note(
        self,
        note_content: str,
        user_question: str,
        pdf_id: str = None,
        conversation_history: list[dict] = None
    ) -> dict:
        """
        HYBRID: Manual section extractor picks relevant note sections.
        AI answers scoped to those sections.
        """
        # Manual section extractor
        plain = re.sub(r"<[^>]+>", "", note_content)
        sections = re.split(r"\n##\s+", plain)

        query_words = [
            w.lower()
            for w in re.findall(r"\b[a-zA-Z]{3,}\b", user_question)
            if w.lower() not in STOPWORDS
        ]

        scored_sections = []
        for sec in sections:
            if len(sec.strip()) < 30:
                continue
            lower = sec.lower()
            score = sum(lower.count(w) * 2 for w in query_words)
            scored_sections.append((score, sec.strip()))

        scored_sections.sort(reverse=True)
        top = [s for sc, s in scored_sections[:3] if sc > 0]
        relevant_text = ("\n\n---\n\n".join(top) if top else plain)[:3000]

        history_context = ""
        if conversation_history and len(conversation_history) > 1:
            history_context = "\n\nPREVIOUS CONVERSATION:\n"
            for msg in conversation_history[:-1]:  # all except current
                role = "Student" if msg['role'] == 'user' else "NotesGPT"
                history_context += f"{role}: {msg['content'][:300]}\n"

        prompt = f"""You are NotesGPT — expert academic note writer.
A student is asking a follow-up question about their study note.
{history_context}
RELEVANT SECTIONS FROM THEIR NOTE:
{relevant_text}

STUDENT'S QUESTION: {user_question}

Answer this specific question. If it references a previous 
exchange shown above, build on that context naturally.
Do not repeat what was already explained unless asked.
Answer the question using ONLY the note content above.
If they want more detail, expand from the context given.
Use the EXACT SAME format as their note:

## 📌 [Topic Answering Their Question]

> [One line saying what this response provides]

- ⚡ **[Key Point]**: Full explanation, 2–4 lines.

- **[Another Point]**: Explanation with context.

- 💡 **[Tip or Insight]**: Helpful for exam recall.

## 🗝️ Key Takeaways
- ⚡ **[Point 1]**: Full sentence.
- **[Point 2]**: Full sentence.

RULES: Bullets only. Bold all key terms. Start with ## 📌.
End with End_of_Notes.
"""
        try:
            result = self._llm_call(prompt)
            return {"refined_content": result}
        except Exception as e:
            return {
                "refined_content": "## 📌 Response\n\n"
                + "\n".join(f"- {line.strip()}" for line in relevant_text.split("\n") if len(line.strip()) > 20)[:800],
                "error": str(e),
            }

    # ─────────────────────────────────────────────────────────
    #  PUBLIC: summarize_prompts
    #  Generates a topic label for a refined section
    # ─────────────────────────────────────────────────────────
    def summarize_prompts(
        self, prompts: list[str], original_text: str = None
    ) -> str:
        """
        Manual keyword extraction → AI topic label (≤5 words).
        Used to label refined sections inserted back into the note.
        """
        if not prompts:
            return "Refined Section"

        subject_keywords = []
        if original_text:
            words = re.findall(r"\b[a-zA-Z]{4,}\b", original_text)
            freq: dict[str, int] = {}
            for w in words:
                wl = w.lower()
                if wl not in STOPWORDS:
                    freq[wl] = freq.get(wl, 0) + 1
            top = sorted(freq.items(), key=lambda x: x[1], reverse=True)
            subject_keywords = [w for w, _ in top[:3]]

        prompt = f"""Generate a SHORT topic label (maximum 5 words, Capitalize Each Word)
that describes WHAT THIS TEXT IS ABOUT (not what was done to it).

Keywords found: {", ".join(subject_keywords)}
Text snippet: {(original_text or "")[:120].replace(chr(10), " ")}
User instructions: {" → ".join(prompts)}

Output ONLY the topic label. No quotes. No punctuation at end. Nothing else.
GOOD: "Mitochondria Energy Production"
BAD: "Refined Text", "AI Adjustment", "Simplified Version"
"""
        try:
            return self._llm_call(prompt).strip().strip('"').strip("'")
        except Exception:
            return " ".join(w.capitalize() for w in subject_keywords[:3]) or "Refined Study Content"

    # ─────────────────────────────────────────────────────────
    #  PUBLIC: File processing
    # ─────────────────────────────────────────────────────────
    def process_file(
        self, file_bytes: bytes, file_id: str, original_filename: str
    ) -> dict:
        """
        Processes an uploaded file (PDF, PPTX, MD, TXT):
          1. Save to disk for frontend source-viewer
          2. Extract full text
          3. Extract images (PDF + PPTX)
          4. Chunk text with overlap
          5. Generate embeddings
          6. Batch-insert chunks + images to DB
        """
        fname_lower = original_filename.lower()
        is_pptx = fname_lower.endswith(".pptx")
        is_md_txt = fname_lower.endswith((".md", ".txt"))
        ext = ".pptx" if is_pptx else (".pdf" if not is_md_txt else fname_lower[-3:])

        # Save file to disk
        save_dir = "documents"
        os.makedirs(save_dir, exist_ok=True)
        safe_name = f"{file_id}{ext}"
        file_path = os.path.join(save_dir, safe_name)
        with open(file_path, "wb") as f:
            f.write(file_bytes)

        full_text = ""
        extracted_images = []

        try:
            # ── Text extraction ──
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

            else:  # PDF
                import fitz
                doc = fitz.open(stream=file_bytes, filetype="pdf")
                for page_num, page in enumerate(doc):
                    page_text = page.get_text()
                    full_text += page_text + "\n"
                doc.close()

            # ── Image extraction ──
            extracted_images = self._extract_images(file_bytes, original_filename)

            # ── Chunking ──
            from langchain_text_splitters import RecursiveCharacterTextSplitter
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=1200, chunk_overlap=200
            )
            chunks = splitter.split_text(full_text) or ["No readable text found."]

            # ── Embed + DB insert ──
            conn = _get_conn()
            cur = conn.cursor()

            # Ensure images table exists
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

            # Insert images
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

            # Generate embeddings (batch)
            print(f"[process_file] Vectorising {len(chunks)} chunks for {file_id}...")
            embeddings = self._ai.embeddings.embed_documents(chunks)

            data_list = []
            for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
                # Estimate page_hint from chunk position
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
        """Extracts images from PDF or PPTX. Returns list of image dicts."""
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
                        if shape.shape_type == 13:  # Picture
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

        return results[:15]  # Cap per file

    # ─────────────────────────────────────────────────────────
    #  PUBLIC: DB helpers (folder + note management)
    # ─────────────────────────────────────────────────────────
    def save_note_to_db(
        self, user_id: str, pdf_id: str, title: str, content: str
    ) -> str | None:
        try:
            conn = _get_conn()
            cur = conn.cursor()
            note_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO notes (note_id, user_id, title, content,
                                   created_at, updated_at, note_type,
                                   is_in_folder, has_embeddings)
                VALUES (%s, %s, %s, %s, NOW(), NOW(), 'ai_generated', FALSE, TRUE)
                RETURNING note_id
                """,
                (note_id, user_id, title, content),
            )
            returned_id = cur.fetchone()[0]
            conn.commit()
            cur.close()
            conn.close()
            return returned_id
        except Exception as e:
            print(f"[save_note_to_db] ERROR: {e}")
            return None

    def update_note(self, note_id: str, new_content: str) -> bool:
        try:
            conn = _get_conn()
            cur = conn.cursor()
            cur.execute(
                "UPDATE notes SET content = %s, updated_at = NOW() WHERE note_id = %s",
                (new_content, note_id),
            )
            updated = cur.rowcount > 0
            conn.commit()
            cur.close()
            conn.close()
            return updated
        except Exception as e:
            print(f"[update_note] ERROR: {e}")
            return False

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

    def update_note_folder(self, note_id: str, folder_id: str) -> bool:
        try:
            conn = _get_conn()
            cur = conn.cursor()
            cur.execute(
                "UPDATE notes SET folder_id = %s, updated_at = NOW() WHERE note_id = %s",
                (folder_id, note_id),
            )
            success = cur.rowcount > 0
            conn.commit()
            cur.close()
            conn.close()
            return success
        except Exception as e:
            print(f"[update_note_folder] ERROR: {e}")
            return False

    def get_all_notes(
        self, user_id: str, folder_id: str = None
    ) -> list[dict]:
        try:
            conn = _get_conn()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            query = """
                SELECT note_id, title, created_at, note_type, is_in_folder, folder_id
                FROM notes WHERE user_id = %s
            """
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


# ─────────────────────────────────────────────────────────────
#  SINGLETON — import this in router.py
# ─────────────────────────────────────────────────────────────
note_service = NoteService()


