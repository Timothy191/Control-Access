#!/bin/bash

export AI_HUB="$HOME/ai-hub"
export PATH="$AI_HUB/scripts:$PATH"

ASSISTANTS=(
  "kilocode:@kilocode/cli"
  "claude-code:@anthropic-ai/claude-code"
  "paws:npx pawscode@latest"
  "llxprt-code:llxprt-code"
  "aider:pip install aider-chat"
)

run_assistant() {
  local name="$1"
  shift
  case "$name" in
    kilocode) npm exec -y @kilocode/cli -- "$@" ;;
    claude-code) npx -y @anthropic-ai/claude-code "$@" ;;
    paws) npx -y pawscode@latest "$@" ;;
    llxprt-code) npx -y llxprt-code "$@" ;;
    aider) pip install -q aider-chat && aider-chat "$@" ;;
    *) echo "Unknown assistant: $name" ;;
  esac
}

assist_all() {
  echo "=== Consulting all AI assistants ==="
  for assistant in "${ASSISTANTS[@]}"; do
    name="${assistant%%:*}"
    echo "--- $name ---"
  done
}

echo "AI Hub loaded. Use: run_assistant <name> <task>"
