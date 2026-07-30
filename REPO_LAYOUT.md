# Repository Layout — Arch-System

## Tree

```text
arch-system/
│
├── app.py                      Main Flask application
│   ├── 111 routes              Employees, fleet, visitors, equipment, approvals, gate logs, AI, exports
│   ├── 11 SQLAlchemy models    User, Employee, Vehicle, Equipment, Visitor, GateLog, Approval, SiteSetting, AuditLog, Device, GateMapping
│   ├── Ollama AI               Local + Cloud dual-mode
│   └── 7755 lines
│
├── models.py                   SQLAlchemy model definitions
├── database.py                 DB init, session, WAL mode
├── seed_data.py                Sample data generator
│
├── monitor.py                   Health monitor + auto-restart (Rich TUI)
├── log_viewer.py               Grafana-style terminal dashboard (rich + plotext)
├── deploy-full-server.sh        Full deployment script (tmux, 3 windows)
│
├── requirements.txt             Core Python dependencies
├── test_requirements.txt        Test dependencies
├── pytest.ini                   pytest config (ignore OpenMythos, pythonpath)
├── .env.example                 Environment variable template
├── Modelfile.mine               Ollama model definition
├── AGENTS.md                    Developer reference (commands, facts)
├── REPO_LAYOUT.md               This file
└── README.md                    Project documentation
│
├── templates/                   23 Jinja2 HTML templates
│   ├── base.html               Shared layout (sidebar nav, theme CSS, Tabler icons, Chart.js)
│   ├── login.html              Auth page
│   ├── dashboard.html           Main dashboard (Chart.js bar chart, stat cards, WebGL charts)
│   ├── employees.html          Employee CRUD + QR code generation + export
│   ├── fleet.html              Vehicle management + QR codes
│   ├── visitors.html           Visitor check-in/out + approval workflow
│   ├── equipment.html          Equipment tracking
│   ├── approvals.html          Approval queue
│   ├── gate_logs.html          Gate scan history + filters
│   ├── chat.html               AI chat interface (streaming SSE)
│   ├── scanner_config.html     Chainway C66 scanner provisioning
│   ├── visitor_request.html    Visitor self-service QR request
│   ├── emergency_muster.html    Emergency muster report
│   ├── reports.html            Report generation (Excel/PDF)
│   ├── onair.html              On-air personnel list
│   ├── onboarding.html         Standalone scanner onboarding (not base-extended)
│   ├── devices.html            Device management
│   ├── site_settings.html      System configuration
│   ├── audit_logs.html         Audit trail
│   ├── user_management.html    User CRUD
│   ├── qr_generator.html       QR code generation utility
│   └── import_employees.html   Bulk employee import (Excel)
│
├── static/
│   ├── css/style.css           Dark theme CSS (Inter + JetBrains Mono, stat card hover effects, button shimmer)
│   └── js/
│       ├── main.js             Client-side logic (Socket.IO, AJAX, CSV export)
│       └── dashboard-gl.js     Legacy WebGL sparkline charts (8KB)
│
├── tests/                      14 pytest test files (conftest + 13 modules)
│   ├── conftest.py             Shared fixtures (auth_client, sample_employee, sample_vehicle, sample_visitor)
│   ├── test_admin.py           User management, audit logs, gate mappings
│   ├── test_approvals.py       Approval workflow (pending/approve/reject)
│   ├── test_auth.py            Login, logout, protected routes
│   ├── test_employee.py        Employee CRUD, listing, filtering
│   ├── test_equipment.py       Equipment/radio device management
│   ├── test_export.py          Excel/PDF/QR ZIP exports
│   ├── test_gate_logs.py       Gate logs filtering, pagination, API
│   ├── test_import.py          CSV/Excel import functionality
│   ├── test_load.py            Load/stress tests, concurrency
│   ├── test_monitoring.py      System health, stats, diagnostics
│   ├── test_qr_scan.py         QR scan API (12 cases: valid/inactive employee, vehicle, visitor, expiry, gate logs)
│   ├── test_vehicle.py         Vehicle CRUD, listing
│   └── test_visitor.py         Visitor check-in/out, listing
│
├── scripts/
│   └── single-deployment/
│       └── deploy.sh           Alternate deployment script
│
└── .github/workflows/
    ├── ci.yml                 CI: lint (ruff), typecheck (mypy), pytest (3.12 + 3.13)
    └── deploy.yml             Deploy: SSH to server, rebuild model, restart
```

## Model Field Reference

| Model | Key Fields |
| --- | --- |
| `Employee` | `emp_code`, `first_name`, `surname`, `id_number` (NOT NULL), `job_title`, `induction_expiry`, `medical_expiry`, `qr_code`, `status` |
| `Vehicle` | `fleet_id`, `registration_expiry`, `qr_code`, `status` |
| `Equipment` | `radio_id`, `registration_expiry`, `qr_code`, `status` |
| `Visitor` | `name`, `company`, `purpose`, `meeting_person`, `host_id`, `qr_code`, `status` |
| `GateLog` | `access_type`, `entity_id`, `entity_name`, `direction`, `qr_data`, `access_granted`, `gate_location` |
| `Approval` | `request_type`, `requester_name`, `details`, `status`, `scanned_data` |

## Route Method Reference

| Route | Method | Auth | Description |
| --- | --- | --- | --- |
| `/employees` | GET | Session | List employees |
| `/add_employee` | POST | admin/manager | Create employee |
| `/edit_employee/<id>` | POST | admin/manager | Update employee |
| `/delete_employee/<id>` | POST | admin | Delete employee |
| `/fleet` | GET | Session | List vehicles |
| `/add_vehicle` | POST | admin/manager | Create vehicle |
| `/edit_vehicle/<id>` | POST | admin/manager | Update vehicle |
| `/delete_vehicle/<id>` | POST | admin | Delete vehicle |
| `/checkin_visitor` | POST | Session | Check in visitor |
| `/checkout_visitor/<id>` | GET | Session | Check out visitor |
| `/api/scan_qr` | POST | API Key | QR scan endpoint |
| `/api/ai/chat` | POST | Session | AI chat (non-streaming) |
| `/api/ai/chat/stream` | POST | Session | AI chat (SSE streaming) |
| `/api/ai/status` | GET | Session | AI provider status |

## Test Fixtures

- `test_app` — Flask test client
- `authenticated_client` — Authenticated test client with admin session
- `db_cleanup` — Rolls back DB after each test
- `sample_employee` — Active employee with `emp_code=EMP001`
- `sample_vehicle` — Active vehicle with `fleet_id=ABC123`
- `sample_visitor` — Checked-in visitor linked to sample_employee
- `HARDWARE_API_KEY` — `"your-secret-hardware-key"` (matches `app.py`)

Run tests: `PYTHONPATH=. ./venv/bin/pytest tests/ --tb=short -q`
