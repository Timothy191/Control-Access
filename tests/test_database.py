"""
Unit tests for database initialization, admin password persistence, and field encryption.
"""

import os
import pytest
from database import init_db, db_session, _reencrypt_plaintext_pii
from models import User, Employee, Visitor, EncryptedString


def test_init_db_admin_user_preserves_password(session, monkeypatch):
    """Test that init_db creates admin user on first run but does NOT overwrite password on restart."""
    monkeypatch.setenv("ADMIN_PASSWORD", "InitialAdminPass123!")
    monkeypatch.setenv("RESET_ADMIN_PASSWORD", "false")

    # Initial call creates admin user
    init_db()

    admin = db_session.query(User).filter_by(username="admin").first()
    assert admin is not None
    assert admin.check_password("InitialAdminPass123!") is True

    # User changes their password in production
    admin.set_password("CustomUserChangedPass456!")
    db_session.commit()

    # Second init_db call (e.g. app restart)
    init_db()

    admin_after_restart = db_session.query(User).filter_by(username="admin").first()
    # Ensure custom password is preserved, NOT overwritten back to ADMIN_PASSWORD env var!
    assert admin_after_restart.check_password("CustomUserChangedPass456!") is True


def test_init_db_admin_user_reset_flag(session, monkeypatch):
    """Test that init_db resets admin password only when RESET_ADMIN_PASSWORD=true is set."""
    monkeypatch.setenv("ADMIN_PASSWORD", "ResetNewPass789!")
    monkeypatch.setenv("RESET_ADMIN_PASSWORD", "true")

    admin = User(username="admin", role="admin")
    admin.set_password("OldPassword123!")
    session.add(admin)
    session.commit()

    init_db()

    admin_updated = db_session.query(User).filter_by(username="admin").first()
    assert admin_updated.check_password("ResetNewPass789!") is True


def test_pii_encryption_and_decryption(session):
    """Test AES-256 PII field-level encryption and decryption on Employee and Visitor."""
    emp = Employee(emp_code="EMP999", first_name="Secret", surname="Employee")
    emp.set_id_number("8001015000088")
    session.add(emp)
    session.commit()

    # Retrieve from DB
    retrieved = db_session.query(Employee).filter_by(emp_code="EMP999").first()
    assert retrieved.id_number == "8001015000088"
    assert retrieved.id_number_hash == Employee.hash_id_number("8001015000088")
