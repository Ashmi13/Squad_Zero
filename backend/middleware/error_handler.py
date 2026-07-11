import logging

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)


class SuspendedAccountError(Exception):
    """Raised when a suspended account tries to authenticate or use the API."""

    def __init__(self, message: str = "Your account has been suspended by the admin."):
        self.message = message
        super().__init__(self.message)


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors — safe to return field details"""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )


async def database_exception_handler(request: Request, exc: SQLAlchemyError):
    """Handle SQLAlchemy errors — log internally, return generic message"""
    logger.error("Database error on %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "A database error occurred. Please try again."},
    )


async def suspended_account_exception_handler(request: Request, exc: SuspendedAccountError):
    """Return the exact suspension payload expected by the client."""
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"message": exc.message},
    )


async def general_exception_handler(request: Request, exc: Exception):
    """Catch-all handler — never expose internal details to the client"""
    logger.error(
        "Unhandled exception on %s %s",
        request.method, request.url.path,
        exc_info=exc,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred."},
    )
