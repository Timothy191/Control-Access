"""
Test suite for gate logs - filtering, pagination, and API endpoints.
"""

import pytest
from datetime import datetime, timedelta
from app import app, db_session
from models import GateLog, User, Employee, Vehicle, Visitor


@pytest.fixture
def sample_gate_logs(db_cleanup):
    """Create sample gate logs for testing."""
    logs = []
    
    # Employee scan - granted
    log1 = GateLog(
        access_type="employee",
        entity_id=1,
        entity_name="John Doe",
        direction="IN",
        qr_data="EMP_QR_001",
        access_granted=True,
        gate_location="Main Gate",
        scanned_by="Scanner-1"
    )
    db_session.add(log1)
    logs.append(log1)
    
    # Vehicle scan - granted
    log2 = GateLog(
        access_type="vehicle",
        entity_id=1,
        entity_name="TRUCK001",
        direction="OUT",
        qr_data="VEH_QR_001",
        access_granted=True,
        gate_location="South Gate",
        scanned_by="Scanner-2"
    )
    db_session.add(log2)
    logs.append(log2)
    
    # Unknown scan - denied
    log3 = GateLog(
        access_type="unknown",
        entity_name="Unknown",
        direction="IN",
        qr_data="UNKNOWN_QR",
        access_granted=False,
        denial_reason="Not in system",
        gate_location="Main Gate",
        scanned_by="Scanner-1"
    )
    db_session.add(log3)
    logs.append(log3)
    
    db_session.commit()
    return logs


class TestGateLogsPage:
    """Tests for gate logs web page."""

    def test_gate_logs_requires_login(self, test_app):
        """Unauthenticated users redirected."""
        response = test_app.get("/gate_logs")
        assert response.status_code == 302
        assert "/login" in response.location

    def test_gate_logs_requires_security_role(self, test_app, db_cleanup):
        """Regular users cannot view gate logs."""
        user = User(username="regular_gl", role="user")
        user.set_password("pass123")
        db_session.add(user)
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "regular_gl"
            sess["user_id"] = user.id
            sess["role"] = "user"

        response = test_app.get("/gate_logs")
        assert response.status_code == 403

    def test_gate_logs_access(self, authenticated_client, sample_gate_logs):
        """Admin can view gate logs."""
        response = authenticated_client.get("/gate_logs")
        assert response.status_code == 200
        assert b"John Doe" in response.data

    def test_gate_logs_filter_by_type(self, authenticated_client, sample_gate_logs):
        """Filter logs by access type."""
        response = authenticated_client.get("/gate_logs?type=employee")
        assert response.status_code == 200
        assert b"John Doe" in response.data
        # Should not show vehicle
        assert b"TRUCK001" not in response.data

    def test_gate_logs_filter_by_direction(self, authenticated_client, sample_gate_logs):
        """Filter logs by direction."""
        response = authenticated_client.get("/gate_logs?direction=IN")
        assert response.status_code == 200
        assert b"John Doe" in response.data  # IN
        assert b"TRUCK001" not in response.data  # OUT

    def test_gate_logs_filter_by_status_granted(self, authenticated_client, sample_gate_logs):
        """Filter logs by granted status."""
        response = authenticated_client.get("/gate_logs?status=granted")
        assert response.status_code == 200
        assert b"John Doe" in response.data
        assert b"TRUCK001" in response.data

    def test_gate_logs_filter_by_status_denied(self, authenticated_client, sample_gate_logs):
        """Filter logs by denied status."""
        response = authenticated_client.get("/gate_logs?status=denied")
        assert response.status_code == 200
        assert b"Not in system" in response.data or b"Unknown" in response.data

    def test_gate_logs_filter_by_date(self, authenticated_client, sample_gate_logs):
        """Filter logs by date range."""
        today = datetime.now().strftime("%Y-%m-%d")
        response = authenticated_client.get(f"/gate_logs?date_from={today}&date_to={today}")
        assert response.status_code == 200

    def test_gate_logs_filter_by_gate_location(self, authenticated_client, sample_gate_logs):
        """Filter logs by gate location."""
        response = authenticated_client.get("/gate_logs?gate=Main Gate")
        assert response.status_code == 200
        assert b"John Doe" in response.data
        assert b"TRUCK001" not in response.data

    def test_gate_logs_pagination(self, authenticated_client, db_cleanup):
        """Pagination works correctly."""
        # Create many logs
        for i in range(60):
            log = GateLog(
                access_type="employee",
                entity_name=f"Person {i}",
                direction="IN",
                access_granted=True,
                gate_location="Main Gate"
            )
            db_session.add(log)
        db_session.commit()

        # First page
        response = authenticated_client.get("/gate_logs?page=1&per_page=20")
        assert response.status_code == 200

        # Second page
        response = authenticated_client.get("/gate_logs?page=2&per_page=20")
        assert response.status_code == 200

    def test_gate_logs_empty_list(self, authenticated_client):
        """Empty list handled gracefully."""
        db_session.query(GateLog).delete()
        db_session.commit()

        response = authenticated_client.get("/gate_logs")
        assert response.status_code == 200


