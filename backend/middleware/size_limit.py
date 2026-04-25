from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """
    Reject requests whose Content-Length exceeds max_size.
    Protects against DOS attacks via oversized uploads.
    Default: 50 MB (accommodates up to 20 × 25 MB files with overhead).
    """

    def __init__(self, app, max_size: int = 50 * 1024 * 1024) -> None:
        super().__init__(app)
        self.max_size = max_size

    async def dispatch(self, request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH"):
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > self.max_size:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=(
                        f"Request body too large. "
                        f"Maximum allowed size is {self.max_size // (1024 * 1024)} MB."
                    ),
                )
        return await call_next(request)
