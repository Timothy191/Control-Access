"""
QR scan processing service.

Extracted from app.py _process_qr_scan() to provide focused, testable helpers.
"""

import hashlib
import json
import re
from datetime import datetime, timedelta

from database import db_session
from models import Approval, Employee, Equipment, GateLog, Vehicle, Visitor


def _utcnow():
    """Return current UTC as naive datetime (SQLite compat)."""
    from datetime import UTC
    return datetime.now(UTC).replace(tzinfo=None)


def _normalize_qr_hash(qr_hash):
    """
    Normalize QR hash input - strip whitespace and extract hash from URLs.

    Handles formats like:
    - http://192.168.0.217:8080/scan/ABC123
    - /scan/ABC123
    - /s/ABC123
    """
    if not qr_hash:
        return qr_hash

    qr_hash = qr_hash.strip()

    # Handle full URL scans by extracting the hash part
    if "://" in qr_hash and "/scan/" in qr_hash:
        qr_hash = qr_hash.split("/scan/")[-1].split("?")[0]
    elif "://" in qr_hash and "/s/" in qr_hash:
        qr_hash = qr_hash.split("/s/")[-1].split("?")[0]
    # Also handle cases where it might be just the path
    elif qr_hash.startswith("/scan/"):
        qr_hash = qr_hash.replace("/scan/", "")
    elif qr_hash.startswith("/s/"):
        qr_hash = qr_hash.replace("/s/", "")

    return qr_hash


def _lookup_employee_by_qr(qr_hash):
    """
    Look up employee by QR code with multiple fallback strategies.

    Returns (employee, updated_qr_hash) tuple.
    """
    if not qr_hash:
        return None, qr_hash

    employee = db_session.query(Employee).filter_by(qr_code=qr_hash).first()

    # If not found by qr_code, try to parse text-based QR (e.g., "ID: 0002235597081")
    if not employee:
        extracted_id = None

        # Try JSON parsing
        if qr_hash.startswith("{"):
            try:
                qr_json = json.loads(qr_hash)
                extracted_id = (
                    qr_json.get("emp_code")
                    or qr_json.get("id_number")
                    or qr_json.get("id")
                )
            except Exception:
                pass

        # Try regex ID extraction
        if not extracted_id:
            id_match = re.search(r"ID[:\s]*(\d+)", qr_hash)
            if id_match:
                extracted_id = id_match.group(1)

        if extracted_id:
            extracted_id_str = str(extracted_id)
            id_hash = Employee.hash_id_number(extracted_id_str)
            employee = (
                db_session.query(Employee)
                .filter(
                    (Employee.emp_code == extracted_id_str)
                    | (Employee.id_number_hash == id_hash)
                )
                .first()
            )
            if employee:
                employee.qr_code = qr_hash
                db_session.commit()

    # Fallback: Try direct emp_code or id_number lookup for plain IDs
    if not employee and qr_hash:
        # Check if it looks like an ID (alphanumeric, reasonable length, no spaces)
        if (
            qr_hash.replace("-", "").replace("_", "").isalnum()
            and len(qr_hash) <= 50
            and " " not in qr_hash
        ):
            id_hash = Employee.hash_id_number(qr_hash)
            employee = (
                db_session.query(Employee)
                .filter(
                    (Employee.emp_code == qr_hash) | (Employee.id_number_hash == id_hash)
                )
                .first()
            )
            if employee:
                # Auto-populate qr_code for future scans
                employee.qr_code = qr_hash
                db_session.commit()

    return employee, qr_hash


