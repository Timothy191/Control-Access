"""AI chat and assistant routes."""
import json

import requests
from flask import (
    Blueprint,
    Response,
    abort,
    current_app,
    jsonify,
    render_template,
    request,
    session,
)

from app import (
    OLLAMA_BASE_URL,
    OLLAMA_CLOUD_API_KEY,
    OLLAMA_CLOUD_URL,
    OLLAMA_MODEL,
    OLLAMA_MODEL_FULL,
    _check_ollama,
    _ollama_available,
    _ollama_provider,
    db_session,
    limiter,
    login_required,
)
from models import Approval, Employee, Vehicle, Visitor

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/api/ai/status")
@login_required
def ai_status():
    """Return AI engine availability and model info."""
    if not current_app.config.get("ENABLE_AI_CHAT", True):
        return jsonify({
            "available": False,
            "provider": "disabled",
            "model": "",
            "model_full": "",
            "url": "",
        })

    import app

    if not _ollama_available:
        app._ollama_checked = False
        _check_ollama()
    return jsonify(
        {
            "available": _ollama_available,
            "provider": _ollama_provider,
            "model": OLLAMA_MODEL,
            "model_full": OLLAMA_MODEL_FULL,
            "url": OLLAMA_CLOUD_URL if _ollama_provider == "cloud" else OLLAMA_BASE_URL,
        }
    )


@ai_bp.route("/ai/chat")
@login_required
def ai_chat_page():
    """Render the AI chat interface."""
    if not current_app.config.get("ENABLE_AI_CHAT", True):
        abort(403)
    return render_template("chat.html")


def get_system_context():
    """Build system context with live data for the AI assistant."""
    stats = {
        "employees": db_session.query(Employee).count(),
        "vehicles": db_session.query(Vehicle).count(),
        "visitors": db_session.query(Visitor).filter_by(status="Checked In").count(),
        "pending_approvals": db_session.query(Approval)
        .filter_by(status="Pending")
        .count(),
    }
    return (
        f"You are a helpful assistant for an Arch-System site management platform. "
        f"The current user is {session.get('username')} with role {session.get('role')}. "
        f"Current system stats: Employees={stats['employees']}, Vehicles={stats['vehicles']}, "
        f"Active Visitors={stats['visitors']}, Pending Approvals={stats['pending_approvals']}. "
        f"Answer questions concisely and help with site operations."
    )


def _ollama_generate(prompt, system_ctx, stream=False, use_full=False):
    """Call Ollama AI — routes to cloud or local based on provider.
    use_full=True selects the 3B model for complex analysis."""
    model = OLLAMA_MODEL_FULL if use_full else OLLAMA_MODEL

    if _ollama_provider == "cloud":
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_ctx},
                {"role": "user", "content": prompt},
            ],
            "stream": stream,
        }
        resp = requests.post(
            f"{OLLAMA_CLOUD_URL}/chat",
            headers={
                "Authorization": f"Bearer {OLLAMA_CLOUD_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            stream=stream,
            timeout=120,
        )
    else:
        payload = {
            "model": model,
            "prompt": prompt,
            "system": system_ctx,
            "stream": stream,
            "keep_alive": "10m",
        }
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=payload,
            stream=stream,
            timeout=120,
        )
    resp.raise_for_status()
    return resp


@ai_bp.route("/api/ai/chat", methods=["POST"])
@login_required
@limiter.limit("20 per minute")
def ai_chat():
    """API endpoint for AI chat - returns full response (non-streaming fallback)."""
    if not current_app.config.get("ENABLE_AI_CHAT", True):
        return jsonify({"error": "AI chat is disabled via configuration"}), 403

    import app

    if not _ollama_available:
        app._ollama_checked = False  # Allow re-check
        _check_ollama()
    if not _ollama_available:
        return jsonify({"error": "AI offline. Start Ollama with: ollama serve"}), 503

    data = request.get_json()
    user_prompt = data.get("prompt", "").strip()
    if not user_prompt:
        return jsonify({"error": "No prompt provided"}), 400

    try:
        resp = _ollama_generate(user_prompt, get_system_context(), stream=False)
        result = resp.json()
        if _ollama_provider == "cloud":
            return jsonify({"response": result.get("message", {}).get("content", "")})
        return jsonify({"response": result.get("response", "")})
    except requests.exceptions.ConnectionError:
        return jsonify(
            {"error": "Cannot reach Ollama. Is it running? (ollama serve)"}
        ), 503
    except Exception as e:
        return jsonify({"error": f"AI error: {str(e)[:200]}"}), 500


@ai_bp.route("/api/ai/chat/stream", methods=["POST"])
@login_required
@limiter.limit("20 per minute")
def ai_chat_stream():
    """Streaming endpoint for real-time AI chat responses via Ollama."""
    if not current_app.config.get("ENABLE_AI_CHAT", True):
        return jsonify({"error": "AI chat is disabled via configuration"}), 403

    import app

    if not _ollama_available:
        app._ollama_checked = False  # Allow re-check
        _check_ollama()
    if not _ollama_available:
        return jsonify({"error": "AI offline. Start Ollama with: ollama serve"}), 503

    data = request.get_json()
    user_prompt = data.get("prompt", "").strip()
    if not user_prompt:
        return jsonify({"error": "No prompt provided"}), 400

    # Capture context before entering generator (session not available inside)
    system_context = get_system_context()

    def generate():
        """Generator: stream Ollama NDJSON → SSE data: lines."""
        try:
            resp = _ollama_generate(user_prompt, system_context, stream=True)
            for line in resp.iter_lines():
                if line:
                    chunk = json.loads(line)
                    if _ollama_provider == "cloud":
                        text = chunk.get("message", {}).get("content", "")
                    else:
                        text = chunk.get("response", "")
                    if text:
                        yield f"data: {text}\n\n"
                    if chunk.get("done"):
                        break
            yield "data: [DONE]\n\n"
        except requests.exceptions.ConnectionError:
            yield "data: [ERROR] Cannot reach Ollama. Is it running?\n\n"
        except Exception as e:
            yield f"data: [ERROR] AI error: {str(e)[:200]}\n\n"

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
