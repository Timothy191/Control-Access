#!/bin/bash
# Black Arch System - Tmux-Based Deployment Script
# Uses tmux for better session management and persistence

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
export SCRIPT_DIR

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Error handler
error_exit() {
    echo -e "${RED}✗ Error: $1${NC}" >&2
    exit 1
}

# Success message
success_msg() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Cleanup function
cleanup() {
    echo -e "${YELLOW}→ Cleaning up...${NC}"
    # Kill tmux session on cleanup if requested
    if [ "$KEEP_SESSION" != "true" ]; then
        tmux kill-session -t blackarch_deploy 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

echo -e "${RED}             /\\\\           ${NC}"
echo -e "${RED}            /  \\\\          ${NC}"
echo -e "${RED}           /    \\\\         ${NC}"
echo -e "${RED}          /      \\\\        ${NC}"
echo -e "${RED}         /   ,,   \\\\       ${NC}"
echo -e "${RED}        /   |  |   \\\\      ${NC}"
echo -e "${RED}       /_-''    ''-_\\\\     ${NC}"
echo -e "${RED}         B L A C K         ${NC}"
echo -e "${RED}   M I N E  S Y S T E M    ${NC}"
echo ""
echo -e "${BLUE}▶ Black Arch System - Secure Deployment Phase${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    error_exit "Python 3 is not installed. Please install Python 3.8 or higher."
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
success_msg "Python ${PYTHON_VERSION}"

# Check required files exist
[ -f "app.py" ] || error_exit "app.py not found in current directory"
[ -f "requirements.txt" ] || error_exit "requirements.txt not found in current directory"

# Verify app.py syntax
echo -e "${YELLOW}→ Checking app.py syntax...${NC}"
python3 -m py_compile "app.py" || error_exit "app.py has syntax errors"
success_msg "app.py syntax OK"

# Setup venv
VENV_DIR="$PROJECT_DIR/venv"
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}→ Creating virtual environment...${NC}"
    python3 -m venv "$VENV_DIR" || error_exit "Failed to create virtual environment"
    success_msg "Virtual environment created"
fi

# Activate venv
source "$VENV_DIR/bin/activate" || error_exit "Failed to activate virtual environment"

# Install dependencies (skip if --no-install flag is passed)
if [ "$1" != "--no-install" ]; then
    echo -e "${YELLOW}→ Installing dependencies...${NC}"
    python3 -m pip install --upgrade pip --quiet 2>/dev/null || true
    python3 -m pip install -r requirements.txt rich psutil plotext 2>/dev/null || python3 -m pip install --break-system-packages -r requirements.txt rich psutil plotext || error_exit "Failed to install dependencies"
    success_msg "Dependencies installed"
fi

# Verify database exists or create it
if [ ! -f "mine_management.db" ]; then
    echo -e "${YELLOW}→ Initializing database...${NC}"
    python3 -c "from database import init_db; init_db()" 2>/dev/null || echo -e "${YELLOW}→ Database will be initialized on first run${NC}"
fi

# Scan and kill processes on relevant ports
echo -e "${YELLOW}→ Scanning and cleaning up ports...${NC}"
PORTS_TO_CLEAN=(8080 8081 19000 19001 19002 5000 5001 3000 8000)

for port in "${PORTS_TO_CLEAN[@]}"; do
    echo -e "${YELLOW}→ Checking port ${port}...${NC}"
    
    # Method 1: Using lsof
    if command -v lsof &> /dev/null; then
        PIDS=$(lsof -ti ":$port" 2>/dev/null || true)
        if [ -n "$PIDS" ]; then
            echo -e "${RED}→ Killing processes on port ${port}: ${PIDS}${NC}"
            for pid in $PIDS; do
                kill -TERM "$pid" 2>/dev/null || true
                sleep 1
                # Force kill if still running
                if kill -0 "$pid" 2>/dev/null; then
                    kill -KILL "$pid" 2>/dev/null || true
                fi
            done
            success_msg "Port ${port} cleaned up"
        else
            echo -e "${GREEN}→ Port ${port} is free${NC}"
        fi
    fi
    
    # Method 2: Using fuser (fallback)
    if command -v fuser &> /dev/null; then
        fuser -k "${port}/tcp" 2>/dev/null || true
    fi
    
    # Method 3: Using pkill for python processes
    pkill -f "python.*app.py" 2>/dev/null || true
    pkill -f "python.*monitor.py" 2>/dev/null || true
    pkill -f "python.*log_viewer.py" 2>/dev/null || true
    pkill -f "python.*:.*${port}" 2>/dev/null || true
    pkill -f "npx expo" 2>/dev/null || true
    pkill -f "node.*expo" 2>/dev/null || true
    pkill -f "node.*react-native" 2>/dev/null || true
