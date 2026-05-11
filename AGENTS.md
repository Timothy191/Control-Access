# AGENTS.md

## Commands

```bash
# Run the application
export OLLAMA_USE_CLOUD="false"   # "true" for Ollama Cloud
python app.py

# Run tests (requires test dependencies)
pip install -r test_requirements.txt
pytest

# Full deployment (tmux-based, 3 windows: server, monitor, dashboard)
./deploy-full-server.sh

# Health check / monitoring (runs in continuous loop, auto-restarts app if it crashes)
python monitor.py
```

## Key Facts

- **App runs at**: http://localhost:8080
- **Default login**: `admin` / `admin`
- **Database**: SQLite at `mine_management.db` (auto-created on first run)
- **AI**: Ollama local (primary) + Ollama Cloud (secondary, set `OLLAMA_USE_CLOUD=true`)
- **Version**: 2.1.0 (defined in `app.py` as `__version__`)

## Testing

- Test framework: pytest with pytest-flask, pytest-sqlalchemy
- Run with: `pytest` (requires `pip install -r test_requirements.txt`)
- Tests: auth, employee, vehicle, visitor, QR scan API (12 cases)

## API Quirks

- QR scanner endpoint: `POST /api/scan_qr` requires `X-API-Key` header
- Hardware integration uses this endpoint with JSON body: `{"qr_code": "...", "direction": "IN", "gate_location": "Main Gate"}`
- API key: `your-secret-hardware-key` (dev) or set `HARDWARE_API_KEY` env var

## AI Configuration

- Local: `OLLAMA_URL=http://localhost:11434` (default), models: `mine-assistant-fast`, `mine-assistant`
- Cloud: `OLLAMA_USE_CLOUD=true`, `OLLAMA_CLOUD_API_KEY=...`, `OLLAMA_CLOUD_URL=https://cloud.ollama.ai/api`
- Check status: `GET /api/ai/status` → returns `{"provider": "local"|"cloud"|"offline"}`

## Dependencies

- Core: Flask, Flask-SQLAlchemy, Flask-SocketIO, openpyxl, qrcode, Pillow, requests
- Test: pytest, pytest-flask, pytest-sqlalchemy, pytest-cov, factory-boy, faker, requests-mock, freezegun

## Important Files

- `app.py` - Main Flask app (6256+ lines, 100+ routes, 10 models)
- `deploy-full-server.sh` - Primary deployment script (tmux, 3 windows)
- `monitor.py` - Health monitor + auto-restart (Rich TUI)
- `log_viewer.py` - Grafana-style terminal dashboard (rich + plotext)
- `models.py` - SQLAlchemy models (10 tables)
- `database.py` - DB setup and session management
- `templates/` - 21 Jinja2 templates (base, login, dashboard, employees, fleet, visitors, chat, etc.)
- `tests/` - 5 test files (test_auth, test_employee, test_vehicle, test_visitor, test_qr_scan)