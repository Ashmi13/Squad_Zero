"""User and profile schemas"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ModuleProgress(BaseModel):
    """User module progress"""
    module_id: int = Field(..., description="Module ID")
    title: str = Field(..., description="Module title")
    status: str = Field(default="not_started", description="Progress status")
    progress_percent: int = Field(default=0, description="Progress percentage")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")


class UserProfile(BaseModel):
    """User profile information"""
    id: str = Field(..., description="User UUID")
    email: str = Field(..., description="User email")
    full_name: Optional[str] = Field(None, description="User full name")
    avatar_url: Optional[str] = Field(None, description="User avatar URL")
    role: str = Field(default="user", description="User role (admin or user)")
    created_at: Optional[datetime] = Field(None, description="Profile creation date")


class UserMeResponse(BaseModel):
    """Response for /me endpoint"""
    profile: UserProfile = Field(..., description="User profile")
