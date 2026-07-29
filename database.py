from sqlalchemy import create_engine, event
from sqlalchemy.orm import scoped_session, sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import os

# Get the directory where this file is located
base_dir = os.path.dirname(os.path.abspath(__file__))
database_path = os.path.join(base_dir, "mine_management.db")
DATABASE_URL = f"sqlite:///{database_path}"

# Create engine - removed convert_unicode parameter, added connect_args for SQLite
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 15},
    pool_pre_ping=True,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_conn, connection_record):
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
    import models

    Base.metadata.create_all(bind=engine)

    # Auto-migrate: add meeting_person column to visitors table if missing
    from sqlalchemy import text, inspect as sa_inspect
    inspector = sa_inspect(engine)
    if "visitors" in inspector.get_table_names():
        cols = [c["name"] for c in inspector.get_columns("visitors")]
        if "meeting_person" not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE visitors ADD COLUMN meeting_person VARCHAR(100)"))
                conn.commit()
                print("Migrated: added meeting_person column to visitors table")

    # Create default admin user or ensure its password matches ADMIN_PASSWORD/admin
    from models import User

    admin = db_session.query(User).filter_by(username="admin").first()
    _admin_password = os.environ.get("ADMIN_PASSWORD", "admin")
    if not admin:
        admin = User(username="admin", role="admin")
        admin.set_password(_admin_password)
        db_session.add(admin)
        db_session.commit()
        print("Default admin user created")
    else:
        # Sync password with environment variable
        admin.set_password(_admin_password)
        db_session.commit()
        print("Admin password updated/verified")

    # Seed default visitor request PIN if it doesn't exist
    from models import SiteSetting

    pin = db_session.query(SiteSetting).filter_by(key="visitor_request_pin").first()
    if not pin:
        _default_pin = os.environ.get("VISITOR_PIN", "1234")
        pin = SiteSetting(key="visitor_request_pin", value=_default_pin)
        db_session.add(pin)
        db_session.commit()
        print("Default visitor request PIN configured")
        if _default_pin == "1234":
            print("WARNING: Visitor PIN is set to default '1234'. Change it in Admin > Visitors.")


@event.listens_for(engine, "close")
def _run_sqlite_optimize(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA optimize")
    cursor.close()


def shutdown_session(exception=None):
    db_session.remove()
