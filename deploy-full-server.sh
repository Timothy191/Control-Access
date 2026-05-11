#!/bin/bash
# -----------------------------------------------------------------------------
# ARCH-SYSTEM - SUPREME SERVER DEPLOYMENT ENGINE (v2.2.0)
# -----------------------------------------------------------------------------
# Handles: Cleanup, Performance, Firewall, AI, Tmux Grid, Monitoring, Dashboards.
# -----------------------------------------------------------------------------

set -uo pipefail

# --- CONFIGURATION ---
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SESSION_NAME="arch-system"
APP_PORT=8080
VENV_DIR="$PROJECT_DIR/venv"
PYTHON_BIN="$VENV_DIR/bin/python"

# --- CLI ARGUMENTS ---
USE_TERMINAL=false
NO_BROWSER=false
SEED_DATA=false
FULL_CLEAN=false

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --terminal    Use separate gnome-terminal windows instead of tmux"
    echo "  --no-browser  Skip auto-opening browser"
    echo "  --seed        Import employees from Excel and seed historical logs"
    echo "  --clean       Deep clean: delete logs, clear ports aggressively, wipe cache"
    echo "  --help        Show this help message"
    echo ""
    echo "Default behavior: Launches services in tmux with browser auto-open"
    exit 0
}

for arg in "$@"; do
    case $arg in
        --terminal) USE_TERMINAL=true ;;
        --no-browser) NO_BROWSER=true ;;
        --seed) SEED_DATA=true ;;
        --clean) FULL_CLEAN=true ;;
        --help) usage ;;
    esac
done

# --- COLORS & UI ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# --- BANNER ---
draw_banner() {
    clear
    echo -e "${BOLD}${CYAN}"
    echo "  █████╗ ██████╗  ██████╗██╗  ██╗       ███████╗██╗   ██╗███████╗████████╗███████╗███╗   ███╗"
    echo " ██╔══██╗██╔══██╗██╔════╝██║  ██║       ██╔════╝╚██╗ ██╔╝██╔════╝╚══██╔══╝██╔════╝████╗ ████║"
    echo " ███████║██████╔╝██║     ███████║       ███████╗ ╚████╔╝ ███████╗   ██║   █████╗  ██╔████╔██║"
    echo " ██╔══██║██╔══██╗██║     ██╔══██║       ╚════██║  ╚██╔╝  ╚════██║   ██║   ██╔══╝  ██║╚██╔╝██║"
    echo " ██║  ██║██║  ██║╚██████╗██║  ██║       ███████║   ██║   ███████║   ██║   ███████╗██║ ╚═╝ ██║"
    echo " ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝       ╚══════╝   ╚═╝   ╚══════╝   ╚═╝   ╚══════╝╚═╝     ╚═╝"
    echo -e "                                                                        ${NC}${DIM}v2.2.0${NC}"
    echo -e "${BLUE} ══════════════════════════════════════════════════════════════════════════════════════════ ${NC}"
}

step_count=0
step() {
    step_count=$((step_count+1))
    echo -e "\n${BOLD}${CYAN}[$step_count]${NC} ${BOLD}$1${NC}"
}

# Start Execution
draw_banner

# --- 1. CLEANUP ---
step "Initializing Environment Cleanup"

# Aggressive process killing
echo -en "  ${DIM}Terminating existing services...${NC}"
for proc in "app.py" "monitor.py" "log_viewer.py" "scan_ingestion.py" "seed_historical_logs.py" "bulk_simulate.py" "npx expo"; do
    pkill -9 -f "python.*$proc" 2>/dev/null || true
    pkill -9 -f "$proc" 2>/dev/null || true
done
tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
echo -e " ${GREEN}✓ DONE${NC}"

echo -en "  ${DIM}Purging listener ports...${NC}"
# Common ports for this app and industrial hardware (C66/Infowedge)
for port in $APP_PORT 8081 8082 5000 6000 7000 9100 9101 9102; do
    # Kill tcp and udp using fuser
    fuser -k -n tcp "$port" 2>/dev/null || true
    fuser -k -n udp "$port" 2>/dev/null || true
    
    # Aggressive fallback with lsof if available
    if command -v lsof >/dev/null 2>&1; then
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
    fi
