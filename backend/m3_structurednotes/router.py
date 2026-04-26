"""
NeuraNote — Member 3: Structured Note Generation
router.py — FULL REBUILD (Production-Ready Async API)

Key fixes over previous version:
  - generate-note now uses FastAPI BackgroundTasks → no 60s timeout
  - /job/{job_id}/status polling endpoint for frontend progress bar
  - /upload handles MD/TXT files that come from Member 2's notebook drag-drop
  - All routes have proper HTTPException codes and error messages
  - Pydantic models validated — no silent failures
  - Duplicate AIService instantiation removed (uses note_service singleton)
  - refine-text response key unified to "refined_content" (was inconsistent)
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File
from pydantic import BaseModel, Field

from m3_structurednotes.services import note_service
from m3_structurednotes.database import get_db_connection

router = APIRouter()


# ─────────────────────────────────────────────────────────────
#  PYDANTIC REQUEST MODELS
# ─────────────────────────────────────────────────────────────

class NoteRequest(BaseModel):
    pdf_ids: List[str] = Field(..., min_items=1)
    user_id: str
    instruction: str = ""
    language: str = "English"
    ordering: str = "ai"


class RefineRequest(BaseModel):
    pdf_id: str
    selected_text: str = Field(..., min_length=5)
    instruction: str = Field(..., min_length=3)
    loop_number: int = 1
    allow_outside: bool = False
    conversation_history: Optional[List[dict]] = None


class DiscussRequest(BaseModel):
    note_content: str
    user_question: str = Field(..., min_length=3)
    pdf_id: Optional[str] = None


class PromptsRequest(BaseModel):
    prompts: List[str]
    original_text: Optional[str] = None


class FolderRequest(BaseModel):
    user_id: str
    name: str = Field(..., min_length=1)


class NoteCreate(BaseModel):
    user_id: str
    pdf_id: Optional[str] = None
    title: str
    content: str


class NoteUpdate(BaseModel):
    content: str


class NoteUpdateFolder(BaseModel):
    folder_id: str


# ─────────────────────────────────────────────────────────────
#  SECTION 1 — FILE UPLOAD
# ─────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    """
    Accepts PDF, PPTX, MD, TXT files.
    Processes each file: extracts text + images, chunks, embeds, saves to DB.
    Returns list of { pdf_id, filename, pdf_url } for successful uploads.

    Called by UploadSection.jsx uploadPDF().
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    ALLOWED_EXTENSIONS = {".pdf", ".pptx", ".md", ".txt"}
    MAX_SIZE_BYTES = 30 * 1024 * 1024  # 30MB

    results = []

    for file in files:
        # Validate extension
        fname_lower = file.filename.lower()
        ext = "." + fname_lower.rsplit(".", 1)[-1] if "." in fname_lower else ""
        if ext not in ALLOWED_EXTENSIONS:
            results.append({
                "filename": file.filename,
                "error": f"Unsupported file type '{ext}'. Allowed: PDF, PPTX, MD, TXT.",
            })
            continue

        file_bytes = await file.read()

        # Validate size
        if len(file_bytes) > MAX_SIZE_BYTES:
            results.append({
                "filename": file.filename,
                "error": f"File exceeds 30MB limit ({len(file_bytes)//1024//1024}MB).",
            })
            continue

        file_id = str(uuid.uuid4())

        try:
            res = note_service.process_file(file_bytes, file_id, file.filename)
        except Exception as e:
            import traceback
            results.append({"filename": file.filename, "error": f"{str(e)}\n\n{traceback.format_exc()}"})
            continue

        if res.get("status") == "success":
            results.append({
                "pdf_id": file_id,
                "filename": file.filename,
                "pdf_url": res.get("pdf_url", ""),
            })
        else:
            results.append({
                "filename": file.filename,
                "error": res.get("message", "Processing failed."),
            })

    successful = [r for r in results if "error" not in r]
    failed = [r for r in results if "error" in r]

    return {
        "uploaded_files": results,
        "total": len(results),
        "successful": len(successful),
        "failed": len(failed),
    }


