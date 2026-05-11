#!/usr/bin/env python3
"""
Seed database with sample data using Faker.
Generates 50 employees and 100+ gate scan logs for testing/demo purposes.

Usage:
    python seed_data.py         # Add sample data
    python seed_data.py --clear # Clear existing data first, then populate
"""

import argparse
import hashlib
import random
from datetime import datetime, timedelta
from faker import Faker

from database import init_db, db_session
from models import Employee, Vehicle, Visitor, GateLog

fake = Faker()

# South African Names
SA_FIRST_NAMES = [
    # Zulu/Swati/Ndebele names
    "Thabo", "Sibusiso", "Nkosinathi", "Lungile", "Mandla", "Nokuthula", "Nomusa", "Zanele",
    "Sizwe", "Musa", "Lindiwe", "Bongani", "Jabulani", "Phumlani", "Nqobile", "Mhlengi",
    "Zinhle", "Mbalenhle", "Sithembiso", "Ncamisile", "Mglongo", "Mthunzi", "Mvelo",
    # Xhosa names
    "Lungile", "Siyabonga", "Nosipho", "Akhona", "Ayanda", "Luyanda", "Babalwa", "Zimasa",
    "Vuyo", "Vuyiswa", "Zola", "Zoliswa", "Gcobani", "Nomalizo", "Sandile", "Khayalethu",
    # Sotho/Tswana/Pedi names
    "Kabelo", "Teboho", "Lebogang", "Dineo", "Keabetswe", "Kgomotso", "Tshepo", "Puleng",
    "Mpho", "Karabo", "Botlhale", "Otsile", "Lesedi", "Rethabile", "Amogelang", "Boitumelo",
    # Afrikaans names
    "Pieter", "Jan", "Willem", "Johannes", "Jacobus", "Annelise", "Elizabeth", "Susan",
    "Andries", "Francois", "Mari", "Schalk", "Gerhard", "Magda", "Hendrik", "Susanna",
    # English/Other
    "James", "Michael", "David", "John", "Mary", "Sarah", "Emily", "Daniel", "Matthew"
]

SA_SURNAMES = [
    # Zulu surnames
    "Dlamini", "Zulu", "Buthelezi", "Khumalo", "Mthethwa", "Mkhize", "Nxumalo", "Gumede",
    "Mhlangu", "Zungu", "Mngomezulu", "Mthembu", "Cele", "Ngcobo", "Mnguni", "Zondi",
    "Mglongo", "Ndimande", "Ngubane", "Nzuza", "Qwabe", "Sithole", "Mazibuko", "Nene",
    # Xhosa surnames
    "Tshabalala", "Ngcobo", "Mahlangu", "Ndlovu", "Mokoena", "Ntuli", "Mabaso", "Gumede",
    "Mthembu", "Radebe", "Sithole", "Msibi", "Dlamini", "Shabalala", "Mthimkhulu",
    # Sotho/Tswana/Pedi surnames
    "Mokoena", "Molefe", "Motaung", "Nkosi", "Mohale", "Motsepe", "Tau", "Mokwena",
    "Sebola", "Mashaba", "Kgomo", "Mahlangu", "Moeketsi", "Leshaba", "Ledwaba",
    # Afrikaans surnames
    "Van der Merwe", "Botha", "De Villiers", "Van Wyk", "Fourie", "Pretorius", "Kruger",
    "Meyer", "Steyn", "Bosch", "Venter", "Coetzee", "Oosthuizen", "Barnard", "Louw",
    # English/Other
    "Smith", "Johnson", "Brown", "Jones", "Williams", "Taylor", "Wilson", "Roberts"
]

# Configuration
NUM_EMPLOYEES = 50
NUM_VEHICLES = 15
NUM_VISITORS = 20
NUM_GATE_LOGS = 150

# Sample data for realistic generation
DEPARTMENTS = [
    "Mining Operations",
    "Engineering",
    "Safety & Compliance",
    "Maintenance",
    "Logistics",
    "Administration",
    "Environmental",
    "Geology",
    "Security"
]

POSITIONS = [
    "Mine Supervisor",
    "Equipment Operator",
    "Safety Officer",
    "Maintenance Technician",
    "Mining Engineer",
    "Geologist",
    "Logistics Coordinator",
    "Environmental Specialist",
    "Security Guard",
    "Drill Operator",
    "Surveyor",
    "Warehouse Manager",
    "HR Coordinator",
    "Finance Analyst",
    "IT Support"
]

VEHICLE_TYPES = ["Dump Truck", "Excavator", "Bulldozer", "Loader", "Drill Rig", "Utility Vehicle", "Bus"]
VEHICLE_MODELS = ["CAT 785D", "Komatsu 930E", "Volvo A60H", "CAT D11", "Hitachi EX5600", "Mercedes Sprinter"]

