from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[str] = "todo"
    priority: Optional[str] = "medium"
    due_date: Optional[datetime] = None
    category: Optional[str] = None
    color: Optional[str] = "#6366f1"
    reminder_minutes_before: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    category: Optional[str] = None
    color: Optional[str] = None
    reminder_minutes_before: Optional[int] = None


class TaskResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    due_date: Optional[datetime] = None
    category: Optional[str] = None
    color: Optional[str] = "#6366f1"
    reminder_minutes_before: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = "📋"
    color: Optional[str] = "#6366f1"


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None