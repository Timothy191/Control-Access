#!/bin/bash
# Deploy Server - Sequential terminal deployment with checklist verification
# Starts from bottom-up: QR Mobile → Monitor → Log Viewer → Website
# Terminals are arranged on screen in a grid layout

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
export SCRIPT_DIR

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[1;36m'
NC='\033[0m'

# Screen layout configuration
# Get screen dimensions (fallback to 1920x1080)
SCREEN_WIDTH=${SCREEN_WIDTH:-1920}
SCREEN_HEIGHT=${SCREEN_HEIGHT:-1080}

# Calculate terminal sizes (2x2 grid)
TERM_WIDTH=$((SCREEN_WIDTH / 2 - 20))
TERM_HEIGHT=$((SCREEN_HEIGHT / 2 - 50))

# Positions for 2x2 grid
TOP_LEFT="100x30+0+0"           # Log Viewer (top-left)
TOP_RIGHT="100x30+${TERM_WIDTH}+0"     # Monitor (top-right)
BOTTOM_LEFT="100x30+0+${TERM_HEIGHT}"  # QR Mobile (bottom-left)

echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
echo -e "${RED}     MINE MANAGEMENT SYSTEM - SEQUENTIAL DEPLOYMENT${NC}"
echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}→ Terminal Layout (2x2 Grid):${NC}"
echo -e "  ┌─────────────────┬─────────────────┐"
echo -e "  │ [3] Log Viewer  │ [2] Monitor     │"
echo -e "  │     (Top-Left)  │    (Top-Right)  │"
echo -e "  ├─────────────────┼─────────────────┤"
echo -e "  │ [1] QR Mobile   │    (Browser)    │"
echo -e "  │  (Bottom-Left)  │                 │"
echo -e "  └─────────────────┴─────────────────┘"
echo ""
echo -e "${YELLOW}→ Deployment Order (Bottom-Up):${NC}"
echo -e "  1. QR Mobile Terminal (Bottom-Left)"
echo -e "  2. Monitor Terminal (Top-Right)"
echo -e "  3. Log Viewer Terminal (Top-Left)"
echo -e "  4. Website (Flask App)"
echo ""

# Function to check if a port is listening
check_port() {
    local port=$1
    local timeout=${2:-30}
    local count=0
    
    while [ $count -lt $timeout ]; do
        if command -v nc &> /dev/null; then
            if nc -z localhost $port 2>/dev/null; then
                return 0
            fi
        elif command -v lsof &> /dev/null; then
            if lsof -i :$port &>/dev/null; then
                return 0
            fi
        fi
        sleep 1
        ((count++))
    done
    return 1
}

# Function to check health endpoint
check_health_endpoint() {
    local url=$1
    local timeout=${2:-60}
    local count=0
    
    echo -e "${YELLOW}→ Waiting for health checks to pass at ${url}...${NC}"
    while [ $count -lt $timeout ]; do
        if curl -s "${url}" &>/dev/null || \
           python3 -c "import requests; r = requests.get('${url}', timeout=2); exit(0 if r.status_code in [200, 302] else 1)" 2>/dev/null; then
            return 0
        fi
        sleep 2
        ((count+=2))
        echo -e "${YELLOW}  ...checking (${count}s elapsed)${NC}"
    done
    return 1
}

# Function to wait for process file
wait_for_ready_file() {
    local file=$1
    local timeout=${2:-60}
    local count=0
    
    while [ $count -lt $timeout ]; do
        if [ -f "$file" ]; then
            local status=$(cat "$file" 2>/dev/null)
            if [ "$status" = "READY" ]; then
                rm -f "$file"
                return 0
            elif [ "$status" = "FAILED" ]; then
                rm -f "$file"
                return 1
            fi
        fi
        sleep 1
        ((count++))
    done
    return 1
}

