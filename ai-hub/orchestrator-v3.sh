#!/bin/bash
# AI Hub Orchestrator v3.0 - Complete System
# Includes Hugging Face, GitHub Models, Docker, CLI Tools

export AI_HUB="$HOME/ai-hub"
export PATH="$AI_HUB/scripts:$PATH"

echo "
╔═══════════════════════════════════════════════════════════════╗
║          AI HUB v3.0 - Terminal AI Orchestrator               ║
║          (c) 2026 - System Administrator                     ║
╠═══════════════════════════════════════════════════════════════╣
"

list_all() {
  echo "
AVAILABLE ASSISTANTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[A] CLI AI TOOLS (npm/pip)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 1. opencode      - AI coding agent (already on system)
 2. kilocode      - Kilo CLI (@kilocode/cli)
 3. claude-code   - Anthropic Claude Code
 4. paws          - Paws AI terminal assistant
 5. llxprt-code   - Multi-provider AI CLI
 6. aider         - AI pair programming
 7. mini-swe-agent - GitHub issue solver (100 lines!)

[B] HUGGING FACE SMALL MODELS (llama.cpp / transformers)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 8. smollm2-135M  - HuggingFaceTB/SmolLM2-135M (135M params)
 9. smollm2-360M - HuggingFaceTB/SmolLM2-360M (360M params)  
10. smollm2-1.7B - HuggingFaceTB/SmolLM2-1.7B (1.7B params)
11. phi4-mini     - Microsoft Phi-4 (small, coding capable)
12. gemma3-1b     - Google Gemma 3 (1B params)
13. qwen3-0.5B    - Qwen 3 (0.5B params, very fast)
14. falcon-h1-tiny - Falcon H1 Tiny (extremely small)

[C] GITHUB AI MODELS (from repos)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. swe-agent-mini   - mini-swe-agent (GitHub issue solver)
16. copilot-ralph   - Copilot-Ralph (autonomous coding agent)

[D] DOCKER AI CONTAINERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
17. docker-ollama     - Ollama in Docker
18. docker-openwebui  - Open WebUI for Ollama
19. docker-lm-studio  - LM Studio Docker
20. docker-textgen-webui - Text Generation WebUI

[E] SYSTEM COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
21. hf-download    - Download HF model
22. docker-pull    - Pull Docker image
23. assist-all     - Run all assistants
24. status         - Show system status

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"
}

run_tool() {
  local id="$1"
  shift
  echo "→ Launching: $id"
  case "$id" in
    1|opencode) opencode "$@" ;;
    2|kilocode) npx -y @kilocode/cli "$@" ;;
    3|claude-code) npx -y @anthropic-ai/claude-code "$@" ;;
    4|paws) npx -y pawscode@latest "$@" ;;
    5|llxprt-code) npx -y llxprt-code "$@" ;;
    6|aider) pip install -q aider-chat && aider-chat "$@" ;;
    7|mini-swe-agent) 
      git clone https://github.com/SWE-agent/mini-swe-agent.git "$AI_HUB/assistants/mini-swe-agent" 2>/dev/null
      cd "$AI_HUB/assistants/mini-swe-agent" && python -m swe_agent.run "$@" ;;
    8|smollm2-135M) 
      echo "Model: HuggingFaceTB/SmolLM2-135M"
      echo "Run: python -c \"from transformers import AutoModelForCausalLM, AutoTokenizer; tok = AutoTokenizer.from_pretrained('HuggingFaceTB/SmolLM2-135M'); model = AutoModelForCausalLM.from_pretrained('HuggingFaceTB/SmolLM2-135M')\"" ;;
    9|smollm2-360M) echo "HuggingFaceTB/SmolLM2-360M - Run with llama.cpp or transformers" ;;
    10|smollm2-1.7B) echo "HuggingFaceTB/SmolLM2-1.7B - Needs 4GB+ RAM" ;;
    11|phi4-mini) echo "Microsoft/Phi-4-mini - Run with llama.cpp" ;;
    12|gemma3-1b) echo "google/gemma-3-1b-it - Run with llama.cpp" ;;
    13|qwen3-0.5B) echo "Qwen/Qwen3-0.5B - Very fast, 1GB RAM" ;;
    14|falcon-h1-tiny) echo "tiiuae/falcon-h1-tiny - Extremely small" ;;
    15|swe-agent-mini) run_tool 7 "$@" ;;
    16|copilot-ralph) 
      git clone https://github.com/niittymaa/Copilot-Ralph.git "$AI_HUB/assistants/copilot-ralph" 2>/dev/null
      echo "See: $AI_HUB/assistants/copilot-ralph" ;;
    17|docker-ollama) docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama ;;
    18|docker-openwebui) docker run -d -p 3000:8080 -v open-webui:/app/backend/data --name open-webui ghcr.io/open-webui/open-webui:main ;;
    19|docker-lm-studio) echo "No official LM Studio Docker - use Docker Desktop" ;;
    20|docker-textgen-webui) docker run -d -p 7860:7860 -v weights:/app/nomicai textgen-webui ;;
    21|hf-download) echo "Usage: huggingface-cli download <model-id>" ;;
    22|docker-pull) docker pull "$@" ;;
    23|docker-install) 
      echo "Installing Docker on Kali Linux..."
      curl -fsSL https://get.docker.com | sh 2>/dev/null || echo "Try: sudo apt update && sudo apt install docker.io" ;;
    24|assist-all) echo "Running all assistants..." ;;
    25|status)
      echo "=== AI Hub Status ==="
      echo "Hub: $AI_HUB"
      echo "Docker: $(which docker 2>/dev/null || echo 'NOT INSTALLED')"
      echo "OpenCode: $(which opencode 2>/dev/null || echo 'NOT FOUND')"
      ;;
    *) echo "Unknown: $id" ;;
  esac
}

if [ -z "$1" ]; then
  list_all
else
  run_tool "$@"
fi
