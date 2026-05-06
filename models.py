from database import Base
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    password = Column(String(256), nullable=False)
    role = Column(String(20), default="user")  # admin, manager, security, user
    created_at = Column(DateTime, default=datetime.utcnow)

    def set_password(self, raw_password):
        self.password = generate_password_hash(raw_password)

    def check_password(self, raw_password):
        # Support legacy plain-text passwords during migration
        if not self.password.startswith(('pbkdf2:', 'scrypt:')):
            return self.password == raw_password
        return check_password_hash(self.password, raw_password)


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True)
    device_name = Column(String(100), nullable=False)
    device_type = Column(String(50))  # C66, C70, C71, etc.
    mac_address = Column(String(50))
    ip_address = Column(String(50))
    last_seen = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="online")
    total_scans = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True)
    emp_code = Column(String(50), unique=True, nullable=False, index=True)
    initials = Column(String(20))
    first_name = Column(String(100), nullable=False)
    second_name = Column(String(100))
    surname = Column(String(100), nullable=False)
    id_number = Column(String(50), unique=True, nullable=False)
    job_title = Column(String(100))
    induction = Column(String(200))
    induction_expiry = Column(DateTime, nullable=True)
    medical = Column(String(200))
    medical_expiry = Column(DateTime, nullable=True)
    qr_code = Column(String(200), unique=True, nullable=True)
    status = Column(String(20), default="Active")
    created_at = Column(DateTime, default=datetime.utcnow)

    visitors = relationship("Visitor", back_populates="host")
    gate_logs = relationship("GateLog", back_populates="employee")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True)
    fleet_id = Column(String(50), unique=True, nullable=False, index=True)
    registration_expiry = Column(DateTime, nullable=True)
    qr_code = Column(String(200), unique=True, nullable=True)
    status = Column(String(20), default="Active")
    created_at = Column(DateTime, default=datetime.utcnow)

    gate_logs = relationship("GateLog", back_populates="vehicle")


class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True)
    radio_id = Column(String(50), unique=True, nullable=False, index=True)
    registration_expiry = Column(DateTime, nullable=True)
    qr_code = Column(String(200), unique=True, nullable=True)
    status = Column(String(20), default="Active")
    created_at = Column(DateTime, default=datetime.utcnow)

    gate_logs = relationship("GateLog", back_populates="equipment")


class Visitor(Base):
    __tablename__ = "visitors"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    company = Column(String(100))
    purpose = Column(Text)
    meeting_person = Column(String(100))
    qr_code = Column(String(200), unique=True, nullable=True)
    host_id = Column(Integer, ForeignKey("employees.id"))
    check_in_time = Column(DateTime, default=datetime.utcnow)
    check_out_time = Column(DateTime)
    status = Column(String(20), default="Checked In")
    created_at = Column(DateTime, default=datetime.utcnow)

    host = relationship("Employee", back_populates="visitors")
    gate_logs = relationship("GateLog", back_populates="visitor")


class GateLog(Base):
    __tablename__ = "gate_logs"

    id = Column(Integer, primary_key=True)
    access_type = Column(String(20))  # employee, vehicle, visitor
    entity_id = Column(Integer)  # ID of the entity
    entity_name = Column(String(100))
    direction = Column(String(10))  # IN or OUT
    qr_data = Column(String(200))
    access_granted = Column(Boolean, default=True)
    denial_reason = Column(String(200))
    gate_location = Column(String(50))
    scanned_at = Column(DateTime, default=datetime.utcnow, index=True)
    scanned_by = Column(String(100))
    ip_address = Column(String(50))
    user_agent = Column(String(200))

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
    status = Column(String(20), default="Pending")
    approved_by = Column(String(100))
    approval_date = Column(DateTime)
    comments = Column(Text)
    target_table = Column(String(20), nullable=True)  # 'employees' or 'fleet'
    scanned_data = Column(Text, nullable=True)  # JSON string with scanned details
    created_at = Column(DateTime, default=datetime.utcnow)


class SiteSetting(Base):
    __tablename__ = "site_settings"

    id = Column(Integer, primary_key=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(String(500))


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    user = Column(String(100))
    action = Column(String(50))  # create, update, delete, login, approve, reject
    entity_type = Column(String(50))  # employee, vehicle, visitor, user, etc.
    entity_id = Column(Integer, nullable=True)
    details = Column(Text)
    ip_address = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
