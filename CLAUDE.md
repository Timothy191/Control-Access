# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mine access control system built with Flask, SQLAlchemy, and Flask-SocketIO.
Manages employees, vehicles, visitors, equipment, gate access via QR/RFID scans,
and includes an AI chat assistant backed by Ollama.

App runs at `http://localhost:8080` with default login `admin` / `admin`.

## Commands

```bash
# Run the application (default local Ollama mode)
python app.py

# Run with Ollama Cloud
export OLLAMA_USE_CLOUD=true OLLAMA_CLOUD_API_KEY=<key>
python app.py
```

## Architecture

- **Entry point**: `app.py` creates the Flask app, registers route blueprints,
  initializes SocketIO, and runs on port `8080`.
- **Routes**: Modular blueprints in `routes/`. Each module is imported and registered
  in `app.py`. To add a new route group, create `routes/<name>.py`, define a
  `Blueprint`, and register it in `app.py`.
- **Models**: `models.py` defines SQLAlchemy tables: `User`, `Employee`, `Vehicle`,
  `Equipment`, `Visitor`, `GateLog`, `Device`, `Approval`, `AuditLog`, `GateMapping`,
  `SiteSetting`.
- **Database**: `database.py` sets up SQLite with WAL mode pragmas and a scoped
  `db_session` using `expire_on_commit=False`. `init_db()` creates tables and the
  default `admin` user.
- **Shared utilities**: `utils.py` holds `login_required`, `role_required`,
  `require_api_key`, `_utcnow()`, and `log_audit()`. `extensions.py` initializes
  SocketIO, rate limiting, Ollama configuration, and in-memory metrics storage
  to avoid circular imports with route modules.
- **Services layer** (`services/`): Business-logic layer between route blueprints
  and models. Route modules should import and delegate to service functions rather
  than inlining database queries or scan-processing logic.
  - `services/scan_service.py` — QR scan processing.
  - `services/listeners.py` — Network scanner discovery.
- **Real-time**: `flask_socketio` emits live gate-scan events from `routes/scanning.py`.
- **Templates/static**: Jinja2 templates in `templates/`, CSS in `static/css/style.css`,
  client JS in `static/js/main.js`.

## Roles and Permissions

Roles are `admin`, `manager`, `security`, and `user`. Use `role_required(...)` from
`utils.py` to guard routes. `admin` has full access; `manager` has dashboard/views;
`security` has QR scanning and gate-log access; `user` has basic access.

## Key Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `SECRET_KEY` | random | Flask session secret (min 32 chars in production) |
| `ADMIN_PASSWORD` | `admin` | Admin password, reset on every startup |
| `HARDWARE_API_KEY` | built-in | API key for `/api/scan_qr` (min 16 chars in production) |
| `MOBILE_API_KEY` | empty | Optional second API key for mobile scanner app |
| `OLLAMA_URL` | `http://localhost:11434` | Local Ollama base URL |
| `OLLAMA_MODEL` | `mine-assistant-fast` | Fast chat model |
| `OLLAMA_MODEL_FULL` | `mine-assistant` | Full analysis model |
| `OLLAMA_USE_CLOUD` | `false` | Prefer Ollama Cloud when `true` |
| `OLLAMA_CLOUD_API_KEY` | empty | Ollama Cloud API key |
| `OLLAMA_CLOUD_URL` | `https://cloud.ollama.ai/api` | Ollama Cloud API base URL |
| `PORTKEY_API_KEY` | empty | Portkey AI gateway API key (enables Portkey routing) |
| `PORTKEY_BASE_URL` | `https://api.portkey.ai/v1` | Portkey API base URL |
| `PORTKEY_VIRTUAL_KEY` | empty | Portkey virtual key for provider routing |
| `VISITOR_PIN` | `1234` | PIN for visitor self-service QR requests |
| `ENABLE_AI_CHAT` | `true` | Set `false` to disable AI assistant entirely |
| `FLASK_ENV` | `production` | Set to `development` for debug mode |
| `HTTPS` | `false` | Set `true` behind TLS for Secure cookie flag |
| `CORS_ORIGINS` | `*` | Restrict API CORS origins (comma-separated) |

