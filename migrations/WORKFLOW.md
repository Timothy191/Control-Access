# Database Migration Workflow

This project uses two migration approaches:

## 1. Inline Migrations (database.py)

Simple column additions and schema changes are handled inline in `database.py` using SQLAlchemy's `inspect()`. These run automatically on app startup.

**When to use:**
- Adding new columns with defaults
- Simple schema modifications
- Changes that don't require data transformation

**Example:**
```python
# In database.py init_db()
inspector = inspect(engine)
columns = [col['name'] for col in inspector.get_columns('employees')]
if 'new_column' not in columns:
    engine.execute("ALTER TABLE employees ADD COLUMN new_column VARCHAR(50) DEFAULT ''")
```

## 2. Alembic Migrations (migrations/)

Complex schema changes use Alembic for version-controlled migrations.

**When to use:**
- Adding new tables
- Complex column modifications (type changes, constraints)
- Data transformations
- Changes that need rollback capability

### Creating a Migration

```bash
# Activate virtual environment
source venv/bin/activate

# Auto-generate migration from model changes
alembic revision --autogenerate -m "description of changes"

# Review the generated migration in migrations/versions/
# Edit if needed to add data transformations or fix issues
```

### Applying Migrations

```bash
# Apply all pending migrations
alembic upgrade head

# Apply specific migration
alembic upgrade <revision_id>

# Rollback one step
alembic downgrade -1

# Check current migration status
alembic current
```

### Migration Best Practices

1. **Test locally first:** Always test migrations on a copy of production data
2. **Backup before production:** `sqlite3 mine_management.db .backup > backup_$(date +%Y%m%d).db`
3. **One change per migration:** Keep migrations focused and atomic
4. **Include rollback:** Ensure `downgrade()` function works correctly
5. **Data migrations:** Use `op.execute()` for complex data transformations
6. **Review generated code:** Alembic auto-generate isn't perfect - review and edit

### Migration File Structure

```python
# migrations/versions/20260526_163100_add_rfid_fields.py

revision = 'abc123'
down_revision = 'def456'

def upgrade():
    op.add_column('employees', sa.Column('rfid_tag', sa.String(50)))
    op.add_column('equipment', sa.Column('rfid_tag', sa.String(50)))

def downgrade():
    op.drop_column('equipment', 'rfid_tag')
    op.drop_column('employees', 'rfid_tag')
```

## Relationship Between Approaches

- **Inline migrations** run on every app startup (idempotent)
- **Alembic migrations** are run manually and tracked in `alembic_version` table
- Use inline for simple additions, Alembic for complex changes
- Both can coexist - inline handles runtime schema checks, Alembic handles versioned changes

## Troubleshooting

**Migration fails with "table already exists":**
- Check if inline migration already created it
- Remove from Alembic migration or mark as already applied

**Column already exists error:**
- Inline migration may have added it
- Use `IF NOT EXISTS` in Alembic or skip the operation

**Need to re-run migration:**
```bash
# Reset to previous version
alembic downgrade -1
# Re-apply
alembic upgrade head
```

**Migration history out of sync:**
```bash
# Check current version
alembic current

# Stamp database with specific version (use with caution)
alembic stamp <revision_id>
```
