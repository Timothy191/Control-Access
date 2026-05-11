"""
Test suite for equipment management - CRUD operations for equipment/radio devices.
"""

import pytest
from datetime import datetime, timedelta
from app import app, db_session
from models import Equipment, User


@pytest.fixture
def sample_equipment(db_cleanup):
    """Create sample equipment for testing."""
    item = Equipment(
        radio_id="RADIO001",
        status="Active"
    )
    db_session.add(item)
    db_session.commit()
    return item


class TestEquipmentList:
    """Tests for equipment listing page."""

    def test_equipment_list_requires_login(self, test_app):
        """Unauthenticated users redirected."""
        response = test_app.get("/equipment")
        assert response.status_code == 302
        assert "/login" in response.location

    def test_equipment_list_authenticated(self, authenticated_client, sample_equipment):
        """Authenticated users can view equipment."""
        response = authenticated_client.get("/equipment")
        assert response.status_code == 200
        assert b"RADIO001" in response.data

    def test_equipment_list_shows_all(self, authenticated_client, db_cleanup):
        """List displays all equipment."""
        # Create multiple items
        for i in range(3):
            item = Equipment(radio_id=f"RADIO{i:03d}", status="Active")
            db_session.add(item)
        db_session.commit()

        response = authenticated_client.get("/equipment")
        assert response.status_code == 200
        assert b"RADIO000" in response.data
        assert b"RADIO001" in response.data
        assert b"RADIO002" in response.data

    def test_equipment_empty_list(self, authenticated_client):
        """Empty list handled gracefully."""
        # Ensure no equipment
        db_session.query(Equipment).delete()
        db_session.commit()

        response = authenticated_client.get("/equipment")
        assert response.status_code == 200


class TestAddEquipment:
    """Tests for adding equipment."""

    def test_add_equipment_requires_manager(self, test_app, db_cleanup):
        """Regular users cannot add equipment."""
        user = User(username="regular_eq", password="pass123", role="user")
        db_session.add(user)
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "regular_eq"
            sess["user_id"] = user.id
            sess["role"] = "user"

        response = test_app.post("/add_equipment", data={
            "radio_id": "NEW001",
            "status": "Active"
        })
        assert response.status_code == 302

    def test_add_equipment(self, authenticated_client, db_cleanup):
        """Manager can add equipment."""
        response = authenticated_client.post(
            "/add_equipment",
            data={
                "radio_id": "NEW_RADIO",
                "registration_expiry": "2025-12-31",
                "status": "Active"
            },
            follow_redirects=True
        )
        assert response.status_code == 200

        # Verify equipment was created
        item = db_session.query(Equipment).filter_by(radio_id="NEW_RADIO").first()
        assert item is not None
        assert item.status == "Active"

    def test_add_equipment_no_expiry(self, authenticated_client, db_cleanup):
        """Add equipment without expiry date."""
        response = authenticated_client.post(
            "/add_equipment",
            data={
                "radio_id": "NO_EXPIRY",
                "status": "Active"
            },
            follow_redirects=True
        )
        assert response.status_code == 200

        item = db_session.query(Equipment).filter_by(radio_id="NO_EXPIRY").first()
        assert item is not None
        assert item.registration_expiry is None

    def test_add_equipment_duplicate_id(self, authenticated_client, sample_equipment):
        """Cannot add duplicate radio_id."""
        initial_count = db_session.query(Equipment).count()

        # Try to add duplicate
        authenticated_client.post(
            "/add_equipment",
            data={
                "radio_id": "RADIO001",  # Same as sample_equipment
                "status": "Active"
            },
            follow_redirects=True
        )

        # Verify no duplicate was created
        final_count = db_session.query(Equipment).count()
        assert final_count == initial_count

    def test_add_equipment_admin_can_add(self, authenticated_client):
        """Admin role can add equipment."""
        response = authenticated_client.post(
            "/add_equipment",
            data={
                "radio_id": "ADMIN_ADD",
                "status": "Active"
            },
            follow_redirects=True
        )
        assert response.status_code == 200

        item = db_session.query(Equipment).filter_by(radio_id="ADMIN_ADD").first()
        assert item is not None


