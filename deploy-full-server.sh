#!/bin/bash
# MINE MANAGEMENT SYSTEM - FULL SERVER DEPLOYMENT
# Handles cleanup, dep sync, env validation, app startup, tmux dashboard, and browser launch.

set -uo pipefail
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SESSION_NAME="mine-system"
APP_PORT=8080

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# Detect LAN IP
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$LAN_IP" ] && LAN_IP="localhost"

step=0
step() { step=$((step+1)); echo -e "\n${BOLD}${YELLOW}[$step] $1${NC}"; }

echo -e ""
echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║         MINE MANAGEMENT SYSTEM — DEPLOY ALL                 ║${NC}"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"

# ─────────────────────────────────────────────────────────────
step "Cleaning old processes & ports"
# ─────────────────────────────────────────────────────────────
pkill -f "python.*app.py"      2>/dev/null || true
pkill -f "python.*monitor.py"  2>/dev/null || true
pkill -f "python.*log_viewer"  2>/dev/null || true
tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true

for port in $APP_PORT 8081 8082 5000 6000 7000; do
    fuser -k "${port}/tcp" 2>/dev/null || true
done
sleep 1
echo -e "  ${GREEN}✓ Environment clean${NC}"

# ─────────────────────────────────────────────────────────────
step "Configuring firewall"
# ─────────────────────────────────────────────────────────────
if sudo -n true 2>/dev/null; then
    if command -v ufw >/dev/null 2>&1; then
        for p in $APP_PORT 8081 8082; do
            sudo ufw allow "$p/tcp" 2>/dev/null || true
        done
        echo -e "  ${GREEN}✓ ufw rules added${NC}"
    elif command -v iptables >/dev/null 2>&1; then
        for p in $APP_PORT 8081 8082; do
            sudo iptables -I INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null || true
        done
        echo -e "  ${GREEN}✓ iptables rules added${NC}"
    fi
else
    echo -e "  ${DIM}⚠ Skipping (no cached sudo)${NC}"
fi

# ─────────────────────────────────────────────────────────────
step "Setting up Python environment"
# ─────────────────────────────────────────────────────────────
if [ ! -d "$PROJECT_DIR/venv" ]; then
    python3 -m venv "$PROJECT_DIR/venv"
    echo -e "  ${GREEN}✓ venv created${NC}"
fi
"$PROJECT_DIR/venv/bin/pip" install -q -r "$PROJECT_DIR/requirements.txt" 2>/dev/null
echo -e "  ${GREEN}✓ Dependencies synced${NC}"

# ─────────────────────────────────────────────────────────────
step "Validating environment"
# ─────────────────────────────────────────────────────────────
# .env
if [ ! -f "$PROJECT_DIR/.env" ]; then
    if [ -f "$PROJECT_DIR/.env.example" ]; then
        cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
        echo -e "  ${YELLOW}⚠ Created .env from .env.example — edit with real values${NC}"
    else
        echo -e "  ${DIM}⚠ No .env file — using defaults${NC}"
    fi
else
    echo -e "  ${GREEN}✓ .env present${NC}"
fi

# Syntax check
if ! "$PROJECT_DIR/venv/bin/python" -c "
import ast, sys
try:
    ast.parse(open('$PROJECT_DIR/app.py').read())
except SyntaxError as e:
    print(f'  SYNTAX ERROR line {e.lineno}: {e.msg}')
    sys.exit(1)
" 2>/dev/null; then
    echo -e "  ${RED}✗ Syntax error in app.py — aborting.${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓ Syntax OK${NC}"

# Import check
IMPORT_OUT=$("$PROJECT_DIR/venv/bin/python" -c "from app import app; print('OK')" 2>&1)
if [ "$IMPORT_OUT" != "OK" ] && ! echo "$IMPORT_OUT" | grep -q "OK"; then
    echo -e "  ${RED}✗ Import error:${NC}"
    echo "$IMPORT_OUT" | tail -3
    exit 1
fi
echo -e "  ${GREEN}✓ Imports OK${NC}"

