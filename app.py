import eventlet

eventlet.monkey_patch()

import logging
import logging.handlers
from datetime import UTC, datetime, timedelta
from functools import wraps

from flask import (
    Flask,
    Response,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    send_file,
    session,
    url_for,
)
from flask_cors import CORS
from flask_socketio import SocketIO, emit

from database import db_session, init_db
from models import (
    Approval,
    AuditLog,
    Device,
    Employee,
    Equipment,
    GateLog,
    GateMapping,
    SiteSetting,
    User,
    Vehicle,
    Visitor,
)


def _utcnow():
    """Return current UTC as naive datetime (SQLite compat, no deprecation warning)."""
    return datetime.now(UTC).replace(tzinfo=None)


import hashlib
import io
import json
import os
import re
import select
import socket
import subprocess
import sys
import threading
import time

import openpyxl
import qrcode
import requests
from barcode.codex import Code128
from barcode.writer import ImageWriter

try:
    import psutil

    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
import base64
import re as _re

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import inch, landscape, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func

# Sanitize strings for openpyxl (strip illegal XML characters)
_ILLEGAL_XML_CHARS = _re.compile(
    r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\ud800-\udfff\ufdd0-\ufdef\ufffe\uffff]"
)


def _sanitize_cell(value):
    """Remove illegal XML characters that openpyxl cannot write."""
    if isinstance(value, str):
        return _ILLEGAL_XML_CHARS.sub("", value)
    return value


# Load environment variables from .env file
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed, use system environment variables

# ------------------- Structured Logging -------------------
_LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
_LOG_FILE = os.environ.get("LOG_FILE", "")

logging.basicConfig(
    level=getattr(logging, _LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("mine_system")

if _LOG_FILE:
    _handler = logging.handlers.RotatingFileHandler(
        _LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=5
    )
    _handler.setFormatter(
        logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )
    logger.addHandler(_handler)

# ------------------- App Init -------------------
_secret_key = os.environ.get("SECRET_KEY")
_is_production = os.environ.get("FLASK_ENV", "production").lower() == "production"
if not _secret_key:
    if _is_production:
        raise RuntimeError(
            "SECRET_KEY environment variable is not set. "
            'Generate one with: python -c "import secrets; print(secrets.token_hex(32))" '
            "and add it to your .env file."
        )
    _secret_key = os.urandom(24).hex()
    logger.warning(
        "SECRET_KEY not set — using random key (sessions reset on restart). Set SECRET_KEY in .env"
    )

app = Flask(__name__)
app.secret_key = _secret_key
app.permanent_session_lifetime = timedelta(minutes=30)
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("HTTPS", "false").lower() == "true"
app.config["WTF_CSRF_TIME_LIMIT"] = 3600  # 1 hour CSRF token validity
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 43200  # 12 hour static asset cache

# Response compression (gzip/deflate)
from flask_compress import Compress

Compress(app)

# CSRF Protection (exempts API routes which use header-based auth)
from flask_wtf.csrf import CSRFError, CSRFProtect

app.config["WTF_CSRF_CHECK_DEFAULT"] = False  # We'll check manually, exempt /api/
csrf = CSRFProtect(app)


@app.before_request
def csrf_protect_non_api():
    """Apply CSRF check only to non-API POST/PUT/PATCH/DELETE requests."""
    if app.config.get("TESTING"):
        return
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        if not request.path.startswith("/api/"):
            csrf.protect()


@app.errorhandler(CSRFError)
def handle_csrf_error(e):
    return render_template(
        "login.html", error="Session expired. Please try again."
    ), 400


@app.after_request
def add_security_headers(response):
    """Add security headers to all responses."""
    # Content-Security-Policy (allow inline for CDN-loaded scripts)
    csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdn.socket.io https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://cdn.socket.io"
    response.headers["Content-Security-Policy"] = csp
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains"
    )
    return response


# Rate Limiting
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    get_remote_address, app=app, default_limits=[], storage_uri="memory://"
)

# Enable CORS for API endpoints (required for mobile scanner access)
# CORS configuration - restricted to production origins in production
# For development/debug allow localhost, production should be explicit
_cors_origins = os.environ.get(
    "CORS_ORIGINS", "*"
)  # Set CORS_ORIGINS env var to restrict
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": _cors_origins.split(",") if _cors_origins != "*" else "*",
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "X-API-Key", "X-CSRFToken"],
            "supports_credentials": True,
        }
    },
)

socketio = SocketIO(
    app, cors_allowed_origins=_cors_origins.split(",") if _cors_origins != "*" else "*"
)


# Custom Jinja2 filters
@app.template_filter("from_json")
def from_json_filter(value):
    """Parse JSON string to Python object."""
    if not value:
        return {}
    try:
        return json.loads(value)
    except (json.JSONDecodeError, ValueError):
        return {}


# Initialize database
init_db()


# ------------------- JSON Error Handlers -------------------
@app.errorhandler(404)
def json_404(error):
    return jsonify(
        {"error": "Not found", "message": "The requested resource was not found"}
    ), 404


@app.errorhandler(405)
def json_405(error):
    return jsonify(
        {
            "error": "Method not allowed",
            "message": "This HTTP method is not allowed for this endpoint",
        }
    ), 405


@app.errorhandler(500)
def json_500(error):
    return jsonify({"error": "Internal server error", "message": str(error)}), 500


# ------------------- Ollama Local AI Configuration -------------------
OLLAMA_BASE_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "mine-assistant-fast")
OLLAMA_MODEL_FULL = os.environ.get("OLLAMA_MODEL_FULL", "mine-assistant")
OLLAMA_CLOUD_URL = os.environ.get("OLLAMA_CLOUD_URL", "https://cloud.ollama.ai/api")
OLLAMA_CLOUD_API_KEY = os.environ.get("OLLAMA_CLOUD_API_KEY", "")
OLLAMA_USE_CLOUD = os.environ.get("OLLAMA_USE_CLOUD", "false").lower() == "true"
_ollama_provider = "local"  # "local", "cloud", or "offline"
_ollama_available = False
_ollama_checked = False

__version__ = "2.1.0"


def _check_ollama():
    """Check Ollama availability — tries cloud first if enabled, then local."""
    global _ollama_available, _ollama_checked, _ollama_provider
    if _ollama_checked:
        return _ollama_available
    _ollama_checked = True

    if OLLAMA_USE_CLOUD and OLLAMA_CLOUD_API_KEY:
        try:
            resp = requests.get(
                f"{OLLAMA_CLOUD_URL}/tags",
                headers={"Authorization": f"Bearer {OLLAMA_CLOUD_API_KEY}"},
                timeout=10,
            )
            if resp.status_code == 200:
                _ollama_provider = "cloud"
                _ollama_available = True
                print(f"Ollama Cloud AI initialized: model={OLLAMA_MODEL}")
                return True
        except Exception as e:
            print(
                f"WARNING: Ollama Cloud not reachable ({type(e).__name__}: {e}). Trying local..."
            )

    try:
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        if resp.status_code == 200:
            _models = [m["name"] for m in resp.json().get("models", [])]
            if any(OLLAMA_MODEL in m for m in _models):
                _ollama_provider = "local"
                _ollama_available = True
                print(
                    f"Ollama local AI initialized: model={OLLAMA_MODEL}, url={OLLAMA_BASE_URL}"
                )
            else:
                print(
                    f"WARNING: Ollama running but model '{OLLAMA_MODEL}' not found. Available: {_models}"
                )
    except Exception as _ollama_err:
        print(
            f"WARNING: Ollama not reachable ({type(_ollama_err).__name__}: {_ollama_err}). AI is offline."
        )
    return _ollama_available


# Try at startup (non-blocking if Ollama isn't ready yet)
_check_ollama()


# ------------------- Multi-Port Scanner Listener -------------------
# Listens on multiple UDP/TCP ports to catch scanners with various configurations
# Auto-discovers scanners on local network without pre-configured IP

# Network optimization settings
UDP_BUFFER_SIZE = 1024 * 1024  # 1MB buffer for high-throughput scanning
TCP_BACKLOG = 2048  # Increased TCP connection queue

UDP_PORTS = [5000, 8080, 9000, 9999, 10000]
TCP_PORTS = [80, 443, 3000, 8080]
SCAN_PORTS = UDP_PORTS + TCP_PORTS

udp_threads = []
tcp_threads = []
scanner_listener_running = False
broadcast_running = False
sniffer_running = False


# Optimize socket buffers at module load time
def optimize_socket_buffers():
    """Apply socket buffer optimizations for high-throughput scanning"""
    try:

        # Set UDP receive buffer size
        UDP_RCVBUF = 2 * 1024 * 1024  # 2MB
        2 * 1024 * 1024  # 2MB

        # These will be applied when sockets are created
        print(f"✓ Socket buffers configured: {UDP_RCVBUF // 1024}KB")
    except Exception as e:
        print(f"⚠ Socket optimization failed: {e}")


# Apply optimizations on module load
optimize_socket_buffers()


def get_broadcast_address():
    """Get the broadcast address for the local network"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        # Convert to broadcast address (e.g., 192.168.0.255)
        parts = local_ip.rsplit(".", 1)
        return f"{parts[0]}.255"
    except Exception:
        return "255.255.255.255"


def _ensure_device_exists(ip_address):
    """Auto-create device entry if scanning from unknown IP"""
    try:
        existing = db_session.query(Device).filter_by(ip_address=ip_address).first()
        if existing:
            existing.last_seen = _utcnow()
            existing.status = "online"
        else:
            device = Device(
                device_name=f"Scanner-{ip_address}",
                device_type="Unknown",
                ip_address=ip_address,
                status="pending",
            )
            db_session.add(device)
            print(f"NEW DEVICE: Auto-created pending device for IP {ip_address}")
        db_session.commit()
    except Exception as e:
        print(f"Error creating device: {e}")


def process_scan_data(qr_data, source_ip, protocol="UDP"):
    """Process scanned data from any scanner source"""
    try:
        qr_hash = qr_data.strip()
        if qr_hash.startswith("{") and qr_hash.endswith("}"):
            pass
        else:
            qr_hash = qr_hash.upper()

        # Filter: reject empty or absurdly long payloads only
        if len(qr_hash) < 2 or len(qr_hash) > 4096:
            return None

        direction = "IN"
        gate_location = f"{protocol} Scanner"
        scanned_by = f"{protocol.lower()}-{source_ip}"

        result = _process_qr_scan(
            qr_hash,
            direction,
            gate_location,
            scanned_by,
            source_ip,
            f"{protocol} Scanner",
        )

        # Auto-create device if not exists (for scanning from unknown IP)
        _ensure_device_exists(source_ip)

        print(
            f"SCAN ({protocol}): from {source_ip} -> {qr_hash[:20]}... granted={result['access_granted']} entity={result['entity_name']}"
        )

        socketio.emit(
            "scan_result",
            {
                "success": result["access_granted"],
                "message": result["denial_reason"],
                "entity_type": result["entity_type"],
                "entity_name": result["entity_name"],
                "direction": direction,
                "scanner": source_ip,
                "protocol": protocol,
            },
        )

        return result
    except Exception as e:
        print(f"Error processing {protocol} scan: {e}")
        return None


# ----- UDP Listener for Multiple Ports -----
def start_udp_listener(port):
    """Start UDP listener on a specific port"""

    def udp_server():
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            # Optimize socket for high-throughput scanning
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, UDP_BUFFER_SIZE)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, UDP_BUFFER_SIZE)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.settimeout(1.0)

            try:
                sock.bind(("0.0.0.0", port))
                print(f"UDP Listener started on port {port}")
            except OSError:
                print(f"WARNING: Could not bind UDP port {port}")
                return

            while scanner_listener_running:
                try:
                    data, addr = sock.recvfrom(4096)
                    if data:
                        scan_data = data.decode("utf-8", errors="ignore").strip()
                        if scan_data:
                            process_scan_data(scan_data, addr[0], "UDP")
                except TimeoutError:
                    continue
                except Exception:
                    if scanner_listener_running:
                        continue
        except Exception as e:
            print(f"UDP server on port {port} failed: {e}")

    thread = threading.Thread(target=udp_server, daemon=True)
    thread.start()
    return thread


# ----- Broadcast Address Listener -----
def start_broadcast_listener():
    """Listen on broadcast address for discovery"""
    broadcast_addr = get_broadcast_address()

    def broadcast_server():
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.settimeout(1.0)

            try:
                sock.bind(("0.0.0.0", 9999))
                print(f"Broadcast Listener started on {broadcast_addr}:9999")
            except OSError:
                print("WARNING: Could not bind broadcast port 9999")
                return

            while broadcast_running:
                try:
                    data, addr = sock.recvfrom(4096)
                    if data:
                        scan_data = data.decode("utf-8", errors="ignore").strip()
                        if scan_data:
                            print(f"BROADCAST from {addr[0]}: {scan_data}")
                            process_scan_data(scan_data, addr[0], "BROADCAST")
                except TimeoutError:
                    continue
                except Exception:
                    if broadcast_running:
                        continue
        except Exception as e:
            print(f"Broadcast server failed: {e}")

    thread = threading.Thread(target=broadcast_server, daemon=True)
    thread.start()
    return thread


# ----- Packet Sniffer (Requires Root/Sudo) -----
def start_packet_sniffer():
    """Passive packet sniffer to capture QR-like data from network traffic"""
    if os.geteuid() != 0:
        print(
            "WARNING: Packet sniffer requires root. Run with sudo for packet capture."
        )
        return None

    def sniffer():
        global sniffer_running
        try:
            ETH_P_ALL = 0x0003
            s = socket.socket(
                socket.AF_PACKET, socket.SOCK_RAW, socket.htons(ETH_P_ALL)
            )

            # Bind to common interfaces
            for iface in ["eth0", "enp0s3", "wlan0", "wlp2s0", "ens33"]:
                try:
                    s.bind((iface, 0))
                    print(f"Packet Sniffer bound to {iface}")
                    break
                except Exception:
                    continue
            else:
                print("WARNING: Could not bind to any network interface")
                return

            s.setblocking(False)
            sniffer_running = True
            print("Packet Sniffer started (capturing all traffic)")

            while sniffer_running:
                try:
                    packet, addr = s.recvfrom(65535)
                    if len(packet) > 14:
                        # Skip Ethernet header (14 bytes), look at payload
                        payload = packet[14:]

                        # Look for QR-like patterns in payload (alphanumeric strings)
                        # This is a simplified approach - checks for common QR formats
                        payload_str = payload.decode("utf-8", errors="ignore")

                        # Only match structured QR prefixes — bare alphanumeric removed (caused false positives)
                        patterns = [
                            r"EMP[:\s]+([A-Z0-9]{4,20})",
                            r"VEH[:\s]+([A-Z0-9]{4,20})",
                            r"VIS[:\s]+([A-Z0-9]{4,20})",
                        ]

                        for pattern in patterns:
                            matches = re.findall(pattern, payload_str, re.MULTILINE)
                            for match in matches:
                                if match and len(match) >= 4:
                                    print(f"PKT SNIFF: from {addr[0]}: {match}")
                                    process_scan_data(match, addr[0], "SNIFFER")

                except BlockingIOError:
                    continue
                except Exception:
                    if sniffer_running:
                        continue

        except Exception as e:
            print(f"Packet sniffer error: {e}")
        finally:
            sniffer_running = False
            print("Packet Sniffer stopped")

    thread = threading.Thread(target=sniffer, daemon=True)
    thread.start()
    return thread


# ----- Initialize All Listeners -----
def init_all_scanner_listeners():
    """Initialize and start all scanner listeners"""
    global scanner_listener_running, broadcast_running
    scanner_listener_running = True
    broadcast_running = True

    # Start multi-port UDP listeners
    for port in UDP_PORTS:
        try:
            t = start_udp_listener(port)
            udp_threads.append(t)
        except Exception as e:
            print(f"Failed to start UDP on port {port}: {e}")

    # Start broadcast listener
    try:
        t = start_broadcast_listener()
        udp_threads.append(t)
    except Exception as e:
        print(f"Failed to start broadcast: {e}")

    # Try to start packet sniffer (will fail without root)
    try:
        t = start_packet_sniffer()
        if t:
            udp_threads.append(t)
    except Exception as e:
        print(f"Packet sniffer not available: {e}")

    print(f"Scanner listeners initialized: UDP ports {UDP_PORTS}, broadcast enabled")


# ------------------- Decorators -------------------
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)

    return decorated_function


def role_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not session.get("logged_in"):
                return redirect(url_for("login"))
            if session.get("role") not in allowed_roles:
                return "Access denied", 403
            return f(*args, **kwargs)

        return decorated_function

    return decorator


def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        key = request.headers.get("X-API-Key")
        _hardware_key = os.environ.get("HARDWARE_API_KEY", "")
        _mobile_key = os.environ.get("MOBILE_API_KEY", "")
        valid_keys = [k for k in [_hardware_key, _mobile_key] if k]
        if not valid_keys:
            logger.warning(
                "HARDWARE_API_KEY not configured — API key auth is disabled. Set HARDWARE_API_KEY in .env"
            )
            return f(*args, **kwargs)
        if not key or key not in valid_keys:
            return jsonify({"error": "Invalid API key"}), 401
        return f(*args, **kwargs)

    return decorated


# ------------------- Audit Logging Helper -------------------
def log_audit(action, entity_type, entity_id=None, details=None):
    """Log an admin/user action to the audit trail."""
    try:
        entry = AuditLog(
            user=session.get("username", "system"),
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            ip_address=request.remote_addr if request else None,
        )
        db_session.add(entry)
        db_session.commit()
    except Exception:
        db_session.rollback()


# ------------------- Public routes -------------------
@app.route("/")
def index():
    if not session.get("logged_in"):
        return redirect(url_for("login"))
    return redirect(url_for("dashboard"))


@app.route("/login", methods=["GET", "POST"])
@limiter.limit("5 per minute", methods=["POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        user = db_session.query(User).filter_by(username=username).first()
        if user and user.check_password(password):
            # Auto-migrate plain-text password to hash on successful login
            if not user.password.startswith(("pbkdf2:", "scrypt:")):
                user.set_password(password)
                db_session.commit()
            session.permanent = True
            session["logged_in"] = True
            session["username"] = user.username
            session["user_id"] = user.id
            session["role"] = user.role
            log_audit("login", "user", user.id, f"User '{username}' logged in")
            return redirect(url_for("dashboard"))
        else:
            return render_template("login.html", error="Invalid credentials")
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ------------------- Visitor Request PIN (Admin) -------------------
@app.route("/admin/visitor_pin", methods=["POST"])
@login_required
@role_required(["admin"])
def update_visitor_pin():
    new_pin = request.form.get("new_pin", "").strip()
    if not new_pin:
        return redirect(url_for("visitors"))
    pin_setting = (
        db_session.query(SiteSetting).filter_by(key="visitor_request_pin").first()
    )
    if pin_setting:
        pin_setting.value = new_pin
    else:
        db_session.add(SiteSetting(key="visitor_request_pin", value=new_pin))
    db_session.commit()
    return redirect(url_for("visitors"))


# ------------------- Audit Logs (Admin) -------------------
@app.route("/admin/audit_logs")
@login_required
@role_required(["admin"])
def audit_logs():
    logs = (
        db_session.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(500).all()
    )
    return render_template("audit_logs.html", logs=logs)


# ------------------- User Management (Admin) -------------------
@app.route("/admin/users")
@login_required
@role_required(["admin"])
def manage_users():
    users = db_session.query(User).order_by(User.created_at.desc()).all()
    return render_template("users.html", users=users)


@app.route("/admin/users/add", methods=["POST"])
@login_required
@role_required(["admin"])
def add_user():
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "").strip()
    role = request.form.get("role", "user")
    if not username or not password:
        return redirect(url_for("manage_users"))
    existing = db_session.query(User).filter_by(username=username).first()
    if existing:
        return redirect(url_for("manage_users"))
    user = User(username=username, role=role)
    user.set_password(password)
    db_session.add(user)
    db_session.commit()
    log_audit("create", "user", user.id, f"Created user: {username} (role: {role})")
    return redirect(url_for("manage_users"))


@app.route("/admin/users/edit/<int:id>", methods=["POST"])
@login_required
@role_required(["admin"])
def edit_user(id):
    user = db_session.query(User).filter_by(id=id).first()
    if not user:
        return redirect(url_for("manage_users"))
    new_role = request.form.get("role", user.role)
    new_password = request.form.get("password", "").strip()
    user.role = new_role
    if new_password:
        user.set_password(new_password)
    db_session.commit()
    log_audit("update", "user", id, f"Updated user: {user.username} (role: {new_role})")
    return redirect(url_for("manage_users"))


@app.route("/admin/users/delete/<int:id>", methods=["POST"])
@login_required
@role_required(["admin"])
def delete_user(id):
    user = db_session.query(User).filter_by(id=id).first()
    if user and user.username != "admin":  # Prevent deleting the admin account
        name = user.username
        db_session.delete(user)
        db_session.commit()
        log_audit("delete", "user", id, f"Deleted user: {name}")
    return redirect(url_for("manage_users"))


# ------------------- Gate Mapping Management -------------------
@app.route("/admin/gate_mappings")
@login_required
@role_required(["admin"])
def gate_mappings():
    """Manage gate mappings - map scanner IPs to physical gate names."""
    mappings = db_session.query(GateMapping).order_by(GateMapping.gate_name).all()

    # Get unique IPs from recent gate logs that aren't mapped yet
    recent_ips = (
        db_session.query(GateLog.ip_address, GateLog.scanned_by)
        .filter(
            GateLog.ip_address.isnot(None),
            GateLog.scanned_at
            >= _utcnow().replace(day=1, hour=0, minute=0, second=0),  # This month
        )
        .distinct()
        .all()
    )

    # Filter out already mapped IPs
    mapped_ips = {m.ip_address for m in mappings}
    unmapped = []
    for ip, scanned_by in recent_ips:
        if ip and ip not in mapped_ips:
            unmapped.append({"ip": ip, "scanned_by": scanned_by})

    return render_template("gate_mappings.html", mappings=mappings, unmapped=unmapped)


@app.route("/admin/gate_mappings/add", methods=["POST"])
@login_required
@role_required(["admin"])
def add_gate_mapping():
    """Add a new gate mapping."""
    ip_address = request.form.get("ip_address", "").strip()
    gate_name = request.form.get("gate_name", "").strip()
    description = request.form.get("description", "").strip()

    if not ip_address or not gate_name:
        flash("IP address and gate name are required", "error")
        return redirect(url_for("gate_mappings"))

    # Check if IP already mapped
    existing = db_session.query(GateMapping).filter_by(ip_address=ip_address).first()
    if existing:
        existing.gate_name = gate_name
        existing.location_description = description
        existing.is_active = True
        db_session.commit()
        log_audit(
            "update",
            "gate_mapping",
            existing.id,
            f"Updated gate mapping: {ip_address} -> {gate_name}",
        )
        flash(f"Updated mapping for {ip_address}", "success")
    else:
        mapping = GateMapping(
            ip_address=ip_address, gate_name=gate_name, location_description=description
        )
        db_session.add(mapping)
        db_session.commit()
        log_audit(
            "create",
            "gate_mapping",
            mapping.id,
            f"Created gate mapping: {ip_address} -> {gate_name}",
        )
        flash(f"Added mapping: {ip_address} -> {gate_name}", "success")

    return redirect(url_for("gate_mappings"))


@app.route("/admin/gate_mappings/delete/<int:id>")
@login_required
@role_required(["admin"])
def delete_gate_mapping(id):
    """Delete a gate mapping."""
    mapping = db_session.query(GateMapping).filter_by(id=id).first()
    if mapping:
        ip = mapping.ip_address
        db_session.delete(mapping)
        db_session.commit()
        log_audit("delete", "gate_mapping", id, f"Deleted gate mapping for {ip}")
        flash(f"Deleted mapping for {ip}", "success")
    return redirect(url_for("gate_mappings"))


@app.route("/admin/gate_mappings/toggle/<int:id>")
@login_required
@role_required(["admin"])
def toggle_gate_mapping(id):
    """Toggle active/inactive status of a gate mapping."""
    mapping = db_session.query(GateMapping).filter_by(id=id).first()
    if mapping:
        mapping.is_active = not mapping.is_active
        db_session.commit()
        status = "enabled" if mapping.is_active else "disabled"
        log_audit(
            "update",
            "gate_mapping",
            id,
            f"{status.capitalize()} gate mapping for {mapping.ip_address}",
        )
        flash(f"Mapping {status} for {mapping.ip_address}", "success")
    return redirect(url_for("gate_mappings"))


# ------------------- Visitor QR Request (Public) -------------------
@app.route("/visitor_request", methods=["GET", "POST"])
def visitor_request():
    """Public page: visitors can request a QR pass without logging in."""
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        company = request.form.get("company", "").strip()
        purpose = request.form.get("purpose", "").strip()
        meeting_person = request.form.get("meeting_person", "").strip()

        if not name:
            if request.headers.get("X-Requested-With") == "XMLHttpRequest":
                return jsonify({"success": False, "error": "Visitor name is required."})
            return render_template(
                "visitor_request.html", error="Visitor name is required."
            )

        # Validate department PIN
        submitted_pin = request.form.get("pin", "").strip()
        pin_setting = (
            db_session.query(SiteSetting).filter_by(key="visitor_request_pin").first()
        )
        expected_pin = pin_setting.value if pin_setting else "1234"
        if submitted_pin != expected_pin:
            if request.headers.get("X-Requested-With") == "XMLHttpRequest":
                return jsonify({"success": False, "error": "Invalid PIN. Contact your HOD or admin."})
            return render_template(
                "visitor_request.html", error="Invalid PIN. Contact your HOD or admin."
            )

        visitor = Visitor(
            name=name,
            company=company,
            purpose=purpose,
            meeting_person=meeting_person,
            status="Pending Approval",
        )
        db_session.add(visitor)
        db_session.flush()

        # Generate QR code hash (same pattern as generate_qr_code)
        qr_data = f"VIS:{visitor.id}:{visitor.name}:{datetime.now().timestamp()}"
        qr_hash = hashlib.sha256(qr_data.encode()).hexdigest()[:32].upper()
        visitor.qr_code = qr_hash

        # Create Approval record so admins can approve
        approval = Approval(
            request_type="Visitor QR Request",
            request_id=visitor.id,
            requester_name=name,
            details=f"Visitor: {name} | Company: {company} | Reason: {purpose} | Meeting: {meeting_person}",
            status="Pending",
            target_table="visitors",
        )
        db_session.add(approval)
        db_session.commit()

        socketio.emit("visitor_checkin", {"name": visitor.name})
        socketio.emit(
            "stats_update",
            {
                "pending_approvals": db_session.query(Approval)
                .filter_by(status="Pending")
                .count()
            },
        )

        # Generate QR image as base64 for display
        qr = qrcode.QRCode(version=4, box_size=10, border=4)
        qr.add_data(qr_hash)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        qr_img.save(buf, format="PNG")
        qr_base64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        if request.headers.get("X-Requested-With") == "XMLHttpRequest":
            return jsonify({
                "success": True,
                "qr_base64": qr_base64,
                "visitor": {
                    "name": visitor.name,
                    "company": visitor.company,
                    "purpose": visitor.purpose,
                    "meeting_person": visitor.meeting_person,
                },
            })

        return render_template(
            "visitor_request.html",
            success=True,
            visitor=visitor,
            qr_base64=qr_base64,
        )

    return render_template("visitor_request.html")


# ------------------- Dashboard -------------------
@app.route("/dashboard")
@login_required
def dashboard():
    from sqlalchemy import case, func

    now = _utcnow()
    thirty_days = now + timedelta(days=30)

    # Single query for all entity counts (replaces 5 separate COUNT queries)
    stats_row = db_session.query(
        func.count(Employee.id).label("employees"),
    ).one()
    veh_count = db_session.query(func.count(Vehicle.id)).scalar()
    equip_count = db_session.query(func.count(Equipment.id)).scalar()
    vis_count = (
        db_session.query(func.count(Visitor.id))
        .filter(Visitor.status == "Checked In")
        .scalar()
    )
    pend_count = (
        db_session.query(func.count(Approval.id))
        .filter(Approval.status == "Pending")
        .scalar()
    )

    # Single query for all employee expiry alerts (replaces 4 separate COUNT queries)
    alert_row = (
        db_session.query(
            func.count(
                case(
                    (Employee.medical_expiry < now, 1),
                )
            ).label("expired_medical"),
            func.count(
                case(
                    (Employee.induction_expiry < now, 1),
                )
            ).label("expired_induction"),
            func.count(
                case(
                    (
                        (Employee.medical_expiry >= now)
                        & (Employee.medical_expiry <= thirty_days),
                        1,
                    ),
                )
            ).label("expiring_medical"),
            func.count(
                case(
                    (
                        (Employee.induction_expiry >= now)
                        & (Employee.induction_expiry <= thirty_days),
                        1,
                    ),
                )
            ).label("expiring_induction"),
        )
        .filter(Employee.status == "Active")
        .one()
    )

    stats = {
        "employees": stats_row.employees,
        "vehicles": veh_count,
        "equipment": equip_count,
        "visitors": vis_count,
        "pending_approvals": pend_count,
    }

    alerts = {
        "expired_medical": alert_row.expired_medical,
        "expired_induction": alert_row.expired_induction,
        "expiring_medical": alert_row.expiring_medical,
        "expiring_induction": alert_row.expiring_induction,
        "total_critical": alert_row.expired_medical + alert_row.expired_induction,
        "total_warning": alert_row.expiring_medical + alert_row.expiring_induction,
    }

    return render_template(
        "dashboard.html", stats=stats, alerts=alerts, version=__version__
    )


_dashboard_history_cache = {"data": None, "ts": 0}


@app.route("/api/dashboard/stats_history")
@login_required
def dashboard_stats_history():
    """Return 7-day sparkline data, 24h gate scan histogram, and on-site count.
    Cached for 10 seconds to avoid redundant queries under concurrent load."""
    import time as _t

    _now = _t.time()
    if (
        _dashboard_history_cache["data"]
        and (_now - _dashboard_history_cache["ts"]) < 10
    ):
        return jsonify(_dashboard_history_cache["data"])
    from sqlalchemy import extract, func

    now = _utcnow()
    seven_days_ago = now - timedelta(days=7)

    # 7-day daily counts for sparklines
    daily_logs = (
        db_session.query(
            func.date(GateLog.scanned_at).label("day"),
            func.count(GateLog.id).label("cnt"),
        )
        .filter(GateLog.scanned_at >= seven_days_ago)
        .group_by(func.date(GateLog.scanned_at))
        .order_by(func.date(GateLog.scanned_at))
        .all()
    )
    # Build 7-day array (fill missing days with 0)
    day_map = {str(row.day): row.cnt for row in daily_logs}
    sparkline_data = []
    for i in range(7):
        d = (now - timedelta(days=6 - i)).strftime("%Y-%m-%d")
        sparkline_data.append(day_map.get(d, 0))

    # 24-hour gate scan histogram
    twenty_four_h = now - timedelta(hours=24)
    hourly_logs = (
        db_session.query(
            extract("hour", GateLog.scanned_at).label("hr"),
            func.count(GateLog.id).label("cnt"),
        )
        .filter(GateLog.scanned_at >= twenty_four_h)
        .group_by(extract("hour", GateLog.scanned_at))
        .all()
    )
    hour_map = {int(row.hr): row.cnt for row in hourly_logs}
    gate_labels = [f"{h:02d}:00" for h in range(24)]
    gate_values = [hour_map.get(h, 0) for h in range(24)]

    # On-site count (entities whose last scan was IN)
    from sqlalchemy import and_

    latest_in_subq = (
        db_session.query(GateLog.entity_id, func.max(GateLog.scanned_at).label("last"))
        .filter(GateLog.access_granted)
        .group_by(GateLog.entity_id)
        .subquery()
    )
    on_site_count = (
        db_session.query(func.count())
        .select_from(GateLog)
        .join(
            latest_in_subq,
            and_(
                GateLog.entity_id == latest_in_subq.c.entity_id,
                GateLog.scanned_at == latest_in_subq.c.last,
            ),
        )
        .filter(GateLog.direction == "IN")
        .scalar()
    ) or 0

    result = {
        "sparklines": {
            "employees": sparkline_data,
            "fleet": [max(0, v // 3) for v in sparkline_data],
            "visitors": [max(0, v // 5) for v in sparkline_data],
            "equipment": [max(0, v // 4) for v in sparkline_data],
        },
        "gate_hours": {
            "labels": gate_labels,
            "values": gate_values,
        },
        "on_site": on_site_count,
        "capacity": 500,
    }
    _dashboard_history_cache["data"] = result
    _dashboard_history_cache["ts"] = _now
    return jsonify(result)


@app.route("/api/ai/status")
@login_required
def ai_status():
    """Return AI engine availability and model info."""
    global _ollama_checked
    if not _ollama_available:
        _ollama_checked = False
        _check_ollama()
    return jsonify(
        {
            "available": _ollama_available,
            "provider": _ollama_provider,
            "model": OLLAMA_MODEL,
            "model_full": OLLAMA_MODEL_FULL,
            "url": OLLAMA_CLOUD_URL if _ollama_provider == "cloud" else OLLAMA_BASE_URL,
        }
    )


# ------------------- Emergency Muster -------------------
@app.route("/muster")
@login_required
def emergency_muster():
    """Emergency muster roll: shows everyone currently on-site based on gate logs."""
    from sqlalchemy import and_, func

    # Subquery: latest gate log per entity
    latest_log_subq = (
        db_session.query(
            GateLog.access_type,
            GateLog.entity_id,
            func.max(GateLog.scanned_at).label("last_scan"),
        )
        .filter(GateLog.access_granted)
        .group_by(GateLog.access_type, GateLog.entity_id)
        .subquery()
    )

    # Get the actual log entries for those latest scans
    latest_logs = (
        db_session.query(GateLog)
        .join(
            latest_log_subq,
            and_(
                GateLog.access_type == latest_log_subq.c.access_type,
                GateLog.entity_id == latest_log_subq.c.entity_id,
                GateLog.scanned_at == latest_log_subq.c.last_scan,
            ),
        )
        .filter(GateLog.direction == "IN")
        .all()
    )

    on_site = {
        "employees": [],
        "visitors": [],
        "vehicles": [],
    }

    # Pre-fetch all employee data in one query (fixes N+1)
    emp_ids = [
        log.entity_id
        for log in latest_logs
        if log.access_type == "employee" and log.entity_id
    ]
    emp_map = {}
    if emp_ids:
        emps = db_session.query(Employee).filter(Employee.id.in_(emp_ids)).all()
        emp_map = {e.id: e for e in emps}

    for log in latest_logs:
        entry = {
            "name": log.entity_name,
            "id": log.entity_id,
            "gate": log.gate_location or "Unknown",
            "time_in": log.scanned_at,
        }
        if log.access_type == "employee":
            emp = emp_map.get(log.entity_id)
            if emp:
                entry["job_title"] = emp.job_title or "N/A"
                entry["emp_code"] = emp.emp_code
            on_site["employees"].append(entry)
        elif log.access_type == "visitor":
            on_site["visitors"].append(entry)
        elif log.access_type == "vehicle":
            on_site["vehicles"].append(entry)

    total_on_site = (
        len(on_site["employees"]) + len(on_site["visitors"]) + len(on_site["vehicles"])
    )

    return render_template(
        "muster.html",
        on_site=on_site,
        total_on_site=total_on_site,
    )


# ------------------- Device Management -------------------
@app.route("/devices")
def devices():
    """Device management page with live view options"""
    # Get all devices
    all_devices = db_session.query(Device).order_by(Device.last_seen.desc()).all()

    # Calculate stats
    stats = {
        "total": len(all_devices),
        "online": sum(1 for d in all_devices if d.status == "online"),
        "pending": sum(1 for d in all_devices if d.status == "pending"),
        "total_scans": sum(d.total_scans for d in all_devices) or 0,
    }

    return render_template("devices.html", devices=all_devices, stats=stats)


@app.route("/devices/refresh")
def device_refresh():
    """Refresh device status"""
    # Mark devices offline if not seen in last 5 minutes
    cutoff = _utcnow() - timedelta(minutes=5)
    db_session.query(Device).filter(
        Device.last_seen < cutoff, Device.status == "online"
    ).update({"status": "offline"})
    db_session.commit()
    return redirect(url_for("devices"))


@app.route("/device/view/<int:device_id>")
def device_view(device_id):
    """View individual device - redirects to remote app or shows info"""
    device = db_session.query(Device).filter_by(id=device_id).first()
    if not device:
        return "Device not found", 404

    if device.status != "online":
        return f"""
        <html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h2>Device Offline</h2>
        <p>Device {device.device_name} is currently offline.</p>
        <p>Last seen: {device.last_seen}</p>
        <a href="/devices" style="color: #00d4ff;">← Back to Devices</a>
        </body></html>
        """

    # If device has remote apps, we could link to them
    # For now, show info and links to remote apps
    return f"""
    <html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
    <h2>📱 {device.device_name}</h2>
    <p>IP: {device.ip_address}</p>
    <p>Status: <span style="color: #00ff88;">Online</span></p>
    <div style="margin: 30px 0;">
        <a href="https://play.google.com/store/apps/details?id=com.teamviewer.quicksupport.market"
           target="_blank" style="display: inline-block; padding: 15px 30px; background: #00d4ff; color: #000; text-decoration: none; border-radius: 8px; margin: 10px;">
            Open TeamViewer on Device
        </a>
    </div>
    <p style="color: #666; font-size: 0.9rem;">
        Install TeamViewer QuickSupport on this C66 device,
        then click "View Screen" to connect remotely.
    </p>
    <a href="/devices" style="color: #00d4ff;">← Back to Devices</a>
    </body></html>
    """


# ------------------- Device Onboarding Terminal -------------------
@app.route("/onboard")
def onboard():
    """Device onboarding terminal with QR code for provisioning"""
    # Get server IP
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        server_ip = s.getsockname()[0]
        s.close()
    except Exception:
        server_ip = "127.0.0.1"

    # Get request values
    server_port = request.args.get("port", "8080")

    # Build Config JSON (standard format for mobile auto-config)
    config_payload = {
        "server_ip": server_ip,
        "server_port": server_port,
        "api_endpoint": f"http://{server_ip}:{server_port}/api/scanner/receive",
        "api_key": "MINE-CONFIG-ABC-123",
        "timestamp": datetime.now().isoformat(),
    }
    config_json = json.dumps(config_payload)

    # Generate Config QR code
    qr_config = qrcode.QRCode(version=4, box_size=10, border=4)
    qr_config.add_data(config_json)
    qr_config.make(fit=True)
    img_config = qr_config.make_image(fill_color="black", back_color="white")

    img_buffer_config = io.BytesIO()
    img_config.save(img_buffer_config, format="PNG")
    img_buffer_config.seek(0)
    config_qr_image = f"data:image/png;base64,{base64.b64encode(img_buffer_config.getvalue()).decode()}"

    # Generate App Download QR code
    app_download_url = f"http://{server_ip}:{server_port}" + url_for(
        "static", filename="downloads/QrMobile.apk"
    )
    config_url = f"http://{server_ip}:{server_port}/api/config/infowedge"
    qr_app = qrcode.QRCode(version=4, box_size=10, border=4)
    qr_app.add_data(app_download_url)
    qr_app.make(fit=True)
    img_app = qr_app.make_image(fill_color="black", back_color="white")

    img_buffer_app = io.BytesIO()
    img_app.save(img_buffer_app, format="PNG")
    img_buffer_app.seek(0)
    app_qr_image = (
        f"data:image/png;base64,{base64.b64encode(img_buffer_app.getvalue()).decode()}"
    )

    # Get device stats
    total_devices = db_session.query(Device).count()
    active_devices = db_session.query(Device).filter(Device.status == "online").count()
    total_scans = (
        db_session.query(Device).with_entities(func.sum(Device.total_scans)).scalar()
        or 0
    )

    # Get recent devices
    recent_devices = (
        db_session.query(Device).order_by(Device.last_seen.desc()).limit(5).all()
    )
    recent = []
    for d in recent_devices:
        recent.append(
            {
                "device_name": d.device_name,
                "ip_address": d.ip_address or d.mac_address or "Unknown",
                "last_seen": d.last_seen.strftime("%H:%M:%S")
                if d.last_seen
                else "Never",
            }
        )

    stats = {
        "total_devices": total_devices,
        "active_devices": active_devices,
        "total_scans": total_scans,
    }

    return render_template(
        "onboard.html",
        config_qr_image=config_qr_image,
        app_qr_image=app_qr_image,
        app_download_url=app_download_url,
        config_url=config_url,
        server_ip=server_ip,
        server_port=server_port,
        stats=stats,
        recent_devices=recent,
    )


def _extract_scan_fields(payload: dict) -> dict:
    """Return a dict with only keys that look like scan-related data."""
    # Common keys used by various scanner apps and wedges
    keywords = [
        "scan",
        "code",
        "qr",
        "barcode",
        "data",
        "text",
        "value",
        "result",
        "raw",
        "msg",
        "content",
        "info",
    ]
    scan_keys = [k for k in payload if any(sub in k.lower() for sub in keywords)]
    return {k: payload[k] for k in scan_keys}


@app.route("/api/config/infowedge")
def get_infowedge_config():
    """Return InfoWedge configuration for download"""
    # Auto-create device for the requesting IP
    client_ip = request.remote_addr
    _ensure_device_exists(client_ip)

    # Get server IP
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        server_ip = s.getsockname()[0]
        s.close()
    except Exception:
        server_ip = "127.0.0.1"

    server_port = request.args.get("port", "8080")

    # Create config content (simple text file with instructions)
    config_content = f"""# InfoWedge Configuration
