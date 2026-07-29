# Codebase Audit Report — Arch-System (Mine Management)

**Date:** 29 July 2026  
**Version:** 2.1.0 (from `app.py`)  
**Python:** 3.14.6  
**Repository:** `Control-Access`  
**Last Commit:** `ddf0c1c` — "Update deployment script reference"

---

## 1. Project Overview

A Flask-based mine management system for gate access control, employee/fleet/visitor management, QR scanning, and AI-powered chat assistant. Optimized for low-power Intel hardware (i5-7500, 16GB RAM, no GPU).

- **Backend:** Flask 2.3.3, SQLAlchemy 2.0.49, Flask-SocketIO 5.3.4
- **Database:** SQLite (WAL mode), Alembic migrations
- **AI:** Ollama (local primary, cloud secondary), Anthropic SDK present
- **Hardware:** Chainway C66 scanner integration
- **Deployment:** Gunicorn + eventlet, systemd service, Docker

---

## 2. Git Status

| Metric | Value |
|--------|-------|
| Last commit | `ddf0c1c` |
| Total commits in recent history | 7 (from `ddf0c1c` back to `7b86a6e`) |
| Uncommitted changes | **67 modified files, 19 untracked** |

### Recent Commits (chronological order):

| Commit | Description |
|--------|-------------|
| `ddf0c1c` | Update deployment script reference |
| `6abac69` | security: production hardening — audit fixes 1-22 |
| `9e4f73c` | feat: C66 scanner integration and system updates |
| `cefb941` | perf: 6 targeted performance optimizations |
| `90e2f7d` | feat: WebGL dashboard, Ollama CPU tuning, GitHub CI/CD |
| `7f51e96` | Rewrite deploy script |
| `7b86a6e` | Full system sync: CSRF, rate limiting, POST deletes, DB indexes, cookie security |

### Key Uncommitted Changes:
- **Deleted files:** 15+ C66-related doc/setup files (`C66-DUAL-MODE-*.md`, etc.)
- **Modified core files:** `app.py`, `database.py`, `models.py`, `gunicorn.conf.py`, `deploy-full-server.sh`, `scan_ingestion.py`
- **Modified templates:** `kiosk_scanner.html`, `login.html`
- **Modified tests:** `conftest.py`, 8 test files
- **New untracked:** `Dockerfile`, `ruff.toml`, `ai-hub/`, `docs/`, `backups/`, `import_radios.py`, `rfid_listener.py`, `MineGateScannerApp/`, etc.

---

## 3. Python Environment

| Component | Status |
|-----------|--------|
| **Python version** | 3.14.6 |
| **Virtual environment** | `venv_new/` (active, 80+ packages) |
| **Pip version** | 26.1.2 |

### Core Dependencies (all installed):

| Package | Version | Purpose |
|---------|---------|---------|
| Flask | 2.3.3 | Web framework |
| Flask-SQLAlchemy | 3.1.1 | ORM |
| Flask-SocketIO | 5.3.4 | WebSocket real-time |
| Flask-Limiter | 4.1.1 | Rate limiting |
| Flask-Migrate | 4.1.0 | DB migrations |
| Flask-Cors | 4.0.0 | CORS for API routes |
| Flask-Compress | 1.17 | Gzip compression |
| Flask-WTF | 1.3.0 | CSRF protection |
| SQLAlchemy | 2.0.49 | Database ORM |
| SQLAlchemy-Utils | 0.42.1 | Utility functions |
| Alembic | 1.18.4 | DB migrations |
| Gunicorn | 23.0.0 | Production WSGI |
| Eventlet | 0.40.3 | Async worker |
| Anthropic | 0.89.0 | Cloud AI fallback |
| httpx | 0.28.1 | HTTP client for Ollama |
| Pandas | 3.0.2 | Data processing |
| OpenPyXL | 3.1.2 | Excel import/export |
| ReportLab | 4.0.9 | PDF generation |
| qrcode | 7.4.2 | QR generation |
| Rich | 15.0.0 | Terminal UI (monitor) |
| Plotext | 5.3.2 | Terminal charts |
| Requests | 2.33.1 | HTTP client |
| Pydantic | 2.12.5 | Validation |
| cryptography | 46.0.7 | Password hashing |

