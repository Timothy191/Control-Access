"""Structured security logging and SIEM forwarding.

This module emits security-relevant events in JSON format to a dedicated log
file and, if configured, forwards them to a SIEM endpoint. Events include
authentication failures, privilege changes, denied access attempts, bulk
exports, and configuration changes.
"""

import json
import logging
import logging.handlers
import os
import socket
from datetime import UTC, datetime

from flask import request, session

# SIEM endpoint configuration
_SIEM_URL = os.environ.get("SIEM_URL", "")
_SIEM_TOKEN = os.environ.get("SIEM_TOKEN", "")
_SIEM_TYPE = os.environ.get("SIEM_TYPE", "").lower()  # http, hec, syslog
_SYSLOG_HOST = os.environ.get("SYSLOG_HOST", "")
_SYSLOG_PORT = int(os.environ.get("SYSLOG_PORT", "514"))

_SECURITY_LOG_FILE = os.environ.get("SECURITY_LOG_FILE", "security.log")
_SECURITY_LOG_MAX_BYTES = int(os.environ.get("SECURITY_LOG_MAX_BYTES", "10_000_000"))
_SECURITY_LOG_BACKUP_COUNT = int(os.environ.get("SECURITY_LOG_BACKUP_COUNT", "5"))


def _get_json_formatter():
    return logging.Formatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )


# Dedicated security logger
security_logger = logging.getLogger("controlaccess.security")
security_logger.propagate = False

if not security_logger.handlers:
    if _SECURITY_LOG_FILE:
        handler = logging.handlers.RotatingFileHandler(
            _SECURITY_LOG_FILE,
            maxBytes=_SECURITY_LOG_MAX_BYTES,
            backupCount=_SECURITY_LOG_BACKUP_COUNT,
        )
        handler.setFormatter(_get_json_formatter())
        security_logger.addHandler(handler)
    # Also emit to stderr if no file configured
    if not _SECURITY_LOG_FILE:
        console = logging.StreamHandler()
        console.setFormatter(_get_json_formatter())
        security_logger.addHandler(console)

security_logger.setLevel(logging.INFO)


def _now_iso():
    return datetime.now(UTC).replace(tzinfo=None).isoformat()


def _request_context():
    """Gather request context safely (works outside request context)."""
    ctx = {}
    try:
        if request:
            ctx["ip_address"] = request.remote_addr
            ctx["user_agent"] = request.headers.get("User-Agent", "")
            ctx["endpoint"] = request.endpoint
            ctx["method"] = request.method
            ctx["path"] = request.path
    except RuntimeError:
        pass
    try:
        if session:
            ctx["session_user"] = session.get("username")
            ctx["session_role"] = session.get("role")
    except RuntimeError:
        pass
    return ctx


def log_security_event(event_type, severity="info", details=None, entity_type=None, entity_id=None):
    """Emit a structured security event.

    Args:
        event_type: Short event name, e.g. login_failed, access_denied, export.
        severity: info, warning, error, critical.
        details: Dict or string with event details.
        entity_type: Optional entity category (employee, vehicle, user, etc.).
        entity_id: Optional entity identifier.
    """
    payload = {
        "timestamp": _now_iso(),
        "host": socket.gethostname(),
        "event_type": event_type,
        "severity": severity,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
    }
    payload.update(_request_context())

    # Emit to local security log
    message = json.dumps(payload, default=str)
    level = getattr(logging, severity.upper(), logging.INFO)
    security_logger.log(level, message)

    # Forward to SIEM if configured
    if _SIEM_URL:
        _forward_to_siem(payload)
    elif _SIEM_TYPE == "syslog" and _SYSLOG_HOST:
        _forward_to_syslog(payload)


def _forward_to_siem(payload):
    """Forward a security event to an HTTP/HEC SIEM endpoint."""
    try:
        import requests

        headers = {"Content-Type": "application/json"}
        if _SIEM_TOKEN:
            if _SIEM_TYPE == "hec":
                headers["Authorization"] = f"Splunk {_SIEM_TOKEN}"
            else:
                headers["Authorization"] = f"Bearer {_SIEM_TOKEN}"
        requests.post(
            _SIEM_URL,
            json=payload,
            headers=headers,
            timeout=5,
        )
    except Exception:
        # Never fail a request because SIEM is unavailable
        pass


def _forward_to_syslog(payload):
    """Forward a security event via RFC 5424-ish syslog over UDP."""
    try:
        data = json.dumps(payload, default=str)
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.sendto(data.encode("utf-8"), (_SYSLOG_HOST, _SYSLOG_PORT))
        sock.close()
    except Exception:
        pass


# Convenience helpers for common security events

def log_login_failed(username=None, reason="Invalid credentials"):
    log_security_event(
        "login_failed",
        severity="warning",
        details={"username": username, "reason": reason},
        entity_type="user",
    )


def log_mfa_failed(username=None, reason="Invalid code"):
    log_security_event(
        "mfa_failed",
        severity="warning",
        details={"username": username, "reason": reason},
        entity_type="user",
    )


def log_api_key_failed(reason="Invalid API key", key_prefix=None):
    log_security_event(
        "api_key_failed",
        severity="warning",
        details={"reason": reason, "key_prefix": key_prefix},
        entity_type="api",
    )


def log_access_denied(entity_type, entity_id, entity_name, reason, gate=None):
    log_security_event(
        "access_denied",
        severity="warning",
        details={
            "entity_name": entity_name,
            "reason": reason,
            "gate": gate,
        },
        entity_type=entity_type,
        entity_id=entity_id,
    )


def log_privilege_change(target_user, action, performed_by=None):
    log_security_event(
        "privilege_change",
        severity="info",
        details={"target_user": target_user, "action": action, "performed_by": performed_by},
        entity_type="user",
    )


def log_bulk_export(export_type, record_count, filters=None):
    log_security_event(
        "bulk_export",
        severity="info",
        details={"export_type": export_type, "record_count": record_count, "filters": filters or {}},
        entity_type="export",
    )


def log_config_change(setting, old_value, new_value, performed_by=None):
    log_security_event(
        "config_change",
        severity="info",
        details={
            "setting": setting,
            "old_value": old_value,
            "new_value": new_value,
            "performed_by": performed_by,
        },
        entity_type="config",
    )


def log_csrf_failure(endpoint=None):
    log_security_event(
        "csrf_failure",
        severity="warning",
        details={"endpoint": endpoint},
        entity_type="security",
    )