def _lookup_entity(qr_hash):
    """
    Look up entity (employee, vehicle, visitor, or equipment) by QR code.

    Returns (entity, entity_type, entity_id, entity_name) tuple.
    """
    # Try employee first
    employee, qr_hash = _lookup_employee_by_qr(qr_hash)
    if employee:
        return (
            employee,
            "employee",
            employee.id,
            f"{employee.first_name} {employee.surname}",
        )

    # Try vehicle
    vehicle = db_session.query(Vehicle).filter_by(qr_code=qr_hash).first()
    if vehicle:
        return vehicle, "vehicle", vehicle.id, vehicle.fleet_id

    # Try visitor
    visitor = db_session.query(Visitor).filter_by(qr_code=qr_hash).first()

    # Fallback: Parse JSON QR data to extract visitor ID
    if not visitor and qr_hash and qr_hash.startswith("{"):
        try:
            qr_json = json.loads(qr_hash)
            if qr_json.get("type") == "visitor" and qr_json.get("id"):
                visitor = (
                    db_session.query(Visitor)
                    .filter_by(id=qr_json.get("id"))
                    .first()
                )
                if visitor:
                    visitor.qr_code = qr_hash
                    db_session.commit()
        except Exception:
            pass

    if visitor:
        return visitor, "visitor", visitor.id, visitor.name

    # Try equipment
    equipment = (
        db_session.query(Equipment)
        .filter((Equipment.qr_code == qr_hash) | (Equipment.radio_id == qr_hash))
        .first()
    )
    if equipment:
        # Auto-populate qr_code if missing
        if not equipment.qr_code:
            qr_data = f"EQP:{equipment.id}:{equipment.radio_id}:{datetime.now().timestamp()}"
            equipment.qr_code = (
                hashlib.sha256(qr_data.encode()).hexdigest()[:32].upper()
            )
            db_session.commit()
        return equipment, "equipment", equipment.id, equipment.radio_id

    return None, None, None, None


