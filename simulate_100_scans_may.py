#!/usr/bin/env python3
"""
Simulate 100 scans from May 1, 2026 to May 7, 2026 (today)
Includes employees and fleet LDV vehicles
"""

import sys
import random
from datetime import datetime, timedelta

sys.path.insert(0, '/home/tim/Desktop/01.mine-management-system')

from database import db_session, init_db
from models import Employee, Vehicle, GateLog

# Configuration
START_DATE = datetime(2026, 5, 1)
END_DATE = datetime(2026, 5, 7)
GATES = ["Main Gate", "South Gate", "North Gate", "Emergency Exit"]

def random_time_on_date(date, start_hour=6, end_hour=18):
    """Generate random datetime on given date between hours."""
    hour = random.randint(start_hour, end_hour - 1)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return date.replace(hour=hour, minute=minute, second=second)

def get_employees_and_vehicles():
    """Get active employees and LDV vehicles."""
    init_db()
    employees = db_session.query(Employee).filter_by(status="Active").all()
    vehicles = db_session.query(Vehicle).filter_by(status="Active").all()
    ldv_vehicles = [v for v in vehicles if v.fleet_id.startswith('LDV')]
    return employees, ldv_vehicles

def create_employee_scan(employee, direction, timestamp):
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
        scanned_by="bulk_may_simulation",
        ip_address="127.0.0.1",
        user_agent="Simulation/1.0",
        employee_id=employee.id
    )
    db_session.add(gate_log)
    return gate_log

def create_vehicle_scan(vehicle, direction, timestamp):
    """Create a gate log entry for a vehicle."""
    gate_log = GateLog(
        access_type="vehicle",
        entity_id=vehicle.id,
        entity_name=vehicle.fleet_id,
        direction=direction,
        scanned_at=timestamp,
        gate_location=random.choice(GATES),
        access_granted=True,
        scanned_by="bulk_may_simulation",
        ip_address="127.0.0.1",
        user_agent="Simulation/1.0",
        vehicle_id=vehicle.id
    )
    db_session.add(gate_log)
    return gate_log

def simulate_100_scans():
    """Simulate 100 scans from May 1-7, 2026 including employees and LDV fleet."""
    print("=" * 70)
    print("100 SCANS SIMULATION - MAY 1-7, 2026")
    print("=" * 70)
    print(f"Date range: {START_DATE.strftime('%Y-%m-%d')} to {END_DATE.strftime('%Y-%m-%d')}")
    print("-" * 70)
    
    employees, ldv_vehicles = get_employees_and_vehicles()
    print(f"Available employees: {len(employees)}")
    print(f"Available LDV vehicles: {len(ldv_vehicles)}")
    print("-" * 70)
    
    if not employees and not ldv_vehicles:
        print("No active employees or vehicles found!")
        return
    
    total_scans = 0
    target_scans = 100
    
    # Generate scans across the date range
    current_date = START_DATE
    
    while total_scans < target_scans and current_date <= END_DATE:
        # Mix of employees and vehicles for this day
        # 60% employees, 40% vehicles
        
        day_scans = random.randint(12, 18)  # 12-18 scans per day
        
        for _ in range(day_scans):
            if total_scans >= target_scans:
                break
                
            is_employee = random.random() < 0.6  # 60% employees
            is_in = random.random() < 0.55  # 55% IN (more IN than OUT)
            
            if is_employee and employees:
                emp = random.choice(employees)
                scan_time = random_time_on_date(current_date)
                create_employee_scan(emp, "IN" if is_in else "OUT", scan_time)
                print(f"[{total_scans+1}/100] {current_date.strftime('%m/%d')} EMP: {emp.first_name} {emp.surname} - {'IN' if is_in else 'OUT'}")
            elif ldv_vehicles:
                veh = random.choice(ldv_vehicles)
                scan_time = random_time_on_date(current_date)
                create_vehicle_scan(veh, "IN" if is_in else "OUT", scan_time)
                print(f"[{total_scans+1}/100] {current_date.strftime('%m/%d')} LDV: {veh.fleet_id} - {'IN' if is_in else 'OUT'}")
            
            total_scans += 1
        
        # Some vehicles/employees that came IN should go OUT same day
        if total_scans < target_scans:
            extra_outs = random.randint(3, 6)
            for _ in range(extra_outs):
                if total_scans >= target_scans:
                    break
                if random.random() < 0.6 and employees:
                    emp = random.choice(employees)
                    scan_time = random_time_on_date(current_date, 14, 18)  # Afternoon OUT
                    create_employee_scan(emp, "OUT", scan_time)
                    print(f"[{total_scans+1}/100] {current_date.strftime('%m/%d')} EMP: {emp.first_name} {emp.surname} - OUT")
                elif ldv_vehicles:
                    veh = random.choice(ldv_vehicles)
                    scan_time = random_time_on_date(current_date, 14, 18)
                    create_vehicle_scan(veh, "OUT", scan_time)
                    print(f"[{total_scans+1}/100] {current_date.strftime('%m/%d')} LDV: {veh.fleet_id} - OUT")
                total_scans += 1
        
        current_date += timedelta(days=1)
    
    # Commit all gate logs
    db_session.commit()
    
    print("-" * 70)
    print("Simulation complete!")
    print(f"  Total scans created: {total_scans}")
    print("=" * 70)

if __name__ == "__main__":
    simulate_100_scans()
