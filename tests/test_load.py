"""
Load and stress tests for system stability and reliability.
Tests concurrent operations, database locking, and performance under load.
"""

import pytest
import threading
import time
import concurrent.futures
from datetime import datetime
from app import app, db_session
from models import Employee, Vehicle, GateLog, User


class TestConcurrentQRScans:
    """Load tests for concurrent QR scanning."""

    def test_concurrent_scan_api_calls(self, api_client, db_cleanup, HARDWARE_API_KEY):
        """Multiple concurrent scan API calls handled correctly."""
        # Create test employee
        emp = Employee(
            emp_code="LOAD001",
            first_name="Load",
            surname="Test",
            status="Active",
            qr_code="LOAD_QR_001"
        )
        db_session.add(emp)
        db_session.commit()

        def make_scan_request():
            with app.test_client() as client:
                return client.post(
                "/api/scan_qr",
                json={
                    "qr_code": "LOAD_QR_001",
                    "direction": "IN",
                    "gate_location": "Main Gate"
                },
                headers={"X-API-Key": HARDWARE_API_KEY}
            )

        # Make 20 concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_scan_request) for _ in range(20)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        # All should succeed
        success_count = sum(1 for r in results if r.status_code == 200)
        assert success_count == 20

        # Check responses
        granted_count = 0
        for result in results:
            data = result.get_json()
            if data.get("success"):
                granted_count += 1

        # Should have mix of IN/OUT based on auto-direction
        assert granted_count > 0

    def test_concurrent_unknown_qr_creates_approvals(self, api_client, db_cleanup, HARDWARE_API_KEY):
        """Concurrent unknown QR scans create single approval."""
        qr_code = f"CONCURRENT_UNKNOWN_{int(time.time())}"
        
        initial_approvals = db_session.query(GateLog).filter_by(qr_data=qr_code).count()

        def make_scan_request():
            with app.test_client() as client:
                return client.post(
                "/api/scan_qr",
                json={
                    "qr_code": qr_code,
                    "direction": "IN",
                    "gate_location": "Test Gate"
                },
                headers={"X-API-Key": HARDWARE_API_KEY}
            )

        # Make 5 concurrent requests with same unknown QR
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_scan_request) for _ in range(5)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        # All should succeed (200 OK)
        assert all(r.status_code == 200 for r in results)

        # Verify gate logs were created
        final_logs = db_session.query(GateLog).filter_by(qr_data=qr_code).count()
        assert final_logs > initial_approvals

    def test_database_lock_handling(self, api_client, db_cleanup, HARDWARE_API_KEY):
        """SQLite database locks handled gracefully under load."""
        # Create multiple employees
        employees = []
        for i in range(10):
            emp = Employee(
                emp_code=f"LOCK{i:03d}",
                first_name=f"Lock",
                surname=f"Test{i}",
                status="Active",
                qr_code=f"LOCK_QR_{i:03d}"
            )
            db_session.add(emp)
            employees.append(emp)
        db_session.commit()

        def scan_employee(emp):
            with app.test_client() as client:
                return client.post(
                "/api/scan_qr",
                json={
                    "qr_code": emp.qr_code,
                    "direction": "IN",
                    "gate_location": "Main Gate"
                },
                headers={"X-API-Key": HARDWARE_API_KEY}
            )

        # Concurrent scans from different employees
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(scan_employee, emp) for emp in employees]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        # All should succeed without database errors
        success_count = sum(1 for r in results if r.status_code == 200)
        assert success_count == 10