done
echo -e " ${GREEN}✓ DONE${NC}"

if [ "$FULL_CLEAN" = true ]; then
    echo -en "  ${DIM}Performing deep clean (logs & cache)...${NC}"
    # Delete logs
    rm -f "$PROJECT_DIR"/*.log
    # Delete python cache
    find "$PROJECT_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    # Delete temporary session files
    rm -rf "$PROJECT_DIR"/.pytest_cache 2>/dev/null || true
    echo -e " ${GREEN}✓ DONE${NC}"
fi

# --- 2. OPTIMIZATION ---
step "System Performance Optimization"
if sudo -n true 2>/dev/null || [ $EUID -eq 0 ]; then
    if [ -d /sys/devices/system/cpu/cpu0/cpufreq ]; then
        echo -en "  ${DIM}Setting CPU governor to performance...${NC}"
        echo "performance" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor > /dev/null || true
        echo -e " ${GREEN}✓ DONE${NC}"
    fi
    if command -v ufw >/dev/null 2>&1; then
        echo -en "  ${DIM}Configuring firewall (UFW)...${NC}"
        for p in $APP_PORT 8081 8082; do sudo ufw allow "$p/tcp" 2>/dev/null || true; done
        echo -e " ${GREEN}✓ DONE${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠ Skipping privileged optimizations (run with sudo for performance boost)${NC}"
fi

# --- 3. DEPENDENCIES ---
step "Synchronizing Dependencies"
if [ ! -d "$VENV_DIR" ]; then
    echo -en "  ${DIM}Creating virtual environment...${NC}"
    python3 -m venv "$VENV_DIR"
    echo -e " ${GREEN}✓${NC}"
fi

echo -en "  ${DIM}Installing requirements...${NC}"
"$VENV_DIR/bin/pip" install -q --upgrade pip
"$VENV_DIR/bin/pip" install -q -r "$PROJECT_DIR/requirements.txt" rich psutil plotext 2>/dev/null
echo -e " ${GREEN}✓ DONE${NC}"

if [ -d "$PROJECT_DIR/QrMobile" ] && [ ! -d "$PROJECT_DIR/QrMobile/node_modules" ]; then
    echo -en "  ${DIM}Installing Mobile dependencies (npm)...${NC}"
    (cd "$PROJECT_DIR/QrMobile" && npm install -q)
    echo -e " ${GREEN}✓ DONE${NC}"
fi

# --- 4. VALIDATION ---
step "Validating Code Integrity"
if ! "$PYTHON_BIN" -m py_compile "$PROJECT_DIR/app.py" 2>/dev/null; then
    echo -e "  ${RED}✗ Syntax error in app.py — Fix before deploying!${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓ app.py syntax OK${NC}"

# --- 5. AI ENGINE ---
step "Checking Ollama AI Engine"
if command -v ollama >/dev/null 2>&1; then
    if ! curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
        echo -en "  ${DIM}Starting Ollama service...${NC}"
        nohup ollama serve >/dev/null 2>&1 &
        sleep 3
    fi
    
    OLLAMA_MODELS=$(curl -sf http://localhost:11434/api/tags | python3 -c "import sys,json; print(', '.join(m['name'] for m in json.load(sys.stdin).get('models',[])))" 2>/dev/null)
    echo -e "  ${GREEN}✓ Ollama ready${NC} ${DIM}(Models: ${OLLAMA_MODELS:-None})${NC}"
    
    for model in mine-assistant-fast mine-assistant; do
        if ! echo "$OLLAMA_MODELS" | grep -q "$model"; then
            echo -e "  ${YELLOW}⚠ Missing model: $model. Creating...${NC}"
            if [ -f "$PROJECT_DIR/Modelfile.mine" ]; then
                ollama create "$model" -f "$PROJECT_DIR/Modelfile.mine" >/dev/null 2>&1 &
            fi
        fi
    done
else
    echo -e "  ${YELLOW}⚠ Ollama not found. AI Chat will be offline.${NC}"
fi

# --- 6. DATA INITIALIZATION ---
if [ "$SEED_DATA" = true ]; then
    step "Initializing Data (Excel Import & Simulation)"
    if [ -f "$PROJECT_DIR/import_employees_excel.py" ]; then
        echo -en "  ${DIM}Importing employees from Excel...${NC}"
        "$PYTHON_BIN" "$PROJECT_DIR/import_employees_excel.py" >/dev/null 2>&1
        echo -e " ${GREEN}✓ DONE${NC}"
    fi
    if [ -f "$PROJECT_DIR/seed_historical_logs.py" ]; then
        echo -en "  ${DIM}Generating 5 days of historical logs...${NC}"
        "$PYTHON_BIN" "$PROJECT_DIR/seed_historical_logs.py" >/dev/null 2>&1
        echo -e " ${GREEN}✓ DONE${NC}"
    fi
fi

# --- 7. SERVICE DEPLOYMENT ---
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$LAN_IP" ] && LAN_IP="localhost"

if [ "$USE_TERMINAL" = true ]; then
    step "Launching Services in Terminal Windows"
    
    # Terminal 1: Log Viewer
    gnome-terminal \
        --title="[1] Mine System - Log Viewer" \
        --working-directory="$PROJECT_DIR" \
        -- bash -c "source venv/bin/activate && python3 log_viewer.py" 2>/dev/null &
    
    # Terminal 2: Main App (gunicorn)
    gnome-terminal \
        --title="[2] Mine System - App Server" \
        --working-directory="$PROJECT_DIR" \
        -- bash -c "source venv/bin/activate && gunicorn -c gunicorn.conf.py app:app 2>&1 | tee server.log" 2>/dev/null &
    
    # Terminal 3: Monitor
    gnome-terminal \
        --title="[3] Mine System - Monitor" \
        --working-directory="$PROJECT_DIR" \
        -- bash -c "source venv/bin/activate && python3 monitor.py" 2>/dev/null &
    
    # Terminal 4: Mobile (if exists)
    if [ -d "$PROJECT_DIR/QrMobile" ]; then
        gnome-terminal \
            --title="[4] Mine System - Mobile" \
            --working-directory="$PROJECT_DIR/QrMobile" \
            -- bash -c "npx expo start" 2>/dev/null &
    fi
    
    echo -e "  ${GREEN}✓ Services launched in separate terminal windows${NC}"
else
    step "Orchestrating Tmux Services"
    
    # Create session
    tmux new-session -d -s "$SESSION_NAME" -n "GRID" -x 200 -y 50
    
    # Window 1: GRID LAYOUT (2x2)
    # Pane 1: App Server (gunicorn)
    tmux send-keys -t "$SESSION_NAME:GRID.0" "cd '$PROJECT_DIR' && source venv/bin/activate && gunicorn -c gunicorn.conf.py app:app 2>&1 | tee server.log" Enter
    # Pane 2: App Logs
    tmux split-window -h -t "$SESSION_NAME:GRID.0"
    tmux send-keys -t "$SESSION_NAME:GRID.1" "echo -e '${BOLD}${CYAN}━━━ App Log Stream ━━━${NC}' && tail -f server.log" Enter
    # Pane 3: Monitor Logs
    tmux split-window -v -t "$SESSION_NAME:GRID.0"
    tmux send-keys -t "$SESSION_NAME:GRID.2" "echo -e '${BOLD}${YELLOW}━━━ Monitor Log Stream ━━━${NC}' && tail -f monitor.log" Enter
    # Pane 4: Interactive Shell
    tmux split-window -v -t "$SESSION_NAME:GRID.1"
    tmux send-keys -t "$SESSION_NAME:GRID.3" "echo -e '${BOLD}${MAGENTA}━━━ Interactive Shell ━━━${NC}' && clear" Enter
    
    # Window 2: DASHBOARD
    tmux new-window -t "$SESSION_NAME" -n "DASHBOARD"
    tmux send-keys -t "$SESSION_NAME:DASHBOARD" "cd '$PROJECT_DIR' && source venv/bin/activate && python3 log_viewer.py" Enter
    
    # Window 3: INGESTION DAEMON
    tmux new-window -t "$SESSION_NAME" -n "INGESTION"
    tmux send-keys -t "$SESSION_NAME:INGESTION" "cd '$PROJECT_DIR' && source venv/bin/activate && python3 scan_ingestion.py" Enter
    
    # Window 4: MOBILE (If exists)
    if [ -d "$PROJECT_DIR/QrMobile" ]; then
        tmux new-window -t "$SESSION_NAME" -n "MOBILE"
        tmux send-keys -t "$SESSION_NAME:MOBILE" "cd '$PROJECT_DIR/QrMobile' && npx expo start" Enter
    fi
    
    # Visual styling for tmux
    tmux set-option -t "$SESSION_NAME" mouse on
    tmux set-option -t "$SESSION_NAME" status-style "bg=black,fg=cyan"
    tmux set-option -t "$SESSION_NAME" status-left "#[fg=black,bg=cyan,bold] ARCH #[bg=black,fg=cyan] "
    tmux set-option -t "$SESSION_NAME" status-right "#[fg=cyan,bold] %H:%M #[fg=white,dim]│ #[fg=cyan]$LAN_IP "
    tmux set-window-option -t "$SESSION_NAME" window-status-current-style "fg=white,bold,bg=blue"
    
    tmux select-window -t "$SESSION_NAME:GRID"
    echo -e "  ${GREEN}✓ Services launched in tmux session: ${BOLD}$SESSION_NAME${NC}"
fi

# --- 7. HEALTH CHECK & BROWSER ---
step "Waiting for API Readiness"
READY=0
for i in $(seq 1 30); do
    if curl -sf "http://localhost:$APP_PORT/healthz" >/dev/null 2>&1; then
        READY=1
        break
    fi
    printf "  ${DIM}Waiting... (%d/30)${NC}\r" "$i"
    sleep 1
done
echo ""

if [ $READY -eq 1 ]; then
    echo -e "  ${GREEN}✓ Server is ONLINE at http://localhost:$APP_PORT${NC}"
    
    if [ "$NO_BROWSER" = false ]; then
        echo -e "  ${DIM}Opening browser...${NC}"
        if python3 -m webbrowser -t "http://localhost:$APP_PORT" &>/dev/null; then
            echo -e "  ${GREEN}✓ Browser opened${NC}"
        elif command -v xdg-open >/dev/null 2>&1; then
            xdg-open "http://localhost:$APP_PORT" &>/dev/null &
            echo -e "  ${GREEN}✓ Browser opened${NC}"
        elif command -v open >/dev/null 2>&1; then
            open "http://localhost:$APP_PORT" &>/dev/null &
            echo -e "  ${GREEN}✓ Browser opened${NC}"
        else
            echo -e "  ${YELLOW}⚠ Could not auto-open browser. Visit: http://localhost:$APP_PORT${NC}"
        fi
    fi
else
    echo -e "  ${RED}✗ Server timeout. Check logs.${NC}"
fi

echo -e "\n${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║  ✓  DEPLOYMENT COMPLETE                                     ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"

if [ "$USE_TERMINAL" = true ]; then
    echo -e "\n  ${BOLD}Services running in separate terminal windows${NC}"
    echo -e "  ${DIM}Close terminal windows to stop services${NC}"
else
    echo -e "\n  ${BOLD}Shortcuts:${NC}"
    echo -e "    ${CYAN}Ctrl+B 0${NC} : Grid View (Monitor + Logs)"
    echo -e "    ${CYAN}Ctrl+B 1${NC} : Live Dashboard (Grafana-style)"
    echo -e "    ${CYAN}Ctrl+B 2${NC} : Ingestion Logs"
    echo -e "    ${CYAN}Ctrl+B D${NC} : Detach from session"
    echo -e "\n  ${DIM}To re-attach later:${NC} ${BOLD}tmux attach -t $SESSION_NAME${NC}"
    echo -e "  ${DIM}To rebuild data:${NC}    ${BOLD}./deploy-full-server.sh --seed${NC}\n"
    
    sleep 1
    tmux attach -t "$SESSION_NAME"
fi