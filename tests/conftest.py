import os

import pytest

# Mock environment variables before importing app
os.environ["HARDWARE_API_KEY"] = "your-secret-hardware-key"

from app import app, db_session
from database import Base
from models import Employee, User, Vehicle, Visitor


@pytest.fixture(scope="function")
def test_app():
    app.config["TESTING"] = True
    app.config["SECRET_KEY"] = "test-secret-key"
    app.config["RATELIMIT_ENABLED"] = False

    from app import limiter
    limiter.enabled = False

    with app.test_client() as client:
        yield client

@pytest.fixture(scope="function")
def api_client(test_app):
    return test_app

@pytest.fixture
def HARDWARE_API_KEY():
    return "your-secret-hardware-key"


@pytest.fixture(scope="function")
def db_cleanup():
    # Clean before test to ensure fresh state
    db_session.rollback()
    for table in reversed(Base.metadata.sorted_tables):
        db_session.execute(table.delete())
    db_session.commit()
    yield
    # Clean after test
    db_session.rollback()
    for table in reversed(Base.metadata.sorted_tables):
        db_session.execute(table.delete())
    db_session.commit()


@pytest.fixture
def authenticated_client(test_app, db_cleanup):
    user = User.query.filter_by(username="admin").first()
    if not user:
        user = User(username="admin", role="admin")
        user.set_password("admin")
        db_session.add(user)
        db_session.commit()
    user_id = user.id

    with test_app.session_transaction() as sess:
        sess["logged_in"] = True
        sess["username"] = "admin"
        sess["user_id"] = user_id
        sess["role"] = "admin"

    return test_app


@pytest.fixture
def sample_employee(db_cleanup):
    emp = Employee(
        emp_code="EMP001",
        first_name="John",
        surname="Doe",
        id_number="1234567890",
        job_title="Engineer",
        status="Active",
    )
    db_session.add(emp)
    db_session.commit()
    return emp


@pytest.fixture
def sample_vehicle(db_cleanup):
    vehicle = Vehicle(
        fleet_id="ABC123",
        status="Active",
    )
    db_session.add(vehicle)
    db_session.commit()
    return vehicle


@pytest.fixture
def sample_visitor(db_cleanup, sample_employee):
    visitor = Visitor(
        name="Jane Visitor",
        company="ABC Corp",
        purpose="Meeting",
        host_id=sample_employee.id,
        status="Checked In",
    )
    db_session.add(visitor)
    db_session.commit()
    return visitor
