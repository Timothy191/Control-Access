#!/usr/bin/env python3
import os
import sys
import openpyxl
from datetime import datetime
import hashlib

# Ensure we can import from the current directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import db_session, engine
from models import Employee, Base

def import_employees(file_path):
    print(f"Loading workbook: {file_path}")
    # Load with data_only=True to get values instead of formulas
    try:
        wb = openpyxl.load_workbook(file_path, data_only=True)
    except Exception as e:
        print(f"Error loading workbook: {e}")
        return

    sheet = wb.active
    rows = list(sheet.iter_rows(min_row=2, values_only=True))
    
    print(f"Found {len(rows)} rows to process.")
    
    count_new = 0
    count_updated = 0
    
    for i, row in enumerate(rows):
        # Mapping based on inspection:
        # 0: EmpCode, 1: Initials, 2: FirstName, 3: Secondname, 4: Surname, 
        # 5: ID Number, 6: JobTitle, 7: Induction, 8: Expiry, 9: Medical, 10: Expiry
        
        emp_code = str(row[0]).strip() if row[0] is not None else None
        if not emp_code:
            print(f"Skipping row {i+2}: No EmpCode")
            continue
            
        initials = str(row[1]).strip() if row[1] is not None else None
        first_name = str(row[2]).strip() if row[2] is not None else "Unknown"
        second_name = str(row[3]).strip() if row[3] is not None else None
        surname = str(row[4]).strip() if row[4] is not None else "Unknown"
        id_number = str(row[5]).strip() if row[5] is not None else f"TEMP-{emp_code}"
        job_title = str(row[6]).strip() if row[6] is not None else None
        induction = str(row[7]).strip() if row[7] is not None else None
        induction_expiry = row[8]
        medical = str(row[9]).strip() if row[9] is not None else None
        medical_expiry = row[10]
        
        # Check if dates are already datetime objects, if not try to parse
        def parse_date(d):
            if isinstance(d, datetime):
                return d
            if d is None:
                return None
            try:
                # Common formats
                for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S"):
                    try:
                        return datetime.strptime(str(d).split(' ')[0], fmt)
                    except:
                        continue
                return None
            except:
                return None

        induction_expiry = parse_date(induction_expiry)
        medical_expiry = parse_date(medical_expiry)
        
        # Check if employee exists by emp_code OR id_number
        employee = db_session.query(Employee).filter(
            (Employee.emp_code == emp_code) | (Employee.id_number == id_number)
        ).first()
        
        if not employee:
            employee = Employee(emp_code=emp_code)
            db_session.add(employee)
            count_new += 1
            action = "Adding"
        else:
            count_updated += 1
            action = "Updating"
            
        employee.initials = initials
        employee.first_name = first_name
        employee.second_name = second_name
        employee.surname = surname
        employee.id_number = id_number
        employee.job_title = job_title
        employee.induction = induction
        employee.induction_expiry = induction_expiry
        employee.medical = medical
        employee.medical_expiry = medical_expiry
        employee.status = "Active"
        
        # We need to flush to get the ID for QR code generation if it's a new employee
        db_session.flush()
        
        # Generate QR code if missing
        if not employee.qr_code:
            qr_data = f"EMP:{employee.id}:{employee.emp_code}:{datetime.now().timestamp()}"
            qr_hash = hashlib.sha256(qr_data.encode()).hexdigest()[:32].upper()
            employee.qr_code = qr_hash
            
        if (i + 1) % 50 == 0:
            db_session.commit()
            print(f"Processed {i+1} rows...")

    db_session.commit()
    print(f"\nImport finished!")
    print(f"New employees: {count_new}")
    print(f"Updated employees: {count_updated}")
    print(f"Total processed: {len(rows)}")

if __name__ == "__main__":
    EXCEL_FILE = "data (23).xlsx"
    if not os.path.exists(EXCEL_FILE):
        print(f"File not found: {EXCEL_FILE}")
        sys.exit(1)
        
    import_employees(EXCEL_FILE)
