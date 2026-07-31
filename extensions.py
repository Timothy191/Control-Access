"""Flask extensions and shared state to avoid circular imports."""
import logging
import os
from collections import deque

import requests
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_socketio import SocketIO

# Application version
__version__ = "2.1.0"

# Rate limiter - will be initialized with app in app.py
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="memory://",
    default_limits=["200 per day", "50 per hour"]
)

# SocketIO instance - will be initialized with app in app.py
socketio = SocketIO()

# Logger
logger = logging.getLogger("mine_system")

# AI Chat configuration
ENABLE_AI_CHAT = os.environ.get("ENABLE_AI_CHAT", "true").lower() == "true"

# Ollama configuration (will be initialized in app.py)
OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "mine-assistant-fast"
OLLAMA_MODEL_FULL = "mine-assistant"
_ollama_provider = "local"
_ollama_available = False
_ollama_checked = False

# Portkey configuration (AI gateway for routing all cached tokens)
PORTKEY_API_KEY = os.environ.get("PORTKEY_API_KEY", "")
PORTKEY_BASE_URL = os.environ.get("PORTKEY_BASE_URL", "https://api.portkey.ai/v1")
PORTKEY_VIRTUAL_KEY = os.environ.get("PORTKEY_VIRTUAL_KEY", "")
_portkey_enabled = bool(PORTKEY_API_KEY)


def init_ollama_config(base_url, model, model_full, provider, available):
    """Initialize Ollama configuration. Called from app.py."""
    global OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_MODEL_FULL, _ollama_provider, _ollama_available
    OLLAMA_BASE_URL = base_url
    OLLAMA_MODEL = model
    OLLAMA_MODEL_FULL = model_full
    _ollama_provider = provider
    _ollama_available = available


def init_portkey_config(api_key, base_url, virtual_key):
    """Initialize Portkey configuration. Called from app.py.

    When enabled, all AI requests (including cached tokens) are routed
    through Portkey's AI gateway.
    """
    global PORTKEY_API_KEY, PORTKEY_BASE_URL, PORTKEY_VIRTUAL_KEY, _portkey_enabled
    PORTKEY_API_KEY = api_key
    PORTKEY_BASE_URL = base_url
    PORTKEY_VIRTUAL_KEY = virtual_key
    _portkey_enabled = bool(api_key)


def _check_ollama():
    """Check Ollama local availability (100% free local endpoint)."""
    global _ollama_available, _ollama_checked, _ollama_provider
    if _ollama_checked:
        return _ollama_available
    _ollama_checked = True

    if not ENABLE_AI_CHAT:
        _ollama_available = False
        _ollama_provider = "disabled"
        print("AI Assistant feature is disabled via ENABLE_AI_CHAT=false")
        return False

    try:
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        if resp.status_code == 200:
            _models = [m["name"] for m in resp.json().get("models", [])]
            if any(OLLAMA_MODEL in m for m in _models):
                _ollama_provider = "local"
                _ollama_available = True
                print(
                    f"Ollama local AI initialized (free endpoint): model={OLLAMA_MODEL}, url={OLLAMA_BASE_URL}"
                )
            else:
                print(
                    f"WARNING: Ollama running but model '{OLLAMA_MODEL}' not found. Available: {_models}"
                )
    except Exception as _ollama_err:
        print(
            f"WARNING: Ollama not reachable ({type(_ollama_err).__name__}: {_ollama_err}). AI is offline."
        )
    return _ollama_available


# Monitoring and metrics
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

# In-memory metrics storage for monitoring (resets on restart)
metrics_history = {
    "cpu": deque(maxlen=60),
    "memory": deque(maxlen=60),
    "requests": deque(maxlen=60),
    "timestamps": deque(maxlen=60),
    "endpoints": {},
    "scan_stats": {"total": 0, "granted": 0, "denied": 0, "in": 0, "out": 0},
    "recent_logs": deque(maxlen=50),
}

# Track request counts for rate calculation
request_timestamps = deque(maxlen=1000)


def parse_log_line(line):
    """Parse a log line into structured format."""
    import re
    result = {"raw": line, "type": "info", "timestamp": "", "message": line}

    # Try to extract timestamp
    ts_match = re.match(r"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})", line)
    if ts_match:
        result["timestamp"] = ts_match.group(1)

    # Determine log type
    if "ERROR" in line or "Exception" in line or "CRITICAL" in line:
        result["type"] = "error"
    elif "WARNING" in line or "WARN" in line:
        result["type"] = "warning"
    elif "SCAN" in line or "/api/scan_qr" in line:
        result["type"] = "scan"
        if "granted: True" in line or '"granted": true' in line.lower():
            result["status"] = "granted"
        elif "granted: False" in line or '"granted": false' in line.lower():
            result["status"] = "denied"
    elif any(method in line for method in ["GET", "POST", "PUT", "DELETE"]):
        result["type"] = "http"
        # Extract HTTP method and status
        http_match = re.search(
            r'"(GET|POST|PUT|DELETE|PATCH) ([^ ]+)[^"]*" (\d{3})', line
        )
        if http_match:
            result["method"] = http_match.group(1)
            result["path"] = http_match.group(2)
            result["status_code"] = int(http_match.group(3))

    return result


__all__ = [
    "__version__",
    "limiter",
    "socketio",
    "logger",
    "ENABLE_AI_CHAT",
    "OLLAMA_BASE_URL",
    "OLLAMA_MODEL",
    "OLLAMA_MODEL_FULL",
    "_ollama_provider",
    "_ollama_available",
    "_ollama_checked",
    "init_ollama_config",
    "_check_ollama",
    "PORTKEY_API_KEY",
    "PORTKEY_BASE_URL",
    "PORTKEY_VIRTUAL_KEY",
    "_portkey_enabled",
    "init_portkey_config",
    "PSUTIL_AVAILABLE",
    "metrics_history",
    "request_timestamps",
    "parse_log_line",
]
