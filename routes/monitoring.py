"""Monitoring and system health routes."""
import os
import time
from datetime import UTC, datetime

from flask import Blueprint, jsonify, render_template

from extensions import (
    PSUTIL_AVAILABLE,
    __version__,
    metrics_history,
    parse_log_line,
    request_timestamps,
)
from models import Approval, Employee, GateLog, Vehicle, Visitor
from utils import db_session, login_required, role_required

if PSUTIL_AVAILABLE:
    import psutil

monitoring_bp = Blueprint("monitoring", __name__)

_monitoring_stats_cache = {"data": None, "ts": 0}


def invalidate_monitoring_cache():
    """Clear the monitoring stats cache. Call when entity data changes."""
    _monitoring_stats_cache["data"] = None
    _monitoring_stats_cache["ts"] = 0


@monitoring_bp.route("/monitoring")
@login_required
@role_required(["admin"])
def monitoring():
    """System monitoring dashboard with real-time graphs."""
    return render_template("monitoring.html")


@monitoring_bp.route("/api/monitoring/stats")
@login_required
@role_required(["admin"])
def api_monitoring_stats():
    """Get current system stats for monitoring dashboard.
    DB queries are cached for 5 seconds to reduce load; system stats are always fresh."""
    try:
        # Get system stats with fallback if psutil not available (always fresh)
        if PSUTIL_AVAILABLE:
            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
            sys_stats = {
                "cpu": cpu_percent,
                "memory_percent": memory.percent,
                "memory_used": round(memory.used / (1024**3), 2),
                "memory_total": round(memory.total / (1024**3), 2),
                "disk_percent": disk.percent,
                "disk_used": round(disk.used / (1024**3), 2),
                "disk_total": round(disk.total / (1024**3), 2),
                "uptime": get_system_uptime(),
            }
        else:
            sys_stats = {
                "cpu": 0,
                "memory_percent": 0,
                "memory_used": 0,
                "memory_total": 0,
                "disk_percent": 0,
                "disk_used": 0,
                "disk_total": 0,
                "uptime": "N/A (psutil not installed)",
            }

        # Calculate requests per second
        now = time.time()
        recent_requests = [ts for ts in request_timestamps if now - ts < 60]
        req_per_sec = len(recent_requests) / 60.0 if recent_requests else 0

        # Update history (always, even if DB stats are cached)
        metrics_history["cpu"].append(sys_stats["cpu"])
        metrics_history["memory"].append(sys_stats["memory_percent"])
        metrics_history["requests"].append(req_per_sec)
        metrics_history["timestamps"].append(datetime.now().strftime("%H:%M:%S"))

        # Cache DB stats for 5 seconds to reduce query load
        _now = time.time()
        if (
            _monitoring_stats_cache["data"]
            and (_now - _monitoring_stats_cache["ts"]) < 5
        ):
            db_stats = _monitoring_stats_cache["data"]
        else:
            # Get database stats
            today = datetime.now().date()
            today_start = datetime.combine(today, datetime.min.time())

            db_stats = {
                "employees": db_session.query(Employee).count(),
                "vehicles": db_session.query(Vehicle).count(),
                "visitors": db_session.query(Visitor)
                .filter_by(status="Checked In")
                .count(),
                "pending_approvals": db_session.query(Approval)
                .filter_by(status="Pending")
                .count(),
                "today_scans": db_session.query(GateLog)
                .filter(GateLog.scanned_at >= today_start)
                .count(),
                "today_granted": db_session.query(GateLog)
                .filter(
                    GateLog.scanned_at >= today_start, GateLog.access_granted.is_(True)
                )
                .count(),
                "today_denied": db_session.query(GateLog)
                .filter(
                    GateLog.scanned_at >= today_start, GateLog.access_granted.is_(False)
                )
                .count(),
            }
            _monitoring_stats_cache["data"] = db_stats
            _monitoring_stats_cache["ts"] = _now

        stats = {
            "system": sys_stats,
            "app": {
                "requests_per_sec": round(req_per_sec, 2),
                "total_requests": len(request_timestamps),
                "endpoints": dict(
                    sorted(
                        metrics_history["endpoints"].items(),
                        key=lambda x: x[1],
                        reverse=True,
                    )[:10]
                ),
            },
            "database": db_stats,
            "scan_stats": dict(metrics_history["scan_stats"]),
            "history": {
                "cpu": list(metrics_history["cpu"]),
                "memory": list(metrics_history["memory"]),
                "requests": list(metrics_history["requests"]),
                "timestamps": list(metrics_history["timestamps"]),
            },
        }
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@monitoring_bp.route("/api/monitoring/logs")
@login_required
@role_required(["admin"])
def api_monitoring_logs():
    """Get recent server logs."""
    log_file = os.path.join(os.path.dirname(__file__), "..", "server.log")
    logs = []

    try:
        if os.path.exists(log_file):
            with open(log_file, errors="replace") as f:
                lines = f.readlines()
                # Get last 100 lines
                for line in lines[-100:]:
                    line = line.strip()
                    if line:
                        logs.append(parse_log_line(line))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"logs": logs[-50:]})


