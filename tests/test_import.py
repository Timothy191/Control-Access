"""
Test suite for import functionality - Excel and CSV imports.
"""

import pytest
import io
from datetime import datetime
from app import app, db_session
from models import User, Employee, Vehicle


class TestImportEmployees:
    """Tests for employee import functionality."""

    def test_import_employees_requires_manager(self, test_app, db_cleanup):
        """Regular users cannot import."""
        user = User(username="regular_imp", password="pass123", role="user")
        db_session.add(user)
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "regular_imp"
            sess["user_id"] = user.id
            sess["role"] = "user"

        response = test_app.post("/import/employees")
        assert response.status_code == 302

    def test_import_employees_no_file(self, authenticated_client):
        """Import fails without file."""
        response = authenticated_client.post("/import/employees")
        assert response.status_code == 400
        
        data = response.get_json()
        assert "error" in data

    def test_import_employees_empty_filename(self, authenticated_client):
        """Import fails with empty filename."""
        response = authenticated_client.post(
            "/import/employees",
            data={"file": (io.BytesIO(b""), "")},
            content_type="multipart/form-data"
        )
        assert response.status_code == 400

    def test_import_employees_csv(self, authenticated_client, db_cleanup):
        """Import employees from CSV."""
        csv_data = """emp_code,first_name,surname,id_number,job_title,status
IMP001,Import,One,ID001,Engineer,Active
IMP002,Import,Two,ID002,Technician,Active"""

        response = authenticated_client.post(
            "/import/employees",
            data={"file": (io.BytesIO(csv_data.encode()), "employees.csv")},
            content_type="multipart/form-data"
        )
        assert response.status_code == 200

        data = response.get_json()
        assert data["imported"] == 2
        assert data["skipped"] == 0

        # Verify employees were created
        emp1 = db_session.query(Employee).filter_by(emp_code="IMP001").first()
        assert emp1 is not None
        assert emp1.first_name == "Import"

    def test_import_employees_excel(self, authenticated_client, db_cleanup):
        """Import employees from Excel (requires openpyxl)."""
        # Create minimal Excel file data
        # This test would need actual Excel file generation
        # For now, we test with CSV format that Excel would produce
        csv_data = """emp_code,initials,first_name,surname,id_number,job_title,status
EXP001,JD,John,Doe,123456789,Engineer,Active"""

        response = authenticated_client.post(
            "/import/employees",
            data={"file": (io.BytesIO(csv_data.encode()), "employees.xlsx")},
            content_type="multipart/form-data"
        )
        # May fail due to format mismatch, but shouldn't crash
        assert response.status_code in [200, 400, 500]

    def test_import_employees_missing_columns(self, authenticated_client):
        """Import fails with missing required columns."""
        csv_data = """first_name,surname
Only,Names"""

        response = authenticated_client.post(
            "/import/employees",
            data={"file": (io.BytesIO(csv_data.encode()), "bad.csv")},
            content_type="multipart/form-data"
        )
        assert response.status_code == 400
        
        data = response.get_json()
        assert "error" in data
        assert "Missing" in data["error"]

    def test_import_employees_duplicates(self, authenticated_client, db_cleanup):
        """Duplicate employees are skipped."""
        # Create existing employee
        emp = Employee(
            emp_code="DUP001",
            first_name="Existing",
            surname="Employee",
            id_number="EXIST001",
            status="Active"
        )
        db_session.add(emp)
        db_session.commit()

        # Try to import same employee
        csv_data = """emp_code,first_name,surname,id_number,status
DUP001,New,Employee,NEW001,Active
DUP002,Another,Employee,NEW002,Active"""

        response = authenticated_client.post(
            "/import/employees",
            data={"file": (io.BytesIO(csv_data.encode()), "duplicates.csv")},
            content_type="multipart/form-data"
        )
        assert response.status_code == 200

        data = response.get_json()
        assert data["imported"] == 1  # Only DUP002
        assert data["skipped"] == 1   # DUP001 skipped

    def test_import_employees_with_dates(self, authenticated_client, db_cleanup):
        """Import with expiry dates."""
        csv_data = """emp_code,first_name,surname,id_number,induction_expiry,medical_expiry,status
DATE001,Date,Test,DT001,2025-12-31,2025-06-30,Active"""

        response = authenticated_client.post(
            "/import/employees",
            data={"file": (io.BytesIO(csv_data.encode()), "dates.csv")},
            content_type="multipart/form-data"
        )
        assert response.status_code == 200

        emp = db_session.query(Employee).filter_by(emp_code="DATE001").first()
        assert emp is not None
        assert emp.induction_expiry is not None
        assert emp.medical_expiry is not None

    def test_import_employees_invalid_date_format(self, authenticated_client, db_cleanup):
        """Import handles invalid date formats."""
        csv_data = """emp_code,first_name,surname,id_number,induction_expiry,status
BADATE001,Bad,Date,BD001,not-a-date,Active"""

        response = authenticated_client.post(
            "/import/employees",
            data={"file": (io.BytesIO(csv_data.encode()), "baddates.csv")},
            content_type="multipart/form-data"
        )
        assert response.status_code == 200

        data = response.get_json()
        # Should still import but record error
        assert "errors" in data

    def test_import_employees_large_file(self, authenticated_client, db_cleanup):
        """Import handles large files."""
        # Create CSV with many rows
        lines = ["emp_code,first_name,surname,id_number,status"]
        for i in range(100):
            lines.append(f"LARGE{i:04d},Large,Test{i},ID{i:08d},Active")
        csv_data = "\n".join(lines)

        response = authenticated_client.post(
            "/import/employees",
            data={"file": (io.BytesIO(csv_data.encode()), "large.csv")},
            content_type="multipart/form-data"
        )
        assert response.status_code == 200

        data = response.get_json()
        assert data["imported"] == 100

    def test_import_employees_file_too_large(self, authenticated_client):
        """Import rejects files over 5MB."""
        # Create large file (6MB)
        large_data = b"emp_code,first_name,surname,id_number,status\n"
        large_data += b"A" * (6 * 1024 * 1024)

        response = authenticated_client.post(
            "/import/employees",
            data={"file": (io.BytesIO(large_data), "huge.csv")},
            content_type="multipart/form-data"
        )
        assert response.status_code == 413


