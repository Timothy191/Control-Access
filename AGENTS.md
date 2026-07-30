# AGENTS.md

This file provides guidance to the AI agent when working with code in this repository.

## Commands

```bash
# Run the application (OLLAMA_USE_CLOUD="true" for Ollama Cloud)
export OLLAMA_USE_CLOUD="false" && python app.py

# Run tests (coverage always-on via pytest.ini defaults)
pytest

# Run a single test file
pytest tests/test_auth.py

# Skip slow tests
pytest -m "not slow"

# Lint (ruff, CI uses --output-format=github)
ruff check .

# Type check (--ignore-missing-imports required for Flask/SQLAlchemy stubs)
mypy app.py --ignore-missing-imports

# Format
ruff format <file>

# Full deployment (tmux-based, 3 windows: server, monitor, dashboard)
./deploy-full-server.sh
```

## Key Facts

- **App runs at**: <http://localhost:8080> (not Flask default 5000)
- **Default login**: `admin` / `admin`
- **Database**: SQLite at `mine_management.db` (auto-created on first run)

## API Quirks

- QR scanner endpoint: `POST /api/scan_qr` requires `X-API-Key` header (not session auth)
- Hardware integration JSON body: `{"qr_code": "...", "direction": "IN", "gate_location": "Main Gate"}`
- API key: `your-secret-hardware-key` (dev) or set `HARDWARE_API_KEY` env var

## Critical Gotchas

- **eventlet monkey-patching** — `app.py` calls `eventlet.monkey_patch()` at the top.
  Do NOT call it again in `gunicorn.conf.py` or elsewhere; double-patching breaks threading.
  This is also why ruff ignores `E402` (module-level import not at top).
- **Single gunicorn worker** — Production uses `workers=1` in `gunicorn.conf.py` because
  Flask-SocketIO relies on in-memory state. Do not increase workers without switching to
  a Redis message queue.
- **SQLite WAL mode** — `database.py` sets `PRAGMA journal_mode=WAL` and related pragmas
  for concurrency. Do not change the journal mode without testing concurrent access.
- **Admin auto-creation + password reset** — `database.py` auto-creates the admin user on
  first run. On EVERY startup, it resets the admin password to `$ADMIN_PASSWORD` (default `admin`).
  Do not manually insert SQL for the initial admin.
- **Legacy password support** — `User.check_password()` accepts plain-text passwords for
  migration. Do not remove this until all accounts have been migrated to hashed passwords.
- **Production env vars** — `SECRET_KEY` (min 32 chars) and `HARDWARE_API_KEY` (min 16 chars)
  must be set in production. Defaults are for development only.
- **CSRF is manual** — `WTF_CSRF_CHECK_DEFAULT = False`; CSRF is applied only to non-API
  routes via `@app.before_request`. API routes (`/api/*`) are exempt.
- **`_utcnow()` returns naive datetime** — SQLite compatibility; all datetime comparisons
  must use naive UTC datetimes, not timezone-aware ones.
- **`expire_on_commit=False`** — `db_session` uses `expire_on_commit=False`, so ORM objects
  remain accessible after `commit()` without lazy-load errors. Do not change this without
  auditing all post-commit attribute access.
- **Rate limiting is in-memory** — `storage_uri="memory://"` in `flask_limiter`. Resets on
  app restart. Disabled in tests via `limiter.enabled = False`.
- **CORS restricted to `/api/*`** — Only API routes have CORS enabled. Web routes are
  same-origin only.
- **Docker uses gunicorn** — `CMD` in Dockerfile runs
  `gunicorn -c gunicorn.conf.py -b 0.0.0.0:8080 app:app`, not `flask run`.

## Response Caching

Two read-heavy endpoints use in-memory TTL caching to reduce database load:

- **`/api/dashboard/stats_history`** — Cached for **30 seconds** (`_dashboard_history_cache` in `routes/dashboard.py`).
- **`/api/monitoring/stats`** — DB query portion cached for **5 seconds** (`_monitoring_stats_cache` in `routes/monitoring.py`).

Both caches are invalidated immediately (not just expired) when underlying data changes.
Invalidation functions: `routes.dashboard.invalidate_dashboard_cache()` and
`routes.monitoring.invalidate_monitoring_cache()`.

When adding new write paths that affect GateLog, Employee, Vehicle, Visitor, or Equipment
data, call both invalidation functions after `db_session.commit()` to keep caches consistent.
