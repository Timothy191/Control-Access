"""Scanning routes: QR scanner, universal scan, hardware scan endpoints, RFID, and verification."""

import hashlib
import io
import json
from datetime import datetime

import qrcode
from flask import Blueprint, jsonify, render_template, request, send_file

from utils import _utcnow, db_session, login_required, role_required, require_api_key
from extensions import limiter, socketio
from models import Approval, Employee, Equipment, GateLog, Vehicle, Visitor
from routes.dashboard import invalidate_dashboard_cache
from routes.monitoring import invalidate_monitoring_cache
from services.listeners import _ensure_device_exists

scanning_bp = Blueprint("scanning", __name__)


@scanning_bp.route("/qr_scanner")
@login_required
@role_required(["admin", "security"])
def qr_scanner():
    return render_template("qr_scanner.html")


@scanning_bp.route("/scan/<qr_hash>")
@scanning_bp.route("/s/<qr_hash>")
def universal_scan(qr_hash):
    """Visual feedback for any camera-based scanner (phone, 3rd-party app)."""
    from app import _process_qr_scan
    ip_address = request.remote_addr
    user_agent = request.headers.get("User-Agent", "WebBrowser")

    result = _process_qr_scan(
        qr_hash, "AUTO", "Web Scanner", "web_browser", ip_address, user_agent
    )

    return render_template(
        "scan_result.html",
        success=result["access_granted"],
        name=result["entity_name"],
        entity_type=result["entity_type"],
        denial_reason=result["denial_reason"],
        direction=result.get("direction", "IN"),
        reset_ms=4000,
    )


