#!/bin/bash
# Black Arch System - Grid-Based Tmux Deployment Script
# Splits a single tmux window into 4 panes for comprehensive monitoring

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SESSION_NAME="mine_grid"

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo -e "${RED}Error: tmux is not installed.${NC}"
    exit 1
fi

# Kill existing session if any
tmux kill-session -t $SESSION_NAME 2>/dev/null || true

# Start new session, detached
tmux new-session -d -s $SESSION_NAME -n "MineGrid"
tmux set-option -t $SESSION_NAME base-index 1
tmux set-option -t $SESSION_NAME pane-base-index 1
tmux set-option -t $SESSION_NAME mouse on
tmux set-option -t $SESSION_NAME history-limit 10000

# Create the 2x2 grid
# 1. Start with Pane 1
# 2. Split Pane 1 horizontally -> creates Pane 2
tmux split-window -h -t $SESSION_NAME:MineGrid.1
# 3. Split Pane 1 vertically -> creates Pane 3
tmux split-window -v -t $SESSION_NAME:MineGrid.1
# 4. Split Pane 2 vertically -> creates Pane 4
tmux split-window -v -t $SESSION_NAME:MineGrid.2

# Final layout mapping:
# Pane 1: Top Left
# Pane 2: Top Right
# Pane 3: Bottom Left
# Pane 4: Bottom Right

# Send commands to each pane
# Pane 1 (Top Left): Log Viewer
tmux send-keys -t $SESSION_NAME:MineGrid.1 "cd '$PROJECT_DIR' && source venv/bin/activate && python3 log_viewer.py" C-m

# Pane 2 (Top Right): Monitor
tmux send-keys -t $SESSION_NAME:MineGrid.2 "cd '$PROJECT_DIR' && source venv/bin/activate && python3 monitor.py" C-m

# Pane 3 (Bottom Left): QR Mobile
if [ -d "$PROJECT_DIR/QrMobile" ] && command -v npm &> /dev/null; then
    tmux send-keys -t $SESSION_NAME:MineGrid.3 "cd '$PROJECT_DIR/QrMobile' && npx expo start --tunnel" C-m
else
    tmux send-keys -t $SESSION_NAME:MineGrid.3 "echo 'QR Mobile not available or npm missing'; bash" C-m
fi

# Pane 4 (Bottom Right): Interactive Shell / App Logs
tmux send-keys -t $SESSION_NAME:MineGrid.4 "cd '$PROJECT_DIR' && tail -f server.log" C-m

# Select top-left pane
tmux select-pane -t $SESSION_NAME:MineGrid.1

echo -e "${GREEN}✓ Tmux session '$SESSION_NAME' started in background.${NC}"
echo -e "${YELLOW}→ To view the grid, run: tmux attach-session -t $SESSION_NAME${NC}"

if [ -t 0 ]; then
    tmux attach-session -t $SESSION_NAME
fi
