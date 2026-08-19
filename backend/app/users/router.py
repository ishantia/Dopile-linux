from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User
from app.auth.dependencies import get_current_user, verify_csrf
from app.auth.schemas import UserResponse, PasswordChangeRequest
from app.core.security import verify_password, hash_password, validate_password_strength
from app.audit.service import log_audit_event

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
def get_user_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me/password", dependencies=[Depends(verify_csrf)])
def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client_ip = request.client.host if request.client else "127.0.0.1"

    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password verification failed"
        )

    if not validate_password_strength(payload.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long and contain at least one digit or symbol."
        )

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()

    log_audit_event(
        db,
        action="PASSWORD_CHANGED_SELF",
        target_type="USER",
        actor_user_id=current_user.id,
        target_id=current_user.id,
        source_ip=client_ip
    )

    return {"message": "Password updated successfully"}


from pydantic import BaseModel, Field


class AccountDeleteSelfRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)


@router.delete("/me", dependencies=[Depends(verify_csrf)])
def delete_self_account(
    payload: AccountDeleteSelfRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client_ip = request.client.host if request.client else "127.0.0.1"

    if not verify_password(payload.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password verification failed"
        )

    user_id = current_user.id
    db.delete(current_user)
    db.commit()

    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")

    log_audit_event(
        db,
        action="USER_DELETED_SELF",
        target_type="USER",
        actor_user_id=user_id,
        target_id=user_id,
        source_ip=client_ip
    )

    return {"message": "Account deleted successfully"}
