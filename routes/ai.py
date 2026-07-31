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

from extensions import (
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OLLAMA_MODEL_FULL,
    PORTKEY_API_KEY,
    PORTKEY_BASE_URL,
    PORTKEY_VIRTUAL_KEY,
    _check_ollama,
    _ollama_available,
    _ollama_provider,
    _portkey_enabled,
    limiter,
)
from models import Approval, Employee, Vehicle, Visitor
from utils import db_session, login_required

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/api/ai/status")
@login_required
def ai_status():
    """Return AI engine availability and model info.

    Reports Portkey gateway status when enabled, otherwise local Ollama.
    """
    if not current_app.config.get("ENABLE_AI_CHAT", True):
        return jsonify({
            "available": False,
            "provider": "disabled",
            "model": "",
            "model_full": "",
            "url": "",
            "portkey_enabled": _portkey_enabled,
        })

    if _portkey_enabled:
        # Portkey is the active provider - all cached tokens route through it
        return jsonify({
            "available": True,
            "provider": "portkey",
            "model": OLLAMA_MODEL,
            "model_full": OLLAMA_MODEL_FULL,
            "url": PORTKEY_BASE_URL,
            "portkey_enabled": _portkey_enabled,
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
            "url": OLLAMA_BASE_URL,
            "portkey_enabled": _portkey_enabled,
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
    """Call AI provider — routes through Portkey when enabled, otherwise local Ollama.

    When PORTKEY_API_KEY is set, ALL requests (including cached tokens) are sent
    to Portkey's AI gateway. This ensures centralized observability, caching, and
    routing for all AI traffic.

    use_full=True selects the larger model for complex analysis.
    """
    model = OLLAMA_MODEL_FULL if use_full else OLLAMA_MODEL

    if _portkey_enabled:
        # Route through Portkey AI gateway — all cached tokens go here
        # Portkey uses x-portkey-api-key header for authentication (not Bearer tokens)
        headers = {
            "Content-Type": "application/json",
        }
        # Portkey authentication: use virtual key if provided, otherwise API key
        if PORTKEY_VIRTUAL_KEY:
            headers["x-portkey-api-key"] = PORTKEY_VIRTUAL_KEY
        else:
            headers["x-portkey-api-key"] = PORTKEY_API_KEY

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_ctx},
                {"role": "user", "content": prompt},
            ],
            "stream": stream,
        }
        resp = requests.post(
            f"{PORTKEY_BASE_URL}/chat/completions",
            json=payload,
            headers=headers,
            stream=stream,
            timeout=120,
        )
        resp.raise_for_status()
        return resp

    # Default: local Ollama endpoint (100% free)
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
    """API endpoint for AI chat - returns full response (non-streaming fallback).

    Routes through Portkey when enabled, otherwise uses local Ollama.
    """
    if not current_app.config.get("ENABLE_AI_CHAT", True):
        return jsonify({"error": "AI chat is disabled via configuration"}), 403

    # When Portkey is enabled, we don't need local Ollama to be available
    if not _portkey_enabled:
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
        if _portkey_enabled:
            # Portkey/OpenAI-compatible response format
            choices = result.get("choices", [])
            response_text = choices[0].get("message", {}).get("content", "") if choices else ""
        else:
            # Ollama response format
            response_text = result.get("response", "")
        return jsonify({"response": response_text})
    except requests.exceptions.ConnectionError:
        return jsonify(
            {"error": "Cannot reach AI provider. Check Portkey/Ollama configuration."}
        ), 503
    except Exception as e:
        return jsonify({"error": f"AI error: {str(e)[:200]}"}), 500


@ai_bp.route("/api/ai/chat/stream", methods=["POST"])
@login_required
@limiter.limit("20 per minute")
def ai_chat_stream():
    """Streaming endpoint for real-time AI chat responses.

    Routes through Portkey when enabled, otherwise uses local Ollama.
    All cached tokens are sent to Portkey when configured.
    """
    if not current_app.config.get("ENABLE_AI_CHAT", True):
        return jsonify({"error": "AI chat is disabled via configuration"}), 403

    # When Portkey is enabled, we don't need local Ollama to be available
    if not _portkey_enabled:
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
        """Generator: stream AI response as SSE data: lines.

        Handles both Portkey/OpenAI-compatible SSE format and Ollama NDJSON format.
        """
        try:
            resp = _ollama_generate(user_prompt, system_context, stream=True)
            if _portkey_enabled:
                # Portkey/OpenAI-compatible: SSE with "data: {...}" lines
                for line in resp.iter_lines():
                    if line:
                        if line.startswith(b"data: "):
                            line = line[6:]
                        if line.strip() == b"[DONE]":
                            break
                        try:
                            chunk = json.loads(line)
                            choices = chunk.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                text = delta.get("content", "")
                                if text:
                                    yield f"data: {text}\n\n"
                        except json.JSONDecodeError:
                            continue
                yield "data: [DONE]\n\n"
            else:
                # Ollama NDJSON format
                for line in resp.iter_lines():
                    if line:
                        chunk = json.loads(line)
                        text = chunk.get("response", "")
                        if text:
                            yield f"data: {text}\n\n"
                        if chunk.get("done"):
                            break
                yield "data: [DONE]\n\n"
        except requests.exceptions.ConnectionError:
            yield "data: [ERROR] Cannot reach AI provider. Check Portkey/Ollama configuration.\n\n"
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
