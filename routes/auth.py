"""Authentication routes: login and logout."""

from flask import Blueprint, redirect, render_template, request, session, url_for

from extensions import limiter
from models import User
from utils import db_session, log_audit

auth_bp = Blueprint("auth", __name__)


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
            return redirect(url_for("dashboard.dashboard"))
        else:
            return render_template("login.html", error="Invalid credentials")
    return render_template("login.html")


@auth_bp.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("auth.login"))