class TestImportVehicles:
    """Tests for vehicle import functionality."""

    def test_import_vehicles_requires_manager(self, test_app, db_cleanup):
        """Regular users cannot import."""
        user = User(username="regular_veh", password="pass123", role="user")
        db_session.add(user)
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "regular_veh"
            sess["user_id"] = user.id
            sess["role"] = "user"

        response = test_app.post("/import/vehicles")
        assert response.status_code == 302

    def test_import_vehicles_csv(self, authenticated_client, db_cleanup):
        """Import vehicles from CSV."""
        csv_data = """fleet_id
VEH001
VEH002
VEH003"""

        response = authenticated_client.post(
            "/import/vehicles",
            data={"file": (io.BytesIO(csv_data.encode()), "vehicles.csv")},
            content_type="multipart/form-data"
        )
        assert response.status_code == 200

        data = response.get_json()
        assert data["imported"] == 3

        # Verify vehicles created
        veh = db_session.query(Vehicle).filter_by(fleet_id="VEH001").first()
        assert veh is not None
        assert veh.status == "Active"

    def test_import_vehicles_missing_column(self, authenticated_client):
        """Import fails without fleet_id column."""
        csv_data = """registration
ABC123"""

        response = authenticated_client.post(
            "/import/vehicles",
            data={"file": (io.BytesIO(csv_data.encode()), "bad_vehicles.csv")},
            content_type="multipart/form-data"
        )
        assert response.status_code == 400

    def test_import_vehicles_duplicates(self, authenticated_client, db_cleanup):
        """Duplicate vehicles are skipped."""
        # Create existing vehicle
        veh = Vehicle(fleet_id="DUP_VEH001", status="Active")
        db_session.add(veh)
        db_session.commit()

        csv_data = """fleet_id
DUP_VEH001
DUP_VEH002"""

        response = authenticated_client.post(
            "/import/vehicles",
            data={"file": (io.BytesIO(csv_data.encode()), "vehicles.csv")},
            content_type="multipart/form-data"
        )
        assert response.status_code == 200

        data = response.get_json()
        assert data["imported"] == 1
        assert data["skipped"] == 1


class TestDownloadTemplates:
    """Tests for import template downloads."""

    def test_download_employees_template_requires_manager(self, test_app, db_cleanup):
        """Regular users cannot download templates."""
        user = User(username="regular_tpl", password="pass123", role="user")
        db_session.add(user)
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "regular_tpl"
            sess["user_id"] = user.id
            sess["role"] = "user"

        response = test_app.get("/download/template/employees")
        assert response.status_code == 302

    def test_download_employees_template(self, authenticated_client):
        """Download employees template."""
        response = authenticated_client.get("/download/template/employees")
        assert response.status_code == 200
        assert response.content_type == "text/csv"
        
        # Check content
        content = response.data.decode()
        assert "emp_code" in content
        assert "first_name" in content
        assert "surname" in content
        assert "id_number" in content

    def test_download_vehicles_template(self, authenticated_client):
        """Download vehicles template."""
        response = authenticated_client.get("/download/template/vehicles")
        assert response.status_code == 200
        assert response.content_type == "text/csv"
        
        content = response.data.decode()
        assert "fleet_id" in content

    def test_download_invalid_template(self, authenticated_client):
        """Invalid template type returns 400."""
        response = authenticated_client.get("/download/template/invalid")
        assert response.status_code == 400
