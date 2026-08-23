from pydantic import BaseModel, Field
from typing import List, Optional

class NoteRequest(BaseModel):
    pdf_ids: List[str]
    user_id: str
    instruction: Optional[str] = None
    language: str = "English"
    ordering: str = "ai"

class RefineRequest(BaseModel):
    pdf_id: str
    selected_text: str = Field(..., min_length=5)
    instruction: str = Field(..., min_length=3)
    loop_number: int = 1
    allow_outside: bool = False
    conversation_history: Optional[List[dict]] = None

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

class DiscussRequest(BaseModel):
    note_content: str
    user_question: str
    pdf_id: Optional[str] = None
    conversation_history: Optional[List[dict]] = None
