#!/usr/bin/env python3
"""
Simulate 1 day of employee IN/OUT scans.
Creates realistic gate log entries directly in the database.
"""

import sys
import random
from datetime import datetime, timedelta

sys.path.insert(0, '/home/tim/Desktop/01.mine-management-system')

from database import db_session, init_db
from models import Employee, GateLog

# Configuration
SIMULATION_DATE = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
SHIFT_START = 6  # 6 AM
SHIFT_END = 18   # 6 PM
GATES = ["Main Gate", "South Gate", "North Gate", "Emergency Exit"]

def get_employees():
    """Get all active employees from database."""
    init_db()
    return db_session.query(Employee).filter_by(status="Active").all()

def random_time_between(start_hour, end_hour, date):
    """Generate random datetime between hours on given date."""
    hour = random.randint(start_hour, end_hour - 1)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return date.replace(hour=hour, minute=minute, second=second)

def create_gate_log(employee, direction, timestamp):
    """Create a gate log entry for an employee."""
    name = f"{employee.first_name or ''} {employee.surname or ''}".strip()
    gate_log = GateLog(
        access_type="employee",
        entity_id=employee.id,
        entity_name=name,
        direction=direction,
        scanned_at=timestamp,
        gate_location=random.choice(GATES),
        access_granted=True,
        scanned_by="simulation",
        ip_address="127.0.0.1",
        user_agent="Simulation/1.0",
        employee_id=employee.id
    )
    db_session.add(gate_log)
    return gate_log

def simulate_day():
    """Simulate one day of IN/OUT scans."""
    print("=" * 70)
    print("1 DAY SCAN SIMULATION")
    print("=" * 70)
    print(f"Simulation date: {SIMULATION_DATE.strftime('%Y-%m-%d')}")
    print("-" * 70)
    
    employees = get_employees()
    print(f"Total active employees: {len(employees)}")
    
    if not employees:
        print("No active employees found!")
        return
    
    # Select ~70% of employees to work today
    working_employees = random.sample(employees, int(len(employees) * 0.7))
    print(f"Employees working today: {len(working_employees)}")
    print("-" * 70)
    
    in_count = 0
    out_count = 0
    
    # Morning IN scans (6:00 - 8:00 AM)
    print("Generating morning IN scans (6:00-8:00 AM)...")
    for emp in working_employees:
        # 90% show up for work
        if random.random() < 0.9:
            scan_time = random_time_between(6, 8, SIMULATION_DATE)
            create_gate_log(emp, "IN", scan_time)
            in_count += 1
    
    # Some employees go OUT for lunch (12:00 - 13:00)
    print("Generating lunch OUT scans (12:00-13:00)...")
    lunch_out_employees = random.sample(working_employees, int(len(working_employees) * 0.3))
    for emp in lunch_out_employees:
        scan_time = random_time_between(12, 13, SIMULATION_DATE)
        create_gate_log(emp, "OUT", scan_time)
        out_count += 1
        # They come back IN after lunch
        return_time = scan_time + timedelta(minutes=random.randint(30, 90))
        create_gate_log(emp, "IN", return_time)
        in_count += 1
    
    # Evening OUT scans (16:00 - 18:00)
    print("Generating evening OUT scans (16:00-18:00)...")
    for emp in working_employees:
        # Check if employee came in morning
        morning_in = db_session.query(GateLog).filter_by(
            entity_id=emp.id, 
            direction="IN",
            access_type="employee"
        ).filter(GateLog.scanned_at >= SIMULATION_DATE).first()
        
        if morning_in:
            scan_time = random_time_between(16, 18, SIMULATION_DATE)
            create_gate_log(emp, "OUT", scan_time)
            out_count += 1
    
    # Commit all gate logs
    db_session.commit()
    
    print("-" * 70)
    print("Simulation complete!")
    print(f"  IN scans: {in_count}")
    print(f"  OUT scans: {out_count}")
    print(f"  Total scans: {in_count + out_count}")
    print("=" * 70)

def main():
    simulate_day()

if __name__ == "__main__":
    main()
