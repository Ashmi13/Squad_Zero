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
    SuspendedAccountInfoResponse,
    UserResponse,
)
from app.services.auth_service import AuthService
from app.api.deps import (
    get_supabase_client,
    get_supabase_service_client,
    get_current_user,
    get_current_user_id,
)
from middleware.error_handler import SuspendedAccountError

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
    try:
        supabase_client.storage.create_bucket(bucket, options={"public": True})
    except Exception as create_exc:
        if "already exists" not in str(create_exc).lower():
            raise


@router.post("/signup", response_model=SessionResponse)
async def signup(
    request: SignupRequest,
    response: Response,
    supabase_client: Any = Depends(get_supabase_client),
):
    """Sign up a new user"""
    try:
        auth_service = AuthService(supabase_client)

        user_data = await auth_service.signup(
            email=request.email,
            password=request.password,
            full_name=request.full_name,
        )

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
        raise HTTPException(status_code=400, detail=f"Signup failed: {str(e)}")


@router.post("/signin", response_model=SessionResponse)
async def signin(
    request: SigninRequest,
    response: Response,
    supabase_client: Any = Depends(get_supabase_client),
):
    """Sign in with email and password"""
    try:
        auth_service = AuthService(supabase_client)

        auth_result = await auth_service.signin(
            email=request.email,
            password=request.password,
        )

        user_data = auth_result["user"]

        access_token = create_access_token(
            data={
                "sub": user_data["id"],
                "email": user_data["email"],
                "role": user_data.get("role", "user"),
                "is_suspended": bool(user_data.get("is_suspended", False)),
            }
        )

        refresh_token = create_refresh_token(
            data={
                "sub": user_data["id"],
                "email": user_data["email"],
                "role": user_data.get("role", "user"),
                "is_suspended": bool(user_data.get("is_suspended", False)),
            }
        )

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
                is_suspended=bool(user_data.get("is_suspended", False)),
            ),
        )

    except Exception as e:
        message = str(e)
        if "suspend" in message.lower():
            raise HTTPException(
                status_code=403,
                detail="Your account has been suspended. Please contact NeuroNote support.",
            )
        
        detail_msg = message if message.startswith("Signin failed:") else f"Signin failed: {message}"
        raise HTTPException(status_code=401, detail=detail_msg)


@router.get("/suspended-info", response_model=SuspendedAccountInfoResponse)
async def get_suspended_account_info():
    """Public support details for the suspended-account page."""
    return SuspendedAccountInfoResponse(
        title="Your account has been suspended",
        message=(
            "Your access to Neura Note has been temporarily blocked by an administrator. "
            "If you believe this is a mistake, please contact our support team."
        ),
        support_name=settings.support_contact_name,
        contact_email=settings.support_contact_email,
    )


