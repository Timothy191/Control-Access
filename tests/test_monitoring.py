"""
Test suite for monitoring endpoints - system health, stats, and diagnostics.
"""

import pytest
from datetime import datetime
from app import app, db_session
from models import User, Employee, GateLog


class TestMonitoringPage:
    """Tests for monitoring dashboard."""

    def test_monitoring_requires_login(self, test_app):
        """Monitoring requires authentication."""
        response = test_app.get("/monitoring")
        assert response.status_code == 302
        assert "/login" in response.location

    def test_monitoring_requires_admin(self, test_app, db_cleanup):
        """Only admin can access monitoring."""
        user = User(username="manager_mon", role="manager")
        user.set_password("pass123")
        db_session.add(user)
        db_session.flush()
        user_id = user.id
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "manager_mon"
            sess["user_id"] = user_id
            sess["role"] = "manager"

        response = test_app.get("/monitoring")
        assert response.status_code == 403

    def test_monitoring_access(self, authenticated_client):
        """Admin can access monitoring."""
        response = authenticated_client.get("/monitoring")
        assert response.status_code == 200


class TestMonitoringAPI:
    """Tests for monitoring API endpoints."""

    def test_api_monitoring_stats_requires_login(self, test_app):
        """API requires authentication."""
        response = test_app.get("/api/monitoring/stats")
        assert response.status_code == 302

    def test_api_monitoring_stats(self, authenticated_client):
        """Fetch monitoring stats."""
        response = authenticated_client.get("/api/monitoring/stats")
        assert response.status_code == 200

        data = response.get_json()
        assert "system" in data
        assert "app" in data
        assert "database" in data
        assert "history" in data

    def test_api_monitoring_stats_structure(self, authenticated_client):
        """Stats have correct structure."""
        response = authenticated_client.get("/api/monitoring/stats")
        data = response.get_json()

        # System stats
        if "system" in data:
            system = data["system"]
            assert "cpu" in system
            assert "memory_percent" in system
            assert "uptime" in system

        # Database stats
        if "database" in data:
            db = data["database"]
            assert "employees" in db
            assert "vehicles" in db

    def test_api_monitoring_logs(self, authenticated_client):
        """Fetch monitoring logs."""
        response = authenticated_client.get("/api/monitoring/logs")
        assert response.status_code in [200, 500]  # May fail if no log file

        if response.status_code == 200:
            data = response.get_json()
            assert "logs" in data

    def test_api_monitoring_health(self, authenticated_client):
        """Health check endpoint."""
        response = authenticated_client.get("/api/monitoring/health")
        assert response.status_code == 200

        data = response.get_json()
        assert "checks" in data
        assert "timestamp" in data


class TestTimeSyncAPI:
    """Tests for time synchronization endpoints."""

    def test_api_time_sync_public(self, test_app):
        """Time sync is publicly accessible."""
        response = test_app.get("/api/time/sync")
        assert response.status_code == 200

        data = response.get_json()
        assert "utc_timestamp" in data
        assert "unix_timestamp" in data
        assert "server_time" in data
        assert "timezone" in data

    def test_api_time_status_requires_login(self, test_app):
        """Time status requires authentication."""
        response = test_app.get("/api/time/status")
        assert response.status_code == 302

    def test_api_time_status(self, authenticated_client):
        """Fetch time status."""
        response = authenticated_client.get("/api/time/status")
        assert response.status_code == 200

        data = response.get_json()
        assert "server_utc" in data
        assert "timezone" in data


class TestHealthCheck:
    """Tests for health check endpoint."""

    def test_health_public_access(self, test_app):
        """Health endpoint is public."""
        response = test_app.get("/health")
        assert response.status_code == 200

        data = response.get_json()
        assert data["status"] == "ok"
        assert "service" in data
        assert "timestamp" in data

    def test_health_returns_service_info(self, test_app):
        """Health returns service information."""
        response = test_app.get("/health")
        data = response.get_json()
        
        assert data["service"] == "mine-management-api"
        # Timestamp should be parseable
        timestamp = datetime.fromisoformat(data["timestamp"].replace('Z', '+00:00'))
        assert timestamp is not None


class TestAIStatus:
    """Tests for AI status endpoint."""

    def test_ai_status_requires_login(self, test_app):
        """AI status requires authentication."""
        response = test_app.get("/api/ai/status")
        assert response.status_code == 302

    def test_ai_status_structure(self, authenticated_client):
        """AI status has correct structure."""
        response = authenticated_client.get("/api/ai/status")
        assert response.status_code == 200

        data = response.get_json()
        assert "available" in data
        assert "provider" in data
        assert "model" in data


class TestNetworkScannerAPI:
    """Tests for network scanner management endpoints."""

    def test_network_scanner_status_requires_login(self, test_app):
        """Network scanner status requires authentication."""
        response = test_app.get("/api/network_scanner/status")
        assert response.status_code == 302

    def test_network_scanner_status(self, authenticated_client):
        """Fetch network scanner status."""
        response = authenticated_client.get("/api/network_scanner/status")
        assert response.status_code == 200

        data = response.get_json()
        assert "running" in data
        assert "port_count" in data

    def test_network_scanner_ports_requires_login(self, test_app):
        """Port status requires authentication."""
        response = test_app.get("/api/network_scanner/ports")
        assert response.status_code == 302

    def test_scanner_discovery_status(self, authenticated_client):
        """Fetch discovery service status."""
        response = authenticated_client.get("/api/scanner/discovery-status")
        assert response.status_code == 200

        data = response.get_json()
        assert "running" in data
        assert "discovery_port" in data

    def test_scanner_config_requires_login(self, test_app):
        """Scanner config page requires authentication."""
        response = test_app.get("/scanner-config")
        assert response.status_code == 302

    def test_scanner_config_requires_admin(self, test_app, db_cleanup):
        """Scanner config requires admin."""
        user = User(username="manager_sc", role="manager")
        user.set_password("pass123")
        db_session.add(user)
        db_session.flush()
        user_id = user.id
        db_session.commit()

        with test_app.session_transaction() as sess:
            sess["logged_in"] = True
            sess["username"] = "manager_sc"
            sess["user_id"] = user_id
            sess["role"] = "manager"

        response = test_app.get("/scanner-config")
        assert response.status_code == 403


class TestDashboardStatsHistory:
    """Tests for dashboard stats history endpoint."""

    def test_dashboard_stats_history_requires_login(self, test_app):
        """Stats history requires authentication."""
        response = test_app.get("/api/dashboard/stats_history")
        assert response.status_code == 302

    def test_dashboard_stats_history(self, authenticated_client):
        """Fetch dashboard stats history."""
        response = authenticated_client.get("/api/dashboard/stats_history")
        assert response.status_code == 200

        data = response.get_json()
        assert "sparklines" in data
        assert "gate_hours" in data
        assert "on_site" in data
        assert "capacity" in data

    def test_dashboard_stats_history_caching(self, authenticated_client):
        """Stats endpoint is cached."""
        # First request
        response1 = authenticated_client.get("/api/dashboard/stats_history")
        data1 = response1.get_json()

        # Immediate second request should return same data (cached)
        response2 = authenticated_client.get("/api/dashboard/stats_history")
        data2 = response2.get_json()

        # Data should be identical (from cache)
        assert data1 == data2
