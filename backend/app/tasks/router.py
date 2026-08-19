import math
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc

from app.db.database import get_db
from app.db.models import Task, User, TaskStatus, TaskPriority, UserRole
from app.auth.dependencies import get_current_user, verify_csrf
from app.tasks.schemas import TaskCreate, TaskUpdate, TaskStatusUpdate, TaskResponse, TaskListResponse
from app.audit.service import log_audit_event
from app.websocket.manager import ws_manager

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

SORTABLE_COLUMNS = {
    "title": Task.title,
    "created_at": Task.created_at,
    "updated_at": Task.updated_at,
    "due_date": Task.due_date,
    "priority": Task.priority,
    "status": Task.status,
}


def serialize_task(task: Task) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        owner_id=task.owner_id,
        owner_username=task.owner.username if task.owner else None,
        title=task.title,
        description=task.description,
        status=TaskStatus(task.status),
        priority=TaskPriority(task.priority),
        due_date=task.due_date,
        created_at=task.created_at,
        updated_at=task.updated_at,
        completed_at=task.completed_at
    )


@router.get("", response_model=TaskListResponse)
def list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
    search: Optional[str] = Query(None, max_length=100),
    sort_by: str = Query("created_at"),
    sort_dir: str = Query("desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Task)

    # Scoping: Normal users only see their own tasks
    if current_user.role != UserRole.ADMIN.value:
        query = query.filter(Task.owner_id == current_user.id)

    # Filters
    if status:
        query = query.filter(Task.status == status.value)
    if priority:
        query = query.filter(Task.priority == priority.value)
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Task.title.ilike(search_pattern),
                Task.description.ilike(search_pattern)
            )
        )

    # Sorting validation
    sort_col = SORTABLE_COLUMNS.get(sort_by.lower(), Task.created_at)
    if sort_dir.lower() == "asc":
        query = query.order_by(asc(sort_col))
    else:
        query = query.order_by(desc(sort_col))

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    tasks = query.offset((page - 1) * page_size).limit(page_size).all()
    items = [serialize_task(t) for t in tasks]

    return TaskListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_csrf)])
async def create_task(
    payload: TaskCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client_ip = request.client.host if request.client else "127.0.0.1"

    now = datetime.now(timezone.utc)
    completed_at = now if payload.status == TaskStatus.COMPLETED else None

    task = Task(
        owner_id=current_user.id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        status=payload.status.value,
        priority=payload.priority.value,
        due_date=payload.due_date,
        completed_at=completed_at
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    serialized = serialize_task(task)

    log_audit_event(
        db,
        action="TASK_CREATED",
        target_type="TASK",
        actor_user_id=current_user.id,
        target_id=task.id,
        source_ip=client_ip
    )

    # Realtime notification
    await ws_manager.broadcast_task_event("TASK_CREATED", serialized.model_dump(mode="json"), owner_id=task.owner_id)

    return serialized


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Strict authorization / IDOR check
    if current_user.role != UserRole.ADMIN.value and task.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this task")

    return serialize_task(task)


@router.put("/{task_id}", response_model=TaskResponse, dependencies=[Depends(verify_csrf)])
async def update_task(
    task_id: str,
    payload: TaskUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client_ip = request.client.host if request.client else "127.0.0.1"

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if current_user.role != UserRole.ADMIN.value and task.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to modify this task")

    if payload.title is not None:
        task.title = payload.title.strip()
    if payload.description is not None:
        task.description = payload.description.strip() if payload.description else None
    if payload.priority is not None:
        task.priority = payload.priority.value
    if payload.due_date is not None:
        task.due_date = payload.due_date
    if payload.status is not None:
        task.status = payload.status.value
        if payload.status == TaskStatus.COMPLETED and not task.completed_at:
            task.completed_at = datetime.now(timezone.utc)
        elif payload.status != TaskStatus.COMPLETED:
            task.completed_at = None

    db.commit()
    db.refresh(task)

    serialized = serialize_task(task)

    log_audit_event(
        db,
        action="TASK_UPDATED",
        target_type="TASK",
        actor_user_id=current_user.id,
        target_id=task.id,
        source_ip=client_ip
    )

    await ws_manager.broadcast_task_event("TASK_UPDATED", serialized.model_dump(mode="json"), owner_id=task.owner_id)

    return serialized


@router.patch("/{task_id}/status", response_model=TaskResponse, dependencies=[Depends(verify_csrf)])
async def update_task_status(
    task_id: str,
    payload: TaskStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client_ip = request.client.host if request.client else "127.0.0.1"

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if current_user.role != UserRole.ADMIN.value and task.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to modify this task")

    task.status = payload.status.value
    if payload.status == TaskStatus.COMPLETED:
        task.completed_at = datetime.now(timezone.utc)
    else:
        task.completed_at = None

    db.commit()
    db.refresh(task)

    serialized = serialize_task(task)

    log_audit_event(
        db,
        action="TASK_STATUS_CHANGED",
        target_type="TASK",
        actor_user_id=current_user.id,
        target_id=task.id,
        source_ip=client_ip,
        metadata={"new_status": payload.status.value}
    )

    await ws_manager.broadcast_task_event("TASK_STATUS_CHANGED", serialized.model_dump(mode="json"), owner_id=task.owner_id)

    return serialized


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_csrf)])
async def delete_task(
    task_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client_ip = request.client.host if request.client else "127.0.0.1"

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if current_user.role != UserRole.ADMIN.value and task.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this task")

    owner_id = task.owner_id
    task_data = {"id": task.id, "title": task.title}

    db.delete(task)
    db.commit()

    log_audit_event(
        db,
        action="TASK_DELETED",
        target_type="TASK",
        actor_user_id=current_user.id,
        target_id=task_id,
        source_ip=client_ip
    )

    await ws_manager.broadcast_task_event("TASK_DELETED", task_data, owner_id=owner_id)

    return None
