"""
Test suite for export functionality - Excel, PDF, and QR ZIP exports.
"""

import pytest
import io
from datetime import datetime, timedelta
from app import app, db_session
from models import User, Employee, Vehicle, Visitor, Equipment, GateLog


@pytest.fixture
def sample_data_for_export(db_cleanup):
    """Create comprehensive sample data for export tests."""
    # Employees
    employees = []
    for i in range(5):
        emp = Employee(
            emp_code=f"EXP{i:03d}",
            initials=f"E{i}",
            first_name=f"Export{i}",
            surname=f"Test{i}",
            id_number=f"ID{i:08d}",
            job_title=f"Job{i}",
            induction=f"Standard",
            induction_expiry=datetime.now() + timedelta(days=365),
            medical=f"Class A",
            medical_expiry=datetime.now() + timedelta(days=180),
            status="Active",
            qr_code=f"QR_EXP_{i}"
        )
        db_session.add(emp)
        employees.append(emp)
    
    # Vehicles
    vehicles = []
    for i in range(3):
        veh = Vehicle(
            fleet_id=f"FLEET{i:03d}",
            registration_expiry=datetime.now() + timedelta(days=365),
            status="Active",
            qr_code=f"QR_VEH_{i}"
        )
        db_session.add(veh)
        vehicles.append(veh)
    
    # Visitors
    visitors = []
    for i in range(3):
        vis = Visitor(
            name=f"Visitor{i}",
            company=f"Company{i}",
            purpose=f"Purpose{i}",
            status="Checked In",
            check_in_time=datetime.now()
        )
        db_session.add(vis)
        visitors.append(vis)
    
    # Equipment
    equipment = []
    for i in range(3):
        eq = Equipment(
            radio_id=f"RADIO{i:03d}",
            status="Active",
            qr_code=f"QR_EQ_{i}"
        )
        db_session.add(eq)
        equipment.append(eq)
    
    # Gate Logs
    for i in range(10):
        log = GateLog(
            access_type="employee",
            entity_id=employees[0].id,
            entity_name=employees[0].first_name,
            direction="IN" if i % 2 == 0 else "OUT",
            qr_data=f"QR_EXP_0",
            access_granted=True,
            gate_location="Main Gate",
            scanned_by="Scanner1"
        )
        db_session.add(log)
    
    db_session.commit()
    return employees, vehicles, visitors, equipment


class TestEmployeeExport:
    """Tests for employee export functionality."""

    def test_export_employees_excel_requires_login(self, test_app):
        """Export requires authentication."""
        response = test_app.get("/export/employees/excel")
        assert response.status_code == 302

    def test_export_employees_excel_requires_manager(self, test_app, db_cleanup):
        """Regular users cannot export."""
        user = User(username="regular_exp", password="pass123", role="user")
        db_session.add(user)
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "regular_exp"
            sess["user_id"] = user.id
            sess["role"] = "user"

        response = test_app.get("/export/employees/excel")
        assert response.status_code == 403

    def test_export_employees_excel(self, authenticated_client, sample_data_for_export):
        """Export employees to Excel."""
        response = authenticated_client.get("/export/employees/excel")
        assert response.status_code == 200
        
        # Check content type
        assert response.content_type in [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/octet-stream"
        ]
        
        # Check file content
        assert len(response.data) > 0
        # Should contain download name header or filename in response

    def test_export_employees_pdf(self, authenticated_client, sample_data_for_export):
        """Export employees to PDF."""
        response = authenticated_client.get("/export/employees/pdf")
        assert response.status_code == 200
        assert response.content_type == "application/pdf"
        assert len(response.data) > 0

    def test_export_employees_with_filters(self, authenticated_client, sample_data_for_export):
        """Export with job title filter."""
        response = authenticated_client.get("/export/employees/pdf?job_title=Job0&status=Active")
        assert response.status_code == 200

    def test_export_employees_qr_zip(self, authenticated_client, sample_data_for_export):
        """Export employee QR codes as ZIP."""
        response = authenticated_client.get("/export/employees/qr-zip")
        assert response.status_code == 200
        assert response.content_type == "application/zip"
        assert len(response.data) > 100

    def test_export_employees_qr_zip_no_qr_codes(self, authenticated_client, db_cleanup):
        """Export QR ZIP with no QR codes returns 404."""
        # Create employees without QR codes
        emp = Employee(
            emp_code="NOQR001",
            first_name="NoQR",
            surname="Test",
            status="Active",
            qr_code=None
        )
        db_session.add(emp)
        db_session.commit()

        response = authenticated_client.get("/export/employees/qr-zip")
        assert response.status_code == 404


