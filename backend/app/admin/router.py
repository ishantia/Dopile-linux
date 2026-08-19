import math
import time
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from sqlalchemy.exc import IntegrityError

from app.db.database import get_db
from app.db.models import User, Task, AuditLog, UserRole
from app.auth.dependencies import require_role, verify_csrf
from app.auth.schemas import UserResponse
from app.tasks.schemas import TaskResponse, TaskListResponse
from app.tasks.router import serialize_task
from app.core.security import hash_password, validate_password_strength
from app.core.config import settings
from app.audit.service import log_audit_event
from app.websocket.manager import ws_manager
from app.admin.schemas import (
    AdminUserCreate, AdminUserStatusUpdate, AdminUserRoleUpdate,
    AdminPasswordReset, AdminUserIpUpdate, AdminTaskReassign, ServerStatusResponse,
    AuditLogResponse, AuditLogListResponse, BackupListResponse
)
from app.admin.service import create_sqlite_backup, list_backups, restore_sqlite_backup

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_role(UserRole.ADMIN.value))])

START_TIME = time.time()


@router.get("/users")
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db)
):
    query = db.query(User)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(or_(User.username.ilike(pattern), User.email.ilike(pattern)))

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    users = query.order_by(desc(User.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [UserResponse.model_validate(u) for u in users],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_csrf)])
def create_user(
    payload: AdminUserCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.ADMIN.value))
):
    client_ip = request.client.host if request.client else "127.0.0.1"

    existing = db.query(User).filter(User.username.ilike(payload.username.strip())).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Username '{payload.username}' already exists")

    if not validate_password_strength(payload.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters and contain a digit or symbol."
        )

    user = User(
        username=payload.username.strip(),
        email=payload.email.strip() if payload.email else None,
        password_hash=hash_password(payload.password),
        role=payload.role.value,
        is_active=True
    )
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{payload.username}' already exists"
        )

    log_audit_event(
        db,
        action="USER_CREATED",
        target_type="USER",
        actor_user_id=admin_user.id,
        target_id=user.id,
        source_ip=client_ip,
        metadata={"created_username": user.username, "role": user.role}
    )

    return UserResponse.model_validate(user)


@router.patch("/users/{user_id}/status", response_model=UserResponse, dependencies=[Depends(verify_csrf)])
def update_user_status(
    user_id: str,
    payload: AdminUserStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.ADMIN.value))
):
    client_ip = request.client.host if request.client else "127.0.0.1"

    if user_id == admin_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change your own active status")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)

    action = "USER_ENABLED" if payload.is_active else "USER_DISABLED"
    log_audit_event(
        db,
        action=action,
        target_type="USER",
        actor_user_id=admin_user.id,
        target_id=user.id,
        source_ip=client_ip
    )

    return UserResponse.model_validate(user)


@router.patch("/users/{user_id}/role", response_model=UserResponse, dependencies=[Depends(verify_csrf)])
def update_user_role(
    user_id: str,
    payload: AdminUserRoleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.ADMIN.value))
):
    client_ip = request.client.host if request.client else "127.0.0.1"

    if user_id == admin_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change your own role")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.role = payload.role.value
    db.commit()
    db.refresh(user)

    log_audit_event(
        db,
        action="ROLE_CHANGED",
        target_type="USER",
        actor_user_id=admin_user.id,
        target_id=user.id,
        source_ip=client_ip,
        metadata={"new_role": payload.role.value}
    )

    return UserResponse.model_validate(user)


@router.post("/users/{user_id}/reset-password", dependencies=[Depends(verify_csrf)])
def reset_user_password(
    user_id: str,
    payload: AdminPasswordReset,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.ADMIN.value))
):
    client_ip = request.client.host if request.client else "127.0.0.1"

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not validate_password_strength(payload.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters and contain a digit or symbol."
        )

    user.password_hash = hash_password(payload.new_password)
    db.commit()

    log_audit_event(
        db,
        action="PASSWORD_RESET_ADMIN",
        target_type="USER",
        actor_user_id=admin_user.id,
        target_id=user.id,
        source_ip=client_ip
    )

    return {"message": f"Password for user '{user.username}' reset successfully"}


@router.delete("/users/{user_id}", dependencies=[Depends(verify_csrf)])
def delete_user_by_admin(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.ADMIN.value))
):
    client_ip = request.client.host if request.client else "127.0.0.1"

    if user_id == admin_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account through admin interface.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    deleted_username = user.username
    db.delete(user)
    db.commit()

    log_audit_event(
        db,
        action="USER_DELETED_ADMIN",
        target_type="USER",
        actor_user_id=admin_user.id,
        target_id=user_id,
        source_ip=client_ip,
        metadata={"deleted_username": deleted_username}
    )

    return {"message": f"User '{deleted_username}' deleted successfully"}


