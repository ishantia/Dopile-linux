import pytest
from tests.conftest import auth_headers_for


def test_task_crud_flow(client, user_a):
    headers = auth_headers_for(user_a)

    # 1. Create task
    create_res = client.post("/api/tasks", json={
        "title": "Configure Uvicorn",
        "description": "Bind to 0.0.0.0:8080",
        "priority": "HIGH"
    }, headers=headers)
    assert create_res.status_code == 201
    task = create_res.json()
    task_id = task["id"]
    assert task["title"] == "Configure Uvicorn"
    assert task["status"] == "TODO"

    # 2. List tasks
    list_res = client.get("/api/tasks", headers=headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 1

    # 3. Update task status
    status_res = client.patch(f"/api/tasks/{task_id}/status", json={
        "status": "COMPLETED"
    }, headers=headers)
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "COMPLETED"
    assert status_res.json()["completed_at"] is not None

    # 4. Delete task
    del_res = client.delete(f"/api/tasks/{task_id}", headers=headers)
    assert del_res.status_code == 204