@scanning_bp.route("/api/scan_qr", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def scan_qr_code():
    from app import _process_qr_scan
    data = request.get_json()
    # 1. Normalize input
    qr_hash_raw = data.get("qr_code", "").strip() if data.get("qr_code") else None
    qr_hash = None
    if qr_hash_raw:
        if qr_hash_raw.startswith("{") and qr_hash_raw.endswith("}"):
            qr_hash = qr_hash_raw
        else:
            qr_hash = qr_hash_raw.upper()

    direction = data.get("direction", "IN")
    gate_location = data.get("gate_location", "Main Gate")
    scanned_by = data.get("scanned_by", "hardware")
    ip_address = request.remote_addr
    user_agent = request.headers.get("User-Agent", "")

    result = _process_qr_scan(
        qr_hash, direction, gate_location, scanned_by, ip_address, user_agent
    )

    # 3. Log scan decisions
    found_in = "none"
    if result["entity_type"] == "employee":
        found_in = "employees"
    elif result["entity_type"] == "vehicle":
        found_in = "vehicles"
    elif result["entity_type"] == "visitor":
        found_in = "visitors"

    if not result["access_granted"] and result["denial_reason"]:
        # Check if there's a pending approval
        pending = (
            db_session.query(Approval)
            .filter(
                Approval.status == "Pending", Approval.scanned_data.contains(qr_hash)
            )
            .first()
        )
        if pending:
            found_in = "pending"

    scan_log_data = {
        "code": qr_hash,
        "foundIn": found_in,
        "granted": result["access_granted"],
        "entity": result["entity_name"] or "Unknown",
        "direction": direction,
        "type": result["entity_type"] or "QR",
    }
    print(f"SCAN LOG: {json.dumps(scan_log_data)}", flush=True)

    # Determine status for scanner display
    is_pending = not result["access_granted"] and found_in == "pending"
    scan_status = (
        "approved"
        if result["access_granted"]
        else ("pending" if is_pending else "denied")
    )

    return jsonify(
        {
            "success": result["access_granted"],
            "message": result["denial_reason"]
            or ("Access granted" if result["access_granted"] else "Access denied"),
            "name": result["entity_name"] or "Unknown",
            "entity_type": result["entity_type"],
            "entity_name": result["entity_name"],
            "direction": direction,
            "open_gate": result["access_granted"],
            "status": scan_status,
            "denial_reason": result["denial_reason"],
            "parsed_data": result.get("parsed_qr"),
            "is_unknown": result["entity_name"] == "Unknown"
            or "Unassigned" in str(result["entity_name"]),
        }
    )


@scanning_bp.route("/api/scan_alt", methods=["POST"])
@limiter.limit("120 per minute")
def scan_qr_alt():
    """Alternative QR scanner endpoint - no API key required, local network only."""
    from app import _is_local_ip, _process_qr_scan
    ip_address = request.remote_addr
    if not _is_local_ip(ip_address):
        return jsonify({"success": False, "message": "Local network only"}), 403
    user_agent = request.headers.get("User-Agent", "InfoWedge")
    content_type = request.content_type or ""

    if "application/json" in content_type:
        data = request.get_json(silent=True) or {}
        qr_hash = (
            data.get("qr_code")
            or data.get("barcode")
            or data.get("data")
            or data.get("barcodeData")
        )
        direction = data.get("direction", "AUTO")
        gate_location = data.get("gate_location", "C66 Scanner")
        scanned_by = data.get("scanned_by", f"infowedge:{ip_address}")
    else:
        raw = request.get_data(as_text=True).strip()
        qr_hash = raw
        direction = "AUTO"
        gate_location = "C66 Scanner"
        scanned_by = f"infowedge:{ip_address}"

    if not qr_hash:
        return jsonify(
            {"success": False, "message": "No barcode data", "open_gate": False}
        ), 400

    result = _process_qr_scan(
        qr_hash, direction, gate_location, scanned_by, ip_address, user_agent
    )
    return jsonify(
        {
            "success": result["access_granted"],
            "open_gate": result["access_granted"],
            "message": result["denial_reason"]
            or ("Access granted" if result["access_granted"] else "Access denied"),
            "name": result["entity_name"] or "Unknown",
            "entity_type": result["entity_type"],
            "entity_name": result["entity_name"],
            "direction": direction,
            "status": "approved" if result["access_granted"] else "denied",
            "denial_reason": result["denial_reason"],
            "parsed_data": result.get("parsed_qr"),
            "is_unknown": result["entity_name"] == "Unknown"
            or "Unassigned" in str(result["entity_name"]),
        }
    )


@scanning_bp.route("/api/scan", methods=["POST"])
@limiter.limit("120 per minute")
def scan_http():
    """Simple HTTP scan endpoint - supports JSON, form data, and plain text. Local network only.

    Allows scanners like InfoWedge to send scans via HTTP POST without configuration.
    Supports:
    - JSON: {"qr_code": "ABC123", "direction": "IN", "gate_location": "Main Gate"}
    - Form: qr_code=ABC123
    - Plain text: ABC123

    InfoWedge TCP/IP Output typically sends plain text.
    """
    from app import _is_local_ip, _process_qr_scan
    ip_address = request.remote_addr
    if not _is_local_ip(ip_address):
        return jsonify({"success": False, "message": "Local network only"}), 403
    qr_code = None
    content_type = request.headers.get("Content-Type", "")

    # Handle JSON
    if "application/json" in content_type:
        data = request.get_json() or {}
        qr_code = data.get("qr_code") or data.get("code") or data.get("barcode")
    # Handle form data
    elif "application/x-www-form-urlencoded" in content_type:
        qr_code = (
            request.form.get("qr_code")
            or request.form.get("code")
            or request.form.get("barcode")
        )
    # Handle plain text (InfoWedge TCP output)
    else:
        qr_code = request.get_data(as_text=True).strip()

    if not qr_code:
        return jsonify(
            {"success": False, "message": "qr_code required", "open_gate": False}
        ), 400

    # Normalize the code
    qr_hash = qr_code.strip()
    if qr_hash.startswith("{") and qr_hash.endswith("}"):
        pass
    else:
        qr_hash = qr_hash.upper()

    # Get direction/gate_location from JSON if available
    if "application/json" in content_type:
        data = request.get_json() or {}
        direction = data.get("direction", "IN")
        gate_location = data.get("gate_location", "Main Gate")
    else:
        direction = "IN"
        gate_location = "Main Gate"

    _ensure_device_exists(ip_address)

    scanned_by = "info-wedge"

    # Process the scan
    result = _process_qr_scan(
        qr_hash, direction, gate_location, scanned_by, ip_address, "HTTP Scanner"
    )

    # Emit to web clients
    socketio.emit(
        "scan_result",
        {
            "success": result["access_granted"],
            "message": result["denial_reason"],
            "entity_type": result["entity_type"],
            "entity_name": result["entity_name"],
            "direction": direction,
            "scanner": "http",
        },
    )

    return jsonify(
        {
            "success": result["access_granted"],
            "message": result["denial_reason"] or "Access granted",
            "entity_type": result["entity_type"],
            "entity_name": result["entity_name"],
            "direction": direction,
            "open_gate": result["access_granted"],
            "status": "approved" if result["access_granted"] else "denied",
        }
    )


@scanning_bp.route("/api/scan_rfid", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def scan_rfid():
    """RFID tag scan endpoint for hardware RFID readers.

    Accepts RFID tag data from TCP/IP connected RFID scanners.
    Scanner config: IP 192.168.0.187, Port 58628, Protocol TCP

    JSON body format:
    {
        "rfid_tag": "E20034150200108022001F6D",
        "direction": "IN",
        "gate_location": "Main Gate",
        "reader_id": "RFID-001"
    }
    """
    data = request.get_json() or {}

    # Extract RFID tag data
    rfid_tag = (
        data.get("rfid_tag", "").strip().upper() if data.get("rfid_tag") else None
    )
    direction = data.get("direction", "IN")
    gate_location = data.get("gate_location", "RFID Gate")
    reader_id = data.get("reader_id", "unknown")
    ip_address = request.remote_addr
    user_agent = request.headers.get("User-Agent", "RFID Reader")

    if not rfid_tag:
        return jsonify(
            {
                "success": False,
                "message": "No RFID tag data provided",
                "open_gate": False,
                "status": "denied",
            }
        ), 400

    # Basic RFID data formatting and validation
    # Support multiple RFID formats: EPC Gen2, ISO 14443, etc.
    from app import _format_rfid_tag, _process_rfid_scan
    formatted_tag = _format_rfid_tag(rfid_tag)

    # Process RFID scan using shared logic
    result = _process_rfid_scan(
        formatted_tag, direction, gate_location, reader_id, ip_address, user_agent
    )

    # Log scan result
    found_in = "none"
    if result["entity_type"] == "employee":
        found_in = "employees"
    elif result["entity_type"] == "vehicle":
        found_in = "vehicles"
    elif result["entity_type"] == "visitor":
        found_in = "visitors"
    elif result["entity_type"] == "equipment":
        found_in = "equipment"

    print(
        f"RFID SCAN: {{ 'tag': '{formatted_tag}', 'foundIn': '{found_in}', 'granted': {result['access_granted']}, 'entity': '{result['entity_name']}', 'direction': '{direction}', 'type': '{result['entity_type']}' }}",
        flush=True,
    )

    # Emit to web clients for real-time updates
    try:
        socketio.emit(
            "rfid_scan_result",
            {
                "success": result["access_granted"],
                "entity_name": result.get("entity_name", ""),
                "message": result.get("denial_reason", ""),
                "rfid_tag": formatted_tag,
                "scanner": reader_id,
                "protocol": "RFID-TCP",
            },
        )
    except Exception:
        pass

    scan_status = "approved" if result["access_granted"] else "denied"

    return jsonify(
        {
            "success": result["access_granted"],
            "message": result["denial_reason"]
            or ("Access granted" if result["access_granted"] else "Access denied"),
            "name": result["entity_name"] or "Unknown",
            "entity_type": result["entity_type"],
            "entity_name": result["entity_name"],
            "rfid_tag": formatted_tag,
            "direction": result.get("direction", direction),
            "open_gate": result["access_granted"],
            "status": scan_status,
            "denial_reason": result["denial_reason"],
            "is_unknown": result["entity_name"] == "Unknown"
            or "Unassigned" in str(result["entity_name"]),
        }
    )


@scanning_bp.route("/api/verify-qr", methods=["POST"])
@require_api_key
@limiter.limit("60 per minute")
def verify_qr_mobile():
    """Mobile app QR verification endpoint - mirrors scan_qr_code with mobile-compatible response format."""
    from datetime import datetime

    data = request.get_json()

    # Extract and normalize fields from mobile app request
    qr_hash_raw = (data.get("qr_data") or data.get("qr_code", "")).strip()
    if qr_hash_raw.startswith("{") and qr_hash_raw.endswith("}"):
        qr_hash = qr_hash_raw
    else:
        qr_hash = qr_hash_raw.upper()

    device_info = data.get("device_info", "Mobile Scanner")
    direction = "IN"
    scanned_by = f"mobile-{request.remote_addr}"
    ip_address = request.remote_addr
    user_agent = request.headers.get("User-Agent", "")

    # Parse QR data for extraction
    from app import decode_qr_data, _process_qr_scan
    parsed_qr = (
        decode_qr_data(qr_hash) if qr_hash else {"format": "none", "raw_data": None}
    )

    # Replicate scan_qr_code logic
    entity = None
    entity_type = None
    entity_id = None
    entity_name = None
    access_granted = False
    denial_reason = None

    # Try to look up by QR code hash first
    employee = db_session.query(Employee).filter_by(qr_code=qr_hash).first()

    # If not found, try to parse text-based QR (e.g., "ID: 0002235597081")
    if not employee and qr_hash:
        import re

        # Extract ID number from text format: "ID: 0002235597081" or "ID:0002235597081"
        id_match = re.search(r"ID[:\s]*(\d+)", qr_hash)
        if id_match:
            extracted_id = id_match.group(1)
            employee = (
                db_session.query(Employee)
                .filter(
                    (Employee.emp_code == extracted_id)
                    | (Employee.id_number == extracted_id)
                )
                .first()
            )

    # Check expiry dates first - BEFORE status check (expiredcert supersedes status)
    def is_expired(expiry_date):
        if expiry_date is None:
            return False
        return expiry_date < _utcnow()

    if employee:
        entity = employee
        entity_type = "employee"
        entity_id = employee.id
        entity_name = f"{employee.first_name} {employee.surname}".strip()

        # Check expiry dates FIRST - deny regardless of status if expired
        if is_expired(employee.medical_expiry):
            access_granted = False
            denial_reason = "Medical certificate expired"
        elif is_expired(employee.induction_expiry):
            access_granted = False
            denial_reason = "Induction expired"
        elif employee.status == "Active":
            access_granted = True
        else:
            denial_reason = "Employee not active"

    if not entity:
        vehicle = db_session.query(Vehicle).filter_by(qr_code=qr_hash).first()
        if vehicle:
            entity = vehicle
            entity_type = "vehicle"
            entity_id = vehicle.id
            entity_name = vehicle.fleet_id

            # Check registration expiry BEFORE status check
            if vehicle.registration_expiry and vehicle.registration_expiry < _utcnow():
                access_granted = False
                denial_reason = "Registration expired"
            elif vehicle.status == "Active":
                access_granted = True
            else:
                denial_reason = "Vehicle not active"

    if not entity:
        visitor = db_session.query(Visitor).filter_by(qr_code=qr_hash).first()
        if visitor:
            entity = visitor
            entity_type = "visitor"
            entity_id = visitor.id
            entity_name = visitor.name
            if direction == "IN":
                if visitor.status == "Checked In":
                    access_granted = True
                else:
                    denial_reason = "Visitor not checked in"
            elif direction == "OUT":
                if visitor.status == "Checked In":
                    access_granted = True
                else:
                    denial_reason = "Visitor already checked out"

    # NOT IN SYSTEM - deny immediately regardless of other factors
    if not entity:
        access_granted = False
        denial_reason = "Not registered in system"
        entity_name = "Unknown"

    # Log the scan
    gate_log = GateLog(
        access_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        direction=direction,
        qr_data=qr_hash,
        access_granted=access_granted,
        denial_reason=denial_reason,
        gate_location=device_info,
        scanned_by=scanned_by,
        ip_address=ip_address,
        user_agent=user_agent,
        parsed_qr_data=json.dumps(parsed_qr) if parsed_qr else None,
        employee_id=entity_id if entity_type == "employee" else None,
        vehicle_id=entity_id if entity_type == "vehicle" else None,
        visitor_id=entity_id if entity_type == "visitor" else None,
    )
    db_session.add(gate_log)

    if entity_type == "visitor" and access_granted and direction == "OUT":
        visitor.check_out_time = _utcnow()
        visitor.status = "Checked Out"
        db_session.commit()
    else:
        db_session.commit()

    # Invalidate caches since gate log data changed
    invalidate_dashboard_cache()
    invalidate_monitoring_cache()

    # Emit to dashboard via socketio
    socketio.emit(
        "gate_scan",
        {
            "type": entity_type,
            "name": entity_name,
            "direction": direction,
            "granted": access_granted,
            "reason": denial_reason,
            "gate": device_info,
            "time": datetime.now().strftime("%H:%M:%S"),
        },
    )

    # Return mobile-compatible response format
    return jsonify(
        {
            "valid": access_granted,
            "message": "Access granted" if access_granted else denial_reason,
            "is_unknown": entity_name == "Unknown" or "Unassigned" in str(entity_name),
            "parsed_data": parsed_qr,
            "data": {
                "entity_type": entity_type,
                "entity_name": entity_name,
                "direction": direction,
                "open_gate": access_granted,
            },
        }
    )


# ------------------- QR Code Generation -------------------
@scanning_bp.route("/generate_qr/<entity_type>/<int:entity_id>")
@login_required
@role_required(["admin", "security"])
def generate_qr_code(entity_type, entity_id):
    if entity_type == "employee":
        entity = db_session.query(Employee).filter_by(id=entity_id).first()
        if not entity:
            return "Employee not found", 404
        qr_data = f"EMP:{entity.id}:{entity.emp_code}:{datetime.now().timestamp()}"
        qr_hash = hashlib.sha256(qr_data.encode()).hexdigest()[:32].upper()
        entity.qr_code = qr_hash
    elif entity_type == "vehicle":
        entity = db_session.query(Vehicle).filter_by(id=entity_id).first()
        if not entity:
            return "Vehicle not found", 404
        qr_data = f"VEH:{entity.id}:{entity.fleet_id}:{datetime.now().timestamp()}"
        qr_hash = hashlib.sha256(qr_data.encode()).hexdigest()[:32].upper()
        entity.qr_code = qr_hash
    elif entity_type == "visitor":
        entity = db_session.query(Visitor).filter_by(id=entity_id).first()
        if not entity:
            return "Visitor not found", 404
        qr_data = f"VIS:{entity.id}:{entity.name}:{datetime.now().timestamp()}"
        qr_hash = hashlib.sha256(qr_data.encode()).hexdigest()[:32].upper()
        entity.qr_code = qr_hash
    elif entity_type == "equipment":
        entity = db_session.query(Equipment).filter_by(id=entity_id).first()
        if not entity:
            return "Equipment not found", 404
        qr_data = f"EQP:{entity.id}:{entity.radio_id}:{datetime.now().timestamp()}"
        qr_hash = hashlib.sha256(qr_data.encode()).hexdigest()[:32].upper()
        entity.qr_code = qr_hash
    else:
        return "Invalid entity type", 400
    db_session.commit()

    # Invalidate caches since entity data changed
    invalidate_dashboard_cache()
    invalidate_monitoring_cache()

    qr = qrcode.QRCode(version=4, box_size=20, border=4)
    qr.add_data(qr_hash)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")

    # Add human-readable text overlay
    from PIL import Image as PilImage
    from PIL import ImageDraw, ImageFont

    # Prepare text based on entity type
    if entity_type == "vehicle":
        label_text = f"Fleet ID: {entity.fleet_id}"
        id_text = "Vehicle"
    elif entity_type == "employee":
        full_name = f"{entity.first_name} {entity.surname}".strip()
        label_text = full_name
        id_text = f"ID: {entity.emp_code}"
    elif entity_type == "equipment":
        label_text = f"Radio ID: {entity.radio_id}"
        id_text = "Equipment"
    else:
        label_text = f"{entity.name}"
        id_text = "Visitor"

    # Try to use a nice font, fall back to default if not available
    try:
        font_large = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20
        )
        font_small = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16
        )
    except Exception:
        try:
            font_large = ImageFont.truetype(
                "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 20
            )
            font_small = ImageFont.truetype(
                "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", 16
            )
        except Exception:
            font_large = ImageFont.load_default()
            font_small = ImageFont.load_default()

    # Create a new blank white canvas with space for text BELOW the QR
    text_padding = 65
    canvas = PilImage.new("RGB", (qr_img.width, qr_img.height + text_padding), "white")
    canvas.paste(qr_img, (0, 0))

    draw = ImageDraw.Draw(canvas)
    img_width = canvas.width

    # Use textbbox if available (PIL 1.1.6+), otherwise estimate
    try:
        bbox = draw.textbbox((0, 0), label_text, font=font_large)
        text_width = bbox[2] - bbox[0]
    except AttributeError:
        text_width = len(label_text) * 10  # rough estimate
    x = (img_width - text_width) // 2
    draw.text((x, qr_img.height + 8), label_text, fill="black", font=font_large)

    # Draw ID/type line
    try:
        bbox2 = draw.textbbox((0, 0), id_text, font=font_small)
        text_width2 = bbox2[2] - bbox2[0]
    except AttributeError:
        text_width2 = len(id_text) * 8  # rough estimate
    x2 = (img_width - text_width2) // 2
    draw.text((x2, qr_img.height + 34), id_text, fill="#444444", font=font_small)

    img_byte_arr = io.BytesIO()
    canvas.save(img_byte_arr, format="PNG")
    img_byte_arr.seek(0)

    return send_file(
        img_byte_arr,
        mimetype="image/png",
        as_attachment=True,
        download_name=f"{entity_type}_{entity_id}_qr.png",
    )


@scanning_bp.route("/generate_qr_page")
@login_required
@role_required(["admin", "security"])
def generate_qr_page():
    employees = db_session.query(Employee).all()
    vehicles = db_session.query(Vehicle).all()
    visitors = db_session.query(Visitor).filter_by(status="Checked In").all()
    return render_template(
        "generate_qr.html", employees=employees, vehicles=vehicles, visitors=visitors
    )