# ─────────────────────────────────────────────────────────────
step "Checking Ollama AI service"
# ─────────────────────────────────────────────────────────────
if command -v ollama >/dev/null 2>&1; then
    if curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
        OLLAMA_MODELS=$(curl -sf http://localhost:11434/api/tags | python3 -c "import sys,json; print(', '.join(m['name'] for m in json.load(sys.stdin).get('models',[])))" 2>/dev/null)
        echo -e "  ${GREEN}✓ Ollama running — models: ${OLLAMA_MODELS}${NC}"
    else
        echo -e "  ${YELLOW}⚠ Ollama installed but not running — starting...${NC}"
        nohup ollama serve >/dev/null 2>&1 &
        sleep 3
        if curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
            echo -e "  ${GREEN}✓ Ollama started successfully${NC}"
        else
            echo -e "  ${RED}✗ Could not start Ollama — AI chat will be disabled${NC}"
        fi
    fi
    # Ensure base model is pulled
    if ! ollama list 2>/dev/null | grep -q "llama3.2"; then
        echo -e "  ${YELLOW}⚠ Pulling llama3.2 base model (2GB, one-time download)...${NC}"
        ollama pull llama3.2
    fi
    # Build CPU-optimized mine-assistant model from Modelfile
    if ! ollama list 2>/dev/null | grep -q "mine-assistant"; then
        echo -e "  ${YELLOW}⚠ Building mine-assistant model (CPU-optimized for this system)...${NC}"
        ollama create mine-assistant -f "$PROJECT_DIR/Modelfile.mine"
        echo -e "  ${GREEN}✓ mine-assistant model built${NC}"
    else
        echo -e "  ${GREEN}✓ mine-assistant model ready${NC}"
    fi
else
    echo -e "  ${DIM}⚠ Ollama not installed — AI chat disabled. Install: curl -fsSL https://ollama.com/install.sh | sh${NC}"
fi

# ─────────────────────────────────────────────────────────────
step "Launching services in tmux"
# ─────────────────────────────────────────────────────────────
#
# Tmux layout — 3 windows for clean separation:
#
#  Window 0 "server"  — Flask app (main output)
#  Window 1 "monitor" — Health check + auto-restart + live logs
#  Window 2 "tools"   — Log viewer dashboard (Grafana-style)
#

tmux new-session -d -s "$SESSION_NAME" -n "server" -x 200 -y 50

# ── Window 0: Server ──────────────────────────────────────────
# Top pane: Flask app, Bottom pane: live log tail
tmux send-keys -t "$SESSION_NAME:server" \
    "cd '$PROJECT_DIR' && source venv/bin/activate && echo -e '\\033[1;34m━━━ Flask Server ━━━\\033[0m' && python3 app.py 2>&1 | tee server.log" Enter
tmux split-window -v -t "$SESSION_NAME:server" -p 30
tmux send-keys -t "$SESSION_NAME:server.1" \
    "sleep 2 && echo -e '\\033[1;36m━━━ Live Server Logs ━━━\\033[0m' && tail -f '$PROJECT_DIR/server.log'" Enter

# ── Window 1: Monitor ────────────────────────────────────────
tmux new-window -t "$SESSION_NAME" -n "monitor"
tmux send-keys -t "$SESSION_NAME:monitor" \
    "cd '$PROJECT_DIR' && source venv/bin/activate && echo -e '\\033[1;33m━━━ Health Monitor (auto-restart) ━━━\\033[0m' && python3 monitor.py" Enter

# ── Window 2: Log Viewer Dashboard ───────────────────────────
tmux new-window -t "$SESSION_NAME" -n "dashboard"
tmux send-keys -t "$SESSION_NAME:dashboard" \
    "cd '$PROJECT_DIR' && source venv/bin/activate && echo -e '\\033[1;35m━━━ Grafana-Style Dashboard ━━━\\033[0m' && python3 log_viewer.py" Enter

# ── Tmux settings ────────────────────────────────────────────
tmux set-option -t "$SESSION_NAME" mouse on
tmux set-option -t "$SESSION_NAME" status on
tmux set-option -t "$SESSION_NAME" status-style "bg=colour236,fg=colour248"
tmux set-option -t "$SESSION_NAME" status-left "#[fg=colour82,bold] MINE SYSTEM #[fg=colour248]│ "
tmux set-option -t "$SESSION_NAME" status-left-length 20
tmux set-option -t "$SESSION_NAME" status-right "#[fg=colour248]│ #[fg=colour117]$LAN_IP:$APP_PORT #[fg=colour248]│ #[fg=colour222]%H:%M "
tmux set-option -t "$SESSION_NAME" status-right-length 40
tmux set-window-option -t "$SESSION_NAME" window-status-format " #I:#W "
tmux set-window-option -t "$SESSION_NAME" window-status-current-format "#[fg=colour82,bold] #I:#W "
tmux set-option -t "$SESSION_NAME" pane-border-style "fg=colour240"
tmux set-option -t "$SESSION_NAME" pane-active-border-style "fg=colour82"

# Focus back on server window
tmux select-window -t "$SESSION_NAME:server"
tmux select-pane -t "$SESSION_NAME:server.0"

echo -e "  ${GREEN}✓ 3 windows launched: server, monitor, dashboard${NC}"

# ─────────────────────────────────────────────────────────────
step "Waiting for server on :${APP_PORT}"
# ─────────────────────────────────────────────────────────────
SERVER_UP=0
for i in $(seq 1 25); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${APP_PORT}" 2>/dev/null || echo "000")
    if echo "$HTTP_CODE" | grep -qE "^(200|302)"; then
        echo -e "  ${GREEN}✓ Server responding (HTTP ${HTTP_CODE})${NC}"
        SERVER_UP=1
        break
    fi
    printf "  %s waiting... (%d/25)\r" "$([ $((i % 2)) -eq 0 ] && echo '◐' || echo '◑')" "$i"
    sleep 1
done
echo ""

if [ $SERVER_UP -eq 0 ]; then
    echo -e "  ${RED}✗ Server failed to start within 25s${NC}"
    echo -e "  ${DIM}Check: tmux attach -t $SESSION_NAME${NC}"
fi

# ─────────────────────────────────────────────────────────────
step "Opening browser"
# ─────────────────────────────────────────────────────────────
if [ $SERVER_UP -eq 1 ]; then
    OPEN_URL="http://localhost:${APP_PORT}"
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$OPEN_URL" 2>/dev/null &
        echo -e "  ${GREEN}✓ Opened $OPEN_URL${NC}"
    elif command -v open >/dev/null 2>&1; then
        open "$OPEN_URL" 2>/dev/null &
        echo -e "  ${GREEN}✓ Opened $OPEN_URL${NC}"
    else
        echo -e "  ${DIM}⚠ No browser command found — open manually${NC}"
    fi
else
    echo -e "  ${DIM}⚠ Skipped (server not ready)${NC}"
fi

# ─────────────────────────────────────────────────────────────
# Summary banner
# ─────────────────────────────────────────────────────────────
echo -e ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║  ✓  ALL SERVICES DEPLOYED                                   ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo -e ""
echo -e "  ${BOLD}Local:${NC}    http://localhost:${APP_PORT}"
echo -e "  ${BOLD}Network:${NC}  http://${LAN_IP}:${APP_PORT}"
echo -e "  ${BOLD}Login:${NC}    admin"
echo -e ""
echo -e "  ${DIM}Tmux windows:${NC}"
echo -e "    ${CYAN}0:server${NC}    — Flask app + live log tail"
echo -e "    ${CYAN}1:monitor${NC}   — Health monitor (auto-restart)"
echo -e "    ${CYAN}2:dashboard${NC} — Grafana-style log viewer"
echo -e ""
echo -e "  ${DIM}Shortcuts:${NC}"
echo -e "    ${CYAN}Ctrl+B 0/1/2${NC}  Switch window    ${CYAN}Ctrl+B D${NC}  Detach"
echo -e "    ${CYAN}tmux attach -t $SESSION_NAME${NC}    Re-attach"
echo -e ""

# ─────────────────────────────────────────────────────────────
# Attach to tmux
# ─────────────────────────────────────────────────────────────
sleep 1
tmux attach -t "$SESSION_NAME"
