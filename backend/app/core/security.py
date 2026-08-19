import hmac
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError

from app.core.config import settings

# Initialize Argon2id password hasher
ph = PasswordHasher()


def hash_password(password: str) -> str:
    """Hash password using Argon2id."""
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against Argon2id hash."""
    try:
        return ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def validate_password_strength(password: str) -> bool:
    """
    Validates password strength:
    - Minimum length 8 characters
    - Must contain at least 1 number or special character
    """
    if len(password) < 8:
        return False
    if len(password) > 128:
        return False
    has_digit_or_symbol = any(not char.isalpha() for char in password)
    return has_digit_or_symbol


ALGORITHM = "HS256"


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "access"
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: Dict[str, Any]) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "refresh",
        "jti": secrets.token_hex(16)
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None


def generate_csrf_token(session_id: str) -> str:
    """Generate a CSRF token tied to a session/user identifier using HMAC-SHA256."""
    message = session_id.encode('utf-8')
    secret = settings.CSRF_SECRET.encode('utf-8')
    signature = hmac.new(secret, message, hashlib.sha256).hexdigest()
    return f"{session_id}.{signature}"


def verify_csrf_token(csrf_token: str, expected_session_id: str) -> bool:
    """Verify a CSRF token matches the session/user identifier."""
    if not csrf_token or "." not in csrf_token:
        return False
    parts = csrf_token.split(".", 1)
    if len(parts) != 2:
        return False
    session_id, signature = parts
    if not hmac.compare_digest(session_id, expected_session_id):
        return False
    
    message = session_id.encode('utf-8')
    secret = settings.CSRF_SECRET.encode('utf-8')
    expected_signature = hmac.new(secret, message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected_signature)
