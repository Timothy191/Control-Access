"""
Test suite for admin routes - user management, audit logs, and gate mappings.
Security-critical: These tests ensure admin-only routes are properly protected.
"""

from app import db_session
from models import AuditLog, GateMapping, User


class TestAdminUsers:
    """Tests for user management routes."""

    def test_users_list_requires_admin(self, test_app, db_cleanup):
        """Non-admin users should be denied access."""
        # Create non-admin user
        user = User(username="user1", role="user")
        user.set_password("pass123")
        db_session.add(user)
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "user1"
            sess["user_id"] = user.id
            sess["role"] = "user"

        response = test_app.get("/admin/users")
        assert response.status_code == 403  # Access denied

    def test_users_list_admin_access(self, authenticated_client):
        """Admin can view user list."""
        # authenticated_client fixture has admin role
        response = authenticated_client.get("/admin/users")
        assert response.status_code == 200
        assert b"admin" in response.data.lower()

    def test_add_user(self, authenticated_client, db_cleanup):
        """Admin can add new users."""
        response = authenticated_client.post(
            "/admin/users/add",
            data={
                "username": "newuser",
                "password": "newpass123",
                "role": "manager"
            },
            follow_redirects=True
        )
        assert response.status_code == 200

        # Verify user was created
        user = db_session.query(User).filter_by(username="newuser").first()
        assert user is not None
        assert user.role == "manager"

    def test_add_user_duplicate_username(self, authenticated_client, db_cleanup):
        """Cannot add user with duplicate username."""
        # Add first user
        user = User(username="duplicate", role="user")
        user.set_password("pass123")
        db_session.add(user)
        db_session.commit()

        # Try to add duplicate
        response = authenticated_client.post(
            "/admin/users/add",
            data={
                "username": "duplicate",
                "password": "pass456",
                "role": "admin"
            },
            follow_redirects=True
        )
        assert response.status_code == 200

        # Verify only one user exists
        users = db_session.query(User).filter_by(username="duplicate").all()
        assert len(users) == 1

    def test_add_user_missing_fields(self, authenticated_client):
        """User creation fails without required fields."""
        response = authenticated_client.post(
            "/admin/users/add",
            data={
                "username": "",
                "password": "",
                "role": "user"
            },
            follow_redirects=True
        )
        assert response.status_code == 200

    def test_edit_user(self, authenticated_client, db_cleanup):
        """Admin can edit user role."""
        user = User(username="editme", role="user")
        user.set_password("pass123")
        db_session.add(user)
        db_session.commit()
        user_id = user.id

        response = authenticated_client.post(
            f"/admin/users/edit/{user_id}",
            data={
                "role": "manager",
                "password": ""  # No password change
            },
            follow_redirects=True
        )
        assert response.status_code == 200

        # Verify role changed
        updated = db_session.query(User).filter_by(id=user_id).first()
        assert updated.role == "manager"

    def test_edit_user_password(self, authenticated_client, db_cleanup):
        """Admin can change user password."""
        user = User(username="changepass", role="user")
        user.set_password("oldpass")
        db_session.add(user)
        db_session.commit()
        user_id = user.id

        old_hash = user.password

        response = authenticated_client.post(
            f"/admin/users/edit/{user_id}",
            data={
                "role": "user",
                "password": "newpassword123"
            },
            follow_redirects=True
        )
        assert response.status_code == 200

        # Verify password changed
        updated = db_session.query(User).filter_by(id=user_id).first()
        assert updated.password != old_hash

    def test_edit_nonexistent_user(self, authenticated_client):
        """Editing non-existent user redirects gracefully."""
        response = authenticated_client.post(
            "/admin/users/edit/99999",
            data={"role": "admin"},
            follow_redirects=True
        )
        assert response.status_code == 200

    def test_delete_user(self, authenticated_client, db_cleanup):
        """Admin can delete users."""
        user = User(username="deleteme", role="user")
        user.set_password("pass123")
        db_session.add(user)
        db_session.commit()
        user_id = user.id

        response = authenticated_client.post(
            f"/admin/users/delete/{user_id}",
            follow_redirects=True
        )
        assert response.status_code == 200

        # Verify user was deleted
        deleted = db_session.query(User).filter_by(id=user_id).first()
        assert deleted is None

    def test_delete_admin_account_blocked(self, authenticated_client, db_cleanup):
        """Cannot delete the admin account."""
        # The authenticated_client already creates an admin user
        # Get the admin user from the database
        admin_user = db_session.query(User).filter_by(username="admin").first()
        assert admin_user is not None
        admin_id = admin_user.id

        response = authenticated_client.post(
            f"/admin/users/delete/{admin_id}",
            follow_redirects=True
        )
        assert response.status_code == 200

        # Verify admin still exists
        admin = db_session.query(User).filter_by(id=admin_id).first()
        assert admin is not None


class TestAuditLogs:
    """Tests for audit logging functionality."""

    def test_audit_logs_requires_admin(self, test_app, db_cleanup):
        """Non-admin cannot view audit logs."""
        user = User(username="audittest", role="user")
        user.set_password("pass123")
        db_session.add(user)
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "audittest"
            sess["user_id"] = user.id
            sess["role"] = "user"

        response = test_app.get("/admin/audit_logs")
        assert response.status_code == 403

    def test_audit_logs_list(self, authenticated_client, db_cleanup):
        """Admin can view audit logs."""
        # Create some audit logs
        log1 = AuditLog(
            action="create",
            entity_type="employee",
            entity_id=1,
            details="Test action"
        )
        db_session.add(log1)
        db_session.commit()

        response = authenticated_client.get("/admin/audit_logs")
        assert response.status_code == 200
        assert b"create" in response.data.lower() or b"employee" in response.data.lower()

    def test_audit_log_creation_on_employee_add(self, authenticated_client):
        """Adding employee creates audit log."""
        initial_count = db_session.query(AuditLog).count()

        # Add an employee
        authenticated_client.post(
            "/add_employee",
            data={
                "emp_code": "AUDIT001",
                "first_name": "Audit",
                "surname": "Test",
                "id_number": "1234567890",
                "job_title": "Tester"
            },
            follow_redirects=True
        )

        # Verify audit log was created
        final_count = db_session.query(AuditLog).count()
        assert final_count > initial_count

        # Check the log entry
        logs = db_session.query(AuditLog).order_by(AuditLog.id.desc()).limit(1).all()
        if logs:
            assert "Audit" in logs[0].details or "AUDIT001" in logs[0].details


