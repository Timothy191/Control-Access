"""
Unit and integration tests for authentication, password security, and access control.
"""

import pytest
from models import User


def test_user_password_hashing(session):
    """Test User password setting and checking with PBKDF2/scrypt hashing."""
    user = User(username="testuser", role="operator")
    user.set_password("Secret123!")

    assert user.password != "Secret123!"
    assert user.password.startswith(("pbkdf2:", "scrypt:"))
    assert user.check_password("Secret123!") is True
    assert user.check_password("WrongPassword") is False


def test_login_flow(client, sample_admin):
    """Test web login route with valid and invalid credentials."""
    # Test invalid login
    res_bad = client.post(
        "/login",
        data={"username": "admin", "password": "WrongPassword"},
        follow_redirects=True,
    )
    assert res_bad.status_code == 200
    assert b"Invalid credentials" in res_bad.data or b"error" in res_bad.data.lower()

    # Test valid login
    res_good = client.post(
        "/login",
        data={"username": "admin", "password": "AdminPass123!"},
        follow_redirects=True,
    )
    assert res_good.status_code == 200


def test_logout_flow(client, sample_admin):
    """Test user session logout."""
    with client.session_transaction() as sess:
        sess["user_id"] = sample_admin.id
        sess["username"] = sample_admin.username
        sess["role"] = sample_admin.role

    res = client.get("/logout", follow_redirects=True)
    assert res.status_code == 200
    with client.session_transaction() as sess:
        assert "user_id" not in sess
