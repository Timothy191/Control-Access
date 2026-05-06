#!/bin/bash
# MINE MANAGEMENT SYSTEM - FULL SERVER DEPLOYMENT
# Handles cleanup, dep sync, env validation, app startup, and tmux dashboard.

set -uo pipefail
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SESSION_NAME="mine-system"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}========================================================================${NC}"
echo -e "${BLUE}   MINE MANAGEMENT SYSTEM - FULL SERVER DEPLOYMENT${NC}"
echo -e "${BLUE}========================================================================${NC}"

# 1. Clean Environment
echo -e "${YELLOW}→ Cleaning processes and ports...${NC}"
pkill -f "python.*app.py"      2>/dev/null || true
pkill -f "python.*monitor.py"  2>/dev/null || true
pkill -f "python.*log_viewer"  2>/dev/null || true
tmux kill-session -t $SESSION_NAME 2>/dev/null || true

for port in 8080 8081 8082 5000 6000 7000; do
    fuser -k "${port}/tcp" 2>/dev/null || true
done
sleep 1
echo -e "${GREEN}  ✓ Environment clean${NC}"

# 2. Configure Firewall (only if sudo is already cached — no blocking prompt)
echo -e "${YELLOW}→ Configuring firewall...${NC}"
if sudo -n true 2>/dev/null; then
    if command -v ufw >/dev/null 2>&1; then
        sudo ufw allow 8080/tcp 2>/dev/null || true
        sudo ufw allow 8081/tcp 2>/dev/null || true
        sudo ufw allow 8082/tcp 2>/dev/null || true
        echo -e "${GREEN}  ✓ ufw configured${NC}"
    elif command -v iptables >/dev/null 2>&1; then
        for p in 8080 8081 8082; do
            sudo iptables -I INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null || true
        done
        echo -e "${GREEN}  ✓ iptables configured${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ Skipping firewall (no cached sudo) — run manually if needed${NC}"
fi

# 3. Setup Virtual Environment & Sync Dependencies
echo -e "${YELLOW}→ Syncing Python environment...${NC}"
if [ ! -d "$PROJECT_DIR/venv" ]; then
    python3 -m venv "$PROJECT_DIR/venv"
    echo -e "${GREEN}  ✓ venv created${NC}"
fi
"$PROJECT_DIR/venv/bin/pip" install -q -r "$PROJECT_DIR/requirements.txt"
echo -e "${GREEN}  ✓ Dependencies synced${NC}"

# 4. Validate .env file
echo -e "${YELLOW}→ Checking .env...${NC}"
if [ ! -f "$PROJECT_DIR/.env" ]; then
    if [ -f "$PROJECT_DIR/.env.example" ]; then
        cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
        echo -e "${YELLOW}  ⚠ Created .env from .env.example — edit with real values${NC}"
    else
        echo -e "${YELLOW}  ⚠ No .env file found — app will use defaults${NC}"
    fi
else
    echo -e "${GREEN}  ✓ .env present${NC}"
fi

# 5. Validate app syntax + imports before launching
echo -e "${YELLOW}→ Validating app.py...${NC}"
if ! "$PROJECT_DIR/venv/bin/python" -c "
import ast, sys
try:
    ast.parse(open('$PROJECT_DIR/app.py').read())
    print('  Syntax OK')
except SyntaxError as e:
    print(f'  SYNTAX ERROR line {e.lineno}: {e.msg}')
    sys.exit(1)
"; then
    echo -e "${RED}✗ Syntax error in app.py — aborting.${NC}"
    exit 1
fi

# Quick import check to catch missing deps
if ! "$PROJECT_DIR/venv/bin/python" -c "from app import app; print('  Imports OK')" 2>&1; then
    echo -e "${RED}✗ Import error — check dependencies. Run: pip install -r requirements.txt${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ app.py validated${NC}"

# 6. Launch Services in Tmux (4 panes)
echo -e "${YELLOW}→ Launching services in tmux...${NC}"
tmux new-session -d -s $SESSION_NAME -n "MineSystem"
tmux set-option -t $SESSION_NAME mouse on

# Layout:
#  ┌──────────────────┬──────────────────┐
#  │  0: App Server   │  1: Server Logs  │
#  ├──────────────────┼──────────────────┤
#  │  2: Monitor      │  3: Log Viewer   │
#  └──────────────────┴──────────────────┘
tmux split-window -h -t $SESSION_NAME:0
tmux split-window -v -t $SESSION_NAME:0.0
tmux split-window -v -t $SESSION_NAME:0.1

# Pane 0 (top-left): Main Flask App
tmux send-keys -t $SESSION_NAME:0.0 \
    "cd '$PROJECT_DIR' && source venv/bin/activate && python3 app.py 2>&1 | tee server.log" Enter

# Pane 1 (top-right): Live Server Log tail
tmux send-keys -t $SESSION_NAME:0.1 \
    "sleep 3 && tail -f '$PROJECT_DIR/server.log'" Enter

# Pane 2 (bottom-left): Monitor (health check + auto-restart)
tmux send-keys -t $SESSION_NAME:0.2 \
    "cd '$PROJECT_DIR' && source venv/bin/activate && python3 monitor.py" Enter

# Pane 3 (bottom-right): Log Viewer
tmux send-keys -t $SESSION_NAME:0.3 \
    "cd '$PROJECT_DIR' && source venv/bin/activate && python3 log_viewer.py" Enter

# 7. Health check — wait for server to respond
echo -e "${YELLOW}→ Waiting for server to start on :8080...${NC}"
SERVER_UP=0
for i in $(seq 1 20); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null || echo "000")
    if echo "$HTTP_CODE" | grep -qE "^(200|302)"; then
        echo -e "${GREEN}  ✓ Server is up at http://localhost:8080 (HTTP ${HTTP_CODE})${NC}"
        SERVER_UP=1
        break
    fi
    sleep 1
    echo -e "  waiting... (${i}/20)"
done
if [ $SERVER_UP -eq 0 ]; then
    echo -e "${RED}  ✗ Server failed to start within 20s — check tmux logs${NC}"
fi

echo -e ""
echo -e "${GREEN}========================================================================${NC}"
echo -e "${GREEN}  ✓ Deployment complete${NC}"
echo -e "${CYAN}    URL:      http://localhost:8080${NC}"
echo -e "${CYAN}    Login:    admin (default)${NC}"
echo -e "${CYAN}    Barcode:  http://localhost:8080/api/barcode/staging${NC}"
echo -e "${CYAN}    Config:   http://localhost:8080/api/config/datawedge${NC}"
echo -e "${CYAN}    APK DL:   http://localhost:8080/api/barcode/app-download${NC}"
echo -e "${CYAN}    APK:      http://localhost:8080/api/app/download${NC}"
echo -e "${GREEN}========================================================================${NC}"
echo -e ""

# 8. Attach to tmux dashboard
tmux attach -t $SESSION_NAME