class TestGateMappings:
    """Tests for gate mapping management."""

    def test_gate_mappings_requires_admin(self, test_app, db_cleanup):
        """Non-admin cannot view gate mappings."""
        user = User(username="gatetest", role="user")
        user.set_password("pass123")
        db_session.add(user)
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "gatetest"
            sess["user_id"] = user.id
            sess["role"] = "user"

        response = test_app.get("/admin/gate_mappings")
        assert response.status_code == 403

    def test_gate_mappings_list(self, authenticated_client):
        """Admin can view gate mappings."""
        response = authenticated_client.get("/admin/gate_mappings")
        assert response.status_code == 200

    def test_add_gate_mapping(self, authenticated_client, db_cleanup):
        """Admin can add gate mapping."""
        response = authenticated_client.post(
            "/admin/gate_mappings/add",
            data={
                "ip_address": "192.168.1.100",
                "gate_name": "Main Gate",
                "location_description": "Primary entrance"
            },
            follow_redirects=True
        )
        assert response.status_code == 200

        # Verify mapping was created
        mapping = db_session.query(GateMapping).filter_by(
            ip_address="192.168.1.100"
        ).first()
        assert mapping is not None
        assert mapping.gate_name == "Main Gate"

    def test_add_gate_mapping_duplicate_ip(self, authenticated_client, db_cleanup):
        """Adding duplicate IP updates existing mapping."""
        # Create initial mapping
        mapping = GateMapping(
            ip_address="192.168.1.50",
            gate_name="Old Gate",
            is_active=True
        )
        db_session.add(mapping)
        db_session.commit()

        # Add with same IP
        response = authenticated_client.post(
            "/admin/gate_mappings/add",
            data={
                "ip_address": "192.168.1.50",
                "gate_name": "New Gate",
                "description": "Updated"
            },
            follow_redirects=True
        )
        assert response.status_code == 200

        # Verify mapping was updated
        updated = db_session.query(GateMapping).filter_by(
            ip_address="192.168.1.50"
        ).first()
        assert updated.gate_name == "New Gate"

    def test_add_gate_mapping_missing_fields(self, authenticated_client):
        """Gate mapping requires IP and name."""
        response = authenticated_client.post(
            "/admin/gate_mappings/add",
            data={
                "ip_address": "",
                "gate_name": ""
            },
            follow_redirects=True
        )
        assert response.status_code == 200

    def test_delete_gate_mapping(self, authenticated_client, db_cleanup):
        """Admin can delete gate mapping."""
        mapping = GateMapping(
            ip_address="192.168.1.99",
            gate_name="Delete Gate"
        )
        db_session.add(mapping)
        db_session.commit()
        mapping_id = mapping.id

        response = authenticated_client.get(
            f"/admin/gate_mappings/delete/{mapping_id}",
            follow_redirects=True
        )
        assert response.status_code == 200

        # Verify mapping was deleted
        deleted = db_session.query(GateMapping).filter_by(id=mapping_id).first()
        assert deleted is None

    def test_toggle_gate_mapping(self, authenticated_client, db_cleanup):
        """Admin can toggle gate mapping status."""
        mapping = GateMapping(
            ip_address="192.168.1.88",
            gate_name="Toggle Gate",
            is_active=True
        )
        db_session.add(mapping)
        db_session.commit()
        mapping_id = mapping.id

        # Toggle off
        response = authenticated_client.get(
            f"/admin/gate_mappings/toggle/{mapping_id}",
            follow_redirects=True
        )
        assert response.status_code == 200

        # Verify status changed
        updated = db_session.query(GateMapping).filter_by(id=mapping_id).first()
        assert not updated.is_active

        # Toggle back on
        authenticated_client.get(
            f"/admin/gate_mappings/toggle/{mapping_id}",
            follow_redirects=True
        )
        updated = db_session.query(GateMapping).filter_by(id=mapping_id).first()
        assert updated.is_active


class TestVisitorPIN:
    """Tests for visitor PIN management."""

    def test_update_visitor_pin_requires_admin(self, test_app, db_cleanup):
        """Non-admin cannot update visitor PIN."""
        user = User(username="pintest", role="user")
        user.set_password("pass123")
        db_session.add(user)
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "pintest"
            sess["user_id"] = user.id
            sess["role"] = "user"

        response = test_app.post("/admin/visitor_pin", data={"new_pin": "1234"})
        assert response.status_code == 403

    def test_update_visitor_pin(self, authenticated_client, db_cleanup):
        """Admin can update visitor PIN."""
        response = authenticated_client.post(
            "/admin/visitor_pin",
            data={"new_pin": "5678"},
            follow_redirects=True
        )
        assert response.status_code == 200

    def test_update_visitor_pin_empty(self, authenticated_client):
        """Empty PIN redirects without error."""
        response = authenticated_client.post(
            "/admin/visitor_pin",
            data={"new_pin": ""},
            follow_redirects=True
        )
        assert response.status_code == 200
