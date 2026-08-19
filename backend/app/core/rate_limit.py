import time
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import HTTPException, Request, status


class RateLimiter:
    """In-memory rate limiter using sliding window timestamps."""
    def __init__(self):
        # Key -> list of float timestamps
        self._requests: Dict[str, List[float]] = defaultdict(list)
        # Lockout tracking for authentication: Key -> lockout_until_timestamp
        self._lockouts: Dict[str, float] = defaultdict(float)

    def _clean_old_requests(self, key: str, window_seconds: int, now: float):
        cutoff = now - window_seconds
        self._requests[key] = [ts for ts in self._requests[key] if ts > cutoff]

    def is_rate_limited(self, key: str, max_requests: int, window_seconds: int) -> Tuple[bool, int]:
        now = time.time()
        
        # Check lockout
        if self._lockouts[key] > now:
            retry_after = int(self._lockouts[key] - now) + 1
            return True, retry_after

        self._clean_old_requests(key, window_seconds, now)

        if len(self._requests[key]) >= max_requests:
            retry_after = window_seconds
            if self._requests[key]:
                oldest = self._requests[key][0]
                retry_after = max(1, int(oldest + window_seconds - now))
            return True, retry_after

        self._requests[key].append(now)
        return False, 0

    def record_failed_login(self, key: str, max_failures: int = 5, window_seconds: int = 300, lockout_seconds: int = 300):
        now = time.time()
        self._clean_old_requests(key, window_seconds, now)
        self._requests[key].append(now)
        if len(self._requests[key]) >= max_failures:
            self._lockouts[key] = now + lockout_seconds

    def reset_failures(self, key: str):
        if key in self._requests:
            del self._requests[key]
        if key in self._lockouts:
            del self._lockouts[key]


limiter = RateLimiter()


def check_rate_limit(request: Request, key_prefix: str, max_requests: int, window_seconds: int):
    client_ip = request.client.host if request.client else "127.0.0.1"
    key = f"{key_prefix}:{client_ip}"
    is_limited, retry_after = limiter.is_rate_limited(key, max_requests, window_seconds)
    if is_limited:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many requests. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)}
        )
