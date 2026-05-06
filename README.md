# Mine Management System

![Python](https://img.shields.io/badge/Python-3.12+-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-2.3-green?logo=flask)
![SQLite](https://img.shields.io/badge/SQLite-WAL-lightgrey?logo=sqlite)
![Ollama](https://img.shields.io/badge/AI-Ollama_llama3.2-purple?logo=meta)
![License](https://img.shields.io/badge/License-Proprietary-red)

Real-time mine gate access control, employee/fleet/visitor management, QR code scanning, and AI-powered assistant — optimized for low-power Intel hardware.

---

## Features

- **Gate Access Control** — QR-based entry/exit with medical & induction expiry checks
- **Employee Management** — Full CRUD, certificate tracking, auto-denial on expiry
- **Fleet & Equipment** — Vehicle registration, tracking, QR assignment
- **Visitor Management** — Self-service QR requests, check-in/out, approval workflow
- **AI Assistant** — Ollama-powered chat with system context (CPU-optimized)
- **Real-time Dashboard** — WebGL-accelerated charts, live gate scan feed via WebSocket
- **Emergency Muster** — Instant on-site personnel count from gate logs
- **Mobile Scanner** — Native Android app for Chainway C66 with notification feedback
- **Export** — Excel/PDF reports for employees, visitors, fleet, gate logs

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser (WebGL2 Dashboard)                         │
│  ├── Socket.IO (live updates)                       │
│  └── REST API                                       │
├─────────────────────────────────────────────────────┤
│  Flask App (app.py)                                 │
│  ├── SQLAlchemy ORM + SQLite (WAL mode)            │
│  ├── Flask-SocketIO (real-time events)             │
│  ├── Flask-Compress (gzip)                         │
│  └── Ollama API (local LLM)                        │
├─────────────────────────────────────────────────────┤
│  Ollama (mine-assistant model)                      │
│  └── llama3.2 base + CPU tuning (2 threads)        │
├─────────────────────────────────────────────────────┤
│  Chainway C66 Scanner (Native Android)              │
│  └── OkHttp → /api/scan_qr → JSON response        │
└─────────────────────────────────────────────────────┘
```

---

## Quick Start

```bash
# Clone
git clone <your-repo-url>
cd mine-management-system

# Deploy (creates venv, installs deps, starts Ollama, launches app)
chmod +x deploy-full-server.sh
./deploy-full-server.sh
```

### Manual Start

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start Ollama (if not running)
ollama serve &
ollama create mine-assistant -f Modelfile.mine

# Run app
python app.py
```

**Access:** http://localhost:8080  
**Login:** `admin` / `admin`

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | random | Flask session secret |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `mine-assistant` | Model name for AI chat |
| `HARDWARE_API_KEY` | (built-in) | Scanner device API key |

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/scan_qr` | API Key | QR scan from hardware scanner |
| `POST` | `/api/scan_alt` | None | Alternative scan endpoint |
| `POST` | `/api/c66` | LAN only | Chainway C66 ingest |
| `GET` | `/api/ai/status` | Session | AI engine health |
| `POST` | `/api/ai/chat` | Session | AI chat (non-streaming) |
| `POST` | `/api/ai/chat/stream` | Session | AI chat (SSE stream) |
| `GET` | `/api/dashboard/stats_history` | Session | 7-day sparkline + gate chart data |
| `GET` | `/api/recent_activity` | Session | Last 20 gate scans |

---

## Performance Optimizations

- **SQLite WAL** + 64MB page cache + 256MB mmap
- **Gzip compression** on all responses (flask-compress)
- **Static cache** 12-hour max-age headers
- **WebGL2 charts** — GPU-accelerated sparklines & bar charts (8KB JS, no Chart.js)
- **Ollama CPU tuning** — 2 threads, 2048 context, `num_gpu 0`
- **Consolidated queries** — Dashboard uses 2 queries instead of 9
- **WebSocket stats cache** — 5-second TTL prevents DB thrash

---

## Scanner Native App

Located in `MineGateScannerNative/` — Pure Java + OkHttp, 6.4MB APK.

```bash
cd MineGateScannerNative
./gradlew assembleDebug
# APK at app/build/outputs/apk/debug/app-debug.apk
```

Features background `ScanService` — fires system notifications even when app is on home screen.

---

## Testing

```bash
pip install -r test_requirements.txt
pytest
```

---

## Deployment

The `deploy-full-server.sh` script handles:
1. Kill old processes
2. Configure firewall (ufw/iptables)
3. Create/sync virtualenv
4. Syntax + import validation
5. Start Ollama + build `mine-assistant` model
6. Launch Flask + monitor + log viewer in tmux
7. Wait for server, open browser

---

## License

Proprietary — All rights reserved.