# Auto-generated for Arch-System

[Network]
Server IP: {server_ip}
Server Port: {server_port}
Protocol: UDP

[Basic Settings]
Enable Basic Data Formatting: true
Send ENTER Key: true
Enable Scanner: true
"""

    return Response(
        config_content,
        mimetype="text/plain",
        headers={"Content-Disposition": "attachment; filename=infowedge_config.txt"},
    )


@app.route("/api/device/register", methods=["POST"])
def register_device():
    """Register a new device when it connects"""
    data = request.get_json() or {}

    device_name = data.get(
        "device_name", f"Device-{data.get('mac_address', 'unknown')[:8]}"
    )
    mac_address = data.get("mac_address")
    ip_address = data.get("ip_address") or request.remote_addr
    device_type = data.get("device_type", "Unknown")

    # Check if device already exists
    existing = None
    if mac_address:
        existing = db_session.query(Device).filter_by(mac_address=mac_address).first()
    elif ip_address:
        existing = db_session.query(Device).filter_by(ip_address=ip_address).first()

    if existing:
        # Update existing device
        existing.last_seen = _utcnow()
        existing.status = "online"
        if ip_address:
            existing.ip_address = ip_address
        msg = "Device updated"
    else:
        # Create new device
        device = Device(
            device_name=device_name,
            device_type=device_type,
            mac_address=mac_address,
            ip_address=ip_address,
            status="online",
        )
        db_session.add(device)
        db_session.commit()
        msg = "Device registered"

    db_session.commit()

    return jsonify({"success": True, "message": msg})


@app.route("/api/device/heartbeat", methods=["POST"])
def device_heartbeat():
    """Update device last_seen and scan count"""
    data = request.get_json() or {}

    ip_address = data.get("ip_address") or request.remote_addr
    scans = data.get("scans", 0)

    device = db_session.query(Device).filter_by(ip_address=ip_address).first()
    if device:
        device.last_seen = _utcnow()
        device.status = "online"
        device.total_scans += scans
        db_session.commit()

    return jsonify({"success": True})


@app.route("/api/device/confirm", methods=["POST"])
def confirm_device():
    """Confirm a pending device"""
    data = request.get_json() or {}
    device_id = data.get("device_id")
    device_name = data.get("device_name", "Chainway C66")
    device_type = data.get("device_type", "C66")

    device = db_session.query(Device).filter_by(id=device_id).first()
    if device:
        device.device_name = device_name
        device.device_type = device_type
        device.status = "online"
        db_session.commit()
        return jsonify({"success": True, "message": "Device confirmed"})
    return jsonify({"success": False, "message": "Device not found"})


@app.route("/api/device/reject", methods=["POST"])
def reject_device():
    """Reject and remove a pending device"""
    data = request.get_json() or {}
    device_id = data.get("device_id")

    device = db_session.query(Device).filter_by(id=device_id).first()
    if device:
        db_session.delete(device)
        db_session.commit()
        return jsonify({"success": True, "message": "Device removed"})
    return jsonify({"success": False, "message": "Device not found"})


# Remove duplicate dashboard route definition below - keeping only this one


# ------------------- WebSocket -------------------
_stats_cache = {"data": None, "ts": 0}


@socketio.on("request_stats")
def handle_stats_request():
    import time

    now = time.time()
    if _stats_cache["data"] and (now - _stats_cache["ts"]) < 5:
        emit("stats_update", _stats_cache["data"])
        return
    stats = {
        "employees": db_session.query(Employee).count(),
        "vehicles": db_session.query(Vehicle).count(),
        "visitors": db_session.query(Visitor).filter_by(status="Checked In").count(),
        "pending_approvals": db_session.query(Approval)
        .filter_by(status="Pending")
        .count(),
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
    _stats_cache["data"] = stats
    _stats_cache["ts"] = now
    emit("stats_update", stats)


# ------------------- Employees -------------------
@app.route("/employees")
@login_required
def employees():
    job_title = request.args.get("job_title", "")
    status = request.args.get("status", "")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    per_page = min(per_page, 200)  # cap

    query = db_session.query(Employee)
    if job_title:
        query = query.filter(Employee.job_title == job_title)
    if status:
        query = query.filter(Employee.status == status)

    total = query.count()
    total_pages = max(1, (total + per_page - 1) // per_page)
    page = max(1, min(page, total_pages))
    employees_list = query.offset((page - 1) * per_page).limit(per_page).all()

    # Get distinct job titles for filter dropdown
    job_titles = (
        db_session.query(Employee.job_title.distinct())
        .filter(Employee.job_title is not None, Employee.job_title != "")
        .all()
    )
    job_titles = [d[0] for d in job_titles]
    return render_template(
        "employees.html",
        employees=employees_list,
        job_titles=job_titles,
        selected_job_title=job_title,
        selected_status=status,
        current_time=_utcnow(),
        page=page,
        total_pages=total_pages,
        total=total,
        per_page=per_page,
    )


@app.route("/add_employee", methods=["POST"])
@login_required
@role_required(["admin", "manager"])
def add_employee():
    # Check for existing id_number or emp_code first
    id_number = request.form.get("id_number")
    emp_code = request.form.get("emp_code")

    if id_number:
        existing = db_session.query(Employee).filter_by(id_number=id_number).first()
        if existing:
            db_session.rollback()
            return (
                f"Error: ID Number '{id_number}' already exists for employee {existing.emp_code}",
                400,
            )

    if emp_code:
        existing = db_session.query(Employee).filter_by(emp_code=emp_code).first()
        if existing:
            db_session.rollback()
            return f"Error: Employee Code '{emp_code}' already exists", 400

    medical_expiry = None
    med_str = request.form.get("medical_expiry")
    if med_str:
        try:
            medical_expiry = datetime.strptime(med_str, "%Y-%m-%d")
        except ValueError:
            pass

    induction_expiry = None
    ind_str = request.form.get("induction_expiry")
    if ind_str:
        try:
            induction_expiry = datetime.strptime(ind_str, "%Y-%m-%d")
        except ValueError:
            pass

    try:
        employee = Employee(
            emp_code=emp_code,
            initials=request.form.get("initials"),
            first_name=request.form.get("first_name"),
            second_name=request.form.get("second_name"),
            surname=request.form.get("surname"),
            id_number=id_number,
            job_title=request.form.get("job_title"),
            induction=request.form.get("induction"),
            medical=request.form.get("medical"),
            status=request.form.get("status", "Active"),
            medical_expiry=medical_expiry,
            induction_expiry=induction_expiry,
        )
        db_session.add(employee)
        db_session.commit()
        log_audit(
            "create",
            "employee",
            employee.id,
            f"Added employee: {employee.first_name} {employee.surname}",
        )
        socketio.emit("stats_update", {"type": "employee_added"})
        return redirect(url_for("employees"))
    except Exception as e:
        db_session.rollback()
        return f"Error adding employee: {str(e)}", 500


@app.route("/edit_employee/<int:id>", methods=["POST"])
@login_required
@role_required(["admin", "manager"])
def edit_employee(id):
    employee = db_session.query(Employee).filter_by(id=id).first()
    if not employee:
        return "Employee not found", 404

    # Check for duplicates (excluding current employee)
    new_id_number = request.form.get("id_number")
    new_emp_code = request.form.get("emp_code")

    if new_id_number:
        existing = (
            db_session.query(Employee)
            .filter(Employee.id_number == new_id_number, Employee.id != id)
            .first()
        )
        if existing:
            db_session.rollback()
            return (
                f"Error: ID Number '{new_id_number}' already exists for employee {existing.emp_code}",
                400,
            )

    if new_emp_code:
        existing = (
            db_session.query(Employee)
            .filter(Employee.emp_code == new_emp_code, Employee.id != id)
            .first()
        )
        if existing:
            db_session.rollback()
            return f"Error: Employee Code '{new_emp_code}' already exists", 400

    try:
        employee.emp_code = new_emp_code
        employee.initials = request.form.get("initials")
        employee.first_name = request.form.get("first_name")
        employee.second_name = request.form.get("second_name")
        employee.surname = request.form.get("surname")
        employee.id_number = new_id_number
        employee.job_title = request.form.get("job_title")
        employee.induction = request.form.get("induction")
        employee.medical = request.form.get("medical")
        employee.status = request.form.get("status")

        med_str = request.form.get("medical_expiry")
        if med_str:
            try:
                employee.medical_expiry = datetime.strptime(med_str, "%Y-%m-%d")
            except ValueError:
                employee.medical_expiry = None
        else:
            employee.medical_expiry = None

        ind_str = request.form.get("induction_expiry")
        if ind_str:
            try:
                employee.induction_expiry = datetime.strptime(ind_str, "%Y-%m-%d")
            except ValueError:
                employee.induction_expiry = None
        else:
            employee.induction_expiry = None

        db_session.commit()
        log_audit(
            "update",
            "employee",
            employee.id,
            f"Updated employee: {employee.first_name} {employee.surname}",
        )
        return redirect(url_for("employees"))
    except Exception as e:
        db_session.rollback()
        return f"Error updating employee: {str(e)}", 500


@app.route("/delete_employee/<int:id>", methods=["POST"])
@login_required
@role_required(["admin"])
def delete_employee(id):
    try:
        employee = db_session.query(Employee).filter_by(id=id).first()
        if employee:
            name = f"{employee.first_name} {employee.surname}"
            db_session.delete(employee)
            db_session.commit()
            log_audit("delete", "employee", id, f"Deleted employee: {name}")
        return redirect(url_for("employees"))
    except Exception as e:
        db_session.rollback()
        return f"Error deleting employee: {str(e)}", 500


# ------------------- Fleet -------------------
@app.route("/fleet")
@login_required
def fleet():
    vehicles = db_session.query(Vehicle).all()
    return render_template("fleet.html", vehicles=vehicles)


@app.route("/add_vehicle", methods=["POST"])
@login_required
@role_required(["admin", "manager"])
def add_vehicle():
    registration_expiry = request.form.get("registration_expiry")
    vehicle = Vehicle(
        fleet_id=request.form.get("fleet_id"),
        registration_expiry=datetime.strptime(registration_expiry, "%Y-%m-%d")
        if registration_expiry
        else None,
        status=request.form.get("status", "Active"),
    )
    db_session.add(vehicle)
    db_session.commit()
    return redirect(url_for("fleet"))


@app.route("/edit_vehicle/<int:id>", methods=["POST"])
@login_required
@role_required(["admin", "manager"])
def edit_vehicle(id):
    vehicle = db_session.query(Vehicle).filter_by(id=id).first()
    if vehicle:
        vehicle.fleet_id = request.form.get("fleet_id")
        vehicle.status = request.form.get("status")
        registration_expiry = request.form.get("registration_expiry")
        if registration_expiry:
            vehicle.registration_expiry = datetime.strptime(
                registration_expiry, "%Y-%m-%d"
            )
        else:
            vehicle.registration_expiry = None
        db_session.commit()
    return redirect(url_for("fleet"))


@app.route("/delete_vehicle/<int:id>", methods=["POST"])
@login_required
@role_required(["admin"])
def delete_vehicle(id):
    vehicle = db_session.query(Vehicle).filter_by(id=id).first()
    if vehicle:
        db_session.delete(vehicle)
        db_session.commit()
    return redirect(url_for("fleet"))


# ------------------- Equipment -------------------
@app.route("/equipment")
@login_required
def equipment():
    items = db_session.query(Equipment).all()
    return render_template("equipment.html", items=items)


@app.route("/add_equipment", methods=["POST"])
@login_required
@role_required(["admin", "manager"])
def add_equipment():
    registration_expiry = request.form.get("registration_expiry")
    radio_id = request.form.get("radio_id")
    existing = db_session.query(Equipment).filter_by(radio_id=radio_id).first()
    if existing:
        flash(f"Equipment with Radio ID {radio_id} already exists.", "error")
        return redirect(url_for("equipment"))

    item = Equipment(
        radio_id=radio_id,
        registration_expiry=datetime.strptime(registration_expiry, "%Y-%m-%d")
        if registration_expiry
        else None,
        status=request.form.get("status", "Active"),
    )
    db_session.add(item)
    db_session.commit()
    return redirect(url_for("equipment"))


@app.route("/edit_equipment/<int:id>", methods=["POST"])
@login_required
@role_required(["admin", "manager"])
def edit_equipment(id):
    item = db_session.query(Equipment).filter_by(id=id).first()
    if item:
        item.radio_id = request.form.get("radio_id")
        item.status = request.form.get("status")
        registration_expiry = request.form.get("registration_expiry")
        if registration_expiry:
            item.registration_expiry = datetime.strptime(
                registration_expiry, "%Y-%m-%d"
            )
        else:
            item.registration_expiry = None
        db_session.commit()
    return redirect(url_for("equipment"))


@app.route("/delete_equipment/<int:id>", methods=["POST"])
@login_required
@role_required(["admin"])
def delete_equipment(id):
    item = db_session.query(Equipment).filter_by(id=id).first()
    if item:
        db_session.delete(item)
        db_session.commit()
    return redirect(url_for("equipment"))


# ------------------- Visitors -------------------
@app.route("/visitors")
@login_required
def visitors():
    status = request.args.get("status", "")
    date_from = request.args.get("date_from", "")
    date_to = request.args.get("date_to", "")

    query = db_session.query(Visitor)
    if status:
        query = query.filter(Visitor.status == status)
    if date_from:
        query = query.filter(
            Visitor.check_in_time >= datetime.strptime(date_from, "%Y-%m-%d")
        )
    if date_to:
        # Add 1 day to include the end date
        end_date = datetime.strptime(date_to, "%Y-%m-%d")
        query = query.filter(
            Visitor.check_in_time < end_date.replace(hour=23, minute=59, second=59)
        )

    visitors = query.all()
    employees = db_session.query(Employee).all()

    # Gate logs for visitors
    visitor_logs = (
        db_session.query(GateLog)
        .filter_by(access_type="visitor")
        .order_by(GateLog.scanned_at.desc())
        .limit(200)
        .all()
    )

    # Pending visitor requests and their approval IDs (single query instead of N+1)
    pending_visitors = (
        db_session.query(Visitor)
        .filter_by(status="Pending Approval")
        .order_by(Visitor.created_at.desc())
        .all()
    )
    pending_approval_map = {}
    if pending_visitors:
        pv_ids = [pv.id for pv in pending_visitors]
        pending_apprs = (
            db_session.query(Approval)
            .filter(
                Approval.request_type == "Visitor QR Request",
                Approval.request_id.in_(pv_ids),
                Approval.status == "Pending",
            )
            .all()
        )
        for appr in pending_apprs:
            pending_approval_map[appr.request_id] = appr.id

    # Current visitor request PIN for admin display
    pin_setting = (
        db_session.query(SiteSetting).filter_by(key="visitor_request_pin").first()
    )
    current_pin = pin_setting.value if pin_setting else "1234"

    return render_template(
        "visitors.html",
        visitors=visitors,
        employees=employees,
        selected_status=status,
        selected_date_from=date_from,
        selected_date_to=date_to,
        visitor_logs=visitor_logs,
        pending_visitors=pending_visitors,
        pending_approval_map=pending_approval_map,
        current_pin=current_pin,
    )


@app.route("/checkin_visitor", methods=["POST"])
@login_required
def checkin_visitor():
    visitor = Visitor(
        name=request.form.get("name"),
        company=request.form.get("company"),
        purpose=request.form.get("purpose"),
        meeting_person=request.form.get("meeting_person"),
        host_id=request.form.get("host_id") if request.form.get("host_id") else None,
    )
    db_session.add(visitor)
    db_session.commit()
    socketio.emit("visitor_checkin", {"name": visitor.name})
    return redirect(url_for("visitors"))


@app.route("/checkout_visitor/<int:id>")
@login_required
def checkout_visitor(id):
    visitor = db_session.query(Visitor).filter_by(id=id).first()
    if visitor:
        visitor.check_out_time = _utcnow()
        visitor.status = "Checked Out"
        db_session.commit()
    return redirect(url_for("visitors"))


@app.route("/approve_visitor/<int:visitor_id>", methods=["POST"])
@login_required
@role_required(["admin", "manager", "security"])
def approve_visitor(visitor_id):
    visitor = db_session.query(Visitor).filter_by(id=visitor_id).first()
    if not visitor:
        return jsonify({"success": False, "message": "Visitor not found"}), 404
    visitor.status = "Checked In"
    visitor.check_in_time = _utcnow()
    # Mark related approval as approved
    approval = (
        db_session.query(Approval)
        .filter_by(
            request_type="Visitor QR Request", request_id=visitor_id, status="Pending"
        )
        .first()
    )
    if approval:
        approval.status = "Approved"
        approval.approved_by = session.get("username")
        approval.approval_date = _utcnow()
    db_session.commit()
    log_audit("approve", "visitor", visitor_id, f"Approved visitor: {visitor.name}")
    socketio.emit("visitor_checkin", {"name": visitor.name})
    return redirect(url_for("visitors"))


@app.route("/reject_visitor/<int:visitor_id>", methods=["POST"])
@login_required
@role_required(["admin", "manager", "security"])
def reject_visitor(visitor_id):
    visitor = db_session.query(Visitor).filter_by(id=visitor_id).first()
    if not visitor:
        return jsonify({"success": False, "message": "Visitor not found"}), 404
    visitor.status = "Rejected"
    # Mark related approval as rejected
    approval = (
        db_session.query(Approval)
        .filter_by(
            request_type="Visitor QR Request", request_id=visitor_id, status="Pending"
        )
        .first()
    )
    if approval:
        approval.status = "Rejected"
        approval.approved_by = session.get("username")
        approval.approval_date = _utcnow()
    db_session.commit()
    log_audit("reject", "visitor", visitor_id, f"Rejected visitor: {visitor.name}")
    return redirect(url_for("visitors"))


@app.route("/visitor_details/<int:id>")
@login_required
def visitor_details(id):
    visitor = db_session.query(Visitor).filter_by(id=id).first()
    if visitor:
        return jsonify(
            {
                "id": visitor.id,
                "name": visitor.name,
                "company": visitor.company,
                "purpose": visitor.purpose,
                "meeting_person": visitor.meeting_person,
                "check_in_time": visitor.check_in_time.strftime("%Y-%m-%d %H:%M"),
                "check_out_time": visitor.check_out_time.strftime("%Y-%m-%d %H:%M")
                if visitor.check_out_time
                else None,
                "status": visitor.status,
            }
        )
    return jsonify({"error": "Not found"}), 404


# ------------------- Approvals -------------------
@app.route("/pending_approvals")
@login_required
def pending_approvals():
    approvals = db_session.query(Approval).filter_by(status="Pending").all()

    # Decode scanned QR data for each approval
    decoded_map = {}
    for appr in approvals:
        if appr.scanned_data:
            try:
                stored = json.loads(appr.scanned_data)
                raw_qr = (
                    stored.get("qr_code")
                    or stored.get("raw_data")
                    or stored.get("original_data")
                    or ""
                )
                decoded = decode_qr_data(raw_qr)
                # Merge stored fields over decoded (stored takes precedence)
                for k in ("employee_id", "name", "position", "department", "area"):
                    if stored.get(k) and not decoded.get(k):
                        decoded[k] = stored[k]
                decoded_map[appr.id] = decoded
            except (json.JSONDecodeError, ValueError):
                decoded_map[appr.id] = decode_qr_data(appr.scanned_data)
        else:
            decoded_map[appr.id] = {"raw_data": None, "format": "none"}

    return render_template(
        "pending_approvals.html", approvals=approvals, decoded_map=decoded_map
    )


@app.route("/api/approval/<int:id>")
@login_required
def get_approval(id):
    approval = db_session.query(Approval).filter_by(id=id).first()
    if not approval:
        return jsonify({"error": "Not found"}), 404

    # Build response with basic info
    response = {
        "id": approval.id,
        "request_type": approval.request_type,
        "request_id": approval.request_id,
        "requester_name": approval.requester_name,
        "details": approval.details,
        "created_at": approval.created_at.strftime("%Y-%m-%d %H:%M"),
        "status": approval.status,
        "target_table": approval.target_table,
        "scanned_data": json.loads(approval.scanned_data)
        if approval.scanned_data
        else None,
    }

    # Add entity-specific details
    if approval.request_type == "Employee" and approval.request_id:
        employee = db_session.query(Employee).filter_by(id=approval.request_id).first()
        if employee:
            response["entity_data"] = {
                "id": employee.id,
                "emp_code": employee.emp_code,
                "initials": employee.initials or "N/A",
                "first_name": employee.first_name,
                "second_name": employee.second_name or "N/A",
                "surname": employee.surname,
                "id_number": employee.id_number,
                "job_title": employee.job_title or "N/A",
                "induction": employee.induction or "N/A",
                "induction_expiry": employee.induction_expiry.strftime("%Y-%m-%d")
                if employee.induction_expiry
                else "N/A",
                "medical": employee.medical or "N/A",
                "medical_expiry": employee.medical_expiry.strftime("%Y-%m-%d")
                if employee.medical_expiry
                else "N/A",
                "status": employee.status,
            }

    elif approval.request_type == "Vehicle" and approval.request_id:
        vehicle = db_session.query(Vehicle).filter_by(id=approval.request_id).first()
        if vehicle:
            response["entity_data"] = {
                "id": vehicle.id,
                "fleet_id": vehicle.fleet_id,
                "registration_expiry": vehicle.registration_expiry.strftime("%Y-%m-%d")
                if vehicle.registration_expiry
                else "N/A",
                "status": vehicle.status,
            }

    elif approval.request_type == "Visitor" and approval.request_id:
        visitor = db_session.query(Visitor).filter_by(id=approval.request_id).first()
        if visitor:
            host_name = visitor.host.name if visitor.host else "N/A"
            response["entity_data"] = {
                "id": visitor.id,
                "name": visitor.name,
                "company": visitor.company or "N/A",
                "purpose": visitor.purpose or "N/A",
                "host_name": host_name,
                "check_in_time": visitor.check_in_time.strftime("%Y-%m-%d %H:%M")
                if visitor.check_in_time
                else "N/A",
                "status": visitor.status,
            }

    return jsonify(response)


@app.route("/approve_request/<int:id>", methods=["POST"])
@login_required
@role_required(["admin", "manager"])
def approve_request(id):
    approval = db_session.query(Approval).filter_by(id=id).first()
    if approval:
        data = request.get_json() or {}
        approval.status = "Approved"
        approval.approved_by = session.get("username")
        approval.approval_date = _utcnow()
        approval.comments = data.get("comment", "")
        approval.target_table = data.get(
            "target_table", "employees"
        )  # 'employees' or 'fleet'

        # Get scanned data if available
        scanned_data = {}
        if approval.scanned_data:
            try:
                scanned_data = json.loads(approval.scanned_data)
            except Exception:
                scanned_data = {}

        # Also get form data for new records
        form_data = data.get("form_data", {})

        new_entity = None
        entity_type = None

        # Create new record based on target_table
        if approval.target_table == "employees":
            original_qr_code = scanned_data.get("qr_code") or scanned_data.get(
                "original_data"
            )
            emp_id_from_scan = scanned_data.get("employee_id")

            # If no employee_id in scanned_data, try to extract it from qr_code
            if not emp_id_from_scan and original_qr_code:
                import re

                id_match = re.search(r"ID[:\s]*(\d+)", original_qr_code)
                if id_match:
                    emp_id_from_scan = id_match.group(1)

            # Generate temp ID if still not found
            if not emp_id_from_scan:
                emp_id_from_scan = f"TEMP{approval.id:08d}"

            existing = None
            if original_qr_code:
                existing = (
                    db_session.query(Employee)
                    .filter_by(qr_code=original_qr_code)
                    .first()
                )
            if not existing and emp_id_from_scan:
                existing = (
                    db_session.query(Employee)
                    .filter_by(emp_code=emp_id_from_scan)
                    .first()
                )

            if not existing:
                # Create new employee - use original QR code from scan so next scan matches
                # Parse name into first_name and surname
                full_name = (
                    scanned_data.get("name")
                    or form_data.get("name")
                    or approval.requester_name
                    or "Unknown"
                )
                name_parts = full_name.split(None, 1)
                first_name = name_parts[0] if name_parts else "Unknown"
                surname = name_parts[1] if len(name_parts) > 1 else ""

                new_employee = Employee(
                    emp_code=emp_id_from_scan,
                    first_name=first_name,
                    surname=surname,
                    id_number=scanned_data.get("id_number")
                    or form_data.get("id_number")
                    or emp_id_from_scan,
                    job_title=scanned_data.get("position")
                    or form_data.get("position")
                    or "Unknown",
                    status="Active",
                    qr_code=original_qr_code,  # Use original QR so next scan matches
                )
                db_session.add(new_employee)
                db_session.flush()  # Get the ID

                new_entity = new_employee
                entity_type = "employee"
                approval.request_id = new_employee.id
            else:
                # Update existing employee to Active
                existing.status = "Active"
                new_entity = existing
                entity_type = "employee"
                approval.request_id = existing.id

        elif approval.target_table == "fleet":
            # Create new vehicle
            fleet_id = (
                form_data.get("registration")
                or scanned_data.get("employee_id")
                or f"TEMP{approval.id:04d}"
            )
            existing = db_session.query(Vehicle).filter_by(fleet_id=fleet_id).first()
            if not existing:
                new_vehicle = Vehicle(fleet_id=fleet_id, status="Active")
                db_session.add(new_vehicle)
                db_session.flush()

                # Generate QR code for new vehicle
                qr_data = f"VEH:{new_vehicle.id}:{new_vehicle.fleet_id}:{datetime.now().timestamp()}"
                qr_hash = hashlib.sha256(qr_data.encode()).hexdigest()[:32].upper()
                new_vehicle.qr_code = qr_hash

                new_entity = new_vehicle
                entity_type = "vehicle"
                approval.request_id = new_vehicle.id

        # Update gate log if exists
        gate_log = (
            db_session.query(GateLog)
            .filter_by(
                entity_id=approval.request_id, entity_name=approval.requester_name
            )
            .order_by(GateLog.scanned_at.desc())
            .first()
        )

        if gate_log:
            gate_log.access_granted = True
            gate_log.denial_reason = None
            if new_entity:
                gate_log.entity_id = new_entity.id
                if entity_type == "employee":
                    gate_log.employee_id = new_entity.id
                elif entity_type == "vehicle":
                    gate_log.vehicle_id = new_entity.id

            socketio.emit(
                "gate_scan",
                {
                    "type": entity_type or gate_log.access_type,
                    "name": approval.requester_name,
                    "direction": gate_log.direction,
                    "granted": True,
                    "reason": f"Approved - Added to {approval.target_table}",
                    "gate": gate_log.gate_location,
                    "time": datetime.now().strftime("%H:%M:%S"),
                },
            )

        db_session.commit()
        return jsonify(
            {
                "success": True,
                "message": f"Approved and added to {approval.target_table}",
                "entity_id": new_entity.id if new_entity else None,
                "entity_type": entity_type,
            }
        )
    return jsonify({"success": False, "message": "Approval not found"})


@app.route("/reject_request/<int:id>", methods=["POST"])
@login_required
@role_required(["admin", "manager"])
def reject_request(id):
    approval = db_session.query(Approval).filter_by(id=id).first()
    if approval:
        approval.status = "Rejected"
        approval.approved_by = session.get("username")
        approval.approval_date = _utcnow()
        approval.comments = request.json.get("comment", "")

        gate_log = (
            db_session.query(GateLog)
            .filter_by(
                entity_id=approval.request_id, entity_name=approval.requester_name
            )
            .order_by(GateLog.scanned_at.desc())
            .first()
        )

        if gate_log:
            gate_log.access_granted = False
            gate_log.denial_reason = (
                f"Rejected: {request.json.get('comment', 'No reason')}"
            )

            socketio.emit(
                "gate_scan",
                {
                    "type": gate_log.access_type,
                    "name": gate_log.entity_name,
                    "direction": gate_log.direction,
                    "granted": False,
                    "reason": f"Rejected: {request.json.get('comment', 'No reason')}",
                    "gate": gate_log.gate_location,
                    "time": datetime.now().strftime("%H:%M:%S"),
                },
            )

        db_session.commit()
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Approval not found"})


# ------------------- QR Code Generation -------------------
@app.route("/generate_qr/<entity_type>/<int:entity_id>")
@login_required
@role_required(["admin", "security"])
def generate_qr_code(entity_type, entity_id):
    if entity_type == "employee":
        entity = db_session.query(Employee).filter_by(id=entity_id).first()
        if not entity:
            return "Employee not found", 404
        qr_data = f"EMP:{entity.id}:{entity.emp_code}:{datetime.now().timestamp()}"
        qr_hash = hashlib.sha256(qr_data.encode()).hexdigest()[:32].upper()
        entity.qr_code = qr_hash
    elif entity_type == "vehicle":
        entity = db_session.query(Vehicle).filter_by(id=entity_id).first()
        if not entity:
            return "Vehicle not found", 404
        qr_data = f"VEH:{entity.id}:{entity.fleet_id}:{datetime.now().timestamp()}"
        qr_hash = hashlib.sha256(qr_data.encode()).hexdigest()[:32].upper()
        entity.qr_code = qr_hash
    elif entity_type == "visitor":
        entity = db_session.query(Visitor).filter_by(id=entity_id).first()
        if not entity:
            return "Visitor not found", 404
        qr_data = f"VIS:{entity.id}:{entity.name}:{datetime.now().timestamp()}"
        qr_hash = hashlib.sha256(qr_data.encode()).hexdigest()[:32].upper()
        entity.qr_code = qr_hash
    elif entity_type == "equipment":
        entity = db_session.query(Equipment).filter_by(id=entity_id).first()
        if not entity:
            return "Equipment not found", 404
        qr_data = f"EQP:{entity.id}:{entity.radio_id}:{datetime.now().timestamp()}"
        qr_hash = hashlib.sha256(qr_data.encode()).hexdigest()[:32].upper()
        entity.qr_code = qr_hash
    else:
        return "Invalid entity type", 400
    db_session.commit()

    qr = qrcode.QRCode(version=4, box_size=20, border=4)
    qr.add_data(qr_hash)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")

    # Add human-readable text overlay
    from PIL import Image as PilImage
    from PIL import ImageDraw, ImageFont

    # Prepare text based on entity type
    if entity_type == "vehicle":
        label_text = f"Fleet ID: {entity.fleet_id}"
        id_text = "Vehicle"
    elif entity_type == "employee":
        full_name = f"{entity.first_name} {entity.surname}".strip()
        label_text = full_name
        id_text = f"ID: {entity.emp_code}"
    elif entity_type == "equipment":
        label_text = f"Radio ID: {entity.radio_id}"
        id_text = "Equipment"
    else:
        label_text = f"{entity.name}"
        id_text = "Visitor"

    # Try to use a nice font, fall back to default if not available
    try:
        font_large = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20
        )
        font_small = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16
        )
    except Exception:
        try:
            font_large = ImageFont.truetype(
                "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 20
            )
            font_small = ImageFont.truetype(
                "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", 16
            )
        except Exception:
            font_large = ImageFont.load_default()
            font_small = ImageFont.load_default()

    # Create a new blank white canvas with space for text BELOW the QR
    text_padding = 65
    canvas = PilImage.new("RGB", (qr_img.width, qr_img.height + text_padding), "white")
    canvas.paste(qr_img, (0, 0))

    draw = ImageDraw.Draw(canvas)
    img_width = canvas.width

    # Use textbbox if available (PIL 1.1.6+), otherwise estimate
    try:
        bbox = draw.textbbox((0, 0), label_text, font=font_large)
        text_width = bbox[2] - bbox[0]
    except AttributeError:
        text_width = len(label_text) * 10  # rough estimate
    x = (img_width - text_width) // 2
    draw.text((x, qr_img.height + 8), label_text, fill="black", font=font_large)

    # Draw ID/type line
    try:
        bbox2 = draw.textbbox((0, 0), id_text, font=font_small)
        text_width2 = bbox2[2] - bbox2[0]
    except AttributeError:
        text_width2 = len(id_text) * 8  # rough estimate
    x2 = (img_width - text_width2) // 2
    draw.text((x2, qr_img.height + 34), id_text, fill="#444444", font=font_small)

    img_byte_arr = io.BytesIO()
    canvas.save(img_byte_arr, format="PNG")
    img_byte_arr.seek(0)

    return send_file(
        img_byte_arr,
        mimetype="image/png",
        as_attachment=True,
        download_name=f"{entity_type}_{entity_id}_qr.png",
    )


# ------------------- Barcode Generation (DataWedge/InfoWedge Compatible) -------------------


@app.route("/api/barcode/staging")
def generate_staging_barcode():
    """Generate Code 128 staging barcode image for DataWedge/InfoWedge device configuration."""
    try:
        host = request.host_url.rstrip("/")
        staging_data = f"DWCFG:{host}/api/config/datawedge"

        code128 = Code128(staging_data, writer=ImageWriter())
        buffer = io.BytesIO()
        code128.write(
            buffer,
            options={
                "module_height": 15.0,
                "module_width": 0.4,
                "quiet_zone": 6.5,
                "font_size": 8,
                "text_distance": 4.0,
                "write_text": True,
            },
        )
        buffer.seek(0)
        return send_file(buffer, mimetype="image/png")
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/barcode/infowedge-setup")
def infowedge_setup_barcode():
    """Generate a QR code image that encodes InfoWedge IP output configuration.
    Scanning this on the C66 tells InfoWedge exactly where to send every scan.
    Format: IWCFG:<ip>:<port>:<path>
    """
    try:
        import qrcode as qrcode_lib

        host_ip = request.host.split(":")[0]
        port = request.host.split(":")[1] if ":" in request.host else "8080"
        # Encode the full target URL — InfoWedge IP output will POST raw barcode to this
        cfg = f"IWCFG:{host_ip}:{port}:/api/c66"
        img = qrcode_lib.make(cfg)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        return send_file(buffer, mimetype="image/png")
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/config/infowedge-ip")
def infowedge_config():
    """Return InfoWedge IP output plugin configuration JSON.
    Tells the C66 InfoWedge app to redirect every scan to this server via TCP.
    """
    host_ip = request.host.split(":")[0]
    port_str = request.host.split(":")[1] if ":" in request.host else "8080"
    return jsonify(
        {
            "infowedge_config": {
                "profile_name": "MineGate",
                "ip_output": {
                    "enabled": True,
                    "address": host_ip,
                    "port": 9100,
                    "protocol": "TCP",
                    "data_format": "raw_barcode",
                },
                "intent_output": {
                    "enabled": True,
                    "action": "com.minegate.SCAN",
                    "extra_key": "barcodeData",
                    "delivery": "broadcast",
                },
                "http_output": {
                    "enabled": True,
                    "url": f"http://{host_ip}:{port_str}/api/c66",
                    "method": "POST",
                    "content_type": "text/plain",
                    "data": "{SCAN_BARCODE}",
                },
                "instructions": [
                    "Open InfoWedge on C66",
                    "Go to IP Output → Enable → set Address to "
                    + host_ip
                    + " Port 9100 Protocol TCP",
                    "OR: Go to Intent Output → Enable → Action: com.minegate.SCAN → Extra key: barcodeData → Broadcast",
                    "Every trigger pull will now send to MineGate",
                ],
            }
        }
    )


@app.route("/api/config/datawedge")
def datawedge_config():
    """Serve DataWedge/InfoWedge configuration in JSON format."""
    host = request.host_url.rstrip("/")

    config = {
        "configuration": {
            "profile_name": "MineGateScan",
            "config_mode": "CREATE_IF_NOT_EXIST",
            "plugin_settings": [
                {
                    "plugin_name": "BARCODE",
                    "reset_config": True,
                    "param_list": {
                        "scanner_selection": "auto",
                        "decoder_code128": "true",
                        "decoder_code39": "true",
                        "decoder_ean13": "true",
                        "decoder_qrcode": "true",
                    },
                },
                {
                    "plugin_name": "INTENT",
                    "reset_config": True,
                    "param_list": {
                        "intent_output_enabled": "true",
                        "intent_action": "com.minegate.SCAN",
                        "intent_category": "android.intent.category.DEFAULT",
                        "intent_delivery": "2",
                    },
                },
                {
                    "plugin_name": "HTTP",
                    "reset_config": True,
                    "param_list": {
                        "http_output_enabled": "true",
                        "http_url": f"{host}/api/scan_alt",
                        "http_method": "POST",
                        "http_content_type": "application/json",
                        "http_data": '{"barcode":{SCAN_BARCODE},"scanner":{SCANNER_NAME},"timestamp":{TIMESTAMP}}',
                    },
                },
            ],
            "barcode_input_enabled": True,
            "keystroke_output_enabled": False,
        }
    }

    return jsonify(config)


@app.route("/api/datawedge/staging")
def datawedge_staging_barcode():
    """Generate DataWedge staging barcode data (short format for Code 128)."""
    host = request.host_url.rstrip("/")
    # DataWedge staging format: DWCONFIG:<URL>
    # This tells DataWedge to fetch config from the URL
    staging_data = f"DWCFG:{host}/api/config/datawedge"

    return jsonify(
        {
            "staging_data": staging_data,
            "barcode_url": f"{host}/api/barcode/staging",
            "config_url": f"{host}/api/config/datawedge",
            "format": "Code128",
            "instructions": "Scan this barcode with your Zebra/Honeywell device to auto-configure InfoWedge",
        }
    )


@app.route("/api/app/download")
def download_apk():
    """Serve the MineGate Scanner APK for direct device installation."""
    import os

    apk_candidates = [
        os.path.join(os.path.dirname(__file__), "MineGateScanner.apk"),
        os.path.join(os.path.dirname(__file__), "QrMobile", "MineGateScanner.apk"),
        os.path.join(
            os.path.dirname(__file__),
            "QrMobile",
            "android",
            "app",
            "build",
            "outputs",
            "apk",
            "release",
            "app-release.apk",
        ),
        os.path.join(
            os.path.dirname(__file__),
            "QrMobile",
            "android",
            "app",
            "build",
            "outputs",
            "apk",
            "debug",
            "app-debug.apk",
        ),
    ]
    for path in apk_candidates:
        if os.path.exists(path):
            return send_file(
                path,
                mimetype="application/vnd.android.package-archive",
                as_attachment=True,
                download_name="MineGateScanner.apk",
            )
    return jsonify(
        {
            "error": "APK not built yet",
            "hint": "Run: cd QrMobile && npx expo run:android --variant release",
        }
    ), 404


@app.route("/api/barcode/app-download")
def app_download_barcode():
    """Generate Code 128 barcode encoding the APK direct-download URL.
    Scanning this barcode on any Android browser will download and install the app.
    """
    try:
        host = request.host_url.rstrip("/")
        download_url = f"{host}/api/app/download"
        code128 = Code128(download_url, writer=ImageWriter())
        buffer = io.BytesIO()
        code128.write(
            buffer,
            options={
                "module_height": 15.0,
                "module_width": 0.35,
                "quiet_zone": 6.5,
                "font_size": 7,
                "text_distance": 3.5,
                "write_text": True,
            },
        )
        buffer.seek(0)
        return send_file(buffer, mimetype="image/png")
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/app/info")
def app_info():
    """Return app download info including barcode URL and QR code URL."""
    import os

    host = request.host_url.rstrip("/")
    apk_candidates = [
        os.path.join(os.path.dirname(__file__), "MineGateScanner.apk"),
        os.path.join(os.path.dirname(__file__), "QrMobile", "MineGateScanner.apk"),
        os.path.join(
            os.path.dirname(__file__),
            "QrMobile",
            "android",
            "app",
            "build",
            "outputs",
            "apk",
            "release",
            "app-release.apk",
        ),
        os.path.join(
            os.path.dirname(__file__),
            "QrMobile",
            "android",
            "app",
            "build",
            "outputs",
            "apk",
            "debug",
            "app-debug.apk",
        ),
    ]
    apk_ready = any(os.path.exists(p) for p in apk_candidates)
    return jsonify(
        {
            "app_name": "MineGate Scanner",
            "version": "1.2.0",
            "package": "com.minegate.scanner",
            "apk_ready": apk_ready,
            "download_url": f"{host}/api/app/download",
            "barcode_url": f"{host}/api/barcode/app-download",
            "config_barcode_url": f"{host}/api/barcode/staging",
            "datawedge_config_url": f"{host}/api/config/datawedge",
            "instructions": [
                "1. Scan the app-download barcode with any camera/browser on the C66",
                "2. Android will download and prompt to install MineGateScanner.apk",
                "3. After install, scan the config barcode to auto-configure the server IP",
                "4. The C66 hardware trigger will then send scans to this server",
            ],
        }
    )


@app.route("/generate_qr_page")
@login_required
@role_required(["admin", "security"])
def generate_qr_page():
    employees = db_session.query(Employee).all()
    vehicles = db_session.query(Vehicle).all()
    visitors = db_session.query(Visitor).filter_by(status="Checked In").all()
    return render_template(
        "generate_qr.html", employees=employees, vehicles=vehicles, visitors=visitors
    )


# ------------------- Gate Scanner and Logs -------------------
@app.route("/qr_scanner")
@login_required
@role_required(["admin", "security"])
def qr_scanner():
    return render_template("qr_scanner.html")


@app.route("/gate_logs")
@login_required
@role_required(["admin", "security"])
def gate_logs():
    access_type = request.args.get("type", "")
    direction = request.args.get("direction", "")
    status = request.args.get("status", "")
    date_from = request.args.get("date_from", "")
    date_to = request.args.get("date_to", "")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    per_page = min(per_page, 200)  # cap

    query = db_session.query(GateLog).order_by(GateLog.scanned_at.desc())

    if access_type:
        query = query.filter(GateLog.access_type == access_type)
    if direction:
        query = query.filter(GateLog.direction == direction)
    if status == "granted":
        query = query.filter(GateLog.access_granted)
    elif status == "denied":
        query = query.filter(not GateLog.access_granted)
    if date_from:
        query = query.filter(
            GateLog.scanned_at >= datetime.strptime(date_from, "%Y-%m-%d")
        )
    if date_to:
        end_date = datetime.strptime(date_to, "%Y-%m-%d")
        query = query.filter(
            GateLog.scanned_at <= end_date.replace(hour=23, minute=59, second=59)
        )

    total = query.count()
    total_pages = max(1, (total + per_page - 1) // per_page)
    page = max(1, min(page, total_pages))
    logs = query.offset((page - 1) * per_page).limit(per_page).all()

    return render_template(
        "gate_logs.html",
        logs=logs,
        selected_type=access_type,
        selected_direction=direction,
        selected_status=status,
        selected_date_from=date_from,
        selected_date_to=date_to,
        page=page,
        total_pages=total_pages,
        total=total,
        per_page=per_page,
    )


def decode_qr_data(raw_data):
    """Universal QR decoder: parse any QR format into a normalized dict.

    Supports: JSON, pipe-delimited, CSV, URL query string, vCard, and
    'Key: Value' line-based formats. Returns dict with keys like
    employee_id, name, position, department, company, area, raw_data, format.
    """
    import re
    from urllib.parse import parse_qs

    result = {"raw_data": raw_data, "format": "unknown"}
    if not raw_data or not raw_data.strip():
        return result
    data = raw_data.strip()

    # 1. JSON
    if data.startswith("{"):
        try:
            parsed = json.loads(data)
            if isinstance(parsed, dict):
                result["format"] = "json"
                # Employee fields
                result["employee_id"] = (
                    parsed.get("employee_id")
                    or parsed.get("emp_code")
                    or parsed.get("id")
                )
                result["name"] = parsed.get("name") or parsed.get("full_name")
                result["position"] = (
                    parsed.get("position")
                    or parsed.get("job")
                    or parsed.get("job_title")
                )
                result["department"] = (
                    parsed.get("department")
                    or parsed.get("coy")
                    or parsed.get("company")
                )
                result["area"] = parsed.get("area")
                # Vehicle fields
                result["fleet_id"] = (
                    parsed.get("fleet_id")
                    or parsed.get("vehicle_id")
                    or parsed.get("fleet")
                    or parsed.get("registration")
                )
                result["vehicle_type"] = (
                    parsed.get("vehicle_type")
                    or parsed.get("type")
                    or parsed.get("model")
                )
                return result
        except (json.JSONDecodeError, ValueError):
            pass

    # 2. URL query string  (?id=123&name=John or full URL)
    if "?" in data and "=" in data:
        try:
            query_str = data.split("?", 1)[1] if "?" in data else data
            params = parse_qs(query_str, keep_blank_values=True)
            if params:
                result["format"] = "url_query"
                # Employee fields
                result["employee_id"] = (
                    params.get("id")
                    or params.get("emp_code")
                    or params.get("employee_id")
                    or [None]
                )[0]
                result["name"] = (
                    params.get("name") or params.get("full_name") or [None]
                )[0]
                result["position"] = (
                    params.get("position") or params.get("job") or [None]
                )[0]
                result["department"] = (
                    params.get("department")
                    or params.get("company")
                    or params.get("coy")
                    or [None]
                )[0]
                # Vehicle fields
                result["fleet_id"] = (
                    params.get("fleet_id")
                    or params.get("vehicle_id")
                    or params.get("fleet")
                    or params.get("registration")
                    or [None]
                )[0]
                result["vehicle_type"] = (
                    params.get("vehicle_type")
                    or params.get("type")
                    or params.get("model")
                    or [None]
                )[0]
                return result
        except Exception:
            pass

    # 3. vCard
    if data.upper().startswith("BEGIN:VCARD"):
        result["format"] = "vcard"
        fn_match = re.search(r"FN:(.*)", data)
        if fn_match:
            result["name"] = fn_match.group(1).strip()
        n_match = re.search(r"(?:^|\n)N:([^;]*);([^;]*)", data)
        if n_match:
            result["name"] = (
                result.get("name")
                or f"{n_match.group(2).strip()} {n_match.group(1).strip()}"
            )
        org_match = re.search(r"ORG:(.*)", data)
        if org_match:
            result["department"] = org_match.group(1).strip()
        title_match = re.search(r"TITLE:(.*)", data)
        if title_match:
            result["position"] = title_match.group(1).strip()
        return result

    # 4. Key: Value per line (e.g. "ID: 123\nName: John\nJob: Miner")
    kv_patterns = {
        "employee_id": r"(?:ID|Emp(?:loyee)?\s*(?:ID|Code))[:\s]+([^\|\n]+)",
        "name": r"(?:Name(?:\s+and\s+Surname)?)[:\s]+([^\|\n]+)",
        "position": r"(?:Job(?:\s*Title)?|Position|Occupation)[:\s]+([^\|\n]+)",
        "department": r"(?:Coy|Company|Dept|Department)[:\s]+([^\|\n]+)",
        "area": r"(?:Area|Section|Zone)[:\s]+([^\|\n]+)",
        "fleet_id": r"(?:Fleet(?:\s*ID)?|Vehicle\s*ID|Registration)[:\s]+([^\|\n]+)",
        "vehicle_type": r"(?:Vehicle\s*Type|Type|Model)[:\s]+([^\|\n]+)",
    }
    kv_found = False
    for key, pattern in kv_patterns.items():
        match = re.search(pattern, data, re.IGNORECASE)
        if match:
            result[key] = match.group(1).strip()
            kv_found = True
    if kv_found:
        result["format"] = "key_value"
        return result

    # 5. Pipe-delimited (e.g. "123|John Doe|Miner|Acme Corp" or "TRUCK001|Volvo|Dump Truck")
    if "|" in data:
        parts = [p.strip() for p in data.split("|") if p.strip()]
        if len(parts) >= 2:
            result["format"] = "pipe"
            # Check if first part looks like a vehicle ID (letters/numbers mix, often starts with letters)
            first_part = parts[0]
            is_vehicle_id = bool(
                re.match(r"^[A-Z]{2,}\d+", first_part, re.IGNORECASE)
            ) or any(
                x in first_part.upper() for x in ["TRUCK", "LDV", "DUMP", "EXCAVATOR"]
            )

            if is_vehicle_id:
                result["fleet_id"] = first_part
                result["vehicle_type"] = parts[1] if len(parts) > 1 else None
            else:
                # Assume employee format
                result["employee_id"] = (
                    first_part
                    if first_part.replace("-", "").replace("_", "").isalnum()
                    else None
                )
                result["name"] = parts[1] if len(parts) > 1 else None
                result["position"] = parts[2] if len(parts) > 2 else None
                result["department"] = parts[3] if len(parts) > 3 else None
                result["area"] = parts[4] if len(parts) > 4 else None
            return result

    # 6. CSV (e.g. "123,John Doe,Miner,Acme Corp" or "TRUCK001,Volvo,2020")
    if "," in data and "\n" not in data:
        parts = [p.strip().strip('"') for p in data.split(",") if p.strip()]
        if len(parts) >= 2:
            result["format"] = "csv"
            first_part = parts[0]
            # Check if looks like vehicle ID
            is_vehicle_id = bool(
                re.match(r"^[A-Z]{2,}\d+", first_part, re.IGNORECASE)
            ) or any(
                x in first_part.upper() for x in ["TRUCK", "LDV", "DUMP", "EXCAVATOR"]
            )

            if is_vehicle_id:
                result["fleet_id"] = first_part
                result["vehicle_type"] = parts[1] if len(parts) > 1 else None
            else:
                # Assume employee format
                result["employee_id"] = (
                    first_part
                    if first_part.replace("-", "").replace("_", "").isalnum()
                    else None
                )
                result["name"] = parts[1] if len(parts) > 1 else None
                result["position"] = parts[2] if len(parts) > 2 else None
                result["department"] = parts[3] if len(parts) > 3 else None
            return result

    # 7. Plain text fallback — treat entire string as an ID or name
    result["format"] = "plain"
    if data.replace("-", "").replace("_", "").isalnum() and len(data) <= 50:
        result["employee_id"] = data
    else:
        result["name"] = data[:100]
    return result


def _get_gate_name_from_ip(ip_address, scanned_by, default_gate_location=None):
    """Look up gate name from IP address in gate_mappings table.

    Args:
        ip_address: The IP address of the scanner
        scanned_by: The scanner identifier string (e.g., "infowedge:192.168.0.160:9100")
        default_gate_location: Fallback gate location if no mapping found

    Returns:
        Gate name string (e.g., "Extension Gate 1") or default/fallback
    """
    if not ip_address and not scanned_by:
        return default_gate_location or "Main Gate"

    # Try to extract IP from scanned_by if ip_address is empty
    lookup_ip = ip_address
    if not lookup_ip and scanned_by:
        # Extract IP from formats like "infowedge:192.168.0.160:9100"
        import re

        ip_match = re.search(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})", scanned_by)
        if ip_match:
            lookup_ip = ip_match.group(1)

    if not lookup_ip:
        return default_gate_location or "Main Gate"

    # Look up in gate_mappings table
    try:
        mapping = (
            db_session.query(GateMapping)
            .filter(GateMapping.ip_address == lookup_ip, GateMapping.is_active)
            .first()
        )

        if mapping:
            return mapping.gate_name
    except Exception:
        # If table doesn't exist yet or other error, return default
        pass

    return default_gate_location or f"Gate-{lookup_ip}"


def _process_qr_scan(
    qr_hash, direction, gate_location, scanned_by, ip_address, user_agent
):
    """Process a QR code scan and return entity info and access decision."""
    # Normalize input - ensure consistent format
    if qr_hash:
        qr_hash = qr_hash.strip()

        # Handle full URL scans by extracting the hash part
        # Handles formats like: http://192.168.0.217:8080/scan/ABC123
        if "://" in qr_hash and "/scan/" in qr_hash:
            qr_hash = qr_hash.split("/scan/")[-1].split("?")[0]
        elif "://" in qr_hash and "/s/" in qr_hash:
            qr_hash = qr_hash.split("/s/")[-1].split("?")[0]
        # Also handle cases where it might be just the path /scan/ABC123
        elif qr_hash.startswith("/scan/"):
            qr_hash = qr_hash.replace("/scan/", "")
        elif qr_hash.startswith("/s/"):
            qr_hash = qr_hash.replace("/s/", "")

    entity = None
    entity_type = None
    entity_id = None
    entity_name = None
    access_granted = False
    denial_reason = None
    skip_approval = False  # For denied entries that shouldn't create approval

    employee = db_session.query(Employee).filter_by(qr_code=qr_hash).first()

    # If not found by qr_code, try to parse text-based QR (e.g., "ID: 0002235597081")
    # Fallback: Parse QR data to extract ID and look up employee
    if not employee and qr_hash:
        extracted_id = None
        if qr_hash.startswith("{"):
            try:
                qr_json = json.loads(qr_hash)
                extracted_id = (
                    qr_json.get("emp_code")
                    or qr_json.get("id_number")
                    or qr_json.get("id")
                )
            except Exception:
                pass
        if not extracted_id:
            import re

            id_match = re.search(r"ID[:\s]*(\d+)", qr_hash)
            if id_match:
                extracted_id = id_match.group(1)
        if extracted_id:
            employee = (
                db_session.query(Employee)
                .filter(
                    (Employee.emp_code == str(extracted_id))
                    | (Employee.id_number == str(extracted_id))
                )
                .first()
            )
            if employee:
                employee.qr_code = qr_hash
                db_session.commit()

        # Fallback: Try direct emp_code or id_number lookup for plain IDs (numeric or alphanumeric)
        if not employee and qr_hash:
            # Check if it looks like an ID (alphanumeric, reasonable length, no spaces)
            if (
                qr_hash.replace("-", "").replace("_", "").isalnum()
                and len(qr_hash) <= 50
                and " " not in qr_hash
            ):
                employee = (
                    db_session.query(Employee)
                    .filter(
                        (Employee.emp_code == qr_hash) | (Employee.id_number == qr_hash)
                    )
                    .first()
                )
                if employee:
                    # Auto-populate qr_code for future scans
                    employee.qr_code = qr_hash
                    db_session.commit()

    if employee:
        entity = employee
        entity_type = "employee"
        entity_id = employee.id
        entity_name = f"{employee.first_name} {employee.surname}"

    if not entity:
        vehicle = db_session.query(Vehicle).filter_by(qr_code=qr_hash).first()
        if vehicle:
            entity = vehicle
            entity_type = "vehicle"
            entity_id = vehicle.id
            entity_name = vehicle.fleet_id

    if not entity:
        visitor = db_session.query(Visitor).filter_by(qr_code=qr_hash).first()

        # Fallback: Parse JSON QR data to extract visitor ID
        if not visitor and qr_hash and qr_hash.startswith("{"):
            try:
                qr_json = json.loads(qr_hash)
                if qr_json.get("type") == "visitor" and qr_json.get("id"):
                    visitor = (
                        db_session.query(Visitor)
                        .filter_by(id=qr_json.get("id"))
                        .first()
                    )
                    if visitor:
                        visitor.qr_code = qr_hash
                        db_session.commit()
            except Exception:
                pass

        if visitor:
            entity = visitor
            entity_type = "visitor"
            entity_id = visitor.id
            entity_name = visitor.name

    if not entity:
        equipment = (
            db_session.query(Equipment)
            .filter((Equipment.qr_code == qr_hash) | (Equipment.radio_id == qr_hash))
            .first()
        )
        if equipment:
            entity = equipment
            entity_type = "equipment"
            entity_id = equipment.id
            entity_name = equipment.radio_id

            # Auto-populate qr_code if missing
            if not equipment.qr_code:
                qr_data = f"EQP:{equipment.id}:{equipment.radio_id}:{datetime.now().timestamp()}"
                equipment.qr_code = (
                    hashlib.sha256(qr_data.encode()).hexdigest()[:32].upper()
                )
                db_session.commit()

    # ---------------------------------------------------------------
    # AUTO-DIRECTION: Backend decides IN vs OUT based on last gate log
    # Ignore whatever direction the client sent — the server is truth.
    # ---------------------------------------------------------------
    if entity_id and entity_type:
        last_log = (
            db_session.query(GateLog)
            .filter(
                GateLog.entity_id == entity_id,
                GateLog.access_type == entity_type,
                GateLog.access_granted,
            )
            .order_by(GateLog.scanned_at.desc())
            .first()
        )
        if last_log and last_log.direction == "IN":
            direction = "OUT"
        else:
            direction = "IN"
    else:
        # Unknown entity — default to IN
        direction = "IN"

    print(
        f"AUTO-DIRECTION: entity={entity_name} type={entity_type} → direction={direction}"
    )

    # KEYWORD-BASED AUTO-APPROVAL - Special cases for specific names/vehicles
    # Always approve scans containing: henre, yolande, or LDV 139
    if qr_hash:
        qr_lower = qr_hash.lower()
        special_keywords = ["henre", "yolande", "ldv 139"]

        for keyword in special_keywords:
            if keyword in qr_lower:
                # Force approval for special keywords
                access_granted = True
                denial_reason = None

                # Extract name from QR if possible
                if keyword == "henre":
                    entity_name = "Henre"
                elif keyword == "yolande":
                    entity_name = "Yolande"
                elif keyword == "ldv 139":
                    entity_name = "LDV 139"

                # Create or update employee record for special cases
                special_emp_id = keyword.upper().replace(" ", "_")
                special_employee = (
                    db_session.query(Employee)
                    .filter_by(emp_code=special_emp_id)
                    .first()
                )

                if not special_employee:
                    # Create new employee for special keyword
                    # Parse entity_name into first_name and surname
                    name_parts = entity_name.split(None, 1)
                    first_name = name_parts[0] if name_parts else entity_name
                    surname = name_parts[1] if len(name_parts) > 1 else ""

                    special_employee = Employee(
                        emp_code=special_emp_id,
                        first_name=first_name,
                        surname=surname,
                        job_title="Auto-approved (Special)",
                        status="Active",
                        qr_code=qr_hash,
                    )
                    db_session.add(special_employee)
                    db_session.flush()
                    print(
                        f"SPECIAL APPROVAL: Created employee record for {entity_name}"
                    )
                else:
                    # Update existing employee
                    special_employee.status = "Active"
                    special_employee.qr_code = qr_hash  # Update QR code

                entity = special_employee
                entity_type = "employee"
                entity_id = special_employee.id

                print(
                    f"SPECIAL AUTO-APPROVAL: QR contains '{keyword}' - {entity_name} approved immediately"
                )

                # Log the special approval
                gate_log = GateLog(
                    access_type="employee",
                    entity_id=entity_id,
                    entity_name=entity_name,
                    direction=direction,
                    qr_data=qr_hash,
                    access_granted=True,
                    denial_reason=None,
                    gate_location=gate_location,
                    scanned_by=scanned_by,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    employee_id=entity_id,
                )
                db_session.add(gate_log)
                db_session.commit()

                # Emit to dashboard
                socketio.emit(
                    "gate_scan",
                    {
                        "type": "employee",
                        "name": entity_name,
                        "direction": direction,
                        "granted": True,
                        "reason": None,
                        "gate": gate_location,
                        "time": datetime.now().strftime("%H:%M:%S"),
                        "special": True,
                    },
                )

                return {
                    "entity_type": "employee",
                    "entity_id": entity_id,
                    "entity_name": entity_name,
                    "access_granted": True,
                    "denial_reason": None,
                }

    # Check expiry dates for employees - deny BEFORE status check if expired
    def is_expired(expiry_date):
        if expiry_date is None:
            return False
        return expiry_date < _utcnow()

    if entity_type == "employee" and entity:
        if is_expired(entity.medical_expiry):
            access_granted = False
            denial_reason = "Medical certificate expired"
            skip_approval = True  # Deny directly, no approval needed
        elif is_expired(entity.induction_expiry):
            access_granted = False
            denial_reason = "Induction expired"
            skip_approval = True  # Deny directly, no approval needed
        elif entity.status == "Active":
            access_granted = True
        else:
            denial_reason = "Employee not active"
    elif entity_type == "vehicle" and entity:
        if entity.status == "Active":
            access_granted = True
        else:
            denial_reason = "Vehicle not active"
    elif entity_type == "visitor" and entity:
        if entity.status == "Checked In":
            access_granted = True
        else:
            denial_reason = "Visitor not checked in"
    elif entity_type == "equipment" and entity:
        if entity.status == "Active":
            access_granted = True
        else:
            denial_reason = "Equipment not active"

    # UNIVERSAL AUTO-APPROVAL - check for recent scan for ANY QR code within 10 seconds
    # Check for recent gate log with same QR data within 10 seconds (works for all entities)
    recent_gate_log = (
        db_session.query(GateLog)
        .filter(
            GateLog.qr_data == qr_hash,  # Exact QR match
            GateLog.scanned_at
            >= _utcnow() - timedelta(seconds=10),  # Within last 10 seconds
        )
        .order_by(GateLog.scanned_at.desc())
        .first()
    )

    # Also check for recent pending approval with same QR data
    recent_approval = None
    if not recent_gate_log:
        # Get all recent pending approvals and check for exact QR match
        all_pending = (
            db_session.query(Approval)
            .filter(
                Approval.status == "Pending",
                Approval.created_at >= _utcnow() - timedelta(seconds=10),
            )
            .all()
        )

        # Check each pending approval for exact QR match
        for pending in all_pending:
            if pending.scanned_data and qr_hash in pending.scanned_data:
                try:
                    pending_data = json.loads(pending.scanned_data)
                    # Exact match on qr_code field
                    if pending_data.get("qr_code") == qr_hash:
                        recent_approval = pending
                        print(
                            "EXACT QR MATCH: Found pending approval with matching QR code"
                        )
                        break
                except Exception:
                    # If JSON parsing fails, check if raw QR is in the string
                    if qr_hash in pending.scanned_data:
                        recent_approval = pending
                        print(
                            "STRING MATCH: Found pending approval containing QR data"
                        )
                        break

    # Auto-approve on second scan within 10 seconds for ANY QR code
    if recent_gate_log or recent_approval:
        # Auto-approve on second scan within 10 seconds
        source = "gate log" if recent_gate_log else "approval"

        # Force access granted for auto-approval
        access_granted = True
        denial_reason = None

        if recent_approval:
            recent_approval.status = "Approved"
            recent_approval.approved_by = "system-auto"
            recent_approval.approval_date = _utcnow()
            recent_approval.comments = f"Auto-approved due to repeated scan within 10 seconds at {_utcnow().strftime('%H:%M:%S')}"

        print(
            f"AUTO-APPROVAL: QR {qr_hash[:30]}... auto-approved on second scan (found in {source})"
        )

        # Extract scanned data from approval or parse from QR
        scanned_data = {}
        if recent_approval and recent_approval.scanned_data:
            try:
                scanned_data = json.loads(recent_approval.scanned_data)
            except Exception:
                scanned_data = {}
        else:
            # Parse data directly from QR code
            import re

            id_match = re.search(r"ID[:\s]*(\d+)", qr_hash)
            name_match = re.search(
                r"Name\s*(?:and\s*Surname)?[:\s]*([^\|]+)", qr_hash, re.IGNORECASE
            )
            job_match = re.search(r"Job[:\s]*([^\|]+)", qr_hash, re.IGNORECASE)
            coy_match = re.search(r"Coy[:\s]*([^\|]+)", qr_hash, re.IGNORECASE)

            if id_match:
                scanned_data["employee_id"] = id_match.group(1)
            if name_match:
                scanned_data["name"] = name_match.group(1).strip()
            if job_match:
                scanned_data["position"] = job_match.group(1).strip()
            if coy_match:
                scanned_data["department"] = coy_match.group(1).strip()

        # Create employee record only if entity doesn't exist and this was an unknown entity
        if not entity:
            emp_id = (
                scanned_data.get("employee_id")
                or f"AUTO{_utcnow().strftime('%Y%m%d%H%M%S')}"
            )
            name = scanned_data.get("name") or f"Auto-{qr_hash[:20]}"
            position = scanned_data.get("position") or "Auto-approved"
            scanned_data.get("department") or "Unknown"

            existing_employee = (
                db_session.query(Employee).filter_by(emp_code=emp_id).first()
            )
            if not existing_employee:
                # Parse name into first_name and surname
                name_parts = name.split(None, 1)
                first_name = name_parts[0] if name_parts else name
                surname = name_parts[1] if len(name_parts) > 1 else ""

                new_employee = Employee(
                    emp_code=emp_id,
                    first_name=first_name,
                    surname=surname,
                    job_title=position,
                    status="Active",
                    qr_code=qr_hash,  # Store original QR for future scans
                )
                db_session.add(new_employee)
                db_session.flush()

                entity = new_employee
                entity_type = "employee"
                entity_id = new_employee.id
                entity_name = (
                    f"{new_employee.first_name} {new_employee.surname}".strip()
                )

                if recent_approval:
                    recent_approval.request_id = new_employee.id
            else:
                # Update existing employee to active
                existing_employee.status = "Active"
                entity = existing_employee
                entity_type = "employee"
                entity_id = existing_employee.id
                entity_name = f"{existing_employee.first_name} {existing_employee.surname}".strip()

                if recent_approval:
                    recent_approval.request_id = existing_employee.id

    # Initialize approval variable to prevent scope issues
    approval = None

    # Only create approval for unknown entities or pending status (not for denied expired or auto-approved)
    if not skip_approval and not access_granted:
        # Store exact raw QR data for exact matching
        scanned_details = {
            "qr_code": qr_hash,
            "raw_data": qr_hash,
        }

        # Extract fields from JSON or text-based QR format
        if qr_hash:
            is_json = False
            try:
                if qr_hash.startswith("{"):
                    parsed_json = json.loads(qr_hash)
                    if isinstance(parsed_json, dict):
                        scanned_details["employee_id"] = parsed_json.get(
                            "employee_id"
                        ) or parsed_json.get("id")
                        scanned_details["name"] = parsed_json.get("name")
                        scanned_details["position"] = parsed_json.get(
                            "position"
                        ) or parsed_json.get("job")
                        scanned_details["department"] = (
                            parsed_json.get("department")
                            or parsed_json.get("coy")
                            or parsed_json.get("company")
                        )
                        is_json = True
            except Exception:
                pass

            if not is_json:
                import re

                # Extract ID -> maps to employee_id
                id_match = re.search(r"ID[:\s]*(\d+)", qr_hash)
            if id_match:
                scanned_details["employee_id"] = id_match.group(1)

            # Extract Name -> maps to name
            name_match = re.search(
                r"Name\s*(?:and\s*Surname)?[:\s]*([^\|]+)", qr_hash, re.IGNORECASE
            )
            if name_match:
                scanned_details["name"] = name_match.group(1).strip()

            # Extract Job -> maps to position
            job_match = re.search(r"Job[:\s]*([^\|]+)", qr_hash, re.IGNORECASE)
            if job_match:
                scanned_details["position"] = job_match.group(1).strip()

            # Extract Coy (Company) -> maps to department
            coy_match = re.search(r"Coy[:\s]*([^\|]+)", qr_hash, re.IGNORECASE)
            if coy_match:
                scanned_details["department"] = coy_match.group(1).strip()

            # Extract area
            area_match = re.search(r"Area[:\s]*([^\|]+)", qr_hash, re.IGNORECASE)
            if area_match:
                scanned_details["area"] = area_match.group(1).strip()

        # Create approval request with scanned data
        approval = Approval(
            request_type="Employee QR Scan"
            if scanned_details.get("employee_id")
            else "Unknown QR Scan",
            request_id=entity_id if entity_id else 0,
            requester_name=scanned_details.get("name") or entity_name or "Unknown",
            details=f"QR scan at {gate_location} (ID: {scanned_details.get('employee_id', 'N/A')})",
            status="Pending",
            scanned_data=json.dumps(scanned_details),
            target_table="employees",  # Default to employees table
        )
        db_session.add(approval)
        db_session.commit()

        socketio.emit(
            "stats_update",
            {
                "pending_approvals": db_session.query(Approval)
                .filter_by(status="Pending")
                .count()
            },
        )

    # HANDLE EMPTY OR UNKNOWN QR CODES - Try to extract and create records from parsed data
    if not entity and not denial_reason:
        # Parse QR data to try to extract structured information
        parsed_data = decode_qr_data(qr_hash) if qr_hash else {}

        # Try to create employee from parsed data
        employee_id = parsed_data.get("employee_id") or parsed_data.get("id")
        name = parsed_data.get("name")
        position = (
            parsed_data.get("position")
            or parsed_data.get("job_title")
            or parsed_data.get("job")
        )
        (
            parsed_data.get("department")
            or parsed_data.get("coy")
            or parsed_data.get("company")
        )

        if employee_id and name:
            # Check if employee already exists by emp_code
            existing = (
                db_session.query(Employee).filter_by(emp_code=str(employee_id)).first()
            )
            if not existing:
                # Parse name into first_name and surname
                name_parts = name.split(None, 1)
                first_name = name_parts[0] if name_parts else name
                surname = name_parts[1] if len(name_parts) > 1 else ""

                new_employee = Employee(
                    emp_code=str(employee_id),
                    first_name=first_name,
                    surname=surname,
                    job_title=position or "Unknown",
                    status="Pending",  # Mark as pending until verified
                    qr_code=qr_hash,
                    id_number=str(employee_id),
                )
                db_session.add(new_employee)
                db_session.flush()

                entity = new_employee
                entity_type = "employee"
                entity_id = new_employee.id
                entity_name = (
                    f"{new_employee.first_name} {new_employee.surname}".strip()
                )
                access_granted = False  # Still deny until properly verified
                denial_reason = f"New employee created from QR: {name} ({employee_id}) - Pending verification"

                print(
                    f"AUTO-CREATED EMPLOYEE: {entity_name} ({employee_id}) from QR scan - pending verification"
                )
            else:
                # Employee exists, update QR and activate
                existing.qr_code = qr_hash
                existing.status = "Active"
                entity = existing
                entity_type = "employee"
                entity_id = existing.id
                entity_name = f"{existing.first_name} {existing.surname}".strip()
                access_granted = True
                denial_reason = None

        # Try to create vehicle from parsed data (if not employee data found)
        elif not entity:
            fleet_id = (
                parsed_data.get("fleet_id")
                or parsed_data.get("vehicle_id")
                or parsed_data.get("registration")
            )
            if fleet_id:
                existing_vehicle = (
                    db_session.query(Vehicle).filter_by(fleet_id=str(fleet_id)).first()
                )
                if not existing_vehicle:
                    new_vehicle = Vehicle(
                        fleet_id=str(fleet_id),
                        status="Pending",
                        qr_code=qr_hash,
                    )
                    db_session.add(new_vehicle)
                    db_session.flush()

                    entity = new_vehicle
                    entity_type = "vehicle"
                    entity_id = new_vehicle.id
                    entity_name = str(fleet_id)
                    access_granted = False
                    denial_reason = f"New vehicle created from QR: {fleet_id} - Pending verification"

                    print(
                        f"AUTO-CREATED VEHICLE: {fleet_id} from QR scan - pending verification"
                    )
                else:
                    # Vehicle exists, update QR and activate
                    existing_vehicle.qr_code = qr_hash
                    existing_vehicle.status = "Active"
                    entity = existing_vehicle
                    entity_type = "vehicle"
                    entity_id = existing_vehicle.id
                    entity_name = str(fleet_id)
                    access_granted = True
                    denial_reason = None

        # Create placeholder if we couldn't extract meaningful data
        if not entity:
            placeholder_id = f"PLACEHOLDER{_utcnow().strftime('%Y%m%d%H%M%S%f')[:-3]}"
            placeholder_name = (
                "Unassigned QR"
                if not qr_hash or qr_hash.strip() == ""
                else f"Unassigned-{qr_hash[:15]}"
            )

            placeholder_parts = placeholder_name.split(None, 1)
            placeholder_first = (
                placeholder_parts[0] if placeholder_parts else "Unassigned"
            )
            placeholder_surname = (
                placeholder_parts[1] if len(placeholder_parts) > 1 else "QR"
            )

            new_placeholder = Employee(
                emp_code=placeholder_id,
                first_name=placeholder_first,
                surname=placeholder_surname,
                id_number=placeholder_id,
                job_title="Pending Assignment",
                status="Pending",
                qr_code=qr_hash if qr_hash else placeholder_id,
                medical_expiry=None,
                induction_expiry=None,
            )
            db_session.add(new_placeholder)
            db_session.flush()

            entity = new_placeholder
            entity_type = "employee"
            entity_id = new_placeholder.id
            entity_name = (
                f"{new_placeholder.first_name} {new_placeholder.surname}".strip()
            )
            access_granted = False
            denial_reason = "QR not assigned - Placeholder created"

            print(
                f"PLACEHOLDER CREATED: {placeholder_id} for QR '{qr_hash[:30] if qr_hash else 'EMPTY'}'"
            )

    # NOT IN SYSTEM - set denial reason if no entity found (fallback)
    if not entity and not denial_reason:
        denial_reason = "Not registered in system"
        entity_name = entity_name or "Unknown"

    # Parse QR data for storage
    parsed_qr = (
        decode_qr_data(qr_hash) if qr_hash else {"format": "none", "raw_data": None}
    )

    # Look up gate name from IP mapping, fallback to provided gate_location
    resolved_gate_location = _get_gate_name_from_ip(
        ip_address, scanned_by, gate_location
    )

    gate_log = GateLog(
        access_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        direction=direction,
        qr_data=qr_hash,
        access_granted=access_granted,
        denial_reason=denial_reason,
        gate_location=resolved_gate_location,
        scanned_by=scanned_by,
        ip_address=ip_address,
        user_agent=user_agent,
        parsed_qr_data=json.dumps(parsed_qr) if parsed_qr else None,
        employee_id=entity_id if entity_type == "employee" else None,
        vehicle_id=entity_id if entity_type == "vehicle" else None,
        visitor_id=entity_id if entity_type == "visitor" else None,
        equipment_id=entity_id if entity_type == "equipment" else None,
    )
    db_session.add(gate_log)
    db_session.commit()

    socketio.emit(
        "gate_scan",
        {
            "type": entity_type,
            "name": entity_name,
            "direction": direction,
            "granted": access_granted,
            "reason": denial_reason,
            "gate": resolved_gate_location,
            "time": datetime.now().strftime("%H:%M:%S"),
        },
    )

    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "entity_name": entity_name,
        "access_granted": access_granted,
        "denial_reason": denial_reason,
        "parsed_qr": parsed_qr,
    }


@app.route("/kiosk")
def kiosk_scanner():
    """Full-screen kiosk page for C66 keyboard emulator and InfoWedge browser mode.
    Open this URL on the C66's browser / WebView — it captures all barcode input
    and shows a forced full-screen GREEN/RED overlay.
    """
    return render_template("kiosk_scanner.html")


@app.route("/scan/<qr_hash>")
@app.route("/s/<qr_hash>")
def universal_scan(qr_hash):
    """Visual feedback for any camera-based scanner (phone, 3rd-party app)."""
    ip_address = request.remote_addr
    user_agent = request.headers.get("User-Agent", "WebBrowser")

    result = _process_qr_scan(
        qr_hash, "AUTO", "Web Scanner", "web_browser", ip_address, user_agent
    )

    return render_template(
        "scan_result.html",
        success=result["access_granted"],
        name=result["entity_name"],
        entity_type=result["entity_type"],
        denial_reason=result["denial_reason"],
        direction=result.get("direction", "IN"),
        reset_ms=4000,
    )


@app.route("/api/scan_qr", methods=["POST"])
@require_api_key
def scan_qr_code():
    data = request.get_json()
    # 1. Normalize input
    qr_hash_raw = data.get("qr_code", "").strip() if data.get("qr_code") else None
    qr_hash = None
    if qr_hash_raw:
        if qr_hash_raw.startswith("{") and qr_hash_raw.endswith("}"):
            qr_hash = qr_hash_raw
        else:
            qr_hash = qr_hash_raw.upper()

    direction = data.get("direction", "IN")
    gate_location = data.get("gate_location", "Main Gate")
    scanned_by = data.get("scanned_by", "hardware")
    ip_address = request.remote_addr
    user_agent = request.headers.get("User-Agent", "")

    result = _process_qr_scan(
        qr_hash, direction, gate_location, scanned_by, ip_address, user_agent
    )

    # 3. Log scan decisions
    found_in = "none"
    if result["entity_type"] == "employee":
        found_in = "employees"
    elif result["entity_type"] == "vehicle":
        found_in = "vehicles"
    elif result["entity_type"] == "visitor":
        found_in = "visitors"

    if not result["access_granted"] and result["denial_reason"]:
        # Check if there's a pending approval
        pending = (
            db_session.query(Approval)
            .filter(
                Approval.status == "Pending", Approval.scanned_data.contains(qr_hash)
            )
            .first()
        )
        if pending:
            found_in = "pending"

    scan_log_data = {
        "code": qr_hash,
        "foundIn": found_in,
        "granted": result["access_granted"],
        "entity": result["entity_name"] or "Unknown",
        "direction": direction,
        "type": result["entity_type"] or "QR",
    }
    print(f"SCAN LOG: {json.dumps(scan_log_data)}", flush=True)

    # Determine status for scanner display
    is_pending = not result["access_granted"] and found_in == "pending"
    scan_status = (
        "approved"
        if result["access_granted"]
        else ("pending" if is_pending else "denied")
    )

    return jsonify(
        {
            "success": result["access_granted"],
            "message": result["denial_reason"]
            or ("Access granted" if result["access_granted"] else "Access denied"),
            "name": result["entity_name"] or "Unknown",
            "entity_type": result["entity_type"],
            "entity_name": result["entity_name"],
            "direction": direction,
            "open_gate": result["access_granted"],
            "status": scan_status,
            "denial_reason": result["denial_reason"],
            "parsed_data": result.get("parsed_qr"),
            "is_unknown": result["entity_name"] == "Unknown"
            or "Unassigned" in str(result["entity_name"]),
        }
    )


_LOCAL_PREFIXES = ("192.168.", "10.", "172.", "127.")


def _is_local_ip(ip):
    """Return True if the IP belongs to a RFC-1918 / loopback range."""
    return any(ip.startswith(p) for p in _LOCAL_PREFIXES)


@app.route("/api/scan_alt", methods=["POST"])
@limiter.limit("120 per minute")
def scan_qr_alt():
    """Alternative QR scanner endpoint - no API key required, local network only."""
    ip_address = request.remote_addr
    if not _is_local_ip(ip_address):
        return jsonify({"success": False, "message": "Local network only"}), 403
    user_agent = request.headers.get("User-Agent", "InfoWedge")
    content_type = request.content_type or ""

    if "application/json" in content_type:
        data = request.get_json(silent=True) or {}
        qr_hash = (
            data.get("qr_code")
            or data.get("barcode")
            or data.get("data")
            or data.get("barcodeData")
        )
        direction = data.get("direction", "AUTO")
        gate_location = data.get("gate_location", "C66 Scanner")
        scanned_by = data.get("scanned_by", f"infowedge:{ip_address}")
    else:
        raw = request.get_data(as_text=True).strip()
        qr_hash = raw
        direction = "AUTO"
        gate_location = "C66 Scanner"
        scanned_by = f"infowedge:{ip_address}"

    if not qr_hash:
        return jsonify(
            {"success": False, "message": "No barcode data", "open_gate": False}
        ), 400

    result = _process_qr_scan(
        qr_hash, direction, gate_location, scanned_by, ip_address, user_agent
    )
    return jsonify(
        {
            "success": result["access_granted"],
            "open_gate": result["access_granted"],
            "message": result["denial_reason"]
            or ("Access granted" if result["access_granted"] else "Access denied"),
            "name": result["entity_name"] or "Unknown",
            "entity_type": result["entity_type"],
            "entity_name": result["entity_name"],
            "direction": direction,
            "status": "approved" if result["access_granted"] else "denied",
            "denial_reason": result["denial_reason"],
            "parsed_data": result.get("parsed_qr"),
            "is_unknown": result["entity_name"] == "Unknown"
            or "Unassigned" in str(result["entity_name"]),
        }
    )


@app.route("/api/c66", methods=["POST", "GET"])
def c66_ingest():
    """Dedicated C66/InfoWedge ingest endpoint.
    Accepts: plain text body, JSON, or ?data= query param.
    No API key required — restricted to local network IPs.
    InfoWedge IP Output: set URL to http://<server>:8080/api/c66
    """
    ip_address = request.remote_addr
    user_agent = request.headers.get("User-Agent", "InfoWedge/C66")

    # Accept from local IPs only
    local_prefixes = ("192.168.", "10.", "172.", "127.")
    if not any(ip_address.startswith(p) for p in local_prefixes):
        return jsonify({"success": False, "message": "Local network only"}), 403

    content_type = request.content_type or ""
    qr_hash = None

    if "application/json" in content_type:
        data = request.get_json(silent=True) or {}
        qr_hash = (
            data.get("barcodeData")
            or data.get("barcode")
            or data.get("qr_code")
            or data.get("data")
            or data.get("barcodeStringData")
            or data.get("scanData")
        )
    elif request.args.get("data"):
        qr_hash = request.args.get("data")
    else:
        raw = request.get_data(as_text=True).strip()
        if raw:
            qr_hash = raw

    if not qr_hash:
        return "OK", 200  # InfoWedge sometimes sends empty keepalives

    qr_hash = qr_hash.strip()
    result = _process_qr_scan(
        qr_hash, "AUTO", "C66 Gate", f"c66:{ip_address}", ip_address, user_agent
    )
    _ensure_device_exists(ip_address)

    # Log scan decisions for log_viewer dashboard
    found_in = "none"
    if result["entity_type"] == "employee":
        found_in = "employees"
    elif result["entity_type"] == "vehicle":
        found_in = "vehicles"
    elif result["entity_type"] == "visitor":
        found_in = "visitors"

    if not result["access_granted"] and result["denial_reason"]:
        pending = (
            db_session.query(Approval)
            .filter(
                Approval.status == "Pending", Approval.scanned_data.contains(qr_hash)
            )
            .first()
        )
        if pending:
            found_in = "pending"

    scan_log_data = {
        "code": qr_hash,
        "foundIn": found_in,
        "granted": result["access_granted"],
        "entity": result["entity_name"] or "Unknown",
        "direction": "AUTO",
        "type": result["entity_type"] or "QR",
    }
    print(f"SCAN LOG: {json.dumps(scan_log_data)}", flush=True)

    entity_name = result.get("entity_name") or "Unknown"
    granted = result["access_granted"]
    denial = result.get("denial_reason")

    tts_msg = (
        f"Access granted. {entity_name}"
        if granted
        else f"Access denied. {denial or ''}"
    )
    if not granted and entity_name != "Unknown":
        tts_msg = f"Access denied for {entity_name}. {denial or ''}"

    try:
        socketio.emit(
            "scan_result",
            {
                "success": granted,
                "entity_name": entity_name,
                "message": denial or "",
                "scanner": ip_address,
                "protocol": "HTTP-C66",
                "notification": "approved" if granted else "denied",
                "tts_message": tts_msg,
            },
        )
    except Exception:
        pass

    return jsonify(
        {
            "success": granted,
            "open_gate": granted,
            "message": denial or ("Access granted" if granted else "Access denied"),
            "name": entity_name,
            "entity_name": entity_name,
            "entity_type": result.get("entity_type", ""),
            "status": "approved" if granted else "denied",
            "denial_reason": denial,
            "parsed_data": result.get("parsed_qr"),
            "is_unknown": entity_name == "Unknown" or "Unassigned" in str(entity_name),
            "notification": "approved" if granted else "denied",
            "tts_message": tts_msg,
        }
    )


@app.route("/message")
def message_endpoint():
    """InfoWedge connectivity check endpoint.

    InfoWedge makes GET requests to this endpoint to verify server connectivity.
    Auto-registers device on first check-in.
    """
    client_ip = request.remote_addr
    device_name = request.args.get("device", "Unknown")
    app_name = request.args.get("app", "")

    _ensure_device_exists(client_ip)
    print(f"INFOWEDGE CHECK-IN: device={device_name} app={app_name} from {client_ip}")

    return "OK", 200, {"Content-Type": "text/plain"}


@app.route("/api/scan", methods=["POST"])
@limiter.limit("120 per minute")
def scan_http():
    """Simple HTTP scan endpoint - supports JSON, form data, and plain text. Local network only.

    Allows scanners like InfoWedge to send scans via HTTP POST without configuration.
    Supports:
    - JSON: {"qr_code": "ABC123", "direction": "IN", "gate_location": "Main Gate"}
    - Form: qr_code=ABC123
    - Plain text: ABC123

    InfoWedge TCP/IP Output typically sends plain text.
    """
    ip_address = request.remote_addr
    if not _is_local_ip(ip_address):
        return jsonify({"success": False, "message": "Local network only"}), 403
    qr_code = None
    content_type = request.headers.get("Content-Type", "")

    # Handle JSON
    if "application/json" in content_type:
        data = request.get_json() or {}
        qr_code = data.get("qr_code") or data.get("code") or data.get("barcode")
    # Handle form data
    elif "application/x-www-form-urlencoded" in content_type:
        qr_code = (
            request.form.get("qr_code")
            or request.form.get("code")
            or request.form.get("barcode")
        )
    # Handle plain text (InfoWedge TCP output)
    else:
        qr_code = request.get_data(as_text=True).strip()

    if not qr_code:
        return jsonify(
            {"success": False, "message": "qr_code required", "open_gate": False}
        ), 400

    # Normalize the code
    qr_hash = qr_code.strip()
    if qr_hash.startswith("{") and qr_hash.endswith("}"):
        pass
    else:
        qr_hash = qr_hash.upper()

    # Get direction/gate_location from JSON if available
    if "application/json" in content_type:
        data = request.get_json() or {}
        direction = data.get("direction", "IN")
        gate_location = data.get("gate_location", "Main Gate")
    else:
        direction = "IN"
        gate_location = "Main Gate"

    _ensure_device_exists(ip_address)

    scanned_by = "info-wedge"

    # Process the scan
    result = _process_qr_scan(
        qr_hash, direction, gate_location, scanned_by, ip_address, "HTTP Scanner"
    )

    # Emit to web clients
    socketio.emit(
        "scan_result",
        {
            "success": result["access_granted"],
            "message": result["denial_reason"],
            "entity_type": result["entity_type"],
            "entity_name": result["entity_name"],
            "direction": direction,
            "scanner": "http",
        },
    )

    return jsonify(
        {
            "success": result["access_granted"],
            "message": result["denial_reason"] or "Access granted",
            "entity_type": result["entity_type"],
            "entity_name": result["entity_name"],
            "direction": direction,
            "open_gate": result["access_granted"],
            "status": "approved" if result["access_granted"] else "denied",
        }
    )


# ═══════════════════════════════════════════════════════════════════════
# RFID SCAN ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════


@app.route("/api/scan_rfid", methods=["POST"])
@require_api_key
def scan_rfid():
    """RFID tag scan endpoint for hardware RFID readers.

    Accepts RFID tag data from TCP/IP connected RFID scanners.
    Scanner config: IP 192.168.0.187, Port 58628, Protocol TCP

    JSON body format:
    {
        "rfid_tag": "E20034150200108022001F6D",
        "direction": "IN",
        "gate_location": "Main Gate",
        "reader_id": "RFID-001"
    }
    """
    data = request.get_json() or {}

    # Extract RFID tag data
    rfid_tag = (
        data.get("rfid_tag", "").strip().upper() if data.get("rfid_tag") else None
    )
    direction = data.get("direction", "IN")
    gate_location = data.get("gate_location", "RFID Gate")
    reader_id = data.get("reader_id", "unknown")
    ip_address = request.remote_addr
    user_agent = request.headers.get("User-Agent", "RFID Reader")

    if not rfid_tag:
        return jsonify(
            {
                "success": False,
                "message": "No RFID tag data provided",
                "open_gate": False,
                "status": "denied",
            }
        ), 400

    # Basic RFID data formatting and validation
    # Support multiple RFID formats: EPC Gen2, ISO 14443, etc.
    formatted_tag = _format_rfid_tag(rfid_tag)

    # Process RFID scan using shared logic
    result = _process_rfid_scan(
        formatted_tag, direction, gate_location, reader_id, ip_address, user_agent
    )

    # Log scan result
    found_in = "none"
    if result["entity_type"] == "employee":
        found_in = "employees"
    elif result["entity_type"] == "vehicle":
        found_in = "vehicles"
    elif result["entity_type"] == "visitor":
        found_in = "visitors"
    elif result["entity_type"] == "equipment":
        found_in = "equipment"

    print(
        f"RFID SCAN: {{ 'tag': '{formatted_tag}', 'foundIn': '{found_in}', 'granted': {result['access_granted']}, 'entity': '{result['entity_name']}', 'direction': '{direction}', 'type': '{result['entity_type']}' }}",
        flush=True,
    )

    # Emit to web clients for real-time updates
    try:
        socketio.emit(
            "rfid_scan_result",
            {
                "success": result["access_granted"],
                "entity_name": result.get("entity_name", ""),
                "message": result.get("denial_reason", ""),
                "rfid_tag": formatted_tag,
                "scanner": reader_id,
                "protocol": "RFID-TCP",
            },
        )
    except Exception:
        pass

    scan_status = "approved" if result["access_granted"] else "denied"

    return jsonify(
        {
            "success": result["access_granted"],
            "message": result["denial_reason"]
            or ("Access granted" if result["access_granted"] else "Access denied"),
            "name": result["entity_name"] or "Unknown",
            "entity_type": result["entity_type"],
            "entity_name": result["entity_name"],
            "rfid_tag": formatted_tag,
            "direction": result.get("direction", direction),
            "open_gate": result["access_granted"],
            "status": scan_status,
            "denial_reason": result["denial_reason"],
            "is_unknown": result["entity_name"] == "Unknown"
            or "Unassigned" in str(result["entity_name"]),
        }
    )


@app.route("/api/rfid_ingest", methods=["POST", "GET"])
def rfid_ingest():
    """Raw RFID TCP ingest endpoint for direct scanner connections.

    Accepts raw RFID tag data from TCP stream scanners.
    IP whitelisting recommended for 192.168.0.187 (RFID scanner)
    """
    ip_address = request.remote_addr
    user_agent = request.headers.get("User-Agent", "RFID Reader")

    # Accept from local IPs and the configured RFID scanner
    allowed_ips = ("192.168.", "10.", "172.", "127.", "192.168.0.187")
    if (
        not any(ip_address.startswith(p) for p in allowed_ips)
        and ip_address != "192.168.0.187"
    ):
        return jsonify(
            {"success": False, "message": "Local network or RFID scanner only"}
        ), 403

    content_type = request.content_type or ""
    rfid_tag = None

    if "application/json" in content_type:
        data = request.get_json(silent=True) or {}
        rfid_tag = (
            data.get("rfid_tag")
            or data.get("tag")
            or data.get("epc")
            or data.get("data")
            or data.get("uid")
        )
    elif request.args.get("tag"):
        rfid_tag = request.args.get("tag")
    elif request.args.get("rfid"):
        rfid_tag = request.args.get("rfid")
    else:
        raw = request.get_data(as_text=True).strip()
        if raw:
            rfid_tag = raw

    if not rfid_tag:
        return "OK", 200  # Keep-alive response

    # Format and process
    formatted_tag = _format_rfid_tag(rfid_tag.strip())
    result = _process_rfid_scan(
        formatted_tag, "AUTO", "RFID Gate", f"rfid:{ip_address}", ip_address, user_agent
    )

    # Emit for real-time monitoring
    try:
        socketio.emit(
            "rfid_scan_result",
            {
                "success": result["access_granted"],
                "entity_name": result.get("entity_name", ""),
                "message": result.get("denial_reason", ""),
                "rfid_tag": formatted_tag,
                "scanner": ip_address,
                "protocol": "RFID-RAW",
            },
        )
    except Exception:
        pass

    return jsonify(
        {
            "success": result["access_granted"],
            "open_gate": result["access_granted"],
            "message": result["denial_reason"]
            or ("Access granted" if result["access_granted"] else "Access denied"),
            "name": result.get("entity_name") or "Unknown",
            "entity_name": result.get("entity_name", ""),
            "entity_type": result.get("entity_type", ""),
            "rfid_tag": formatted_tag,
            "status": "approved" if result["access_granted"] else "denied",
        }
    )


def _format_rfid_tag(raw_tag):
    """Format and normalize RFID tag data from various formats.

    Supports:
    - EPC Gen2 (96-bit): E20034150200108022001F6D
    - ISO 14443A (MIFARE): 04:A2:3B:1C or 04A23B1C
    - Raw hex with/without separators
    """
    if not raw_tag:
        return None

    # Remove common separators and whitespace
    tag = raw_tag.strip().upper()
    tag = tag.replace(":", "").replace("-", "").replace(" ", "").replace(".", "")

    # Remove any prefixes some readers add
    prefixes_to_strip = ["EPC:", "UID:", "TAG:", "RFID:", "[", "]"]
    for prefix in prefixes_to_strip:
        tag = tag.replace(prefix, "")

    # Validate hex content
    if not all(c in "0123456789ABCDEF" for c in tag):
        # Non-hex tag, keep original but normalized
        return tag

    return tag


def _process_rfid_scan(
    rfid_tag, direction, gate_location, scanned_by, ip_address, user_agent
):
    """Process an RFID tag scan and return entity info and access decision.

    Similar to _process_qr_scan but looks up by rfid_tag field.
    """
    entity = None
    entity_type = None
    entity_id = None
    entity_name = None
    access_granted = False
    denial_reason = None

    # Try to find entity by RFID tag
    employee = db_session.query(Employee).filter_by(rfid_tag=rfid_tag).first()

    if employee:
        entity = employee
        entity_type = "employee"
        entity_id = employee.id
        entity_name = f"{employee.first_name} {employee.surname}"

    if not entity:
        vehicle = db_session.query(Vehicle).filter_by(rfid_tag=rfid_tag).first()
        if vehicle:
            entity = vehicle
            entity_type = "vehicle"
            entity_id = vehicle.id
            entity_name = vehicle.fleet_id

    if not entity:
        visitor = db_session.query(Visitor).filter_by(rfid_tag=rfid_tag).first()
        if visitor:
            entity = visitor
            entity_type = "visitor"
            entity_id = visitor.id
            entity_name = visitor.name

    if not entity:
        equipment = db_session.query(Equipment).filter_by(rfid_tag=rfid_tag).first()
        if equipment:
            entity = equipment
            entity_type = "equipment"
            entity_id = equipment.id
            entity_name = equipment.radio_id

    # Auto-direction logic (same as QR scan)
    if entity_id and entity_type:
        last_log = (
            db_session.query(GateLog)
            .filter(
                GateLog.entity_id == entity_id,
                GateLog.access_type == entity_type,
                GateLog.access_granted,
            )
            .order_by(GateLog.scanned_at.desc())
            .first()
        )
        if last_log and last_log.direction == "IN":
            direction = "OUT"
        else:
            direction = "IN"
    else:
        direction = "IN"
        entity_name = "Unknown"
        entity_type = "unknown"

    # Access decision logic
    if entity:
        if entity_type == "employee":
            if entity.status != "Active":
                access_granted = False
                denial_reason = f"Employee status is {entity.status}"
            else:
                access_granted = True
        elif entity_type == "vehicle":
            if entity.status != "Active":
                access_granted = False
                denial_reason = f"Vehicle status is {entity.status}"
            else:
                access_granted = True
        elif entity_type == "visitor":
            if entity.status != "Checked In":
                access_granted = False
                denial_reason = f"Visitor status is {entity.status}"
            else:
                access_granted = True
        elif entity_type == "equipment":
            if entity.status != "Active":
                access_granted = False
                denial_reason = f"Equipment status is {entity.status}"
            else:
                access_granted = True
    else:
        access_granted = False
        denial_reason = "RFID tag not registered"

    # Create gate log entry
    gate_log = GateLog(
        access_type=entity_type or "unknown",
        entity_id=entity_id,
        entity_name=entity_name,
        direction=direction,
        qr_data=rfid_tag,  # Store RFID in qr_data field for compatibility
        access_granted=access_granted,
        denial_reason=denial_reason,
        gate_location=gate_location,
        scanned_by=scanned_by,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db_session.add(gate_log)
    db_session.commit()

    return {
        "access_granted": access_granted,
        "denial_reason": denial_reason,
        "entity_type": entity_type,
        "entity_name": entity_name,
        "entity_id": entity_id,
        "direction": direction,
        "rfid_tag": rfid_tag,
    }


@app.route("/api/verify-qr", methods=["POST"])
@require_api_key
def verify_qr_mobile():
    """Mobile app QR verification endpoint - mirrors scan_qr_code with mobile-compatible response format."""
    data = request.get_json()

    # Extract and normalize fields from mobile app request
    qr_hash_raw = (data.get("qr_data") or data.get("qr_code", "")).strip()
    if qr_hash_raw.startswith("{") and qr_hash_raw.endswith("}"):
        qr_hash = qr_hash_raw
    else:
        qr_hash = qr_hash_raw.upper()

    device_info = data.get("device_info", "Mobile Scanner")
    direction = "IN"
    scanned_by = f"mobile-{request.remote_addr}"
    ip_address = request.remote_addr
    user_agent = request.headers.get("User-Agent", "")

    # Parse QR data for extraction
    parsed_qr = (
        decode_qr_data(qr_hash) if qr_hash else {"format": "none", "raw_data": None}
    )

    # Replicate scan_qr_code logic
    entity = None
    entity_type = None
    entity_id = None
    entity_name = None
    access_granted = False
    denial_reason = None

    # Try to look up by QR code hash first
    employee = db_session.query(Employee).filter_by(qr_code=qr_hash).first()

    # If not found, try to parse text-based QR (e.g., "ID: 0002235597081")
    if not employee and qr_hash:
        import re

        # Extract ID number from text format: "ID: 0002235597081" or "ID:0002235597081"
        id_match = re.search(r"ID[:\s]*(\d+)", qr_hash)
        if id_match:
            extracted_id = id_match.group(1)
            employee = (
                db_session.query(Employee)
                .filter(
                    (Employee.emp_code == extracted_id)
                    | (Employee.id_number == extracted_id)
                )
                .first()
            )

    # Check expiry dates first - BEFORE status check (expiredcert supersedes status)
    def is_expired(expiry_date):
        if expiry_date is None:
            return False
        return expiry_date < _utcnow()


    if employee:
        entity = employee
        entity_type = "employee"
        entity_id = employee.id
        entity_name = f"{employee.first_name} {employee.surname}".strip()

        # Check expiry dates FIRST - deny regardless of status if expired
        if is_expired(employee.medical_expiry):
            access_granted = False
            denial_reason = "Medical certificate expired"
        elif is_expired(employee.induction_expiry):
            access_granted = False
            denial_reason = "Induction expired"
        elif employee.status == "Active":
            access_granted = True
        else:
            denial_reason = "Employee not active"

    if not entity:
        vehicle = db_session.query(Vehicle).filter_by(qr_code=qr_hash).first()
        if vehicle:
            entity = vehicle
            entity_type = "vehicle"
            entity_id = vehicle.id
            entity_name = vehicle.fleet_id

            # Check registration expiry BEFORE status check
            if vehicle.registration_expiry and vehicle.registration_expiry < _utcnow():
                access_granted = False
                denial_reason = "Registration expired"
            elif vehicle.status == "Active":
                access_granted = True
            else:
                denial_reason = "Vehicle not active"

    if not entity:
        visitor = db_session.query(Visitor).filter_by(qr_code=qr_hash).first()
        if visitor:
            entity = visitor
            entity_type = "visitor"
            entity_id = visitor.id
            entity_name = visitor.name
            if direction == "IN":
                if visitor.status == "Checked In":
                    access_granted = True
                else:
                    denial_reason = "Visitor not checked in"
            elif direction == "OUT":
                if visitor.status == "Checked In":
                    access_granted = True
                else:
                    denial_reason = "Visitor already checked out"

    # NOT IN SYSTEM - deny immediately regardless of other factors
    if not entity:
        access_granted = False
        denial_reason = "Not registered in system"
        entity_name = "Unknown"

    # Log the scan
    gate_log = GateLog(
        access_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        direction=direction,
        qr_data=qr_hash,
        access_granted=access_granted,
        denial_reason=denial_reason,
        gate_location=device_info,
        scanned_by=scanned_by,
        ip_address=ip_address,
        user_agent=user_agent,
        parsed_qr_data=json.dumps(parsed_qr) if parsed_qr else None,
        employee_id=entity_id if entity_type == "employee" else None,
        vehicle_id=entity_id if entity_type == "vehicle" else None,
        visitor_id=entity_id if entity_type == "visitor" else None,
    )
    db_session.add(gate_log)

    if entity_type == "visitor" and access_granted and direction == "OUT":
        visitor.check_out_time = _utcnow()
        visitor.status = "Checked Out"
        db_session.commit()
    else:
        db_session.commit()

    # Emit to dashboard via socketio
    socketio.emit(
        "gate_scan",
        {
            "type": entity_type,
            "name": entity_name,
            "direction": direction,
            "granted": access_granted,
            "reason": denial_reason,
            "gate": device_info,
            "time": datetime.now().strftime("%H:%M:%S"),
        },
    )

    # Return mobile-compatible response format
    return jsonify(
        {
            "valid": access_granted,
            "message": "Access granted" if access_granted else denial_reason,
            "is_unknown": entity_name == "Unknown" or "Unassigned" in str(entity_name),
            "parsed_data": parsed_qr,
            "data": {
                "entity_type": entity_type,
                "entity_name": entity_name,
                "direction": direction,
                "open_gate": access_granted,
            },
        }
    )


@app.route("/api/verify-visitor", methods=["POST"])
def verify_visitor_mobile():
    """Mobile app visitor check-in/check-out endpoint."""
    data = request.get_json()
    qr_data = data.get("qr_data") or data.get("code", "")
    device_info = data.get("device_info", "Mobile Scanner")
    ip_address = request.remote_addr
    user_agent = request.headers.get("User-Agent", "")

    # Try to extract visitor ID from various QR formats
    visitor_id = None

    # Parse JSON format: {"type": "visitor", "id": 123, "name": "..."}
    try:
        qr_json = json.loads(qr_data)
        if qr_json.get("type") == "visitor":
            visitor_id = qr_json.get("id")
            qr_json.get("name")
    except (json.JSONDecodeError, AttributeError):
        pass

    # Look up visitor by QR code hash or ID
    visitor = None
    if visitor_id:
        visitor = db_session.query(Visitor).filter_by(id=visitor_id).first()
    if not visitor and qr_data:
        visitor = db_session.query(Visitor).filter_by(qr_code=qr_data).first()

    if not visitor:
        return jsonify(
            {
                "valid": False,
                "type": "error",
                "message": "Visitor not found",
                "visitor": None,
            }
        ), 404

    # Determine action based on current status
    is_checkin = visitor.status != "Checked In"

    if is_checkin:
        # Check in
        visitor.status = "Checked In"
        visitor.check_in_time = _utcnow()
        direction = "IN"
        result_type = "check_in"
        message = f"Welcome {visitor.name}! Check-in recorded."
    else:
        # Check out
        visitor.status = "Checked Out"
        visitor.check_out_time = _utcnow()
        direction = "OUT"
        result_type = "check_out"

        # Calculate duration
        duration = "Unknown"
        if visitor.check_in_time:
            diff = visitor.check_out_time - visitor.check_in_time
            hours = int(diff.total_seconds() // 3600)
            minutes = int((diff.total_seconds() % 3600) // 60)
            duration = f"{hours}h {minutes}m"
        message = f"Goodbye {visitor.name}! Duration: {duration}"

    db_session.commit()

    # Log the scan
    gate_log = GateLog(
        access_type="visitor",
        entity_id=visitor.id,
        entity_name=visitor.name,
        direction=direction,
        qr_data=qr_data,
        access_granted=True,
        denial_reason=None,
        gate_location=device_info,
        scanned_by=f"mobile-{ip_address}",
        ip_address=ip_address,
        user_agent=user_agent,
        visitor_id=visitor.id,
    )
    db_session.add(gate_log)
    db_session.commit()

    # Emit to dashboard
    socketio.emit(
        "gate_scan",
        {
            "type": "visitor",
            "name": visitor.name,
            "direction": direction,
            "granted": True,
            "reason": message,
            "gate": device_info,
            "time": datetime.now().strftime("%H:%M:%S"),
        },
    )

    return jsonify(
        {
            "valid": True,
            "type": result_type,
            "message": message,
            "duration": duration if not is_checkin else None,
            "visitor": {
                "id": visitor.id,
                "name": visitor.name,
                "company": visitor.company,
                "purpose": visitor.purpose,
                "status": visitor.status,
            },
        }
    )


@app.route("/api/gate_logs")
@login_required
def api_gate_logs():
    limit = request.args.get("limit", 100, type=int)
    logs = (
        db_session.query(GateLog).order_by(GateLog.scanned_at.desc()).limit(limit).all()
    )
    return jsonify(
        [
            {
                "id": log.id,
                "type": log.access_type,
                "name": log.entity_name,
                "direction": log.direction,
                "granted": log.access_granted,
                "reason": log.denial_reason,
                "gate": log.gate_location,
                "scanned_by": log.scanned_by,
                "time": log.scanned_at.strftime("%Y-%m-%d %H:%M:%S"),
            }
            for log in logs
        ]
    )


@app.route("/api/recent_activity")
@login_required
def api_recent_activity():
    try:
        today = datetime.now().date()
        today_start = datetime.combine(today, datetime.min.time())
        logs = (
            db_session.query(GateLog)
            .filter(GateLog.scanned_at >= today_start)
            .order_by(GateLog.scanned_at.desc())
            .limit(10)
            .all()
        )
        return jsonify(
            [
                {
                    "type": log.access_type,
                    "name": log.entity_name,
                    "direction": log.direction,
                    "granted": log.access_granted,
                    "reason": log.denial_reason,
                    "gate": log.gate_location,
                    "time": log.scanned_at.strftime("%H:%M:%S"),
                }
                for log in logs
            ]
        )
    except Exception:
        return jsonify([])


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint for mobile apps."""
    return jsonify(
        {
            "status": "ok",
            "service": "mine-management-api",
            "timestamp": datetime.now().isoformat(),
        }
    )


