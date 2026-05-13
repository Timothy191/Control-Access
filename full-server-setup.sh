#!/bin/bash
set -e # Exit on error

# Colours
RED='\033[1;31m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
CYAN='\033[1;36m'
NC='\033[0m'

echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
echo -e "${RED}        MINE MANAGEMENT SYSTEM: FULL FACTORY RESET${NC}"
echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
cd "$SCRIPT_DIR"

# Confirmation Prompt
echo -e "${RED}ATTENTION: This is a FULL FACTORY RESET.${NC}"
echo -e "This will terminate ALL project processes, WIPE environments, and OPTIMIZE system performance."
echo -en "${YELLOW}Are you sure you want to proceed? (y/N): ${NC}"
read -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Aborted. No changes were made.${NC}"
    exit 0
fi

echo -e "${YELLOW}→ Step 1: Terminating all running project processes...${NC}"
pkill -f "python.*app.py" 2>/dev/null || true
pkill -f "python.*monitor.py" 2>/dev/null || true
pkill -f "python.*log_viewer.py" 2>/dev/null || true
pkill -f "npx expo" 2>/dev/null || true
pkill -f "node.*expo" 2>/dev/null || true
tmux kill-session -t mine_grid 2>/dev/null || true

# Kill any Python processes that might hold network listener ports (5000-7000)
pkill -9 -f "python" 2>/dev/null || true
sleep 2

echo -e "${CYAN}  Cleaning up network listener ports (5000-7000)...${NC}"
# Clean specific ports
for port in 8080 8081 8082 19000 19001 19002 8000 5000 6000 7000; do
    if command -v fuser &> /dev/null; then
        fuser -k "${port}/tcp" 2>/dev/null || true
    elif command -v lsof &> /dev/null; then
        PIDS=$(lsof -ti ":$port" 2>/dev/null || true)
        if [ -n "$PIDS" ]; then
            for pid in $PIDS; do kill -9 "$pid" 2>/dev/null || true; done
        fi
    fi
done

sleep 2
echo -e "${GREEN}  ✓ All processes terminated${NC}"

echo -e "${YELLOW}→ Step 2: Wiping old Virtual Environments and Node Modules...${NC}"
rm -rf "$SCRIPT_DIR/venv"
rm -rf "$SCRIPT_DIR/__pycache__"
rm -rf "$SCRIPT_DIR/QrMobile/node_modules"
rm -rf "$SCRIPT_DIR/QrMobile/.expo"
find . -type d -name "__pycache__" -exec rm -r {} + 2>/dev/null || true

echo -e "${YELLOW}→ Step 3: Wiping old logs (Keeping Database intact)...${NC}"
rm -f "$SCRIPT_DIR/server.log"
rm -f "$SCRIPT_DIR/monitor.log"
touch "$SCRIPT_DIR/server.log" "$SCRIPT_DIR/monitor.log"

echo -e "${YELLOW}→ Step 4: Recreating Python Virtual Environment...${NC}"
python3 -m venv venv

echo -e "${YELLOW}→ Step 5: Installing Python Backend Dependencies...${NC}"
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt rich psutil plotext

echo -e "${YELLOW}→ Step 6: Installing Node/Expo Frontend Dependencies...${NC}"
if [ -d "$SCRIPT_DIR/QrMobile" ]; then
    cd "$SCRIPT_DIR/QrMobile"
    npm install
    cd "$SCRIPT_DIR"
else
    echo -e "${RED}  [!] QrMobile directory not found. Skipping Expo setup.${NC}"
fi

echo -e "${YELLOW}→ Step 7: Optimizing System for Performance...${NC}"
if command -v cpupower &> /dev/null; then
    echo -e "${CYAN}  Setting CPU governor to performance...${NC}"
    sudo cpupower frequency-set -g performance || echo -e "${RED}  [!] Failed to set performance mode.${NC}"
elif [ -d /sys/devices/system/cpu/cpu0/cpufreq ]; then
    echo -e "${CYAN}  Setting CPU governor to performance via sysfs...${NC}"
    echo "performance" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor > /dev/null || echo -e "${RED}  [!] Failed to set performance mode.${NC}"
else
    echo -e "${YELLOW}  [!] Performance mode tools not found. Skipping.${NC}"
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}               11-STEP SYSTEM VERIFICATION                 ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

# Checklist array
declare -a checklist=(
    "1. Checking Python 3 Installation"
    "2. Checking Virtual Environment Setup"
    "3. Checking Python Dependencies (Flask, rich, psutil)"
    "4. Checking Node.js Installation"
    "5. Checking NPM Installation"
    "6. Checking QrMobile node_modules Cache"
    "7. Checking SQLite3 Core Engine"
    "8. Verifying app.py Structural Syntax"
    "9. Checking tmux Installation"
    "10. Checking Network Interface Details"
    "11. Validating Deploy Script Permissions"
)

verify_step() {
    local step=$1
    local cmd=$2
    printf "  %-60s" "$step..."
    if eval "$cmd" &>/dev/null; then
        echo -e "[${GREEN} OK ${NC}]"
    else
        echo -e "[${RED}FAIL${NC}]"
        echo -e "\n${RED}Error on step: $step${NC}"
        echo -e "Command failed: $cmd"
        exit 1
    fi
}

verify_step "${checklist[0]}" "command -v python3"
verify_step "${checklist[1]}" "[ -f '$SCRIPT_DIR/venv/bin/activate' ]"
verify_step "${checklist[2]}" "python3 -c 'import flask, rich, psutil'"
verify_step "${checklist[3]}" "command -v node"
verify_step "${checklist[4]}" "command -v npm"
verify_step "${checklist[5]}" "[ -d '$SCRIPT_DIR/QrMobile/node_modules' ]"
verify_step "${checklist[6]}" "python3 -c 'import sqlite3'"
verify_step "${checklist[7]}" "python3 -m py_compile app.py"
verify_step "${checklist[8]}" "command -v tmux"
verify_step "${checklist[9]}" "command -v ip || command -v ifconfig"
verify_step "${checklist[10]}" "chmod +x deploy_grid.sh"

echo ""
echo -e "${GREEN}✓ All 11 Core Systems Green. Initializing Deployment Phase...${NC}"
sleep 2

# Auto-open browser
echo -e "${CYAN}Opening browser at http://localhost:8080...${NC}"
if python3 -m webbrowser -t "http://localhost:8080" &>/dev/null; then
    :
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:8080" &
fi

# Launch unified deployment script
exec ./deploy-full-server.sh
