"""Authentication endpoints: signup, signin, session, logout, password reset"""
from fastapi import APIRouter, HTTPException, Response, Depends, Request
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer
from supabase import Client
from datetime import timedelta
import httpx
import json
from app.core.security import (
    create_access_token,
    create_refresh_token,
    set_session_cookie,
    clear_session_cookie,
    decode_token,
)
from app.core.config import settings
from app.schemas.auth import (
    SignupRequest,
    SigninRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
    RefreshTokenRequest,
    SessionResponse,
    UserResponse,
)
from app.services.auth_service import AuthService
from app.api.deps import (
    get_supabase_client,
    get_supabase_service_client,
    get_current_user,
    get_current_user_id,
)

router = APIRouter(prefix="/auth", tags=["authentication"])

security = HTTPBearer(auto_error=False)


@router.post("/signup", response_model=SessionResponse)
async def signup(
    request: SignupRequest,
    response: Response,
    supabase_client: Client = Depends(get_supabase_service_client),
):
    """Sign up a new user"""
    try:
        auth_service = AuthService(supabase_client)
        
        # Create user in Supabase Auth and users table
        user_data = await auth_service.signup(
            email=request.email,
            password=request.password,
            full_name=request.full_name,
        )
        
        # Create tokens
        access_token = create_access_token(
            data={
                "sub": user_data["id"],
                "email": user_data["email"],
                "role": user_data.get("role", "user"),
            }
        )
        
        refresh_token = create_refresh_token(
            data={
                "sub": user_data["id"],
                "email": user_data["email"],
                "role": user_data.get("role", "user"),
            }
        )
        
        # Set session cookie
        set_session_cookie(response, access_token)
        
        return SessionResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user=UserResponse(
                id=user_data["id"],
                email=user_data["email"],
                full_name=user_data.get("full_name"),
                role=user_data.get("role", "user"),
            ),
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Signup failed: {str(e)}"
        )


@router.post("/signin", response_model=SessionResponse)
async def signin(
    request: SigninRequest,
    response: Response,
    supabase_client: Client = Depends(get_supabase_client),
):
    """Sign in with email and password"""
    try:
        auth_service = AuthService(supabase_client)
        
        # Authenticate user
        auth_result = await auth_service.signin(
            email=request.email,
            password=request.password,
        )
        
        user_data = auth_result["user"]
        
        # Create tokens
        access_token = create_access_token(
            data={
                "sub": user_data["id"],
                "email": user_data["email"],
                "role": user_data.get("role", "user"),
            }
        )
        
        refresh_token = create_refresh_token(
            data={
                "sub": user_data["id"],
                "email": user_data["email"],
                "role": user_data.get("role", "user"),
            }
        )
        
        # Set session cookie
        set_session_cookie(response, access_token)
        
        return SessionResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user=UserResponse(
                id=user_data["id"],
                email=user_data["email"],
                full_name=user_data.get("full_name"),
                role=user_data.get("role", "user"),
            ),
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Signin failed: {str(e)}"
        )


@router.post("/logout")
async def logout(response: Response):
    """Logout the current user (clears session cookie)
    
    Args:
        response: FastAPI Response object for clearing cookies
        
    Returns:
        Success message
    """
    clear_session_cookie(response)
    return {"message": "Logged out successfully"}