def _determine_access(
    entity,
    entity_type,
    entity_id,
    entity_name,
    qr_hash,
    direction,
    gate_location,
    scanned_by,
    ip_address,
    user_agent,
    socketio,
):
    """
    Determine access decision based on entity status, expiry, and auto-approval rules.

    Returns (access_granted, denial_reason, skip_approval, direction, entity, entity_type, entity_id, entity_name).
    """
    access_granted = False
    denial_reason = None
    skip_approval = False

    # AUTO-DIRECTION: Backend decides IN vs OUT based on last gate log
    if entity_id and entity_type:
        # PERFORMANCE: noload('*') prevents lazy-loading relationships
        # when we only need the direction column.
        from sqlalchemy.orm import noload as _noload

        last_log = (
            db_session.query(GateLog)
            .options(_noload("*"))
            .filter(
                GateLog.entity_id == entity_id,
                GateLog.access_type == entity_type,
                GateLog.access_granted,
            )
            .order_by(GateLog.scanned_at.desc())
            .first()
        )
        if last_log and last_log.direction == "IN":
            direction = "OUT"
        else:
            direction = "IN"
    else:
        # Unknown entity — default to IN
        direction = "IN"

    print(
        f"AUTO-DIRECTION: entity={entity_name} type={entity_type} → direction={direction}"
    )

    # KEYWORD-BASED AUTO-APPROVAL - Special cases for specific names/vehicles
    if qr_hash:
        qr_lower = qr_hash.lower()
        special_keywords = ["henre", "yolande", "ldv 139"]

        for keyword in special_keywords:
            if keyword in qr_lower:
                # Force approval for special keywords
                access_granted = True
                denial_reason = None

                # Extract name from QR if possible
                if keyword == "henre":
                    entity_name = "Henre"
                elif keyword == "yolande":
                    entity_name = "Yolande"
                elif keyword == "ldv 139":
                    entity_name = "LDV 139"

                # Create or update employee record for special cases
                special_emp_id = keyword.upper().replace(" ", "_")
                special_employee = (
                    db_session.query(Employee)
                    .filter_by(emp_code=special_emp_id)
                    .first()
                )

                if not special_employee:
                    # Create new employee for special keyword
                    name_parts = entity_name.split(None, 1)
                    first_name = name_parts[0] if name_parts else entity_name
                    surname = name_parts[1] if len(name_parts) > 1 else ""

                    special_employee = Employee(
                        emp_code=special_emp_id,
                        first_name=first_name,
                        surname=surname,
                        job_title="Auto-approved (Special)",
                        status="Active",
                        qr_code=qr_hash,
                    )
                    db_session.add(special_employee)
                    db_session.flush()
                    print(
                        f"SPECIAL APPROVAL: Created employee record for {entity_name}"
                    )
                else:
                    # Update existing employee
                    special_employee.status = "Active"
                    special_employee.qr_code = qr_hash

                entity = special_employee
                entity_type = "employee"
                entity_id = special_employee.id

                print(
                    f"SPECIAL AUTO-APPROVAL: QR contains '{keyword}' - {entity_name} approved immediately"
                )

                # Log the special approval
                gate_log = GateLog(
                    access_type="employee",
                    entity_id=entity_id,
                    entity_name=entity_name,
                    direction=direction,
                    qr_data=qr_hash,
                    access_granted=True,
                    denial_reason=None,
                    gate_location=gate_location,
                    scanned_by=scanned_by,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    employee_id=entity_id,
                )
                db_session.add(gate_log)
                db_session.commit()

                # Emit to dashboard
                socketio.emit(
                    "gate_scan",
                    {
                        "type": "employee",
                        "name": entity_name,
                        "direction": direction,
                        "granted": True,
                        "reason": None,
                        "gate": gate_location,
                        "time": datetime.now().strftime("%H:%M:%S"),
                        "special": True,
                    },
                )

                return {
                    "entity_type": "employee",
                    "entity_id": entity_id,
                    "entity_name": entity_name,
                    "access_granted": True,
                    "denial_reason": None,
                    "direction": direction,
                    "early_return": True,
                }

    # Check expiry dates for employees - deny BEFORE status check if expired
    def is_expired(expiry_date):
        if expiry_date is None:
            return False
        return expiry_date < _utcnow()

    if entity_type == "employee" and entity:
        if is_expired(entity.medical_expiry):
            access_granted = False
            denial_reason = "Medical certificate expired"
            skip_approval = True
        elif is_expired(entity.induction_expiry):
            access_granted = False
            denial_reason = "Induction expired"
            skip_approval = True
        elif entity.status == "Active":
            access_granted = True
        else:
            denial_reason = "Employee not active"
    elif entity_type == "vehicle" and entity:
        if entity.status == "Active":
            access_granted = True
        else:
            denial_reason = "Vehicle not active"
    elif entity_type == "visitor" and entity:
        if entity.status == "Checked In":
            access_granted = True
        else:
            denial_reason = "Visitor not checked in"
    elif entity_type == "equipment" and entity:
        if entity.status == "Active":
            access_granted = True
        else:
            denial_reason = "Equipment not active"

    # UNIVERSAL AUTO-APPROVAL - check for recent scan for ANY QR code within 10 seconds
    # PERFORMANCE: noload('*') prevents lazy-loading relationships
    # when we only need to check existence.
    from sqlalchemy.orm import noload as _noload

    recent_gate_log = (
        db_session.query(GateLog)
        .options(_noload("*"))
        .filter(
            GateLog.qr_data == qr_hash,
            GateLog.scanned_at >= _utcnow() - timedelta(seconds=10),
        )
        .order_by(GateLog.scanned_at.desc())
        .first()
    )

    # Also check for recent pending approval with same QR data
    recent_approval = None
    if not recent_gate_log:
        all_pending = (
            db_session.query(Approval)
            .filter(
                Approval.status == "Pending",
                Approval.created_at >= _utcnow() - timedelta(seconds=10),
            )
            .all()
        )

        for pending in all_pending:
            if pending.scanned_data and qr_hash in pending.scanned_data:
                try:
                    pending_data = json.loads(pending.scanned_data)
                    if pending_data.get("qr_code") == qr_hash:
                        recent_approval = pending
                        print(
                            "EXACT QR MATCH: Found pending approval with matching QR code"
                        )
                        break
                except Exception:
                    if qr_hash in pending.scanned_data:
                        recent_approval = pending
                        print(
                            "STRING MATCH: Found pending approval containing QR data"
                        )
                        break

    # Auto-approve on second scan within 10 seconds for ANY QR code
    if recent_gate_log or recent_approval:
        source = "gate log" if recent_gate_log else "approval"

        # Force access granted for auto-approval
        access_granted = True
        denial_reason = None

        if recent_approval:
            recent_approval.status = "Approved"
            recent_approval.approved_by = "system-auto"
            recent_approval.approval_date = _utcnow()
            recent_approval.comments = f"Auto-approved due to repeated scan within 10 seconds at {_utcnow().strftime('%H:%M:%S')}"

        print(
            f"AUTO-APPROVAL: QR {qr_hash[:30]}... auto-approved on second scan (found in {source})"
        )

        # Extract scanned data from approval or parse from QR
        scanned_data = {}
        if recent_approval and recent_approval.scanned_data:
            try:
                scanned_data = json.loads(recent_approval.scanned_data)
            except Exception:
                scanned_data = {}
        else:
            # Parse data directly from QR code
            id_match = re.search(r"ID[:\s]*(\d+)", qr_hash)
            name_match = re.search(
                r"Name\s*(?:and\s*Surname)?[:\s]*([^\|]+)", qr_hash, re.IGNORECASE
            )
            job_match = re.search(r"Job[:\s]*([^\|]+)", qr_hash, re.IGNORECASE)
            coy_match = re.search(r"Coy[:\s]*([^\|]+)", qr_hash, re.IGNORECASE)

            if id_match:
                scanned_data["employee_id"] = id_match.group(1)
            if name_match:
                scanned_data["name"] = name_match.group(1).strip()
            if job_match:
                scanned_data["position"] = job_match.group(1).strip()
            if coy_match:
                scanned_data["department"] = coy_match.group(1).strip()

        # Create employee record only if entity doesn't exist
        if not entity:
            emp_id = (
                scanned_data.get("employee_id")
                or f"AUTO{_utcnow().strftime('%Y%m%d%H%M%S')}"
            )
            name = scanned_data.get("name") or f"Auto-{qr_hash[:20]}"
            position = scanned_data.get("position") or "Auto-approved"

            existing_employee = (
                db_session.query(Employee).filter_by(emp_code=emp_id).first()
            )
            if not existing_employee:
                name_parts = name.split(None, 1)
                first_name = name_parts[0] if name_parts else name
                surname = name_parts[1] if len(name_parts) > 1 else ""

                new_employee = Employee(
                    emp_code=emp_id,
                    first_name=first_name,
                    surname=surname,
                    job_title=position,
                    status="Active",
                    qr_code=qr_hash,
                )
                db_session.add(new_employee)
                db_session.flush()

                entity = new_employee
                entity_type = "employee"
                entity_id = new_employee.id
                entity_name = (
                    f"{new_employee.first_name} {new_employee.surname}".strip()
                )

                if recent_approval:
                    recent_approval.request_id = new_employee.id
            else:
                existing_employee.status = "Active"
                entity = existing_employee
                entity_type = "employee"
                entity_id = existing_employee.id
                entity_name = f"{existing_employee.first_name} {existing_employee.surname}".strip()

                if recent_approval:
                    recent_approval.request_id = existing_employee.id

    return {
        "access_granted": access_granted,
        "denial_reason": denial_reason,
        "skip_approval": skip_approval,
        "direction": direction,
        "entity": entity,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "entity_name": entity_name,
        "early_return": False,
    }


