"""Authentication routes: login, logout, and MFA."""

import base64
import hashlib
import secrets
from io import BytesIO

import pyotp
import qrcode
from flask import (
    Blueprint,
    Response,
    abort,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

from extensions import PORTKEY_API_KEY, PORTKEY_BASE_URL, _portkey_enabled, limiter
from models import User
from services.security_logger import log_login_failed, log_mfa_failed, log_privilege_change
from utils import db_session, log_audit, login_required, role_required

auth_bp = Blueprint("auth", __name__)

# Roles that must use MFA once it is enabled for the account
_MFA_REQUIRED_ROLES = {"admin", "manager", "security"}


def _check_portkey_connectivity():
    """Verify Portkey gateway connectivity on login.

    When _portkey_enabled is True, this performs a lightweight health check
    to ensure the Portkey API key is valid and the gateway is reachable.
    The result is cached in the session for the duration of the login.
    """
    if not _portkey_enabled:
        return

    import requests

    try:
        resp = requests.get(
            f"{PORTKEY_BASE_URL}/chat/completions",
            headers={"x-portkey-api-key": PORTKEY_API_KEY},
            timeout=5,
        )
        # A 400/401 indicates the key is invalid, but the gateway is reachable
        # A 405/404 is expected since GET isn't a valid method for this endpoint
        if resp.status_code in (200, 400, 401, 405):
            session["portkey_ready"] = True
        else:
            session["portkey_ready"] = False
    except Exception:
        session["portkey_ready"] = False


def _hash_backup_code(code):
    """Return a deterministic hash of a backup code."""
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _generate_backup_codes(count=8):
    """Generate a list of single-use backup codes."""
    return [secrets.token_hex(4).upper() for _ in range(count)]


def _verify_totp(user, token):
    """Verify a TOTP token against the user's secret."""
    if not user.totp_secret:
        return False
    try:
        totp = pyotp.TOTP(user.totp_secret)
        return totp.verify(token, valid_window=1)
    except Exception:
        return False


def _verify_backup_code(user, token):
    """Verify a backup code and remove it so it cannot be reused."""
    if not user.mfa_backup_codes:
        return False
    codes = [c.strip() for c in user.mfa_backup_codes.split() if c.strip()]
    token_hash = _hash_backup_code(token)
    if token_hash in codes:
        codes.remove(token_hash)
        user.mfa_backup_codes = " ".join(codes)
        db_session.commit()
        return True
    return False


def _login_user(user):
    """Complete login and refresh session."""
    session.permanent = True
    session["logged_in"] = True
    session["username"] = user.username
    session["user_id"] = user.id
    session["role"] = user.role
    session.pop("mfa_pending_user_id", None)
    session.pop("mfa_setup_required", None)
    log_audit("login", "user", user.id, f"User '{user.username}' logged in")
    _check_portkey_connectivity()


@auth_bp.route("/login", methods=["GET", "POST"])
@limiter.limit("5 per minute", methods=["POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        user = db_session.query(User).filter_by(username=username).first()
        if not user or not user.check_password(password):
            log_audit(
                "login_failed",
                "user",
                user.id if user else None,
                f"Failed login attempt for username '{username}'",
            )
            log_login_failed(username=username, reason="Invalid credentials")
            return render_template("login.html", error="Invalid credentials")

        # MFA required for privileged roles or if explicitly enabled
        requires_mfa = user.mfa_enabled or user.role in _MFA_REQUIRED_ROLES
        if requires_mfa:
            if not user.mfa_enabled:
                # Force MFA setup on next login; store pending auth in session
                session["mfa_pending_user_id"] = user.id
                session["mfa_setup_required"] = True
                return redirect(url_for("auth.mfa_setup"))
            session["mfa_pending_user_id"] = user.id
            return redirect(url_for("auth.mfa_challenge"))

        _login_user(user)
        return redirect(url_for("dashboard.dashboard"))
    return render_template("login.html")


@auth_bp.route("/mfa/challenge", methods=["GET", "POST"])
@limiter.limit("10 per minute", methods=["POST"])
def mfa_challenge():
    """Step 2 of login: verify TOTP or backup code."""
    user_id = session.get("mfa_pending_user_id")
    if not user_id:
        return redirect(url_for("auth.login"))

    user = db_session.query(User).filter_by(id=user_id).first()
    if not user:
        session.clear()
        return redirect(url_for("auth.login"))

    if request.method == "POST":
        token = request.form.get("token", "").strip().replace(" ", "")
        if _verify_totp(user, token) or _verify_backup_code(user, token):
            _login_user(user)
            return redirect(url_for("dashboard.dashboard"))
        log_audit(
            "mfa_failed",
            "user",
            user.id,
            f"Failed MFA attempt for user '{user.username}'",
        )
        log_mfa_failed(username=user.username, reason="Invalid code")
        return render_template("mfa_challenge.html", error="Invalid code")

    return render_template("mfa_challenge.html", username=user.username)


@auth_bp.route("/mfa/setup", methods=["GET", "POST"])
@limiter.limit("10 per minute", methods=["POST"])
def mfa_setup():
    """Allow a user to set up TOTP MFA."""
    user_id = session.get("mfa_pending_user_id") or session.get("user_id")
    if not user_id:
        return redirect(url_for("auth.login"))

    user = db_session.query(User).filter_by(id=user_id).first()
    if not user:
        return redirect(url_for("auth.login"))

    if request.method == "GET":
        if not user.totp_secret:
            user.totp_secret = pyotp.random_base32()
            db_session.commit()
        totp = pyotp.TOTP(user.totp_secret)
        provisioning_uri = totp.provisioning_uri(
            name=user.username,
            issuer_name="Arch-System",
        )
        qr = qrcode.make(provisioning_uri)
        buf = BytesIO()
        qr.save(buf, format="PNG")
        qr_b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        return render_template(
            "mfa_setup.html",
            qr_b64=qr_b64,
            secret=user.totp_secret,
            username=user.username,
        )

    token = request.form.get("token", "").strip().replace(" ", "")
    if _verify_totp(user, token):
        user.mfa_enabled = True
        codes = _generate_backup_codes()
        user.mfa_backup_codes = " ".join(_hash_backup_code(c) for c in codes)
        db_session.commit()
        log_audit("mfa_enabled", "user", user.id, "MFA enabled")
        if session.get("mfa_setup_required") or not session.get("logged_in"):
            _login_user(user)
        return render_template(
            "mfa_setup.html",
            success=True,
            backup_codes=codes,
            username=user.username,
        )

    log_audit("mfa_setup_failed", "user", user.id, "MFA setup verification failed")
    return render_template(
        "mfa_setup.html",
        error="Invalid code",
        secret=user.totp_secret,
        username=user.username,
    )


@auth_bp.route("/mfa/qr")
def mfa_qr():
    """Serve the MFA setup QR code as an image (for users already logged in)."""
    if not session.get("logged_in") and not session.get("mfa_pending_user_id"):
        abort(403)
    user_id = session.get("user_id") or session.get("mfa_pending_user_id")
    user = db_session.query(User).filter_by(id=user_id).first()
    if not user or not user.totp_secret:
        abort(404)
    totp = pyotp.TOTP(user.totp_secret)
    qr = qrcode.make(totp.provisioning_uri(name=user.username, issuer_name="Arch-System"))
    buf = BytesIO()
    qr.save(buf, format="PNG")
    buf.seek(0)
    return Response(buf.getvalue(), mimetype="image/png")


@auth_bp.route("/api/mfa/reset", methods=["POST"])
@login_required
@role_required(["admin"])
def reset_mfa():
    """Admin endpoint to reset MFA for another user."""
    data = request.get_json() or {}
    username = data.get("username")
    user = db_session.query(User).filter_by(username=username).first()
    if not user:
        return jsonify({"error": "User not found"}), 404
    user.totp_secret = None
    user.mfa_enabled = False
    user.mfa_backup_codes = None
    db_session.commit()
    log_audit("mfa_reset", "user", user.id, f"MFA reset by {session.get('username')}")
    return jsonify({"success": True, "message": f"MFA reset for {username}"})


@auth_bp.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("auth.login"))