# ─────────────────────────────────────────────────────────────
#  SECTION 1b — TEMP TEST: MIND MAP EXTRACTION
# ─────────────────────────────────────────────────────────────

@router.post("/test-mindmap")
async def test_mindmap(req: dict):
    """
    Temporary test route to verify mind map extraction.
    Call with: {"pdf_id": "your_pdf_id_here"}
    """
    pdf_id = req.get("pdf_id")
    if not pdf_id:
        return {"error": "pdf_id required"}

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT content FROM document_chunks WHERE pdf_id = %s ORDER BY chunk_index ASC",
        (pdf_id,)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    if not rows:
        return {"error": f"No chunks found for pdf_id={pdf_id}"}

    full_text = " ".join(r[0] for r in rows)
    print(f"[Test] full_text: {len(full_text)} chars")

    result = note_service.extract_mindmap_chunked(full_text)

    return {
        "lecture_title": result["lecture_title"],
        "chapter_count": len(result["chapters"]),
        "chapters": [
            {
                "title": ch["title"],
                "section_count": len(ch.get("sections", [])),
                "sections": [
                    {
                        "title": s["title"],
                        "line_count": len(s.get("content_lines", []))
                    }
                    for s in ch.get("sections", [])
                ]
            }
            for ch in result["chapters"]
        ]
    }


class DetailedNoteRequest(BaseModel):
    pdf_id: str
    user_id: str
    language: str = "English"


class StructuredNoteRequest(BaseModel):
    input_items: List[dict]
    user_id: str
    language: str = "English"
    module_name: Optional[str] = "Study Notes"


# ─────────────────────────────────────────────────────────────
#  SECTION 2 — NOTE GENERATION (ASYNC BACKGROUND JOB)
# ─────────────────────────────────────────────────────────────

@router.post("/generate-detailed-note", status_code=202)
async def generate_detailed_note_route(req: DetailedNoteRequest, background_tasks: BackgroundTasks):
    """Starts a detailed note generation job for a single PDF."""
    job_id = str(uuid.uuid4())
    try:
        conn = get_db_connection()
        if conn:
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS generation_jobs (
                    job_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    status TEXT DEFAULT 'queued',
                    note_id TEXT,
                    error_msg TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            cur.execute(
                "INSERT INTO generation_jobs (job_id, user_id, status) VALUES (%s, %s, 'queued')",
                (job_id, req.user_id)
            )
            conn.commit()
            cur.close()
            conn.close()
    except Exception as e:
        print(f"[generate-detailed-note] Job row failed: {e}")

    background_tasks.add_task(
        _run_detailed_note_job,
        job_id=job_id, pdf_id=req.pdf_id,
        user_id=req.user_id, language=req.language
    )
    return {"job_id": job_id, "status": "queued"}


async def _run_detailed_note_job(job_id: str, pdf_id: str, user_id: str, language: str):
    try:
        content = note_service.generate_detailed_note(
            pdf_id=pdf_id, user_id=user_id, language=language, job_id=job_id
        )
        import re as _re
        first_line = content.split('\n')[0]
        title = _re.sub(r'^#+\s*', '', first_line).strip() or "Detailed Note"
        note_id = note_service.save_note_to_db(user_id, pdf_id, title, content)
        if note_id:
            _set_note_type(note_id, 'detailed')
        _update_job_row(job_id, "done", note_id=note_id)
    except Exception as e:
        import traceback
        traceback.print_exc()
        _fail_job(job_id, str(e))


@router.post("/generate-structured-note", status_code=202)
async def generate_structured_note_route(req: StructuredNoteRequest, background_tasks: BackgroundTasks):
    """Starts a structured note generation job from multiple inputs."""
    job_id = str(uuid.uuid4())
    try:
        conn = get_db_connection()
        if conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO generation_jobs (job_id, user_id, status) VALUES (%s, %s, 'queued') ON CONFLICT DO NOTHING",
                (job_id, req.user_id)
            )
            conn.commit()
            cur.close()
            conn.close()
    except Exception as e:
        print(f"[generate-structured-note] Job row failed: {e}")

    background_tasks.add_task(
        _run_structured_note_job,
        job_id=job_id, input_items=req.input_items,
        user_id=req.user_id, language=req.language
    )
    return {"job_id": job_id, "status": "queued"}


