"""Shared utilities to avoid circular imports."""
import hmac
import os
from datetime import UTC, datetime
from functools import wraps

from flask import flash, jsonify, redirect, request, session, url_for

from database import db_session
from extensions import logger
from models import AuditLog
from services.security_logger import log_api_key_failed


def _utcnow():
    """Return current UTC as naive datetime (SQLite compat)."""
    return datetime.now(UTC).replace(tzinfo=None)


def login_required(f):
    """Decorator to require login."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("logged_in"):
            flash("Please log in to access this page.", "error")
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return decorated_function


def role_required(allowed_roles):
    """Decorator to require specific roles."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not session.get("logged_in"):
                return redirect(url_for("auth.login"))
            if session.get("role") not in allowed_roles:
                return "Access denied", 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def require_api_key(f):
    """Decorator to require API key authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        key = request.headers.get("X-API-Key")
        _hardware_key = os.environ.get("HARDWARE_API_KEY", "")
        _mobile_key = os.environ.get("MOBILE_API_KEY", "")
        valid_keys = [k for k in [_hardware_key, _mobile_key] if k]
        client_ip = request.remote_addr

        if not valid_keys:
            logger.error(
                f"API authentication not configured — rejecting request from {client_ip}. "
                "Set HARDWARE_API_KEY or MOBILE_API_KEY environment variable."
            )
            return jsonify({"error": "API authentication not configured"}), 500

        if not key or not any(hmac.compare_digest(key, vk) for vk in valid_keys):
            # Log failed authentication attempts for security monitoring
            if key:
                logger.warning(
                    f"Invalid API key attempt from {client_ip} "
                    f"(key prefix: {key[:8]}...)"
                )
                log_api_key_failed(
                    reason="Invalid API key", key_prefix=key[:8] if len(key) >= 8 else key
                )
            else:
                logger.warning(f"Missing API key attempt from {client_ip}")
                log_api_key_failed(reason="Missing API key")
            return jsonify({"error": "Invalid API key"}), 401

        return f(*args, **kwargs)

    return decorated


def log_audit(action, entity_type, entity_id=None, details=None):
    """Log an action to the audit log."""
    from flask import request
    try:
        audit = AuditLog(
            user=session.get("username", "system"),
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            ip_address=request.remote_addr if request else None,
        )
        db_session.add(audit)
        db_session.commit()
    except Exception as e:
        print(f"Failed to log audit: {e}")
        db_session.rollback()


__all__ = [
    "_utcnow",
    "login_required",
    "role_required",
    "require_api_key",
    "log_audit",
    "db_session",
]