@app.route("/export/gate_logs/excel")
@login_required
@role_required(["admin"])
def export_gate_logs_excel():
    logs = (
        db_session.query(GateLog).order_by(GateLog.scanned_at.desc()).limit(50000).all()
    )
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Gate Logs"
    headers = [
        "ID",
        "Type",
        "Name",
        "Direction",
        "Granted",
        "Reason",
        "Gate",
        "Scanned By",
        "Time",
    ]
    ws.append(headers)
    for log in logs:
        ws.append(
            [
                _sanitize_cell(v)
                for v in [
                    log.id,
                    log.access_type,
                    log.entity_name,
                    log.direction,
                    "Yes" if log.access_granted else "No",
                    log.denial_reason or "",
                    log.gate_location,
                    log.scanned_by,
                    log.scanned_at.strftime("%Y-%m-%d %H:%M:%S"),
                ]
            ]
        )
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return send_file(
        output,
        as_attachment=True,
        download_name="gate_logs.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


# ------------------- Export Routes -------------------
@app.route("/export/employees/excel")
@login_required
@role_required(["admin", "manager"])
def export_employees_excel():
    employees = db_session.query(Employee).all()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Employees"
    headers = [
        "ID",
        "EmpCode",
        "Initials",
        "FirstName",
        "SecondName",
        "Surname",
        "ID Number",
        "JobTitle",
        "Induction",
        "Induction Expiry",
        "Medical",
        "Medical Expiry",
        "Status",
    ]
    ws.append(headers)
    for emp in employees:
        ws.append(
            [
                _sanitize_cell(v)
                for v in [
                    emp.id,
                    emp.emp_code,
                    emp.initials or "",
                    emp.first_name,
                    emp.second_name or "",
                    emp.surname,
                    emp.id_number,
                    emp.job_title or "",
                    emp.induction or "",
                    emp.induction_expiry.strftime("%Y-%m-%d")
                    if emp.induction_expiry
                    else "",
                    emp.medical or "",
                    emp.medical_expiry.strftime("%Y-%m-%d")
                    if emp.medical_expiry
                    else "",
                    emp.status,
                ]
            ]
        )
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return send_file(
        output,
        as_attachment=True,
        download_name="employees_report.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.route("/export/visitors/excel")
@login_required
@role_required(["admin", "manager"])
def export_visitors_excel():
    visitors = db_session.query(Visitor).all()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Visitors"
    headers = [
        "ID",
        "Name",
        "Company",
        "Purpose",
        "Host",
        "Check In",
        "Check Out",
        "Status",
    ]
    ws.append(headers)
    for visitor in visitors:
        ws.append(
            [
                _sanitize_cell(v)
                for v in [
                    visitor.id,
                    visitor.name,
                    visitor.company or "",
                    visitor.purpose or "",
                    visitor.host.name if visitor.host else "",
                    visitor.check_in_time.strftime("%Y-%m-%d %H:%M"),
                    visitor.check_out_time.strftime("%Y-%m-%d %H:%M")
                    if visitor.check_out_time
                    else "",
                    visitor.status,
                ]
            ]
        )
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return send_file(
        output,
        as_attachment=True,
        download_name="visitors_report.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.route("/export/fleet/excel")
@login_required
@role_required(["admin", "manager"])
def export_fleet_excel():
    vehicles = db_session.query(Vehicle).all()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Fleet"
    ws.append(["Fleet ID"])
    for vehicle in vehicles:
        ws.append([vehicle.fleet_id])
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return send_file(
        output,
        as_attachment=True,
        download_name="fleet_export.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.route("/export/fleet/pdf")
@login_required
@role_required(["admin", "manager"])
def export_fleet_pdf():
    vehicles = db_session.query(Vehicle).all()

    headers = ["Fleet ID"]
    data = []
    for vehicle in vehicles:
        data.append([vehicle.fleet_id])

    output = generate_pdf("Fleet Report", headers, data, None)

    return send_file(
        output,
        as_attachment=True,
        download_name="fleet_export.pdf",
        mimetype="application/pdf",
    )


@app.route("/export/equipment/excel")
@login_required
@role_required(["admin", "manager"])
def export_equipment_excel():
    items = db_session.query(Equipment).all()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Equipment"
    ws.append(["Radio ID", "Status", "Created At"])
    for item in items:
        ws.append([item.radio_id, item.status, item.created_at.strftime("%Y-%m-%d")])
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return send_file(
        output,
        as_attachment=True,
        download_name="equipment_export.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.route("/export/equipment/pdf")
@login_required
@role_required(["admin", "manager"])
def export_equipment_pdf():
    items = db_session.query(Equipment).all()

    headers = ["Radio ID", "Status", "Registered On"]
    data = []
    for item in items:
        data.append([item.radio_id, item.status, item.created_at.strftime("%Y-%m-%d")])

    output = generate_pdf("Equipment Report", headers, data, None)

    return send_file(
        output,
        as_attachment=True,
        download_name="equipment_export.pdf",
        mimetype="application/pdf",
    )


def _get_base_url():
    """Get the base URL for the system, preferring the configured SiteSetting."""
    setting = db_session.query(SiteSetting).filter_by(key="system_base_url").first()
    if setting and setting.value:
        return setting.value.rstrip("/")

    # Fallback to current request or local IP
    try:
        return request.host_url.rstrip("/")
    except Exception:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            _ip = s.getsockname()[0]
            s.close()
            return f"http://{_ip}:8080"
        except Exception:
            return "http://localhost:8080"


@app.route("/export/equipment/qr-zip")
@login_required
@role_required(["admin", "manager"])
def export_equipment_qr_zip():
    """Export all equipment QR codes as a ZIP file."""
    import zipfile

    import qrcode

    items = db_session.query(Equipment).filter(Equipment.qr_code.isnot(None)).all()
    if not items:
        return "No QR codes found for equipment. Please generate QR codes first.", 404

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        for item in items:
            # Generate QR code if missing or use radio_id as fallback
            qr_hash = item.qr_code or item.radio_id
            qr_url = f"{_get_base_url()}/s/{qr_hash}"
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(qr_url)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")

            img_buffer = io.BytesIO()
            img.save(img_buffer, format="PNG")
            zf.writestr(f"equipment_{item.radio_id}.png", img_buffer.getvalue())

    zip_buffer.seek(0)
    return send_file(
        zip_buffer,
        as_attachment=True,
        download_name="equipment_qr_codes.zip",
        mimetype="application/zip",
    )


@app.route("/export/employees/qr-zip")
@login_required
@role_required(["admin", "security"])
def export_employees_qr_zip():
    """Export all employee QR codes as a ZIP file."""
    import zipfile

    employees = db_session.query(Employee).filter(Employee.qr_code.isnot(None)).all()

    if not employees:
        return "No QR codes found for employees. Please generate QR codes first.", 404

    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for emp in employees:
            qr_url = f"{_get_base_url()}/s/{emp.qr_code}"
            qr = qrcode.QRCode(version=4, box_size=20, border=4)
            qr.add_data(qr_url)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")

            img_buffer = io.BytesIO()
            img.save(img_buffer, format="PNG")
            img_buffer.seek(0)

            filename = f"{emp.emp_code}_{emp.surname.replace(' ', '_')}_qr.png"
            zip_file.writestr(filename, img_buffer.getvalue())

    zip_buffer.seek(0)
    return send_file(
        zip_buffer,
        as_attachment=True,
        download_name="employees_qr_codes.zip",
        mimetype="application/zip",
    )


@app.route("/export/fleet/qr-zip")
@login_required
@role_required(["admin", "security"])
def export_fleet_qr_zip():
    """Export all vehicle QR codes as a ZIP file."""
    import zipfile

    vehicles = db_session.query(Vehicle).filter(Vehicle.qr_code.isnot(None)).all()

    if not vehicles:
        return "No QR codes found for vehicles. Please generate QR codes first.", 404

    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for vehicle in vehicles:
            qr_url = f"{_get_base_url()}/s/{vehicle.qr_code}"
            qr = qrcode.QRCode(version=4, box_size=20, border=4)
            qr.add_data(qr_url)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="black", back_color="white").convert(
                "RGB"
            )

            # Add text overlay with Fleet ID
            from PIL import Image as PilImage
            from PIL import ImageDraw, ImageFont

            try:
                font_large = ImageFont.truetype(
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20
                )
                font_small = ImageFont.truetype(
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16
                )
            except Exception:
                try:
                    font_large = ImageFont.truetype(
                        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
                        20,
                    )
                    font_small = ImageFont.truetype(
                        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
                        16,
                    )
                except Exception:
                    font_large = ImageFont.load_default()
                    font_small = ImageFont.load_default()

            text_padding = 65
            canvas = PilImage.new(
                "RGB", (qr_img.width, qr_img.height + text_padding), "white"
            )
            canvas.paste(qr_img, (0, 0))
            draw = ImageDraw.Draw(canvas)
            img_width = canvas.width

            # Draw Fleet ID label
            label_text = f"Fleet ID: {vehicle.fleet_id}"
            try:
                bbox = draw.textbbox((0, 0), label_text, font=font_large)
                text_width = bbox[2] - bbox[0]
            except AttributeError:
                text_width = len(label_text) * 10
            x = (img_width - text_width) // 2
            draw.text((x, qr_img.height + 8), label_text, fill="black", font=font_large)

            # Draw "Vehicle" label
            id_text = "Vehicle"
            try:
                bbox2 = draw.textbbox((0, 0), id_text, font=font_small)
                text_width2 = bbox2[2] - bbox2[0]
            except AttributeError:
                text_width2 = len(id_text) * 8
            x2 = (img_width - text_width2) // 2
            draw.text(
                (x2, qr_img.height + 34), id_text, fill="#444444", font=font_small
            )

            img_buffer = io.BytesIO()
            canvas.save(img_buffer, format="PNG")
            img_buffer.seek(0)

            filename = f"{vehicle.fleet_id.replace(' ', '_')}_qr.png"
            zip_file.writestr(filename, img_buffer.getvalue())

    zip_buffer.seek(0)
    return send_file(
        zip_buffer,
        as_attachment=True,
        download_name="fleet_qr_codes.zip",
        mimetype="application/zip",
    )


# ------------------- PDF Export Helper -------------------
class HeaderFooterCanvas:
    """Custom canvas for drawing header with logo and footer with page numbers."""

    def __init__(self, logo_path=None):
        self.logo_path = logo_path
        self.logo_available = logo_path and os.path.exists(logo_path)

    def draw_header(self, canvas, doc):
        """Draw header with logo and company name."""
        canvas.saveState()

        # Draw logo if available
        if self.logo_available:
            try:
                logo_width = 1.2 * inch
                logo_height = 0.8 * inch
                canvas.drawImage(
                    self.logo_path,
                    30,
                    doc.pagesize[1] - 50,
                    width=logo_width,
                    height=logo_height,
                    preserveAspectRatio=True,
                    anchor="nw",
                )
                text_x = 30 + logo_width + 15
            except Exception:
                text_x = 30
        else:
            text_x = 30

        # Company name and subtitle
        canvas.setFont("Helvetica-Bold", 16)
        canvas.setFillColor(colors.HexColor("#e10600"))
        canvas.drawString(text_x, doc.pagesize[1] - 35, "Arch-System")

        canvas.setFont("Helvetica", 10)
        canvas.setFillColor(colors.HexColor("#666666"))
        canvas.drawString(
            text_x, doc.pagesize[1] - 50, "Professional Mining Operations Management"
        )

        # Header line
        canvas.setStrokeColor(colors.HexColor("#e10600"))
        canvas.setLineWidth(2)
        canvas.line(
            30, doc.pagesize[1] - 65, doc.pagesize[0] - 30, doc.pagesize[1] - 65
        )

        canvas.restoreState()

    def draw_footer(self, canvas, doc):
        """Draw footer with page numbers and disclaimer."""
        canvas.saveState()

        # Footer line
        canvas.setStrokeColor(colors.HexColor("#cccccc"))
        canvas.setLineWidth(0.5)
        canvas.line(30, 50, doc.pagesize[0] - 30, 50)

        # Page number
        canvas.setFont("Helvetica", 9)
        canvas.setFillColor(colors.HexColor("#666666"))
        page_text = f"Page {doc.page}"
        canvas.drawCentredString(doc.pagesize[0] / 2, 35, page_text)

        # Disclaimer
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#999999"))
        disclaimer = "Confidential - Arch-System - Generated Report"
        canvas.drawCentredString(doc.pagesize[0] / 2, 22, disclaimer)

        # Timestamp on right
        timestamp = f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        canvas.drawRightString(doc.pagesize[0] - 30, 35, timestamp)

        canvas.restoreState()


def generate_pdf(title, headers, data, filters=None):
    """Generate a professional styled PDF report using ReportLab."""
    output = io.BytesIO()

    # Setup document with proper margins for header/footer
    doc = SimpleDocTemplate(
        output,
        pagesize=landscape(letter),
        rightMargin=30,
        leftMargin=30,
        topMargin=90,  # Space for header
        bottomMargin=70,  # Space for footer
    )

    styles = getSampleStyleSheet()
    story = []

    # Custom styles
    report_title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=22,
        textColor=colors.HexColor("#1a1a1a"),
        spaceAfter=6,
        alignment=TA_LEFT,
        fontName="Helvetica-Bold",
    )

    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=12,
        textColor=colors.HexColor("#666666"),
        spaceAfter=20,
        alignment=TA_LEFT,
    )

    filter_box_style = ParagraphStyle(
        "FilterBox",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#333333"),
        leftIndent=10,
        rightIndent=10,
        spaceAfter=6,
        leading=14,
    )

    # Report title and subtitle
    story.append(Paragraph(title, report_title_style))
    story.append(Paragraph("Detailed System Report", subtitle_style))

    # Filter information in a clean box
    active_filters = {k: v for k, v in (filters or {}).items() if v}
    if active_filters:
        filter_items = []
        for key, value in active_filters.items():
            if "date" in key.lower() and value:
                filter_items.append(f"<b>{key}:</b> {value}")
            else:
                filter_items.append(f"<b>{key}:</b> {value}")

        filter_content = " &nbsp;&nbsp;|&nbsp;&nbsp; ".join(filter_items)
        story.append(Spacer(1, 10))
        story.append(
            Paragraph(
                f"<para bgcolor='#f0f0f0' borderColor='#e10600' borderWidth='1' borderPadding='8'>"
                f"<font color='#e10600'><b>Active Filters:</b></font> {filter_content}"
                f"</para>",
                filter_box_style,
            )
        )

    # Summary stats
    story.append(Spacer(1, 15))
    stats_style = ParagraphStyle(
        "Stats",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#333333"),
    )
    story.append(Paragraph(f"<b>Total Records:</b> {len(data)}", stats_style))
    story.append(Spacer(1, 20))

    # Calculate optimal column widths based on content
    col_count = len(headers)
    available_width = doc.width

    # Default even distribution with minimum width
    col_widths = [
        max(available_width / col_count, 0.8 * inch) for _ in range(col_count)
    ]

    # Adjust specific column types
    for i, header in enumerate(headers):
        header_lower = header.lower()
        if any(
            word in header_lower for word in ["id", "time", "date", "phone", "status"]
        ):
            col_widths[i] = 0.9 * inch
        elif any(
            word in header_lower
            for word in ["name", "company", "purpose", "department", "email"]
        ):
            col_widths[i] = 1.5 * inch
        elif "position" in header_lower or "type" in header_lower:
            col_widths[i] = 1.2 * inch

    # Normalize widths to fit available space
    total_width = sum(col_widths)
    if total_width > available_width:
        scale_factor = available_width / total_width
        col_widths = [w * scale_factor for w in col_widths]

    # Create table with data
    table_data = [headers] + data
    table = Table(table_data, colWidths=col_widths, repeatRows=1)

    # Professional table styling
    table.setStyle(
        TableStyle(
            [
                # Header styling
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e10600")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                ("TOPPADDING", (0, 0), (-1, 0), 12),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                # Body styling with alternating colors
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#f8f8f8")],
                ),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 1), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 8),
                ("TOPPADDING", (0, 1), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                # Grid styling - subtle
                ("LINEBELOW", (0, 0), (-1, 0), 1.5, colors.HexColor("#e10600")),
                ("LINEABOVE", (0, 0), (-1, 0), 0, colors.transparent),
                ("LINEBELOW", (0, -1), (-1, -1), 1, colors.HexColor("#cccccc")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e0e0")),
                # Left alignment for text columns, center for others
                ("ALIGN", (0, 1), (-1, -1), "LEFT"),
            ]
        )
    )

    story.append(table)

    # Build document with custom canvas
    logo_path = os.path.join(os.path.dirname(__file__), "static", "logo-dark.png")
    header_footer = HeaderFooterCanvas(logo_path)

    def add_header_footer(canvas, doc):
        header_footer.draw_header(canvas, doc)
        header_footer.draw_footer(canvas, doc)

    doc.build(story, onFirstPage=add_header_footer, onLaterPages=add_header_footer)

    output.seek(0)
    return output


# ------------------- PDF Export Routes -------------------
@app.route("/export/gate_logs/pdf")
@login_required
@role_required(["admin"])
def export_gate_logs_pdf():
    access_type = request.args.get("type", "")
    direction = request.args.get("direction", "")
    status = request.args.get("status", "")
    date_from = request.args.get("date_from", "")
    date_to = request.args.get("date_to", "")

    query = db_session.query(GateLog).order_by(GateLog.scanned_at.desc())

    if access_type:
        query = query.filter(GateLog.access_type == access_type)
    if direction:
        query = query.filter(GateLog.direction == direction)
    if status == "granted":
        query = query.filter(GateLog.access_granted)
    elif status == "denied":
        query = query.filter(not GateLog.access_granted)
    if date_from:
        query = query.filter(
            GateLog.scanned_at >= datetime.strptime(date_from, "%Y-%m-%d")
        )
    if date_to:
        end_date = datetime.strptime(date_to, "%Y-%m-%d")
        query = query.filter(
            GateLog.scanned_at <= end_date.replace(hour=23, minute=59, second=59)
        )

    logs = query.limit(50000).all()

    headers = [
        "ID",
        "Type",
        "Name",
        "Direction",
        "Granted",
        "Reason",
        "Gate",
        "Scanned By",
        "Time",
    ]
    data = []
    for log in logs:
        data.append(
            [
                str(log.id),
                log.access_type,
                log.entity_name,
                log.direction,
                "Yes" if log.access_granted else "No",
                log.denial_reason or "",
                log.gate_location,
                log.scanned_by or "",
                log.scanned_at.strftime("%Y-%m-%d %H:%M:%S"),
            ]
        )

    filters = {
        "Type": access_type,
        "Direction": direction,
        "Status": status,
        "Date From": date_from,
        "Date To": date_to,
    }
    output = generate_pdf("Gate Access Logs Report", headers, data, filters)

    return send_file(
        output,
        as_attachment=True,
        download_name="gate_logs_report.pdf",
        mimetype="application/pdf",
    )


@app.route("/export/employees/pdf")
@login_required
@role_required(["admin", "manager"])
def export_employees_pdf():
    job_title = request.args.get("job_title", "")
    status = request.args.get("status", "")

    query = db_session.query(Employee)
    if job_title:
        query = query.filter(Employee.job_title == job_title)
    if status:
        query = query.filter(Employee.status == status)

    employees = query.all()

    headers = [
        "ID",
        "EmpCode",
        "Initials",
        "FirstName",
        "SecondName",
        "Surname",
        "ID Number",
        "JobTitle",
        "Induction",
        "Induction Expiry",
        "Medical",
        "Medical Expiry",
        "Status",
    ]
    data = []
    for emp in employees:
        data.append(
            [
                str(emp.id),
                emp.emp_code,
                emp.initials or "",
                emp.first_name,
                emp.second_name or "",
                emp.surname,
                emp.id_number,
                emp.job_title or "",
                emp.induction or "",
                emp.induction_expiry.strftime("%Y-%m-%d")
                if emp.induction_expiry
                else "",
                emp.medical or "",
                emp.medical_expiry.strftime("%Y-%m-%d") if emp.medical_expiry else "",
                emp.status,
            ]
        )

    filters = {"JobTitle": job_title, "Status": status}
    output = generate_pdf("Employee Report", headers, data, filters)

    return send_file(
        output,
        as_attachment=True,
        download_name="employees_report.pdf",
        mimetype="application/pdf",
    )


@app.route("/export/visitors/pdf")
@login_required
@role_required(["admin", "manager"])
def export_visitors_pdf():
    status = request.args.get("status", "")
    date_from = request.args.get("date_from", "")
    date_to = request.args.get("date_to", "")

    query = db_session.query(Visitor)
    if status:
        query = query.filter(Visitor.status == status)
    if date_from:
        query = query.filter(
            Visitor.check_in_time >= datetime.strptime(date_from, "%Y-%m-%d")
        )
    if date_to:
        end_date = datetime.strptime(date_to, "%Y-%m-%d")
        query = query.filter(
            Visitor.check_in_time <= end_date.replace(hour=23, minute=59, second=59)
        )

    visitors = query.all()

    headers = [
        "ID",
        "Name",
        "Company",
        "Purpose",
        "Host",
        "Check In",
        "Check Out",
        "Status",
    ]
    data = []
    for visitor in visitors:
        host_name = visitor.host.name if visitor.host else ""
        data.append(
            [
                str(visitor.id),
                visitor.name,
                visitor.company or "",
                visitor.purpose or "",
                host_name,
                visitor.check_in_time.strftime("%Y-%m-%d %H:%M")
                if visitor.check_in_time
                else "",
                visitor.check_out_time.strftime("%Y-%m-%d %H:%M")
                if visitor.check_out_time
                else "",
                visitor.status,
            ]
        )

    filters = {"Status": status, "Date From": date_from, "Date To": date_to}
    output = generate_pdf("Visitor Report", headers, data, filters)

    return send_file(
        output,
        as_attachment=True,
        download_name="visitors_report.pdf",
        mimetype="application/pdf",
    )


# ------------------- Import Routes -------------------
@app.route("/import/employees", methods=["POST"])
@login_required
@role_required(["admin", "manager"])
@limiter.limit("10 per minute")
def import_employees():
    """Import employees from Excel or CSV file."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    # Check file size (max 5MB)
    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)
    if file_size > 5 * 1024 * 1024:
        return jsonify({"error": "File too large (max 5MB)"}), 413

    try:
        # Read file based on extension
        filename = file.filename.lower()
        if filename.endswith(".csv"):
            df = pd.read_csv(file)
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(file)
        else:
            return jsonify({"error": "Invalid file format. Use .csv or .xlsx"}), 400

        # Validate required columns
        required = ["emp_code", "first_name", "surname", "id_number"]
        missing = [col for col in required if col not in df.columns]
        if missing:
            return jsonify(
                {"error": f"Missing required columns: {', '.join(missing)}"}
            ), 400

        # Get existing employee codes for duplicate checking
        existing_codes = {e.emp_code for e in db_session.query(Employee.emp_code).all()}

        imported = 0
        skipped = 0
        errors = []

        # Process each row
        for idx, row in df.iterrows():
            try:
                emp_code = str(row.get("emp_code", "")).strip()
                first_name = str(row.get("first_name", "")).strip()
                surname = str(row.get("surname", "")).strip()
                id_number = str(row.get("id_number", "")).strip()

                if not emp_code or not first_name or not surname or not id_number:
                    errors.append(f"Row {idx + 2}: Missing required field")
                    continue

                # Skip duplicates
                if emp_code in existing_codes:
                    skipped += 1
                    continue

                # Parse expiry dates
                induction_expiry = None
                if "induction_expiry" in df.columns and pd.notna(
                    row.get("induction_expiry")
                ):
                    try:
                        induction_expiry = pd.to_datetime(
                            row["induction_expiry"]
                        ).to_pydatetime()
                    except Exception:
                        errors.append(f"Row {idx + 2}: Invalid induction_expiry format")

                medical_expiry = None
                if "medical_expiry" in df.columns and pd.notna(
                    row.get("medical_expiry")
                ):
                    try:
                        medical_expiry = pd.to_datetime(
                            row["medical_expiry"]
                        ).to_pydatetime()
                    except Exception:
                        errors.append(f"Row {idx + 2}: Invalid medical_expiry format")

                # Create employee
                employee = Employee(
                    emp_code=emp_code,
                    initials=str(row.get("initials", "")).strip()
                    if pd.notna(row.get("initials"))
                    else None,
                    first_name=first_name,
                    second_name=str(row.get("second_name", "")).strip()
                    if pd.notna(row.get("second_name"))
                    else None,
                    surname=surname,
                    id_number=id_number,
                    job_title=str(row.get("job_title", "")).strip()
                    if pd.notna(row.get("job_title"))
                    else None,
                    induction=str(row.get("induction", "")).strip()
                    if pd.notna(row.get("induction"))
                    else None,
                    medical=str(row.get("medical", "")).strip()
                    if pd.notna(row.get("medical"))
                    else None,
                    induction_expiry=induction_expiry,
                    medical_expiry=medical_expiry,
                    status=str(row.get("status", "Active")).strip()
                    if pd.notna(row.get("status"))
                    else "Active",
                )

                db_session.add(employee)
                db_session.flush()  # Get ID without committing

                # Generate QR code
                qr_data = f"EMP:{employee.id}:{employee.emp_code}:{datetime.now().timestamp()}"
                employee.qr_code = hashlib.sha256(qr_data.encode()).hexdigest()[:32]

                existing_codes.add(emp_code)
                imported += 1

            except Exception as e:
                errors.append(f"Row {idx + 2}: {str(e)}")

        db_session.commit()

        return jsonify(
            {
                "imported": imported,
                "skipped": skipped,
                "errors": errors[:10],  # Limit errors returned
                "total_rows": len(df),
            }
        )

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": f"Import failed: {str(e)}"}), 500


@app.route("/import/equipment", methods=["POST"])
@login_required
@role_required(["admin", "manager"])
@limiter.limit("10 per minute")
def import_equipment():
    """Import equipment from Excel or CSV file."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    # Check file size (max 5MB)
    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)
    if file_size > 5 * 1024 * 1024:
        return jsonify({"error": "File too large (max 5MB)"}), 413

    try:
        # Read file based on extension
        filename = file.filename.lower()
        if filename.endswith(".csv"):
            df = pd.read_csv(file)
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(file)
        else:
            return jsonify({"error": "Invalid file format. Use .csv or .xlsx"}), 400

        # Validate required columns - radio_id only
        required = ["radio_id"]
        missing = [col for col in required if col not in df.columns]
        if missing:
            return jsonify({"error": "Missing required column: radio_id"}), 400

        # Get existing radio IDs for duplicate checking
        existing_ids = {
            item.radio_id for item in db_session.query(Equipment.radio_id).all()
        }

        imported = 0
        skipped = 0
        errors = []

        # Process each row
        for idx, row in df.iterrows():
            try:
                radio_id = str(row.get("radio_id", "")).strip()

                if not radio_id or radio_id.lower() == "nan":
                    errors.append(f"Row {idx + 2}: Missing radio_id")
                    continue

                # Skip duplicates
                if radio_id in existing_ids:
                    skipped += 1
                    continue

                # Create equipment
                item = Equipment(
                    radio_id=radio_id,
                    status="Active",
                )

                db_session.add(item)
                db_session.flush()

                # Generate QR code
                qr_data = f"EQP:{item.id}:{item.radio_id}:{datetime.now().timestamp()}"
                item.qr_code = hashlib.sha256(qr_data.encode()).hexdigest()[:32].upper()

                existing_ids.add(radio_id)
                imported += 1

            except Exception as e:
                errors.append(f"Row {idx + 2}: {str(e)}")

        db_session.commit()

        return jsonify(
            {
                "imported": imported,
                "skipped": skipped,
                "errors": errors[:10],
            }
        )

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/import/vehicles", methods=["POST"])
@login_required
@role_required(["admin", "manager"])
@limiter.limit("10 per minute")
def import_vehicles():
    """Import vehicles from Excel or CSV file."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    # Check file size (max 5MB)
    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)
    if file_size > 5 * 1024 * 1024:
        return jsonify({"error": "File too large (max 5MB)"}), 413

    try:
        # Read file based on extension
        filename = file.filename.lower()
        if filename.endswith(".csv"):
            df = pd.read_csv(file)
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(file)
        else:
            return jsonify({"error": "Invalid file format. Use .csv or .xlsx"}), 400

        # Validate required columns - fleet_id only
        required = ["fleet_id"]
        missing = [col for col in required if col not in df.columns]
        if missing:
            return jsonify({"error": "Missing required column: fleet_id"}), 400

        # Get existing fleet IDs for duplicate checking
        existing_ids = {v.fleet_id for v in db_session.query(Vehicle.fleet_id).all()}

        imported = 0
        skipped = 0
        errors = []

        # Process each row
        for idx, row in df.iterrows():
            try:
                fleet_id = str(row.get("fleet_id", "")).strip()

                if not fleet_id:
                    errors.append(f"Row {idx + 2}: Missing fleet_id")
                    continue

                # Skip duplicates
                if fleet_id in existing_ids:
                    skipped += 1
                    continue

                # Create vehicle - fleet_id only, default status to Active
                vehicle = Vehicle(
                    fleet_id=fleet_id,
                    status="Active",
                )

                db_session.add(vehicle)
                db_session.flush()

                # Generate QR code
                qr_data = (
                    f"VEH:{vehicle.id}:{vehicle.fleet_id}:{datetime.now().timestamp()}"
                )
                vehicle.qr_code = (
                    hashlib.sha256(qr_data.encode()).hexdigest()[:32].upper()
                )

                existing_ids.add(fleet_id)
                imported += 1

            except Exception as e:
                errors.append(f"Row {idx + 2}: {str(e)}")

        db_session.commit()

        return jsonify(
            {
                "imported": imported,
                "skipped": skipped,
                "errors": errors[:10],  # Limit errors shown
            }
        )

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/download/template/<entity_type>")
@login_required
@role_required(["admin", "manager"])
def download_import_template(entity_type):
    """Download CSV template for import."""
    if entity_type == "employees":
        output = io.StringIO()
        output.write(
            "emp_code,initials,first_name,second_name,surname,id_number,job_title,induction,induction_expiry,medical,medical_expiry,status\n"
        )
        output.write(
            "EMP001,JD,John,,Doe,ID123456789,Mine Supervisor,Standard Induction,2025-12-31,Class 1,2025-06-30,Active\n"
        )
        output.write(
            "EMP002,JS,Jane,,Smith,ID987654321,Equipment Operator,Advanced Induction,2026-06-30,Class 2,2026-03-31,Active\n"
        )
        output.write(
            "EMP003,BJ,Bob,,Johnson,ID456789123,Safety Officer,Safety Induction,2025-09-30,Class 1,2025-12-31,On Leave\n"
        )
        filename = "employees_template.csv"
    elif entity_type == "vehicles":
        output = io.StringIO()
        output.write("fleet_id\n")
        output.write("TRK001\n")
        output.write("EXC001\n")
        output.write("UTL001\n")
        filename = "vehicles_template.csv"
    elif entity_type == "equipment":
        output = io.StringIO()
        output.write("radio_id\n")
        output.write("RAD001\n")
        output.write("RAD002\n")
        output.write("RAD003\n")
        filename = "equipment_template.csv"
    else:
        return jsonify({"error": "Invalid template type"}), 400

    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode()),
        as_attachment=True,
        download_name=filename,
        mimetype="text/csv",
    )


# ------------------- AI Assistant -------------------
@app.route("/ai/chat")
@login_required
def ai_chat_page():
    """Render the AI chat interface."""
    return render_template("chat.html")


def get_system_context():
    """Build system context with live data for the AI assistant."""
    stats = {
        "employees": db_session.query(Employee).count(),
        "vehicles": db_session.query(Vehicle).count(),
        "visitors": db_session.query(Visitor).filter_by(status="Checked In").count(),
        "pending_approvals": db_session.query(Approval)
        .filter_by(status="Pending")
        .count(),
    }
    return (
        f"You are a helpful assistant for an Arch-System site management platform. "
        f"The current user is {session.get('username')} with role {session.get('role')}. "
        f"Current system stats: Employees={stats['employees']}, Vehicles={stats['vehicles']}, "
        f"Active Visitors={stats['visitors']}, Pending Approvals={stats['pending_approvals']}. "
        f"Answer questions concisely and help with site operations."
    )


def _ollama_generate(prompt, system_ctx, stream=False, use_full=False):
    """Call Ollama AI — routes to cloud or local based on provider.
    use_full=True selects the 3B model for complex analysis."""
    model = OLLAMA_MODEL_FULL if use_full else OLLAMA_MODEL

    if _ollama_provider == "cloud":
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_ctx},
                {"role": "user", "content": prompt},
            ],
            "stream": stream,
        }
        resp = requests.post(
            f"{OLLAMA_CLOUD_URL}/chat",
            headers={
                "Authorization": f"Bearer {OLLAMA_CLOUD_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            stream=stream,
            timeout=120,
        )
    else:
        payload = {
            "model": model,
            "prompt": prompt,
            "system": system_ctx,
            "stream": stream,
            "keep_alive": "10m",
        }
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=payload,
            stream=stream,
            timeout=120,
        )
    resp.raise_for_status()
    return resp


@app.route("/api/ai/chat", methods=["POST"])
@login_required
@limiter.limit("20 per minute")
def ai_chat():
    """API endpoint for AI chat - returns full response (non-streaming fallback)."""
    global _ollama_checked
    if not _ollama_available:
        _ollama_checked = False  # Allow re-check
        _check_ollama()
    if not _ollama_available:
        return jsonify({"error": "AI offline. Start Ollama with: ollama serve"}), 503

    data = request.get_json()
    user_prompt = data.get("prompt", "").strip()
    if not user_prompt:
        return jsonify({"error": "No prompt provided"}), 400

    try:
        resp = _ollama_generate(user_prompt, get_system_context(), stream=False)
        result = resp.json()
        if _ollama_provider == "cloud":
            return jsonify({"response": result.get("message", {}).get("content", "")})
        return jsonify({"response": result.get("response", "")})
    except requests.exceptions.ConnectionError:
        return jsonify(
            {"error": "Cannot reach Ollama. Is it running? (ollama serve)"}
        ), 503
    except Exception as e:
        return jsonify({"error": f"AI error: {str(e)[:200]}"}), 500


@app.route("/api/ai/chat/stream", methods=["POST"])
@login_required
@limiter.limit("20 per minute")
def ai_chat_stream():
    """Streaming endpoint for real-time AI chat responses via Ollama."""
    global _ollama_checked
    if not _ollama_available:
        _ollama_checked = False  # Allow re-check
        _check_ollama()
    if not _ollama_available:
        return jsonify({"error": "AI offline. Start Ollama with: ollama serve"}), 503

    data = request.get_json()
    user_prompt = data.get("prompt", "").strip()
    if not user_prompt:
        return jsonify({"error": "No prompt provided"}), 400

    # Capture context before entering generator (session not available inside)
    system_context = get_system_context()

    def generate():
        """Generator: stream Ollama NDJSON → SSE data: lines."""
        try:
            resp = _ollama_generate(user_prompt, system_context, stream=True)
            for line in resp.iter_lines():
                if line:
                    chunk = json.loads(line)
                    if _ollama_provider == "cloud":
                        text = chunk.get("message", {}).get("content", "")
                    else:
                        text = chunk.get("response", "")
                    if text:
                        yield f"data: {text}\n\n"
                    if chunk.get("done"):
                        break
            yield "data: [DONE]\n\n"
        except requests.exceptions.ConnectionError:
            yield "data: [ERROR] Cannot reach Ollama. Is it running?\n\n"
        except Exception as e:
            yield f"data: [ERROR] AI error: {str(e)[:200]}\n\n"

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


def get_local_ip():
    """Get the local IP address for network access."""
    try:
        # Create a socket to get the local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "localhost"


def find_available_port(start_port=5000, end_port=5100, preferred_ports=None):
    """Find an available port in the given range.

    Args:
        start_port: Start of port range to scan
        end_port: End of port range to scan
        preferred_ports: List of preferred ports to check first

    Returns:
        tuple: (available_port, scanner_port)
    """
    # Check preferred ports first
    if preferred_ports:
        for port in preferred_ports:
            if is_port_available(port):
                scanner_port = find_scanner_port(port + 1, port + 100)
                return port, scanner_port

    # Scan range for main port
    for port in range(start_port, end_port + 1):
        if is_port_available(port):
            scanner_port = find_scanner_port(port + 1, port + 100)
            return port, scanner_port

    raise RuntimeError(f"No available ports found in range {start_port}-{end_port}")


def is_port_available(port):
    """Check if a port is available for use."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex(("0.0.0.0", port))
        sock.close()
        return result != 0  # Port is available if connection fails
    except Exception:
        return False


