# Database setup and session management
# SECURITY: All raw SQL in this file uses hardcoded string literals with no user input
# interpolation. SQL injection is not possible here. User data flows through SQLAlchemy
# ORM queries which use parameterized statements automatically.

import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, scoped_session, sessionmaker

# --- Database URL resolution ---
# Priority:
#   1. DATABASE_URL environment variable (supports Azure SQL / SQL Server)
#   2. SQLITE_DATABASE_URL environment variable (for local development fallback)
#   3. Default SQLite path (local development)

# Base directory & default SQLite database path (always defined for exports)
base_dir = os.path.dirname(os.path.abspath(__file__))
database_path = os.path.join(base_dir, "mine_management.db")

DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL:
    # Azure SQL / SQL Server connection string
    # Example: mssql+pyodbc://user:pass@server.database.windows.net/dbname?driver=ODBC+Driver+17+for+SQL+Server
    _is_sqlserver = DATABASE_URL.startswith(("mssql+", "sqlserver+"))
else:
    # Fall back to SQLite for local development
    DATABASE_URL = os.environ.get("SQLITE_DATABASE_URL", f"sqlite:///{database_path}")
    _is_sqlserver = False

IS_SQLSERVER = _is_sqlserver

# Create engine with appropriate configuration per database type
if _is_sqlserver:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
        echo=False,
    )
else:
    # SQLite configuration
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 15},
        pool_pre_ping=True,
    )


# SQLite-specific pragmas (only applied when using SQLite)
@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_conn, connection_record):
    """Apply SQLite performance pragmas only when using SQLite."""
    if _is_sqlserver:
        return
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA cache_size=-64000")      # 64 MB page cache
    cursor.execute("PRAGMA mmap_size=268435456")     # 256 MB memory-mapped I/O
    cursor.execute("PRAGMA temp_store=MEMORY")
    cursor.close()

# Create session
db_session = scoped_session(
    sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)
)

# Base class for models
Base = declarative_base()
Base.query = db_session.query_property()