**Note:** `test_requirements.txt` exists (for CI); `zstandard` 0.25.0 also installed (compression).

---

## 4. Database Status

| Metric | Value |
|--------|-------|
| **DB file** | `mine_management.db` |
| **Size** | 1.3 MB |
| **Last modified** | 29 Jul 14:12 |
| **Engine** | SQLite (WAL mode) |
| **Migrations** | 4 Alembic versions applied |

### Tables and Row Counts:

| Table | Rows | Purpose |
|-------|------|---------|
| `users` | 1 | System accounts (admin) |
| `employees` | 2 | Mine employees |
| `vehicles` | 0 | Fleet vehicles |
| `visitors` | 0 | Site visitors |
| `gate_logs` | 4 | Gate scan records |
| `approvals` | 4 | Visitor/access approvals |
| `equipment` | 0 | Equipment/radio tracking |
| `devices` | 0 | Hardware devices |
| `audit_logs` | 0 | Audit trail |
| `gate_mappings` | 0 | Gate/zone configurations |
| `site_settings` | 1 | Global site settings |

**Assessment:** Database is mostly empty (seed data minimal). The system is in early-stage configuration or testing.

### Backups (in `backups/`):
- `mine_management-20260528-111147.db` (1.3 MB) — 28 May
- `mine_management-20260529-062501.db` (1.3 MB) — 29 May
- `mine_management.db.backup_20260529_064908` (1.3 MB) — 29 May

---

## 5. Test Suite Status

### Test Files (14 total):

| File | Size | Topic |
|------|------|-------|
| `conftest.py` | 2.4 KB | Fixtures & config |
| `test_admin.py` | 14 KB | Admin routes |
| `test_approvals.py` | 15 KB | Approval workflows |
| `test_auth.py` | 1.7 KB | Authentication |
| `test_employee.py` | 2.8 KB | Employee CRUD |
| `test_equipment.py` | 12 KB | Equipment management |
| `test_export.py` | 14 KB | Excel/PDF export |
| `test_gate_logs.py` | 14 KB | Gate scan logs |
| `test_import.py` | 11 KB | Data import |
| `test_load.py` | 16 KB | Load testing |
| `test_monitoring.py` | 8.9 KB | Monitoring dashboard |
| `test_qr_scan.py` | 9.1 KB | QR scanning |
| `test_vehicle.py` | 2.1 KB | Vehicle CRUD |
| `test_visitor.py` | 2.0 KB | Visitor CRUD |

### Current Test Status:

**❌ TESTS CANNOT RUN** — `ModuleNotFoundError: No module named 'app'`

The `pytest.ini` includes `pythonpath = .` which should work, but the import fails:
```
tests/conftest.py:7: in <module>
    from app import app, db_session
E   ModuleNotFoundError: No module named 'app'
```

**Root cause:** The test environment is not resolving the current directory to Python path correctly, or there's a conflict with the eventlet monkey-patching that must happen before all imports. The `app.py` calls `eventlet.monkey_patch()` at line 1-3, which must execute before any other module imports. The `conftest.py` bypasses this by not importing `app` first — but the `app` import itself triggers monkey-patching. The `venv_new` Python may not have `eventlet` installed globally, or the environment is not configured to find `app.py` in the CWD.

### Coverage Config:
- Coverage is always-on via `pytest.ini`
- Covers: `app`, `models`, `database`
- Output: HTML report + terminal missing lines

---

## 6. AI Configuration

### Ollama Models:

