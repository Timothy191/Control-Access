import pytest
from app import app, db_session
from models import Vehicle


class TestVehicle:
    def test_fleet_list_requires_login(self, test_app):
        response = test_app.get("/fleet")
        assert response.status_code == 302
        assert "/login" in response.location

    def test_fleet_list_authenticated(self, authenticated_client, sample_vehicle):
        response = authenticated_client.get("/fleet")
        assert response.status_code == 200
        assert b"ABC123" in response.data

    def test_add_vehicle(self, authenticated_client):
        response = authenticated_client.post(
            "/add_vehicle",
            data={
                "fleet_id": "XYZ789",
                "registration_expiry": "2025-12-31",
                "status": "Active",
            },
            follow_redirects=True,
        )

        assert response.status_code == 200
        assert b"XYZ789" in response.data

    def test_edit_vehicle(self, authenticated_client, sample_vehicle):
        response = authenticated_client.post(
            f"/edit_vehicle/{sample_vehicle.id}",
            data={
                "fleet_id": "ABC123",
                "registration_expiry": "2025-06-30",
                "status": "Active",
            },
            follow_redirects=True,
        )

        assert response.status_code == 200

    def test_delete_vehicle(self, authenticated_client, sample_vehicle):
        veh_id = sample_vehicle.id
        response = authenticated_client.get(
            f"/delete_vehicle/{veh_id}", follow_redirects=True
        )

        assert response.status_code == 200

        deleted = db_session.query(Vehicle).filter_by(id=veh_id).first()
        assert deleted is None

    def test_fleet_list_shows_all_vehicles(self, authenticated_client, sample_vehicle):
        veh2 = Vehicle(
            fleet_id="DEF456",
            status="Active",
        )
        db_session.add(veh2)
        db_session.commit()

        response = authenticated_client.get("/fleet")
        assert response.status_code == 200
        assert b"ABC123" in response.data
        assert b"DEF456" in response.data