import os
from datetime import UTC, datetime

from cryptography.fernet import Fernet
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    TypeDecorator,
)
from sqlalchemy.orm import relationship
from werkzeug.security import check_password_hash, generate_password_hash

from database import Base


def _get_encryption_key():
    """Return a 32-byte URL-safe base64-encoded key for field-level encryption."""
    key = os.environ.get("FIELD_ENCRYPTION_KEY")
    if key:
        return key
    # In development, derive a deterministic key from SECRET_KEY so data remains
    # readable across restarts. In production the env var must be set explicitly.
    secret = os.environ.get("SECRET_KEY")
    if secret:
        import base64
        import hashlib

        derived = hashlib.sha256(secret.encode()).digest()
        return base64.urlsafe_b64encode(derived).decode("ascii")
    return None


class EncryptedString(TypeDecorator):
    """SQLAlchemy column type that stores strings encrypted at rest.

    Reads transparently decrypt values. If a legacy plaintext value is found
    (not prefixed with the ciphertext marker), it is returned as-is so existing
    databases keep working until a migration re-encrypts them.
    """

    impl = Text
    cache_ok = True
    MARKER = "enc:"

    def _fernet(self):
        key = _get_encryption_key()
        if not key:
            return None
        return Fernet(key)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        fernet = self._fernet()
        if fernet is None:
            return value
        plaintext = str(value)
        # Avoid double-encryption
        if plaintext.startswith(self.MARKER):
            return plaintext
        return self.MARKER + fernet.encrypt(plaintext.encode()).decode("ascii")

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if not isinstance(value, str):
            value = str(value)
        if not value.startswith(self.MARKER):
            return value
        fernet = self._fernet()
        if fernet is None:
            # Ciphertext present but no key: cannot decrypt. Return marker value.
            return value
        try:
            ciphertext = value[len(self.MARKER) :]
            return fernet.decrypt(ciphertext.encode()).decode("utf-8")
        except Exception:
            return value


def _utcnow_naive():
    """Return naive UTC datetime (for SQLite compatibility)."""
    return datetime.now(UTC).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    password = Column(String(256), nullable=False)
    role = Column(String(20), default="user")  # admin, manager, security, user
    totp_secret = Column(String(256), nullable=True)
    mfa_enabled = Column(Boolean, default=False)
    # Store hashed backup codes; space-separated for easy lookup
    mfa_backup_codes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow_naive)

    def set_password(self, raw_password):
        self.password = generate_password_hash(raw_password)

    def check_password(self, raw_password):
        return check_password_hash(self.password, raw_password)


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True)
    device_name = Column(String(100), nullable=False)
    device_type = Column(String(50))  # C66, C70, C71, etc.
    mac_address = Column(String(50))
    ip_address = Column(String(50))
    last_seen = Column(DateTime, default=_utcnow_naive)
    status = Column(String(20), default="online")
    total_scans = Column(Integer, default=0)
    created_at = Column(DateTime, default=_utcnow_naive)


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True)
    emp_code = Column(String(50), unique=True, nullable=False, index=True)
    initials = Column(String(20))
    first_name = Column(String(100), nullable=False)
    second_name = Column(String(100))
    surname = Column(String(100), nullable=False)
    id_number = Column(EncryptedString, unique=True, nullable=True)
    # Deterministic hash of id_number for exact-match lookups (encryption is non-deterministic)
    id_number_hash = Column(String(64), unique=True, nullable=True, index=True)
    job_title = Column(String(100))
    induction = Column(String(200))
    induction_expiry = Column(DateTime, nullable=True)
    medical = Column(EncryptedString)
    medical_expiry = Column(DateTime, nullable=True)
    qr_code = Column(String(200), unique=True, nullable=True)
    rfid_tag = Column(String(100), unique=True, nullable=True, index=True)
    status = Column(String(20), default="Active")
    created_at = Column(DateTime, default=_utcnow_naive)

    visitors = relationship("Visitor", back_populates="host")
    gate_logs = relationship("GateLog", back_populates="employee")

    @staticmethod
    def hash_id_number(value):
        if not value:
            return None
        import hashlib

        return hashlib.sha256(str(value).strip().encode("utf-8")).hexdigest()

    def set_id_number(self, value):
        self.id_number = value
        self.id_number_hash = self.hash_id_number(value)


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True)
    fleet_id = Column(String(50), unique=True, nullable=False, index=True)
    registration_expiry = Column(DateTime, nullable=True)
    qr_code = Column(String(200), unique=True, nullable=True)
    rfid_tag = Column(String(100), unique=True, nullable=True, index=True)
    status = Column(String(20), default="Active")
    created_at = Column(DateTime, default=_utcnow_naive)

    gate_logs = relationship("GateLog", back_populates="vehicle")


