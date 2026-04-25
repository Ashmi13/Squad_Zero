"""Notifications endpoints — Member 5"""
from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user
from app.db.supabase import get_supabase
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationCreate(BaseModel):
    message: str
    task_id: Optional[str] = None
    type: Optional[str] = "reminder"


@router.get("/", response_model=List[dict])
async def get_notifications(current_user: dict = Depends(get_current_user)):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")
    res = supabase.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(50).execute()
    return res.data or []


@router.post("/", response_model=dict)
async def create_notification(notif: NotificationCreate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")
    data = {
        "user_id": user_id,
        "message": notif.message,
        "task_id": notif.task_id,
        "type": notif.type or "reminder",
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = supabase.table("notifications").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create notification")
    return res.data[0]


@router.patch("/{notif_id}/read", response_model=dict)
async def mark_read(notif_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")
    res = supabase.table("notifications").update({"is_read": True}).eq("id", notif_id).eq("user_id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Notification not found")
    return res.data[0]


@router.patch("/mark-all-read")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")
    supabase.table("notifications").update({"is_read": True}).eq("user_id", user_id).eq("is_read", False).execute()
    return {"message": "All notifications marked as read"}


@router.delete("/{notif_id}")
async def delete_notification(notif_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")
    res = supabase.table("notifications").delete().eq("id", notif_id).eq("user_id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification deleted"}