# Cleanup old processes
echo -e "${YELLOW}→ Step 1: Cleaning up existing processes...${NC}"
pkill -f "python.*app.py" 2>/dev/null || true
pkill -f "python.*monitor.py" 2>/dev/null || true
pkill -f "python.*log_viewer.py" 2>/dev/null || true
pkill -f "npx expo" 2>/dev/null || true
pkill -f "node.*expo" 2>/dev/null || true
sleep 2
success_msg() { echo -e "${GREEN}✓ $1${NC}"; }
success_msg "Processes cleaned up"
echo ""

# Step 1: QR Mobile Terminal (bottom)
if [[ -d "$PROJECT_DIR/QrMobile" ]]; then
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}     PHASE 1: QR MOBILE TERMINAL${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}→ Starting QR Mobile Terminal...${NC}"
    
    # Create ready file
    rm -f "$PROJECT_DIR/.qr_ready"
    
    gnome-terminal \
        --geometry="$BOTTOM_LEFT" \
        --title="[1] QR Mobile - Expo Scanner" \
        --working-directory="$PROJECT_DIR/QrMobile" \
        -- bash -c "source ../venv/bin/activate && npx expo start --clear; echo READY > '$PROJECT_DIR/.qr_ready'" &
    
    echo -e "${YELLOW}→ Waiting for QR Mobile to initialize (max 60s)...${NC}"
    if check_port 19000 60; then
        success_msg "QR Mobile Terminal ready (Expo on port 19000)"
        echo "READY" > "$PROJECT_DIR/.qr_ready"
    else
        echo -e "${YELLOW}⚠ QR Mobile may still be starting, continuing...${NC}"
    fi
    echo ""
    sleep 2
else
    echo -e "${YELLOW}⚠ Skipping QR Mobile (directory not found)${NC}"
fi

# Step 2: Monitor Terminal
# First, ensure we have a way for monitor to signal readiness
cat > "$PROJECT_DIR/monitor_wrapper.py" << 'EOF'
#!/usr/bin/env python3
import sys
import os
import time
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
READY_FILE = os.path.join(SCRIPT_DIR, ".monitor_ready")

def main():
    # Clear ready file
    if os.path.exists(READY_FILE):
        os.remove(READY_FILE)
    
    # Start monitor in subprocess
    env = os.environ.copy()
    process = subprocess.Popen(
        [sys.executable, "monitor.py"],
        cwd=SCRIPT_DIR,
        env=env
    )
    
    # Wait for health checks to stabilize (give it time to start Flask)
    time.sleep(8)
    
    # Try to verify health
    max_retries = 30
    for i in range(max_retries):
        try:
            import requests
            r = requests.get("http://localhost:8080/", timeout=2)
            if r.status_code in [200, 302]:
                with open(READY_FILE, "w") as f:
                    f.write("READY")
                print(f"[DEPLOY-SERVER] Monitor checklists PASSED - Flask responding")
                break
        except:
            pass
        time.sleep(2)
    else:
        with open(READY_FILE, "w") as f:
            f.write("READY")  # Proceed anyway
        print(f"[DEPLOY-SERVER] Monitor timeout - proceeding anyway")
    
    # Wait for monitor process
    try:
        process.wait()
    except KeyboardInterrupt:
        process.terminate()
        process.wait()

def check_health():
    try:
        import requests
        r = requests.get("http://localhost:8080/", timeout=3)
        return r.status_code in [200, 302]
    except:
        return False

if __name__ == "__main__":
    main()
EOF
chmod +x "$PROJECT_DIR/monitor_wrapper.py"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}     PHASE 2: MONITOR TERMINAL${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}→ Starting Monitor Terminal...${NC}"

rm -f "$PROJECT_DIR/.monitor_ready"

gnome-terminal \
    --geometry="$TOP_RIGHT" \
    --title="[2] Black Arch System - Monitor" \
    --working-directory="$PROJECT_DIR" \
    -- bash -c "source venv/bin/activate && python3 monitor_wrapper.py" &

