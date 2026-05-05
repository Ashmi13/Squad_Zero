import hashlib
import logging
import os

from dotenv import load_dotenv, find_dotenv
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

# Secret / algorithm resolution
_SECRET_KEY = None
_ALGORITHM  = None

try:
    from app.core.config import settings as _m1_settings
    _SECRET_KEY = _m1_settings.secret_key
    _ALGORITHM  = _m1_settings.algorithm
    logger.info("auth middleware: using M1 pydantic settings for JWT key")
except Exception as _e:
    logger.warning("auth middleware: M1 settings unavailable (%s), falling back to dotenv", _e)

if _SECRET_KEY is None:
    _env_path = find_dotenv(usecwd=False)
    if _env_path:
        load_dotenv(_env_path, override=False)
    else:
        load_dotenv(override=False)
    _SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    _ALGORITHM  = os.getenv("ALGORITHM",  "HS256")

SECRET_KEY = _SECRET_KEY
ALGORITHM  = _ALGORITHM

# PyJWT
try:
    import jwt as pyjwt
    from jwt.exceptions import InvalidTokenError, ExpiredSignatureError
    _JWT_AVAILABLE = True
    logger.info("auth middleware: PyJWT %s loaded", pyjwt.__version__)
except ImportError:
    _JWT_AVAILABLE = False
    logger.warning("⚠️  PyJWT not installed — all requests authorized as user_id=1 (UNSAFE)")

security = HTTPBearer(auto_error=False)

# Guest session ID range
# Guest IDs occupy the negative int64 space so they never collide with real
# Supabase-UUID-derived user IDs (which are always positive).
_GUEST_NAMESPACE = "neuranote-guest-"


def _uuid_to_int(value: str) -> int:
    import uuid as _uuid
    try:
        return _uuid.UUID(value).int & 0x7FFFFFFFFFFFFFFF
    except (ValueError, AttributeError):
        return int(value)


def _guest_session_to_int(session_id: str) -> int:
    """
    Hash a guest session ID string to a stable negative int64.
    Negative range ensures zero collision with real user IDs.
    """
    h = int(hashlib.sha256((_GUEST_NAMESPACE + session_id).encode()).hexdigest(), 16)
    # Map to negative int64 range: -(2^63) … -1
    return -(h % (2 ** 63)) - 1


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> int:
    """
    Resolve the caller to a stable integer user_id by trying in order:

    1. Bearer JWT  → verified, returns positive int derived from Supabase UUID
    2. X-Guest-Session-ID header → returns stable negative int (session-scoped)
    3. Neither present → 401 Unauthorized
    """
    # Path 1: Bearer JWT
    if credentials is not None:
        if not _JWT_AVAILABLE:
            return 1  # dev fallback

        token = credentials.credentials
        try:
            payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except ExpiredSignatureError as exc:
            logger.warning("auth: token expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired — please log in again",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
        except InvalidTokenError as exc:
            logger.warning(
                "auth: InvalidTokenError — %s | token prefix: %s...",
                exc, token[:40]
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token invalid: {exc}",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: missing 'sub' claim",
            )

        try:
            return _uuid_to_int(str(sub))
        except (ValueError, TypeError) as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: cannot resolve user identity",
            ) from exc

    # Path 2: Guest session
    guest_id = request.headers.get("X-Guest-Session-ID", "").strip()
    if guest_id:
        user_id = _guest_session_to_int(guest_id)
        logger.debug("auth: guest session %s → user_id=%s", guest_id[:12], user_id)
        return user_id

    # Path 3: No credentials at all
    logger.warning("auth: no Bearer token and no X-Guest-Session-ID in request")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )
