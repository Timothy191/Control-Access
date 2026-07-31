"""Authentication routes: login and logout."""

from flask import Blueprint, redirect, render_template, request, session, url_for

from extensions import limiter, _portkey_enabled, PORTKEY_API_KEY, PORTKEY_BASE_URL
from models import User
from utils import db_session, log_audit

auth_bp = Blueprint("auth", __name__)


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


@auth_bp.route("/login", methods=["GET", "POST"])
@limiter.limit("5 per minute", methods=["POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        user = db_session.query(User).filter_by(username=username).first()
        if user and user.check_password(password):
            session.permanent = True
            session["logged_in"] = True
            session["username"] = user.username
            session["user_id"] = user.id
            session["role"] = user.role
            log_audit("login", "user", user.id, f"User '{username}' logged in")

            # Auto-start Portkey connectivity check on login
            # This ensures all cached tokens will be sent to Portkey
            _check_portkey_connectivity()

            return redirect(url_for("dashboard.dashboard"))
        else:
            return render_template("login.html", error="Invalid credentials")
    return render_template("login.html")


@auth_bp.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("auth.login"))
