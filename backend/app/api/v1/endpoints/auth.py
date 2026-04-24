"""Authentication endpoints: signup, signin, session, logout, password reset"""
import os
import uuid
from fastapi import APIRouter, HTTPException, Response, Depends, Request
from fastapi import UploadFile, File
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer
from pydantic import BaseModel
from typing import Any
from datetime import timedelta
import httpx
import json
import boto3
from botocore.exceptions import ClientError
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


class UpdateProfileRequest(BaseModel):
    full_name: str


def _aws_profile_storage_configured() -> bool:
    access_key = settings.aws_access_key_id
    secret_key = settings.aws_secret_access_key
    bucket = settings.aws_s3_bucket
    if not access_key or not secret_key or not bucket:
        return False

    lowered = f"{access_key} {secret_key} {bucket}".lower()
    placeholders = ["your-", "placeholder", "example", "changeme", "dummy", "akia1234567890abcdef"]
    return not any(marker in lowered for marker in placeholders)


def _profile_bucket_name() -> str:
    return os.getenv("SUPABASE_PROFILE_BUCKET", "profile-images")


def _create_profile_bucket_if_missing(supabase_client: Any, bucket: str) -> None:
    """Best-effort bucket creation for service-role environments.

    This keeps profile image uploads self-healing when the storage bucket
    was not pre-provisioned.
    """
    try:
        supabase_client.storage.create_bucket(bucket, options={"public": True})
    except Exception as create_exc:
        # Ignore already exists races and re-raise other creation failures.
        if "already exists" not in str(create_exc).lower():
            raise


@router.post("/signup", response_model=SessionResponse)
async def signup(
    request: SignupRequest,
    response: Response,
    supabase_client: Any = Depends(get_supabase_service_client),
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
            }
        )
        
        refresh_token = create_refresh_token(
            data={
                "sub": user_data["id"],
                "email": user_data["email"],
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
    supabase_client: Any = Depends(get_supabase_client),
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
            }
        )
        
        refresh_token = create_refresh_token(
            data={
                "sub": user_data["id"],
                "email": user_data["email"],
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


@router.get("/me", response_model=UserResponse)
async def get_current_profile(
    user_id: str = Depends(get_current_user_id),
    supabase_client: Any = Depends(get_supabase_service_client),
):
    """Get current user profile data from users table."""
    try:
        user_response = (
            supabase_client.table("users")
            .select("id,email,full_name,avatar_url")
            .eq("id", user_id)
            .single()
            .execute()
        )

        user_data = user_response.data
        if not user_data:
            raise HTTPException(status_code=404, detail="User profile not found")

        return UserResponse(
            id=user_data["id"],
            email=user_data["email"],
            full_name=user_data.get("full_name"),
            avatar_url=user_data.get("avatar_url"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {str(exc)}")


@router.patch("/profile", response_model=UserResponse)
async def update_current_profile(
    payload: UpdateProfileRequest,
    user_id: str = Depends(get_current_user_id),
    supabase_client: Any = Depends(get_supabase_service_client),
):
    """Update current user profile fields."""
    try:
        updated = (
            supabase_client.table("users")
            .update({"full_name": payload.full_name.strip()})
            .eq("id", user_id)
            .execute()
        )

        if not updated.data:
            raise HTTPException(status_code=404, detail="User profile not found")

        row = updated.data[0]
        return UserResponse(
            id=row["id"],
            email=row["email"],
            full_name=row.get("full_name"),
            avatar_url=row.get("avatar_url"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(exc)}")


@router.post("/profile/image", response_model=UserResponse)
async def upload_profile_image(
    image: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    supabase_client: Any = Depends(get_supabase_service_client),
):
    """Upload profile image to AWS S3 (if configured) or Supabase Storage fallback."""
    if not image.filename:
        raise HTTPException(status_code=400, detail="Image filename is required")

    content = await image.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")

    ext = os.path.splitext(image.filename)[1].lower() or ".jpg"
    object_key = f"profiles/{user_id}/{uuid.uuid4().hex}{ext}"
    avatar_url = None

    try:
        if _aws_profile_storage_configured():
            s3 = boto3.client(
                "s3",
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
                region_name=settings.aws_region,
            )
            s3.put_object(
                Bucket=settings.aws_s3_bucket,
                Key=object_key,
                Body=content,
                ContentType=image.content_type or "image/jpeg",
            )
            avatar_url = f"https://{settings.aws_s3_bucket}.s3.{settings.aws_region}.amazonaws.com/{object_key}"
        else:
            bucket = _profile_bucket_name()
            try:
                supabase_client.storage.from_(bucket).upload(
                    path=object_key,
                    file=content,
                    file_options={"content-type": image.content_type or "image/jpeg", "upsert": "true"},
                )
            except Exception as upload_exc:
                if "bucket not found" not in str(upload_exc).lower():
                    raise

                _create_profile_bucket_if_missing(supabase_client, bucket)
                supabase_client.storage.from_(bucket).upload(
                    path=object_key,
                    file=content,
                    file_options={"content-type": image.content_type or "image/jpeg", "upsert": "true"},
                )
            avatar_url = supabase_client.storage.from_(bucket).get_public_url(object_key)
    except ClientError as exc:
        raise HTTPException(status_code=500, detail=f"Profile image upload failed: {str(exc)}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Profile image upload failed: {str(exc)}")

    try:
        updated = (
            supabase_client.table("users")
            .update({"avatar_url": avatar_url})
            .eq("id", user_id)
            .execute()
        )
        if not updated.data:
            raise HTTPException(status_code=404, detail="User profile not found")

        row = updated.data[0]
        return UserResponse(
            id=row["id"],
            email=row["email"],
            full_name=row.get("full_name"),
            avatar_url=row.get("avatar_url"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save profile image URL: {str(exc)}")


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
    supabase_client: Any = Depends(get_supabase_service_client)
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
            "avatar_url": user_record.get("avatar_url")
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
    supabase_client: Any = Depends(get_supabase_service_client),
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
    supabase_client: Any = Depends(get_supabase_client),
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

