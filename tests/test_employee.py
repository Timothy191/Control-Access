import pytest
from app import app, db_session
from models import Employee


class TestEmployee:
    def test_employees_list_requires_login(self, test_app):
        response = test_app.get("/employees")
        assert response.status_code == 302
        assert "/login" in response.location

    def test_employees_list_authenticated(self, authenticated_client, sample_employee):
        response = authenticated_client.get("/employees")
        assert response.status_code == 200
        assert b"EMP001" in response.data
        assert b"John Doe" in response.data

    def test_add_employee(self, authenticated_client):
        response = authenticated_client.post(
            "/add_employee",
            data={
                "employee_id_field": "EMP002",
                "name": "Jane Smith",
                "position": "Manager",
                "department": "HR",
                "phone": "9876543210",
                "email": "jane@example.com",
                "status": "Active",
            },
            follow_redirects=True,
        )

        assert response.status_code == 200
        assert b"EMP002" in response.data
        assert b"Jane Smith" in response.data

    def test_edit_employee(self, authenticated_client, sample_employee):
        response = authenticated_client.post(
            f"/edit_employee/{sample_employee.id}",
            data={
                "employee_id_field": "EMP001",
                "name": "John Updated",
                "position": "Senior Engineer",
                "department": "Mining",
                "phone": "1234567890",
                "email": "john@example.com",
                "status": "Active",
            },
            follow_redirects=True,
        )

        assert response.status_code == 200
        assert b"John Updated" in response.data

    def test_delete_employee(self, authenticated_client, sample_employee):
        emp_id = sample_employee.id
        response = authenticated_client.get(
            f"/delete_employee/{emp_id}", follow_redirects=True
        )

        assert response.status_code == 200

        deleted = db_session.query(Employee).filter_by(id=emp_id).first()
        assert deleted is None

    def test_employees_list_shows_all_employees(
        self, authenticated_client, sample_employee
    ):
        emp2 = Employee(
            employee_id="EMP003",
            name="Bob Wilson",
            position="Technician",
            department="Operations",
            status="Active",
        )
        db_session.add(emp2)
        db_session.commit()

        response = authenticated_client.get("/employees")
        assert response.status_code == 200
        assert b"EMP001" in response.data
        assert b"EMP003" in response.data
