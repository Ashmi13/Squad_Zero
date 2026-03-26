import time
from fastapi import HTTPException, status, Request

RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX = 10
rate_limit_store = {}

def check_rate_limit(request: Request, key: str):
    now = time.time()
    ip = request.client.host if request.client else "unknown"
    bucket_key = f"{key}:{ip}"

    timestamps = rate_limit_store.get(bucket_key, [])
    timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]
    if len(timestamps) >= RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later."
        )

    timestamps.append(now)
    rate_limit_store[bucket_key] = timestamps
