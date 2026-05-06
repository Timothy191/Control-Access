#!/bin/bash
# Deploy Log Viewer Terminal

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
export SCRIPT_DIR

echo "Starting Log Viewer Terminal..."

# Activate virtual environment and run log viewer
gnome-terminal \
    --title="[1] Black Arch Server - Live Logs" \
    --working-directory="$PROJECT_DIR" \
    -- bash -c "source venv/bin/activate && python3 log_viewer.py" &
    
echo "Log Viewer Terminal launched"
