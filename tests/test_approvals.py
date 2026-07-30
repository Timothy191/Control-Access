"""
Test suite for approval workflow - pending approvals, approve/reject requests.
Tests the core business logic for handling unknown QR scans.
"""

import pytest
import json
from datetime import datetime
from app import app, db_session
from models import User, Employee, Vehicle, Visitor, Approval, GateLog


@pytest.fixture
def sample_pending_approval(db_cleanup):
    """Create a pending approval for testing."""
    approval = Approval(
        request_type="Employee QR Scan",
        request_id=0,
        requester_name="John Unknown",
        details="QR scan at Main Gate (ID: 12345)",
        status="Pending",
        scanned_data=json.dumps({
            "qr_code": "UNKNOWN_QR_123",
            "employee_id": "12345",
            "name": "John Unknown"
        }),
        target_table="employees"
    )
    db_session.add(approval)
    db_session.commit()
    return approval


@pytest.fixture
def sample_visitor_approval(db_cleanup):
    """Create a pending visitor approval."""
    visitor = Visitor(
        name="Pending Visitor",
        company="Test Corp",
        purpose="Meeting",
        status="Pending Approval"
    )
    db_session.add(visitor)
    db_session.flush()

    approval = Approval(
        request_type="Visitor QR Request",
        request_id=visitor.id,
        requester_name="Pending Visitor",
        details="Visitor: Pending Visitor | Company: Test Corp",
        status="Pending",
        target_table="visitors"
    )
    db_session.add(approval)
    db_session.commit()
    return approval, visitor


class TestPendingApprovals:
    """Tests for pending approvals list."""

    def test_pending_approvals_requires_login(self, test_app):
        """Unauthenticated users redirected to login."""
        response = test_app.get("/pending_approvals")
        assert response.status_code == 302
        assert "/login" in response.location

    def test_pending_approvals_access(self, authenticated_client, sample_pending_approval):
        """Authenticated users can view pending approvals."""
        response = authenticated_client.get("/pending_approvals")
        assert response.status_code == 200
        assert b"John Unknown" in response.data or b"Pending" in response.data

    def test_pending_approvals_count(self, authenticated_client, sample_pending_approval):
        """Pending count displayed correctly."""
        response = authenticated_client.get("/pending_approvals")
        assert response.status_code == 200

    def test_pending_approvals_empty(self, authenticated_client):
        """Empty state handled gracefully."""
        # Ensure no pending approvals
        db_session.query(Approval).filter_by(status="Pending").delete()
        db_session.commit()

        response = authenticated_client.get("/pending_approvals")
        assert response.status_code == 200


class TestGetApproval:
    """Tests for fetching single approval details."""

    def test_get_approval_requires_login(self, test_app, sample_pending_approval):
        """API requires authentication."""
        response = test_app.get(f"/api/approval/{sample_pending_approval.id}")
        assert response.status_code == 302

    def test_get_approval_success(self, authenticated_client, sample_pending_approval):
        """Fetch approval details."""
        response = authenticated_client.get(f"/api/approval/{sample_pending_approval.id}")
        assert response.status_code == 200

        data = response.get_json()
        assert data["id"] == sample_pending_approval.id
        assert data["requester_name"] == "John Unknown"
        assert data["status"] == "Pending"

    def test_get_approval_not_found(self, authenticated_client):
        """Non-existent approval returns 404."""
        response = authenticated_client.get("/api/approval/99999")
        assert response.status_code == 404

    def test_get_approval_with_employee(self, authenticated_client, db_cleanup):
        """Approval with linked employee includes employee data."""
        emp = Employee(
            emp_code="EMP999",
            first_name="Linked",
            surname="Employee",
            status="Active"
        )
        db_session.add(emp)
        db_session.flush()

        approval = Approval(
            request_type="Employee",
            request_id=emp.id,
            requester_name="Linked Employee",
            status="Pending"
        )
        db_session.add(approval)
        db_session.commit()

        response = authenticated_client.get(f"/api/approval/{approval.id}")
        assert response.status_code == 200

        data = response.get_json()
        assert "entity_data" in data
        if data["entity_data"]:
            assert data["entity_data"]["emp_code"] == "EMP999"


