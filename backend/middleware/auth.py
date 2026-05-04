import logging
import os

from dotenv import load_dotenv, find_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

# SECRET_KEY resolution
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
    # find_dotenv() - to find a .env file
    _env_path = find_dotenv(usecwd=False)
    if _env_path:
        load_dotenv(_env_path, override=False)
        logger.info("auth middleware: loaded .env from %s", _env_path)
    else:
        load_dotenv(override=False)  # still try CWD as last resort
    _SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    _ALGORITHM  = os.getenv("ALGORITHM",  "HS256")

SECRET_KEY = _SECRET_KEY
ALGORITHM  = _ALGORITHM

logger.info(
    "auth middleware: SECRET_KEY=%s, ALGORITHM=%s",
    SECRET_KEY[:8] + "..." if len(SECRET_KEY) > 8 else SECRET_KEY,
    ALGORITHM,
)

# JWT library
# Use PyJWT.
try:
    import jwt as pyjwt
    from jwt.exceptions import InvalidTokenError, ExpiredSignatureError
    _JWT_AVAILABLE = True
    logger.info("auth middleware: PyJWT %s loaded", pyjwt.__version__)
except ImportError:
    _JWT_AVAILABLE = False
    logger.warning(
        "⚠️  PyJWT not installed — all requests authorized as user_id=1 (UNSAFE)"
    )

security = HTTPBearer(auto_error=False)


def _uuid_to_int(value: str) -> int:
    """
    Convert a Supabase UUID string to a stable positive integer for the quiz
    tables' INTEGER user_id column.  Lower 63 bits of UUID.int — deterministic
    and collision-free within a project.
    """
    import uuid as _uuid
    try:
        return _uuid.UUID(value).int & 0x7FFFFFFFFFFFFFFF
    except (ValueError, AttributeError):
        return int(value)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> int:
    """
    Decode the Bearer JWT, verify its signature with the shared SECRET_KEY,
    and return a stable integer user_id.

    Expected token claims (set by M1 create_access_token):
        sub   → Supabase UUID string
        email → user email
        exp   → expiry Unix timestamp
    """
    if not _JWT_AVAILABLE:
        return 1

    if credentials is None:
        logger.warning("auth: no Bearer credentials in request")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

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
        # Log the first 40 chars of the token so we can confirm it's arriving
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
        logger.warning("auth: 'sub' claim missing from payload: %s", list(payload.keys()))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: missing 'sub' claim",
        )

    try:
        user_id = _uuid_to_int(str(sub))
        logger.debug("auth: resolved user_id=%s from sub=%s", user_id, sub)
        return user_id
    except (ValueError, TypeError) as exc:
        logger.warning("auth: cannot resolve user_id from sub=%s: %s", sub, exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: cannot resolve user identity",
        )