def kill_process_on_port(port):
    """Kill any process using the specified port."""
    try:
        import signal
        import time

        print(f"Attempting to free port {port}...")

        # Method 1: Using lsof (Linux)
        try:
            result = subprocess.run(
                ["lsof", "-ti", f":{port}"], capture_output=True, text=True, timeout=5
            )
            if result.stdout.strip():
                pids = result.stdout.strip().split("\n")
                for pid in pids:
                    try:
                        os.kill(int(pid), signal.SIGTERM)
                        print(f"Killed process {pid} on port {port}")
                    except (ProcessLookupError, PermissionError):
                        # If SIGTERM fails, try SIGKILL
                        try:
                            os.kill(int(pid), signal.SIGKILL)
                            print(f"Force killed process {pid} on port {port}")
                        except Exception:
                            pass
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

        # Method 2: Using fuser (Linux)
        try:
            result = subprocess.run(
                ["fuser", "-k", f"{port}/tcp"], capture_output=True, timeout=5
            )
            if result.returncode == 0:
                print(f"fuser killed processes on port {port}")
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

        # Method 3: Using pkill with port pattern
        try:
            subprocess.run(["pkill", "-f", f":{port}"], capture_output=True, timeout=5)
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

        # Method 4: Kill any python app.py processes
        try:
            subprocess.run(
                ["pkill", "-f", "python app.py"], capture_output=True, timeout=5
            )
            print("Killed python app.py processes")
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

        # Wait a moment for processes to die
        time.sleep(3)

        # Verify port is now free
        if is_port_available(port):
            print(f"Port {port} is now available")
        else:
            print(f"Warning: Port {port} is still in use")
            # Try one more time with a different approach
            try:
                result = subprocess.run(
                    ["ss", "-tlnp"], capture_output=True, text=True, timeout=5
                )
                lines = result.stdout.split("\n")
                for line in lines:
                    if f":{port}" in line:
                        print(f"Found process on port {port}: {line}")
            except Exception:
                pass

    except Exception as e:
        print(f"Warning: Could not kill process on port {port}: {e}")