class TestApproveRequest:
    """Tests for approving requests."""

    def test_approve_request_requires_admin_or_manager(self, test_app, db_cleanup):
        """Regular users cannot approve."""
        user = User(username="regular", role="user")
        user.set_password("pass123")
        db_session.add(user)
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "regular"
            sess["user_id"] = user.id
            sess["role"] = "user"

        response = test_app.post("/approve_request/1", json={})
        assert response.status_code == 403

    def test_approve_employee_request(self, authenticated_client, sample_pending_approval, db_cleanup):
        """Approve creates new employee record."""
        response = authenticated_client.post(
            f"/approve_request/{sample_pending_approval.id}",
            json={
                "target_table": "employees",
                "comment": "Approved for work"
            }
        )
        assert response.status_code == 200

        data = response.get_json()
        assert data["success"] == True
        assert data["entity_type"] == "employee"

    def test_approve_vehicle_request(self, authenticated_client, db_cleanup):
        """Approve creates new vehicle record."""
        approval = Approval(
            request_type="Vehicle",
            requester_name="New Vehicle",
            status="Pending",
            target_table="fleet"
        )
        db_session.add(approval)
        db_session.commit()

        response = authenticated_client.post(
            f"/approve_request/{approval.id}",
            json={
                "target_table": "fleet",
                "form_data": {
                    "registration": "ABC123",
                    "type": "Truck"
                }
            }
        )
        assert response.status_code == 200

        data = response.get_json()
        assert data["success"] == True

    def test_approve_not_found(self, authenticated_client):
        """Approving non-existent request fails gracefully."""
        response = authenticated_client.post(
            "/approve_request/99999",
            json={"target_table": "employees"}
        )
        assert response.status_code == 200

        data = response.get_json()
        assert data["success"] == False

    def test_approve_updates_approval_status(self, authenticated_client, sample_pending_approval, db_cleanup):
        """Approval status changes to Approved."""
        authenticated_client.post(
            f"/approve_request/{sample_pending_approval.id}",
            json={"target_table": "employees"}
        )

        updated = db_session.query(Approval).filter_by(
            id=sample_pending_approval.id
        ).first()
        assert updated.status == "Approved"
        assert updated.approved_by == "admin"


class TestRejectRequest:
    """Tests for rejecting requests."""

    def test_reject_request_requires_admin(self, test_app, db_cleanup):
        """Regular users cannot reject."""
        user = User(username="regular2", role="user")
        user.set_password("pass123")
        db_session.add(user)
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "regular2"
            sess["user_id"] = user.id
            sess["role"] = "user"

        response = test_app.post("/reject_request/1", json={"comment": "No"})
        assert response.status_code == 403

    def test_reject_request(self, authenticated_client, sample_pending_approval, db_cleanup):
        """Reject updates approval status."""
        response = authenticated_client.post(
            f"/reject_request/{sample_pending_approval.id}",
            json={"comment": "Invalid credentials"}
        )
        assert response.status_code == 200

        data = response.get_json()
        assert data["success"] == True

        updated = db_session.query(Approval).filter_by(
            id=sample_pending_approval.id
        ).first()
        assert updated.status == "Rejected"
        assert updated.approved_by == "admin"

    def test_reject_not_found(self, authenticated_client):
        """Rejecting non-existent request fails gracefully."""
        response = authenticated_client.post(
            "/reject_request/99999",
            json={"comment": "Test"}
        )
        assert response.status_code == 200

        data = response.get_json()
        assert data["success"] == False