GATE_LOCATIONS = ["Main Gate", "North Gate", "South Gate", "Emergency Exit", "Loading Bay"]
SCANNERS = ["security-kiosk-01", "security-kiosk-02", "main-gate-scanner", "mobile-scanner-01", "admin-desktop"]


def generate_qr_hash(entity_type, entity_id, identifier):
    """Generate QR code hash similar to the main app."""
    qr_data = f"{entity_type}:{entity_id}:{identifier}:{datetime.now().timestamp()}"
    return hashlib.sha256(qr_data.encode()).hexdigest()[:32]


def create_employees(count=NUM_EMPLOYEES):
    """Create realistic employee records."""
    employees = []
    used_ids = set()

    print(f"Creating {count} employees...")

    for i in range(count):
        while True:
            emp_code = f"EMP{fake.unique.random_number(digits=5):05d}"
            if emp_code not in used_ids:
                used_ids.add(emp_code)
                break

        first_name = random.choice(SA_FIRST_NAMES)
        surname = random.choice(SA_SURNAMES)

        status = random.choices(
            ["Active", "Inactive", "On Leave"],
            weights=[85, 10, 5]
        )[0]

        employee = Employee(
            emp_code=emp_code,
            first_name=first_name,
            surname=surname,
            id_number=fake.unique.numerify(text="############"),  # 12-digit SA ID
            job_title=random.choice(POSITIONS),
            status=status,
        )

        db_session.add(employee)
        employees.append(employee)

        if (i + 1) % 10 == 0:
            print(f"  Created {i + 1}/{count} employees...")

    db_session.commit()

    print("Generating QR codes for employees...")
    for emp in employees:
        emp.qr_code = generate_qr_hash("EMP", emp.id, emp.emp_code)

    db_session.commit()
    print(f"✓ Created {len(employees)} employees")

    return employees


def create_vehicles(count=NUM_VEHICLES):
    """Create realistic vehicle records."""
    vehicles = []
    used_regs = set()

    print(f"Creating {count} vehicles...")

    for i in range(count):
        while True:
            fleet_id = fake.unique.license_plate().replace(" ", "").upper()[:50]
            if fleet_id not in used_regs and len(fleet_id) >= 5:
                used_regs.add(fleet_id)
                break

        status = random.choices(
            ["Active", "Inactive", "Maintenance"],
            weights=[80, 10, 10]
        )[0]

        reg_expiry = None
        if status != "Maintenance":
            try:
                reg_expiry = datetime.combine(fake.date_between(start_date="-6M", end_date="+6M"), datetime.min.time())
            except:
                pass

        vehicle = Vehicle(
            fleet_id=fleet_id,
            registration_expiry=reg_expiry,
            status=status,
        )

        db_session.add(vehicle)
        vehicles.append(vehicle)

    db_session.commit()

    for veh in vehicles:
        veh.qr_code = generate_qr_hash("VEH", veh.id, veh.fleet_id)

    db_session.commit()
    print(f"✓ Created {len(vehicles)} vehicles")

    return vehicles


def create_visitors(count=NUM_VISITORS, employees=None):
    """Create realistic visitor records."""
    visitors = []

    print(f"Creating {count} visitors...")

    for i in range(count):
        status = random.choices(
            ["Checked In", "Checked Out"],
            weights=[30, 70]
        )[0]

        check_in = fake.date_time_between(start_date="-7d", end_date="now")
        check_out = None

        if status == "Checked Out":
            # Random duration between 30 minutes and 8 hours
            duration_hours = random.uniform(0.5, 8)
            check_out = check_in + timedelta(hours=duration_hours)

        host = random.choice(employees) if employees and random.random() > 0.3 else None

        visitor = Visitor(
            name=f"{random.choice(SA_FIRST_NAMES)} {random.choice(SA_SURNAMES)}",
            company=fake.company() if random.random() > 0.3 else None,
            purpose=random.choice([
                "Business Meeting",
                "Site Inspection",
                "Maintenance Work",
                "Delivery",
                "Training Session",
                "Safety Audit",
                "Equipment Demo"
            ]),
            host_id=host.id if host else None,
            check_in_time=check_in,
            check_out_time=check_out,
            status=status
        )

        db_session.add(visitor)
        visitors.append(visitor)

    db_session.commit()

    # Generate QR codes
    for vis in visitors:
        vis.qr_code = generate_qr_hash("VIS", vis.id, vis.name)

    db_session.commit()
    print(f"✓ Created {len(visitors)} visitors")

    return visitors


