"""Employee CRUD routes."""

from datetime import datetime

from flask import (
    Blueprint,
    redirect,
    render_template,
    request,
    url_for,
)

from app import _utcnow, db_session, log_audit, login_required, role_required, socketio
from models import Employee
from routes.dashboard import invalidate_dashboard_cache
from routes.monitoring import invalidate_monitoring_cache

employees_bp = Blueprint("employees", __name__)


@employees_bp.route("/employees")
@login_required
def employees():
    job_title = request.args.get("job_title", "")
    status = request.args.get("status", "")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    per_page = min(per_page, 200)

    query = db_session.query(Employee)
    if job_title:
        query = query.filter(Employee.job_title == job_title)
    if status:
        query = query.filter(Employee.status == status)

    total = query.count()
    total_pages = max(1, (total + per_page - 1) // per_page)
    page = max(1, min(page, total_pages))
    employees_list = query.offset((page - 1) * per_page).limit(per_page).all()

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


@employees_bp.route("/add_employee", methods=["POST"])
@login_required
@role_required(["admin", "manager"])
def add_employee():
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
        invalidate_dashboard_cache()
        invalidate_monitoring_cache()
        log_audit(
            "create",
            "employee",
            employee.id,
            f"Added employee: {employee.first_name} {employee.surname}",
        )
        socketio.emit("stats_update", {"type": "employee_added"})
        return redirect(url_for("employees.employees"))
    except Exception as e:
        db_session.rollback()
        return f"Error adding employee: {str(e)}", 500


@employees_bp.route("/edit_employee/<int:id>", methods=["POST"])
@login_required
@role_required(["admin", "manager"])
def edit_employee(id):
    employee = db_session.query(Employee).filter_by(id=id).first()
    if not employee:
        return "Employee not found", 404

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
        invalidate_dashboard_cache()
        invalidate_monitoring_cache()
        log_audit(
            "update",
            "employee",
            employee.id,
            f"Updated employee: {employee.first_name} {employee.surname}",
        )
        return redirect(url_for("employees.employees"))
    except Exception as e:
        db_session.rollback()
        return f"Error updating employee: {str(e)}", 500


@employees_bp.route("/delete_employee/<int:id>", methods=["POST"])
@login_required
@role_required(["admin"])
def delete_employee(id):
    try:
        employee = db_session.query(Employee).filter_by(id=id).first()
        if employee:
            name = f"{employee.first_name} {employee.surname}"
            db_session.delete(employee)
            db_session.commit()
            invalidate_dashboard_cache()
            invalidate_monitoring_cache()
            log_audit("delete", "employee", id, f"Deleted employee: {name}")
        return redirect(url_for("employees.employees"))
    except Exception as e:
        db_session.rollback()
        return f"Error deleting employee: {str(e)}", 500
