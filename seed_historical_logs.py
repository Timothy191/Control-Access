#!/usr/bin/env python3
import os
import random
import sys
from datetime import datetime, timedelta

# Ensure we can import from the current directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import db_session
from models import Employee, GateLog


def seed_historical_logs(days=5):
    employees = db_session.query(Employee).all()
    if not employees:
        print("No employees found. Please import employees first.")
        return

    print(f"Generating realistic logs for {len(employees)} employees over {days} days...")

    gates = ["Main Gate", "North Gate", "South Gate", "West Gate"]
    scanned_by_users = ["System", "Security-A", "Security-B", "Gate-Scanner-01"]

    total_logs = 0

    # Define the date range
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for d in range(days):
        current_date = today - timedelta(days=d)
        print(f"  Processing {current_date.strftime('%Y-%m-%d')}...")

        # 80-90% of employees show up each day
        daily_employees = random.sample(employees, int(len(employees) * random.uniform(0.8, 0.95)))

        for emp in daily_employees:
            # 1. Morning IN
            in_time = current_date + timedelta(hours=6, minutes=random.randint(0, 150))

            # Check for expired medical/induction at that time
            access_granted = True
            denial_reason = None

            if emp.medical_expiry and emp.medical_expiry < in_time:
                # 30% chance they are blocked if expired (simulating some leniency or missed checks)
                if random.random() < 0.7:
                    access_granted = False
                    denial_reason = "Medical Expired"

            if access_granted and emp.induction_expiry and emp.induction_expiry < in_time:
                if random.random() < 0.7:
                    access_granted = False
                    denial_reason = "Induction Expired"

            in_log = GateLog(
                access_type="employee",
                entity_id=emp.id,
                entity_name=f"{emp.first_name} {emp.surname}",
                direction="IN",
                qr_data=emp.qr_code,
                access_granted=access_granted,
                denial_reason=denial_reason,
                gate_location=random.choice(gates),
                scanned_at=in_time,
                scanned_by=random.choice(scanned_by_users),
                employee_id=emp.id
            )
            db_session.add(in_log)
            total_logs += 1

            if not access_granted:
                continue # They didn't get in, so no more logs for the day

            # 2. Lunch break (30% of employees)
            if random.random() < 0.3:
                out_lunch = current_date + timedelta(hours=12, minutes=random.randint(0, 30))
                in_lunch = out_lunch + timedelta(minutes=random.randint(30, 60))

                # Lunch OUT
                db_session.add(GateLog(
                    access_type="employee",
                    entity_id=emp.id,
                    entity_name=f"{emp.first_name} {emp.surname}",
                    direction="OUT",
                    qr_data=emp.qr_code,
                    access_granted=True,
                    gate_location=random.choice(gates),
                    scanned_at=out_lunch,
                    scanned_by=random.choice(scanned_by_users),
                    employee_id=emp.id
                ))
                # Lunch IN
                db_session.add(GateLog(
                    access_type="employee",
                    entity_id=emp.id,
                    entity_name=f"{emp.first_name} {emp.surname}",
                    direction="IN",
                    qr_data=emp.qr_code,
                    access_granted=True,
                    gate_location=random.choice(gates),
                    scanned_at=in_lunch,
                    scanned_by=random.choice(scanned_by_users),
                    employee_id=emp.id
                ))
                total_logs += 2

            # 3. Afternoon OUT
            # Most stay until 16:00 - 18:30
            out_time = current_date + timedelta(hours=16, minutes=random.randint(0, 150))

            out_log = GateLog(
                access_type="employee",
                entity_id=emp.id,
                entity_name=f"{emp.first_name} {emp.surname}",
                direction="OUT",
                qr_data=emp.qr_code,
                access_granted=True,
                gate_location=random.choice(gates),
                scanned_at=out_time,
                scanned_by=random.choice(scanned_by_users),
                employee_id=emp.id
            )
            db_session.add(out_log)
            total_logs += 1

        db_session.commit()
        print(f"    Added logs for {len(daily_employees)} employees.")

    print(f"\nFinished! Total logs generated: {total_logs}")

if __name__ == "__main__":
    seed_historical_logs(5)