@router.post("/logout")
async def logout(response: Response):
    """Logout the current user (clears session cookie)"""
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
            .select("id,email,full_name,avatar_url,role,is_suspended")
            .eq("id", user_id)
            .single()
            .execute()
        )
        user_data = user_response.data
        if not user_data:
            raise HTTPException(status_code=404, detail="User profile not found")

        effective_role = (
            "admin"
            if settings.super_admin_id and str(user_data.get("id")) == str(settings.super_admin_id)
            else user_data.get("role", "user")
        )

        return UserResponse(
            id=user_data["id"],
            email=user_data["email"],
            full_name=user_data.get("full_name"),
            avatar_url=user_data.get("avatar_url"),
            role=effective_role,
            is_suspended=bool(user_data.get("is_suspended", False)),
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
            role=row.get("role", "user"),
            is_suspended=bool(row.get("is_suspended", False)),
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
    """Upload profile image to AWS S3 or Supabase Storage fallback."""
    if not image.filename:
        raise HTTPException(status_code=400, detail="Image filename is required")

    content = await image.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")

    ext = os.path.splitext(image.filename)[1].lower() or ".jpg"
    object_key = f"profiles/{user_id}/{uuid.uuid4().hex}{ext}"
    avatar_url = None

    bucket = _profile_bucket_name()
    try:
        # Remove the old profile image from Supabase Storage if it exists
        try:
            old_row = (
                supabase_client.table("users")
                .select("avatar_url")
                .eq("id", user_id)
                .single()
                .execute()
            )
            old_url = (old_row.data or {}).get("avatar_url") or ""
            # Only remove if it was stored in the same Supabase bucket
            supabase_public_prefix = supabase_client.storage.from_(bucket).get_public_url("")
            if old_url.startswith(supabase_public_prefix):
                old_path = old_url[len(supabase_public_prefix):]
                if old_path:
                    supabase_client.storage.from_(bucket).remove([old_path])
        except Exception:
            pass  # non-critical — old file cleanup is best-effort

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
            role=row.get("role", "user"),
            is_suspended=bool(row.get("is_suspended", False)),
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
    """Refresh access token using refresh token"""
    try:
        claims = decode_token(request.refresh_token)

        if not claims or claims.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        access_token = create_access_token(
            data={
                "sub": claims.get("sub"),
                "email": claims.get("email"),
                "role": claims.get("role", "user"),
            }
        )

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
    return RedirectResponse(url=google_auth_url)


@router.get("/google/callback")
async def google_callback(
    code: str,
    response: Response,
    supabase_client: Any = Depends(get_supabase_service_client)
):
    """Handle Google OAuth callback"""
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=400, detail="Google OAuth not configured")

    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "code": code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": settings.google_redirect_uri,
        "grant_type": "authorization_code",
    }

    frontend_url = next((o for o in settings.cors_origins_list if "vercel.app" in o), settings.cors_origins_list[0])

    async with httpx.AsyncClient() as client:
        token_response = await client.post(token_url, data=token_data)
        if token_response.status_code != 200:
            return RedirectResponse(url=f"{frontend_url}/signin?error=CodeExchangeFailed")

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        user_info_response = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if user_info_response.status_code != 200:
            return RedirectResponse(url=f"{frontend_url}/signin?error=UserInfoFailed")

        google_user = user_info_response.json()

    auth_service = AuthService(supabase_client)
    try:
        user_record = await auth_service.get_or_create_google_user(google_user)

        token_payload = {
            "sub": user_record["id"],
            "email": user_record["email"],
            "full_name": user_record.get("full_name"),
            "avatar_url": user_record.get("avatar_url"),
            "role": user_record.get("role", "user"),
        }

        internal_access_token = create_access_token(data=token_payload)
        set_session_cookie(response, internal_access_token)

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
    """Request a password reset email"""
    try:
        user_response = supabase_client.table("users").select("*").eq(
            "email", request.email
        ).single().execute()

        if not user_response.data:
            return {"message": "If account exists, password reset instructions will be sent"}

        supabase_client.auth.reset_password_for_email(email=request.email)
        return {"message": "If account exists, password reset instructions will be sent"}

    except Exception:
        return {"message": "If account exists, password reset instructions will be sent"}


@router.post("/confirm-password-reset")
async def confirm_password_reset(
    request: PasswordResetConfirm,
    supabase_client: Any = Depends(get_supabase_client),
):
    """Confirm password reset using Supabase update_user"""
    try:
        auth_response = supabase_client.auth.update_user(
            {"password": request.new_password}
        )

        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Failed to reset password")

        return {"message": "Password updated successfully"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Password reset failed: {str(e)}")


@router.get("/verification-status")
async def get_verification_status(
    email: str,
    supabase_client: Any = Depends(get_supabase_service_client),
):
    """Check whether an email is verified using Supabase Auth Admin API."""
    normalized_email = (email or "").strip().lower()
    if not normalized_email:
        raise HTTPException(status_code=400, detail="Email is required")

    try:
        users_response = supabase_client.auth.admin.list_users()

        users_payload = []
        if isinstance(users_response, dict):
            users_payload = users_response.get("users") or []
        elif hasattr(users_response, "users"):
            users_payload = getattr(users_response, "users") or []
        elif isinstance(users_response, list):
            users_payload = users_response

        for user in users_payload:
            user_email = ""
            confirmed_at = None

            if isinstance(user, dict):
                user_email = str(user.get("email") or "").strip().lower()
                confirmed_at = user.get("email_confirmed_at")
            else:
                user_email = str(getattr(user, "email", "") or "").strip().lower()
                confirmed_at = getattr(user, "email_confirmed_at", None)

            if user_email == normalized_email:
                return {
                    "email": normalized_email,
                    "is_verified": bool(confirmed_at),
                    "email_confirmed_at": confirmed_at,
                }

        return {
            "email": normalized_email,
            "is_verified": False,
            "email_confirmed_at": None,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to check verification status: {str(exc)}")
