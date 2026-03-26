from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from m3_structurednotes.services import ai_service
import os
import uuid
from pydantic import BaseModel

from fastapi.staticfiles import StaticFiles

app = FastAPI()

# Mount the documents folder to serve PDFs
os.makedirs("documents", exist_ok=True)
app.mount("/documents", StaticFiles(directory="documents"), name="documents")

# Enable CORS so your React app can talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/notes")
async def get_notes(user_id: str, folder_id: str = None):
    notes = ai_service.get_all_notes(user_id, folder_id)
    return notes


class NoteRequest(BaseModel):
    pdf_id: str
    user_id: str
    instruction: str = None  # Optional user instruction
    language: str = "English"

class RefineRequest(BaseModel):
    pdf_id: str
    selected_text: str
    instruction: str

class NoteUpdate(BaseModel):
    content: str

from typing import List

@app.post("/upload")
async def upload_pdf(files: List[UploadFile] = File(...)):
    print(f"Received upload request with {len(files)} files")
    
    # Process all files
    results = []
    merged_text = ""
    primary_pdf_id = None
    primary_pdf_url = None
    primary_filename = None

    for i, file in enumerate(files):
        content = await file.read()
        pdf_id = str(uuid.uuid4())
        
        # Save and Extract
        result = ai_service.process_pdf(content, pdf_id, file.filename)
        
        # Aggregate
        merged_text += f"\n\n--- Source: {file.filename} ---\n\n"
        merged_text += result["extracted_text"]
        
        results.append({
            "pdf_id": pdf_id,
            "filename": file.filename,
            "url": result["pdf_url"]
        })

        # Use the first file as the "Primary" for the PDF Viewer
        if i == 0:
            primary_pdf_id = pdf_id
            primary_pdf_url = result["pdf_url"]
            primary_filename = file.filename
    
    return {
        "status": "success", 
        "pdf_id": primary_pdf_id, 
        "filename": primary_filename, # useful for title
        "pdf_url": primary_pdf_url,
        "extracted_text": merged_text,
        "all_files": results 
    }

@app.post("/generate-note")
async def generate_note(request: NoteRequest):
    result = ai_service.generate_note(request.pdf_id, request.user_id, request.instruction, language=request.language)
    return result

@app.put("/notes/{note_id}")
async def update_note(note_id: str, update: NoteUpdate):
    success = ai_service.update_note(note_id, update.content)
    if not success:
        return {"error": "Failed to update note"}, 500
    return {"status": "success"}

@app.post("/refine-text")
async def refine_text(request: RefineRequest):
    refined_content = ai_service.refine_text(request.pdf_id, request.selected_text, request.instruction)
    return {"refined_content": refined_content}

# --- Folder Routes ---

class FolderCreate(BaseModel):
    user_id: str
    name: str

class NoteFolderUpdate(BaseModel):
    folder_id: str

class NoteCreate(BaseModel):
    user_id: str
    title: str
    content: str
    pdf_id: str = None

@app.post("/notes")
async def create_note(note: NoteCreate):
    # Using existing save_note_to_db logic but exposed as API
    note_id = ai_service.save_note_to_db(note.user_id, note.pdf_id, note.title, note.content)
    if not note_id:
        return {"error": "Failed to create note"}, 500
    return {"note_id": note_id, "status": "success"}

@app.get("/folders")
async def get_folders(user_id: str):
    folders = ai_service.get_all_folders(user_id)
    return folders

@app.post("/folders")
async def create_folder(folder: FolderCreate):
    new_folder = ai_service.create_folder(folder.user_id, folder.name)
    if not new_folder:
        return {"error": "Failed to create folder"}, 500
    return new_folder

@app.put("/notes/{note_id}/folder")
async def update_note_folder(note_id: str, update: NoteFolderUpdate):
    success = ai_service.update_note_folder(note_id, update.folder_id)
    if not success:
        return {"error": "Failed to update note folder"}, 500
    return {"status": "success"}
