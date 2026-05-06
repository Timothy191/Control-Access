#!/bin/bash
# Black Arch System - Deployment Script (Updated with Individual Terminal Scripts)

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
    # Note: Individual terminals manage their own cleanup now
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

# Check and install terminal emulators
echo -e "${YELLOW}→ Checking terminal emulators...${NC}"

# Detect package manager
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt-get"
    INSTALL_CMD="sudo apt-get install -y"
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
    INSTALL_CMD="sudo yum install -y"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
    INSTALL_CMD="sudo dnf install -y"
elif command -v pacman &> /dev/null; then
    PKG_MANAGER="pacman"
    INSTALL_CMD="sudo pacman -S --noconfirm"
else
    echo -e "${YELLOW}→ Could not detect package manager. Please install terminals manually:${NC}"
    echo -e "${YELLOW}   sudo apt-get install gnome-terminal konsole xterm${NC}"
    PKG_MANAGER=""
fi

# Install terminal emulators if package manager detected
if [ -n "$PKG_MANAGER" ]; then
    # Check and install gnome-terminal
    if ! command -v gnome-terminal &> /dev/null; then
        echo -e "${YELLOW}→ Installing gnome-terminal...${NC}"
        if [ "$PKG_MANAGER" = "apt-get" ]; then
            $INSTALL_CMD gnome-terminal 2>/dev/null || echo -e "${YELLOW}→ Could not install gnome-terminal automatically${NC}"
        elif [ "$PKG_MANAGER" = "pacman" ]; then
            $INSTALL_CMD gnome-terminal 2>/dev/null || echo -e "${YELLOW}→ Could not install gnome-terminal${NC}"
        else
            echo -e "${YELLOW}→ gnome-terminal not available in repository${NC}"
        fi
    else
        echo -e "${GREEN}→ gnome-terminal already installed${NC}"
    fi
    
    # Check and install konsole - but skip if it's going to install too many packages
    if ! command -v konsole &> /dev/null; then
        echo -e "${YELLOW}→ Note: konsole not installed (optional, skipping to avoid heavy dependencies)${NC}"
        echo -e "${YELLOW}  Install manually if needed: sudo apt-get install konsole${NC}"
    else
        echo -e "${GREEN}→ konsole already installed${NC}"
    fi
    
    # Check and install xterm - lightweight fallback
    if ! command -v xterm &> /dev/null; then
        echo -e "${YELLOW}→ Installing xterm (lightweight terminal)...${NC}"
        $INSTALL_CMD xterm 2>/dev/null || echo -e "${YELLOW}→ Could not install xterm automatically${NC}"
    else
        echo -e "${GREEN}→ xterm already installed${NC}"
    fi
fi

# Verify at least one terminal is available
if command -v gnome-terminal &> /dev/null || command -v konsole &> /dev/null || command -v xterm &> /dev/null; then
    success_msg "Terminal emulators ready"
else
    echo -e "${RED}→ WARNING: No terminal emulator found!${NC}"
    echo -e "${YELLOW}→ Please install one of: gnome-terminal, konsole, or xterm${NC}"
    echo -e "${YELLOW}→ The deployment will continue but may not open separate windows${NC}"
fi

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

# Open browser
echo -e "${YELLOW}→ Opening web browser...${NC}"
if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:8080" 2>/dev/null &
elif command -v open &> /dev/null; then
    open "http://localhost:8080" 2>/dev/null &
else
    echo -e "${YELLOW}→ Could not auto-open browser. Please open http://localhost:8080 manually${NC}"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   OPENING 4 TERMINALS FOR COMPLETE DEPLOYMENT${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}[TERMINAL 1 - LOG VIEWER]${NC}"
