import pytest
from app.db.models import Task, TaskStatus, TaskPriority
from tests.conftest import auth_headers_for


def test_idor_prevention(client, db_session, user_a, user_b):
    # User A creates a task
    task_a = Task(
        owner_id=user_a.id,
        title="User A Private Task",
        status=TaskStatus.TODO.value,
        priority=TaskPriority.MEDIUM.value
    )
    db_session.add(task_a)
    db_session.commit()
    db_session.refresh(task_a)

    headers_b = auth_headers_for(user_b)

    # User B attempts to access User A's task
    get_res = client.get(f"/api/tasks/{task_a.id}", headers=headers_b)
    assert get_res.status_code == 403

    # User B attempts to update User A's task
    put_res = client.put(f"/api/tasks/{task_a.id}", json={"title": "Hacked Title"}, headers=headers_b)
    assert put_res.status_code == 403

    # User B attempts to delete User A's task
    del_res = client.delete(f"/api/tasks/{task_a.id}", headers=headers_b)
    assert del_res.status_code == 403


def test_vertical_privilege_escalation_prevention(client, user_a):
    headers_a = auth_headers_for(user_a)

    # Normal user attempts to access admin endpoints
    users_res = client.get("/api/admin/users", headers=headers_a)
    assert users_res.status_code == 403

    backup_res = client.post("/api/admin/backups", headers=headers_a)
    assert backup_res.status_code == 403
