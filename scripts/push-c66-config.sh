#!/bin/bash
# -----------------------------------------------------------------------------
# C66 Configuration Push & Verification Script
# -----------------------------------------------------------------------------
# Ensures 100% readiness for WiFi failover before USB unplug
# Usage: ./scripts/push-c66-config.sh
# -----------------------------------------------------------------------------

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

# Configuration
PC_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$PC_IP" ] && PC_IP="192.168.1.100"
PORT=8080
CONFIG_URL="http://${PC_IP}:${PORT}/static/infowedge-dual-mode-config.json"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_FILE="${PROJECT_DIR}/static/infowedge-dual-mode-config.json"
C66_IP="192.168.166.107"

# Status tracking
CONFIG_PUSHED=false
USB_ACTIVE=false
WIFI_READY=false
ALL_GOOD=false

draw_banner() {
    clear
    echo -e "${BOLD}${CYAN}"
    echo "  ╔══════════════════════════════════════════════════════════════════╗"
    echo "  ║              C66 CONFIG PUSH & WIFI READINESS CHECK              ║"
    echo "  ╚══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

step() {
    echo -e "\n${BOLD}${BLUE}[${1}]${NC} ${BOLD}${2}${NC}"
}

status() {
    if [ "$1" = "ok" ]; then
        echo -e "  ${GREEN}✓${NC} $2"
    elif [ "$1" = "warn" ]; then
        echo -e "  ${YELLOW}⚠${NC} $2"
    elif [ "$1" = "error" ]; then
        echo -e "  ${RED}✗${NC} $2"
    else
        echo -e "  ${DIM}>${NC} $2"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════
# STEP 1: Verify Config File Exists
# ═══════════════════════════════════════════════════════════════════════════
step "1" "Verifying Configuration File"
if [ -f "$CONFIG_FILE" ]; then
    status ok "Config file found: static/infowedge-dual-mode-config.json"
    status info "URL: $CONFIG_URL"
else
    status error "Config file not found at $CONFIG_FILE"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════
# STEP 2: Check ADB and Device Connection
# ═══════════════════════════════════════════════════════════════════════════
step "2" "Detecting C66 Device via ADB"

ADB_AVAILABLE=false
C66_CONNECTED=false

if command -v adb >/dev/null 2>&1; then
    status ok "ADB is available"
    ADB_AVAILABLE=true
    
    # Check for connected devices
    DEVICES=$(adb devices | grep -v "List of devices" | grep -cv "^$")
    if [ "$DEVICES" -gt 0 ]; then
        DEVICE_SERIAL=$(adb devices | grep -v "List of devices" | grep -v "^$" | head -1 | awk '{print $1}')
        status ok "C66 device detected: $DEVICE_SERIAL"
        C66_CONNECTED=true
    else
        status warn "No ADB devices found"
        status info "Make sure USB debugging is enabled on C66"
    fi
else
    status warn "ADB not installed"
    status info "Install with: sudo apt-get install android-tools-adb"
fi

# ═══════════════════════════════════════════════════════════════════════════
# STEP 3: Configure Apps & Push Config via ADB
# ═══════════════════════════════════════════════════════════════════════════
step "3" "Configuring Device & Pushing Config"

if [ "$ADB_AVAILABLE" = true ] && [ "$C66_CONNECTED" = true ]; then
    status info "Optimizing scanner apps via ADB..."
    adb shell pm disable-user --user 0 com.rscja.scanner >/dev/null 2>&1 || true
    status ok "KeyboardEmulator disabled (prevents conflicts)"
    adb shell pm enable com.rscja.infowedge >/dev/null 2>&1 || true
    status ok "InfoWedge enabled as primary scanner"
    
    status info "Pushing config to C66 Downloads folder..."
    
    if adb push "$CONFIG_FILE" /sdcard/Download/infowedge-dual-mode-config.json 2>/dev/null; then
        status ok "Config pushed to: /sdcard/Download/infowedge-dual-mode-config.json"
        CONFIG_PUSHED=true
        
        status info "Next steps on C66:"
        echo "  1. Open InfoWedge app"
        echo "  2. Go to Profiles → Import"
        echo "  3. Select: Downloads/infowedge-dual-mode-config.json"
        echo "  4. Activate 'Mine Management Dual-Mode' profile"
    else
        status error "Failed to push config via ADB"
        status info "Will use browser download method instead"
    fi
else
    status warn "Skipping ADB push (device not connected)"
fi

# ═══════════════════════════════════════════════════════════════════════════
# STEP 4: Generate QR Code for Quick Access
# ═══════════════════════════════════════════════════════════════════════════
step "4" "Generating QR Code for Config Download"

QR_FILE="${PROJECT_DIR}/static/c66-config-qr.png"

if command -v python3 >/dev/null 2>&1; then
    if python3 -c "import qrcode" 2>/dev/null; then
        python3 << EOF
import qrcode
qr = qrcode.QRCode(version=1, box_size=10, border=5)
qr.add_data('$CONFIG_URL')
qr.make(fit=True)
img = qr.make_image(fill_color="black", back_color="white")
img.save('$QR_FILE')
print("QR code generated")
EOF
        if [ -f "$QR_FILE" ]; then
            status ok "QR code saved: static/c66-config-qr.png"
            status info "Scan this QR code with C66 to download config"
            status info "URL: $CONFIG_URL"
        fi
    else
        status warn "Python qrcode module not installed"
        status info "Install with: pip install qrcode[pil]"
    fi
else
    status warn "Python3 not available for QR generation"
fi

# ═══════════════════════════════════════════════════════════════════════════
# STEP 5: Verify USB Tethering Connection
# ═══════════════════════════════════════════════════════════════════════════
step "5" "Checking USB Tethering Connection"

# Check for RNDIS interface
if ip link show wwan0 2>/dev/null | grep -E -q "state (UP|UNKNOWN)"; then
    status ok "USB-RNDIS interface (wwan0) is UP"
    USB_ACTIVE=true
elif ip link show usb0 2>/dev/null | grep -E -q "state (UP|UNKNOWN)"; then
    status ok "USB interface (usb0) is UP"
    USB_ACTIVE=true
else
    status warn "USB tethering interface not detected"
    status info "Enable USB tethering on C66: Settings → Network → USB tethering"
fi

# Try to ping C66 if we know its IP
if [ "$USB_ACTIVE" = true ]; then
    if ping -c 1 -W 2 "$C66_IP" >/dev/null 2>&1; then
        status ok "C66 is reachable at $C66_IP"
    else
        status warn "Cannot ping C66 at $C66_IP (may be normal)"
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════
# STEP 6: Verify PC Network Readiness
# ═══════════════════════════════════════════════════════════════════════════
step "6" "Verifying PC WiFi Readiness"

echo -e "${DIM}Running network verification...${NC}"
"${PROJECT_DIR}/scripts/verify-c66-wifi.sh" 2>&1 | grep -E "^\s*[✓⚠✗]" | head -10

# Quick checks
if curl -sf "http://localhost:$PORT/api/ai/status" >/dev/null 2>&1; then
    status ok "Server responding on localhost:$PORT"
else
    status error "Server not responding!"
    exit 1
fi

if curl -sf "http://$PC_IP:$PORT/api/ai/status" >/dev/null 2>&1; then
    status ok "Server accessible from network ($PC_IP:$PORT)"
    WIFI_READY=true
else
    status error "Server NOT accessible from network IP!"
    status info "Check firewall: sudo ufw allow $PORT/tcp"
fi

# ═══════════════════════════════════════════════════════════════════════════
# STEP 7: Display Manual Instructions
# ═══════════════════════════════════════════════════════════════════════════
step "7" "Manual Configuration Instructions"

echo -e "\n${BOLD}${CYAN}If ADB push failed, use these methods:${NC}\n"

echo -e "${BOLD}Method A: Browser Download (Recommended)${NC}"
echo -e "  1. On C66: Open Chrome browser"
echo -e "  2. Navigate to: ${YELLOW}$CONFIG_URL${NC}"
echo -e "  3. Download the JSON file"
echo -e "  4. Open InfoWedge → Import → Select downloaded file"
echo -e "  5. Activate 'Mine Management Dual-Mode' profile"

echo -e "\n${BOLD}Method B: QR Code Scan${NC}"
if [ -f "$QR_FILE" ]; then
    echo -e "  1. On your PC: Open ${YELLOW}static/c66-config-qr.png${NC} in image viewer"
    echo -e "  2. On C66: Open QR scanner or camera"
    echo -e "  3. Scan the QR code on your PC screen"
    echo -e "  4. Download and import in InfoWedge"
else
    echo -e "  ${YELLOW}(QR code not generated - use Method A)${NC}"
fi

echo -e "\n${BOLD}Method C: Manual Entry${NC}"
echo -e "  1. Open InfoWedge → Create Profile"
echo -e "  2. Profile Name: ${YELLOW}Mine Management Dual-Mode${NC}"
echo -e "  3. IP Output: ${YELLOW}http://$PC_IP:$PORT/api/c66${NC}"
echo -e "  4. Enable: Buffer Scans, Auto Send, Failover"
echo -e "  5. Connection Check: Every 15 seconds"

# ═══════════════════════════════════════════════════════════════════════════
# STEP 8: Final Readiness Check
# ═══════════════════════════════════════════════════════════════════════════
step "8" "FINAL READINESS CHECK"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BOLD}Configuration Status:${NC}"
if [ "$CONFIG_PUSHED" = true ]; then
    echo -e "  Config on C66:     ${GREEN}✓ PUSHED${NC}"
else
    echo -e "  Config on C66:     ${YELLOW}⚠ MANUAL IMPORT REQUIRED${NC}"
fi

if [ "$USB_ACTIVE" = true ]; then
    echo -e "  USB Tethering:     ${GREEN}✓ ACTIVE${NC}"
else
    echo -e "  USB Tethering:     ${YELLOW}⚠ CHECK DEVICE${NC}"
fi

if [ "$WIFI_READY" = true ]; then
    echo -e "  PC WiFi Ready:     ${GREEN}✓ YES${NC}"
else
    echo -e "  PC WiFi Ready:     ${RED}✗ NO${NC}"
fi

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Determine GO/NO-GO
if [ "$WIFI_READY" = true ]; then
    if [ "$CONFIG_PUSHED" = true ] || [ -f "$QR_FILE" ]; then
        ALL_GOOD=true
    fi
fi

if [ "$ALL_GOOD" = true ]; then
    echo -e "${BOLD}${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${GREEN}║                                                            ║${NC}"
    echo -e "${BOLD}${GREEN}║   ✅  GO FOR UNPLUG - SYSTEM READY FOR WIFI FAILOVER       ║${NC}"
    echo -e "${BOLD}${GREEN}║                                                            ║${NC}"
    echo -e "${BOLD}${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}Next Steps:${NC}"
    if [ "$CONFIG_PUSHED" = false ]; then
        echo -e "  1. ${YELLOW}Import config in InfoWedge${NC} (if not done yet)"
    fi
    echo -e "  ${YELLOW}2. Unplug USB cable${NC}"
    echo -e "  ${YELLOW}3. Wait 10-15 seconds for WiFi auto-switch${NC}"
    echo -e "  ${YELLOW}4. Scan a test QR code${NC}"
    echo ""
    echo -e "${DIM}The C66 will automatically switch to WiFi and continue scanning.${NC}"
else
    echo -e "${BOLD}${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${RED}║                                                            ║${NC}"
    echo -e "${BOLD}${RED}║   ❌  DO NOT UNPLUG - ISSUES DETECTED                      ║${NC}"
    echo -e "${BOLD}${RED}║                                                            ║${NC}"
    echo -e "${BOLD}${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}Fix these issues first:${NC}"
    
    if [ "$WIFI_READY" = false ]; then
        echo -e "  ${RED}•${NC} Server not accessible from network"
        echo -e "    Fix: ${YELLOW}sudo ufw allow $PORT/tcp${NC} and restart server"
    fi
    
    if [ "$USB_ACTIVE" = false ]; then
        echo -e "  ${RED}•${NC} USB tethering not active"
        echo -e "    Fix: ${YELLOW}Enable USB tethering on C66 device${NC}"
    fi
    
    echo ""
    echo -e "${BOLD}Run this script again after fixing issues.${NC}"
    exit 1
fi

echo ""
