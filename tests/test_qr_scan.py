from datetime import UTC, datetime, timedelta

from app import db_session
from models import Employee, GateLog, Vehicle, Visitor


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

    def test_scan_qr_valid_employee_in(self, api_client, db_cleanup, HARDWARE_API_KEY):
        emp = Employee(
            emp_code="EMP001",
            first_name="John",
            surname="Doe",
            id_number="1234567890",
            status="Active",
            qr_code="EMP_QR_001",
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
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"]
        assert data["entity_type"] == "employee"
        assert "John" in data["entity_name"]

    def test_scan_qr_inactive_employee_denied(self, api_client, db_cleanup, HARDWARE_API_KEY):
        emp = Employee(
            emp_code="EMP002",
            first_name="Jane",
            surname="Doe",
            id_number="9876543210",
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
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert not data["success"]
        assert data["message"] and ("inactive" in data["message"].lower() or "not active" in data["message"].lower())

    def test_scan_qr_valid_vehicle_in(self, api_client, db_cleanup, HARDWARE_API_KEY):
        vehicle = Vehicle(
            fleet_id="ABC123",
            status="Active",
            qr_code="VEH_QR_001",
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
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"]
        assert data["entity_type"] == "vehicle"
        assert data["entity_name"] == "ABC123"

    def test_scan_qr_checked_in_visitor_in(self, api_client, db_cleanup, HARDWARE_API_KEY):
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
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"]
        assert data["entity_type"] == "visitor"

    def test_scan_qr_invalid_qr_denied(self, api_client, db_cleanup, HARDWARE_API_KEY):
        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "invalid_qr_code",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert not data["success"]
        assert data["message"] is not None

    def test_scan_qr_creates_gate_log(self, api_client, db_cleanup, HARDWARE_API_KEY):
        emp = Employee(
            emp_code="EMP003",
            first_name="Log",
            surname="Test",
            id_number="5555555555",
            status="Active",
            qr_code="EMP_QR_LOG",
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
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        log = db_session.query(GateLog).filter_by(qr_data="EMP_QR_LOG").first()
        assert log is not None
        assert log.access_type == "employee"
        assert log.direction == "IN"
        assert log.access_granted

    def test_scan_qr_employee_medical_expired(self, api_client, db_cleanup, HARDWARE_API_KEY):
        emp = Employee(
            emp_code="EMP010",
            first_name="Medical",
            surname="Expired",
            id_number="1111111111",
            status="Active",
            qr_code="EMP_QR_MED",
            medical_expiry=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=30),
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
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert not data["success"]
        assert "medical" in data["message"].lower()

    def test_scan_qr_employee_induction_expired(self, api_client, db_cleanup, HARDWARE_API_KEY):
        emp = Employee(
            emp_code="EMP011",
            first_name="Induction",
            surname="Expired",
            id_number="2222222222",
            status="Active",
            qr_code="EMP_QR_IND",
            induction_expiry=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=30),
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
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert not data["success"]
        assert "induction" in data["message"].lower()

    def test_scan_qr_employee_valid_expiry(self, api_client, db_cleanup, HARDWARE_API_KEY):
        emp = Employee(
            emp_code="EMP012",
            first_name="Valid",
            surname="Expiry",
            id_number="3333333333",
            status="Active",
            qr_code="EMP_QR_VALID",
            medical_expiry=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=365),
            induction_expiry=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=365),
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
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"]

    def test_scan_qr_pending_then_auto_approve(self, api_client, db_cleanup, HARDWARE_API_KEY):
        from models import Approval

        qr_code = "NEW_EMP_123|ID: 987654|NAME: TEST EMPLOYEE"
        response1 = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": qr_code,
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response1.status_code == 200
        data1 = response1.get_json()
        assert not data1["success"]

        pending = db_session.query(Approval).filter_by(status="Pending").first()
        assert pending is not None

        response2 = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": qr_code,
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response2.status_code == 200
        data2 = response2.get_json()
        assert data2["success"]
        assert data2["open_gate"]
