import pytest
from app import app, db_session
from models import User


class TestAuthentication:
    def test_login_get(self, test_app):
        response = test_app.get("/login")
        assert response.status_code == 200
        assert b"login" in response.data.lower()

    def test_login_success(self, test_app, db_cleanup):
        user = User(username="testuser", password="testpass", role="admin")
        db_session.add(user)
        db_session.commit()

        response = test_app.post(
            "/login",
            data={"username": "testuser", "password": "testpass"},
            follow_redirects=False,
        )

        assert response.status_code == 302
        assert "/dashboard" in response.location

    def test_login_invalid_credentials(self, test_app, db_cleanup):
        response = test_app.post(
            "/login", data={"username": "wrong", "password": "wrong"}
        )

        assert response.status_code == 200
        assert b"invalid" in response.data.lower()

    def test_logout(self, test_app, db_cleanup):
        user = User(username="testuser", password="testpass", role="admin")
        db_session.add(user)
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "testuser"

        response = test_app.get("/logout", follow_redirects=False)
        assert response.status_code == 302
        assert response.location == "/login"

    def test_protected_route_requires_login(self, test_app):
        response = test_app.get("/dashboard")
        assert response.status_code == 302
        assert "/login" in response.location
