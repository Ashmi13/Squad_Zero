"""Task and Category endpoints — Member 5"""
from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user
from app.db.supabase import get_supabase
from app.schemas.tasks import TaskCreate, TaskUpdate, CategoryCreate, CategoryUpdate
from typing import List
from datetime import datetime, timezone

router = APIRouter(prefix="/tasks", tags=["Tasks"])


# ── CATEGORIES ────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=List[dict])
async def get_categories(current_user: dict = Depends(get_current_user)):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")
    res = supabase.table("task_categories").select("*").eq("user_id", user_id).order("sort_order").execute()
    return res.data or []


@router.post("/categories", response_model=dict)
async def create_category(category: CategoryCreate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")
    existing = supabase.table("task_categories").select("sort_order").eq("user_id", user_id).order("sort_order", desc=True).limit(1).execute()
    sort_order = (existing.data[0]["sort_order"] + 1) if existing.data else 0
    data = {
        "user_id": user_id,
        "name": category.name,
        "icon": category.icon or "📋",
        "color": category.color or "#6366f1",
        "sort_order": sort_order,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = supabase.table("task_categories").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create category")
    return res.data[0]


@router.patch("/categories/{cat_id}", response_model=dict)
async def update_category(cat_id: str, category: CategoryUpdate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")
    update_data = {k: v for k, v in category.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = supabase.table("task_categories").update(update_data).eq("id", cat_id).eq("user_id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Category not found")
    return res.data[0]


@router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")
    res = supabase.table("task_categories").delete().eq("id", cat_id).eq("user_id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}


# ── TASKS ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[dict])
async def get_tasks(
    category: str = None,
    status: str = None,
    current_user: dict = Depends(get_current_user),
):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")
    query = supabase.table("tasks").select("*").eq("user_id", user_id)
    if category:
        query = query.eq("category", category)
    if status:
        query = query.eq("status", status)
    res = query.order("created_at", desc=True).execute()
    return res.data or []


@router.post("/", response_model=dict)
async def create_task(task: TaskCreate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")
    task_data = {
        "user_id": user_id,
        "title": task.title,
        "description": task.description,
        "status": task.status or "todo",
        "priority": task.priority or "medium",
        "category": task.category or "personal",
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "color": task.color or "#6366f1",
        "reminder_minutes_before": task.reminder_minutes_before,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    res = supabase.table("tasks").insert(task_data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create task")
    return res.data[0]


@router.patch("/{task_id}", response_model=dict)
async def update_task(task_id: str, task: TaskUpdate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")
    update_data = {k: v for k, v in task.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    if "due_date" in update_data and update_data["due_date"]:
        update_data["due_date"] = update_data["due_date"].isoformat()
    res = supabase.table("tasks").update(update_data).eq("id", task_id).eq("user_id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return res.data[0]


@router.delete("/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")
    res = supabase.table("tasks").delete().eq("id", task_id).eq("user_id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}


@router.patch("/{task_id}/toggle")
async def toggle_task(task_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase().service_client
    user_id = current_user.get("sub")
    current = supabase.table("tasks").select("status").eq("id", task_id).eq("user_id", user_id).execute()
    if not current.data:
        raise HTTPException(status_code=404, detail="Task not found")
    new_status = "done" if current.data[0]["status"] != "done" else "todo"
    res = supabase.table("tasks").update({
        "status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", task_id).eq("user_id", user_id).execute()
    return res.data[0]