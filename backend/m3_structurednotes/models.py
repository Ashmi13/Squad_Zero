from pydantic import BaseModel
from typing import List, Optional

class NoteRequest(BaseModel):
    pdf_id: str
    user_id: str
    instruction: Optional[str] = None
    language: str = "English"
    extracted_images: Optional[List[dict]] = []

class RefineRequest(BaseModel):
    pdf_id: str
    selected_text: str
    instruction: str

class PromptsRequest(BaseModel):
    prompts: List[str]
    original_text: Optional[str] = None

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