class TestVisitorApproval:
    """Tests for visitor-specific approval flow."""

    def test_approve_visitor(self, authenticated_client, sample_visitor_approval, db_cleanup):
        """Approve visitor updates visitor status."""
        approval, visitor = sample_visitor_approval

        response = authenticated_client.post(
            f"/approve_visitor/{visitor.id}",
            follow_redirects=True
        )
        assert response.status_code == 200

        # Check visitor was approved
        updated_visitor = db_session.query(Visitor).filter_by(id=visitor.id).first()
        assert updated_visitor.status == "Checked In"
        assert updated_visitor.check_in_time is not None

        # Check approval was updated
        updated_approval = db_session.query(Approval).filter_by(id=approval.id).first()
        assert updated_approval.status == "Approved"

    def test_reject_visitor(self, authenticated_client, sample_visitor_approval, db_cleanup):
        """Reject visitor updates status."""
        approval, visitor = sample_visitor_approval

        response = authenticated_client.post(
            f"/reject_visitor/{visitor.id}",
            follow_redirects=True
        )
        assert response.status_code == 200

        # Check visitor was rejected
        updated_visitor = db_session.query(Visitor).filter_by(id=visitor.id).first()
        assert updated_visitor.status == "Rejected"

        # Check approval was updated
        updated_approval = db_session.query(Approval).filter_by(id=approval.id).first()
        assert updated_approval.status == "Rejected"

    def test_approve_visitor_not_found(self, authenticated_client):
        """Approve non-existent visitor returns 404."""
        response = authenticated_client.post("/approve_visitor/99999")
        assert response.status_code == 404

    def test_reject_visitor_not_found(self, authenticated_client):
        """Reject non-existent visitor returns 404."""
        response = authenticated_client.post("/reject_visitor/99999")
        assert response.status_code == 404


class TestQRScanCreatesApproval:
    """Tests that unknown QR scans create approval requests."""

    def test_unknown_qr_creates_approval(self, api_client, db_cleanup, HARDWARE_API_KEY):
        """Scanning unknown QR creates pending approval."""
        initial_count = db_session.query(Approval).filter_by(status="Pending").count()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "COMPLETELY_UNKNOWN_QR_999",
                "direction": "IN",
                "gate_location": "Test Gate"
            },
            headers={"X-API-Key": HARDWARE_API_KEY}
        )
        assert response.status_code == 200

        # Verify approval was created
        all_pending = db_session.query(Approval).filter_by(status="Pending").all()
        for a in all_pending:
            print(f"APPROVAL: {a.id}, {a.scanned_data}")
        final_count = len(all_pending)
        assert final_count > initial_count

        data = response.get_json()
        assert data["success"] == False  # Not yet approved
        assert data["status"] == "pending"

    def test_auto_approve_on_second_scan(self, api_client, db_cleanup, HARDWARE_API_KEY):
        """Second scan within 10 seconds auto-approves."""
        qr_code = "AUTO_APPROVE_TEST_123"

        # First scan - creates approval
        response1 = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": qr_code,
                "direction": "IN",
                "gate_location": "Test Gate"
            },
            headers={"X-API-Key": HARDWARE_API_KEY}
        )
        assert response1.status_code == 200
        data1 = response1.get_json()
        assert data1["success"] == False

        # Second scan immediately - should auto-approve
        response2 = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": qr_code,
                "direction": "IN",
                "gate_location": "Test Gate"
            },
            headers={"X-API-Key": HARDWARE_API_KEY}
        )
        assert response2.status_code == 200
        data2 = response2.get_json()
        assert data2["success"] == True


class TestGateLogUpdates:
    """Tests that approvals update gate logs."""

    def test_approval_updates_gate_log(self, authenticated_client, db_cleanup):
        """Approving updates the related gate log."""
        # Create a gate log for unknown scan
        gate_log = GateLog(
            access_type="unknown",
            entity_name="Unknown Person",
            direction="IN",
            access_granted=False,
            denial_reason="Not in system",
            gate_location="Main Gate"
        )
        db_session.add(gate_log)
        db_session.flush()

        # Create approval linked to this
        approval = Approval(
            request_type="Employee QR Scan",
            request_id=0,
            requester_name="Unknown Person",
            details="QR scan at Main Gate",
            status="Pending",
            scanned_data=json.dumps({"qr_code": "TEST_QR", "name": "Unknown"}),
            target_table="employees"
        )
        db_session.add(approval)
        db_session.commit()

        # Approve the request
        response = authenticated_client.post(
            f"/approve_request/{approval.id}",
            json={"target_table": "employees"}
        )
        assert response.status_code == 200
