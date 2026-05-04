"""Public announcement endpoints"""
from fastapi import APIRouter, Depends
from typing import List
from supabase import Client
from app.api.deps import get_supabase_service_client, get_current_user_id
from app.schemas.announcements import (
    Announcement,
    AnnouncementStatusResponse,
    AnnouncementWithStatusResponse,
)

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
    
    # Normalize response shape to match schema
    data = []
    for row in (response.data or []):
        data.append({
            "id": row.get("id"),
            "title": row.get("title", ""),
            "content": row.get("content", ""),
            "type": row.get("type", "info"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
            "created_by": str(row.get("created_by", "")),
        })

    return data


@router.get("/status", response_model=AnnouncementStatusResponse)
async def get_announcement_status(
    user_id: str = Depends(get_current_user_id),
    supabase_client: Client = Depends(get_supabase_service_client),
):
    """Get per-user read/unread announcement status."""
    all_announcements = (
        supabase_client.table("announcements").select("id").execute()
    )
    total_announcements = len(all_announcements.data or [])

    read_rows = (
        supabase_client.table("user_announcement_status")
        .select("announcement_id")
        .eq("user_id", user_id)
        .eq("is_read", True)
        .execute()
    )
    read_ids = sorted(
        {
            int(row["announcement_id"])
            for row in (read_rows.data or [])
            if row.get("announcement_id") is not None
        }
    )
    read_count = len(read_ids)

    return {
        "total_announcements": total_announcements,
        "read_count": read_count,
        "unread_count": max(total_announcements - read_count, 0),
        "read_announcement_ids": read_ids,
    }


@router.get("/with-status", response_model=AnnouncementWithStatusResponse)
async def list_announcements_with_status(
    user_id: str = Depends(get_current_user_id),
    supabase_client: Client = Depends(get_supabase_service_client),
):
    """Return announcements plus per-user read status in one request."""
    announcements_response = (
        supabase_client.table("announcements")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )

    announcements = []
    for row in (announcements_response.data or []):
        announcements.append({
            "id": row.get("id"),
            "title": row.get("title", ""),
            "content": row.get("content", ""),
            "type": row.get("type", "info"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
            "created_by": str(row.get("created_by", "")),
        })

    read_rows = (
        supabase_client.table("user_announcement_status")
        .select("announcement_id")
        .eq("user_id", user_id)
        .eq("is_read", True)
        .execute()
    )
    read_ids = sorted(
        {
            int(row["announcement_id"])
            for row in (read_rows.data or [])
            if row.get("announcement_id") is not None
        }
    )
    total_announcements = len(announcements)
    read_count = len(read_ids)

    return {
        "announcements": announcements,
        "status": {
            "total_announcements": total_announcements,
            "read_count": read_count,
            "unread_count": max(total_announcements - read_count, 0),
            "read_announcement_ids": read_ids,
        },
    }


@router.post("/{announcement_id}/read")
async def mark_announcement_as_read(
    announcement_id: int,
    user_id: str = Depends(get_current_user_id),
    supabase_client: Client = Depends(get_supabase_service_client),
):
    """Mark one announcement as read for the current user."""
    supabase_client.table("user_announcement_status").upsert(
        {
            "user_id": user_id,
            "announcement_id": announcement_id,
            "is_read": True,
        },
        on_conflict="user_id,announcement_id",
    ).execute()
    return {"status": "success"}


@router.post("/read-all")
async def mark_all_announcements_as_read(
    user_id: str = Depends(get_current_user_id),
    supabase_client: Client = Depends(get_supabase_service_client),
):
    """Mark all current announcements as read for the current user."""
    announcements_response = supabase_client.table("announcements").select("id").execute()
    ids = [row.get("id") for row in (announcements_response.data or []) if row.get("id") is not None]
    if not ids:
        return {"status": "success", "count": 0}

    payload = [
        {
            "user_id": user_id,
            "announcement_id": int(announcement_id),
            "is_read": True,
        }
        for announcement_id in ids
    ]
    supabase_client.table("user_announcement_status").upsert(
        payload,
        on_conflict="user_id,announcement_id",
    ).execute()
    return {"status": "success", "count": len(payload)}
