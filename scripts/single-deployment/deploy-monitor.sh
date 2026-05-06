#!/bin/bash
# Deploy Monitor Terminal

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
export SCRIPT_DIR

echo "Starting Monitor Terminal..."

# Activate virtual environment and run monitor
gnome-terminal \
    --title="[2] Black Arch System - Monitor" \
    --working-directory="$PROJECT_DIR" \
    -- bash -c "source venv/bin/activate && python3 monitor.py" &
    
echo "Monitor Terminal launched"
