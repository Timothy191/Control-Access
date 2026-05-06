import pytest
from app import app, db_session
from models import Employee, Vehicle, Visitor, GateLog


@pytest.fixture
def api_client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


class TestQRScanAPI:
    def test_scan_qr_requires_api_key(self, api_client, db_cleanup):
        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "test123",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
        )
        assert response.status_code == 401

    def test_scan_qr_valid_employee_in(self, api_client, db_cleanup):
        emp = Employee(
            employee_id="EMP001", name="John Doe", status="Active", qr_code="EMP_QR_001"
        )
        db_session.add(emp)
        db_session.commit()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "EMP_QR_001",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": "your-secret-hardware-key"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True
        assert data["entity_type"] == "employee"
        assert data["entity_name"] == "John Doe"

    def test_scan_qr_inactive_employee_denied(self, api_client, db_cleanup):
        emp = Employee(
            employee_id="EMP002",
            name="Jane Doe",
            status="Inactive",
            qr_code="EMP_QR_002",
        )
        db_session.add(emp)
        db_session.commit()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "EMP_QR_002",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": "your-secret-hardware-key"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == False
        assert data["message"] and ("inactive" in data["message"].lower() or "not active" in data["message"].lower())

    def test_scan_qr_valid_vehicle_in(self, api_client, db_cleanup):
        vehicle = Vehicle(
            registration="ABC123", type="Truck", status="Active", qr_code="VEH_QR_001"
        )
        db_session.add(vehicle)
        db_session.commit()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "VEH_QR_001",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": "your-secret-hardware-key"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True
        assert data["entity_type"] == "vehicle"
        assert data["entity_name"] == "ABC123"

    def test_scan_qr_checked_in_visitor_in(self, api_client, db_cleanup):
        visitor = Visitor(
            name="Test Visitor",
            company="Test Corp",
            status="Checked In",
            qr_code="VIS_QR_001",
        )
        db_session.add(visitor)
        db_session.commit()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "VIS_QR_001",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": "your-secret-hardware-key"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True
        assert data["entity_type"] == "visitor"

    def test_scan_qr_invalid_qr_denied(self, api_client, db_cleanup):
        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "invalid_qr_code",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": "your-secret-hardware-key"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == False
        assert data["message"] is not None
        # Message should indicate not registered or unknown
        assert "not registered" in data["message"].lower() or "unknown" in data["message"].lower() or "invalid" in data["message"].lower()

    def test_scan_qr_creates_gate_log(self, api_client, db_cleanup):
        emp = Employee(
            employee_id="EMP003", name="Log Test", status="Active", qr_code="EMP_QR_LOG"
        )
        db_session.add(emp)
        db_session.commit()

        api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "EMP_QR_LOG",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": "your-secret-hardware-key"},
        )

        log = db_session.query(GateLog).filter_by(qr_data="EMP_QR_LOG").first()
        assert log is not None
        assert log.access_type == "employee"
        assert log.entity_name == "Log Test"
        assert log.direction == "IN"
        assert log.access_granted == True

    def test_scan_qr_employee_medical_expired(self, api_client, db_cleanup):
        from datetime import datetime, timedelta

        emp = Employee(
            employee_id="EMP010",
            name="Medical Expired",
            status="Active",
            qr_code="EMP_QR_MED",
            medical_expiry=datetime.utcnow() - timedelta(days=30),
        )
        db_session.add(emp)
        db_session.commit()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "EMP_QR_MED",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": "your-secret-hardware-key"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == False
        assert "medical" in data["message"].lower()

    def test_scan_qr_employee_induction_expired(self, api_client, db_cleanup):
        from datetime import datetime, timedelta

        emp = Employee(
            employee_id="EMP011",
            name="Induction Expired",
            status="Active",
            qr_code="EMP_QR_IND",
            induction_expiry=datetime.utcnow() - timedelta(days=30),
        )
        db_session.add(emp)
        db_session.commit()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "EMP_QR_IND",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": "your-secret-hardware-key"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == False
        assert "induction" in data["message"].lower()

    def test_scan_qr_employee_valid_expiry(self, api_client, db_cleanup):
        from datetime import datetime, timedelta

        emp = Employee(
            employee_id="EMP012",
            name="Valid Expiry",
            status="Active",
            qr_code="EMP_QR_VALID",
            medical_expiry=datetime.utcnow() + timedelta(days=365),
            induction_expiry=datetime.utcnow() + timedelta(days=365),
        )
        db_session.add(emp)
        db_session.commit()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "EMP_QR_VALID",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": "your-secret-hardware-key"},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] == True

    def test_scan_qr_pending_then_auto_approve(self, api_client, db_cleanup):
        """Test that a second scan of the same QR code auto-approves a pending request."""
        from models import Approval

        # First scan - should create pending approval (use uppercase as normalized)
        qr_code = "NEW_EMP_123|ID: 987654|NAME: TEST EMPLOYEE"
        response1 = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": qr_code,
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": "your-secret-hardware-key"},
        )

        assert response1.status_code == 200
        data1 = response1.get_json()
        assert data1["success"] == False  # First scan should be pending/denied

        # Verify pending approval was created
        pending = db_session.query(Approval).filter_by(status="Pending").first()
        assert pending is not None
        assert qr_code in pending.scanned_data

        # Second scan within 10 seconds - should auto-approve
        response2 = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": qr_code,
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": "your-secret-hardware-key"},
        )

        assert response2.status_code == 200
        data2 = response2.get_json()
        # Second scan auto-creates employee and grants access
        assert data2["success"] == True
        assert data2["open_gate"] == True
