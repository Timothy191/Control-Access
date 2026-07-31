"""Admin routes: user management, audit logs, gate mappings, backup."""

import os
import sqlite3
import tempfile

from flask import (
    Blueprint,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    send_file,
    session,
    url_for,
)

from database import IS_SQLSERVER, database_path
from extensions import logger
from models import AuditLog, GateLog, GateMapping, SiteSetting, User
from services.security_logger import (
    log_config_change,
    log_privilege_change,
)
from utils import _utcnow, db_session, log_audit, login_required, role_required

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/admin/visitor_pin", methods=["POST"])
@login_required
@role_required(["admin"])
def update_visitor_pin():
    new_pin = request.form.get("new_pin", "").strip()
    if not new_pin:
        return redirect(url_for("visitors.visitors"))
    pin_setting = (
        db_session.query(SiteSetting).filter_by(key="visitor_request_pin").first()
    )
    old_pin = pin_setting.value if pin_setting else None
    if pin_setting:
        pin_setting.value = new_pin
    else:
        db_session.add(SiteSetting(key="visitor_request_pin", value=new_pin))
    db_session.commit()
    log_config_change(
        setting="visitor_request_pin",
        old_value="***",
        new_value="***",
        performed_by=session.get("username"),
    )
    return redirect(url_for("visitors.visitors"))


@admin_bp.route("/admin/audit_logs")
@login_required
@role_required(["admin"])
def audit_logs():
    logs = (
        db_session.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(500).all()
    )
    return render_template("audit_logs.html", logs=logs)


@admin_bp.route("/admin/users")
@login_required
@role_required(["admin"])
def manage_users():
    users = db_session.query(User).order_by(User.created_at.desc()).all()
    return render_template("users.html", users=users)


@admin_bp.route("/admin/users/add", methods=["POST"])
@login_required
@role_required(["admin"])
def add_user():
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "").strip()
    role = request.form.get("role", "user")
    if not username or not password:
        return redirect(url_for("admin.manage_users"))
    existing = db_session.query(User).filter_by(username=username).first()
    if existing:
        return redirect(url_for("admin.manage_users"))
    user = User(username=username, role=role)
    user.set_password(password)
    db_session.add(user)
    db_session.commit()
    log_audit("create", "user", user.id, f"Created user: {username} (role: {role})")
    log_privilege_change(
        target_user=username,
        action=f"created with role {role}",
        performed_by=session.get("username"),
    )
    return redirect(url_for("admin.manage_users"))


@admin_bp.route("/admin/users/edit/<int:id>", methods=["POST"])
@login_required
@role_required(["admin"])
def edit_user(id):
    user = db_session.query(User).filter_by(id=id).first()
    if not user:
        return redirect(url_for("admin.manage_users"))
    new_role = request.form.get("role", user.role)
    new_password = request.form.get("password", "").strip()
    user.role = new_role
    if new_password:
        user.set_password(new_password)
    db_session.commit()
    log_audit("update", "user", id, f"Updated user: {user.username} (role: {new_role})")
    return redirect(url_for("admin.manage_users"))


@admin_bp.route("/admin/users/delete/<int:id>", methods=["POST"])
@login_required
@role_required(["admin"])
def delete_user(id):
    user = db_session.query(User).filter_by(id=id).first()
    if user and user.username != "admin":
        name = user.username
        db_session.delete(user)
        db_session.commit()
        log_audit("delete", "user", id, f"Deleted user: {name}")
    return redirect(url_for("admin.manage_users"))


@admin_bp.route("/admin/gate_mappings")
@login_required
@role_required(["admin"])
def gate_mappings():
    """Manage gate mappings - map scanner IPs to physical gate names."""
    mappings = db_session.query(GateMapping).order_by(GateMapping.gate_name).all()

    recent_ips = (
        db_session.query(GateLog.ip_address, GateLog.scanned_by)
        .filter(
            GateLog.ip_address.isnot(None),
            GateLog.scanned_at
            >= _utcnow().replace(day=1, hour=0, minute=0, second=0),
        )
        .distinct()
        .all()
    )

    mapped_ips = {m.ip_address for m in mappings}
    unmapped = []
    for ip, scanned_by in recent_ips:
        if ip and ip not in mapped_ips:
            unmapped.append({"ip": ip, "scanned_by": scanned_by})

    return render_template("gate_mappings.html", mappings=mappings, unmapped=unmapped)


@admin_bp.route("/admin/gate_mappings/add", methods=["POST"])
@login_required
@role_required(["admin"])
def add_gate_mapping():
    """Add a new gate mapping."""
    ip_address = request.form.get("ip_address", "").strip()
    gate_name = request.form.get("gate_name", "").strip()
    description = request.form.get("description", "").strip()

    if not ip_address or not gate_name:
        flash("IP address and gate name are required", "error")
        return redirect(url_for("admin.gate_mappings"))

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

    return redirect(url_for("admin.gate_mappings"))


@admin_bp.route("/admin/gate_mappings/delete/<int:id>")
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
    return redirect(url_for("admin.gate_mappings"))


@admin_bp.route("/admin/gate_mappings/toggle/<int:id>")
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
    return redirect(url_for("admin.gate_mappings"))


@admin_bp.route("/admin/backup/download")
@login_required
@role_required(["admin"])
def backup_download():
    """Download a live SQLite backup of the database."""
    import io

    tmp_path = None
    try:
        # sqlite3.backup() requires a file-backed connection, so write to
        # a temp file first, then load it into memory and delete the file.
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".db")
        os.close(tmp_fd)

        src_conn = sqlite3.connect(database_path)
        dst_conn = sqlite3.connect(tmp_path)
        src_conn.backup(dst_conn)
        src_conn.close()
        dst_conn.close()

        with open(tmp_path, "rb") as f:
            backup_data = f.read()

        timestamp = _utcnow().strftime("%Y%m%d_%H%M%S")
        log_audit(
            "backup",
            "database",
            None,
            f"Database backup downloaded by {session.get('username')}",
        )
        return send_file(
            io.BytesIO(backup_data),
            as_attachment=True,
            download_name=f"mine_management_backup_{timestamp}.db",
            mimetype="application/octet-stream",
        )
    except Exception as e:
        logger.error(f"Backup download failed: {e}")
        return jsonify({"error": "Backup failed", "message": str(e)}), 500
    finally:
        # Always clean up the temp file from disk
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


@admin_bp.route("/admin/sharepoint/sync", methods=["POST"])
@login_required
@role_required(["admin", "manager"])
def sharepoint_sync_route():
    """Trigger manual synchronization of employee data from SharePoint list."""
    from services.sharepoint_sync import sharepoint_sync

    result = sharepoint_sync.sync_employees_from_sharepoint()
    if result["success"]:
        flash(
            f"SharePoint sync complete: {result['added']} added, {result['updated']} updated.",
            "success",
        )
    else:
        err_msg = ", ".join(result.get("errors", ["Unknown error"]))
        flash(f"SharePoint sync failed: {err_msg}", "danger")
    return redirect(url_for("employees.employees"))


@admin_bp.route("/api/sharepoint/sync", methods=["POST"])
@login_required
@role_required(["admin", "manager"])
def api_sharepoint_sync():
    """API endpoint to trigger SharePoint employee sync."""
    from services.sharepoint_sync import sharepoint_sync

    result = sharepoint_sync.sync_employees_from_sharepoint()
    status_code = 200 if result["success"] else 400
    return jsonify(result), status_code