@monitoring_bp.route("/api/monitoring/health")
@login_required
def api_health_check():
    """Health check endpoint for all major services."""
    checks = []

    # Database check
    try:
        db_session.query(Employee).first()
        checks.append({"name": "Database", "status": "healthy", "response_time": 0})
    except Exception as e:
        checks.append({"name": "Database", "status": "unhealthy", "error": str(e)})

    # Key endpoints check
    endpoints = ["/", "/dashboard", "/employees", "/gate_logs"]
    for endpoint in endpoints:
        try:
            from app import app
            start = time.time()
            # Use test client for internal checks
            with app.test_client() as client:
                response = client.get(endpoint, follow_redirects=False)
            elapsed = (time.time() - start) * 1000
            checks.append(
                {
                    "name": f"Endpoint {endpoint}",
                    "status": "healthy"
                    if response.status_code in [200, 302]
                    else "degraded",
                    "response_time": round(elapsed, 2),
                    "status_code": response.status_code,
                }
            )
        except Exception as e:
            checks.append(
                {"name": f"Endpoint {endpoint}", "status": "unhealthy", "error": str(e)}
            )

    return jsonify({"checks": checks, "timestamp": datetime.now().isoformat()})


@monitoring_bp.route("/api/time/sync")
def api_time_sync():
    """Time sync endpoint - returns current server time for web/client synchronization."""

    now = datetime.now(UTC)
    return jsonify(
        {
            "utc_timestamp": now.isoformat(),
            "unix_timestamp": now.timestamp(),
            "server_time": now.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "timezone": "UTC",
        }
    )


@monitoring_bp.route("/api/time/status")
@login_required
def api_time_status():
    """Detailed time status for monitoring dashboard."""

    now = datetime.now(UTC)

    # Get system time info
    try:
        import subprocess

        result = subprocess.run(
            ["timedatectl", "status"], capture_output=True, text=True
        )
        system_time_info = result.stdout
    except Exception:
        system_time_info = "timedatectl not available"

    return jsonify(
        {
            "server_utc": now.isoformat(),
            "server_local": datetime.now().isoformat(),
            "system_time_info": system_time_info,
            "sync_enabled": True,
            "timezone": "UTC",
        }
    )


@monitoring_bp.route("/healthz")
@monitoring_bp.route("/health")
@monitoring_bp.route("/api/health")
def healthz():
    """Lightweight health-check endpoint for load balancers and uptime monitors."""
    try:
        db_session.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    status = "ok" if db_ok else "degraded"
    code = 200 if db_ok else 503
    return jsonify(
        {"status": status, "version": __version__, "db": "ok" if db_ok else "error"}
    ), code


def get_system_uptime():
    """Get system uptime in human readable format."""
    if not PSUTIL_AVAILABLE:
        return "N/A"
    try:
        boot_time = datetime.fromtimestamp(psutil.boot_time())
        uptime = datetime.now() - boot_time
        hours, remainder = divmod(int(uptime.total_seconds()), 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{hours}h {minutes}m"
    except Exception:
        return "Unknown"