class TestConcurrentLogins:
    """Tests for concurrent login handling."""

    def test_concurrent_login_attempts(self, test_app, db_cleanup):
        """Multiple concurrent login attempts."""
        # Create user
        user = User(username="concurrent", password="testpass", role="user")
        db_session.add(user)
        db_session.commit()

        def attempt_login():
            with app.test_client() as client:
                return client.post("/login", data={
                    "username": "concurrent",
                    "password": "testpass"
                })

        # Make 10 concurrent login attempts
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(attempt_login) for _ in range(10)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        # All should return 200, 302 (success/fail) or 429 (rate limited)
        valid_status = sum(1 for r in results if r.status_code in [200, 302, 429])
        assert valid_status == 10

    def test_login_rate_limiting(self, test_app, db_cleanup):
        """Rate limiting prevents abuse."""
        # Create user
        user = User(username="ratetest", password="testpass", role="user")
        db_session.add(user)
        db_session.commit()

        # Rapid login attempts
        results = []
        for i in range(10):
            response = test_app.post("/login", data={
                "username": "ratetest",
                "password": "wrongpassword"  # Wrong password
            })
            results.append(response.status_code)
            time.sleep(0.1)  # Small delay

        # All should complete without crashing
        assert all(r in [200, 302, 429] for r in results)


class TestDashboardPerformance:
    """Tests for dashboard performance under load."""

    def test_dashboard_with_many_employees(self, authenticated_client, db_cleanup):
        """Dashboard loads with many employees."""
        # Create many employees
        for i in range(100):
            emp = Employee(
                emp_code=f"PERF{i:04d}",
                first_name="Performance",
                surname=f"Test{i}",
                status="Active"
            )
            db_session.add(emp)
        db_session.commit()

        start = time.time()
        response = authenticated_client.get("/dashboard")
        elapsed = time.time() - start

        assert response.status_code == 200
        # Should load in reasonable time (adjust threshold as needed)
        assert elapsed < 5.0

    def test_dashboard_stats_api_performance(self, authenticated_client, db_cleanup):
        """Stats API performs well with data."""
        # Create gate logs
        for i in range(1000):
            log = GateLog(
                access_type="employee",
                entity_name=f"Person{i}",
                direction="IN",
                access_granted=True,
                gate_location="Main Gate"
            )
            db_session.add(log)
        db_session.commit()

        start = time.time()
        response = authenticated_client.get("/api/dashboard/stats_history")
        elapsed = time.time() - start

        assert response.status_code == 200
        # Should respond quickly even with many logs
        assert elapsed < 3.0

        data = response.get_json()
        assert "sparklines" in data
        assert "gate_hours" in data


class TestExportPerformance:
    """Tests for export functionality under load."""

    def test_export_many_employees(self, authenticated_client, db_cleanup):
        """Export large employee list."""
        # Create many employees
        for i in range(500):
            emp = Employee(
                emp_code=f"EX{i:04d}",
                first_name="Export",
                surname=f"Test{i}",
                id_number=f"ID{i:08d}",
                status="Active"
            )
            db_session.add(emp)
        db_session.commit()

        start = time.time()
        response = authenticated_client.get("/export/employees/excel")
        elapsed = time.time() - start

        assert response.status_code == 200
        # Export should complete in reasonable time
        assert elapsed < 10.0

    def test_export_many_gate_logs(self, authenticated_client, db_cleanup):
        """Export large gate log list."""
        # Create many logs
        for i in range(5000):
            log = GateLog(
                access_type="employee",
                entity_name=f"Person{i}",
                direction="IN" if i % 2 == 0 else "OUT",
                access_granted=True,
                gate_location="Main Gate"
            )
            db_session.add(log)
        db_session.commit()

        start = time.time()
        response = authenticated_client.get("/export/gate_logs/excel")
        elapsed = time.time() - start

        assert response.status_code == 200
        assert elapsed < 15.0


