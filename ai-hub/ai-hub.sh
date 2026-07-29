#!/bin/bash
# AI Hub Orchestrator - Main Script
# This system manages AI assistants for your tasks

export AI_HUB="$HOME/ai-hub"
export ASSISTANTS_DIR="$AI_HUB/assistants"
export SCRIPTS_DIR="$AI_HUB/scripts"
export MODELS_DIR="$AI_HUB/models"

mkdir -p "$ASSISTANTS_DIR" "$SCRIPTS_DIR" "$MODELS_DIR"

source "$SCRIPTS_DIR/ai-hub.sh" 2>/dev/null

echo "
╔═══════════════════════════════════════════════════════════════╗
║              AI HUB - Terminal AI Orchestrator               ║
╠═══════════════════════════════════════════════════════════════╣
║  Available Assistants:                                       ║
║                                                               ║
║  [CLI Tools]                                                 ║
║    1. kilocode    - Kilo CLI (agentic engineering)           ║
║    2. claude-code - Anthropic Claude Code                    ║
║    3. paws        - AI terminal assistant                   ║
║    4. llxprt-code - Multi-provider AI CLI                    ║
║    5. aider       - AI pair programming                      ║
║                                                               ║
║  [Ollama Local Models]                                        ║
║    6. ollama-launch-pi   - Launch Pi model (local)           ║
║    7. ollama-launch-codex - Launch Codex model (local)       ║
║    8. ollama-launch-droid - Launch Droid model (local)       ║
║    9. ollama-launch-openclaw - Launch OpenClaw model (local) ║
║                                                               ║
║  [Orchestration]                                             ║
║    assist-all   - Consult all assistants                     ║
║    assist <name> - Run specific assistant                    ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║  NOTE: Ollama needs root install. Ask user for root password. ║
╚═══════════════════════════════════════════════════════════════╝
"

alias assist-all='echo "Consulting all AI assistants..."'
alias ollama-launch-pi='echo "Launching Pi model..."'
alias ollama-launch-codex='echo "Launching Codex model..."'
alias ollama-launch-droid='echo "Launching Droid model..."'
alias ollama-launch-openclaw='echo "Launching OpenClaw model..."'

echo "AI Hub loaded! Type 'assist' or 'help' for commands."
