from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from services import ai_service
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
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class NoteRequest(BaseModel):
    pdf_id: str
    user_id: str
    instruction: str = None  # Optional user instruction

class RefineRequest(BaseModel):
    pdf_id: str
    selected_text: str
    instruction: str

class NoteUpdate(BaseModel):
    content: str

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    print(f"Received upload request: {file.filename}")
    content = await file.read()
    # Generate a unique ID for this PDF
    pdf_id = str(uuid.uuid4())
    
    # Process: Save to disk, extract text (Skip Vector DB for now/or keep it if needed, but we focus on manual workflow)
    # user wants "not include the generating struc note", just show uploaded material
    
    result = ai_service.process_pdf(content, pdf_id, file.filename)
    
    return {
        "status": "success", 
        "pdf_id": pdf_id, 
        "filename": file.filename,
        "pdf_url": result["pdf_url"],
        "extracted_text": result["extracted_text"]
    }

@app.post("/generate-note")
async def generate_note(request: NoteRequest):
    result = ai_service.generate_note(request.pdf_id, request.user_id, request.instruction)
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
