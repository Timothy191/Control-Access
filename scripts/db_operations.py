#!/usr/bin/env python3
"""
Database Operations Orchestrator
Automated tasks for the Arch-System database
"""

import sqlite3
import os
import shutil
from datetime import datetime

DB_PATH = "/home/tim/Desktop/01.mine-management-system/mine_management.db"
BACKUP_DIR = "/home/tim/Desktop/01.mine-management-system/backups"


def backup_database():
    """Create a timestamped backup of the database"""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(BACKUP_DIR, f"mine_management_{timestamp}.db")
    shutil.copy2(DB_PATH, backup_path)
    print(f"Backup created: {backup_path}")
    return backup_path


def check_integrity():
    """Run SQLite integrity check"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA integrity_check")
    result = cursor.fetchone()
    conn.close()
    print(f"Integrity check: {result[0]}")
    return result[0] == "ok"


def get_table_stats():
    """Get row counts for all tables"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    tables = ["users", "employees", "vehicles", "visitors", "gate_logs", "approvals"]
    stats = {}

    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        stats[table] = cursor.fetchone()[0]

    conn.close()

    print("\nTable Statistics:")
    print("-" * 30)
    for table, count in stats.items():
        print(f"  {table}: {count}")

    return stats


def vacuum_database():
    """Optimize the database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("VACUUM")
    conn.close()
    print("Database vacuumed/optimized")


def export_schema():
    """Export database schema"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name")
    schema = cursor.fetchall()
    conn.close()

    schema_path = os.path.join(BACKUP_DIR, "schema.sql")
    with open(schema_path, "w") as f:
        for line in schema:
            if line[0]:
                f.write(line[0] + ";\n\n")
    print(f"Schema exported to: {schema_path}")
    return schema_path


def quick_health_check():
    """Run a quick health check"""
    print("=" * 40)
    print("   Database Health Check")
    print("=" * 40)

    # Check file exists
    exists = os.path.exists(DB_PATH)
    print(f"Database exists: {exists}")
    if not exists:
        print("ERROR: Database file not found!")
        return False

    # Check integrity
    integrity_ok = check_integrity()

    # Get stats
    stats = get_table_stats()

    # Check for empty critical tables
    if stats.get("users", 0) == 0:
        print("WARNING: No users in database!")

    print("=" * 40)
    print(f"Status: {'HEALTHY' if integrity_ok else 'ISSUES FOUND'}")
    print("=" * 40)

    return integrity_ok


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python db_operations.py <command>")
        print("Commands: backup, integrity, stats, vacuum, schema, health")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "backup":
        backup_database()
    elif cmd == "integrity":
        check_integrity()
    elif cmd == "stats":
        get_table_stats()
    elif cmd == "vacuum":
        vacuum_database()
    elif cmd == "schema":
        export_schema()
    elif cmd == "health":
        quick_health_check()
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