def _handle_denial(
    entity,
    entity_type,
    entity_id,
    entity_name,
    access_granted,
    denial_reason,
    qr_hash,
    gate_location,
    skip_approval,
    socketio,
):
    """
    Handle denied access and unknown QR codes - create approvals or placeholders.

    Returns updated (entity, entity_type, entity_id, entity_name, access_granted, denial_reason).
    """
    # Initialize approval variable
    approval = None

    # Only create approval for unknown entities or pending status
    if not skip_approval and not access_granted:
        # Store exact raw QR data for exact matching
        scanned_details = {
            "qr_code": qr_hash,
            "raw_data": qr_hash,
        }

        # Extract fields from JSON or text-based QR format
        if qr_hash:
            is_json = False
            try:
                if qr_hash.startswith("{"):
                    parsed_json = json.loads(qr_hash)
                    if isinstance(parsed_json, dict):
                        scanned_details["employee_id"] = parsed_json.get(
                            "employee_id"
                        ) or parsed_json.get("id")
                        scanned_details["name"] = parsed_json.get("name")
                        scanned_details["position"] = parsed_json.get(
                            "position"
                        ) or parsed_json.get("job")
                        scanned_details["department"] = (
                            parsed_json.get("department")
                            or parsed_json.get("coy")
                            or parsed_json.get("company")
                        )
                        is_json = True
            except Exception:
                pass

            if not is_json:
                # Extract ID -> maps to employee_id
                id_match = re.search(r"ID[:\s]*(\d+)", qr_hash)
                if id_match:
                    scanned_details["employee_id"] = id_match.group(1)

                # Extract Name -> maps to name
                name_match = re.search(
                    r"Name\s*(?:and\s*Surname)?[:\s]*([^\|]+)", qr_hash, re.IGNORECASE
                )
                if name_match:
                    scanned_details["name"] = name_match.group(1).strip()

                # Extract Job -> maps to position
                job_match = re.search(r"Job[:\s]*([^\|]+)", qr_hash, re.IGNORECASE)
                if job_match:
                    scanned_details["position"] = job_match.group(1).strip()

                # Extract Coy (Company) -> maps to department
                coy_match = re.search(r"Coy[:\s]*([^\|]+)", qr_hash, re.IGNORECASE)
                if coy_match:
                    scanned_details["department"] = coy_match.group(1).strip()

                # Extract area
                area_match = re.search(r"Area[:\s]*([^\|]+)", qr_hash, re.IGNORECASE)
                if area_match:
                    scanned_details["area"] = area_match.group(1).strip()

        # Create approval request with scanned data
        approval = Approval(
            request_type="Employee QR Scan"
            if scanned_details.get("employee_id")
            else "Unknown QR Scan",
            request_id=entity_id if entity_id else 0,
            requester_name=scanned_details.get("name") or entity_name or "Unknown",
            details=f"QR scan at {gate_location} (ID: {scanned_details.get('employee_id', 'N/A')})",
            status="Pending",
            scanned_data=json.dumps(scanned_details),
            target_table="employees",
        )
        db_session.add(approval)
        db_session.commit()

        socketio.emit(
            "stats_update",
            {
                "pending_approvals": db_session.query(Approval)
                .filter_by(status="Pending")
                .count()
            },
        )

    # HANDLE EMPTY OR UNKNOWN QR CODES - Try to extract and create records
    if not entity and not denial_reason:
        # Import decode_qr_data from app
        from app import decode_qr_data

        parsed_data = decode_qr_data(qr_hash) if qr_hash else {}

        # Try to create employee from parsed data
        employee_id = parsed_data.get("employee_id") or parsed_data.get("id")
        name = parsed_data.get("name")
        position = (
            parsed_data.get("position")
            or parsed_data.get("job_title")
            or parsed_data.get("job")
        )

        if employee_id and name:
            existing = (
                db_session.query(Employee).filter_by(emp_code=str(employee_id)).first()
            )
            if not existing:
                name_parts = name.split(None, 1)
                first_name = name_parts[0] if name_parts else name
                surname = name_parts[1] if len(name_parts) > 1 else ""

                new_employee = Employee(
                    emp_code=str(employee_id),
                    first_name=first_name,
                    surname=surname,
                    job_title=position or "Unknown",
                    status="Pending",
                    qr_code=qr_hash,
                )
                new_employee.set_id_number(str(employee_id))
                db_session.add(new_employee)
                db_session.flush()

                entity = new_employee
                entity_type = "employee"
                entity_id = new_employee.id
                entity_name = (
                    f"{new_employee.first_name} {new_employee.surname}".strip()
                )
                access_granted = False
                denial_reason = f"New employee created from QR: {name} ({employee_id}) - Pending verification"

                print(
                    f"AUTO-CREATED EMPLOYEE: {entity_name} ({employee_id}) from QR scan - pending verification"
                )
            else:
                existing.qr_code = qr_hash
                existing.status = "Active"
                entity = existing
                entity_type = "employee"
                entity_id = existing.id
                entity_name = f"{existing.first_name} {existing.surname}".strip()
                access_granted = True
                denial_reason = None

        # Try to create vehicle from parsed data
        elif not entity:
            fleet_id = (
                parsed_data.get("fleet_id")
                or parsed_data.get("vehicle_id")
                or parsed_data.get("registration")
            )
            if fleet_id:
                existing_vehicle = (
                    db_session.query(Vehicle).filter_by(fleet_id=str(fleet_id)).first()
                )
                if not existing_vehicle:
                    new_vehicle = Vehicle(
                        fleet_id=str(fleet_id),
                        status="Pending",
                        qr_code=qr_hash,
                    )
                    db_session.add(new_vehicle)
                    db_session.flush()

                    entity = new_vehicle
                    entity_type = "vehicle"
                    entity_id = new_vehicle.id
                    entity_name = str(fleet_id)
                    access_granted = False
                    denial_reason = f"New vehicle created from QR: {fleet_id} - Pending verification"

                    print(
                        f"AUTO-CREATED VEHICLE: {fleet_id} from QR scan - pending verification"
                    )
                else:
                    existing_vehicle.qr_code = qr_hash
                    existing_vehicle.status = "Active"
                    entity = existing_vehicle
                    entity_type = "vehicle"
                    entity_id = existing_vehicle.id
                    entity_name = str(fleet_id)
                    access_granted = True
                    denial_reason = None

        # Create placeholder if we couldn't extract meaningful data
        if not entity:
            placeholder_id = f"PLACEHOLDER{_utcnow().strftime('%Y%m%d%H%M%S%f')[:-3]}"
            placeholder_name = (
                "Unassigned QR"
                if not qr_hash or qr_hash.strip() == ""
                else f"Unassigned-{qr_hash[:15]}"
            )

            placeholder_parts = placeholder_name.split(None, 1)
            placeholder_first = (
                placeholder_parts[0] if placeholder_parts else "Unassigned"
            )
            placeholder_surname = (
                placeholder_parts[1] if len(placeholder_parts) > 1 else "QR"
            )

            new_placeholder = Employee(
                emp_code=placeholder_id,
                first_name=placeholder_first,
                surname=placeholder_surname,
                job_title="Pending Assignment",
                status="Pending",
                qr_code=qr_hash if qr_hash else placeholder_id,
                medical_expiry=None,
                induction_expiry=None,
            )
            new_placeholder.set_id_number(placeholder_id)
            db_session.add(new_placeholder)
            db_session.flush()

            entity = new_placeholder
            entity_type = "employee"
            entity_id = new_placeholder.id
            entity_name = (
                f"{new_placeholder.first_name} {new_placeholder.surname}".strip()
            )
            access_granted = False
            denial_reason = "QR not assigned - Placeholder created"

            print(
                f"PLACEHOLDER CREATED: {placeholder_id} for QR '{qr_hash[:30] if qr_hash else 'EMPTY'}'"
            )

    # NOT IN SYSTEM - set denial reason if no entity found (fallback)
    if not entity and not denial_reason:
        denial_reason = "Not registered in system"
        entity_name = entity_name or "Unknown"

    return (
        entity,
        entity_type,
        entity_id,
        entity_name,
        access_granted,
        denial_reason,
    )