done

# Wait a moment for processes to die
echo -e "${YELLOW}→ Waiting for processes to terminate...${NC}"
sleep 3

# Verify ports are now free
echo -e "${YELLOW}→ Verifying ports are free...${NC}"
for port in "${PORTS_TO_CLEAN[@]}"; do
    if command -v lsof &> /dev/null; then
        PIDS=$(lsof -ti ":$port" 2>/dev/null || true)
        if [ -n "$PIDS" ]; then
            echo -e "${RED}→ Warning: Port ${port} still in use by: ${PIDS}${NC}"
        else
            echo -e "${GREEN}→ Port ${port} is confirmed free${NC}"
        fi
    fi
done

success_msg "Port cleanup completed"

# Generate and configure API keys
echo -e "${YELLOW}→ Configuring API keys...${NC}"

# Generate secure hardware API key if not set
if [ -z "$HARDWARE_API_KEY" ]; then
    HARDWARE_API_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    echo -e "${GREEN}→ Generated Hardware API Key: ${HARDWARE_API_KEY}${NC}"
else
    echo -e "${GREEN}→ Using existing Hardware API Key${NC}"
fi

# Set environment variables
export HARDWARE_API_KEY="$HARDWARE_API_KEY"

# Update app.py with new hardware key
echo -e "${YELLOW}→ Updating application configuration...${NC}"
python3 -c "
import re
import os
hardware_key = os.environ.get('HARDWARE_API_KEY', 'default-key')
with open('app.py', 'r') as f:
    content = f.read()
# Update default hardware key
content = re.sub(
    r'os\.environ\.get\(\"HARDWARE_API_KEY\", \"[^\"]+\"\)',
    f'os.environ.get(\"HARDWARE_API_KEY\", \"{hardware_key}\")',
    content
)
with open('app.py', 'w') as f:
    f.write(content)
print('✓ Updated app.py with hardware API key')
"

# Check for optional API keys
if [ -z "$GOOGLE_API_KEY" ]; then
    echo -e "${YELLOW}→ Note: GOOGLE_API_KEY not set (AI chat disabled)${NC}"
fi

success_msg "API Keys configured"
echo ""

# Get local IP for mobile app
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo -e "${BLUE}→ Local IP: ${LOCAL_IP}${NC}"

# Update mobile app configuration
echo -e "${YELLOW}→ Configuring QR Mobile app...${NC}"
cd QrMobile 2>/dev/null || echo -e "${YELLOW}→ QrMobile directory not found, skipping mobile app config${NC}"

if [ -f "App.js" ]; then
    # Update server IP in mobile app
    python3 -c "
import re
with open('App.js', 'r') as f:
    content = f.read()
# Update default server IP
content = re.sub(
    r'const \[savedIp, savedPort\] = await Promise\.all\(\[.*?\]\);',
    f'const [savedIp, savedPort] = await Promise.all([AsyncStorage.getItem(STORAGE_KEYS.SERVER_IP), AsyncStorage.getItem(STORAGE_KEYS.SERVER_PORT)]);',
    content
)
with open('App.js', 'w') as f:
    f.write(content)
print('✓ Updated mobile app configuration')
"
    success_msg "QR Mobile app configured"
fi

cd "$PROJECT_DIR" 2>/dev/null || cd ..

# Sync API key with mobile app
echo -e "${YELLOW}→ Syncing API key with mobile app...${NC}"
if [ -f "QrMobile/App.js" ]; then
    python3 -c "
import re
import os

# Get the API key - use mobile key or hardware key
api_key = os.environ.get('HARDWARE_API_KEY', 'ab22b3e234e5cc2f6a9377490da6be0c')

with open('QrMobile/App.js', 'r') as f:
    content = f.read()

# Update the API_KEY constant
content = re.sub(
    r\"const API_KEY = '[^']+';\",
    f\"const API_KEY = '{api_key}';\",
    content
)

with open('QrMobile/App.js', 'w') as f:
    f.write(content)
print('✓ Updated QrMobile/App.js with API key')
"
    success_msg "Mobile app API key synced"
fi