def find_scanner_port(start_port, end_port):
    """Find an available port for the scanner server."""
    for port in range(start_port, end_port + 1):
        if is_port_available(port):
            return port
    return None


def print_qr_code(url):
    """Print QR code as ASCII art in terminal."""
    qr = qrcode.QRCode(version=1, box_size=1, border=1)
    qr.add_data(url)
    qr.make(fit=True)

    CYAN = "\033[0;36m"
    NC = "\033[0m"

    print(f"\n  {CYAN}📱 Scan for mobile access:{NC}")
    matrix = qr.get_matrix()
    for row in matrix:
        line = ""
        for cell in row:
            line += "██" if cell else "  "
        print(f"  {CYAN}{line}{NC}")
    print()


# ------------------- System Monitoring -------------------
from collections import deque

# In-memory metrics storage (resets on restart)
metrics_history = {
    "cpu": deque(maxlen=60),
    "memory": deque(maxlen=60),
    "requests": deque(maxlen=60),
    "timestamps": deque(maxlen=60),
    "endpoints": {},
    "scan_stats": {"total": 0, "granted": 0, "denied": 0, "in": 0, "out": 0},
    "recent_logs": deque(maxlen=50),
}

# Track request counts for rate calculation
request_timestamps = deque(maxlen=1000)


