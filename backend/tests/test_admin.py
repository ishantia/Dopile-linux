import pytest
from tests.conftest import auth_headers_for


def test_admin_user_management(client, admin_user, user_a):
    headers = auth_headers_for(admin_user)

    # 1. Admin lists users
    users_res = client.get("/api/admin/users", headers=headers)
    assert users_res.status_code == 200
    assert len(users_res.json()["items"]) >= 2

    # 2. Admin creates a user
    create_res = client.post("/api/admin/users", json={
        "username": "newuser",
        "password": "Password123!",
        "role": "USER"
    }, headers=headers)
    assert create_res.status_code == 201
    created_user = create_res.json()
    assert created_user["username"] == "newuser"

    # 3. Admin deactivates user_a
    deactivate_res = client.patch(f"/api/admin/users/{user_a.id}/status", json={
        "is_active": False
    }, headers=headers)
    assert deactivate_res.status_code == 200
    assert deactivate_res.json()["is_active"] is False

    # 4. Deactivated user_a fails login
    login_res = client.post("/api/auth/login", json={
        "username": "usera",
        "password": "Password123!"
    })
    assert login_res.status_code == 401


def test_admin_create_duplicate_user(client, admin_user, user_a):
    headers = auth_headers_for(admin_user)

    # Attempt to create duplicate username (case-insensitive)
    dup_res = client.post("/api/admin/users", json={
        "username": user_a.username.upper(),
        "password": "Password123!",
        "role": "USER"
    }, headers=headers)
    assert dup_res.status_code == 409
    assert "already exists" in dup_res.json()["error"]["message"]


def test_admin_delete_user(client, admin_user, user_a):
    headers = auth_headers_for(admin_user)
    del_res = client.delete(f"/api/admin/users/{user_a.id}", headers=headers)
    assert del_res.status_code == 200
    assert "deleted successfully" in del_res.json()["message"]


def test_admin_server_telemetry(client, admin_user):
    headers = auth_headers_for(admin_user)
    server_res = client.get("/api/admin/server", headers=headers)
    assert server_res.status_code == 200
    data = server_res.json()
    assert data["app_name"] == "Dopile"
    assert data["database_status"] == "healthy"
