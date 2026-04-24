from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class AnnouncementBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    type: Optional[str] = "info"  # 'info', 'warning', 'urgent'

class AnnouncementCreate(AnnouncementBase):
    pass

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    type: Optional[str] = None

class Announcement(AnnouncementBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: str  # User ID

    class Config:
        from_attributes = True