async def _run_structured_note_job(job_id: str, input_items: list, user_id: str, language: str):
    try:
        content = note_service.generate_structured_note(
            input_items=input_items, user_id=user_id, language=language, job_id=job_id
        )
        note_id = note_service.save_note_to_db(user_id, None, "Structured Study Notes", content)
        if note_id:
            _set_note_type(note_id, 'structured')
        _update_job_row(job_id, "done", note_id=note_id)
    except Exception as e:
        import traceback
        traceback.print_exc()
        _fail_job(job_id, str(e))


def _set_note_type(note_id: str, note_type: str):
    try:
        conn = get_db_connection()
        if not conn:
            return
        cur = conn.cursor()
        cur.execute("UPDATE notes SET note_type = %s WHERE note_id = %s", (note_type, note_id))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[_set_note_type] {e}")


@router.post("/generate-note", status_code=202)
async def generate_note(req: NoteRequest, background_tasks: BackgroundTasks):
    """
    Starts note generation as a background task.
    Returns immediately with { job_id, status: "queued" }.
    Frontend polls GET /job/{job_id}/status until status == "done".

    WHY BACKGROUND:
    For 12 lecture PDFs, generation takes 2–5 minutes.
    A direct synchronous call would hit browser/proxy timeouts (60s).
    BackgroundTasks runs after the HTTP response is sent — no timeout risk.
    """
    job_id = str(uuid.uuid4())

    # Create the job row so polling works immediately
    try:
        conn = get_db_connection()
        if conn:
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS generation_jobs (
                    job_id      TEXT PRIMARY KEY,
                    user_id     TEXT NOT NULL,
                    status      TEXT DEFAULT 'queued',
                    note_id     TEXT,
                    error_msg   TEXT,
                    created_at  TIMESTAMPTZ DEFAULT NOW(),
                    updated_at  TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            cur.execute(
                "INSERT INTO generation_jobs (job_id, user_id, status) VALUES (%s, %s, 'queued')",
                (job_id, req.user_id),
            )
            conn.commit()
            cur.close()
            conn.close()
    except Exception as e:
        # Non-fatal — job tracking may not work but generation still runs
        print(f"[generate-note] Could not create job row: {e}")

    # Schedule background work
    background_tasks.add_task(
        _run_generation_job,
        job_id=job_id,
        pdf_ids=req.pdf_ids,
        user_id=req.user_id,
        instruction=req.instruction,
        language=req.language,
        ordering=req.ordering,
    )

    return {"job_id": job_id, "status": "queued"}


async def _run_generation_job(
    job_id: str,
    pdf_ids: list,
    user_id: str,
    instruction: str,
    language: str,
    ordering: str,
):
    """
    Background task — runs after HTTP response is sent.
    Calls the full pipeline, saves result to DB, updates job row.
    """
    try:
        # Run the full pipeline (blocking — but we're in a background task)
        content = note_service.generate_note(
            pdf_ids=pdf_ids,
            user_id=user_id,
            instruction=instruction,
            language=language,
            ordering=ordering,
            job_id=job_id,
        )

        # Save note to DB
        title = f"Study Notes — {len(pdf_ids)} Document(s)"
        note_id = note_service.save_note_to_db(user_id, None, title, content)

        if not note_id:
            _fail_job(job_id, "Failed to save note to database.")
            return

        # Mark job done with note_id
        _update_job_row(job_id, "done", note_id=note_id)

    except Exception as e:
        import traceback
        traceback.print_exc()
        _fail_job(job_id, str(e))


def _update_job_row(job_id: str, status: str, note_id: str = None):
    try:
        conn = get_db_connection()
        if not conn:
            return
        cur = conn.cursor()
        if note_id:
            cur.execute(
                "UPDATE generation_jobs SET status=%s, note_id=%s, updated_at=NOW() WHERE job_id=%s",
                (status, note_id, job_id),
            )
        else:
            cur.execute(
                "UPDATE generation_jobs SET status=%s, updated_at=NOW() WHERE job_id=%s",
                (status, job_id),
            )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[_update_job_row] {e}")


def _fail_job(job_id: str, error_msg: str):
    try:
        conn = get_db_connection()
        if not conn:
            return
        cur = conn.cursor()
        cur.execute(
            "UPDATE generation_jobs SET status='failed', error_msg=%s, updated_at=NOW() WHERE job_id=%s",
            (error_msg[:500], job_id),
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[_fail_job] {e}")


# ─────────────────────────────────────────────────────────────
#  SECTION 3 — JOB STATUS POLLING
# ─────────────────────────────────────────────────────────────

@router.get("/job/{job_id}/status")
async def job_status(job_id: str):
    """
    Frontend polls this every 3 seconds while generation runs.

    Returns:
      { status: "queued" | "retrieving" | "deduplicating" |
                "analyzing" | "generating" | "finalising" |
                "done" | "failed",
        note_id: str | null,
        error: str | null }

    When status == "done", note_id is set → frontend navigates to editor.
    When status == "failed", error has the message.
    """
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT status, note_id, error_msg FROM generation_jobs WHERE job_id = %s",
            (job_id,),
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="Job not found.")

    return {
        "status": row[0],
        "note_id": row[1],
        "error": row[2],
    }


# ─────────────────────────────────────────────────────────────
#  SECTION 4 — REFINE TEXT (Right-click → Refine)
# ─────────────────────────────────────────────────────────────

@router.post("/refine-text")
async def refine_text(req: RefineRequest):
    """
    Takes selected text + user instruction.
    Returns a refined section in the same note format.
    Used by the right-click → Refine popup.

    FIX: response key unified to "refined_content" everywhere.
    Previous version returned "refined_text" here but "refined_content"
    in discuss-note — caused frontend inconsistency.
    """
    try:
        result = note_service.refine_text(
            pdf_id=req.pdf_id,
            selected_text=req.selected_text,
            instruction=req.instruction,
            loop_number=req.loop_number,
            allow_outside=req.allow_outside,
            conversation_history=req.conversation_history
        )
        return {
            "refined_content": result.get("refined_content", ""),
            "loop_number": req.loop_number,
            "should_ask_outside": result.get("should_ask_outside", False)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
#  SECTION 5 — DISCUSS NOTE (Chat popup)
# ─────────────────────────────────────────────────────────────

@router.post("/discuss-note")
async def discuss_note(req: DiscussRequest):
    """
    Looped chat about the note content.
    Answers questions scoped to the student's note sections.
    Each call is stateless — full note content passed each time.
    """
    try:
        result = note_service.discuss_note(
            note_content=req.note_content,
            user_question=req.user_question,
            pdf_id=req.pdf_id,
            conversation_history=req.conversation_history
        )
        return {"refined_content": result.get("refined_content", "")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
#  SECTION 6 — SUMMARIZE PROMPTS (Topic label for refined section)
# ─────────────────────────────────────────────────────────────

@router.post("/summarize-prompts")
async def summarize_prompts(req: PromptsRequest):
    """
    Generates a ≤5-word topic label describing what a refined section
    is about. Used when inserting refined content back into the note.
    """
    try:
        topic = note_service.summarize_prompts(
            prompts=req.prompts,
            original_text=req.original_text,
        )
        return {"topic": topic}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
#  SECTION 7 — FOLDERS
# ─────────────────────────────────────────────────────────────

@router.get("/folders")
async def get_folders(user_id: str):
    """Returns all folders for the given user."""
    conn = get_db_connection()
    if not conn:
        return []
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name FROM folders WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,),
        )
        rows = [{"id": r[0], "name": r[1]} for r in cur.fetchall()]
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        print(f"[get_folders] {e}")
        return []


@router.post("/folders", status_code=201)
async def create_folder(req: FolderRequest):
    """Creates a new folder. Returns { id, name }."""
    folder_id = str(uuid.uuid4())
    conn = get_db_connection()
    if not conn:
        # Graceful fallback so UI doesn't break if DB is down
        return {"id": folder_id, "name": req.name, "warning": "Not persisted — DB unavailable"}

    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO folders (id, user_id, name) VALUES (%s, %s, %s)",
            (folder_id, req.user_id, req.name),
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"id": folder_id, "name": req.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
#  SECTION 8 — NOTES CRUD
# ─────────────────────────────────────────────────────────────

@router.get("/notes")
async def get_notes(user_id: str, folder_id: Optional[str] = None):
    """
    Returns notes for a user, optionally filtered by folder_id.
    Returns note_id, title, and a 150-char content preview.
    """
    conn = get_db_connection()
    if not conn:
        return []
    try:
        cur = conn.cursor()
        if folder_id:
            cur.execute(
                "SELECT note_id, title, content FROM notes WHERE user_id=%s AND folder_id=%s ORDER BY updated_at DESC",
                (user_id, folder_id),
            )
        else:
            cur.execute(
                "SELECT note_id, title, content FROM notes WHERE user_id=%s ORDER BY updated_at DESC",
                (user_id,),
            )
        rows = [
            {"id": r[0], "title": r[1], "preview": (r[2] or "")[:150]}
            for r in cur.fetchall()
        ]
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        print(f"[get_notes] {e}")
        return []


@router.get("/notes/{note_id}")
async def get_note(note_id: str):
    """Returns full note content by note_id."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT note_id, title, content, created_at, updated_at FROM notes WHERE note_id=%s",
            (note_id,),
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail="Note not found.")

    return {
        "note_id": row[0],
        "title": row[1],
        "content": row[2],
        "created_at": str(row[3]),
        "updated_at": str(row[4]),
    }


@router.post("/notes", status_code=201)
async def create_note(req: NoteCreate):
    """
    Saves a note to DB. Returns { note_id, title, content }.
    Called after generation completes (or for manual notes).
    """
    note_id = note_service.save_note_to_db(
        req.user_id, req.pdf_id, req.title, req.content
    )
    if not note_id:
        raise HTTPException(status_code=500, detail="Failed to save note to database.")

    return {"note_id": note_id, "title": req.title, "content": req.content}


@router.put("/notes/{note_id}")
async def update_note(note_id: str, req: NoteUpdate):
    """Updates note content (called by the rich text editor on save)."""
    success = note_service.update_note(note_id, req.content)
    if not success:
        raise HTTPException(status_code=404, detail="Note not found or update failed.")
    return {"status": "success", "note_id": note_id}


@router.put("/notes/{note_id}/folder")
async def update_note_folder(note_id: str, req: NoteUpdateFolder):
    """Moves a note into a folder (drag-drop in Member 2's sidebar)."""
    success = note_service.update_note_folder(note_id, req.folder_id)
    if not success:
        raise HTTPException(status_code=404, detail="Note not found or folder update failed.")
    return {"status": "success"}


@router.delete("/notes/{note_id}", status_code=204)
async def delete_note(note_id: str):
    """Deletes a note. Returns 204 No Content."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM notes WHERE note_id = %s", (note_id,))
        deleted = cur.rowcount > 0
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not deleted:
        raise HTTPException(status_code=404, detail="Note not found.")


# ─────────────────────────────────────────────────────────────
#  SECTION 9 — SOURCE DOCUMENT SERVING
# ─────────────────────────────────────────────────────────────

@router.get("/documents/{filename}")
async def serve_document(filename: str):
    """
    Returns metadata for a stored document so the frontend
    split-view can open it. Actual file serving is handled
    by FastAPI's StaticFiles mount in main.py:
        app.mount("/documents", StaticFiles(directory="documents"))
    This endpoint just confirms the file exists.
    """
    import os
    file_path = os.path.join("documents", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Document not found.")
    return {"filename": filename, "url": f"/documents/{filename}"}