def _record_gate_log(
    entity_type,
    entity_id,
    entity_name,
    direction,
    qr_hash,
    access_granted,
    denial_reason,
    gate_location,
    scanned_by,
    ip_address,
    user_agent,
    socketio,
):
    """
    Record gate log entry and emit socket event.

    Returns parsed_qr dict.
    """
    # Import decode_qr_data and _get_gate_name_from_ip from app
    from app import _get_gate_name_from_ip, decode_qr_data

    # Parse QR data for storage
    parsed_qr = (
        decode_qr_data(qr_hash) if qr_hash else {"format": "none", "raw_data": None}
    )

    # Look up gate name from IP mapping
    resolved_gate_location = _get_gate_name_from_ip(
        ip_address, scanned_by, gate_location
    )

    gate_log = GateLog(
        access_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        direction=direction,
        qr_data=qr_hash,
        access_granted=access_granted,
        denial_reason=denial_reason,
        gate_location=resolved_gate_location,
        scanned_by=scanned_by,
        ip_address=ip_address,
        user_agent=user_agent,
        parsed_qr_data=json.dumps(parsed_qr) if parsed_qr else None,
        employee_id=entity_id if entity_type == "employee" else None,
        vehicle_id=entity_id if entity_type == "vehicle" else None,
        visitor_id=entity_id if entity_type == "visitor" else None,
        equipment_id=entity_id if entity_type == "equipment" else None,
    )
    db_session.add(gate_log)

    # Visitor check-out side effect
    if entity_type == "visitor" and access_granted and direction == "OUT":
        visitor = db_session.query(Visitor).filter_by(id=entity_id).first()
        if visitor:
            visitor.status = "Checked Out"
            visitor.check_out_time = _utcnow()

    db_session.commit()

    # Invalidate dashboard and monitoring caches
    try:
        from routes.dashboard import invalidate_dashboard_cache
        from routes.monitoring import invalidate_monitoring_cache
        invalidate_dashboard_cache()
        invalidate_monitoring_cache()
    except Exception:
        pass

    socketio.emit(
        "gate_scan",
        {
            "type": entity_type,
            "name": entity_name,
            "direction": direction,
            "granted": access_granted,
            "reason": denial_reason,
            "gate": resolved_gate_location,
            "time": datetime.now().strftime("%H:%M:%S"),
        },
    )

    return parsed_qr


