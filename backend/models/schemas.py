from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# ==================== FOLDER SCHEMAS ====================

class FolderCreate(BaseModel):
    name: str
    user_id: str

class FolderResponse(BaseModel):
    id: int
    user_id: str
    name: str
    created_at: str

# ==================== FILE SCHEMAS ====================

class FileCreate(BaseModel):
    name: str
    folder_id: int
    user_id: str
    file_type: str

class FileResponse(BaseModel):
    id: int
    folder_id: int
    user_id: str
    name: str
    file_type: str
    storage_url: Optional[str]
    summary: Optional[str]
    summary_style: Optional[str]
    uploaded_at: str

class FileUploadResponse(BaseModel):
    id: int
    name: str
    storage_url: str
    raw_text: str
    summary: str
    summary_style: str

# ==================== SUMMARY SCHEMAS ====================

class ResummarizeRequest(BaseModel):
    file_id: int
    style: str  # 'default', 'bullet', 'short'
    user_id: str

class SummaryResponse(BaseModel):
    summary: str
    summary_style: str

# ==================== HIGHLIGHT SCHEMAS ====================

class HighlightCreate(BaseModel):
    file_id: int
    user_id: str
    selected_text: str
    start_index: int
    end_index: int

class HighlightResponse(BaseModel):
    id: int
    file_id: int
    user_id: str
    selected_text: str
    start_index: int
    end_index: int
    created_at: str

class HighlightsList(BaseModel):
    highlights: List[HighlightResponse]

# ==================== CHAT SCHEMAS ====================

class ChatCreate(BaseModel):
    file_id: int
    user_id: str
    highlight_id: Optional[int]
    question: str
    selected_text: Optional[str]

class ChatResponse(BaseModel):
    id: int
    file_id: int
    user_id: str
    highlight_id: Optional[int]
    question: str
    answer: str
    asked_at: str

class ChatHistoryList(BaseModel):
    chat_history: List[ChatResponse]

# ==================== ERROR SCHEMAS ====================

class ErrorResponse(BaseModel):
    error: str
    details: Optional[str]