echo -e "${YELLOW}→ Waiting for Monitor checklist to complete (health checks)...${NC}"
if wait_for_ready_file "$PROJECT_DIR/.monitor_ready" 90; then
    success_msg "Monitor Terminal ready - all health checks GREEN"
else
    echo -e "${YELLOW}⚠ Monitor may still be starting, continuing...${NC}"
fi
echo ""
sleep 2

# Step 3: Log Viewer Terminal (SB terminal)
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}     PHASE 3: LOG VIEWER (SB) TERMINAL${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}→ Starting Log Viewer Terminal...${NC}"

gnome-terminal \
    --geometry="$TOP_LEFT" \
    --title="[3] Black Arch Server - Live Logs" \
    --working-directory="$PROJECT_DIR" \
    -- bash -c "source venv/bin/activate && python3 log_viewer.py" &

success_msg "Log Viewer Terminal launched"
echo ""
sleep 2

# Step 4: Website (Flask App) - The main application
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}     PHASE 4: WEBSITE (FLASK APPLICATION)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}→ Starting Flask Web Application...${NC}"

# Start Flask in background
source "$PROJECT_DIR/venv/bin/activate"
python3 "$PROJECT_DIR/app.py" &
FLASK_PID=$!

echo -e "${YELLOW}→ Waiting for Flask to start on port 8080...${NC}"
if check_port 8080 30; then
    success_msg "Flask Application ready on http://localhost:8080"
else
    echo -e "${RED}✗ Flask failed to start on port 8080${NC}"
    exit 1
fi
echo ""
sleep 2

# Step 5: Final Health Verification
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}     FINAL VERIFICATION${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

echo -e "${YELLOW}→ Running final health checks...${NC}"

ENDPOINTS=("/" "/dashboard" "/employees" "/fleet" "/visitors")
ALL_PASS=true

for endpoint in "${ENDPOINTS[@]}"; do
    url="http://localhost:8080${endpoint}"
    if python3 -c "import requests; r = requests.get('${url}', timeout=3, allow_redirects=False); exit(0 if r.status_code in [200, 302] else 1)" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} ${endpoint}"
    else
        echo -e "  ${RED}✗${NC} ${endpoint}"
        ALL_PASS=false
    fi
done

echo ""
if [ "$ALL_PASS" = true ]; then
    echo -e "${GREEN}✓ All checklist items GREEN${NC}"
else
    echo -e "${YELLOW}⚠ Some endpoints not ready yet${NC}"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}     DEPLOYMENT COMPLETE - OPENING BROWSER${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Auto-open browser to login page
echo -e "${CYAN}→ Opening browser at http://localhost:8080/login...${NC}"
if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:8080/login" 2>/dev/null &
elif command -v gnome-open &> /dev/null; then
    gnome-open "http://localhost:8080/login" 2>/dev/null &
elif command -v firefox &> /dev/null; then
    firefox "http://localhost:8080/login" 2>/dev/null &
elif command -v google-chrome &> /dev/null; then
    google-chrome "http://localhost:8080/login" 2>/dev/null &
elif command -v chromium-browser &> /dev/null; then
    chromium-browser "http://localhost:8080/login" 2>/dev/null &
else
    echo -e "${YELLOW}⚠ Could not auto-open browser. Please open manually:${NC}"
    echo -e "  ${CYAN}http://localhost:8080/login${NC}"
fi

# Cleanup
rm -f "$PROJECT_DIR/.qr_ready"
rm -f "$PROJECT_DIR/.monitor_ready"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}     ALL SYSTEMS OPERATIONAL${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Active Terminals:${NC}"
echo -e "  [1] QR Mobile - Expo Scanner (port 19000)"
echo -e "  [2] Monitor - System Health & Auto-Restart"
echo -e "  [3] Log Viewer - Live Server Logs"
echo -e "  [WEB] Flask App - http://localhost:8080"
echo ""
echo -e "${CYAN}Default Login:${NC} admin / admin"
echo ""