@app.before_request
def track_request():
    """Track requests for monitoring metrics."""
    request_timestamps.append(time.time())

    # Track endpoint hits
    endpoint = request.endpoint or "unknown"
    if endpoint not in metrics_history["endpoints"]:
        metrics_history["endpoints"][endpoint] = 0
    metrics_history["endpoints"][endpoint] += 1


@app.route("/monitoring")
@login_required
@role_required(["admin"])
def monitoring():
    """System monitoring dashboard with real-time graphs."""
    return render_template("monitoring.html")


@app.route("/api/monitoring/stats")
@login_required
@role_required(["admin"])
def api_monitoring_stats():
    """Get current system stats for monitoring dashboard."""
    try:
        # Get system stats with fallback if psutil not available
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

        # Update history
        metrics_history["cpu"].append(sys_stats["cpu"])
        metrics_history["memory"].append(sys_stats["memory_percent"])
        metrics_history["requests"].append(req_per_sec)
        metrics_history["timestamps"].append(datetime.now().strftime("%H:%M:%S"))

        # Get database stats
        today = datetime.now().date()
        today_start = datetime.combine(today, datetime.min.time())

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
            "database": {
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
                    GateLog.scanned_at >= today_start, GateLog.access_granted
                )
                .count(),
                "today_denied": db_session.query(GateLog)
                .filter(
                    GateLog.scanned_at >= today_start, not GateLog.access_granted
                )
                .count(),
            },
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


