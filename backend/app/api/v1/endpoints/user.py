"""User endpoints"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from supabase import Client
from app.schemas.user import UserMeResponse, UserProfile
from app.api.deps import (

    get_current_user_id,
    get_supabase_client,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserMeResponse)
async def get_current_user_profile(
    user_id: str = Depends(get_current_user_id),
    supabase_client: Client = Depends(get_supabase_client),
):
    """Get current user profile
    
    Args:
        user_id: Current user ID from token
        supabase_client: Supabase client
        
    Returns:
        UserMeResponse with profile
        
    Raises:
        HTTPException: If user profile not found
    """
    try:
        # Get user
        user_response = supabase_client.table("users").select("*").eq(
            "id", user_id
        ).single().execute()
        
        if not user_response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_data = user_response.data
        
        # Build response
        profile = UserProfile(
            id=user_data["id"],
            email=user_data["email"],
            full_name=user_data.get("full_name"),
            avatar_url=user_data.get("avatar_url"),
            role=user_data.get("role", "user"),
            created_at=user_data.get("created_at"),
        )
        
        return UserMeResponse(profile=profile)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch user: {str(e)}"
        )
