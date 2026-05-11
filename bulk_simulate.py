#!/usr/bin/env python3
import sys
import random
import time
from datetime import datetime, timedelta

# Add project root to path
import os
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_ROOT)

from database import db_session, init_db
from models import Employee, GateLog

def bulk_simulate(count=200, live=False):
    init_db()
    employees = db_session.query(Employee).filter_by(status="Active").all()
    
    if not employees:
        print("No active employees found in database.")
        return

    selected = random.sample(employees, min(count, len(employees)))
    print(f"Simulating scans for {len(selected)} employees (Live: {live})...")

    now = datetime.now()
    
    for i, emp in enumerate(selected):
        # IN scan
        name = f"{emp.first_name} {emp.surname}"
        in_log = GateLog(
            access_type="employee",
            entity_id=emp.id,
            entity_name=name,
            direction="IN",
            scanned_at=datetime.now(),
            gate_location=random.choice(["Main Gate", "North Gate", "South Gate"]),
            access_granted=True,
            scanned_by="live_simulation",
            employee_id=emp.id
        )
        db_session.add(in_log)
        db_session.commit()
        print(f"[{i+1}/{len(selected)}] {name} - IN")
        
        if live:
            time.sleep(random.uniform(0.1, 0.5))

        # 80% chance they scan OUT shortly after in live mode or batch mode
        if random.random() > 0.2:
            out_log = GateLog(
                access_type="employee",
                entity_id=emp.id,
                entity_name=name,
                direction="OUT",
                scanned_at=datetime.now() + timedelta(seconds=random.randint(5, 30)),
                gate_location=random.choice(["Main Gate", "North Gate", "South Gate"]),
                access_granted=True,
                scanned_by="live_simulation",
                employee_id=emp.id
            )
            db_session.add(out_log)
            db_session.commit()
            print(f"[{i+1}/{len(selected)}] {name} - OUT")
            
            if live:
                time.sleep(random.uniform(0.1, 0.5))

    print(f"✓ Successfully simulated scans for {len(selected)} employees.")

if __name__ == "__main__":
    count = 200
    live = "--live" in sys.argv
    for arg in sys.argv[1:]:
        if arg.isdigit():
            count = int(arg)
            break
    bulk_simulate(count, live)
