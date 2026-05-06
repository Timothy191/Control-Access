import pytest
from app import app, db_session
from models import Visitor, Employee


class TestVisitor:
    def test_visitors_list_requires_login(self, test_app):
        response = test_app.get("/visitors")
        assert response.status_code == 302
        assert "/login" in response.location

    def test_visitors_list_authenticated(self, authenticated_client, sample_visitor):
        response = authenticated_client.get("/visitors")
        assert response.status_code == 200
        assert b"Jane Visitor" in response.data
        assert b"ABC Corp" in response.data

    def test_checkin_visitor(self, authenticated_client, sample_employee):
        response = authenticated_client.post(
            "/checkin_visitor",
            data={
                "name": "New Visitor",
                "company": "XYZ Ltd",
                "purpose": "Site Tour",
                "host_id": sample_employee.id,
            },
            follow_redirects=True,
        )

        assert response.status_code == 200
        assert b"New Visitor" in response.data

    def test_checkout_visitor(self, authenticated_client, sample_visitor):
        visitor_id = sample_visitor.id
        response = authenticated_client.get(
            f"/checkout_visitor/{visitor_id}", follow_redirects=True
        )

        assert response.status_code == 200

        updated = db_session.query(Visitor).filter_by(id=visitor_id).first()
        assert updated.status == "Checked Out"

    def test_visitors_list_shows_checked_in_only_filter(
        self, authenticated_client, sample_visitor, sample_employee
    ):
        checked_out = Visitor(
            name="Checked Out Visitor",
            company="Old Corp",
            purpose="Meeting",
            host_id=sample_employee.id,
            status="Checked Out",
        )
        db_session.add(checked_out)
        db_session.commit()

        response = authenticated_client.get("/visitors")
        assert response.status_code == 200
        assert b"Jane Visitor" in response.data
