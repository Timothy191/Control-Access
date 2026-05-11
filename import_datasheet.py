#!/usr/bin/env python3
import os
import sys
import pandas as pd
import hashlib
from datetime import datetime
import sqlite3

# Add project root to path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_ROOT)

from database import db_session, init_db
from models import Employee, Vehicle, Equipment

def import_employees(file_path):
    print(f"Reading employees from {file_path}...")
    try:
        df = pd.read_excel(file_path, sheet_name='Export')
    except Exception as e:
        print(f"Error reading Excel: {e}")
        return

    # Column mapping
    mapping = {
        'EmpCode': 'emp_code',
        'Initials': 'initials',
        'FirstName': 'first_name',
        'Secondname': 'second_name',
        'Surname': 'surname',
        'ID Number': 'id_number',
        'JobTitle': 'job_title',
        'Induction': 'induction',
        'Expiry': 'induction_expiry',
        'Medical': 'medical',
        'Expiry.1': 'medical_expiry'
    }

    # Rename columns that exist
    df = df.rename(columns={k: v for k, v in mapping.items() if k in df.columns})

    print(f"Found {len(df)} records. Processing...")

    imported = 0
    skipped = 0

    # Get existing codes and id_numbers to avoid duplicates
    existing_codes = {e.emp_code for e in db_session.query(Employee.emp_code).all()}
    existing_id_numbers = {e.id_number for e in db_session.query(Employee.id_number).all()}

    for idx, row in df.iterrows():
        emp_code = str(row.get('emp_code', '')).strip()
        id_number = str(row.get('id_number', '')).strip()
        
        if not emp_code or emp_code == 'nan':
            continue

        if emp_code in existing_codes:
            skipped += 1
            continue
            
        if id_number in existing_id_numbers:
            print(f"  Skipping row {idx+2}: Duplicate ID Number {id_number}")
            skipped += 1
            continue

        existing_codes.add(emp_code)
        existing_id_numbers.add(id_number)

        # Clean strings
        def clean(val):
            if pd.isna(val) or str(val).lower() == 'nan':
                return None
            return str(val).strip()

        # Parse dates
        def parse_date(val):
            if pd.isna(val) or str(val).lower() == 'nan':
                return None
            try:
                if isinstance(val, datetime):
                    return val
                return pd.to_datetime(val).to_pydatetime()
            except:
                return None

        emp = Employee(
            emp_code=emp_code,
            initials=clean(row.get('initials')),
            first_name=clean(row.get('first_name')) or "Unknown",
            second_name=clean(row.get('second_name')),
            surname=clean(row.get('surname')) or "Unknown",
            id_number=clean(row.get('id_number')) or emp_code,
            job_title=clean(row.get('job_title')),
            induction=clean(row.get('induction')),
            induction_expiry=parse_date(row.get('induction_expiry')),
            medical=clean(row.get('medical')),
            medical_expiry=parse_date(row.get('medical_expiry')),
            status='Active'
        )

        db_session.add(emp)
        db_session.flush() # Get ID

        # Generate QR code (following app.py pattern)
        qr_data = f"EMP:{emp.id}:{emp.emp_code}:{datetime.now().timestamp()}"
        emp.qr_code = hashlib.sha256(qr_data.encode()).hexdigest()[:32]

        imported += 1
        if imported % 50 == 0:
            print(f"  Imported {imported} employees...")

    db_session.commit()
    print(f"✓ Successfully imported {imported} employees (Skipped {skipped} duplicates).")

def import_fleet(file_path):
    print(f"Reading fleet from {file_path}...")
    try:
        df = pd.read_excel(file_path)
    except Exception as e:
        print(f"Error reading Excel: {e}")
        return

    # Column mapping
    mapping = {
        'Fleet ID': 'fleet_id',
        'fleet_id': 'fleet_id'
    }
    df = df.rename(columns={k: v for k, v in mapping.items() if k in df.columns})

    print(f"Found {len(df)} records. Processing...")

    imported = 0
    skipped = 0
    existing_ids = {v.fleet_id for v in db_session.query(Vehicle.fleet_id).all()}

    for idx, row in df.iterrows():
        fleet_id = str(row.get('fleet_id', '')).strip()
        if not fleet_id or fleet_id == 'nan':
            continue

        if fleet_id in existing_ids:
            skipped += 1
            continue

        veh = Vehicle(
            fleet_id=fleet_id,
            status='Active'
        )

        db_session.add(veh)
        db_session.flush()

        # Generate QR code
        qr_data = f"VEH:{veh.id}:{veh.fleet_id}:{datetime.now().timestamp()}"
        veh.qr_code = hashlib.sha256(qr_data.encode()).hexdigest()[:32].upper()

        existing_ids.add(fleet_id)
        imported += 1

    db_session.commit()
    print(f"✓ Successfully imported {imported} vehicles (Skipped {skipped} duplicates).")

def main():
    emp_file = "/home/tim/Desktop/01.mine-management-system/data (23).xlsx"
    fleet_file = "/home/tim/Downloads/fleet_export.xlsx"

    init_db()
    
    if os.path.exists(emp_file):
        import_employees(emp_file)
    else:
        print(f"Employee file not found: {emp_file}")

    if os.path.exists(fleet_file):
        import_fleet(fleet_file)
    else:
        print(f"Fleet file not found: {fleet_file}")

if __name__ == "__main__":
    main()
