#!/usr/bin/env python3
"""
Simulate realistic morning clock-in gate logs for today.

Groups:
  - Office/Admin  : 1 remaining Administrator (PAULINA PHIRI)
                    + Clerk Control Room, Clerk Weighbridge, Engineering Clerk,
                      HR Manager, Payroll Admin, Pit Superintendent, Facilitator
  - Plant (1/4)   : random sample of 25% from Plant Manager/Foreman/Operator/
                    Manager Plant/Assistant Plant
  - Workshop ALL  : every Mechanic, Artisan, Assistant Mechanic/Blasting/Greaser/
                    Tyre/Tarpaulin, Electrician, Diesel/Drill Assistant,
                    Engineering Assistant, Boilermaker, Millright

Scan times: staggered IN between 05:45 and 08:30 this morning.
Gate      : Main Gate  |  Scanner: main-gate-scanner  |  IP: 192.168.1.10
"""

import random
from datetime import datetime, timedelta

from database import init_db, db_session
from models import Employee, GateLog

# ── Configuration ────────────────────────────────────────────────────────────
GATE_LOCATION = "Main Gate"
SCANNED_BY    = "main-gate-scanner"
SCANNER_IP    = "192.168.1.10"
USER_AGENT    = "MineGate/2.1 HardwareScanner"

# Today's morning window  05:45 → 08:30
TODAY = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
WINDOW_START = TODAY + timedelta(hours=5, minutes=45)
WINDOW_END   = TODAY + timedelta(hours=8, minutes=30)

# ── Job-title category maps ───────────────────────────────────────────────────
OFFICE_TITLES = {
    "Administrator",
    "Clerk Control Room",
    "Clerk Weighbridge",
    "Clerk Stores",
    "Engineering Clerk",
    "Human Resources Manager",
    "Payroll Administrator",
    "Pit Superintendent",
    "Facilitator",
    "Mine Manager",
    "G.E.S",
}

PLANT_TITLES = {
    "Plant Manager",
    "Manager Plant",
    "Plant Foreman",
    "Plant Operator",
    "Assistant Plant",
    "Weighbridge Operator",
}

WORKSHOP_TITLES = {
    "Appy Mechanic",
    "Artisan Boilermaker",
    "Artisan Drill Mechanic",
    "Artisan Mechanic",
    "Artisan Mechanic Semi Skilled",
    "Artisan Millright",
    "Assistant Auto Electrician",
    "Assistant Mechanic",
    "Assistant Greaser",
    "Assistant Tarpaulin",
    "Assistant Tyre",
    "Electrician",
    "Engineering Assistant",
    "Engineering Foreman",
    "Diesel Assistant",
    "Diesel Bowser Assistant",
    "Drill Assistant",
    "Greaser",
    "Assistant Blasting",
}

# Exclude these 4 Administrators by emp_code
EXCLUDED_EMP_CODES = {"3313", "3398", "3420", "BRAK0085"}


def random_scan_time():
    """Random datetime within this morning's window."""
    delta = WINDOW_END - WINDOW_START
    return WINDOW_START + timedelta(seconds=random.randint(0, int(delta.total_seconds())))


def already_clocked_in_today(employee_id: int) -> bool:
    """Return True if this employee already has a gate log today."""
    return db_session.query(GateLog).filter(
        GateLog.employee_id == employee_id,
        GateLog.scanned_at >= TODAY,
        GateLog.access_granted == True,
        GateLog.direction == "IN",
    ).first() is not None


def insert_clock_in(emp: Employee, scan_time: datetime) -> GateLog:
    log = GateLog(
        access_type="employee",
        entity_id=emp.id,
        entity_name=f"{emp.first_name} {emp.surname}",
        direction="IN",
        qr_data=emp.qr_code,
        access_granted=True,
        denial_reason=None,
        gate_location=GATE_LOCATION,
        scanned_at=scan_time,
        scanned_by=SCANNED_BY,
        ip_address=SCANNER_IP,
        user_agent=USER_AGENT,
        employee_id=emp.id,
    )
    db_session.add(log)
    return log


def main():
    init_db()

    all_active = db_session.query(Employee).filter_by(status="Active").all()

    # ── Build groups ──────────────────────────────────────────────────────────
    office_group   = []
    plant_group    = []
    workshop_group = []

    for emp in all_active:
        if not emp.qr_code:
            continue
        title = (emp.job_title or "").strip()
        code  = (emp.emp_code or "").strip()

        if title in OFFICE_TITLES and code not in EXCLUDED_EMP_CODES:
            office_group.append(emp)
        elif title in PLANT_TITLES:
            plant_group.append(emp)
        elif title in WORKSHOP_TITLES:
            workshop_group.append(emp)

    # Plant: 1/4 random sample
    plant_sample_size = max(1, len(plant_group) // 4)
    plant_sample = random.sample(plant_group, plant_sample_size)

    # ── Summary before insert ─────────────────────────────────────────────────
    print("=" * 60)
    print("  Morning Clock-In Simulation")
    print(f"  Date   : {TODAY.strftime('%Y-%m-%d')}")
    print(f"  Window : {WINDOW_START.strftime('%H:%M')} – {WINDOW_END.strftime('%H:%M')}")
    print("=" * 60)
    print(f"  Office   : {len(office_group)} employees (all)")
    print(f"  Plant    : {len(plant_sample)} / {len(plant_group)} (1/4 sample)")
    print(f"  Workshop : {len(workshop_group)} employees (all)")
    total = len(office_group) + len(plant_sample) + len(workshop_group)
    print(f"  TOTAL    : {total} clock-ins to insert")
    print("=" * 60)

    inserted = 0
    skipped  = 0

    groups = [
        ("Office",   office_group),
        ("Plant",    plant_sample),
        ("Workshop", workshop_group),
    ]

    for group_name, members in groups:
        # Sort by scan time so logs appear in natural order
        timed = sorted([(emp, random_scan_time()) for emp in members], key=lambda x: x[1])
        for emp, t in timed:
            if already_clocked_in_today(emp.id):
                print(f"  SKIP  [{group_name:8s}] {emp.first_name} {emp.surname} — already clocked in today")
                skipped += 1
                continue
            log = insert_clock_in(emp, t)
            print(f"  IN    [{group_name:8s}] {t.strftime('%H:%M:%S')}  {emp.first_name} {emp.surname:20s}  ({emp.job_title})")
            inserted += 1

    db_session.commit()

    print()
    print("=" * 60)
    print(f"  Done. Inserted: {inserted}  |  Skipped (duplicate): {skipped}")
    print("=" * 60)


if __name__ == "__main__":
    main()