class TestVisitorExport:
    """Tests for visitor export functionality."""

    def test_export_visitors_excel(self, authenticated_client, sample_data_for_export):
        """Export visitors to Excel."""
        response = authenticated_client.get("/export/visitors/excel")
        assert response.status_code == 200
        assert "spreadsheetml" in response.content_type or "octet-stream" in response.content_type

    def test_export_visitors_pdf(self, authenticated_client, sample_data_for_export):
        """Export visitors to PDF."""
        response = authenticated_client.get("/export/visitors/pdf")
        assert response.status_code == 200
        assert response.content_type == "application/pdf"

    def test_export_visitors_with_filters(self, authenticated_client, sample_data_for_export):
        """Export with status filter."""
        today = datetime.now().strftime("%Y-%m-%d")
        response = authenticated_client.get(
            f"/export/visitors/pdf?status=Checked In&date_from={today}"
        )
        assert response.status_code == 200

    def test_export_visitors_empty(self, authenticated_client, db_cleanup):
        """Export empty visitors list."""
        db_session.query(Visitor).delete()
        db_session.commit()

        response = authenticated_client.get("/export/visitors/excel")
        assert response.status_code == 200


class TestFleetExport:
    """Tests for fleet/vehicle export functionality."""

    def test_export_fleet_excel(self, authenticated_client, sample_data_for_export):
        """Export fleet to Excel."""
        response = authenticated_client.get("/export/fleet/excel")
        assert response.status_code == 200
        assert "spreadsheetml" in response.content_type or "octet-stream" in response.content_type

    def test_export_fleet_pdf(self, authenticated_client, sample_data_for_export):
        """Export fleet to PDF."""
        response = authenticated_client.get("/export/fleet/pdf")
        assert response.status_code == 200
        assert response.content_type == "application/pdf"

    def test_export_fleet_qr_zip(self, authenticated_client, sample_data_for_export):
        """Export fleet QR codes as ZIP."""
        response = authenticated_client.get("/export/fleet/qr-zip")
        assert response.status_code == 200
        assert response.content_type == "application/zip"

    def test_export_fleet_qr_zip_no_qr_codes(self, authenticated_client, db_cleanup):
        """Export fleet QR ZIP with no QR codes returns 404."""
        veh = Vehicle(
            fleet_id="NOQR_VEH",
            status="Active",
            qr_code=None
        )
        db_session.add(veh)
        db_session.commit()

        response = authenticated_client.get("/export/fleet/qr-zip")
        assert response.status_code == 404

    def test_export_fleet_empty(self, authenticated_client, db_cleanup):
        """Export empty fleet."""
        db_session.query(Vehicle).delete()
        db_session.commit()

        response = authenticated_client.get("/export/fleet/excel")
        assert response.status_code == 200


class TestEquipmentExport:
    """Tests for equipment export functionality."""

    def test_export_equipment_excel(self, authenticated_client, sample_data_for_export):
        """Export equipment to Excel."""
        response = authenticated_client.get("/export/equipment/excel")
        assert response.status_code == 200
        assert "spreadsheetml" in response.content_type or "octet-stream" in response.content_type

    def test_export_equipment_pdf(self, authenticated_client, sample_data_for_export):
        """Export equipment to PDF."""
        response = authenticated_client.get("/export/equipment/pdf")
        assert response.status_code == 200
        assert response.content_type == "application/pdf"

    def test_export_equipment_qr_zip(self, authenticated_client, sample_data_for_export):
        """Export equipment QR codes as ZIP."""
        response = authenticated_client.get("/export/equipment/qr-zip")
        assert response.status_code == 200
        assert response.content_type == "application/zip"

    def test_export_equipment_qr_zip_no_equipment(self, authenticated_client, db_cleanup):
        """Export equipment QR ZIP with no equipment returns 404."""
        db_session.query(Equipment).delete()
        db_session.commit()

        response = authenticated_client.get("/export/equipment/qr-zip")
        assert response.status_code == 404


