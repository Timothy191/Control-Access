#!/usr/bin/env python3
"""
Seed the database with 100 employees for testing.
Usage: python seed_employees.py
"""

import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import base64
from io import BytesIO

import qrcode
from faker import Faker

fake = Faker()


def generate_qr_code(data):
    """Generate QR code and return as base64 string."""
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()


def random_expiry():
    """Generate random expiry date: 70% valid future, 30% expired/past."""
    choice = fake.random_int(1, 100)
    if choice <= 20:
        return None
    elif choice <= 35:
        return datetime.now() - timedelta(days=fake.random_int(1, 90))
    elif choice <= 45:
        return datetime.now() + timedelta(days=fake.random_int(1, 90))
    else:
        return datetime.now() + timedelta(days=fake.random_int(91, 365))


def seed_employees():
    from database import db_session, engine
    from models import Base, Employee

    Base.metadata.create_all(engine)

    db_session.query(Employee).delete()
    db_session.commit()

    positions = [
        "Drill Operator",
        "Blaster",
        "Loader Operator",
        "Haul Truck Driver",
        "Excavator Operator",
        "Crusher Operator",
        "Mechanic",
        "Electrician",
        "Safety Officer",
        "Geologist",
        "Surveyor",
        "Ventilation Technician",
        "Shifter Boss",
        "Foreman",
        "Engineer",
        "Technician",
    ]

    print("Seeding 100 employees...")
    expired_med = 0
    expired_ind = 0

    for i in range(1, 101):
        emp_id = f"EMP{i:03d}"
        name = fake.name()
        position = fake.random_element(positions)
        department = "Production"
        phone = fake.phone_number()[:20]
        email = f"{name.lower().replace(' ', '.')}{i}@mine.local"
        hire_date = fake.date_between(start_date="-5y", end_date="today")
        qr_data = f"EMP:{emp_id}:{generate_qr_code(emp_id)[:32]}"

        medical_expiry = random_expiry()
        induction_expiry = random_expiry()

        if medical_expiry and medical_expiry < datetime.now():
            expired_med += 1
        if induction_expiry and induction_expiry < datetime.now():
            expired_ind += 1

        employee = Employee(
            employee_id=emp_id,
            name=name,
            position=position,
            department=department,
            phone=phone,
            email=email,
            qr_code=qr_data,
            hire_date=datetime.combine(hire_date, datetime.min.time()),
            status="Active",
            medical_expiry=medical_expiry,
            induction_expiry=induction_expiry,
        )
        db_session.add(employee)

        if i % 10 == 0:
            db_session.commit()
            print(f"  {i}/100 committed...")

    db_session.commit()
    count = db_session.query(Employee).count()
    print(f"\nDone! {count} employees seeded.")
    print(f"Department: {department}")
    print("QR codes: Generated for all employees")
    print(f"Expired Medical: {expired_med}, Expired Induction: {expired_ind}")


if __name__ == "__main__":
    seed_employees()
