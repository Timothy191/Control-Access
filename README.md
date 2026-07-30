# Arch-System

![Python](https://img.shields.io/badge/Python-3.12+-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-3.0-green?logo=flask)
![SQLite](https://img.shields.io/badge/SQLite-WAL-lightgrey?logo=sqlite)
![Ollama](https://img.shields.io/badge/AI-Ollama-purple?logo=meta)
![Chart.js](https://img.shields.io/badge/Chart.js-4.4-yellow?logo=javascript)
![Tabler](https://img.shields.io/badge/Icons-Tabler-orange?logo=tabler)
![License](https://img.shields.io/badge/License-MIT-green)

Site access control, employee/fleet/visitor management, QR code scanning, and AI-powered assistant — optimized for low-power Intel hardware.

---

## Features

- **Gate Access Control** — QR-based entry/exit with medical & induction expiry checks
- **Employee Management** — Full CRUD, certificate tracking, auto-denial on expiry
- **Fleet & Equipment** — Vehicle registration, tracking, QR assignment
- **Visitor Management** — Self-service QR requests, check-in/out, approval workflow
- **AI Assistant** — Ollama local/cloud dual-mode chat with system context (CPU-optimized)
- **Real-time Dashboard** — Chart.js charts, live gate scan feed via WebSocket
- **Emergency Muster** — Instant on-site personnel count from gate logs
- **Export** — Excel/PDF reports for employees, visitors, fleet, gate logs
- **Terminal Dashboard** — Grafana-style log viewer in terminal (rich + plotext)

---

## Architecture

```text
┌─────────────────────────────────────────────────────┐
│  Browser (Dashboard)                                │
│  ├── Socket.IO (live updates)                       │
│  ├── Chart.js (bar, line, pie charts)               │
│  └── REST API                                       │
├─────────────────────────────────────────────────────┤
│  Arch-System Flask App                              │
│  ├── app.py (5096 lines, core logic + 113 routes)   │
│  ├── routes/ (11 Blueprints, 2318 lines)            │
│  │   admin, ai, auth, dashboard, devices,           │
│  │   employees, equipment, fleet, monitoring,       │
│  │   scanning, visitors                             │
│  ├── models.py (11 SQLAlchemy models)               │
│  ├── SQLAlchemy ORM + SQLite (WAL mode)             │
│  ├── Flask-SocketIO (real-time events)              │
│  ├── Flask-Compress (gzip)                          │
│  └── Ollama API (local or cloud)                    │
├─────────────────────────────────────────────────────┤
│  Ollama AI                                          │
│  └── Local: mine-assistant-fast / mine-assistant   │
│  └── Cloud: https://cloud.ollama.ai                 │
├─────────────────────────────────────────────────────┤
│  Chainway C66 Scanner (Android)                     │
│  └── OkHttp → /api/scan_qr → JSON response         │
└─────────────────────────────────────────────────────┘
```

---

## Quick Start

```bash
# Deploy (creates venv, installs deps, starts Ollama, launches app)
chmod +x deploy-full-server.sh
./deploy-full-server.sh
```

### Manual Start

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Ollama local (or set OLLAMA_USE_CLOUD=true for cloud)
ollama serve &
ollama create mine-assistant -f Modelfile.mine

# Run app
OLLAMA_USE_CLOUD=false python app.py
```

**Access:** <http://localhost:8080>  
**Login:** `admin` / `admin`

---

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `SECRET_KEY` | random | Flask session secret |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama local API base URL |
| `OLLAMA_MODEL` | `mine-assistant-fast` | Primary model for AI chat |
| `OLLAMA_MODEL_FULL` | `mine-assistant` | Full model for complex analysis |
| `OLLAMA_CLOUD_URL` | `https://cloud.ollama.ai/api` | Ollama Cloud API base URL |
| `OLLAMA_CLOUD_API_KEY` | empty | Ollama Cloud API key |
| `OLLAMA_USE_CLOUD` | `false` | Set `true` to prefer Ollama Cloud over local |
| `HARDWARE_API_KEY` | (built-in) | Scanner device API key |

---

## AI Configuration

Arch-System supports two AI modes:

**Local (default):** Requires Ollama running locally. Fast, private, no API costs.

```bash
ollama serve
ollama create mine-assistant-fast -f Modelfile.mine
```

**Cloud:** Uses Ollama Cloud for larger models. Set environment variables:

```bash
export OLLAMA_USE_CLOUD=true
export OLLAMA_CLOUD_API_KEY="your-cloud-key"
export OLLAMA_MODEL="llama3.2"
python app.py
```

Check AI status at `GET /api/ai/status` — returns `{provider: "local"|"cloud"|"offline"}`.

---

## Repository Layout

```text
arch-system/
├── app.py                  ← Main Flask application (5096 lines, 113 routes)
├── routes/                 ← 11 Blueprint modules (2318 lines total)
│   ├── admin.py            ← Admin panel, user management, settings (262 lines)
│   ├── ai.py               ← AI chat endpoints, streaming (204 lines)
│   ├── auth.py             ← Login/logout/session (37 lines)
│   ├── dashboard.py        ← Dashboard views + stats API (189 lines)
│   ├── devices.py          ← Device/scanner management (73 lines)
│   ├── employees.py        ← Employee CRUD + certificates (226 lines)
│   ├── equipment.py        ← Equipment management (78 lines)
│   ├── fleet.py            ← Vehicle/fleet management (72 lines)
│   ├── monitoring.py       ← System monitoring + metrics (286 lines)
│   ├── scanning.py         ← QR/RFID scan processing (701 lines)
│   └── visitors.py         ← Visitor management + approvals (190 lines)
├── models.py               ← SQLAlchemy models (11 tables)
├── database.py             ← DB setup with SQLite WAL
├── monitor.py              ← Health monitor + auto-restart (Rich TUI)
├── log_viewer.py           ← Grafana-style terminal dashboard (rich + plotext)
├── deploy-full-server.sh   ← Primary deployment (tmux, 3 windows)
├── requirements.txt        ← 84 Python dependencies
├── test_requirements.txt   ← Test dependencies
├── pytest.ini              ← pytest configuration
│
├── templates/              ← 23 Jinja2 HTML templates
│   ├── base.html           ← Shared layout (sidebar, nav, CSS)
│   ├── login.html          ← Auth page
│   ├── dashboard.html      ← Main dashboard with Chart.js
│   ├── employees.html      ← Employee CRUD
│   ├── fleet.html          ← Vehicle management
│   ├── visitors.html       ← Visitor management
│   ├── chat.html           ← AI chat interface
│   ├── scanner_config.html  ← Scanner provisioning
│   └── ...
│
├── static/
│   ├── css/style.css       ← Dark theme (Inter + JetBrains Mono)
│   ├── js/
│   │   ├── main.js         ← Client-side logic
│   │   └── dashboard-gl.js ← WebGL sparklines (legacy)
│   └── downloads/           ← Generated QR codes / reports
│
├── tests/                  ← 15 pytest test files (conftest + 14 modules)
│   ├── conftest.py         ← Shared fixtures
│   ├── test_auth.py        ← Login/logout/permissions
│   ├── test_employee.py    ← Employee CRUD
│   ├── test_vehicle.py     ← Vehicle CRUD
│   ├── test_visitor.py     ← Visitor check-in/out
│   └── test_qr_scan.py     ← QR scan API (12 cases)
│
├── scripts/                ← Utility scripts
│   └── single-deployment/  ← Alternate deployer
│       └── deploy.sh
│
├── .github/workflows/
│   ├── ci.yml             ← CI: syntax, import, pytest
│   └── deploy.yml          ← Deploy: SSH to server, rebuild model
│
├── Modelfile.mine          ← Ollama model definition
├── .env.example            ← Environment variable template
├── seed_data.py           ← Sample data seeder
├── AGENTS.md              ← Developer reference (commands, facts)
└── REPO_LAYOUT.md         ← ASCII tree of all files
```

---

## API Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/scan_qr` | API Key | QR scan from hardware scanner |
| `POST` | `/api/scan_alt` | None | Alternative scan endpoint |
| `POST` | `/api/c66` | LAN only | Chainway C66 ingest |
| `GET` | `/api/ai/status` | Session | AI engine health + provider |
| `POST` | `/api/ai/chat` | Session | AI chat (non-streaming) |
| `POST` | `/api/ai/chat/stream` | Session | AI chat (SSE stream) |
| `GET` | `/api/dashboard/stats_history` | Session | 7-day sparkline + gate chart data |
| `GET` | `/api/recent_activity` | Session | Last 20 gate scans |

---

## Testing

```bash
pip install -r test_requirements.txt
pytest --tb=short -q
```

Test coverage includes: auth, employee CRUD, vehicle CRUD, visitor check-in/out, QR scan API (12 cases including expiry, inactive, pending approval).

---

## Deployment

The `deploy-full-server.sh` script handles:

1. Kill old processes & clear ports
2. Configure firewall (ufw/iptables)
3. Create/sync virtualenv
4. Syntax + import validation
5. Start Ollama + build `mine-assistant` model
6. Launch Flask + monitor + log viewer in tmux (3 windows)
7. Wait for server, open browser

Terminal shortcuts: `Ctrl+B 0/1/2` switch window, `Ctrl+B D` detach, `tmux attach -t mine-system` re-attach.

---

## License

MIT — See LICENSE file.