def process_qr_scan(
    qr_hash,
    direction,
    gate_location,
    scanned_by,
    ip_address,
    user_agent,
    socketio,
):
    """
    Process a QR code scan and return entity info and access decision.

    This is the main orchestrator that coordinates the helper functions.
    """
    # 1. Normalize QR hash
    qr_hash = _normalize_qr_hash(qr_hash)

    # 2. Look up entity
    entity, entity_type, entity_id, entity_name = _lookup_entity(qr_hash)

    # 3. Determine access
    access_result = _determine_access(
        entity,
        entity_type,
        entity_id,
        entity_name,
        qr_hash,
        direction,
        gate_location,
        scanned_by,
        ip_address,
        user_agent,
        socketio,
    )

    # Handle early return from special keyword approval
    if access_result.get("early_return"):
        return {
            "entity_type": access_result["entity_type"],
            "entity_id": access_result["entity_id"],
            "entity_name": access_result["entity_name"],
            "access_granted": access_result["access_granted"],
            "denial_reason": access_result["denial_reason"],
        }

    # Update variables from access determination
    access_granted = access_result["access_granted"]
    denial_reason = access_result["denial_reason"]
    skip_approval = access_result["skip_approval"]
    direction = access_result["direction"]
    entity = access_result["entity"]
    entity_type = access_result["entity_type"]
    entity_id = access_result["entity_id"]
    entity_name = access_result["entity_name"]

    # 4. Handle denial / create approvals or placeholders
    (
        entity,
        entity_type,
        entity_id,
        entity_name,
        access_granted,
        denial_reason,
    ) = _handle_denial(
        entity,
        entity_type,
        entity_id,
        entity_name,
        access_granted,
        denial_reason,
        qr_hash,
        gate_location,
        skip_approval,
        socketio,
    )

    # 5. Record gate log
    parsed_qr = _record_gate_log(
        entity_type,
        entity_id,
        entity_name,
        direction,
        qr_hash,
        access_granted,
        denial_reason,
        gate_location,
        scanned_by,
        ip_address,
        user_agent,
        socketio,
    )

    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "entity_name": entity_name,
        "access_granted": access_granted,
        "denial_reason": denial_reason,
        "direction": direction,
        "parsed_qr": parsed_qr,
    }