| Model | Base | Params | Status |
|-------|------|--------|--------|
| `mine-assistant` | llama3.2 | ~3B | **NOT FOUND** |
| `mine-assistant-fast` | llama3.2:1b-instruct-q4_K_M | ~1B | **NOT FOUND** |

### Available Models (detected at runtime):
- `qwen2.5:1.5b`
- `qwen2.5:0.5b`
- `nomic-embed-text:latest`

**Issue:** The two custom Ollama models the app expects (`mine-assistant` and `mine-assistant-fast`) are not installed. The app falls through to available models, but AI functionality will use generic `qwen2.5` models instead of the tuned ones.

### AI Mode:
- **Default:** Local Ollama at `http://localhost:11434`
- **Cloud fallback:** Ollama Cloud (`OLLAMA_USE_CLOUD=true`)
- **Anthropic SDK** installed (0.89.0) — potential additional cloud AI provider
- **Health endpoint:** `GET /api/ai/status` → returns provider info

### Model Files (exist, need `ollama create`):
- `Modelfile.mine` — Configuration for `mine-assistant` (temp 0.3, ctx 2048, threads 2)
- `Modelfile.mine-fast` — Configuration for `mine-assistant-fast` (temp 0.3, ctx 2048, threads 2, predict 256)

---

## 7. Application Architecture

### File Layout:
```
Control-Access/
├── app.py                  # 7,755 lines — Main application (112 routes)
├── models.py               # SQLAlchemy models (11 tables)
├── database.py             # DB setup, session management, admin creation
├── gunicorn.conf.py        # Production WSGI config
├── deploy-full-server.sh   # tmux deployment (3 windows)
├── monitor.py              # Health monitor with Rich TUI
├── log_viewer.py           # Terminal dashboard (Grafana-style)
├── scan_ingestion.py       # Scan data ingestion
├── rfid_listener.py        # RFID listener (untracked — new)
├── process_qr.py           # QR processing (untracked — new)
├── seed_data.py            # Database seeding
├── requirements.txt        # 85 pinned dependencies
├── Dockerfile              # Python 3.13-slim container
├── templates/              # 23 Jinja2 templates
├── static/                 # CSS, JS, icons, images, configs
├── tests/                  # 14 test files
├── migrations/             # 4 Alembic migration versions
├── scripts/                # C66 setup, deployment, simulation scripts
├── ai-hub/                 # AI orchestration scripts
├── MineGateScannerApp/     # Android scanner app (untracked — new)
├── radio_qrcodes/          # Radio QR codes (untracked — new)
└── docs/                   # Architecture doc, C66 guide, audit reports
```

### Application Features:
1. **Gate Access Control** — QR-based entry/exit with certificate expiry checks
2. **Employee Management** — CRUD, certificates, QR assignment
3. **Fleet Management** — Vehicle registration, tracking
4. **Visitor Management** — Self-service QR, check-in/out, approvals
5. **Equipment Tracking** — Radio/equipment ID tracking
6. **Real-time Dashboard** — Chart.js, WebSocket live feed
7. **Emergency Muster** — On-site personnel count
8. **AI Chat Assistant** — Ollama local/cloud dual-mode
9. **Export** — Excel/PDF reports
10. **Terminal Dashboard** — Rich + Plotext Grafana-style viewer

### Security Features:
- CSRF protection (manual, non-API routes only)
- Rate limiting (in-memory, Flask-Limiter)
- Session-based auth (30 min timeout)
- CORS restricted to `/api/*`
- API key required for `/api/scan_qr`
- Role-based access control (admin, manager, security, user)

---

## 8. Deployment Configuration

| Method | Config | Status |
|--------|--------|--------|
| **Development** | `python app.py` → port 5000 | Ready |
| **Production (gunicorn)** | `gunicorn -c gunicorn.conf.py "app:app"` → port 8080 | Ready |
| **Systemd service** | `mine-management.service` | **Path mismatch** — points to `/home/tim/Desktop/New Folder/` (old location) |
| **Docker** | `Dockerfile` → port 8080 | Ready (untracked) |
| **Nginx** | `nginx.conf.example` | Example only |
| **tmux deploy** | `deploy-full-server.sh` (3 windows: server, monitor, dashboard) | Ready |