class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True)
    radio_id = Column(String(50), unique=True, nullable=False, index=True)
    registration_expiry = Column(DateTime, nullable=True)
    qr_code = Column(String(200), unique=True, nullable=True)
    rfid_tag = Column(String(100), unique=True, nullable=True, index=True)
    status = Column(String(20), default="Active")
    created_at = Column(DateTime, default=_utcnow_naive)

    gate_logs = relationship("GateLog", back_populates="equipment")


class Visitor(Base):
    __tablename__ = "visitors"

    id = Column(Integer, primary_key=True)
    name = Column(EncryptedString, nullable=False)
    company = Column(String(100))
    purpose = Column(Text)
    meeting_person = Column(String(100))
    qr_code = Column(String(200), unique=True, nullable=True)
    rfid_tag = Column(String(100), unique=True, nullable=True, index=True)
    host_id = Column(Integer, ForeignKey("employees.id"))
    check_in_time = Column(DateTime, default=_utcnow_naive)
    check_out_time = Column(DateTime)
    status = Column(String(20), default="Checked In")
    created_at = Column(DateTime, default=_utcnow_naive)

    host = relationship("Employee", back_populates="visitors")
    gate_logs = relationship("GateLog", back_populates="visitor")


class GateLog(Base):
    __tablename__ = "gate_logs"

    id = Column(Integer, primary_key=True)
    access_type = Column(String(20), index=True)  # employee, vehicle, visitor
    entity_id = Column(Integer, index=True)  # ID of the entity
    entity_name = Column(String(100))
    direction = Column(String(10), index=True)  # IN or OUT
    qr_data = Column(String(200))
    access_granted = Column(Boolean, default=True, index=True)
    denial_reason = Column(String(200))
    gate_location = Column(String(50))
    scanned_at = Column(DateTime, default=_utcnow_naive, index=True)
    scanned_by = Column(String(100))
    ip_address = Column(String(50))
    user_agent = Column(String(200))
    parsed_qr_data = Column(Text, nullable=True)  # JSON string with extracted QR fields

    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    visitor_id = Column(Integer, ForeignKey("visitors.id"), nullable=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=True)

    # Use back_populates and overlaps to avoid warnings
    employee = relationship(
        "Employee",
        foreign_keys=[employee_id],
        back_populates="gate_logs",
        overlaps="gate_logs",
    )
    vehicle = relationship(
        "Vehicle",
        foreign_keys=[vehicle_id],
        back_populates="gate_logs",
        overlaps="gate_logs",
    )
    visitor = relationship(
        "Visitor",
        foreign_keys=[visitor_id],
        back_populates="gate_logs",
        overlaps="gate_logs",
    )
    equipment = relationship(
        "Equipment",
        foreign_keys=[equipment_id],
        back_populates="gate_logs",
        overlaps="gate_logs",
    )


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True)
    request_type = Column(String(50))
    request_id = Column(Integer)
    requester_name = Column(String(100))
    details = Column(Text)
    status = Column(String(20), default="Pending", index=True)
    approved_by = Column(String(100))
    approval_date = Column(DateTime)
    comments = Column(Text)
    target_table = Column(String(20), nullable=True)  # 'employees' or 'fleet'
    scanned_data = Column(Text, nullable=True)  # JSON string with scanned details
    created_at = Column(DateTime, default=_utcnow_naive)


class SiteSetting(Base):
    __tablename__ = "site_settings"

    id = Column(Integer, primary_key=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(String(500))


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    type = Column(String(50), nullable=False)  # expiry, approval, device, security
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False)
    link = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=_utcnow_naive)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    user = Column(String(100))
    action = Column(String(50))  # create, update, delete, login, approve, reject
    entity_type = Column(String(50))  # employee, vehicle, visitor, user, etc.
    entity_id = Column(Integer, nullable=True)
    details = Column(Text)
    ip_address = Column(String(50))
    created_at = Column(DateTime, default=_utcnow_naive)


class GateMapping(Base):
    """Maps scanner device IPs to physical gate locations."""
    __tablename__ = "gate_mappings"

    id = Column(Integer, primary_key=True)
    ip_address = Column(String(50), unique=True, nullable=False, index=True)
    scanner_id = Column(String(100), nullable=True)  # e.g., "infowedge:192.168.0.160:9100"
    gate_name = Column(String(100), nullable=False)  # e.g., "Extension Gate 1"
    location_description = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utcnow_naive)
    updated_at = Column(DateTime, default=_utcnow_naive, onupdate=_utcnow_naive)
