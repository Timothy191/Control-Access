# Deployment Checklist

This checklist covers required environment variables and configuration for production deployment.

## Required Environment Variables

### Critical (Application will not start without these)

- **`SECRET_KEY`** (min 32 characters)
  - Used for session encryption and CSRF protection
  - Generate with: `python -c "import secrets; print(secrets.token_hex(32))"`
  - Must be set in production (app will refuse to start otherwise)

- **`HARDWARE_API_KEY`** (min 16 characters)
  - Used for hardware device authentication (QR scanners, gate controllers)
  - Generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
  - Must be set in production (app will refuse to start otherwise)
  - Pass to hardware via `X-API-Key` header

### Recommended

- **`FLASK_ENV`** (default: `production`)
  - Set to `production` for production deployments
  - Set to `development` for local development
  - Controls security strictness and debug mode

- **`HTTPS`** (default: `false`)
  - Set to `true` if behind HTTPS termination (nginx, load balancer)
  - Enables `Secure` flag on session cookies

- **`CORS_ORIGINS`** (default: `*`)
  - Comma-separated list of allowed CORS origins
  - Example: `https://app.example.com,https://admin.example.com`
  - **Must be restricted in production** (default allows all origins)

- **`REDIS_URL`** (optional)
  - Redis connection string for rate limiting and session storage
  - Example: `redis://localhost:6379/0`
  - Required for multi-worker deployments (in-memory rate limiting doesn't share state)

### Optional

- **`ADMIN_PASSWORD`** (default: `admin`)
  - Initial admin user password (auto-created on first run)
  - **Change immediately after first login**
  - Admin password is reset to this value on every app restart

- **`LOG_FILE`** (optional)
  - Path to log file (e.g., `/var/log/control-access/app.log`)
  - If not set, logs to stdout only

- **`LOG_LEVEL`** (default: `INFO`)
  - Logging level: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`

- **`ENABLE_AI_CHAT`** (default: `false`)
  - Set to `true` to enable AI chat features
  - Requires Ollama or cloud AI configuration

- **`OLLAMA_USE_CLOUD`** (default: `false`)
  - Set to `true` to use Ollama Cloud instead of local Ollama

## Pre-Deployment Checklist

- [ ] Set `SECRET_KEY` (min 32 chars)
- [ ] Set `HARDWARE_API_KEY` (min 16 chars)
- [ ] Set `FLASK_ENV=production`
- [ ] Set `HTTPS=true` if using HTTPS
- [ ] Restrict `CORS_ORIGINS` to specific domains
- [ ] Configure `REDIS_URL` if using multiple gunicorn workers
- [ ] Change default admin password after first login
- [ ] Set up log rotation if using `LOG_FILE`
- [ ] Verify firewall rules (only expose port 8080 or reverse proxy port)
- [ ] Enable HTTPS termination (nginx/caddy/load balancer)
- [ ] Set up database backups (SQLite: `mine_management.db`)

## Gunicorn Configuration

Production uses `gunicorn.conf.py` with:
- **1 worker** (required for Flask-SocketIO in-memory state)
- Bind to `0.0.0.0:8080`
- Increase workers only if using Redis message queue

Start with:
```bash
gunicorn -c gunicorn.conf.py -b 0.0.0.0:8080 app:app
```

## Docker Deployment

Docker image uses gunicorn automatically:
```bash
docker build -t control-access .
docker run -p 8080:8080 \
  -e SECRET_KEY=your-secret-key \
  -e HARDWARE_API_KEY=your-api-key \
  -e FLASK_ENV=production \
  control-access
```

## Security Headers

The app sets these headers automatically:
- `Content-Security-Policy` - Restricts resource loading
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `Strict-Transport-Security` - Enforces HTTPS (when `HTTPS=true`)

## Database

- **SQLite** (default): `mine_management.db` (auto-created)
- WAL mode enabled for concurrent reads
- Back up regularly: `cp mine_management.db mine_management.db.backup`

## Troubleshooting

**App won't start:**
- Check `SECRET_KEY` and `HARDWARE_API_KEY` are set
- Check `FLASK_ENV` is set correctly
- Review logs for specific error messages

**API authentication failing:**
- Verify `HARDWARE_API_KEY` matches between app and hardware
- Check `X-API-Key` header is being sent

**Rate limiting not working across workers:**
- Set `REDIS_URL` to shared Redis instance
- Restart app after setting Redis URL
