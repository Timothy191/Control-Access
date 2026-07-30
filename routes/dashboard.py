"""Dashboard routes."""

from datetime import timedelta

from flask import Blueprint, jsonify, render_template

from app import __version__, _utcnow, db_session, login_required
from models import Approval, Employee, Equipment, GateLog, Vehicle, Visitor

dashboard_bp = Blueprint("dashboard", __name__)

_dashboard_history_cache = {"data": None, "ts": 0}


def invalidate_dashboard_cache():
    """Clear the dashboard stats_history cache. Call when GateLog or entity data changes."""
    _dashboard_history_cache["data"] = None
    _dashboard_history_cache["ts"] = 0


@dashboard_bp.route("/dashboard")
@login_required
def dashboard():
    from sqlalchemy import case, func

    now = _utcnow()
    thirty_days = now + timedelta(days=30)

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


@dashboard_bp.route("/api/dashboard/stats_history")
@login_required
def dashboard_stats_history():
    """Return 7-day sparkline data, 24h gate scan histogram, and on-site count.
    Cached for 30 seconds to avoid redundant queries under concurrent load.
    Data changes slowly (daily/hourly aggregates), so longer cache is safe."""
    import time as _t

    _now = _t.time()
    if (
        _dashboard_history_cache["data"]
        and (_now - _dashboard_history_cache["ts"]) < 30
    ):
        return jsonify(_dashboard_history_cache["data"])
    from sqlalchemy import extract, func

    now = _utcnow()
    seven_days_ago = now - timedelta(days=7)

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
    day_map = {str(row.day): row.cnt for row in daily_logs}
    sparkline_data = []
    for i in range(7):
        d = (now - timedelta(days=6 - i)).strftime("%Y-%m-%d")
        sparkline_data.append(day_map.get(d, 0))

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
