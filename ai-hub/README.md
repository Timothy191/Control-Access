AI HUB - Terminal AI Assistant Orchestra
=========================================
Created: 2026-04-08

DIRECTORY STRUCTURE:
/home/tim/ai-hub/
├── ai-hub.sh           # Main orchestrator
├── orchestrator.sh     # v2 orchestrator  
├── assistants/         # Assistant configs
├── models/            # Ollama models (when installed)
└── scripts/           # Launch scripts
    ├── ollama-launch-pi
    ├── ollama-launch-codex
    ├── ollama-launch-droid
    └── ollama-launch-openclaw

AVAILABLE ASSISTANTS:
====================
CLI Tools (need npm/pip install):
  1. kilocode       - Kilo CLI (@kilocode/cli)
  2. claude-code    - Anthropic Claude Code
  3. paws           - Paws AI terminal assistant
  4. llxprt-code    - Multi-provider CLI
  5. aider          - AI pair programming

Ollama Local Models (need root install):
  6. ollama-launch-pi       - Pi model
  7. ollama-launch-codex    - Codex model  
  8. ollama-launch-droid    - Droid model
  9. ollama-launch-openclaw - OpenClaw model

USAGE:
=====
source ~/ai-hub/orchestrator.sh           # Load hub
orchestrator.sh -l                        # List assistants
orchestrator.sh 1 "your task"              # Run specific assistant
orchestrator.sh -a                        # Run all assistants

NOTES:
=====
- Root password needed for Ollama install: 'Kali'
- npm global install configured to ~/.npm-global
- Run 'source ~/.bashrc' to load AI Hub in current session
