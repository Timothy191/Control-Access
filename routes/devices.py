"""Device management routes."""

from datetime import timedelta

from flask import Blueprint, redirect, render_template, url_for

from utils import _utcnow, db_session
from models import Device

devices_bp = Blueprint("devices", __name__)


@devices_bp.route("/devices")
def devices():
    """Device management page with live view options"""
    all_devices = db_session.query(Device).order_by(Device.last_seen.desc()).all()

    stats = {
        "total": len(all_devices),
        "online": sum(1 for d in all_devices if d.status == "online"),
        "pending": sum(1 for d in all_devices if d.status == "pending"),
        "total_scans": sum(d.total_scans for d in all_devices) or 0,
    }

    return render_template("devices.html", devices=all_devices, stats=stats)


@devices_bp.route("/devices/refresh")
def device_refresh():
    """Refresh device status"""
    cutoff = _utcnow() - timedelta(minutes=5)
    db_session.query(Device).filter(
        Device.last_seen < cutoff, Device.status == "online"
    ).update({"status": "offline"})
    db_session.commit()
    return redirect(url_for("devices.devices"))


@devices_bp.route("/device/view/<int:device_id>")
def device_view(device_id):
    """View individual device - redirects to remote app or shows info"""
    device = db_session.query(Device).filter_by(id=device_id).first()
    if not device:
        return "Device not found", 404

    if device.status != "online":
        return f"""
        <html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h2>Device Offline</h2>
        <p>Device {device.device_name} is currently offline.</p>
        <p>Last seen: {device.last_seen}</p>
        <a href="/devices" style="color: #00d4ff;">← Back to Devices</a>
        </body></html>
        """

    return f"""
    <html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
    <h2>📱 {device.device_name}</h2>
    <p>IP: {device.ip_address}</p>
    <p>Status: <span style="color: #00ff88;">Online</span></p>
    <div style="margin: 30px 0;">
        <a href="https://play.google.com/store/apps/details?id=com.teamviewer.quicksupport.market"
           target="_blank" style="display: inline-block; padding: 15px 30px; background: #00d4ff; color: #000; text-decoration: none; border-radius: 8px; margin: 10px;">
            Open TeamViewer on Device
        </a>
    </div>
    <p style="color: #666; font-size: 0.9rem;">
        Install TeamViewer QuickSupport on this C66 device,
        then click "View Screen" to connect remotely.
    </p>
    <a href="/devices" style="color: #00d4ff;">← Back to Devices</a>
    </body></html>
    """
