# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mine management system built with Flask, SQLAlchemy, and SocketIO. Manages employees, vehicles, visitors, gate access control with QR codes, and includes an AI chat assistant.

## Commands

```bash
# Run the application
python app.py

# The app runs on http://localhost:5000
# Default credentials: admin / admin

# Run tests
pytest

# Run a single test file
pytest tests/test_auth.py

# Run tests with coverage
pytest --cov=app --cov-report=html
```

## Architecture

**Core Files:**
- `app.py` - Main Flask application with all routes (CRUD for employees/vehicles/visitors, approvals, QR generation, gate scanner API, AI chat)
- `models.py` - SQLAlchemy models: User, Employee, Vehicle, Visitor, GateLog, Approval, Device
- `database.py` - Database setup with SQLite, session management, auto-creates admin user

**Key Features:**
- Role-based access control (admin, manager, security, user)
- Real-time updates via WebSocket (SocketIO)
- QR code generation/scanning for access control
- Hardware integration via `/api/scan_qr` endpoint (requires `X-API-Key` header)
- Excel export for employees, visitors, fleet, and gate logs
- AI chat assistant using Google Gemini API

**Database:** SQLite at `mine_management.db` (created automatically)

**Templates:** Jinja2 templates in `templates/` directory

**API Authentication:**
- Web routes: Session-based authentication (login required)
- `/api/scan_qr` endpoint: API key authentication via `X-API-Key` header

**Role Permissions:**
- admin: Full access
- manager: View/dashboard access
- security: QR scanning and gate log access
- user: Basic access

## Dependencies

Install with: `pip install -r requirements.txt`
