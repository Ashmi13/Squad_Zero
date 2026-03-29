from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from datetime import datetime, timedelta
import secrets
import time
import httpx
import jwt

from app.core.config import settings
from app.core.security import (
    get_password_hash, create_access_token, create_refresh_token, 
    hash_token, verify_password
)
from app.db.mongodb import get_user, create_user, update_user, fake_users_db
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.schemas.token import Token, RefreshTokenRequest
from app.utils.rate_limit import check_rate_limit
from app.api.deps import get_current_user

router = APIRouter()

# Simple in-memory storage for OAuth state
oauth_state_store = {}

def authenticate_user(email: str, password: str):
    """Authenticate user with email and password"""
    user = get_user(email)
    if not user:
        return False
    if user.get("lockout_until"):
        lockout_until = user.get("lockout_until")
        if isinstance(lockout_until, datetime) and lockout_until > datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="Account is temporarily locked. Please try again later."
            )
    if not verify_password(password, user["hashed_password"]):
        failed_attempts = user.get("failed_attempts", 0) + 1
        lockout_until = None
        if failed_attempts >= 5:
            lockout_until = datetime.utcnow() + timedelta(minutes=10)
            failed_attempts = 0
        update_user(email, {"failed_attempts": failed_attempts, "lockout_until": lockout_until})
        return False
    update_user(email, {"failed_attempts": 0, "lockout_until": None})
    return user

def serialize_user(user: dict) -> dict:
    return {
        "id": user.get("id") or str(user.get("_id")),
        "email": user.get("email"),
        "full_name": user.get("full_name")
    }

def serialize_user_response(user: dict) -> dict:
    return {
        "id": user.get("id") or str(user.get("_id")),
        "email": user.get("email"),
        "full_name": user.get("full_name"),
        "created_at": user.get("created_at") or datetime.utcnow()
    }

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, request: Request):
    check_rate_limit(request, "register")
    if get_user(user.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    user_id = f"user-{len(fake_users_db) + 1}"
    hashed_password = get_password_hash(user.password)
    
    new_user = {
        "id": user_id,
        "email": user.email,
        "full_name": user.full_name,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow(),
        "failed_attempts": 0,
        "lockout_until": None,
        "refresh_token_hash": None,
        "provider": "local"
    }

    create_user(new_user)
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "email": user.email, "full_name": user.full_name},
        expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(data={"sub": user.email})
    update_user(user.email, {"refresh_token_hash": hash_token(refresh_token)})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": serialize_user(new_user)
    }

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, request: Request):
    check_rate_limit(request, "login")
    user = authenticate_user(credentials.email, credentials.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"], "email": user["email"], "full_name": user.get("full_name")},
        expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(data={"sub": user["email"]})
    update_user(user["email"], {"refresh_token_hash": hash_token(refresh_token)})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": serialize_user(user)
    }

@router.get("/auth/google")
async def google_auth():
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth credentials are not configured"
        )

    state = secrets.token_urlsafe(32)
    oauth_state_store[state] = time.time()

    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?response_type=code&client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={settings.GOOGLE_REDIRECT_URI}"
        "&scope=openid%20email%20profile"
        "&access_type=offline&prompt=consent"
        f"&state={state}"
    )

    return RedirectResponse(url=auth_url)

@router.get("/auth/google/callback")
async def google_callback(code: str, state: str):
    if state not in oauth_state_store:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    oauth_state_store.pop(state, None)

    token_url = "https://oauth2.googleapis.com/token"
    userinfo_url = "https://openidconnect.googleapis.com/v1/userinfo"

    async with httpx.AsyncClient(timeout=10) as client:
        token_resp = await client.post(
            token_url,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Google token exchange failed: {token_resp.text}"
            )
        tokens = token_resp.json()

        userinfo_resp = await client.get(
            userinfo_url,
            headers={"Authorization": f"Bearer {tokens.get('access_token')}"},
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Google userinfo failed: {userinfo_resp.text}"
            )
        userinfo = userinfo_resp.json()

    email = userinfo.get("email")
    full_name = userinfo.get("name") or "Neura Note User"

    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    user = get_user(email)
    if not user:
        new_user = {
            "id": f"user-{secrets.token_hex(6)}",
            "email": email,
            "full_name": full_name,
            "hashed_password": get_password_hash(secrets.token_urlsafe(32)),
            "created_at": datetime.utcnow(),
            "failed_attempts": 0,
            "lockout_until": None,
            "refresh_token_hash": None,
            "provider": "google"
        }
        create_user(new_user)
        user = new_user

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"], "email": user["email"], "full_name": user.get("full_name")},
        expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(data={"sub": user["email"]})
    update_user(user["email"], {"refresh_token_hash": hash_token(refresh_token)})

    redirect_url = (
        f"{settings.FRONTEND_URL}/oauth/callback"
        f"#access={access_token}&refresh={refresh_token}"
        f"&email={user['email']}&name={user.get('full_name') or ''}&id={user.get('id') or ''}"
    )
    return RedirectResponse(url=redirect_url)

@router.get("/auth/github")
async def github_auth():
    return {
        "message": "GitHub OAuth not yet implemented",
        "redirect_url": "https://github.com/login/oauth/authorize"
    }

@router.post("/refresh-token", response_model=Token)
async def refresh_token(payload: RefreshTokenRequest, request: Request):
    check_rate_limit(request, "refresh")
    refresh_token = payload.refresh_token
    try:
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if email is None or token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user = get_user(email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    stored_hash = user.get("refresh_token_hash")
    if not stored_hash or stored_hash != hash_token(refresh_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked"
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"], "email": user["email"], "full_name": user.get("full_name")},
        expires_delta=access_token_expires
    )
    
    new_refresh_token = create_refresh_token(data={"sub": user["email"]})
    update_user(user["email"], {"refresh_token_hash": hash_token(new_refresh_token)})

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "user": serialize_user(user)
    }

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return serialize_user_response(current_user)

@router.post("/forgot-password")
async def forgot_password(email: str):
    user = get_user(email)
    if not user:
        return {"message": "If the email exists, a reset link has been sent"}
    return {"message": "If the email exists, a reset link has been sent"}
