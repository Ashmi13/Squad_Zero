"""Admin management endpoints"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
from supabase import Client
from app.api.deps import (
    get_current_user,
    get_supabase_service_client,
)
from app.schemas.user import UserProfile
from app.schemas.announcements import Announcement, AnnouncementCreate, AnnouncementUpdate
from pydantic import BaseModel, EmailStr
from app.core.config import settings

router = APIRouter(prefix="/admin", tags=["admin"])

# Get Super Admin ID from settings
SUPER_ADMIN_ID = settings.super_admin_id

class AdminStats(BaseModel):
    total_users: int
    total_files: int
    active_sessions: int
    gemini_usage: float

class RoleUpdateRequest(BaseModel):
    role: str

class UserCreateRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str

class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None

async def check_admin_role(current_user: Dict[str, Any] = Depends(get_current_user), supabase_client: Client = Depends(get_supabase_service_client)):
    """Check if the current user has the admin role"""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    response = supabase_client.table("users").select("role").eq("id", user_id).single().execute()
    if not response.data or response.data.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized. Admin access required.")
    return user_id

@router.get("/users", response_model=List[UserProfile])
async def list_users(
    admin_id: str = Depends(check_admin_role),
    supabase_client: Client = Depends(get_supabase_service_client),
):
    """List all users in the system"""
    response = supabase_client.table("users").select("*").order("created_at", desc=True).execute()
    return response.data

@router.post("/users", status_code=201)
async def create_user(
    request: UserCreateRequest,
    admin_id: str = Depends(check_admin_role),
    supabase_client: Client = Depends(get_supabase_service_client),
):
    """Create a new user using Supabase Admin API"""
    try:
        # 1. Create user in Supabase Auth via Admin API (service_client)
        auth_response = supabase_client.auth.admin.create_user({
            "email": request.email,
            "password": request.password,
            "user_metadata": {"full_name": request.full_name},
            "email_confirm": True
        })
        
        if not auth_response.user:
            raise Exception("Failed to create auth user")

        return {"status": "success", "user_id": auth_response.user.id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/users/{user_id}", response_model=UserProfile)
async def update_user(
    user_id: str,
    request: UserUpdateRequest,
    admin_id: str = Depends(check_admin_role),
    supabase_client: Client = Depends(get_supabase_service_client),
):
    """Update user information"""
    if user_id == SUPER_ADMIN_ID and admin_id != SUPER_ADMIN_ID:
        raise HTTPException(status_code=403, detail="Cannot modify Super Admin")

    update_data = {}
    if request.full_name is not None:
        update_data["full_name"] = request.full_name

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = supabase_client.table("users").update(update_data).eq("id", user_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    return response.data[0]

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    admin_id: str = Depends(check_admin_role),
    supabase_client: Client = Depends(get_supabase_service_client),
):
    """Delete user from auth and public tables"""
    if user_id == SUPER_ADMIN_ID:
        raise HTTPException(status_code=403, detail="Cannot delete Super Admin")
    
    if user_id == admin_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    try:
        # Delete from Supabase Auth
        supabase_client.auth.admin.delete_user(user_id)
        # Delete from public.users
        supabase_client.table("users").delete().eq("id", user_id).execute()
        return {"status": "success", "message": f"User {user_id} deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(
    admin_id: str = Depends(check_admin_role),
    supabase_client: Client = Depends(get_supabase_service_client),
):
    """Get overview statistics for the admin dashboard"""
    # Total users
    users_count = supabase_client.table("users").select("id", count="exact").execute()
    
    # Total files (assuming a 'files' or 'documents' table exists, if not return 0)
    try:
        files_count = supabase_client.table("files").select("id", count="exact").execute()
        total_files = files_count.count if files_count.count is not None else 0
    except:
        total_files = 0
        
    return AdminStats(
        total_users=users_count.count if users_count.count is not None else 0,
        total_files=total_files,
        active_sessions=12,  # Placeholder for demo
        gemini_usage=45.5    # Placeholder for demo
    )

@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role_update: RoleUpdateRequest,
    admin_id: str = Depends(check_admin_role),
    supabase_client: Client = Depends(get_supabase_service_client),
):
    """Update a user's role"""
    if user_id == SUPER_ADMIN_ID:
        raise HTTPException(status_code=403, detail="Cannot change role of Super Admin")

    if role_update.role not in ["admin", "user"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    response = supabase_client.table("users").update({"role": role_update.role}).eq("id", user_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"status": "success", "user": response.data[0]}


# --- Announcement Endpoints ---

@router.get("/announcements", response_model=List[Announcement])
async def list_announcements(
    admin_id: str = Depends(check_admin_role),
    supabase_client: Client = Depends(get_supabase_service_client),
):
    """List all announcements"""
    response = supabase_client.table("announcements").select("*").order("created_at", desc=True).execute()
    return response.data

@router.post("/announcements", response_model=Announcement)
async def create_announcement(
    request: AnnouncementCreate,
    admin_id: str = Depends(check_admin_role),
    supabase_client: Client = Depends(get_supabase_service_client),
):
    """Create a new announcement"""
    announcement_data = {
        "title": request.title,
        "content": request.content,
        "type": request.type or "info",
        "created_by": admin_id
    }
    response = supabase_client.table("announcements").insert(announcement_data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create announcement")
    return response.data[0]

@router.patch("/announcements/{announcement_id}", response_model=Announcement)
async def update_announcement(
    announcement_id: int,
    request: AnnouncementUpdate,
    admin_id: str = Depends(check_admin_role),
    supabase_client: Client = Depends(get_supabase_service_client),
):
    """Update an existing announcement"""
    update_data = {}
    if request.title is not None: update_data["title"] = request.title
    if request.content is not None: update_data["content"] = request.content
    if request.type is not None: update_data["type"] = request.type

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = supabase_client.table("announcements").update(update_data).eq("id", announcement_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return response.data[0]

@router.delete("/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: int,
    admin_id: str = Depends(check_admin_role),
    supabase_client: Client = Depends(get_supabase_service_client),
):
    """Delete an announcement"""
    response = supabase_client.table("announcements").delete().eq("id", announcement_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return {"status": "success", "message": "Announcement deleted"}
