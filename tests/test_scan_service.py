"""
Unit and integration tests for services/scan_service.py
"""

import pytest
from datetime import datetime, timedelta

from services.scan_service import (
    _normalize_qr_hash,
    _lookup_employee_by_qr,
    _lookup_entity,
    _determine_access,
    process_qr_scan,
)
from models import Employee, Visitor, Vehicle, Equipment, GateLog


def test_normalize_qr_hash():
    """Test normalization of QR hashes from URLs, paths, and raw strings."""
    assert _normalize_qr_hash(None) is None
    assert _normalize_qr_hash("  RAW_HASH_123  ") == "RAW_HASH_123"
    assert _normalize_qr_hash("http://192.168.0.217:8080/scan/ABC123?ref=1") == "ABC123"
    assert _normalize_qr_hash("https://mine.com/s/XYZ789") == "XYZ789"
    assert _normalize_qr_hash("/scan/HASH456") == "HASH456"
    assert _normalize_qr_hash("/s/HASH123") == "HASH123"


def test_lookup_employee_by_qr(session, sample_employee):
    """Test employee lookup by QR code, emp_code, and plain ID fallback."""
    # Direct match on qr_code
    emp, qr = _lookup_employee_by_qr("QR_EMP_001")
    assert emp is not None
    assert emp.emp_code == "EMP001"

    # Match by emp_code fallback
    emp_by_code, _ = _lookup_employee_by_qr("EMP001")
    assert emp_by_code is not None
    assert emp_by_code.emp_code == "EMP001"

    # Non-existent QR
    emp_none, _ = _lookup_employee_by_qr("NON_EXISTENT_QR")
    assert emp_none is None


def test_lookup_entity(session, sample_employee, sample_visitor):
    """Test multi-entity lookup (Employee, Visitor, Vehicle, Equipment)."""
    # Lookup Employee
    entity, e_type, e_id, e_name = _lookup_entity("QR_EMP_001")
    assert e_type == "employee"
    assert e_id == sample_employee.id

    # Lookup Visitor
    entity_v, v_type, v_id, v_name = _lookup_entity("QR_VIS_001")
    assert v_type == "visitor"
    assert v_id == sample_visitor.id

    # Lookup Unknown
    entity_u, u_type, u_id, u_name = _lookup_entity("UNKNOWN")
    assert entity_u is None
    assert u_type is None


def test_determine_access_active_employee(session, sample_employee):
    """Test access determination for an active, valid employee."""
    emp_name = f"{sample_employee.first_name} {sample_employee.surname}"
    res = _determine_access(
        entity=sample_employee,
        entity_type="employee",
        entity_id=sample_employee.id,
        entity_name=emp_name,
        qr_hash="QR_EMP_001",
        direction=None,
        gate_location="Main Gate",
        scanned_by="kiosk",
        ip_address="127.0.0.1",
        user_agent="pytest",
        socketio=None,
    )

    assert res["access_granted"] is True
    assert res["denial_reason"] is None
    assert res["direction"] == "IN"


def test_determine_access_blacklisted_employee(session, sample_employee):
    """Test access denial for inactive/blocked employees."""
    sample_employee.status = "Inactive"
    session.commit()

    emp_name = f"{sample_employee.first_name} {sample_employee.surname}"
    res = _determine_access(
        entity=sample_employee,
        entity_type="employee",
        entity_id=sample_employee.id,
        entity_name=emp_name,
        qr_hash="QR_EMP_001",
        direction="IN",
        gate_location="Main Gate",
        scanned_by="kiosk",
        ip_address="127.0.0.1",
        user_agent="pytest",
        socketio=None,
    )

    assert res["access_granted"] is False
    assert res["denial_reason"] is not None


def test_determine_access_auto_direction_toggle(session, sample_employee):
    """Test auto-direction logic toggling from IN to OUT on subsequent scan."""
    emp_name = f"{sample_employee.first_name} {sample_employee.surname}"
    # First scan: IN
    res1 = _determine_access(
        entity=sample_employee,
        entity_type="employee",
        entity_id=sample_employee.id,
        entity_name=emp_name,
        qr_hash="QR_EMP_001",
        direction=None,
        gate_location="Main Gate",
        scanned_by="kiosk",
        ip_address="127.0.0.1",
        user_agent="pytest",
        socketio=None,
    )
    assert res1["direction"] == "IN"

    # Log successful IN scan
    log = GateLog(
        entity_id=sample_employee.id,
        access_type="employee",
        access_granted=True,
        direction="IN",
        gate_location="Main Gate",
    )
    session.add(log)
    session.commit()

    # Second scan: Should auto-detect OUT
    res2 = _determine_access(
        entity=sample_employee,
        entity_type="employee",
        entity_id=sample_employee.id,
        entity_name=emp_name,
        qr_hash="QR_EMP_001",
        direction=None,
        gate_location="Main Gate",
        scanned_by="kiosk",
        ip_address="127.0.0.1",
        user_agent="pytest",
        socketio=None,
    )
    assert res2["direction"] == "OUT"


def test_determine_access_visitor_lifecycle(session, sample_visitor):
    """Test full visitor lifecycle: Approved -> Gate IN (Checked In) -> Gate OUT (Checked Out) -> Denied."""
    # Approved visitor pass
    sample_visitor.status = "Approved"
    session.commit()

    res_in = _determine_access(
        entity=sample_visitor,
        entity_type="visitor",
        entity_id=sample_visitor.id,
        entity_name=sample_visitor.name,
        qr_hash=sample_visitor.qr_code,
        direction="IN",
        gate_location="Main Gate",
        scanned_by="kiosk",
        ip_address="127.0.0.1",
        user_agent="pytest",
        socketio=None,
    )
    assert res_in["access_granted"] is True

    # Simulate gate record side effect on IN scan
    sample_visitor.status = "Checked In"
    sample_visitor.check_in_time = datetime.utcnow()
    session.commit()

    # Visitor scanning OUT
    res_out = _determine_access(
        entity=sample_visitor,
        entity_type="visitor",
        entity_id=sample_visitor.id,
        entity_name=sample_visitor.name,
        qr_hash=sample_visitor.qr_code,
        direction="OUT",
        gate_location="Main Gate",
        scanned_by="kiosk",
        ip_address="127.0.0.1",
        user_agent="pytest",
        socketio=None,
    )
    assert res_out["access_granted"] is True

    # Simulate gate record side effect on OUT scan
    sample_visitor.status = "Checked Out"
    sample_visitor.check_out_time = datetime.utcnow()
    session.commit()

    # Subsequent scan after check-out should be denied
    res_denied = _determine_access(
        entity=sample_visitor,
        entity_type="visitor",
        entity_id=sample_visitor.id,
        entity_name=sample_visitor.name,
        qr_hash=sample_visitor.qr_code,
        direction="IN",
        gate_location="Main Gate",
        scanned_by="kiosk",
        ip_address="127.0.0.1",
        user_agent="pytest",
        socketio=None,
    )
    assert res_denied["access_granted"] is False
    assert "checked out" in res_denied["denial_reason"].lower()
