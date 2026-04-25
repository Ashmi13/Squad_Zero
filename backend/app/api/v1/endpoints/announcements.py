"""Public announcement endpoints"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from supabase import Client
from app.api.deps import get_supabase_service_client
from app.schemas.announcements import Announcement

router = APIRouter(prefix="/announcements", tags=["announcements"])

@router.get("/", response_model=List[Announcement])
async def list_announcements(
    supabase_client: Client = Depends(get_supabase_service_client),
):
    """List all public announcements for users"""
    response = (
        supabase_client.table("announcements")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return response.data
