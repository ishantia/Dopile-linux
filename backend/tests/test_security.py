import pytest
from tests.conftest import auth_headers_for


def test_security_headers(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["X-Frame-Options"] == "DENY"
    assert "Referrer-Policy" in res.headers


def test_csrf_token_validation(client, user_a):
    # Missing CSRF header on state-changing request
    token = auth_headers_for(user_a)["Authorization"]
    headers = {"Authorization": token} # omit X-CSRF-Token

    res = client.post("/api/tasks", json={
        "title": "CSRF Test Task"
    }, headers=headers)
    assert res.status_code == 403
    assert "CSRF" in res.json()["error"]["message"]


def test_health_and_version(client):
    health_res = client.get("/api/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "ok"

    version_res = client.get("/api/version")
    assert version_res.status_code == 200
    assert version_res.json()["app_name"] == "Dopile"
