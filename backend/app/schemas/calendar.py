from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CalendarEventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    color: Optional[str] = "#6366f1"
    all_day: Optional[bool] = False


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    color: Optional[str] = None
    all_day: Optional[bool] = None