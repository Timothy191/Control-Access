"""
Integration tests for Flask API routes and health monitoring endpoints.
"""

import os
import json
import pytest


def test_health_check_endpoint(client):
    """Test public health check endpoint returns 200 OK."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert "version" in data


def test_api_scan_qr_requires_api_key(client):
    """Test that /api/scan_qr requires a valid X-API-Key header."""
    # Request without X-API-Key header
    res_no_key = client.post(
        "/api/scan_qr",
        data=json.dumps({"qr_code": "TEST"}),
        content_type="application/json",
    )
    assert res_no_key.status_code in (401, 403)


def test_api_scan_qr_with_valid_key(client, sample_employee):
    """Test successful QR scan processing via /api/scan_qr with valid X-API-Key."""
    hardware_key = os.environ.get("HARDWARE_API_KEY", "test-hardware-key-1234")
    
    res = client.post(
        "/api/scan_qr",
        headers={"X-API-Key": hardware_key},
        data=json.dumps({"qr_code": "QR_EMP_001", "gate_location": "Main Gate"}),
        content_type="application/json",
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["entity_type"] == "employee"


def test_ai_status_with_authenticated_session(client, monkeypatch):
    """Test /api/ai/status reports cloud provider when configured."""
    monkeypatch.setattr("routes.ai.GEMINI_API_KEY", "test-gemini-key")
    monkeypatch.setattr("routes.ai.GEMINI_MODEL", "gemini-2.5-flash")
    with client.session_transaction() as sess:
        sess["logged_in"] = True
        sess["username"] = "admin"
        sess["role"] = "admin"

    res = client.get("/api/ai/status")
    assert res.status_code == 200
    data = res.get_json()
    assert data["available"] is True
    assert data["provider"] == "gemini"
    assert "gemini" in data["model"]


def test_qr_scanner_template_renders_hardware_key(client, app):
    """Test that qr_scanner template renders the configured HARDWARE_API_KEY."""
    from flask import render_template
    with app.test_request_context():
        html = render_template("qr_scanner.html")
        assert "test-hardware-key-1234" in html

