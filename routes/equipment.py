"""Equipment CRUD routes."""

from datetime import datetime

from flask import Blueprint, flash, redirect, render_template, request, url_for

from utils import db_session, login_required, role_required
from models import Equipment
from routes.dashboard import invalidate_dashboard_cache
from routes.monitoring import invalidate_monitoring_cache

equipment_bp = Blueprint("equipment", __name__)


@equipment_bp.route("/equipment")
@login_required
def equipment():
    items = db_session.query(Equipment).all()
    return render_template("equipment.html", items=items)


@equipment_bp.route("/add_equipment", methods=["POST"])
@login_required
@role_required(["admin", "manager"])
def add_equipment():
    registration_expiry = request.form.get("registration_expiry")
    radio_id = request.form.get("radio_id")
    existing = db_session.query(Equipment).filter_by(radio_id=radio_id).first()
    if existing:
        flash(f"Equipment with Radio ID {radio_id} already exists.", "error")
        return redirect(url_for("equipment.equipment"))

    item = Equipment(
        radio_id=radio_id,
        registration_expiry=datetime.strptime(registration_expiry, "%Y-%m-%d")
        if registration_expiry
        else None,
        status=request.form.get("status", "Active"),
    )
    db_session.add(item)
    db_session.commit()
    invalidate_dashboard_cache()
    invalidate_monitoring_cache()
    return redirect(url_for("equipment.equipment"))


@equipment_bp.route("/edit_equipment/<int:id>", methods=["POST"])
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
        invalidate_dashboard_cache()
        invalidate_monitoring_cache()
    return redirect(url_for("equipment.equipment"))


@equipment_bp.route("/delete_equipment/<int:id>", methods=["POST"])
@login_required
@role_required(["admin"])
def delete_equipment(id):
    item = db_session.query(Equipment).filter_by(id=id).first()
    if item:
        db_session.delete(item)
        db_session.commit()
        invalidate_dashboard_cache()
        invalidate_monitoring_cache()
    return redirect(url_for("equipment.equipment"))
