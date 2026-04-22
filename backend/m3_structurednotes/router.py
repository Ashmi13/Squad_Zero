from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, Optional
from pydantic import BaseModel
import shutil
import os
import uuid
from m3_structurednotes.services import AIService

router = APIRouter()
services = AIService()

from m3_structurednotes.models import (
    NoteRequest, RefineRequest, PromptsRequest, 
    FolderRequest, NoteUpdateFolder, NoteUpdate, NoteCreate
)

@router.post("/upload")
async def upload_pdf(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    
    file_id = str(uuid.uuid4())
    
    try:
        all_text = ""
        all_images = []
        first_pdf_url = ""
        
        for file in files:
            file_bytes = await file.read()
            # Process each file
            res = services.process_pdf(file_bytes, file_id, file.filename)
            if res and res.get("status") == "success":
                all_text += f"\n--- Source: {file.filename} ---\n"
                all_text += res.get("extracted_text", "")
                all_images.extend(res.get("extracted_images", []))
                if not first_pdf_url:
                    first_pdf_url = res.get("pdf_url")
            
        if all_text:
            return {
                "pdf_id": file_id, 
                "filename": files[0].filename if len(files) == 1 else "Combined Notebook", 
                "pdf_url": first_pdf_url,
                "extracted_images": all_images,
                "combined_text": all_text
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to process uploaded files")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-note")
async def generate_note(req: NoteRequest):
    extracted_images = getattr(req, 'extracted_images', None) or []
    result = services.generate_note(
        req.pdf_id, req.user_id, req.instruction,
        language=req.language,
        extracted_images=extracted_images
    )
    return {"content": result}

@router.post("/refine-text")
async def refine_text(req: RefineRequest):
    result = services.refine_text(req.pdf_id, req.selected_text, req.instruction)
    return {"refined_text": result}

@router.post("/summarize-prompts")
async def summarize_prompts(req: PromptsRequest):
    topic = services.summarize_prompts(req.prompts, req.original_text)
    return {"topic": topic}

# --- Database Routes (Forwarding to Database functions if needed or Mock for now) ---
# Assuming database.py exists in m3_structurednotes
try:
    from m3_structurednotes.database import get_db_connection
except ImportError:
    pass

@router.get("/folders")
async def get_folders(user_id: str):
    conn = get_db_connection()
    if not conn: return []
    try:
        cur = conn.cursor()
        cur.execute("SELECT folder_id, name FROM folders WHERE user_id = %s", (user_id,))
        res = [{"id": row[0], "name": row[1]} for row in cur.fetchall()]
        cur.close(); conn.close()
        return res
    except: return []

@router.post("/folders")
async def create_folder(req: FolderRequest):
    conn = get_db_connection()
    folder_id = str(uuid.uuid4())
    if not conn: return {"id": folder_id, "name": req.name} # Fallback
    
    cur = conn.cursor()
    cur.execute("INSERT INTO folders (folder_id, user_id, name) VALUES (%s, %s, %s)", (folder_id, req.user_id, req.name))
    conn.commit(); cur.close(); conn.close()
    return {"id": folder_id, "name": req.name}

@router.get("/notes")
async def get_notes(user_id: str, folder_id: Optional[str] = None):
    conn = get_db_connection()
    if not conn: return []
    try:
        cur = conn.cursor()
        if folder_id:
            cur.execute("SELECT note_id, title, content FROM notes WHERE user_id = %s AND folder_id = %s", (user_id, folder_id))
        else:
            cur.execute("SELECT note_id, title, content FROM notes WHERE user_id = %s AND folder_id IS NULL", (user_id,))
        res = [{"id": row[0], "title": row[1], "content": row[2][:100]} for row in cur.fetchall()]
        cur.close(); conn.close()
        return res
    except: return []

@router.post("/notes")
async def create_note(req: NoteCreate):
    note_id = services.save_note_to_db(req.user_id, req.pdf_id, req.title, req.content)
    if not note_id:
        # Fallback to local response if DB fails, but with a warning in logs
        note_id = str(uuid.uuid4())
        return {"note_id": note_id, "title": req.title, "content": req.content, "warning": "Saved locally only"}
    
    return {"note_id": note_id, "title": req.title, "content": req.content}

@router.put("/notes/{note_id}/folder")
async def update_note_folder(note_id: str, req: NoteUpdateFolder):
    success = services.update_note_folder(note_id, req.folder_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update note folder in database")
    return {"status": "success"}

@router.put("/notes/{note_id}")
async def update_note(note_id: str, req: NoteUpdate):
    success = services.update_note(note_id, req.content)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update note in database")
    return {"status": "success"}
