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
    GEMINI_API_KEY,
    GEMINI_MODEL,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OLLAMA_MODEL_FULL,
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    OPENAI_MODEL,
    PORTKEY_API_KEY,
    PORTKEY_BASE_URL,
    PORTKEY_VIRTUAL_KEY,
    _check_ollama,
    _ollama_available,
    _ollama_provider,
    _portkey_enabled,
    get_active_ai_provider,
    limiter,
)
from models import Approval, Employee, Vehicle, Visitor
from utils import db_session, login_required

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
            "portkey_enabled": False,
        })

    if GEMINI_API_KEY:
        return jsonify({
            "available": True,
            "provider": "gemini",
            "model": GEMINI_MODEL,
            "model_full": GEMINI_MODEL,
            "url": "https://generativelanguage.googleapis.com",
            "portkey_enabled": False,
        })

    if OPENAI_API_KEY:
        return jsonify({
            "available": True,
            "provider": "openai",
            "model": OPENAI_MODEL,
            "model_full": OPENAI_MODEL,
            "url": OPENAI_BASE_URL,
            "portkey_enabled": False,
        })

    if _portkey_enabled:
        portkey_ready = session.get("portkey_ready", True)
        return jsonify({
            "available": portkey_ready,
            "provider": "portkey",
            "model": OLLAMA_MODEL,
            "model_full": OLLAMA_MODEL_FULL,
            "url": PORTKEY_BASE_URL,
            "portkey_enabled": _portkey_enabled,
            "portkey_ready": portkey_ready,
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
            "portkey_enabled": False,
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


def _ai_generate(prompt, system_ctx, stream=False, use_full=False):
    """Call active AI provider: Gemini, OpenAI, Portkey, or local Ollama."""
    # 1. Google Gemini Cloud API
    if GEMINI_API_KEY:
        headers = {"Content-Type": "application/json"}
        payload = {
            "systemInstruction": {"parts": [{"text": system_ctx}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        }
        if stream:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:streamGenerateContent?alt=sse&key={GEMINI_API_KEY}"
        else:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"

        resp = requests.post(url, json=payload, headers=headers, stream=stream, timeout=120)
        resp.raise_for_status()
        return resp

    # 2. OpenAI / OpenAI-compatible Cloud API
    if OPENAI_API_KEY:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}",
        }
        payload = {
            "model": OPENAI_MODEL,
            "messages": [
                {"role": "system", "content": system_ctx},
                {"role": "user", "content": prompt},
            ],
            "stream": stream,
        }
        resp = requests.post(
            f"{OPENAI_BASE_URL}/chat/completions",
            json=payload,
            headers=headers,
            stream=stream,
            timeout=120,
        )
        resp.raise_for_status()
        return resp

    # 3. Portkey AI Gateway
    if _portkey_enabled:
        model = OLLAMA_MODEL_FULL if use_full else OLLAMA_MODEL
        headers = {"Content-Type": "application/json"}
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

    # 4. Default: local/remote Ollama endpoint
    model = OLLAMA_MODEL_FULL if use_full else OLLAMA_MODEL
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


# Alias for backwards compatibility
_ollama_generate = _ai_generate


@ai_bp.route("/api/ai/chat", methods=["POST"])
@login_required
@limiter.limit("20 per minute")
def ai_chat():
    """API endpoint for AI chat - returns full response (non-streaming fallback)."""
    if not current_app.config.get("ENABLE_AI_CHAT", True):
        return jsonify({"error": "AI chat is disabled via configuration"}), 403

    cloud_active = bool(GEMINI_API_KEY or OPENAI_API_KEY or _portkey_enabled)
    if not cloud_active:
        import app

        if not _ollama_available:
            app._ollama_checked = False
            _check_ollama()
        if not _ollama_available:
            return jsonify({"error": "AI offline. Configure Cloud API key (GEMINI_API_KEY / OPENAI_API_KEY) or start Ollama."}), 503

    data = request.get_json()
    user_prompt = data.get("prompt", "").strip()
    if not user_prompt:
        return jsonify({"error": "No prompt provided"}), 400

    try:
        resp = _ai_generate(user_prompt, get_system_context(), stream=False)
        result = resp.json()
        if GEMINI_API_KEY:
            candidates = result.get("candidates", [])
            parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
            response_text = parts[0].get("text", "") if parts else ""
        elif OPENAI_API_KEY or _portkey_enabled:
            choices = result.get("choices", [])
            response_text = choices[0].get("message", {}).get("content", "") if choices else ""
        else:
            response_text = result.get("response", "")
        return jsonify({"response": response_text})
    except requests.exceptions.ConnectionError:
        return jsonify(
            {"error": "Cannot reach AI provider. Check Cloud API key or Ollama configuration."}
        ), 503
    except Exception as e:
        return jsonify({"error": f"AI error: {str(e)[:200]}"}), 500


@ai_bp.route("/api/ai/chat/stream", methods=["POST"])
@login_required
@limiter.limit("20 per minute")
def ai_chat_stream():
    """Streaming endpoint for real-time AI chat responses."""
    if not current_app.config.get("ENABLE_AI_CHAT", True):
        return jsonify({"error": "AI chat is disabled via configuration"}), 403

    cloud_active = bool(GEMINI_API_KEY or OPENAI_API_KEY or _portkey_enabled)
    if not cloud_active:
        import app

        if not _ollama_available:
            app._ollama_checked = False
            _check_ollama()
        if not _ollama_available:
            return jsonify({"error": "AI offline. Configure Cloud API key (GEMINI_API_KEY / OPENAI_API_KEY) or start Ollama."}), 503

    data = request.get_json()
    user_prompt = data.get("prompt", "").strip()
    if not user_prompt:
        return jsonify({"error": "No prompt provided"}), 400

    system_context = get_system_context()

    def generate():
        """Generator: stream AI response as SSE data: lines."""
        try:
            resp = _ai_generate(user_prompt, system_context, stream=True)
            if GEMINI_API_KEY:
                # Gemini SSE format
                for line in resp.iter_lines():
                    if line:
                        if line.startswith(b"data: "):
                            line = line[6:]
                        try:
                            chunk = json.loads(line)
                            candidates = chunk.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                if parts:
                                    text = parts[0].get("text", "")
                                    if text:
                                        yield f"data: {text}\n\n"
                        except json.JSONDecodeError:
                            continue
                yield "data: [DONE]\n\n"
            elif OPENAI_API_KEY or _portkey_enabled:
                # OpenAI / Portkey SSE format
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
            yield "data: [ERROR] Cannot reach AI provider. Check Cloud API key or Ollama configuration.\n\n"
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

