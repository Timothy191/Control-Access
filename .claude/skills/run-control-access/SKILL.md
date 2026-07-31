---
name: run-control-access
description: Build, launch, and screenshot the Arch-System / Control-Access Flask web app. Provides a Puppeteer driver that starts the app, logs in as admin, and captures the dashboard.
---

# Run Arch-System (Control-Access)

A Flask + SQLAlchemy mine access-control web app running on port `8080`. The
programmatic way to drive it is the Node/Puppeteer driver in this skill: it
spawns the app from a Python venv, waits for `/login`, logs in, and takes a
dashboard screenshot.

All commands below were verified in this container.

## Prerequisites

- Python 3.12+ and a way to create a venv (`python3 -m venv` or `uv`)
- Node.js 18+ and `npm`
- Chromium (`/usr/bin/chromium`); set `CHROMIUM_BIN` if it lives elsewhere
- SQLite is used by the app (no external DB)

On a fresh Ubuntu machine:

```bash
sudo apt-get update
sudo apt-get install -y chromium nodejs npm python3-venv
```

(Verified with `chromium` from `/usr/bin/chromium`.)

## Build

Create the venv and install Python dependencies. The app also supports `uv` if
available.

```bash
cd /home/timothy/Desktop/Control-Access
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -r test_requirements.txt
```

Then install the skill's Node driver:

```bash
cd .claude/skills/run-control-access
npm install
cd ../..
```

## Run (agent path)

Use the driver. It starts `python app.py` from `CA_APP_DIR`, waits for the
login page, logs in as `admin` / `admin`, and saves a screenshot.

```bash
cd /home/timothy/Desktop/Control-Access
node .claude/skills/run-control-access/driver.mjs
```

Output:

```text
Starting app from /home/timothy/Desktop/Control-Access with /home/timothy/Desktop/Control-Access/.venv/bin/python
App ready at http://localhost:8080
Logging in as admin...
Login succeeded: Dashboard at http://localhost:8080/dashboard
Screenshot saved: /home/timothy/Desktop/Control-Access/control-access-dashboard.png
```

The driver exits cleanly and stops the Flask process.

### Driver configuration (env vars)

| Variable | Default | Purpose |
| --- | --- | --- |
| `CA_APP_DIR` | `cwd()` | Absolute path to the project root |
| `CA_PYTHON` | auto (`.venv/bin/python`) | Python binary to run `app.py` |
| `CA_PORT` | `8080` | Port to wait on |
| `CA_HOST` | `localhost` | Host to wait on |
| `CA_USER` / `CA_PASS` | `admin` / `admin` | Login credentials |
| `CA_SCREENSHOT` | `control-access-dashboard.png` (under `CA_APP_DIR`) | Screenshot path |
| `CA_LOG` | `/tmp/control-access-driver.log` | App stdout/stderr log |
| `CHROMIUM_BIN` | `/usr/bin/chromium` | Chromium executable |

Example with a custom screenshot path:

```bash
CA_SCREENSHOT=/tmp/ca-smoke.png node .claude/skills/run-control-access/driver.mjs
```

## Run (human path)

```bash
cd /home/timothy/Desktop/Control-Access
source .venv/bin/activate
ENABLE_AI_CHAT=false python app.py
```

Open `http://localhost:8080` and log in as `admin` / `admin`. Not useful in a
headless container.

## Test

```bash
cd /home/timothy/Desktop/Control-Access
source .venv/bin/activate
pytest --tb=short -q
```

## API smoke

The `/api/scan_qr` endpoint is protected by `X-API-Key` and needs
`HARDWARE_API_KEY` configured, so an out-of-the-box `curl` won't work without
setting it first. The driver covers the primary web UI path; to smoke the API,
set a key in `.env` or inline:

```bash
export HARDWARE_API_KEY=local-test-key-1234
python app.py &
curl -s -X POST http://localhost:8080/api/scan_qr \
  -H 'X-API-Key: local-test-key-1234' \
  -H 'Content-Type: application/json' \
  -d '{"qr_code":"TEST","direction":"IN","gate_location":"Main Gate"}'
```

## Gotchas

- The app tries to contact a local Ollama instance on startup. In a clean test
  environment this fails or complains about a missing model. The driver sets
  `ENABLE_AI_CHAT=false` automatically so the app starts without Ollama.
- `app.py` hard-codes port `8080` in its `socketio.run()` call (line 4715), but
  it dynamically picks an alternate scanner port (8081 by default). If 8080 is
  busy, the app still starts on 8080 because of the hard-coded `port=8080`, so
  make sure nothing else is using it.
- `eventlet.monkey_patch()` prints a non-fatal warning about RLocks not being
  greened. This is normal and does not block the app.
- The app resets the admin password to `ADMIN_PASSWORD` (default `admin`) on
  every startup, so `admin`/`admin` always works.
- Web routes require CSRF tokens; API routes do not. The driver uses the real
  login form, so it does not need to manage CSRF manually.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Chromium executable not found` | `sudo apt-get install chromium` or set `CHROMIUM_BIN` |
| `App did not become ready` | Check `CA_LOG` for import errors; usually a missing Python dep |
| Screenshot is blank/white | Increase `CA_TIMEOUT` and make sure the dashboard template renders without raising |
| Login ends back at `/login` | Credentials are wrong; verify `CA_USER`/`CA_PASS` and that the admin user exists |
