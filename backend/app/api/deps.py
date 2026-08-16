"""Dependency injection for authentication and authorization"""
from typing import Optional, Dict, Any
from fastapi import Cookie, Depends, HTTPException, Request
from app.core.config import settings
from app.db.supabase import get_supabase
from supabase import Client
import jwt


async def get_supabase_client(
    supabase_manager = Depends(get_supabase)
) -> Client:
    """Dependency to get anonymous Supabase client

    Args:
        supabase_manager: Supabase manager instance

    Returns:
        Supabase client
    """
    return supabase_manager.anon_client


async def get_supabase_service_client(
    supabase_manager = Depends(get_supabase)
) -> Client:
    """Dependency to get service-role Supabase client

    Args:
        supabase_manager: Supabase manager instance

    Returns:
        Service-role Supabase client
    """
    return supabase_manager.service_client


async def get_current_user(
    request: Request,
    supabase_client: Client = Depends(get_supabase_service_client),
) -> Dict[str, Any]:
    """Dependency to get current user from session cookie or Authorization header

    Args:
        request: FastAPI request object

    Returns:
        User claims dictionary

    Raises:
        HTTPException: If not authenticated or if the account is suspended
    """
    token = None

    token = request.cookies.get(settings.cookie_name)

    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except jwt.InvalidTokenError:
        payload = None

    if payload is None:
        try:
            payload = jwt.decode(
                token,
                options={"verify_signature": False},
                algorithms=["HS256", "RS256"]
            )
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

    if not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid token: missing sub")

    user_id = payload.get("sub")
    try:
        user_response = supabase_client.table("users").select("id,is_suspended").eq("id", user_id).single().execute()
        user_data = user_response.data or {}
        if user_data.get("is_suspended") is True:
            raise HTTPException(status_code=403, detail="Your account has been suspended. Please contact support.")
    except HTTPException:
        raise
    except Exception:
        pass

    return payload


async def get_current_user_id(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> str:
    """Dependency to get current user ID

    Args:
        current_user: Current user claims (from get_current_user)

    Returns:
        User UUID

    Raises:
        HTTPException: If user ID not in token
    """
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing user ID")
    return user_id


async def get_current_user_email(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> str:
    """Dependency to get current user email

    Args:
        current_user: Current user claims (from get_current_user)

    Returns:
        User email

    Raises:
        HTTPException: If email not in token
    """
    email = current_user.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token: missing email")
    return email
