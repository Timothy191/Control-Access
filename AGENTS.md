# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Commands

```bash
# Run the application (OLLAMA_USE_CLOUD="true" for Ollama Cloud)
export OLLAMA_USE_CLOUD="false" && python app.py

# Run tests (coverage always-on via pytest.ini defaults)
pytest

# Run a single test file
pytest tests/test_auth.py

# Lint (ruff, CI uses --output-format=github)
ruff check .

# Type check (--ignore-missing-imports required for Flask/SQLAlchemy stubs)
mypy app.py --ignore-missing-imports

# Format
ruff format <file>

# Full deployment (tmux-based, 3 windows: server, monitor, dashboard)
./deploy-full-server.sh

# Health monitor (continuous loop, auto-restarts app if it crashes)
python monitor.py
```

## Key Facts

- **App runs at**: <http://localhost:8080> (not Flask default 5000)
- **Default login**: `admin` / `admin`
- **Database**: SQLite at `mine_management.db` (auto-created on first run)
- **AI**: Ollama local (primary) + Ollama Cloud (secondary, set `OLLAMA_USE_CLOUD=true`)
- **Version**: 2.1.0 (defined in `app.py` as `__version__`)

## API Quirks

- QR scanner endpoint: `POST /api/scan_qr` requires `X-API-Key` header
- Hardware integration uses this endpoint with JSON body:
  `{"qr_code": "...", "direction": "IN", "gate_location": "Main Gate"}`
- API key: `your-secret-hardware-key` (dev) or set `HARDWARE_API_KEY` env var

## AI Configuration

- Local: `OLLAMA_URL=http://localhost:11434` (default), models: `mine-assistant-fast`, `mine-assistant`
- Cloud: `OLLAMA_USE_CLOUD=true`, `OLLAMA_CLOUD_API_KEY=...`, `OLLAMA_CLOUD_URL=https://cloud.ollama.ai/api`
- Check status: `GET /api/ai/status` → returns `{"provider": "local"|"cloud"|"offline"}`

## Important Files

- `app.py` - Main Flask app (5096 lines, 113 routes, 11 models)
- `routes/` - 11 Blueprint modules (2318 lines total):
  - `admin.py` (262 lines) - Admin panel, user management, settings
  - `ai.py` (204 lines) - AI chat endpoints (streaming + non-streaming)
  - `auth.py` (37 lines) - Login/logout/session management
  - `dashboard.py` (189 lines) - Dashboard views + stats_history API
  - `devices.py` (73 lines) - Device/scanner management
  - `employees.py` (226 lines) - Employee CRUD + certificate tracking
  - `equipment.py` (78 lines) - Equipment management
  - `fleet.py` (72 lines) - Vehicle/fleet management
  - `monitoring.py` (286 lines) - System monitoring + metrics
  - `scanning.py` (701 lines) - QR/RFID scan processing + gate access
  - `visitors.py` (190 lines) - Visitor management + approval workflow
- `deploy-full-server.sh` - Primary deployment script (tmux, 3 windows)
- `monitor.py` - Health monitor + auto-restart (Rich TUI)
- `log_viewer.py` - Grafana-style terminal dashboard (rich + plotext)
- `models.py` - SQLAlchemy models (11 tables: User, Device, Employee, Vehicle,
  Equipment, Visitor, GateLog, Approval, SiteSetting, AuditLog, GateMapping)
- `database.py` - DB setup and session management
- `templates/` - 23 Jinja2 templates
- `tests/` - 15 test files (conftest.py + 14 test modules)

## Critical Gotchas

- **eventlet monkey-patching** — `app.py` calls `eventlet.monkey_patch()` at the top.
  Do NOT call it again in `gunicorn.conf.py` or elsewhere; double-patching breaks threading.
- **Single gunicorn worker** — Production uses `workers=1` in `gunicorn.conf.py` because
  Flask-SocketIO relies on in-memory state. Do not increase workers without switching to
  a Redis message queue.
- **SQLite WAL mode** — `database.py` sets `PRAGMA journal_mode=WAL` and related pragmas
  for concurrency. Do not change the journal mode without testing concurrent access.
- **Admin auto-creation** — `database.py` auto-creates the admin user on first run if no
  users exist. Do not manually insert SQL for the initial admin.
- **Legacy password support** — `User.check_password()` accepts plain-text passwords for
  migration. Do not remove this until all accounts have been migrated to hashed passwords.
- **Production env vars** — `SECRET_KEY` (min 32 chars) and `HARDWARE_API_KEY` (min 16 chars)
  must be set in production. Defaults are for development only.
- **CSRF is manual** — `WTF_CSRF_CHECK_DEFAULT = False`; CSRF is applied only to non-API
  routes via `@app.before_request`. API routes (`/api/*`) are exempt.
- **Session lifetime** — 30 minutes (`permanent_session_lifetime`). Sessions use
  `logged_in`, `username`, `user_id`, `role` keys.
- **`_utcnow()` returns naive datetime** — SQLite compatibility; all datetime comparisons
  must use naive UTC datetimes, not timezone-aware ones.
- **Rate limiting is in-memory** — `storage_uri="memory://"` in `flask_limiter`. Resets on
  app restart. Disabled in tests via `limiter.enabled = False`.
- **CORS restricted to `/api/*`** — Only API routes have CORS enabled. Web routes are
  same-origin only.
- **Docker uses gunicorn** — `CMD` in Dockerfile runs
  `gunicorn -c gunicorn.conf.py -b 0.0.0.0:8080 app:app`, not `flask run`.

## Response Caching

Two read-heavy endpoints use in-memory TTL caching to reduce database load:

- **`/api/dashboard/stats_history`** — Cached for **30 seconds**. Returns 7-day sparkline
  data and 24h gate scan histograms. Data changes slowly (daily/hourly aggregates), so
  longer cache is safe. Cache dict: `_dashboard_history_cache` in `routes/dashboard.py`.
- **`/api/monitoring/stats`** — DB query portion cached for **5 seconds**. System stats
  (CPU/memory/disk) and metrics history are always fresh; only the expensive DB counts
  (employees, vehicles, visitors, scans) are cached. Cache dict: `_monitoring_stats_cache`
  in `routes/monitoring.py`.

### Cache Invalidation Strategy

Both caches are invalidated immediately (not just expired) when underlying data changes:

- **Gate log creation** — `routes/scanning.py` (scan endpoints), `app.py` (`_process_rfid_scan`,
  `_process_qr_scan`). Both `invalidate_dashboard_cache()` and `invalidate_monitoring_cache()`
  are called after `db_session.commit()`.
- **Entity CRUD** — `routes/employees.py`, `routes/visitors.py`, `routes/fleet.py`,
  `routes/equipment.py`. Invalidation is called after every create, update, and delete commit.

### Invalidation Functions

- `routes.dashboard.invalidate_dashboard_cache()` — Clears `_dashboard_history_cache`.
- `routes.monitoring.invalidate_monitoring_cache()` — Clears `_monitoring_stats_cache`.

When adding new write paths that affect GateLog, Employee, Vehicle, Visitor, or Equipment
data, call both invalidation functions after `db_session.commit()` to keep caches consistent.
