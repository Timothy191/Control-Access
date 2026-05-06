#!/bin/bash

# QR Mobile App Startup Script
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${BLUE}▶ QR Mobile App Launcher${NC}"

# Check if QrMobile directory exists
if [ ! -d "QrMobile" ]; then
    error_exit "QrMobile directory not found. Please ensure the mobile app is present."
fi

cd QrMobile

# Check if Node.js and npm are installed
if ! command -v node &> /dev/null; then
    error_exit "Node.js is not installed. Please install Node.js first."
fi

if ! command -v npm &> /dev/null; then
    error_exit "npm is not installed. Please install npm first."
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
success_msg "Node.js ${NODE_VERSION}"
success_msg "npm ${NPM_VERSION}"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}→ Installing dependencies...${NC}"
    npm install || error_exit "Failed to install dependencies"
    success_msg "Dependencies installed"
fi

# Get local IP for server configuration
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo -e "${BLUE}→ Local IP: ${LOCAL_IP}${NC}"

# Start the app in a new terminal window
echo -e "${YELLOW}→ Starting QR Mobile app...${NC}"

# Try different terminal emulators
if command -v gnome-terminal &> /dev/null; then
    echo -e "${GREEN}→ Using gnome-terminal${NC}"
    gnome-terminal --title="QR Mobile Scanner" --working-directory="$(pwd)" -- bash -c "echo 'Starting QR Mobile Scanner...'; npm start; exec bash" &
    TERMINAL_PID=$!
elif command -v xterm &> /dev/null; then
    echo -e "${GREEN}→ Using xterm${NC}"
    xterm -title "QR Mobile Scanner" -e "cd $(pwd) && echo 'Starting QR Mobile Scanner...' && npm start" &
    TERMINAL_PID=$!
elif command -v konsole &> /dev/null; then
    echo -e "${GREEN}→ Using konsole${NC}"
    konsole --title "QR Mobile Scanner" --workdir "$(pwd)" -e bash -c "echo 'Starting QR Mobile Scanner...'; npm start; exec bash" &
    TERMINAL_PID=$!
else
    echo -e "${YELLOW}→ No suitable terminal found, starting in background${NC}"
    npm start &
    TERMINAL_PID=$!
fi

success_msg "QR Mobile app started (PID: $TERMINAL_PID)"

echo ""
echo -e "${GREEN}=== QR Mobile App Started ===${NC}"
echo -e "${BLUE}→ Server IP: ${LOCAL_IP}${NC}"
echo -e "${BLUE}→ Scanner Port: 8081${NC}"
echo -e "${BLUE}→ API Endpoint: http://${LOCAL_IP}:8081/api/scan_qr${NC}"
echo -e "${BLUE}→ Hardware API Key: Check main server logs${NC}"
echo ""

# Wait a moment for the app to start
sleep 2

echo -e "${YELLOW}→ QR Mobile app should now be running in a separate terminal${NC}"
echo -e "${YELLOW}→ Configure the server IP in the app settings: ${LOCAL_IP}:8081${NC}"