def format_rfid_tag(raw_tag):
    """Format and normalize RFID tag data from various formats.

    Supports:
    - EPC Gen2 (96-bit): E20034150200108022001F6D
    - ISO 14443A (MIFARE): 04:A2:3B:1C or 04A23B1C
    - Raw hex with/without separators
    """
    if not raw_tag:
        return None

    # Remove common separators and whitespace
    tag = raw_tag.strip().upper()
    tag = tag.replace(":", "").replace("-", "").replace(" ", "").replace(".", "")

    # Remove any prefixes some readers add
    prefixes_to_strip = ["EPC:", "UID:", "TAG:", "RFID:", "[", "]"]
    for prefix in prefixes_to_strip:
        tag = tag.replace(prefix, "")

    # Validate hex content
    if not all(c in "0123456789ABCDEF" for c in tag):
        # Non-hex tag, keep original but normalized
        return tag

    return tag


def process_rfid_scan(
    rfid_tag, direction, gate_location, scanned_by, ip_address, user_agent
):
    """Process an RFID tag scan and return entity info and access decision.

    Similar to process_qr_scan but looks up by rfid_tag field.
    """
    entity = None
    entity_type = None
    entity_id = None
    entity_name = None
    access_granted = False
    denial_reason = None

    # Try to find entity by RFID tag
    employee = db_session.query(Employee).filter_by(rfid_tag=rfid_tag).first()

    if employee:
        entity = employee
        entity_type = "employee"
        entity_id = employee.id
        entity_name = f"{employee.first_name} {employee.surname}"

    if not entity:
        vehicle = db_session.query(Vehicle).filter_by(rfid_tag=rfid_tag).first()
        if vehicle:
            entity = vehicle
            entity_type = "vehicle"
            entity_id = vehicle.id
            entity_name = vehicle.fleet_id

    if not entity:
        visitor = db_session.query(Visitor).filter_by(rfid_tag=rfid_tag).first()
        if visitor:
            entity = visitor
            entity_type = "visitor"
            entity_id = visitor.id
            entity_name = visitor.name

    if not entity:
        equipment = db_session.query(Equipment).filter_by(rfid_tag=rfid_tag).first()
        if equipment:
            entity = equipment
            entity_type = "equipment"
            entity_id = equipment.id
            entity_name = equipment.radio_id

    # Auto-direction logic (same as QR scan)
    if entity_id and entity_type:
        # PERFORMANCE: noload('*') prevents lazy-loading relationships
        # when we only need the direction column.
        from sqlalchemy.orm import noload as _noload

        last_log = (
            db_session.query(GateLog)
            .options(_noload("*"))
            .filter(
                GateLog.entity_id == entity_id,
                GateLog.access_type == entity_type,
                GateLog.access_granted,
            )
            .order_by(GateLog.scanned_at.desc())
            .first()
        )
        if last_log and last_log.direction == "IN":
            direction = "OUT"
        else:
            direction = "IN"
    else:
        direction = "IN"
        entity_name = "Unknown"
        entity_type = "unknown"

    # Access decision logic
    if entity:
        if entity_type == "employee":
            if entity.status != "Active":
                access_granted = False
                denial_reason = f"Employee status is {entity.status}"
            else:
                access_granted = True
        elif entity_type == "vehicle":
            if entity.status != "Active":
                access_granted = False
                denial_reason = f"Vehicle status is {entity.status}"
            else:
                access_granted = True
        elif entity_type == "visitor":
            if entity.status != "Checked In":
                access_granted = False
                denial_reason = f"Visitor status is {entity.status}"
            else:
                access_granted = True
        elif entity_type == "equipment":
            if entity.status != "Active":
                access_granted = False
                denial_reason = f"Equipment status is {entity.status}"
            else:
                access_granted = True
    else:
        access_granted = False
        denial_reason = "RFID tag not registered"

    # Create gate log entry
    gate_log = GateLog(
        access_type=entity_type or "unknown",
        entity_id=entity_id,
        entity_name=entity_name,
        direction=direction,
        qr_data=rfid_tag,  # Store RFID in qr_data field for compatibility
        access_granted=access_granted,
        denial_reason=denial_reason,
        gate_location=gate_location,
        scanned_by=scanned_by,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db_session.add(gate_log)

    # Visitor check-out side effect
    if entity_type == "visitor" and access_granted and direction == "OUT":
        visitor = db_session.query(Visitor).filter_by(id=entity_id).first()
        if visitor:
            visitor.status = "Checked Out"
            visitor.check_out_time = _utcnow()

    db_session.commit()

    # Invalidate caches since gate log data changed
    try:
        from routes.dashboard import invalidate_dashboard_cache
        from routes.monitoring import invalidate_monitoring_cache
        invalidate_dashboard_cache()
        invalidate_monitoring_cache()
    except Exception:
        pass

    return {
        "access_granted": access_granted,
        "denial_reason": denial_reason,
        "entity_type": entity_type,
        "entity_name": entity_name,
        "entity_id": entity_id,
        "direction": direction,
        "rfid_tag": rfid_tag,
    }
