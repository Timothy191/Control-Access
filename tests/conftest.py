"""
Pytest configuration and test fixtures for Control-Access system.
"""

import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from datetime import datetime, timedelta

# Set testing environment variables before importing app
os.environ["FLASK_ENV"] = "testing"
os.environ["SECRET_KEY"] = "test-secret-key-32-chars-long-string-12345"
os.environ["HARDWARE_API_KEY"] = "test-hardware-key-1234"
os.environ["FIELD_ENCRYPTION_KEY"] = "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI="
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from database import Base, engine, db_session
import models
from app import app as flask_app


@pytest.fixture(scope="session")
def app():
    """Create and configure a Flask app instance for testing."""
    flask_app.config.update({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SECRET_KEY": os.environ["SECRET_KEY"],
    })
    return flask_app


@pytest.fixture(scope="function")
def db_engine():
    """Create fresh database tables for each test function."""
    Base.metadata.create_all(bind=engine)
    yield engine
    db_session.remove()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def session(db_engine):
    """Provide a clean database session for each test."""
    yield db_session
    db_session.remove()


@pytest.fixture
def client(app, session):
    """Provide a test client for sending HTTP requests."""
    return flask_app.test_client()


@pytest.fixture
def runner(app):
    """Provide a test CLI runner."""
    return flask_app.test_cli_runner()


@pytest.fixture
def sample_admin(session):
    """Fixture to create a sample admin user."""
    admin = models.User(username="admin", role="admin")
    admin.set_password("AdminPass123!")
    session.add(admin)
    session.commit()
    return admin


@pytest.fixture
def sample_employee(session):
    """Fixture to create an active employee with a valid QR code."""
    emp = models.Employee(
        emp_code="EMP001",
        first_name="John",
        surname="Doe",
        qr_code="QR_EMP_001",
        status="Active",
        induction_expiry=datetime.utcnow() + timedelta(days=30),
        medical_expiry=datetime.utcnow() + timedelta(days=30),
    )
    emp.set_id_number("9001015000080")
    session.add(emp)
    session.commit()
    return emp


@pytest.fixture
def sample_visitor(session):
    """Fixture to create an approved visitor with a valid QR code."""
    vis = models.Visitor(
        name="Jane Smith",
        company="Mining Supplies Co",
        purpose="Site Inspection",
        qr_code="QR_VIS_001",
        status="Approved",
    )
    session.add(vis)
    session.commit()
    return vis