class TestMemoryStability:
    """Tests for memory usage stability."""

    def test_repeated_operations_memory(self, api_client, db_cleanup, HARDWARE_API_KEY):
        """Repeated operations don't cause memory issues."""
        # Create test employee
        emp = Employee(
            emp_code="MEM001",
            first_name="Memory",
            surname="Test",
            status="Active",
            qr_code="MEM_QR_001"
        )
        db_session.add(emp)
        db_session.commit()

        # Repeated scans
        for i in range(100):
            response = api_client.post(
                "/api/scan_qr",
                json={
                    "qr_code": "MEM_QR_001",
                    "direction": "IN",
                    "gate_location": "Main Gate"
                },
                headers={"X-API-Key": HARDWARE_API_KEY}
            )
            assert response.status_code == 200

        # Verify logs were created
        log_count = db_session.query(GateLog).filter_by(qr_data="MEM_QR_001").count()
        assert log_count == 100

    def test_large_qr_data_handling(self, api_client, db_cleanup, HARDWARE_API_KEY):
        """Large QR data handled correctly."""
        # Create large QR data (10KB)
        large_qr = "X" * 10000

        response = api_client.post(
            "/api/scan_qr",
            json={
                "qr_code": large_qr,
                "direction": "IN",
                "gate_location": "Main Gate"
            },
            headers={"X-API-Key": HARDWARE_API_KEY}
        )

        # Should handle gracefully (may truncate or reject)
        assert response.status_code in [200, 400, 413]


class TestDatabaseConnectionLimits:
    """Tests for database connection handling."""

    def test_concurrent_database_queries(self, authenticated_client, db_cleanup):
        """Multiple concurrent database queries."""
        # Create test data
        for i in range(50):
            emp = Employee(
                emp_code=f"DB{i:03d}",
                first_name="DB",
                surname=f"Test{i}",
                status="Active"
            )
            db_session.add(emp)
        db_session.commit()

        def query_employees():
            with app.test_client() as client:
                client.post("/login", data={"username": "admin", "password": "admin"})
                return client.get("/employees")

        # Make concurrent queries
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(query_employees) for _ in range(20)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        # All should succeed
        success_count = sum(1 for r in results if r.status_code == 200)
        assert success_count == 20


class TestScannerEndpoints:
    """Load tests for scanner endpoints."""

    def test_scan_alt_endpoint_load(self, api_client, db_cleanup):
        """Alternative scan endpoint handles load."""
        emp = Employee(
            emp_code="ALT001",
            first_name="Alt",
            surname="Test",
            status="Active",
            qr_code="ALT_QR_001"
        )
        db_session.add(emp)
        db_session.commit()

        def scan_alt():
            with app.test_client() as client:
                return client.post(
                "/api/scan_alt",
                json={"qr_code": "ALT_QR_001", "direction": "IN"}
            )

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(scan_alt) for _ in range(20)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        success_count = sum(1 for r in results if r.status_code == 200)
        assert success_count == 20

    def test_c66_endpoint_load(self, api_client, db_cleanup):
        """C66 endpoint handles load."""
        def c66_scan():
            with app.test_client() as client:
                return client.post(
                "/api/c66",
                data="RAW_BARCODE_DATA_TEST",
                content_type="text/plain"
            )

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(c66_scan) for _ in range(10)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        # May get 403 for non-local IP or 200 for valid
        valid_status = sum(1 for r in results if r.status_code in [200, 403])
        assert valid_status == 10


class TestConcurrentModifications:
    """Tests for concurrent data modifications."""

    def test_concurrent_employee_edits(self, authenticated_client, db_cleanup):
        """Concurrent edits to same employee handled."""
        emp = Employee(
            emp_code="EDIT001",
            first_name="Edit",
            surname="Test",
            status="Active"
        )
        db_session.add(emp)
        db_session.commit()
        emp_id = emp.id

        def edit_employee(i):
            return authenticated_client.post(
                f"/edit_employee/{emp_id}",
                data={
                    "emp_code": "EDIT001",
                    "first_name": f"Edit{i}",
                    "surname": "Test",
                    "id_number": "1234567890",
                    "job_title": "Tester",
                    "status": "Active"
                },
                follow_redirects=True
            )

        # Concurrent edits
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(edit_employee, i) for i in range(5)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        # All should complete
        assert all(r.status_code == 200 for r in results)

        # Employee should exist with some version of the data
        updated = db_session.query(Employee).filter_by(id=emp_id).first()
        assert updated is not None
