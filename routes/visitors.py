"""Visitor CRUD routes."""

from datetime import datetime

from flask import (
    Blueprint,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

from utils import _utcnow, db_session, log_audit, login_required, role_required
from extensions import socketio
from models import Approval, Employee, GateLog, SiteSetting, Visitor
from routes.dashboard import invalidate_dashboard_cache
from routes.monitoring import invalidate_monitoring_cache

visitors_bp = Blueprint("visitors", __name__)


@visitors_bp.route("/visitors")
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
        end_date = datetime.strptime(date_to, "%Y-%m-%d")
        query = query.filter(
            Visitor.check_in_time < end_date.replace(hour=23, minute=59, second=59)
        )

    visitors = query.all()
    employees = db_session.query(Employee).all()

    visitor_logs = (
        db_session.query(GateLog)
        .filter_by(access_type="visitor")
        .order_by(GateLog.scanned_at.desc())
        .limit(200)
        .all()
    )

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


@visitors_bp.route("/checkin_visitor", methods=["POST"])
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
    invalidate_dashboard_cache()
    invalidate_monitoring_cache()
    socketio.emit("visitor_checkin", {"name": visitor.name})
    return redirect(url_for("visitors.visitors"))


@visitors_bp.route("/checkout_visitor/<int:id>")
@login_required
def checkout_visitor(id):
    visitor = db_session.query(Visitor).filter_by(id=id).first()
    if visitor:
        visitor.check_out_time = _utcnow()
        visitor.status = "Checked Out"
        db_session.commit()
        invalidate_dashboard_cache()
        invalidate_monitoring_cache()
    return redirect(url_for("visitors.visitors"))


@visitors_bp.route("/approve_visitor/<int:visitor_id>", methods=["POST"])
@login_required
@role_required(["admin", "manager", "security"])
def approve_visitor(visitor_id):
    visitor = db_session.query(Visitor).filter_by(id=visitor_id).first()
    if not visitor:
        return jsonify({"success": False, "message": "Visitor not found"}), 404
    visitor.status = "Checked In"
    visitor.check_in_time = _utcnow()
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
    invalidate_dashboard_cache()
    invalidate_monitoring_cache()
    log_audit("approve", "visitor", visitor_id, f"Approved visitor: {visitor.name}")
    socketio.emit("visitor_checkin", {"name": visitor.name})
    return redirect(url_for("visitors.visitors"))


@visitors_bp.route("/reject_visitor/<int:visitor_id>", methods=["POST"])
@login_required
@role_required(["admin", "manager", "security"])
def reject_visitor(visitor_id):
    visitor = db_session.query(Visitor).filter_by(id=visitor_id).first()
    if not visitor:
        return jsonify({"success": False, "message": "Visitor not found"}), 404
    visitor.status = "Rejected"
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
    invalidate_dashboard_cache()
    invalidate_monitoring_cache()
    log_audit("reject", "visitor", visitor_id, f"Rejected visitor: {visitor.name}")
    return redirect(url_for("visitors.visitors"))


@visitors_bp.route("/visitor_details/<int:id>")
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
