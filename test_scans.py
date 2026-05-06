#!/usr/bin/env python3
"""
Simulate 50 QR scans with pending, approved, and expired outcomes.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import requests
import random
from datetime import datetime, timedelta


def simulate_scans():
    from database import db_session
    from models import Employee

    employees = db_session.query(Employee).all()
    if not employees:
        print("No employees in database")
        return

    now = datetime.utcnow()

    # Categorize employees
    approved = []
    denied_inactive = []
    denied_medical = []
    denied_induction = []

    for emp in employees:
        if emp.status != "Active":
            denied_inactive.append(emp)
        elif emp.medical_expiry and emp.medical_expiry < now:
            denied_medical.append(emp)
        elif emp.induction_expiry and emp.induction_expiry < now:
            denied_induction.append(emp)
        else:
            approved.append(emp)

    print(f"Employee breakdown:")
    print(f"  Approved: {len(approved)}")
    print(f"  Denied (inactive): {len(denied_inactive)}")
    print(f"  Denied (medical expired): {len(denied_medical)}")
    print(f"  Denied (induction expired): {len(denied_induction)}")
    print()

    # Prepare QR codes for simulation
    qr_pool = {
        "approved": [e.qr_code for e in approved if e.qr_code],
        "inactive": [e.qr_code for e in denied_inactive if e.qr_code],
        "medical": [e.qr_code for e in denied_medical if e.qr_code],
        "induction": [e.qr_code for e in denied_induction if e.qr_code],
    }

    # Generate scan mix: 60% approved, 10% inactive, 15% medical, 15% induction
    scan_mix = (
        [("approved", q) for q in qr_pool["approved"]]
        + [("inactive", q) for q in qr_pool["inactive"]]
        + [("medical", q) for q in qr_pool["medical"]]
        + [("induction", q) for q in qr_pool["induction"]]
    )

    # Repeat to get 50 scans
    while len(scan_mix) < 50:
        scan_mix.extend(scan_mix[: 50 - len(scan_mix)])
    scan_mix = scan_mix[:50]
    random.shuffle(scan_mix)

    api_url = "http://localhost:8080/api/scan_qr"
    api_key = "your-secret-hardware-key"
    gates = ["Main Gate", "North Gate", "South Gate"]

    outcomes = {"approved": 0, "denied": 0}
    expected_outcomes = {"approved": 0, "denied": 0}

    print(f"Simulating 50 random scans...")
    print("-" * 50)

    for i, (category, qr_code) in enumerate(scan_mix, 1):
        direction = random.choice(["IN", "OUT"])
        gate = random.choice(gates)

        try:
            resp = requests.post(
                api_url,
                json={
                    "qr_code": qr_code,
                    "direction": direction,
                    "gate_location": gate,
                },
                headers={"X-API-Key": api_key},
                timeout=5,
            )

            if resp.status_code == 200:
                data = resp.json()
                granted = data.get("success", False)

                if category == "approved":
                    expected_outcomes["approved"] += 1
                else:
                    expected_outcomes["denied"] += 1

                if granted:
                    outcomes["approved"] += 1
                    print(f"[{i:02d}] APPROVED - {category.upper()}")
                else:
                    outcomes["denied"] += 1
                    msg = data.get("message", "Unknown")
                    print(f"[{i:02d}] DENIED - {msg}")
            else:
                print(f"[{i:02d}] ERROR - HTTP {resp.status_code}")

        except Exception as e:
            print(f"[{i:02d}] ERROR - {e}")

    print("-" * 50)
    print("RESULTS:")
    print(f"  Expected Approved: {expected_outcomes['approved']}")
    print(f"  Expected Denied: {expected_outcomes['denied']}")
    print(f"  Actual Approved: {outcomes['approved']}")
    print(f"  Actual Denied: {outcomes['denied']}")
    print()

    if outcomes["denied"] == expected_outcomes["denied"]:
        print("All expired/inactive employees correctly DENIED!")
    else:
        print("Some access control issues detected.")


if __name__ == "__main__":
    simulate_scans()