success_msg "Ready"
echo ""
echo -e "${BLUE}→ Starting server at http://localhost:8080${NC}"
echo -e "${BLUE}→ Scanner API at http://${LOCAL_IP}:8080/api/scan_qr${NC}"
echo ""

# TMUX-BASED TERMINAL DEPLOYMENT
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   LAUNCHING TMUX SESSION WITH ALL TERMINALS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Check if tmux is available
if ! command -v tmux &> /dev/null; then
    echo -e "${YELLOW}→ tmux not found, falling back to individual terminals${NC}"
    # Fallback to original method
    bash "$SCRIPT_DIR/deploy-log-viewer.sh" &
    bash "$SCRIPT_DIR/deploy-monitor.sh" &
    if [ -d "$PROJECT_DIR/QrMobile" ] && command -v npm &> /dev/null; then
        bash "$SCRIPT_DIR/deploy-qr-mobile.sh" &
    fi
    success_msg "Terminals launched (fallback method)"
else
    # Create tmux session
    SESSION_NAME="blackarch_deploy"
    
    # Kill existing session if any
    tmux kill-session -t $SESSION_NAME 2>/dev/null || true
    
    # Create new tmux session
    tmux new-session -d -s $SESSION_NAME -n "Log Viewer"
    
    # Configure tmux for better experience
    tmux set-option -t $SESSION_NAME mouse on
    tmux set-option -t $SESSION_NAME history-limit 10000
    tmux set-option -t $SESSION_NAME base-index 1
    tmux set-option -t $SESSION_NAME pane-base-index 1
    
    # Create windows for each terminal
    tmux new-window -t $SESSION_NAME -n "Monitor"
    tmux new-window -t $SESSION_NAME -n "QR Mobile"
    
    # Send commands to each pane
    tmux send-keys -t $SESSION_NAME:Log\ Viewer.1 "cd '$PROJECT_DIR' && source venv/bin/activate && python3 log_viewer.py; echo \"Log viewer exited. Press Enter to close...\"; read" C-m
    tmux send-keys -t $SESSION_NAME:Monitor.1 "cd '$PROJECT_DIR' && clear && source venv/bin/activate && python3 monitor.py; echo \"Monitor exited. Press Enter to close...\"; read" C-m
    
    # QR Mobile window (only if directory exists and npm available)
    if [ -d "$PROJECT_DIR/QrMobile" ] && command -v npm &> /dev/null; then
        tmux send-keys -t $SESSION_NAME:QR\ Mobile.1 "cd '$PROJECT_DIR/QrMobile' && source ../venv/bin/activate && npx expo start --tunnel; echo \"Expo exited. Press Enter to close...\"; read" C-m
    else
        # If QR mobile not available, create a helpful message window
        tmux new-window -t $SESSION_NAME -n "Info"
        tmux send-keys -t $SESSION_NAME:Info.1 "echo 'QR Mobile not available'; echo 'Check that QrMobile directory exists and npm is installed'; read" C-m
    fi
    
    # Select the first window (Log Viewer) as default
    tmux select-window -t $SESSION_NAME:1
    
    # Attach to the tmux session
    echo -e "${YELLOW}→ Attaching to tmux session: $SESSION_NAME${NC}"
    echo -e "${YELLOW}→ Press Ctrl+B then D to detach from session without closing it${NC}"
    echo -e "${YELLOW}→ To reattach later: tmux attach-session -t $SESSION_NAME${NC}"
    echo ""
    
    # Attach to session
    tmux attach-session -t $SESSION_NAME
    
    success_msg "Tmux session deployed successfully"
fi

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✓ DEPLOYMENT COMPLETE - TMUX SESSION ACTIVE${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}[SESSION]${NC} → blackarch_deploy"
echo -e "${YELLOW}[WINDOW 1]${NC} → Log Viewer"
echo -e "${YELLOW}[WINDOW 2]${NC} → Monitor"
if [ -d "$PROJECT_DIR/QrMobile" ] && command -v npm &> /dev/null; then
    echo -e "${YELLOW}[WINDOW 3]${NC} → QR Mobile Expo"
fi
echo ""
echo -e "${BLUE}══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}→ API Key:      ${HARDWARE_API_KEY}${NC}"
echo -e "${BLUE}→ Default Login: admin / admin${NC}"
echo -e "${BLUE}→ To detach:    Ctrl+B then D${NC}"
echo -e "${BLUE}→ To reattach:  tmux attach-session -t blackarch_deploy${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════${NC}"
echo ""
