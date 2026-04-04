"""Dependency injection for authentication and authorization"""
from typing import Optional, Dict, Any
from fastapi import Cookie, Depends, HTTPException, Request
from app.core.security import decode_token, UnauthorizedError, ForbiddenError
from app.core.config import settings
from app.db.supabase import get_supabase
from supabase import Client


async def get_current_user(
    request: Request,
) -> Dict[str, Any]:
    """Dependency to get current user from session cookie or Authorization header
    
    Args:
        request: FastAPI request object
        
    Returns:
        User claims dictionary
        
    Raises:
        HTTPException: If not authenticated
    """
    token = None
    
    # Try to get token from cookie first
    token = request.cookies.get(settings.cookie_name)
    
    # Fall back to Authorization header (Bearer token)
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Decode token
    claims = decode_token(token)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return claims


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
