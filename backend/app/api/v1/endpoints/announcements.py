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
    
    # Log the response to debug transformation
    data = []
    for row in (response.data or []):
        # Flatten or adjust fields if they differ from model
        data.append({
            "id": row.get("id"),
            "title": row.get("title", ""),
            "content": row.get("content", ""),
            "type": row.get("type", "info"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
            "created_by": str(row.get("created_by", ""))  # Ensure it stringifies
        })

    return data
