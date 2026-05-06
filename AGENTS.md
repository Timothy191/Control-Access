# AGENTS.md

## Commands

```bash
# Run the application
export GOOGLE_API_KEY="your-gemini-api-key"
python app.py

# Run tests (requires test dependencies)
pip install -r test_requirements.txt
pytest

# Deploy (creates venv, installs deps, runs app)
./deploy.sh

# Health check / monitoring (runs in continuous loop, auto-restarts app if it crashes)
python monitor.py
```

## Key Facts

- **App runs at**: http://localhost:8080
- **Default login**: `admin` / `admin`
- **Database**: SQLite at `mine_management.db` (auto-created on first run)
- **No lint/typecheck configured**: No ruff, mypy, or pre-commit hooks found
- **AI chat**: Uses Google Gemini API (`gemini-2.0-flash` model, set `GOOGLE_API_KEY` env var)

## Testing

- Test framework: pytest with pytest-flask, pytest-sqlalchemy
- Run with: `pytest` (requires `pip install -r test_requirements.txt`)
- Tests directory exists but appears empty

## API Quirks

- QR scanner endpoint: `POST /api/scan_qr` requires `X-API-Key` header
- Hardware integration uses this endpoint with JSON body: `{"qr_code": "...", "direction": "IN", "gate_location": "Main Gate"}`

## Dependencies

- Core: Flask, Flask-SQLAlchemy, Flask-SocketIO, openpyxl, qrcode, Pillow, google-generativeai, requests
- Test: pytest, pytest-flask, pytest-sqlalchemy, pytest-cov, factory-boy, faker, requests-mock, freezegun

## Important Files

- `app.py` - Main Flask app with all routes, models, and logic
- `models.py` - SQLAlchemy models
- `database.py` - DB setup and session management
- `deploy.sh` - Full deployment script
- `monitor.py` - Continuous health monitor with auto-restart