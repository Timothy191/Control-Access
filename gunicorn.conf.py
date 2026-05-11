# Gunicorn configuration for production deployment
# Start with: gunicorn -c gunicorn.conf.py "app:app"
# For SocketIO support: gunicorn -c gunicorn.conf.py "app:app" -k eventlet

import os

# Worker type — eventlet required for Flask-SocketIO
worker_class = "eventlet"

# Number of worker processes (1 required for SocketIO in-memory state)
workers = 1

# Number of eventlet greenlets per worker
worker_connections = 1000

# Bind address
bind = os.environ.get("GUNICORN_BIND", "0.0.0.0:8080")

# Timeout (seconds) — increase for slow Ollama AI responses
timeout = 120
keepalive = 5

# Logging
accesslog = os.environ.get("LOG_FILE", "-")   # "-" = stdout
errorlog = os.environ.get("LOG_FILE", "-")
loglevel = os.environ.get("LOG_LEVEL", "info").lower()
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Process name
proc_name = "mine-management"

# Graceful timeout for in-flight requests on shutdown
graceful_timeout = 30

# Preload app (saves memory, but prevents hot-reload)
preload_app = False
