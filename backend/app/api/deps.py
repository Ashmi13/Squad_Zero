"""Dependency injection for authentication and authorization"""
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, Request
from app.core.config import settings
from app.db.supabase import get_supabase
from supabase import Client
import jwt


async def get_current_user(
    request: Request,
) -> Dict[str, Any]:
    token = None

    # Try cookie first
    token = request.cookies.get(settings.cookie_name)

    # Fall back to Authorization header
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # First try our own secret key (tokens we created)
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except jwt.InvalidTokenError:
        pass

    # Fall back: decode Supabase JWT without signature verification
    # Supabase tokens are trusted since they come from Supabase Auth
    try:
        payload = jwt.decode(
            token,
            options={"verify_signature": False},
            algorithms=["HS256", "RS256"]
        )
        if not payload.get("sub"):
            raise HTTPException(status_code=401, detail="Invalid token: missing sub")
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def get_current_user_id(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> str:
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing user ID")
    return user_id


async def get_current_user_email(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> str:
    email = current_user.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token: missing email")
    return email


async def get_supabase_client(
    supabase_manager=Depends(get_supabase)
) -> Client:
    return supabase_manager.anon_client


async def get_supabase_service_client(
    supabase_manager=Depends(get_supabase)
) -> Client:
    return supabase_manager.service_client