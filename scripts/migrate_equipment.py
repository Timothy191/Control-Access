import os
import sqlite3

DB_PATH = "mine_management.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print("Database not found, skip migration.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check if equipment table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='equipment'")
    if not cursor.fetchone():
        print("Creating equipment table...")
        cursor.execute('''
            CREATE TABLE equipment (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                radio_id VARCHAR(50) UNIQUE NOT NULL,
                registration_expiry DATETIME,
                qr_code VARCHAR(200) UNIQUE,
                status VARCHAR(20) DEFAULT 'Active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')

    # Check if equipment_id column exists in gate_logs
    cursor.execute("PRAGMA table_info(gate_logs)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'equipment_id' not in columns:
        print("Adding equipment_id column to gate_logs...")
        cursor.execute("ALTER TABLE gate_logs ADD COLUMN equipment_id INTEGER REFERENCES equipment(id)")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