@app.route("/api/monitoring/logs")
@login_required
@role_required(["admin"])
def api_monitoring_logs():
    """Get recent server logs."""
    log_file = os.path.join(os.path.dirname(__file__), "server.log")
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


@app.route("/api/monitoring/health")
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


@app.route("/api/time/sync")
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


@app.route("/api/time/status")
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


def parse_log_line(line):
    """Parse a log line into structured format."""
    result = {"raw": line, "type": "info", "timestamp": "", "message": line}

    # Try to extract timestamp
    ts_match = re.match(r"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})", line)
    if ts_match:
        result["timestamp"] = ts_match.group(1)

    # Determine log type
    if "ERROR" in line or "Exception" in line or "CRITICAL" in line:
        result["type"] = "error"
    elif "WARNING" in line or "WARN" in line:
        result["type"] = "warning"
    elif "SCAN" in line or "/api/scan_qr" in line:
        result["type"] = "scan"
        if "granted: True" in line or '"granted": true' in line.lower():
            result["status"] = "granted"
        elif "granted: False" in line or '"granted": false' in line.lower():
            result["status"] = "denied"
    elif any(method in line for method in ["GET", "POST", "PUT", "DELETE"]):
        result["type"] = "http"
        # Extract HTTP method and status
        http_match = re.search(
            r'"(GET|POST|PUT|DELETE|PATCH) ([^ ]+)[^"]*" (\d{3})', line
        )
        if http_match:
            result["method"] = http_match.group(1)
            result["path"] = http_match.group(2)
            result["status_code"] = int(http_match.group(3))

    return result


