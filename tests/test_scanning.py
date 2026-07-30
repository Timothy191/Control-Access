"""Integration tests for the scanning blueprint (routes/scanning.py).

Covers: valid QR scan, invalid QR hash, expired employee, vehicle scan,
visitor scan, and related edge cases through the /api/scan_qr endpoint.
"""

from datetime import UTC, datetime, timedelta

from app import db_session
from models import Employee, GateLog, Vehicle, Visitor


class TestScanningBlueprint:
    """Tests for the scanning blueprint's /api/scan_qr endpoint."""

    # --- Valid QR scan ---

    def test_valid_employee_qr_scan_in(self, api_client, db_cleanup, HARDWARE_API_KEY):
        """Active employee with valid QR code should be granted access."""
        emp = Employee(
            emp_code="SCAN001",
            first_name="Alice",
            surname="Smith",
            id_number="1000000001",
            status="Active",
            qr_code="SCAN_QR_001",
        )
        db_session.add(emp)
        db_session.commit()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "SCAN_QR_001",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["entity_type"] == "employee"
        assert "Alice" in data["entity_name"]
        assert data["open_gate"] is True

    def test_valid_employee_qr_scan_creates_gate_log(
        self, api_client, db_cleanup, HARDWARE_API_KEY
    ):
        """A successful scan must create a GateLog entry."""
        emp = Employee(
            emp_code="SCAN002",
            first_name="Bob",
            surname="Jones",
            id_number="1000000002",
            status="Active",
            qr_code="SCAN_QR_LOG",
        )
        db_session.add(emp)
        db_session.commit()

        api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "SCAN_QR_LOG",
                "direction": "IN",
                "gate_location": "North Gate",
            },
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        log = db_session.query(GateLog).filter_by(qr_data="SCAN_QR_LOG").first()
        assert log is not None
        assert log.access_type == "employee"
        assert log.direction == "IN"
        assert log.access_granted is True

    # --- Invalid QR hash ---

    def test_invalid_qr_hash_denied(self, api_client, db_cleanup, HARDWARE_API_KEY):
        """An unknown QR code should be denied with a descriptive message."""
        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "TOTALLY_UNKNOWN_QR_999",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is False
        assert data["entity_name"] == "Unknown" or data.get("is_unknown") is True
        assert data["message"] is not None

    def test_invalid_qr_hash_no_gate_log_granted(
        self, api_client, db_cleanup, HARDWARE_API_KEY
    ):
        """An unknown QR must NOT produce an access_granted gate log."""
        api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "GHOST_QR",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        log = (
            db_session.query(GateLog)
            .filter_by(qr_data="GHOST_QR", access_granted=True)
            .first()
        )
        assert log is None

    # --- Expired employee ---

    def test_expired_medical_certificate_denied(
        self, api_client, db_cleanup, HARDWARE_API_KEY
    ):
        """Employee with expired medical certificate should be denied."""
        emp = Employee(
            emp_code="SCAN010",
            first_name="Med",
            surname="Expired",
            id_number="1000000010",
            status="Active",
            qr_code="SCAN_QR_MED",
            medical_expiry=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=10),
        )
        db_session.add(emp)
        db_session.commit()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "SCAN_QR_MED",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is False
        assert "medical" in data["message"].lower()

    def test_expired_induction_denied(
        self, api_client, db_cleanup, HARDWARE_API_KEY
    ):
        """Employee with expired induction should be denied."""
        emp = Employee(
            emp_code="SCAN011",
            first_name="Ind",
            surname="Expired",
            id_number="1000000011",
            status="Active",
            qr_code="SCAN_QR_IND",
            induction_expiry=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=5),
        )
        db_session.add(emp)
        db_session.commit()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "SCAN_QR_IND",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is False
        assert "induction" in data["message"].lower()

    def test_employee_with_valid_expiry_granted(
        self, api_client, db_cleanup, HARDWARE_API_KEY
    ):
        """Employee whose certificates are still valid should pass."""
        emp = Employee(
            emp_code="SCAN012",
            first_name="Valid",
            surname="Certs",
            id_number="1000000012",
            status="Active",
            qr_code="SCAN_QR_VALID",
            medical_expiry=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=365),
            induction_expiry=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=365),
        )
        db_session.add(emp)
        db_session.commit()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "SCAN_QR_VALID",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True

    def test_inactive_employee_denied(
        self, api_client, db_cleanup, HARDWARE_API_KEY
    ):
        """Inactive employee should be denied even without expiry issues."""
        emp = Employee(
            emp_code="SCAN013",
            first_name="Inactive",
            surname="Worker",
            id_number="1000000013",
            status="Inactive",
            qr_code="SCAN_QR_INACTIVE",
        )
        db_session.add(emp)
        db_session.commit()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "SCAN_QR_INACTIVE",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is False

    # --- Vehicle scan ---

    def test_valid_vehicle_scan_in(self, api_client, db_cleanup, HARDWARE_API_KEY):
        """Active vehicle with valid QR should be granted access."""
        vehicle = Vehicle(
            fleet_id="VEH-SCAN-01",
            status="Active",
            qr_code="VEH_SCAN_QR_01",
        )
        db_session.add(vehicle)
        db_session.commit()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "VEH_SCAN_QR_01",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["entity_type"] == "vehicle"
        assert data["entity_name"] == "VEH-SCAN-01"

    def test_inactive_vehicle_denied(self, api_client, db_cleanup, HARDWARE_API_KEY):
        """Inactive vehicle should be denied."""
        vehicle = Vehicle(
            fleet_id="VEH-SCAN-02",
            status="Inactive",
            qr_code="VEH_SCAN_QR_02",
        )
        db_session.add(vehicle)
        db_session.commit()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "VEH_SCAN_QR_02",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is False

    def test_vehicle_with_expired_registration_still_granted_by_scan_endpoint(
        self, api_client, db_cleanup, HARDWARE_API_KEY
    ):
        """The /api/scan_qr endpoint does not enforce registration_expiry;
        only verify_qr_mobile does. An Active vehicle with expired registration
        is still granted through the hardware scan path."""
        vehicle = Vehicle(
            fleet_id="VEH-SCAN-03",
            status="Active",
            qr_code="VEH_SCAN_QR_03",
            registration_expiry=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=15),
        )
        db_session.add(vehicle)
        db_session.commit()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "VEH_SCAN_QR_03",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        # _process_qr_scan only checks vehicle.status, not registration_expiry
        assert data["success"] is True
        assert data["entity_type"] == "vehicle"

    # --- Visitor scan ---

    def test_checked_in_visitor_scan(self, api_client, db_cleanup, HARDWARE_API_KEY):
        """Visitor with 'Checked In' status should be granted access."""
        visitor = Visitor(
            name="Scan Visitor",
            company="Test Corp",
            status="Checked In",
            qr_code="VIS_SCAN_QR_01",
        )
        db_session.add(visitor)
        db_session.commit()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "VIS_SCAN_QR_01",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["entity_type"] == "visitor"

    def test_visitor_not_checked_in_denied(
        self, api_client, db_cleanup, HARDWARE_API_KEY
    ):
        """Visitor without 'Checked In' status should be denied."""
        visitor = Visitor(
            name="Not Checked In",
            company="Test Corp",
            status="Expected",
            qr_code="VIS_SCAN_QR_02",
        )
        db_session.add(visitor)
        db_session.commit()

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "VIS_SCAN_QR_02",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
            headers={"X-API-Key": HARDWARE_API_KEY},
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is False

    # --- Auth requirement ---

    def test_scan_qr_without_api_key_rejected(self, api_client, db_cleanup):
        """Missing API key should return 401."""
        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": "ANY_QR",
                "direction": "IN",
                "gate_location": "Main Gate",
            },
        )
        assert response.status_code == 401