class TestGateLogExport:
    """Tests for gate log export functionality."""

    def test_export_gate_logs_excel(self, authenticated_client, sample_data_for_export):
        """Export gate logs to Excel."""
        response = authenticated_client.get("/export/gate_logs/excel")
        assert response.status_code == 200
        assert "spreadsheetml" in response.content_type or "octet-stream" in response.content_type

    def test_export_gate_logs_excel_requires_admin(self, test_app, db_cleanup):
        """Gate logs export requires admin."""
        user = User(username="manager_gl", password="pass123", role="manager")
        db_session.add(user)
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "manager_gl"
            sess["user_id"] = user.id
            sess["role"] = "manager"

        response = test_app.get("/export/gate_logs/excel")
        assert response.status_code == 403

    def test_export_gate_logs_pdf(self, authenticated_client, sample_data_for_export):
        """Export gate logs to PDF."""
        response = authenticated_client.get("/export/gate_logs/pdf")
        assert response.status_code == 200
        assert response.content_type == "application/pdf"

    def test_export_gate_logs_with_filters(self, authenticated_client, sample_data_for_export):
        """Export with type and direction filters."""
        today = datetime.now().strftime("%Y-%m-%d")
        response = authenticated_client.get(
            f"/export/gate_logs/pdf?type=employee&direction=IN&date_from={today}"
        )
        assert response.status_code == 200

    def test_export_gate_logs_empty(self, authenticated_client, db_cleanup):
        """Export empty gate logs."""
        db_session.query(GateLog).delete()
        db_session.commit()

        response = authenticated_client.get("/export/gate_logs/excel")
        assert response.status_code == 200


class TestExportContent:
    """Tests for verifying export content accuracy."""

    def test_employee_excel_content(self, authenticated_client, sample_data_for_export):
        """Verify employee data in Excel export."""
        response = authenticated_client.get("/export/employees/excel")
        
        # Save to temporary file for analysis (if needed)
        # For now just verify successful export
        assert response.status_code == 200
        assert len(response.data) > 500  # Should have substantial content

    def test_employee_pdf_content(self, authenticated_client, sample_data_for_export):
        """Verify employee data in PDF export."""
        response = authenticated_client.get("/export/employees/pdf")
        
        # PDF should start with %PDF magic bytes
        assert response.data[:4] == b"%PDF"
        assert response.status_code == 200

    def test_qr_zip_contains_files(self, authenticated_client, sample_data_for_export):
        """Verify QR ZIP contains expected files."""
        import zipfile
        
        response = authenticated_client.get("/export/employees/qr-zip")
        
        # Verify it's a valid ZIP
        zip_buffer = io.BytesIO(response.data)
        with zipfile.ZipFile(zip_buffer, 'r') as zip_file:
            files = zip_file.namelist()
            assert len(files) == 5  # 5 employees with QR codes
            assert all(f.endswith('.png') for f in files)


class TestExportErrorHandling:
    """Tests for export error handling."""

    def test_export_handles_special_characters(self, authenticated_client, db_cleanup):
        """Export handles special characters in data."""
        emp = Employee(
            emp_code="SPEC001",
            first_name="José",
            surname="Muñoz",
            id_number="123456",
            job_title="Engineer & Supervisor",
            status="Active"
        )
        db_session.add(emp)
        db_session.commit()

        response = authenticated_client.get("/export/employees/excel")
        assert response.status_code == 200

    def test_export_handles_long_strings(self, authenticated_client, db_cleanup):
        """Export handles very long strings."""
        emp = Employee(
            emp_code="LONG001",
            first_name="A" * 100,
            surname="B" * 100,
            id_number="123456",
            status="Active"
        )
        db_session.add(emp)
        db_session.commit()

        response = authenticated_client.get("/export/employees/pdf")
        assert response.status_code == 200
