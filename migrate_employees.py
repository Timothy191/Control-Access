#!/usr/bin/env python3
"""
Migration script to update employees table schema.
Old fields: employee_id, name, position, department, phone, email, hire_date
New fields: emp_code, initials, first_name, second_name, surname, id_number, job_title, induction, medical
"""

import os
import sys
from datetime import datetime

# Get the directory where this file is located
base_dir = os.path.dirname(os.path.abspath(__file__))
database_path = os.path.join(base_dir, "mine_management.db")

import sqlite3

def migrate():
    conn = sqlite3.connect(database_path)
    cursor = conn.cursor()

    # Check if employees table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='employees'")
    if not cursor.fetchone():
        print("Employees table does not exist. No migration needed.")
        conn.close()
        return

    # Get current columns
    cursor.execute("PRAGMA table_info(employees)")
    columns = [row[1] for row in cursor.fetchall()]
    print(f"Current columns: {columns}")

    # Check if already migrated
    if 'emp_code' in columns and 'first_name' in columns:
        print("Table already has new schema. No migration needed.")
        conn.close()
        return

    # Backup existing data
    cursor.execute("""
        SELECT id, employee_id, name, position, department, phone, email, qr_code, hire_date, status, medical_expiry, induction_expiry, created_at
        FROM employees
    """)
    old_data = cursor.fetchall()
    print(f"Found {len(old_data)} existing employee records to migrate")

    # Create new table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS employees_new (
            id INTEGER PRIMARY KEY,
            emp_code VARCHAR(50) UNIQUE NOT NULL,
            initials VARCHAR(20),
            first_name VARCHAR(100) NOT NULL,
            second_name VARCHAR(100),
            surname VARCHAR(100) NOT NULL,
            id_number VARCHAR(50) UNIQUE NOT NULL,
            job_title VARCHAR(100),
            induction VARCHAR(200),
            induction_expiry DATETIME,
            medical VARCHAR(200),
            medical_expiry DATETIME,
            qr_code VARCHAR(200) UNIQUE,
            status VARCHAR(20) DEFAULT 'Active',
            created_at DATETIME
        )
    """)

    # Migrate data
    migrated = 0
    for row in old_data:
        (id, employee_id, name, position, department, phone, email, qr_code, hire_date, status, medical_expiry, induction_expiry, created_at) = row

        # Parse name into parts
        name_parts = name.split() if name else []
        first_name = name_parts[0] if name_parts else f"Employee_{employee_id}"
        second_name = None
        surname = name_parts[-1] if len(name_parts) > 1 else first_name  # Use first_name as surname if only one name

        if len(name_parts) >= 3:
            second_name = name_parts[1]
            surname = name_parts[-1]
        elif len(name_parts) == 2:
            surname = name_parts[1]

        # Use employee_id as emp_code and id_number
        emp_code = employee_id or f"EMP_{id}"
        id_number = employee_id or f"ID_{id}"

        # Use position as job_title
        job_title = position

        try:
            cursor.execute("""
                INSERT INTO employees_new (
                    id, emp_code, initials, first_name, second_name, surname, id_number,
                    job_title, induction, induction_expiry, medical, medical_expiry,
                    qr_code, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                id,
                emp_code,
                None,  # initials
                first_name,
                second_name,
                surname,
                id_number,
                job_title,
                None,  # induction
                induction_expiry,
                None,  # medical
                medical_expiry,
                qr_code,
                status,
                created_at
            ))
            migrated += 1
        except Exception as e:
            print(f"Error migrating employee {id}: {e}")

    # Drop old table and rename new one
    cursor.execute("DROP TABLE employees")
    cursor.execute("ALTER TABLE employees_new RENAME TO employees")

    conn.commit()
    conn.close()

    print(f"Migration complete! Migrated {migrated} employees.")
    print("New schema: emp_code, initials, first_name, second_name, surname, id_number, job_title, induction, induction_expiry, medical, medical_expiry")


if __name__ == "__main__":
    migrate()
