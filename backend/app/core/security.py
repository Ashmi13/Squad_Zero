"""Security utilities: cookies, JWT, and auth helpers"""
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from fastapi.responses import Response
import jwt
import bcrypt
from app.core.config import settings


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode(), salt).decode()


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its bcrypt hash"""
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def create_refresh_token(data: Dict[str, Any]) -> str:
    """Create a JWT refresh token with longer expiry"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode a JWT token and return claims, or None if invalid/expired"""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def set_session_cookie(response: Response, token: str) -> Response:
    """Set an HttpOnly, Secure session cookie with the access token"""
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        httponly=settings.cookie_httponly,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        max_age=settings.access_token_expire_minutes * 60,
    )
    return response


def clear_session_cookie(response: Response) -> Response:
    """Clear the session cookie"""
    response.delete_cookie(
        key=settings.cookie_name,
        httponly=settings.cookie_httponly,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
    )
    return response


class AuthError(Exception):
    """Base authentication exception"""
    def __init__(self, detail: str, status_code: int = 401):
        self.detail = detail
        self.status_code = status_code
        super().__init__(self.detail)


class InvalidCredentialsError(AuthError):
    """Raised when credentials are invalid"""
    def __init__(self):
        super().__init__("Invalid credentials", 401)


class TokenExpiredError(AuthError):
    """Raised when token is expired"""
    def __init__(self):
        super().__init__("Token expired", 401)


class InvalidTokenError(AuthError):
    """Raised when token is invalid"""
    def __init__(self):
        super().__init__("Invalid token", 401)


class UnauthorizedError(AuthError):
    """Raised when user is not authenticated"""
    def __init__(self):
        super().__init__("Not authenticated", 401)


class ForbiddenError(AuthError):
    """Raised when user lacks required permissions"""
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(detail, 403)
