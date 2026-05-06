#!/bin/bash
# MINE MANAGEMENT SYSTEM - ULTIMATE DEPLOYMENT & ATTACH
# This script cleans, opens ports, deploys services, and attaches to the TUI.

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SESSION_NAME="mine-system"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}========================================================================${NC}"
echo -e "${BLUE}   MINE MANAGEMENT SYSTEM - ULTIMATE DEPLOYMENT${NC}"
echo -e "${BLUE}========================================================================${NC}"

# 1. Cleaning Step
echo -e "${YELLOW}→ Step 1: Cleaning old processes and stale ports...${NC}"
pkill -f "python.*app.py" 2>/dev/null || true
pkill -f "python.*monitor.py" 2>/dev/null || true
pkill -f "python.*log_viewer.py" 2>/dev/null || true
pkill -f "npx expo" 2>/dev/null || true
pkill -f "node.*expo" 2>/dev/null || true
tmux kill-session -t $SESSION_NAME 2>/dev/null || true

# Aggressive port cleanup
PORTS=(8080 8081 8082 19000 19001 19002 8000 5000 6000 7000)
for port in "${PORTS[@]}"; do
    if command -v fuser &> /dev/null; then
        fuser -k "${port}/tcp" 2>/dev/null || true
    fi
done
sleep 1
echo -e "${GREEN}  ✓ Cleanup complete${NC}"

# 2. Firewall Step
echo -e "${YELLOW}→ Step 2: Opening firewall ports (requires sudo)...${NC}"
if command -v ufw >/dev/null 2>&1; then
    sudo ufw allow 8080/tcp 2>/dev/null || echo -e "${RED}  ! Failed to open 8080 via ufw (run manually with sudo)${NC}"
    sudo ufw allow 8081/tcp 2>/dev/null
    sudo ufw allow 8082/tcp 2>/dev/null
    sudo ufw allow 19000:19002/tcp 2>/dev/null
    echo -e "${GREEN}  ✓ ufw rules updated${NC}"
elif command -v iptables >/dev/null 2>&1; then
    for p in "${PORTS[@]}"; do
        sudo iptables -I INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null || true
    done
    echo -e "${GREEN}  ✓ iptables rules updated${NC}"
fi

# 3. Virtual Env & Deps
if [ ! -d "$PROJECT_DIR/venv" ]; then
    echo -e "${YELLOW}→ Step 3: Initializing Virtual Environment...${NC}"
    python3 -m venv "$PROJECT_DIR/venv"
    "$PROJECT_DIR/venv/bin/pip" install -r "$PROJECT_DIR/requirements.txt" 2>/dev/null || true
fi

# 4. Tmux Launch
echo -e "${YELLOW}→ Step 4: Launching services in tmux grid...${NC}"
tmux new-session -d -s $SESSION_NAME -n "Main"
tmux set-option -t $SESSION_NAME mouse on

# Create 4-pane grid
tmux split-window -h -t $SESSION_NAME:0
tmux split-window -v -t $SESSION_NAME:0.0
tmux split-window -v -t $SESSION_NAME:0.1

# Pane 0: Log Viewer
tmux send-keys -t $SESSION_NAME:0.0 "cd '$PROJECT_DIR' && source venv/bin/activate && python3 log_viewer.py" Enter
# Pane 1: Server Logs
tmux send-keys -t $SESSION_NAME:0.1 "cd '$PROJECT_DIR' && tail -f server.log" Enter
# Pane 2: Monitor
tmux send-keys -t $SESSION_NAME:0.2 "cd '$PROJECT_DIR' && source venv/bin/activate && python3 monitor.py" Enter
# Pane 3: Expo
if [ -d "$PROJECT_DIR/QrMobile" ]; then
    tmux send-keys -t $SESSION_NAME:0.3 "cd '$PROJECT_DIR/QrMobile' && npx expo start --offline" Enter
else
    tmux send-keys -t $SESSION_NAME:0.3 "echo 'No Mobile Project Found'; bash" Enter
fi

echo -e "${GREEN}✓ All systems GO!${NC}"
echo -e "${CYAN}→ Attaching to dashboard... (Press Ctrl+B then D to detach)${NC}"
sleep 2

# 5. Attach
tmux attach -t $SESSION_NAME