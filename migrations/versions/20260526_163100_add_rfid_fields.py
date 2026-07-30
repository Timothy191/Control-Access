"""Add rfid_tag fields to employees, vehicles, equipment, and visitors

Revision ID: 20260526_163100
Revises: 20260507_074733
Create Date: 2026-05-26 16:31:00

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = '20260526_163100'
down_revision = '20260507_074733'
branch_labels = None
depends_on = None


def upgrade():
    # Add rfid_tag column to employees table
    op.add_column('employees', sa.Column('rfid_tag', sa.String(length=100), nullable=True))
    op.create_index('ix_employees_rfid_tag', 'employees', ['rfid_tag'], unique=True)

    # Add rfid_tag column to vehicles table
    op.add_column('vehicles', sa.Column('rfid_tag', sa.String(length=100), nullable=True))
    op.create_index('ix_vehicles_rfid_tag', 'vehicles', ['rfid_tag'], unique=True)

    # Add rfid_tag column to equipment table
    op.add_column('equipment', sa.Column('rfid_tag', sa.String(length=100), nullable=True))
    op.create_index('ix_equipment_rfid_tag', 'equipment', ['rfid_tag'], unique=True)

    # Add rfid_tag column to visitors table
    op.add_column('visitors', sa.Column('rfid_tag', sa.String(length=100), nullable=True))
    op.create_index('ix_visitors_rfid_tag', 'visitors', ['rfid_tag'], unique=True)


def downgrade():
    # Drop rfid_tag column and index from employees
    op.drop_index('ix_employees_rfid_tag', table_name='employees')
    op.drop_column('employees', 'rfid_tag')

    # Drop rfid_tag column and index from vehicles
    op.drop_index('ix_vehicles_rfid_tag', table_name='vehicles')
    op.drop_column('vehicles', 'rfid_tag')

    # Drop rfid_tag column and index from equipment
    op.drop_index('ix_equipment_rfid_tag', table_name='equipment')
    op.drop_column('equipment', 'rfid_tag')

    # Drop rfid_tag column and index from visitors
    op.drop_index('ix_visitors_rfid_tag', table_name='visitors')
    op.drop_column('visitors', 'rfid_tag')