echo -e "   → Live colour-coded server + monitor logs"
echo ""
echo -e "${YELLOW}[TERMINAL 2 - WEB SERVER MONITOR]${NC}"
echo -e "   → Python Flask app + auto-restart monitor"
echo ""
echo -e "${YELLOW}[TERMINAL 3 - QR MOBILE APP]${NC}"
echo -e "   → Expo scanner app"
echo ""
echo -e "${YELLOW}[TERMINAL 4 - THIS TERMINAL]${NC}"
echo -e "   → Deployment script (closes after launch)"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# LAUNCH TERMINALS USING INDIVIDUAL SCRIPTS
echo -e "${YELLOW}→ Opening Terminal 1: Live Log Viewer...${NC}"
bash "$SCRIPT_DIR/deploy-log-viewer.sh" &
success_msg "Log Viewer terminal opened (Terminal 1)"

echo ""
echo -e "${YELLOW}→ Opening Terminal 2: Web Server Monitor...${NC}"
bash "$SCRIPT_DIR/deploy-monitor.sh" &
success_msg "Web Server Monitor terminal opened (Terminal 2)"

# Wait for web server to be ready
sleep 3
echo -e "${YELLOW}→ Waiting for web server to be ready...${NC}"

# Health check - wait up to 30 seconds for server to respond
MAX_RETRIES=30
RETRY_COUNT=0
SERVER_READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:8080 > /dev/null 2>&1 || curl -s http://localhost:5000 > /dev/null 2>&1; then
        SERVER_READY=true
        success_msg "Web server is ready!"
        break
    fi
    
    # Check if server is running on alternative port
    if curl -s http://localhost:8081 > /dev/null 2>&1; then
        SERVER_READY=true
        success_msg "Web server is ready on port 8081!"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -e "${YELLOW}  Waiting... ($RETRY_COUNT/$MAX_RETRIES)${NC}"
    sleep 1
done

if [ "$SERVER_READY" = false ]; then
    echo -e "${RED}→ WARNING: Web server may not be ready yet${NC}"
    echo -e "${YELLOW}→ Continuing anyway...${NC}"
fi

# TERMINAL 3: Start Expo / QR Mobile App
echo -e "${YELLOW}→ Opening Terminal 3: QR Mobile App (Expo)...${NC}"
echo -e "${YELLOW}  Checking: QrMobile dir: $([ -d "$PROJECT_DIR/QrMobile" ] && echo 'YES' || echo 'NO')${NC}"
echo -e "${YELLOW}  Checking: npm installed: $(command -v npm &>/dev/null && echo 'YES' || echo 'NO')${NC}"
echo -e "${YELLOW}  Checking: npx installed: $(command -v npx &>/dev/null && echo 'YES' || echo 'NO')${NC}"

if [ ! -d "$PROJECT_DIR/QrMobile" ]; then
    echo -e "${RED}✗ QrMobile directory not found at: $PROJECT_DIR/QrMobile — skipping Terminal 3${NC}"
elif ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed. Install with: sudo apt-get install npm${NC}"
else
    # Install node_modules if missing
    if [ ! -d "$PROJECT_DIR/QrMobile/node_modules" ]; then
        echo -e "${YELLOW}→ node_modules not found, running npm install first...${NC}"
        cd "$PROJECT_DIR/QrMobile" && npm install 2>&1 | tail -5
        cd "$PROJECT_DIR"
    fi

    bash "$SCRIPT_DIR/deploy-qr-mobile.sh" &
    success_msg "QR Mobile Expo terminal opened (Terminal 3)"
fi

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✓ DEPLOYMENT COMPLETE - ALL TERMINALS LAUNCHED${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}[TERMINAL 1]${NC} → Live Log Viewer  (colour-coded merged logs)"
echo -e "${YELLOW}[TERMINAL 2]${NC} → Web Server Monitor  http://${LOCAL_IP}:8080"
echo -e "${YELLOW}[TERMINAL 3]${NC} → QR Mobile Expo   (scan QR in Expo Go)"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}→ API Key:      ${HARDWARE_API_KEY}${NC}"
echo -e "${BLUE}→ Default Login: admin / admin${NC}"
echo -e "${BLUE}→ Log Viewer:   venv/bin/python3 log_viewer.py${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