class TestGateLogsAPI:
    """Tests for gate logs JSON API."""

    def test_api_gate_logs_requires_login(self, test_app):
        """API requires authentication."""
        response = test_app.get("/api/gate_logs")
        assert response.status_code == 302

    def test_api_gate_logs(self, authenticated_client, sample_gate_logs):
        """Fetch gate logs as JSON."""
        response = authenticated_client.get("/api/gate_logs")
        assert response.status_code == 200

        data = response.get_json()
        assert isinstance(data, dict)
        assert "logs" in data
        assert "page" in data
        assert "total" in data
        assert len(data["logs"]) >= 3

        # Check structure
        first_log = data["logs"][0]
        assert "id" in first_log
        assert "type" in first_log
        assert "name" in first_log
        assert "direction" in first_log
        assert "granted" in first_log

    def test_api_gate_logs_limit(self, authenticated_client, sample_gate_logs):
        """Limit parameter works."""
        response = authenticated_client.get("/api/gate_logs?limit=2")
        assert response.status_code == 200

        data = response.get_json()
        assert len(data["logs"]) == 2
        assert data["limit"] == 2

    def test_api_gate_logs_ordering(self, authenticated_client, sample_gate_logs):
        """Logs ordered by timestamp desc."""
        response = authenticated_client.get("/api/gate_logs")
        assert response.status_code == 200

        data = response.get_json()
        logs = data["logs"]
        if len(logs) >= 2:
            # Should be newest first
            first_time = datetime.strptime(logs[0]["time"], "%Y-%m-%d %H:%M:%S")
            second_time = datetime.strptime(logs[1]["time"], "%Y-%m-%d %H:%M:%S")
            assert first_time >= second_time


class TestRecentActivityAPI:
    """Tests for recent activity endpoint."""

    def test_recent_activity_requires_login(self, test_app):
        """API requires authentication."""
        response = test_app.get("/api/recent_activity")
        assert response.status_code == 302

    def test_recent_activity(self, authenticated_client, sample_gate_logs):
        """Fetch today's activity."""
        response = authenticated_client.get("/api/recent_activity")
        assert response.status_code == 200

        data = response.get_json()
        assert isinstance(data, list)

    def test_recent_activity_today_only(self, authenticated_client, db_cleanup):
        """Only shows today's logs."""
        # Create old log
        old_log = GateLog(
            access_type="employee",
            entity_name="Old Person",
            direction="IN",
            access_granted=True,
            gate_location="Main Gate"
        )
        old_log.scanned_at = datetime.now() - timedelta(days=2)
        db_session.add(old_log)

        # Create today's log
        new_log = GateLog(
            access_type="employee",
            entity_name="New Person",
            direction="IN",
            access_granted=True,
            gate_location="Main Gate"
        )
        db_session.add(new_log)
        db_session.commit()

        response = authenticated_client.get("/api/recent_activity")
        assert response.status_code == 200

        data = response.get_json()
        # Should only show new person
        names = [log["name"] for log in data]
        assert "New Person" in names
        assert "Old Person" not in names

    def test_recent_activity_empty(self, authenticated_client):
        """Empty response handled."""
        db_session.query(GateLog).delete()
        db_session.commit()

        response = authenticated_client.get("/api/recent_activity")
        assert response.status_code == 200

        data = response.get_json()
        assert data == []


