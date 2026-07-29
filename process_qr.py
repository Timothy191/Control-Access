    if not recent_gate_log:
        # Get all recent pending approvals and check for exact QR match
        all_pending = db_session.query(Approval).filter(
            Approval.status == "Pending",
            Approval.created_at >= _utcnow() - timedelta(seconds=10)
        ).all()
        
        # Check each pending approval for exact QR match
        for pending in all_pending:
            if pending.scanned_data and qr_hash in pending.scanned_data:
                try:
                    pending_data = json.loads(pending.scanned_data)
                    # Exact match on qr_code field
                    if pending_data.get('qr_code') == qr_hash:
                        recent_approval = pending
                        print(f"EXACT QR MATCH: Found pending approval with matching QR code")
                        break
                except:
                    # If JSON parsing fails, check if raw QR is in the string
                    if qr_hash in pending.scanned_data:
                        recent_approval = pending
                        print(f"STRING MATCH: Found pending approval containing QR data")
                        break
    
    # Auto-approve on second scan within 10 seconds for ANY QR code
    if recent_gate_log or recent_approval:
        # Auto-approve on second scan within 10 seconds
        source = "gate log" if recent_gate_log else "approval"
        
        # Force access granted for auto-approval
        access_granted = True
        denial_reason = None
        
        if recent_approval:
            recent_approval.status = "Approved"
            recent_approval.approved_by = "system-auto"
            recent_approval.approval_date = _utcnow()
            recent_approval.comments = f"Auto-approved due to repeated scan within 10 seconds at {_utcnow().strftime('%H:%M:%S')}"
        
        print(f"AUTO-APPROVAL: QR {qr_hash[:30]}... auto-approved on second scan (found in {source})")
        
        # Extract scanned data from approval or parse from QR
        scanned_data = {}
        if recent_approval and recent_approval.scanned_data:
            try:
                scanned_data = json.loads(recent_approval.scanned_data)
            except:
                scanned_data = {}
        else:
            # Parse data directly from QR code
                import re
                id_match = re.search(r'ID[:\s]*(\d+)', qr_hash)
                name_match = re.search(r'Name\s*(?:and\s*Surname)?[:\s]*([^\|]+)', qr_hash, re.IGNORECASE)
                job_match = re.search(r'Job[:\s]*([^\|]+)', qr_hash, re.IGNORECASE)
                coy_match = re.search(r'Coy[:\s]*([^\|]+)', qr_hash, re.IGNORECASE)
                
                if id_match:
                    scanned_data["employee_id"] = id_match.group(1)
                if name_match:
                    scanned_data["name"] = name_match.group(1).strip()
                if job_match:
                    scanned_data["position"] = job_match.group(1).strip()
                if coy_match:
                    scanned_data["department"] = coy_match.group(1).strip()
            
            # Create employee record only if entity doesn't exist and this was an unknown entity
        if not entity:
            emp_id = scanned_data.get('employee_id') or f"AUTO{_utcnow().strftime('%Y%m%d%H%M%S')}"
            name = scanned_data.get('name') or f"Auto-{qr_hash[:20]}"
            position = scanned_data.get('position') or 'Auto-approved'
            department = scanned_data.get('department') or 'Unknown'
            
            existing_employee = db_session.query(Employee).filter_by(emp_code=emp_id).first()
            if not existing_employee:
                # Parse name into first_name and surname
                name_parts = name.split(None, 1)
                first_name = name_parts[0] if name_parts else name
                surname = name_parts[1] if len(name_parts) > 1 else ''
                
                new_employee = Employee(
                    emp_code=emp_id,
                    first_name=first_name,
                    surname=surname,
                    job_title=position,
                    status="Active",
                    qr_code=qr_hash  # Store original QR for future scans
                )
                db_session.add(new_employee)
                db_session.flush()
                
                entity = new_employee
                entity_type = "employee"
                entity_id = new_employee.id
                entity_name = f"{new_employee.first_name} {new_employee.surname}".strip()
                
                if recent_approval:
                    recent_approval.request_id = new_employee.id
            else:
                # Update existing employee to active
                existing_employee.status = "Active"
                entity = existing_employee
                entity_type = "employee"
                entity_id = existing_employee.id
                entity_name = f"{existing_employee.first_name} {existing_employee.surname}".strip()
                
                if recent_approval:
                    recent_approval.request_id = existing_employee.id
    
    # Initialize approval variable to prevent scope issues
    approval = None
    
    # Only create approval for unknown entities or pending status (not for denied expired or auto-approved)
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
                if qr_hash.startswith('{'):
                    parsed_json = json.loads(qr_hash)
                    if isinstance(parsed_json, dict):
                        scanned_details["employee_id"] = parsed_json.get("employee_id") or parsed_json.get("id")
                        scanned_details["name"] = parsed_json.get("name")
                        scanned_details["position"] = parsed_json.get("position") or parsed_json.get("job")
                        scanned_details["department"] = parsed_json.get("department") or parsed_json.get("coy") or parsed_json.get("company")
                        is_json = True
            except:
                pass

            if not is_json:
                import re
                
                # Extract ID -> maps to employee_id
                id_match = re.search(r'ID[:\s]*(\d+)', qr_hash)
            if id_match:
                scanned_details["employee_id"] = id_match.group(1)
            
            # Extract Name -> maps to name
            name_match = re.search(r'Name\s*(?:and\s*Surname)?[:\s]*([^\|]+)', qr_hash, re.IGNORECASE)
            if name_match:
                scanned_details["name"] = name_match.group(1).strip()
            
            # Extract Job -> maps to position
            job_match = re.search(r'Job[:\s]*([^\|]+)', qr_hash, re.IGNORECASE)
            if job_match:
                scanned_details["position"] = job_match.group(1).strip()
            
            # Extract Coy (Company) -> maps to department
            coy_match = re.search(r'Coy[:\s]*([^\|]+)', qr_hash, re.IGNORECASE)
            if coy_match:
                scanned_details["department"] = coy_match.group(1).strip()
            
            # Extract area
            area_match = re.search(r'Area[:\s]*([^\|]+)', qr_hash, re.IGNORECASE)
            if area_match:
                scanned_details["area"] = area_match.group(1).strip()

        # Create approval request with scanned data
        approval = Approval(
            request_type="Employee QR Scan" if scanned_details.get("employee_id") else "Unknown QR Scan",
            request_id=entity_id if entity_id else 0,
            requester_name=scanned_details.get("name") or entity_name or "Unknown",
            details=f"QR scan at {gate_location} (ID: {scanned_details.get('employee_id', 'N/A')})",
            status="Pending",
            scanned_data=json.dumps(scanned_details),
            target_table="employees",  # Default to employees table
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

    # HANDLE EMPTY OR UNKNOWN QR CODES - Try to extract and create records from parsed data
    if not entity and not denial_reason:
        # Parse QR data to try to extract structured information
        parsed_data = decode_qr_data(qr_hash) if qr_hash else {}
        
        # Try to create employee from parsed data
        employee_id = parsed_data.get('employee_id') or parsed_data.get('id')
        name = parsed_data.get('name')
        position = parsed_data.get('position') or parsed_data.get('job_title') or parsed_data.get('job')
        department = parsed_data.get('department') or parsed_data.get('coy') or parsed_data.get('company')
        
        if employee_id and name:
            # Check if employee already exists by emp_code
            existing = db_session.query(Employee).filter_by(emp_code=str(employee_id)).first()
            if not existing:
                # Parse name into first_name and surname
                name_parts = name.split(None, 1)
                first_name = name_parts[0] if name_parts else name
                surname = name_parts[1] if len(name_parts) > 1 else ''
                
                new_employee = Employee(
                    emp_code=str(employee_id),
                    first_name=first_name,
                    surname=surname,
                    job_title=position or 'Unknown',
                    status="Pending",  # Mark as pending until verified
                    qr_code=qr_hash,
                    id_number=str(employee_id),
                )
                db_session.add(new_employee)
                db_session.flush()
                
                entity = new_employee
                entity_type = "employee"
                entity_id = new_employee.id
                entity_name = f"{new_employee.first_name} {new_employee.surname}".strip()
                access_granted = False  # Still deny until properly verified
                denial_reason = f"New employee created from QR: {name} ({employee_id}) - Pending verification"
                
                print(f"AUTO-CREATED EMPLOYEE: {entity_name} ({employee_id}) from QR scan - pending verification")
            else:
                # Employee exists, update QR and activate
                existing.qr_code = qr_hash
                existing.status = "Active"
                entity = existing
                entity_type = "employee"
                entity_id = existing.id
                entity_name = f"{existing.first_name} {existing.surname}".strip()
                access_granted = True
                denial_reason = None
                
        # Try to create vehicle from parsed data (if not employee data found)
        elif not entity:
            fleet_id = parsed_data.get('fleet_id') or parsed_data.get('vehicle_id') or parsed_data.get('registration')
            if fleet_id:
                existing_vehicle = db_session.query(Vehicle).filter_by(fleet_id=str(fleet_id)).first()
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
                    
                    print(f"AUTO-CREATED VEHICLE: {fleet_id} from QR scan - pending verification")
                else:
                    # Vehicle exists, update QR and activate
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
            placeholder_name = "Unassigned QR" if not qr_hash or qr_hash.strip() == "" else f"Unassigned-{qr_hash[:15]}"
            
            placeholder_parts = placeholder_name.split(None, 1)
            placeholder_first = placeholder_parts[0] if placeholder_parts else 'Unassigned'
            placeholder_surname = placeholder_parts[1] if len(placeholder_parts) > 1 else 'QR'
            
            new_placeholder = Employee(
                emp_code=placeholder_id,
                first_name=placeholder_first,
                surname=placeholder_surname,
                id_number=placeholder_id,
                job_title="Pending Assignment",
                status="Pending",
                qr_code=qr_hash if qr_hash else placeholder_id,
                medical_expiry=None,
                induction_expiry=None
            )
            db_session.add(new_placeholder)
            db_session.flush()
            
            entity = new_placeholder
            entity_type = "employee"
            entity_id = new_placeholder.id
            entity_name = f"{new_placeholder.first_name} {new_placeholder.surname}".strip()
            access_granted = False
            denial_reason = "QR not assigned - Placeholder created"
            
            print(f"PLACEHOLDER CREATED: {placeholder_id} for QR '{qr_hash[:30] if qr_hash else 'EMPTY'}'")
    
    # NOT IN SYSTEM - set denial reason if no entity found (fallback)
    if not entity and not denial_reason:
        denial_reason = "Not registered in system"
        entity_name = entity_name or "Unknown"

    # Parse QR data for storage
    parsed_qr = decode_qr_data(qr_hash) if qr_hash else {"format": "none", "raw_data": None}
    
    # Look up gate name from IP mapping, fallback to provided gate_location
    resolved_gate_location = _get_gate_name_from_ip(ip_address, scanned_by, gate_location)
    
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
    db_session.commit()

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

    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "entity_name": entity_name,
        "access_granted": access_granted,
        "denial_reason": denial_reason,
        "parsed_qr": parsed_qr,
    }


@app.route("/kiosk")
def kiosk_scanner():
    """Full-screen kiosk page for C66 keyboard emulator and InfoWedge browser mode.
    Open this URL on the C66's browser / WebView — it captures all barcode input
    and shows a forced full-screen GREEN/RED overlay.
    """
    return render_template("kiosk_scanner.html")


@app.route("/scan/<qr_hash>")
@app.route("/s/<qr_hash>")
def universal_scan(qr_hash):
    """Visual feedback for any camera-based scanner (phone, 3rd-party app)."""
    ip_address = request.remote_addr
    user_agent = request.headers.get("User-Agent", "WebBrowser")

    result = _process_qr_scan(qr_hash, "AUTO", "Web Scanner", "web_browser", ip_address, user_agent)

    return render_template(
        "scan_result.html",
        success=result["access_granted"],
        name=result["entity_name"],
        entity_type=result["entity_type"],
        denial_reason=result["denial_reason"],
        direction=result.get("direction", "IN"),
        reset_ms=4000,
    )


@app.route("/api/scan_qr", methods=["POST"])
@require_api_key
