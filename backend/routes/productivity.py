"""Productivity routes for Pomodoro sessions and dashboard metrics."""

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from supabase import Client

from app.api.deps import get_current_user_id, get_supabase_service_client
from app.services.productivity_service import ProductivityService


router = APIRouter(tags=["productivity"])


class FocusSessionRequest(BaseModel):
    focus_duration: int = Field(gt=0)
    completed_at: Optional[str] = None
    date: Optional[str] = None


@router.post("/focus-sessions")
async def create_focus_session(
    payload: FocusSessionRequest,
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):
    service = ProductivityService(supabase)
    session = service.log_focus_session(
        user_id=user_id,
        focus_duration=payload.focus_duration,
        completed_at=payload.completed_at,
        session_date=payload.date,
    )
    return {"session": session}


@router.get("/dashboard")
async def productivity_dashboard(
    user_id: str = Depends(get_current_user_id),
    supabase: Client = Depends(get_supabase_service_client),
):
    service = ProductivityService(supabase)
    return service.get_dashboard(user_id)