## API Authentication

- Web routes use session-based login.
- `/api/scan_qr` uses API-key authentication via the `X-API-Key` header.
  Request body: `{"qr_code": "...", "direction": "IN", "gate_location": "Main Gate"}`.
- CSRF is applied only to non-API web routes via `app.before_request`; API routes
  (`/api/*`) are exempt (`WTF_CSRF_CHECK_DEFAULT = False`).

## Critical Constraints

### Database

- **SQLite WAL mode** — `database.py` sets `PRAGMA journal_mode=WAL` plus
  concurrency pragmas. Do not change the journal mode without testing concurrent
  access.
- **Admin password reset** — `database.py` resets the admin password to
  `ADMIN_PASSWORD` on every startup. Do not manually insert the initial admin.
- **Legacy plain-text passwords** — `User.check_password()` supports plain-text
  passwords for migration. They are re-hashed on next successful login via
  `routes/auth.py`.
- **Naive UTC datetimes** — `_utcnow()` returns a naive UTC datetime for SQLite
  compatibility. All datetime comparisons must remain naive.
- **`expire_on_commit=False`** — `db_session` keeps ORM objects accessible after
  `commit()`. Do not change without auditing post-commit attribute access.

### Deployment

- **eventlet monkey-patching** — `app.py` calls `eventlet.monkey_patch()` at the
  top. Do not patch again elsewhere.
- **Single gunicorn worker** — increase workers only after adding a Redis message
  queue, because Flask-SocketIO keeps in-memory state.

### Security

- **In-memory rate limiting** — resets on app restart and is disabled in tests via
  `limiter.enabled = False`.
- **CORS is restricted to `/api/*`** — web routes are same-origin only.

## Response Caching

- `/api/dashboard/stats_history` — cached 30 seconds in `routes/dashboard.py`.
- `/api/monitoring/stats` — DB portion cached 5 seconds in `routes/monitoring.py`.

When adding write paths that affect `GateLog`, `Employee`, `Vehicle`, `Visitor`, or
`Equipment`, call `routes.dashboard.invalidate_dashboard_cache()` and
`routes.monitoring.invalidate_monitoring_cache()` after `db_session.commit()`.

## SharePoint / Power Platform Integration

The system supports optional SharePoint integration for Power Apps and Power BI.
**Data flows read-only: SharePoint → local SQLite DB → Power Apps.**
We never write data back to SharePoint.

### Environment Variables
- `SHAREPOINT_USERNAME` — SharePoint account username
- `SHAREPOINT_PASSWORD` — SharePoint account password
- `SHAREPOINT_SITE_URL` — SharePoint site URL (e.g., `https://company.sharepoint.com/sites/site`)
- `SHAREPOINT_EMPLOYEE_LIST` — SharePoint list name (default: `Employees`)
- `SHAREPOINT_SYNC_INTERVAL` — Sync interval in seconds (default: 300)
- `SHAREPOINT_AUTO_SYNC` — Set to `true` to enable automatic periodic sync

### Power Apps API Endpoints
- `GET /api/powerapps/employees` — Employee data for Power Apps (supports `$filter`, `$top`)
- `GET /api/powerapps/gate_logs` — Gate logs for Power BI dashboards
- `GET /api/powerapps/sync_status` — SharePoint sync status monitoring

### SharePoint Sync Service
- `services/sharepoint_sync.py` — Read-only sync from SharePoint lists to local DB
- `init_sharepoint_sync()` — Called at app startup for initial sync
- `schedule_sharepoint_sync(app)` — Schedules periodic sync via Flask-APScheduler
- `SharePointSync` class — Handles authentication and read-only sync operations

### Power Apps Integration
1. Set `SHAREPOINT_AUTO_SYNC=true` in `.env`
2. Configure SharePoint list with fields: `Title` (emp_code), `FirstName`, `LastName`, `JobTitle`
3. Power Apps reads from `/api/powerapps/employees` (local DB) or directly from SharePoint list
4. Data syncs automatically (read-only) every `SHAREPOINT_SYNC_INTERVAL` seconds
