from app import db_session
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
        assert b"John" in response.data
        assert b"Doe" in response.data

    def test_add_employee(self, authenticated_client):
        response = authenticated_client.post(
            "/add_employee",
            data={
                "emp_code": "EMP002",
                "initials": "JS",
                "first_name": "Jane",
                "surname": "Smith",
                "id_number": "9876543210",
                "job_title": "Manager",
                "status": "Active",
            },
            follow_redirects=True,
        )

        assert response.status_code == 200
        assert b"EMP002" in response.data
        assert b"Jane" in response.data
        assert b"Smith" in response.data

    def test_edit_employee(self, authenticated_client, sample_employee):
        response = authenticated_client.post(
            f"/edit_employee/{sample_employee.id}",
            data={
                "emp_code": "EMP001",
                "first_name": "John",
                "surname": "Updated",
                "id_number": "1234567890",
                "job_title": "Senior Engineer",
                "status": "Active",
            },
            follow_redirects=True,
        )

        assert response.status_code == 200
        assert b"Updated" in response.data

    def test_delete_employee(self, authenticated_client, sample_employee):
        emp_id = sample_employee.id
        response = authenticated_client.post(
            f"/delete_employee/{emp_id}", follow_redirects=True
        )

        assert response.status_code == 200

        deleted = db_session.query(Employee).filter_by(id=emp_id).first()
        assert deleted is None

    def test_employees_list_shows_all_employees(
        self, authenticated_client, sample_employee
    ):
        emp2 = Employee(
            emp_code="EMP003",
            first_name="Bob",
            surname="Wilson",
            id_number="5555555555",
            job_title="Technician",
            status="Active",
        )
        db_session.add(emp2)
        db_session.commit()

        response = authenticated_client.get("/employees")
        assert response.status_code == 200
        assert b"EMP001" in response.data
        assert b"EMP003" in response.data
