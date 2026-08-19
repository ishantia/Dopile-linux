from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from app.db.models import UserRole, TaskStatus, TaskPriority


class AdminUserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=8, max_length=128)
    email: Optional[str] = None
    role: UserRole = UserRole.USER


class AdminUserStatusUpdate(BaseModel):
    is_active: bool


class AdminUserRoleUpdate(BaseModel):
    role: UserRole


class AdminPasswordReset(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)


class AdminUserIpUpdate(BaseModel):
    allowed_ip: Optional[str] = None


class AdminTaskReassign(BaseModel):
    new_owner_id: str


class ServerStatusResponse(BaseModel):
    app_name: str
    version: str
    app_env: str
    uptime_seconds: float
    database_status: str
    total_users: int
    total_tasks: int
    active_websocket_connections: int


class AuditLogResponse(BaseModel):
    id: str
    actor_user_id: Optional[str] = None
    action: str
    target_type: str
    target_id: Optional[str] = None
    timestamp: datetime
    source_ip: Optional[str] = None
    metadata_json: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(BaseModel):
    items: List[AuditLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class BackupInfo(BaseModel):
    filename: str
    size_bytes: int
    created_at: datetime


class BackupListResponse(BaseModel):
    backups: List[BackupInfo]