def init_db():
    """Initialize the database by creating all tables"""
    import models  # noqa: F401 - ensure models are registered in Base.metadata

    Base.metadata.create_all(bind=engine)

    # Auto-migrate: add missing columns to existing tables
    from sqlalchemy import inspect as sa_inspect
    from sqlalchemy import text

    inspector = sa_inspect(engine)

    def _add_column(table, column_name, column_def):
        if table in inspector.get_table_names():
            cols = [c["name"] for c in inspector.get_columns(table)]
            if column_name not in cols:
                # SQL Server uses ALTER TABLE t ADD col def (no COLUMN keyword and BIT for BOOLEAN)
                target_def = column_def
                if _is_sqlserver and "BOOLEAN" in column_def.upper():
                    target_def = column_def.upper().replace("BOOLEAN", "BIT")
                with engine.connect() as conn:
                    conn.execute(text(f"ALTER TABLE {table} ADD {column_name} {target_def}"))
                    conn.commit()
                print(f"Migrated: added {column_name} column to {table} table")

    _add_column("visitors", "meeting_person", "VARCHAR(100)")
    _add_column("users", "totp_secret", "VARCHAR(256)")
    _add_column("users", "mfa_enabled", "BOOLEAN DEFAULT 0")
    _add_column("users", "mfa_backup_codes", "TEXT")
    _add_column("employees", "id_number_hash", "VARCHAR(64)")

    # Create notifications table if missing (Base.metadata.create_all should handle it,
    # but ensure idempotency for older DBs without it)
    if "notifications" not in inspector.get_table_names():
        Base.metadata.create_all(bind=engine, tables=[Base.metadata.tables["notifications"]])

    # Re-encrypt plaintext PII values that were stored before field-level encryption.
    # This runs only when an encryption key is available and there are unencrypted rows.
    try:
        from models import Employee, Visitor

        _reencrypt_plaintext_pii()
    except Exception as e:
        print(f"PII re-encryption check skipped: {e}")

    # Create default admin user on first run
    from models import User

    admin = db_session.query(User).filter_by(username="admin").first()
    _admin_password = os.environ.get("ADMIN_PASSWORD", "admin")
    _force_reset = os.environ.get("RESET_ADMIN_PASSWORD", "false").lower() == "true"
    if not admin:
        admin = User(username="admin", role="admin")
        admin.set_password(_admin_password)
        db_session.add(admin)
        db_session.commit()
        print("Default admin user created")
    elif _force_reset:
        admin.set_password(_admin_password)
        db_session.commit()
        print("Admin password reset via RESET_ADMIN_PASSWORD=true")

    # Seed or update visitor request PIN from VISITOR_PIN environment variable
    from models import SiteSetting

    pin = db_session.query(SiteSetting).filter_by(key="visitor_request_pin").first()
    env_pin = os.environ.get("VISITOR_PIN")
    if not pin:
        active_pin = env_pin if env_pin else "1234"
        pin = SiteSetting(key="visitor_request_pin", value=active_pin)
        db_session.add(pin)
        db_session.commit()
        print(f"Visitor request PIN initialized: {active_pin}")
    elif env_pin and pin.value != env_pin:
        pin.value = env_pin
        db_session.commit()
        print(f"Visitor request PIN synced from VISITOR_PIN environment variable.")

    if pin and pin.value == "1234":
        print("SECURITY WARNING: Visitor request PIN is set to insecure default '1234'. Set VISITOR_PIN in .env or update in Admin > Visitors.")

    # Migrate users with legacy plain-text passwords
    all_users = db_session.query(User).all()
    legacy_users = [u for u in all_users if not u.password.startswith(("pbkdf2:", "scrypt:"))]
    if legacy_users:
        print(f"Migrating {len(legacy_users)} user(s) with legacy plain-text passwords to hashed passwords...")
        for u in legacy_users:
            u.set_password(u.password)
        db_session.commit()
        print("Legacy password migration completed successfully.")


# SQLite-specific optimization hook (only runs for SQLite)
if not _is_sqlserver:
    @event.listens_for(engine, "close")
    def _run_sqlite_optimize(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA optimize")
        cursor.close()


def _reencrypt_plaintext_pii():
    """One-time migration: encrypt legacy plaintext PII fields in-place.

    Only re-encrypts rows whose values do not start with the encrypted marker.
    This is safe to run repeatedly because encrypted values are skipped.
    """
    from models import EncryptedString, Employee, Visitor

    from database import db_session

    key = os.environ.get("FIELD_ENCRYPTION_KEY")
    if not key and os.environ.get("SECRET_KEY"):
        # Derive key same way as EncryptedString for development
        import base64
        import hashlib

        derived = hashlib.sha256(os.environ.get("SECRET_KEY").encode()).digest()
        key = base64.urlsafe_b64encode(derived).decode("ascii")
    if not key:
        return

    reencrypted_count = {"employees": 0, "visitors": 0}

    employees = db_session.query(Employee).all()
    for emp in employees:
        changed = False
        if emp.id_number and not str(emp.id_number).startswith(EncryptedString.MARKER):
            # Set via the model so both id_number and id_number_hash are updated
            emp.set_id_number(emp.id_number)
            changed = True
        if emp.medical and not str(emp.medical).startswith(EncryptedString.MARKER):
            emp.medical = emp.medical
            changed = True
        if changed:
            reencrypted_count["employees"] += 1

    visitors = db_session.query(Visitor).all()
    for visitor in visitors:
        if visitor.name and not str(visitor.name).startswith(EncryptedString.MARKER):
            visitor.name = visitor.name
            reencrypted_count["visitors"] += 1

    if any(reencrypted_count.values()):
        db_session.commit()
        print(
            f"Re-encrypted plaintext PII: {reencrypted_count['employees']} employees, "
            f"{reencrypted_count['visitors']} visitors"
        )


def shutdown_session(exception=None):
    db_session.remove()