class TestGateLogExport:
    """Tests for gate log export functionality."""

    def test_export_gate_logs_excel(self, authenticated_client, sample_gate_logs):
        """Export gate logs to Excel."""
        response = authenticated_client.get("/export/gate_logs/excel")
        assert response.status_code == 200
        assert "spreadsheetml" in response.content_type or "octet-stream" in response.content_type

    def test_export_gate_logs_pdf(self, authenticated_client, sample_gate_logs):
        """Export gate logs to PDF."""
        response = authenticated_client.get("/export/gate_logs/pdf")
        assert response.status_code == 200
        assert response.content_type == "application/pdf"

    def test_export_gate_logs_pdf_with_filters(self, authenticated_client, sample_gate_logs):
        """Export with filters applied."""
        response = authenticated_client.get("/export/gate_logs/pdf?type=employee&direction=IN")
        assert response.status_code == 200

    def test_export_gate_logs_excel_with_filters(self, authenticated_client, sample_gate_logs):
        """Export Excel with filters."""
        today = datetime.now().strftime("%Y-%m-%d")
        response = authenticated_client.get(
            f"/export/gate_logs/excel?date_from={today}&date_to={today}"
        )
        assert response.status_code == 200


class TestQRScannerPage:
    """Tests for QR scanner interface page."""

    def test_qr_scanner_requires_login(self, test_app):
        """Unauthenticated users redirected."""
        response = test_app.get("/qr_scanner")
        assert response.status_code == 302

    def test_qr_scanner_requires_security_role(self, test_app, db_cleanup):
        """Regular users cannot access scanner interface."""
        user = User(username="regular_qr", role="user")
        user.set_password("pass123")
        db_session.add(user)
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "regular_qr"
            sess["user_id"] = user.id
            sess["role"] = "user"

        response = test_app.get("/qr_scanner")
        assert response.status_code == 403

    def test_qr_scanner_access(self, authenticated_client):
        """Admin can access scanner interface."""
        response = authenticated_client.get("/qr_scanner")
        assert response.status_code == 200


class TestKioskPage:
    """Tests for kiosk scanner page."""

    def test_kiosk_public_access(self, test_app):
        """Kiosk is publicly accessible."""
        response = test_app.get("/kiosk")
        assert response.status_code == 200

    def test_kiosk_content(self, test_app):
        """Kiosk page loads correctly."""
        response = test_app.get("/kiosk")
        assert response.status_code == 200
        # Should contain scanner interface elements
        assert b"scan" in response.data.lower() or b"kiosk" in response.data.lower()


class TestUniversalScan:
    """Tests for universal scan endpoint (/scan/<qr> and /s/<qr>)."""

    def test_universal_scan_public_access(self, test_app):
        """Universal scan is publicly accessible."""
        response = test_app.get("/scan/TEST_QR_CODE")
        assert response.status_code == 200

    def test_universal_scan_short_url(self, test_app):
        """Short URL (/s/) works."""
        response = test_app.get("/s/TEST_QR_CODE")
        assert response.status_code == 200

    def test_universal_scan_unknown_qr(self, test_app):
        """Unknown QR shows denial."""
        response = test_app.get("/scan/UNKNOWN_QR_12345")
        assert response.status_code == 200
        # Should show access denied or unknown
        assert b"denied" in response.data.lower() or b"unknown" in response.data.lower()

    def test_universal_scan_known_employee(self, test_app, db_cleanup):
        """Known employee shows approval."""
        emp = Employee(
            emp_code="SCAN001",
            first_name="Scan",
            surname="Test",
            status="Active",
            qr_code="SCAN_QR_001"
        )
        db_session.add(emp)
        db_session.commit()

        response = test_app.get("/scan/SCAN_QR_001")
        assert response.status_code == 200
        # Should show granted or employee name
        assert b"Scan" in response.data or b"granted" in response.data.lower()


class TestOnboardPage:
    """Tests for device onboarding page."""

    def test_onboard_public_access(self, test_app):
        """Onboard page is publicly accessible."""
        response = test_app.get("/onboard")
        assert response.status_code == 200

    def test_onboard_content(self, test_app):
        """Onboard page contains QR codes."""
        response = test_app.get("/onboard")
        assert response.status_code == 200
        # Should contain config QR
        assert b"data:image" in response.data or b"qr" in response.data.lower()
