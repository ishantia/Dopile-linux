import socket
import logging
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.orm import Session

from sqlalchemy.exc import IntegrityError
from app.db.database import get_db
from app.db.models import User, UserRole
from app.core.security import verify_password, hash_password, validate_password_strength, create_access_token, create_refresh_token, generate_csrf_token, decode_token
from app.core.rate_limit import check_rate_limit, limiter
from app.core.config import settings
from app.audit.service import log_audit_event
from app.auth.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse, MeResponse
from app.auth.dependencies import get_current_user, get_optional_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("dopile")


def is_host_device(request: Request) -> bool:
    if not request.client:
        return True
    client_ip = request.client.host
    if client_ip in ("127.0.0.1", "::1", "localhost", "testclient", "0.0.0.0"):
        return True

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        if client_ip == local_ip:
            return True
    except Exception:
        pass

    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if client_ip == ip:
                return True
    except Exception:
        pass

    return False


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    client_ip = request.client.host if request.client else "127.0.0.1"
    clean_username = payload.username.strip()
    rate_key = f"login:{client_ip}:{clean_username}"

    logger.info(f"Login attempt: username='{clean_username}' from IP='{client_ip}'")

    # Check host device restriction
    if settings.HOST_ONLY_LOGIN and not is_host_device(request):
        logger.warning(f"Login rejected (remote device restricted): username='{clean_username}', IP='{client_ip}'")
        log_audit_event(db, "LOGIN_REJECTED_REMOTE", "USER", source_ip=client_ip, metadata={"username": clean_username})
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Login is restricted to the host server device."
        )

    # Check brute force rate limit
    is_limited, retry_after = limiter.is_rate_limited(rate_key, max_requests=5, window_seconds=300)
    if is_limited:
        logger.warning(f"Login rate limited: username='{clean_username}', IP='{client_ip}'")
        log_audit_event(db, "LOGIN_BLOCKED", "USER", source_ip=client_ip, metadata={"username": clean_username})
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)}
        )

    # Generic security message (never reveal whether username exists)
    invalid_credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password"
    )

    user = db.query(User).filter(User.username.ilike(clean_username)).first()
    if not user:
        limiter.record_failed_login(rate_key)
        logger.warning(f"Login failed (user not found): username='{clean_username}', IP='{client_ip}'")
        log_audit_event(db, "LOGIN_FAILURE", "USER", source_ip=client_ip, metadata={"username": clean_username})
        raise invalid_credentials_exc

    if not user.is_active:
        limiter.record_failed_login(rate_key)
        logger.warning(f"Login failed (user deactivated): username='{clean_username}', IP='{client_ip}'")
        log_audit_event(db, "LOGIN_FAILURE_DEACTIVATED", "USER", actor_user_id=user.id, source_ip=client_ip)
        raise invalid_credentials_exc

    if not verify_password(payload.password, user.password_hash):
        limiter.record_failed_login(rate_key)
        logger.warning(f"Login failed (invalid password): username='{clean_username}', IP='{client_ip}'")
        log_audit_event(db, "LOGIN_FAILURE", "USER", actor_user_id=user.id, source_ip=client_ip)
        raise invalid_credentials_exc

    # IP Binding enforcement (for non-ADMIN users only; ADMINs can log in from any IP)
    if user.role != UserRole.ADMIN.value:
        if user.allowed_ip and user.allowed_ip != client_ip and client_ip not in ("127.0.0.1", "::1"):
            logger.warning(f"Login rejected (IP mismatch): username='{user.username}', allowed_ip='{user.allowed_ip}', client_ip='{client_ip}'")
            log_audit_event(db, "LOGIN_REJECTED_IP_MISMATCH", "USER", actor_user_id=user.id, source_ip=client_ip, metadata={"allowed_ip": user.allowed_ip})
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is bound to IP '{user.allowed_ip}'. Access from '{client_ip}' is restricted."
            )

        # Auto-assign allowed_ip on first login if unbound
        if not user.allowed_ip:
            user.allowed_ip = client_ip
            logger.info(f"Auto-bound user '{user.username}' to IP '{client_ip}'")

    # Successful login: reset rate limit attempts
    limiter.reset_failures(rate_key)
    logger.info(f"Login successful for user '{user.username}' (role={user.role}) from IP='{client_ip}'")
    
    # Update last login timestamp
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    # Create tokens
    access_token = create_access_token({"sub": user.id, "role": user.role})
    refresh_token = create_refresh_token({"sub": user.id})
    csrf_token = generate_csrf_token(user.id)

    # Set HttpOnly cookies
    is_secure = request.url.scheme == "https"
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=is_secure,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=is_secure,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    )
    response.headers["X-CSRF-Token"] = csrf_token

    log_audit_event(db, "LOGIN_SUCCESS", "USER", actor_user_id=user.id, source_ip=client_ip)

    return TokenResponse(
        access_token=access_token,
        csrf_token=csrf_token,
        token_type="bearer",
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user)
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    client_ip = request.client.host if request.client else "127.0.0.1"
    clean_username = payload.username.strip()
    rate_key = f"register:{client_ip}"

    # Rate limiting for registration
    is_limited, retry_after = limiter.is_rate_limited(rate_key, max_requests=5, window_seconds=300)
    if is_limited:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many registration attempts. Try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)}
        )

    # Validate username availability (case-insensitive)
    existing = db.query(User).filter(User.username.ilike(clean_username)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{clean_username}' already exists"
        )

    # Validate password strength
    if not validate_password_strength(payload.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long and contain at least one digit or symbol."
        )

    clean_email = payload.email.strip() if payload.email and payload.email.strip() else None

    user = User(
        username=clean_username,
        email=clean_email,
        password_hash=hash_password(payload.password),
        role=UserRole.USER.value,
        is_active=True,
        allowed_ip=client_ip
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{clean_username}' already exists"
        )

    # Generate session tokens for immediate login
    access_token = create_access_token({"sub": user.id, "role": user.role})
    refresh_token = create_refresh_token({"sub": user.id})
    csrf_token = generate_csrf_token(user.id)

    is_secure = request.url.scheme == "https"
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=is_secure,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=is_secure,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    )
    response.headers["X-CSRF-Token"] = csrf_token

    log_audit_event(
        db,
        action="USER_REGISTERED",
        target_type="USER",
        actor_user_id=user.id,
        target_id=user.id,
        source_ip=client_ip,
        metadata={"username": user.username}
    )

    logger.info(f"New user registered: '{user.username}' from IP='{client_ip}'")

    return TokenResponse(
        access_token=access_token,
        csrf_token=csrf_token,
        token_type="bearer",
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user)
    )


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client_ip = request.client.host if request.client else "127.0.0.1"
    
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")

    log_audit_event(db, "LOGOUT", "USER", actor_user_id=current_user.id, source_ip=client_ip)
    return {"message": "Logged out successfully"}


@router.post("/refresh", response_model=TokenResponse)
def refresh_token_endpoint(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        # Check header fallback
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            refresh_token = auth_header.split(" ", 1)[1].strip()

    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User unavailable")

    new_access_token = create_access_token({"sub": user.id, "role": user.role})
    csrf_token = generate_csrf_token(user.id)

    is_secure = request.url.scheme == "https"
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        samesite="lax",
        secure=is_secure,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    response.headers["X-CSRF-Token"] = csrf_token

    return TokenResponse(
        access_token=new_access_token,
        csrf_token=csrf_token,
        token_type="bearer",
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=MeResponse)
def get_me(current_user: Optional[User] = Depends(get_optional_current_user)):
    if not current_user:
        return MeResponse(authenticated=False, user=None)
    return MeResponse(authenticated=True, user=UserResponse.model_validate(current_user))
