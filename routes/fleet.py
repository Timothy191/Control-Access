"""Fleet (vehicle) CRUD routes."""

from datetime import datetime

from flask import Blueprint, redirect, render_template, request, url_for

from utils import db_session, login_required, role_required
from models import Vehicle
from routes.dashboard import invalidate_dashboard_cache
from routes.monitoring import invalidate_monitoring_cache

fleet_bp = Blueprint("fleet", __name__)


@fleet_bp.route("/fleet")
@login_required
def fleet():
    vehicles = db_session.query(Vehicle).all()
    return render_template("fleet.html", vehicles=vehicles)


@fleet_bp.route("/add_vehicle", methods=["POST"])
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
    invalidate_dashboard_cache()
    invalidate_monitoring_cache()
    return redirect(url_for("fleet.fleet"))


@fleet_bp.route("/edit_vehicle/<int:id>", methods=["POST"])
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
        invalidate_dashboard_cache()
        invalidate_monitoring_cache()
    return redirect(url_for("fleet.fleet"))


@fleet_bp.route("/delete_vehicle/<int:id>", methods=["POST"])
@login_required
@role_required(["admin"])
def delete_vehicle(id):
    vehicle = db_session.query(Vehicle).filter_by(id=id).first()
    if vehicle:
        db_session.delete(vehicle)
        db_session.commit()
        invalidate_dashboard_cache()
        invalidate_monitoring_cache()
    return redirect(url_for("fleet.fleet"))