@router.patch("/users/{user_id}/ip", response_model=UserResponse, dependencies=[Depends(verify_csrf)])
def update_user_allowed_ip(
    user_id: str,
    payload: AdminUserIpUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.ADMIN.value))
):
    client_ip = request.client.host if request.client else "127.0.0.1"

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    new_ip = payload.allowed_ip.strip() if payload.allowed_ip and payload.allowed_ip.strip() else None
    user.allowed_ip = new_ip
    db.commit()
    db.refresh(user)

    log_audit_event(
        db,
        action="USER_IP_BOUND_ADMIN",
        target_type="USER",
        actor_user_id=admin_user.id,
        target_id=user.id,
        source_ip=client_ip,
        metadata={"assigned_ip": new_ip}
    )

    return UserResponse.model_validate(user)


@router.get("/tasks", response_model=TaskListResponse)
def list_all_admin_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None, max_length=100),
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Task)
    if user_id:
        query = query.filter(Task.owner_id == user_id)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(or_(Task.title.ilike(pattern), Task.description.ilike(pattern)))

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    tasks = query.order_by(desc(Task.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    return TaskListResponse(
        items=[serialize_task(t) for t in tasks],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.patch("/tasks/{task_id}/reassign", response_model=TaskResponse, dependencies=[Depends(verify_csrf)])
async def reassign_task(
    task_id: str,
    payload: AdminTaskReassign,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.ADMIN.value))
):
    client_ip = request.client.host if request.client else "127.0.0.1"

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    new_owner = db.query(User).filter(User.id == payload.new_owner_id).first()
    if not new_owner or not new_owner.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target user not found or inactive")

    old_owner_id = task.owner_id
    task.owner_id = new_owner.id
    db.commit()
    db.refresh(task)

    serialized = serialize_task(task)

    log_audit_event(
        db,
        action="TASK_REASSIGNED",
        target_type="TASK",
        actor_user_id=admin_user.id,
        target_id=task.id,
        source_ip=client_ip,
        metadata={"old_owner": old_owner_id, "new_owner": new_owner.id}
    )

    await ws_manager.broadcast_task_event("TASK_UPDATED", serialized.model_dump(mode="json"), owner_id=old_owner_id)
    await ws_manager.broadcast_task_event("TASK_UPDATED", serialized.model_dump(mode="json"), owner_id=new_owner.id)

    return serialized


@router.get("/audit-logs", response_model=AuditLogListResponse)
def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    action: Optional[str] = Query(None),
    actor_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    if actor_id:
        query = query.filter(AuditLog.actor_user_id == actor_id)

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    logs = query.order_by(desc(AuditLog.timestamp)).offset((page - 1) * page_size).limit(page_size).all()

    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(l) for l in logs],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/server", response_model=ServerStatusResponse)
def get_server_telemetry(db: Session = Depends(get_db)):
    uptime = time.time() - START_TIME
    user_count = db.query(User).count()
    task_count = db.query(Task).count()
    ws_connections = ws_manager.count_connected_clients()

    return ServerStatusResponse(
        app_name=settings.APP_NAME,
        version="1.0.0",
        app_env=settings.APP_ENV,
        uptime_seconds=round(uptime, 2),
        database_status="healthy",
        total_users=user_count,
        total_tasks=task_count,
        active_websocket_connections=ws_connections
    )


@router.get("/backups", response_model=BackupListResponse)
def get_backups():
    backups = list_backups()
    return BackupListResponse(backups=backups)


@router.post("/backups", dependencies=[Depends(verify_csrf)])
def create_backup(
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.ADMIN.value))
):
    client_ip = request.client.host if request.client else "127.0.0.1"

    backup_info = create_sqlite_backup()

    log_audit_event(
        db,
        action="BACKUP_CREATED",
        target_type="SYSTEM",
        actor_user_id=admin_user.id,
        source_ip=client_ip,
        metadata={"filename": backup_info["filename"]}
    )

    return backup_info


@router.post("/backups/restore", dependencies=[Depends(verify_csrf)])
def restore_backup(
    filename: str = Query(...),
    request: Request = None,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role(UserRole.ADMIN.value))
):
    client_ip = request.client.host if request.client else "127.0.0.1"

    try:
        restore_sqlite_backup(filename)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    log_audit_event(
        db,
        action="BACKUP_RESTORED",
        target_type="SYSTEM",
        actor_user_id=admin_user.id,
        source_ip=client_ip,
        metadata={"filename": filename}
    )

    return {"message": f"Database successfully restored from '{filename}'"}