class TestEditEquipment:
    """Tests for editing equipment."""

    def test_edit_equipment_requires_manager(self, test_app, sample_equipment):
        """Regular users cannot edit equipment."""
        user = User(username="regular_edit", password="pass123", role="user")
        db_session.add(user)
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "regular_edit"
            sess["user_id"] = user.id
            sess["role"] = "user"

        response = test_app.post(f"/edit_equipment/{sample_equipment.id}", data={
            "radio_id": "EDITED",
            "status": "Inactive"
        })
        assert response.status_code == 302

    def test_edit_equipment(self, authenticated_client, sample_equipment, db_cleanup):
        """Manager can edit equipment."""
        item_id = sample_equipment.id

        response = authenticated_client.post(
            f"/edit_equipment/{item_id}",
            data={
                "radio_id": "EDITED_RADIO",
                "registration_expiry": "2026-06-30",
                "status": "Inactive"
            },
            follow_redirects=True
        )
        assert response.status_code == 200

        # Verify changes
        updated = db_session.query(Equipment).filter_by(id=item_id).first()
        assert updated.radio_id == "EDITED_RADIO"
        assert updated.status == "Inactive"

    def test_edit_equipment_not_found(self, authenticated_client):
        """Editing non-existent equipment handled gracefully."""
        response = authenticated_client.post(
            "/edit_equipment/99999",
            data={
                "radio_id": "NONEXISTENT",
                "status": "Active"
            },
            follow_redirects=True
        )
        assert response.status_code == 200

    def test_edit_clear_expiry_date(self, authenticated_client, sample_equipment, db_cleanup):
        """Clear expiry date when not provided."""
        # Set expiry first
        sample_equipment.registration_expiry = datetime(2025, 12, 31)
        db_session.commit()

        # Edit without expiry
        authenticated_client.post(
            f"/edit_equipment/{sample_equipment.id}",
            data={
                "radio_id": sample_equipment.radio_id,
                "status": "Active"
            },
            follow_redirects=True
        )

        updated = db_session.query(Equipment).filter_by(id=sample_equipment.id).first()
        assert updated.registration_expiry is None


class TestDeleteEquipment:
    """Tests for deleting equipment."""

    def test_delete_equipment_requires_admin(self, test_app, sample_equipment):
        """Non-admin cannot delete equipment."""
        user = User(username="manager_del", password="pass123", role="manager")
        db_session.add(user)
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "manager_del"
            sess["user_id"] = user.id
            sess["role"] = "manager"

        response = test_app.post(f"/delete_equipment/{sample_equipment.id}")
        assert response.status_code == 302

    def test_delete_equipment(self, authenticated_client, db_cleanup):
        """Admin can delete equipment."""
        item = Equipment(radio_id="DELETE_ME", status="Active")
        db_session.add(item)
        db_session.commit()
        item_id = item.id

        response = authenticated_client.post(
            f"/delete_equipment/{item_id}",
            follow_redirects=True
        )
        assert response.status_code == 200

        # Verify deletion
        deleted = db_session.query(Equipment).filter_by(id=item_id).first()
        assert deleted is None

    def test_delete_equipment_not_found(self, authenticated_client):
        """Deleting non-existent equipment handled gracefully."""
        response = authenticated_client.post(
            "/delete_equipment/99999",
            follow_redirects=True
        )
        assert response.status_code == 200


class TestEquipmentQRCode:
    """Tests for equipment QR code generation."""

    def test_generate_equipment_qr(self, authenticated_client, sample_equipment):
        """Generate QR code for equipment."""
        response = authenticated_client.get(f"/generate_qr/equipment/{sample_equipment.id}")
        assert response.status_code == 200
        assert response.content_type == "image/png"

    def test_generate_qr_creates_qr_code(self, authenticated_client, sample_equipment):
        """QR generation assigns qr_code to equipment."""
        # Ensure no QR code initially
        assert sample_equipment.qr_code is None

        response = authenticated_client.get(f"/generate_qr/equipment/{sample_equipment.id}")
        assert response.status_code == 200

        # Verify QR code was assigned
        db_session.refresh(sample_equipment)
        assert sample_equipment.qr_code is not None
        assert len(sample_equipment.qr_code) == 32  # SHA256[:32]

    def test_generate_qr_not_found(self, authenticated_client):
        """QR generation for non-existent equipment returns 404."""
        response = authenticated_client.get("/generate_qr/equipment/99999")
        assert response.status_code == 404

    def test_generate_qr_invalid_type(self, authenticated_client):
        """Invalid entity type returns 400."""
        response = authenticated_client.get("/generate_qr/invalid/1")
        assert response.status_code == 400


class TestEquipmentExport:
    """Tests for equipment export functionality."""

    def test_export_equipment_excel(self, authenticated_client, sample_equipment):
        """Export equipment to Excel."""
        response = authenticated_client.get("/export/equipment/excel")
        assert response.status_code == 200
        assert response.content_type in [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/octet-stream"
        ]

    def test_export_equipment_pdf(self, authenticated_client, sample_equipment):
        """Export equipment to PDF."""
        response = authenticated_client.get("/export/equipment/pdf")
        assert response.status_code == 200
        assert response.content_type == "application/pdf"

    def test_export_qr_zip(self, authenticated_client, sample_equipment):
        """Export equipment QR codes as ZIP."""
        # Generate QR first
        authenticated_client.get(f"/generate_qr/equipment/{sample_equipment.id}")

        response = authenticated_client.get("/export/equipment/qr-zip")
        assert response.status_code == 200
        assert response.content_type == "application/zip"

    def test_export_qr_zip_no_equipment(self, authenticated_client):
        """Export QR zip with no equipment returns 404."""
        # Delete all equipment
        db_session.query(Equipment).delete()
        db_session.commit()

        response = authenticated_client.get("/export/equipment/qr-zip")
        assert response.status_code == 404

    def test_export_qr_zip_no_qr_codes(self, authenticated_client, sample_equipment):
        """Export QR zip with no QR codes returns 404."""
        # Ensure no QR codes
        sample_equipment.qr_code = None
        db_session.commit()

        response = authenticated_client.get("/export/equipment/qr-zip")
        assert response.status_code == 404
