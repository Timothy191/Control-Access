#!/bin/bash
# AI Hub Orchestrator v2.0
# Full orchestration system for all AI assistants

export AI_HUB="$HOME/ai-hub"
export PATH="$AI_HUB/scripts:$PATH"

echo "
╔═══════════════════════════════════════════════════════════════╗
║              AI HUB - Terminal AI Orchestrator               ║
║              (c) 2026 - System Administrator                 ║
╠═══════════════════════════════════════════════════════════════╣
"

list_assistants() {
  echo "
Available Assistants:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[CLI Tools]              [Ollama Local Models]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 1. kilocode             6. ollama-launch-pi
 2. claude-code          7. ollama-launch-codex  
 3. paws                 8. ollama-launch-droid
 4. llxprt-code          9. ollama-launch-openclaw
 5. aider
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"
}

run_assistant() {
  local name="$1"
  shift
  echo "→ Running: $name"
  case "$name" in
    1|kilocode) npm exec -y @kilocode/cli -- "$@" 2>/dev/null || echo "Kilo: Install with npm" ;;
    2|claude-code) npx -y @anthropic-ai/claude-code "$@" 2>/dev/null || echo "Claude Code: Not installed" ;;
    3|paws) npx -y pawscode@latest "$@" 2>/dev/null || echo "Paws: Not installed" ;;
    4|llxprt-code) npx -y llxprt-code "$@" 2>/dev/null || echo "llxprt-code: Not installed" ;;
    5|aider) pip install -q aider-chat && aider-chat "$@" 2>/dev/null || echo "Aider: Install with pip" ;;
    6|ollama-launch-pi) ollama run pi "$@" 2>/dev/null || echo "Ollama: Not installed" ;;
    7|ollama-launch-codex) ollama run codex "$@" 2>/dev/null || echo "Ollama: Not installed" ;;
    8|ollama-launch-droid) ollama run droid "$@" 2>/dev/null || echo "Ollama: Not installed" ;;
    9|ollama-launch-openclaw) ollama run openclaw "$@" 2>/dev/null || echo "Ollama: Not installed" ;;
    *) echo "Unknown assistant: $name" ;;
  esac
}

assist-all() {
  echo "=== Consulting ALL AI Assistants ==="
  for i in {1..9}; do
    case $i in
      1) echo -e "\n[1/9] Kilo CLI..." ;;
      2) echo -e "\n[2/9] Claude Code..." ;;
      3) echo -e "\n[3/9] Paws..." ;;
      4) echo -e "\n[4/9] llxprt-code..." ;;
      5) echo -e "\n[5/9] Aider..." ;;
      6) echo -e "\n[6/9] Ollama Pi..." ;;
      7) echo -e "\n[7/9] Ollama Codex..." ;;
      8) echo -e "\n[8/9] Ollama Droid..." ;;
      9) echo -e "\n[9/9] Ollama OpenClaw..." ;;
    esac
  done
  echo -e "\n=== All assistants consulted ==="
}

if [ -z "$1" ]; then
  list_assistants
else
  case "$1" in
    -l|--list) list_assistants ;;
    -a|--all) assist-all ;;
    *) run_assistant "$@" ;;
  esac
fi
