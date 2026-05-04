from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user
from app.db.supabase import get_supabase
from app.schemas.calendar import CalendarEventCreate, CalendarEventUpdate
from typing import List
from datetime import datetime, timezone

router = APIRouter(prefix="/calendar", tags=["Calendar"])


# get all calendar events for the user, with optional year/month filter
@router.get("/events", response_model=List[dict])
async def get_events(
    year: int = None,
    month: int = None,
    current_user: dict = Depends(get_current_user),
):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")

    query = supabase.table("calendar_events").select("*").eq("user_id", user_id)

    # filter by month range if year and month are given
    if year and month:
        start = datetime(year, month, 1, tzinfo=timezone.utc)
        end = (
            datetime(year + 1, 1, 1, tzinfo=timezone.utc)
            if month == 12
            else datetime(year, month + 1, 1, tzinfo=timezone.utc)
        )
        query = query.gte("start_time", start.isoformat()).lt("start_time", end.isoformat())

    res = query.order("start_time").execute()
    return res.data or []


# save a new calendar event
@router.post("/events", response_model=dict)
async def create_event(event: CalendarEventCreate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")

    data = {
        "user_id": user_id,
        "title": event.title,
        "description": event.description,
        "start_time": event.start_time.isoformat(),
        "end_time": event.end_time.isoformat(),
        "color": event.color or "#6366f1",
        "all_day": event.all_day or False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    res = supabase.table("calendar_events").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create event")
    return res.data[0]


# update an existing event (title, time, color, etc.)
@router.patch("/events/{event_id}", response_model=dict)
async def update_event(
    event_id: str,
    event: CalendarEventUpdate,
    current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")

    update_data = {k: v for k, v in event.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    res = (
        supabase.table("calendar_events")
        .update(update_data)
        .eq("id", event_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Event not found")
    return res.data[0]


# delete a calendar event
@router.delete("/events/{event_id}")
async def delete_event(event_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")

    res = (
        supabase.table("calendar_events")
        .delete()
        .eq("id", event_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Event deleted"}