def create_gate_logs(count=NUM_GATE_LOGS, employees=None, vehicles=None, visitors=None):
    """Create realistic gate scan logs."""
    print(f"Creating {count} gate scan logs...")

    all_entities = []

    # Prepare entity lists with their types
    if employees:
        for emp in employees:
            all_entities.append(("employee", emp.id, f"{emp.first_name} {emp.surname}", emp.qr_code, emp.emp_code))

    if vehicles:
        for veh in vehicles:
            all_entities.append(("vehicle", veh.id, veh.fleet_id, veh.qr_code, veh.fleet_id))

    if visitors:
        for vis in visitors:
            all_entities.append(("visitor", vis.id, vis.name, vis.qr_code, vis.name))

    # Create logs distributed over past 30 days
    for i in range(count):
        entity_type, entity_id, entity_name, qr_code, identifier = random.choice(all_entities)

        # Random timestamp in past 30 days, weighted toward recent
        days_ago = random.expovariate(1/10)  # Exponential distribution, most in last 10 days
        days_ago = min(days_ago, 30)  # Cap at 30 days
        scanned_at = datetime.now() - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59))

        direction = random.choice(["IN", "OUT"])

        # Access granted with high probability for employees and vehicles
        if entity_type in ["employee", "vehicle"]:
            access_granted = random.choices([True, False], weights=[95, 5])[0]
        else:
            access_granted = random.choices([True, False], weights=[80, 20])[0]

        denial_reason = None
        if not access_granted:
            denial_reason = random.choice([
                "Invalid QR code",
                "Employee status is inactive",
                "Vehicle is not active",
                "Visitor not checked in",
                "Access expired"
            ])

        gate_location = random.choice(GATE_LOCATIONS)
        scanned_by = random.choice(SCANNERS)

        # Foreign key references
        emp_id = entity_id if entity_type == "employee" else None
        veh_id = entity_id if entity_type == "vehicle" else None
        vis_id = entity_id if entity_type == "visitor" else None

        log = GateLog(
            access_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            direction=direction,
            qr_data=qr_code,
            access_granted=access_granted,
            denial_reason=denial_reason,
            gate_location=gate_location,
            scanned_at=scanned_at,
            scanned_by=scanned_by,
            ip_address=fake.ipv4(),
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            employee_id=emp_id,
            vehicle_id=veh_id,
            visitor_id=vis_id
        )

        db_session.add(log)

        if (i + 1) % 50 == 0:
            print(f"  Created {i + 1}/{count} scan logs...")

    db_session.commit()
    print(f"✓ Created {count} gate scan logs")


def clear_existing_data():
    """Clear all existing data from tables."""
    print("Clearing existing data...")

    # Delete in order to avoid foreign key constraints
    db_session.query(GateLog).delete()
    db_session.query(Visitor).delete()
    db_session.query(Vehicle).delete()
    db_session.query(Employee).delete()

    db_session.commit()
    print("✓ Cleared existing data")


def main():
    parser = argparse.ArgumentParser(description="Seed database with sample data")
    parser.add_argument("--clear", action="store_true", help="Clear existing data before seeding")
    parser.add_argument("--employees", type=int, default=NUM_EMPLOYEES, help=f"Number of employees (default: {NUM_EMPLOYEES})")
    parser.add_argument("--vehicles", type=int, default=NUM_VEHICLES, help=f"Number of vehicles (default: {NUM_VEHICLES})")
    parser.add_argument("--visitors", type=int, default=NUM_VISITORS, help=f"Number of visitors (default: {NUM_VISITORS})")
    parser.add_argument("--logs", type=int, default=NUM_GATE_LOGS, help=f"Number of gate logs (default: {NUM_GATE_LOGS})")

    args = parser.parse_args()

    print("=" * 55)
    print("   Arch-System - Database Seeder")
    print("=" * 55)

    # Initialize database
    init_db()

    # Clear existing data if requested
    if args.clear:
        clear_existing_data()

    print(f"\nGenerating sample data:")
    print(f"  - {args.employees} employees")
    print(f"  - {args.vehicles} vehicles")
    print(f"  - {args.visitors} visitors")
    print(f"  - {args.logs} gate scan logs")
    print()

    # Create data
    employees = create_employees(args.employees)
    vehicles = create_vehicles(args.vehicles)
    visitors = create_visitors(args.visitors, employees)
    create_gate_logs(args.logs, employees, vehicles, visitors)

    print()
    print("=" * 55)
    print("✓ Database seeded successfully!")
    print("=" * 55)
    print(f"\nYou can now:")
    print(f"  - View employees at: http://localhost:5000/employees")
    print(f"  - View gate logs at: http://localhost:5000/gate_logs")
    print(f"  - Export PDF reports from the dashboard")


if __name__ == "__main__":
    main()
