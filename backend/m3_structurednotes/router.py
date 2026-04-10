from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, Optional
from pydantic import BaseModel
import shutil
import os
import uuid
from m3_structurednotes.services import AIService

router = APIRouter()
services = AIService()

class NoteRequest(BaseModel):
    pdf_id: str
    user_id: str
    instruction: Optional[str] = None
    language: str = "English"

class RefineRequest(BaseModel):
    pdf_id: str
    selected_text: str
    instruction: str

class FolderRequest(BaseModel):
    user_id: str
    name: str

class NoteUpdateFolder(BaseModel):
    folder_id: str

class NoteUpdate(BaseModel):
    content: str

class NoteCreate(BaseModel):
    user_id: str
    title: str
    content: str
    pdf_id: str

@router.post("/upload")
async def upload_pdf(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    
    file_id = str(uuid.uuid4())
    
    try:
        # Process only the first file for testing
        file = files[0]
        file_bytes = await file.read()
        
        # We process manually via AIService
        result = services.process_pdf(file_bytes, file_id, file.filename)
        if result and result.get("status") == "success":
            # Match the variable name the frontend expects
            return {"pdf_id": file_id, "filename": file.filename, "pdf_url": result.get("pdf_url")}
        else:
            raise HTTPException(status_code=500, detail="Failed to process PDFs")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-note")
async def generate_note(req: NoteRequest):
    result = services.generate_note(req.pdf_id, req.user_id, req.instruction, language=req.language)
    return {"content": result}

@router.post("/refine-text")
async def refine_text(req: RefineRequest):
    result = services.refine_text(req.pdf_id, req.selected_text, req.instruction)
    return {"refined_text": result}

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
    conn = get_db_connection()
    note_id = str(uuid.uuid4())
    if not conn: return {"note_id": note_id, "title": req.title, "content": req.content} # Fallback
    
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO notes (note_id, user_id, title, content, pdf_id) VALUES (%s, %s, %s, %s, %s)", 
            (note_id, req.user_id, req.title, req.content, req.pdf_id))
        conn.commit(); cur.close(); conn.close()
    except Exception as e:
        print("DB Note Save Error:", e)
    return {"note_id": note_id, "title": req.title, "content": req.content}

@router.put("/notes/{note_id}/folder")
async def update_note_folder(note_id: str, req: NoteUpdateFolder):
    conn = get_db_connection()
    if not conn: return {"status": "success"} # Fallback
    try:
        cur = conn.cursor()
        cur.execute("UPDATE notes SET folder_id = %s WHERE note_id = %s", (req.folder_id, note_id))
        conn.commit(); cur.close(); conn.close()
    except: pass
    return {"status": "success"}

@router.put("/notes/{note_id}")
async def update_note(note_id: str, req: NoteUpdate):
    # Pass silently if db is down
    services.update_note(note_id, req.content)
    return {"status": "success"}