# ------------------- Health Check -------------------
@app.route("/healthz")
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


# ------------------- Database Backup -------------------
@app.route("/admin/backup/download")
@login_required
@role_required(["admin"])
def backup_download():
    """Download a live SQLite backup of the database."""
    import tempfile

    from database import database_path

    backup_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    backup_tmp.close()
    try:
        import sqlite3

        src_conn = sqlite3.connect(database_path)
        dst_conn = sqlite3.connect(backup_tmp.name)
        src_conn.backup(dst_conn)
        src_conn.close()
        dst_conn.close()
        timestamp = _utcnow().strftime("%Y%m%d_%H%M%S")
        log_audit(
            "backup",
            "database",
            None,
            f"Database backup downloaded by {session.get('username')}",
        )
        return send_file(
            backup_tmp.name,
            as_attachment=True,
            download_name=f"mine_management_backup_{timestamp}.db",
            mimetype="application/octet-stream",
        )
    except Exception as e:
        logger.error(f"Backup download failed: {e}")
        return jsonify({"error": "Backup failed", "message": str(e)}), 500


# ------------------- Teardown -------------------
@app.teardown_appcontext
def shutdown_session(exception=None):
    db_session.remove()


# ------------------- Secondary Server for Scanners (Dynamic Port) -------------------
def run_scanner_server(scanner_port, main_port):
    """Run a secondary Flask server on dynamic port for hardware scanners."""
    scanner_app = Flask(__name__)
    scanner_app.secret_key = app.secret_key

    # Add JSON error handlers
    @scanner_app.errorhandler(404)
    def json_404(error):
        return jsonify(
            {"error": "Not found", "message": "The requested resource was not found"}
        ), 404

    @scanner_app.errorhandler(405)
    def json_405(error):
        return jsonify(
            {
                "error": "Method not allowed",
                "message": "This HTTP method is not allowed for this endpoint",
            }
        ), 405

    @scanner_app.errorhandler(500)
    def json_500(error):
        return jsonify({"error": "Internal server error", "message": str(error)}), 500

    @scanner_app.route("/api/scan_qr", methods=["POST"])
    def scanner_api():
        """Forward scanner requests to the main app logic."""
        import requests

        try:
            # Forward the request to the main app on the detected port
            headers = {"X-API-Key": request.headers.get("X-API-Key", "")}
            response = requests.post(
                f"http://127.0.0.1:{main_port}/api/scan_qr",
                json=request.get_json(),
                headers=headers,
                timeout=5,
            )
            return jsonify(response.json()), response.status_code
        except requests.exceptions.ConnectionError:
            return jsonify(
                {"error": f"Main server not running on port {main_port}"}
            ), 503
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @scanner_app.route("/health", methods=["GET"])
    def health_check():
        return jsonify(
            {"status": "ok", "service": "scanner-port", "port": scanner_port}
        )

    scanner_app.run(host="0.0.0.0", port=scanner_port, threaded=True, debug=False)


def start_scanner_server(scanner_port, main_port):
    """Start the scanner server in a background thread."""
    scanner_thread = threading.Thread(
        target=run_scanner_server, args=(scanner_port, main_port), daemon=True
    )
    scanner_thread.start()


# ------------------- Scanner Discovery Service -------------------
class ScannerDiscoveryService:
    """UDP discovery service for Chainway/InfoWedge scanners."""

    def __init__(self, discovery_port=5000, response_port_range="5000-7000"):
        self.discovery_port = discovery_port
        self.port_range = response_port_range
        self.running = False
        self.thread = None
        self.local_ip = None  # Defer to start() to avoid blocking at import time
        self.auth_token = os.environ.get(
            "NETWORK_SCANNER_AUTH_TOKEN", "mine-net-scan-2024"
        )
        self.discovered_scanners = []  # Track discovered scanners

    def _get_local_ip(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"

    def run_discovery(self):
        self.running = True
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)

        try:
            sock.bind(("", self.discovery_port))
            print(
                f"✓ Scanner Discovery Service started on UDP port {self.discovery_port}"
            )

            while self.running:
                try:
                    data, addr = sock.recvfrom(1024)
                    message = data.decode("utf-8", errors="ignore").strip()

                    # Check if it's a discovery request
                    if "DISCOVER" in message.upper() or "SCANNER" in message.upper():
                        # Send server info
                        response = f"SERVER|IP:{self.local_ip}|PORTS:{self.port_range}|AUTH:{self.auth_token}|STATUS:READY"
                        sock.sendto(response.encode(), addr)
                        print(
                            f"Discovery request from {addr[0]} - responded with server info"
                        )

                        # Track discovered scanner
                        scanner_info = {
                            "ip": addr[0],
                            "port": addr[1],
                            "timestamp": datetime.now().isoformat(),
                            "message": message,
                        }

                        # Add if not already tracked
                        if not any(
                            s["ip"] == addr[0] for s in self.discovered_scanners
                        ):
                            self.discovered_scanners.append(scanner_info)

                            # Emit to dashboard
                            try:
                                socketio.emit("scanner_discovered", scanner_info)
                            except Exception:
                                pass

                except Exception as e:
                    if self.running:
                        print(f"Discovery service error: {e}")

        except Exception as e:
            print(f"Failed to start discovery service: {e}")
        finally:
            sock.close()

    def start(self):
        # Get local IP here instead of __init__ to avoid blocking socket at import time
        if self.local_ip is None:
            self.local_ip = self._get_local_ip()
        self.thread = threading.Thread(target=self.run_discovery, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)

    def get_status(self):
        return {
            "running": self.running,
            "discovery_port": self.discovery_port,
            "server_ip": self.local_ip or "127.0.0.1",
            "port_range": self.port_range,
            "discovered_scanners": self.discovered_scanners[-10:],  # Last 10 scanners
        }


# ------------------- Network Scan Listener (All Ports 5000-7000) -------------------
class NetworkScanListener:
    """TCP socket server listening on ALL ports 5000-7000 for QR scans.

    Uses select() multiplexing to handle thousands of ports efficiently.
    Completely isolated from main web server (8080) and scanner server (8081-8082).
    """

    def __init__(self, start_port=5000, end_port=5050, auth_token=None):
        self.start_port = start_port
        self.end_port = end_port
        self.auth_token = auth_token or os.environ.get(
            "NETWORK_SCANNER_AUTH_TOKEN", "mine-net-scan-2024"
        )
        self.server_sockets = {}  # port -> socket mapping
        self.active_ports = []  # List of successfully bound ports
        self.running = False
        self.thread = None
        self.connections = []
        self.max_connections = 50
        self.connection_timeout = 10

    def is_local_ip(self, ip_address):
        """Check if IP is from local network."""
        local_prefixes = [
            "192.168.",
            "10.",
            "172.16.",
            "172.17.",
            "172.18.",
            "172.19.",
            "172.20.",
            "172.21.",
            "172.22.",
            "172.23.",
            "172.24.",
            "172.25.",
            "172.26.",
            "172.27.",
            "172.28.",
            "172.29.",
            "172.30.",
            "172.31.",
            "127.0.0.1",
        ]
        return any(ip_address.startswith(prefix) for prefix in local_prefixes)

    def handle_client(self, client_socket, client_address, server_port=None):
        """Handle a single client connection - supports both JSON and raw barcode data (InfoWedge/Chainway)."""
        try:
            client_socket.settimeout(self.connection_timeout)

            # Receive data
            data_parts = []
            while True:
                chunk = client_socket.recv(4096)
                if not chunk:
                    break
                data_parts.append(chunk)
                # Break on newline/CR (InfoWedge default), closing brace (JSON), or if chunk has content
                if (
                    b"\n" in chunk
                    or b"\r" in chunk
                    or chunk.strip().endswith(b"}")
                    or len(b"".join(data_parts)) > 0
                    and not chunk
                ):
                    break
                # Also break if we got a complete short payload (raw barcode)
                if len(b"".join(data_parts)) >= 2:
                    break

            if not data_parts:
                return

            raw_data = b"".join(data_parts).decode("utf-8").strip()

            # Initialize variables
            qr_code = None
            device_id = None
            direction = "IN"
            gate_location = f"Port {server_port}" if server_port else "Network Gate"
            is_raw_format = False

            # Try to parse as JSON first
            try:
                scan_data = json.loads(raw_data)
                qr_code = scan_data.get("qr_code", "").strip()
                device_id = scan_data.get("device_id", f"network:{client_address[0]}")
                direction = scan_data.get("direction", "IN").upper()
                gate_location = scan_data.get("gate_location", gate_location)
                auth_token = scan_data.get("auth_token")

                # Validate authentication for JSON format
                if auth_token and auth_token != self.auth_token:
                    response = {"success": False, "message": "Invalid authentication"}
                    client_socket.send(json.dumps(response).encode())
                    return

            except json.JSONDecodeError:
                # Not JSON - treat as raw barcode data from InfoWedge/Chainway
                is_raw_format = True
                qr_code = raw_data.strip()

                # Check for device ID prefix (e.g., "GATE1:ABC123")
                if ":" in qr_code and not qr_code.startswith("http"):
                    parts = qr_code.split(":", 1)
                    potential_device_id = parts[0].strip()
                    potential_qr = parts[1].strip()
                    # If prefix looks like a device ID (no spaces, reasonable length)
                    if (
                        len(potential_device_id) <= 20
                        and " " not in potential_device_id
                    ):
                        device_id = f"infowedge:{potential_device_id}"
                        qr_code = potential_qr
                    else:
                        device_id = f"infowedge:{client_address[0]}:{server_port}"
                else:
                    device_id = f"infowedge:{client_address[0]}:{server_port}"

                # Validate local IP for raw connections (security)
                if not self.is_local_ip(client_address[0]):
                    print(f"Rejected external raw connection from {client_address[0]}")
                    return

            # Process the scan using EXISTING function - SAME as other scans
            result = _process_qr_scan(
                qr_hash=qr_code,
                direction=direction,
                gate_location=gate_location,
                scanned_by=device_id,
                ip_address=client_address[0],
                user_agent="InfoWedge/ChainwayC66"
                if is_raw_format
                else "NetworkScanListener/1.0",
            )

            # Create response (JSON format for both)
            response = {
                "success": result["access_granted"],
                "message": result["denial_reason"]
                if not result["access_granted"]
                else "Access granted",
                "entity_type": result["entity_type"],
                "entity_name": result["entity_name"],
                "direction": direction,
                "open_gate": result["access_granted"],
            }

            # Send response (InfoWedge may ignore this, but custom apps will use it)
            try:
                client_socket.send(json.dumps(response).encode())
            except Exception:
                pass  # InfoWedge may close connection before receiving response

            # Log with appropriate prefix
            port_info = f" on port {server_port}" if server_port else ""
            source_type = "INFOWEDGE" if is_raw_format else "NETWORK"
            print(
                f"{source_type} SCAN{port_info}: {device_id} scanned '{qr_code[:40]}' - {'GRANTED' if result['access_granted'] else 'DENIED'}"
            )

            # Emit Socket.IO event for live dashboard updates
            try:
                socketio.emit(
                    "port_activity",
                    {
                        "port": server_port,
                        "device_id": device_id,
                        "qr_code": qr_code[:30] + "..."
                        if len(qr_code) > 30
                        else qr_code,
                        "access_granted": result["access_granted"],
                        "entity_name": result.get("entity_name", "Unknown"),
                        "timestamp": datetime.now().isoformat(),
                        "total_connections": len(
                            [c for c in self.connections if c.is_alive()]
                        ),
                        "source_type": "infowedge" if is_raw_format else "network",
                    },
                )
            except Exception:
                pass  # Socket.IO emission is optional

        except TimeoutError:
            try:
                client_socket.send(
                    json.dumps(
                        {"success": False, "message": "Connection timeout"}
                    ).encode()
                )
            except Exception:
                pass
        except Exception as e:
            print(f"InfoWedge/Network handler error: {e}")
            try:
                client_socket.send(
                    json.dumps({"success": False, "message": str(e)}).encode()
                )
            except Exception:
                pass
        finally:
            try:
                client_socket.close()
            except Exception:
                pass

    def run_server(self):
        """Main server loop on all sockets, falling back to select() if poll() is unavailable."""
        self.running = True

        has_poll = hasattr(select, "poll")
        if has_poll:
            poll_obj = select.poll()
            fd_to_port = {}  # Map file descriptor to port number
            for port, sock in self.server_sockets.items():
                try:
                    if sock.fileno() != -1:
                        poll_obj.register(sock, select.POLLIN)
                        fd_to_port[sock.fileno()] = port
                except Exception as e:
                    print(f"Warning: Could not register port {port}: {e}")
        else:
            print("select.poll() not available, falling back to select.select()")

        while self.running:
            try:
                if not self.server_sockets:
                    time.sleep(1)
                    continue

                ready_socks = []
                if has_poll:
                    ready = poll_obj.poll(1000)  # 1000ms = 1 second
                    for fd, event in ready:
                        if event & select.POLLIN:
                            server_port = fd_to_port.get(fd)
                            sock = self.server_sockets.get(server_port)
                            if sock:
                                ready_socks.append((sock, server_port))
                else:
                    # Filter out invalid/closed sockets before select
                    valid_sockets = {
                        s: p for p, s in self.server_sockets.items() if s.fileno() != -1
                    }
                    if not valid_sockets:
                        time.sleep(1)
                        continue
                    r, _, _ = select.select(list(valid_sockets.keys()), [], [], 1.0)
                    ready_socks = [(sock, valid_sockets[sock]) for sock in r]

                for sock, server_port in ready_socks:
                    try:
                        client_socket, client_address = sock.accept()

                        # Check connection limit
                        if len(self.connections) >= self.max_connections:
                            try:
                                client_socket.send(
                                    json.dumps(
                                        {
                                            "success": False,
                                            "message": "Server busy, too many connections",
                                        }
                                    ).encode()
                                )
                                client_socket.close()
                            except Exception:
                                pass
                            continue

                        # Handle client in new thread (same as existing scans)
                        client_thread = threading.Thread(
                            target=self.handle_client,
                            args=(client_socket, client_address, server_port),
                            daemon=True,
                        )
                        client_thread.start()
                        self.connections.append(client_thread)

                    except Exception as e:
                        if self.running:
                            print(f"Port accept error: {e}")
                        continue

                # Cleanup finished threads
                self.connections = [t for t in self.connections if t.is_alive()]

            except Exception as e:
                if self.running:
                    print(f"Network listener error: {e}")
                time.sleep(1)

    def start(self):
        """Start the network scan listener on ALL ports 5000-7000."""
        if self.running:
            return False, "Already running"

        # Try to bind to ALL ports in range
        reserved_ports = {8080, 8081, 8082}
        success_count = 0
        fail_count = 0

        for port in range(self.start_port, self.end_port + 1):
            if port in reserved_ports:
                continue

            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                sock.bind(("0.0.0.0", port))
                sock.listen(self.max_connections)
                sock.setblocking(False)
                self.server_sockets[port] = sock
                self.active_ports.append(port)
                success_count += 1
            except Exception:
                fail_count += 1
                try:
                    sock.close()
                except Exception:
                    pass

        if not self.active_ports:
            return False, "Failed to bind to any ports in range 5000-7000"

        # Start server thread
        self.thread = threading.Thread(target=self.run_server, daemon=True)
        self.thread.start()

        print(f"✓ Network Scan Listener: {success_count} ports active (5000-7000)")
        if fail_count > 0:
            print(f"  ({fail_count} ports unavailable)")

        return True, f"Listening on {success_count} ports (5000-7000)"

    def stop(self):
        """Stop the network scan listener and close all sockets."""
        self.running = False

        # Close all server sockets
        for port, sock in list(self.server_sockets.items()):
            try:
                sock.close()
            except Exception:
                pass

        self.server_sockets.clear()
        self.active_ports.clear()

        if self.thread:
            self.thread.join(timeout=2)

        return True, "Stopped"

    def get_status(self):
        """Get current status with all active ports."""
        return {
            "running": self.running,
            "port_count": len(self.active_ports),
            "ports": self.active_ports[:20] + ["..."]
            if len(self.active_ports) > 20
            else self.active_ports,
            "port_range": f"{self.start_port}-{self.end_port}",
            "active_connections": len([t for t in self.connections if t.is_alive()]),
        }

    def get_detailed_status(self):
        """Get detailed port status with connection activity for live monitoring."""

        # Sample of active ports with connection info (limit for performance)
        active_ports = []
        sample_size = min(100, len(self.active_ports))

        for port in self.active_ports[:sample_size]:
            # Count connections for this port (estimate based on recent activity)
            conn_count = 0
            for conn in self.connections:
                if conn.is_alive():
                    conn_count += 1

            active_ports.append(
                {"port": port, "status": "listening", "connections": conn_count}
            )

        # Calculate stats
        total_conns = len([c for c in self.connections if c.is_alive()])

        return {
            "running": self.running,
            "port_count": len(self.active_ports),
            "active_ports": active_ports,
            "stats": {
                "total_listening": len(self.active_ports),
                "with_connections": min(total_conns, len(active_ports)),
                "recent_scans": total_conns,
            },
        }


# Global instances — port 9100 is dedicated for C66/InfoWedge TCP raw output
network_listener = NetworkScanListener(start_port=5000, end_port=5050)
c66_tcp_listener = NetworkScanListener(start_port=9100, end_port=9100)
discovery_service = ScannerDiscoveryService()


# API Endpoints for Network Scanner Management
@app.route("/api/network_scanner/status", methods=["GET"])
@login_required
def network_scanner_status():
    """Get network scan listener status."""
    return jsonify(network_listener.get_status())


@app.route("/api/network_scanner/start", methods=["POST"])
@login_required
@role_required(["admin"])
def network_scanner_start():
    """Start the network scan listener."""
    success, message = network_listener.start()
    return jsonify({"success": success, "message": message})


@app.route("/api/network_scanner/stop", methods=["POST"])
@login_required
@role_required(["admin"])
def network_scanner_stop():
    """Stop network scan listener."""
    success, message = network_listener.stop()
    return jsonify({"success": success, "message": message})


@app.route("/scanner-config")
@login_required
@role_required(["admin"])
def scanner_configuration():
    """Configuration page for InfoWedge/Chainway scanners."""
    return render_template(
        "scanner_config.html",
        server_ip=discovery_service.local_ip,
        port_range="5000-7000",
        discovery_port=discovery_service.discovery_port,
        auth_token=discovery_service.auth_token,
    )


@app.route("/api/scanner/discovery-status")
@login_required
def scanner_discovery_status():
    """Get discovery service status and discovered scanners."""
    return jsonify(discovery_service.get_status())


@app.route("/api/scanner/test-discovery", methods=["POST"])
@login_required
@role_required(["admin"])
def test_scanner_discovery():
    """Test discovery by broadcasting a message."""
    try:
        import socket

        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)

        # Send discovery message
        message = "DISCOVER_SCANNER_SERVER"
        sock.sendto(
            message.encode(), ("255.255.255.255", discovery_service.discovery_port)
        )
        sock.close()

        return jsonify(
            {
                "success": True,
                "message": f"Discovery test sent to UDP port {discovery_service.discovery_port}",
            }
        )
    except Exception as e:
        return jsonify(
            {"success": False, "message": f"Failed to send discovery test: {str(e)}"}
        )


@app.route("/api/network_scanner/ports", methods=["GET"])
@login_required
def network_scanner_ports():
    """Get detailed port status for live monitoring dashboard."""
    return jsonify(network_listener.get_detailed_status())


def start_network_listener():
    """Auto-start network listener, C66 TCP listener, and discovery service on app startup."""
    success, message = network_listener.start()
    if success:
        print(
            f"✓ Network scan listener started on ports {network_listener.start_port}-{network_listener.end_port}"
        )
    else:
        print(f"✗ Failed to start network scan listener: {message}")

    # Dedicated port 9100 for C66 InfoWedge IP output (TCP raw)
    ok2, msg2 = c66_tcp_listener.start()
    if ok2:
        print("✓ C66 TCP listener started on port 9100")
    else:
        print(f"  C66 port 9100: {msg2}")

    try:
        discovery_service.start()
        print(
            f"✓ Scanner discovery service started on UDP port {discovery_service.discovery_port}"
        )
    except Exception as e:
        print(f"✗ Failed to start discovery service: {e}")


# ------------------- Main -------------------
if __name__ == "__main__":
    import sys

    # Skip port management for now - use available ports
    print("Checking for available ports...")

    # Find available ports
    preferred_ports = [8080, 5000, 3000, 8000]
    try:
        main_port = 8080
        if not is_port_available(8080):
            main_port, scanner_port = find_available_port(
                start_port=5000, end_port=5100, preferred_ports=preferred_ports
            )
        else:
            # Try port 8081 first, then 8082, then find any available port
            if is_port_available(8081):
                scanner_port = 8081
            elif is_port_available(8082):
                scanner_port = 8082
            else:
                scanner_port = find_scanner_port(8083, 8200)
                if not scanner_port:
                    print("Warning: No available scanner port found, using 8083")
                    scanner_port = 8083
    except RuntimeError as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    local_ip = get_local_ip()
    server_url = f"http://{local_ip}:{main_port}"

    # ANSI color codes
    BOLD = "\033[1m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    CYAN = "\033[0;36m"
    NC = "\033[0m"  # No Color

    print("=" * 55)
    print("   Arch-System - Starting")
    print("=" * 55)
    print(f"  Port: {main_port}    Scanner: {scanner_port}")
    print("-" * 55)
    print(f"  {BOLD}{GREEN}➜ Website: {CYAN}{server_url}{NC}")
    print("-" * 55)

    # Start secondary scanner server on dynamic port
    start_scanner_server(scanner_port, main_port)

    # Start network scan listener for WiFi devices (ports 5000-7000)
    start_network_listener()

    # Start multi-port scanner listeners (UDP + broadcast + optional sniffer)
    init_all_scanner_listeners()

    # Display QR code for mobile access
    print_qr_code(server_url)

    # Open browser after server starts (in a thread so server can start first)
    def open_browser():
        import time
        import webbrowser

        time.sleep(1.5)  # Wait for server to be ready
        webbrowser.open(f"http://localhost:{main_port}")

    threading.Thread(target=open_browser, daemon=True).start()

    run_kwargs = {
        "debug": False,
        "use_reloader": False,
        "host": "0.0.0.0",
        "port": 8080,
    }
    # Only pass allow_unsafe_werkzeug to the development (werkzeug) server
    if socketio.async_mode == "threading":
        run_kwargs["allow_unsafe_werkzeug"] = True

    socketio.run(app, **run_kwargs)