### Critical Deployment Issue:
The systemd service file (`mine-management.service`) still references the OLD project path:
```
WorkingDirectory=/home/tim/Desktop/New Folder/01.mine-management-system
ExecStart=.../venv/bin/gunicorn...
```
This path no longer exists — the project is now at `/home/timothy/Desktop/Control-Access`. The service cannot start.

---

## 9. Findings & Issues Summary

### 🔴 Critical Issues:

| # | Issue | Details |
|---|-------|---------|
| 1 | **Tests cannot run** | `ModuleNotFoundError: No module named 'app'` — conftest.py cannot import app.py |
| 2 | **Systemd service path broken** | `mine-management.service` points to old `/home/tim/...` path, not current `/home/timothy/Desktop/Control-Access` |
| 3 | **Ollama models not installed** | `mine-assistant` and `mine-assistant-fast` not found. Available: `qwen2.5:1.5b`, `qwen2.5:0.5b`, `nomic-embed-text` |

### 🟡 Moderate Issues:

| # | Issue | Details |
|---|-------|---------|
| 4 | **67 uncommitted changes** | Large working tree divergence — 48 modified, 19 untracked files. Risk of losing changes. |
| 5 | **Database nearly empty** | Only 1 user, 2 employees, 4 gate logs, 4 approvals. Not representative of production load. |
| 6 | **Python 3.14.6** | Very new Python version — may have compatibility issues with some packages |
| 7 | **Eventlet RLock warning** | `1 RLock(s) were not greened` — potential concurrency issue from import ordering |
| 8 | **No docker-compose.yml** | Only Dockerfile exists; no orchestration for multi-container setup |
| 9 | **Coverage not installable** | `pytest-cov` requires `app` module to be importable to measure coverage |

### 🟢 Good:

| # | Item | Details |
|---|------|---------|
| 1 | **Comprehensive test suite** | 14 test files covering all major features |
| 2 | **Full dependency pinning** | All 85 packages in `requirements.txt` with exact versions |
| 3 | **Database backups** | 3 recent backups preserved |
| 4 | **Alembic migrations** | 4 migration versions for schema evolution |
| 5 | **AI dual-mode** | Local + cloud fallback + Anthropic SDK |
| 6 | **Hardware integration** | Chainway C66 scanner, Infowedge, RFID |
| 7 | **Security hardening** | CSRF, rate limiting, API keys, role-based access |
| 8 | **Monitoring** | Health monitor, terminal dashboard, log viewer |
| 9 | **Documentation** | README, AGENTS.md, CLAUDE.md, architecture diagram |
| 10 | **Linting config** | `ruff.toml` for code quality |

---

## 10. Recommendations

### Immediate:
1. **Run `ollama create`** for both custom models from their Modelfiles
2. **Fix the systemd service path** to point to `/home/timothy/Desktop/Control-Access`
3. **Fix test imports** — ensure `app` module is discoverable (try running `PYTHONPATH=. pytest` from the project root)

### Short-term:
4. **Commit or stash** the 67 uncommitted changes to reduce divergence risk
5. **Seed the database** with realistic test data using `seed_data.py`
6. **Clean up deleted C66 files** from git tracking (`git rm` for the deleted files)
7. **Review unused files** — `import_radios.py`, `process_qr.py`, `rfid_listener.py` are untracked — verify they're needed

### Medium-term:
8. **Create docker-compose.yml** for Ollama + app multi-container setup
9. **Set up CI/CD pipeline** (GitHub Actions already referenced in commit history)
10. **Switch production DB** from SQLite to PostgreSQL for concurrent multi-worker support
11. **Add Redis backend** for rate limiting and Flask-SocketIO message queue