@router.post("/refresh-token", response_model=SessionResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    response: Response,
):
    """Refresh access token using refresh token
    
    Args:
        request: RefreshTokenRequest with refresh_token
        response: FastAPI Response object for setting cookies
        
    Returns:
        SessionResponse with new access token
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        # Decode refresh token
        claims = decode_token(request.refresh_token)
        
        if not claims or claims.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        # Create new access token
        access_token = create_access_token(
            data={
                "sub": claims.get("sub"),
                "email": claims.get("email"),
                "role": claims.get("role", "user"),
            }
        )
        
        # Set new session cookie
        set_session_cookie(response, access_token)
        
        return SessionResponse(
            access_token=access_token,
            refresh_token=request.refresh_token,
            token_type="bearer",
            user=UserResponse(
                id=claims.get("sub"),
                email=claims.get("email"),
                role=claims.get("role", "user"),
            ),
        )
        
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@router.get("/google-login")
async def google_login():
    """Build and return the Google OAuth authorization URL"""
    print(f"DEBUG: google_login called. Client ID: {settings.google_client_id}")
    if not settings.google_client_id:
        raise HTTPException(status_code=400, detail="Google OAuth not configured")
        
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?response_type=code"
        f"&client_id={settings.google_client_id}"
        f"&redirect_uri={settings.google_redirect_uri}"
        f"&scope=openid%20email%20profile"
        f"&access_type=offline"
        f"&prompt=select_account"
    )
    print(f"DEBUG: Redirecting to {google_auth_url}")
    return RedirectResponse(url=google_auth_url)


@router.get("/google/callback")
async def google_callback(
    code: str, 
    response: Response,
    supabase_client: Client = Depends(get_supabase_service_client)
):
    """Handle Google OAuth callback, exchange code for token, and log in user"""
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=400, detail="Google OAuth not configured")

    # 1. Exchange the code for an access token
    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "code": code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": settings.google_redirect_uri,
        "grant_type": "authorization_code",
    }
    
    # Priority on localhost:5173 for Vite development
    frontend_url = next((o for o in settings.cors_origins_list if "5173" in o), settings.cors_origins_list[0])
    
    async with httpx.AsyncClient() as client:
        token_response = await client.post(token_url, data=token_data)
        if token_response.status_code != 200:
            return RedirectResponse(url=f"{frontend_url}/signin?error=CodeExchangeFailed")
        
        tokens = token_response.json()
        access_token = tokens.get("access_token")
        
        # 2. Use the access token to get user info from Google
        user_info_response = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo", 
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if user_info_response.status_code != 200:
            return RedirectResponse(url=f"{frontend_url}/signin?error=UserInfoFailed")
        
        google_user = user_info_response.json()
        
    # 3. Handle user in our auth system
    auth_service = AuthService(supabase_client)
    try:
        user_record = await auth_service.get_or_create_google_user(google_user)
        
        # 4. Create internal JWT tokens
        token_payload = {
            "sub": user_record["id"],
            "email": user_record["email"],
            "full_name": user_record.get("full_name"),
            "avatar_url": user_record.get("avatar_url"),
            "role": user_record.get("role", "user")
        }
        
        internal_access_token = create_access_token(data=token_payload)
        
        # 5. Set session cookie
        set_session_cookie(response, internal_access_token)
        
        # 6. Redirect back to frontend
        # Instead of just /dashboard, we pass the user data and token in the URL fragment 
        # so the frontend can "see" it and initialize localStorage properly.
        # This is the "Bridge" between Cookie-based Backend and LocalStorage-based Frontend.
        import urllib.parse
        user_json = urllib.parse.quote(json.dumps(token_payload))
        target_url = f"{frontend_url}/oauth/callback#access={internal_access_token}&user={user_json}"
        
        return RedirectResponse(url=target_url)
        
    except Exception as e:
        return RedirectResponse(url=f"{frontend_url}/login?error={str(e)}")


@router.post("/request-password-reset")
async def request_password_reset(
    request: PasswordResetRequest,
    supabase_client: Client = Depends(get_supabase_service_client),
):
    """Request a password reset for email"""
    try:
        # Find user by email
        user_response = supabase_client.table("users").select("*").eq(
            "email", request.email
        ).single().execute()
        
        if not user_response.data:
            # Return success anyway to avoid user enumeration
            return {
                "message": "If account exists, password reset instructions will be sent"
            }
        
        # Core: Use Supabase Auth's built-in reset
        supabase_client.auth.reset_password_for_email(
            email=request.email
        )
        
        return {
            "message": "If account exists, password reset instructions will be sent"
        }
        
    except Exception as e:
        return {
            "message": "If account exists, password reset instructions will be sent"
        }

@router.post("/confirm-password-reset")
async def confirm_password_reset(
    request: PasswordResetConfirm,
    supabase_client: Client = Depends(get_supabase_client),
):
    """Confirm password reset using Supabase update_user"""
    try:
        # Simple confirmation using Supabase update_user
        # User should be in a recovery session or authenticated
        auth_response = supabase_client.auth.update_user(
            {"password": request.new_password}
        )
        
        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Failed to reset password")
            
        return {"message": "Password updated successfully"}
        
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Password reset failed: {str(e)}"
        )

