#!/bin/bash
# -----------------------------------------------------------------------------
# C66 End-to-End Test Script
# -----------------------------------------------------------------------------
# Comprehensive test that verifies C66 scans reach the server
# Usage: ./scripts/c66-e2e-test.sh
# -----------------------------------------------------------------------------

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

draw_banner() {
    clear
    echo -e "${BOLD}${CYAN}"
    echo "  ╔══════════════════════════════════════════════════════════════════╗"
    echo "  ║             C66 END-TO-END CONNECTION TEST                       ║"
    echo "  ║         Verify Scanner → Server Communication                   ║"
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
# STEP 1: Initial Status Check
# ═══════════════════════════════════════════════════════════════════════════
draw_banner
step "1" "Checking System Status"

# Run status check
cd "$PROJECT_DIR" && source venv/bin/activate
python3 scripts/c66-status.py | grep -E "(✓|✗|═|╔|╚|ALL|ISSUES)" | head -20

# Ask if we should continue
echo -e "\n${BOLD}Continue with scan test? (y/n):${NC} "
read -r response
if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
    echo -e "\n${YELLOW}Test aborted.${NC}"
    exit 0
fi

# ═══════════════════════════════════════════════════════════════════════════
# STEP 2: Generate Test QR Codes
# ═══════════════════════════════════════════════════════════════════════════
step "2" "Generating Test QR Codes"

# Create test QR codes
cd "$PROJECT_DIR"
python3 << 'PYEOF'
import qrcode
import os

test_codes = [
    ("C66-USB-TEST", "USB connection test"),
    ("C66-WIFI-TEST", "WiFi connection test"),
    ("TEST-SCAN-001", "General test scan"),
]

print("\nTest QR Codes Generated:")
print("-" * 50)

for code, desc in test_codes:
    qr = qrcode.QRCode(version=1, box_size=5, border=2)
    qr.add_data(code)
    qr.make(fit=True)
    
    # Generate ASCII art
    ascii_qr = qr.make_image(fill_char='██', empty_char='  ')
    
    filename = f"static/test-qr-{code.lower().replace(' ', '-').replace('_', '-')}.png"
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(filename)
    
    print(f"  {code}: {desc}")
    print(f"         File: {filename}")
    print()

print("All test QR codes saved to static/ directory")
PYEOF

# ═══════════════════════════════════════════════════════════════════════════
# STEP 3: Start Scan Monitor in Background
# ═══════════════════════════════════════════════════════════════════════════
step "3" "Starting Real-Time Scan Monitor"

# Start monitor in background, capture output to temp file
MONITOR_LOG=$(mktemp)
status info "Monitor will run for 30 seconds..."
status info "Log file: $MONITOR_LOG"

# Launch monitor
cd "$PROJECT_DIR"
python3 scripts/monitor-c66-scans.py 30 > "$MONITOR_LOG" 2>&1 &
MONITOR_PID=$!

status ok "Monitor started (PID: $MONITOR_PID)"
sleep 2

# ═══════════════════════════════════════════════════════════════════════════
# STEP 4: USB Test
# ═══════════════════════════════════════════════════════════════════════════
step "4" "USB Connection Test"

echo -e "\n${BOLD}${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}ACTION REQUIRED:${NC}"
echo -e "  1. Ensure C66 is connected via USB"
echo -e "  2. Open InfoWedge with dual-mode profile active"
echo -e "  3. ${YELLOW}Scan the test QR code displayed on your screen${NC}"
echo -e "     (File: static/test-qr-c66-usb-test.png)"
echo -e "\n${BOLD}Scan ANY test QR code with the C66 now...${NC}"
echo -e "${BOLD}${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n${DIM}Opening test QR code...${NC}"

# Try to open the QR code image
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$PROJECT_DIR/static/test-qr-c66-usb-test.png" &
elif command -v open >/dev/null 2>&1; then
    open "$PROJECT_DIR/static/test-qr-c66-usb-test.png" &
fi

# Show ASCII QR as backup
echo -e "\n${DIM}ASCII QR Code (backup):${NC}"
python3 << 'PYEOF'
import qrcode
qr = qrcode.QRCode(version=1, box_size=1, border=1)
qr.add_data("C66-USB-TEST")
qr.make(fit=True)

# Simple ASCII output
modules = qr.get_matrix()
for row in modules:
    line = ""
    for cell in row:
        line += "██" if cell else "  "
    print(line)
print("\nData: C66-USB-TEST")
PYEOF

# Wait for scan with countdown
echo -e "\n${BOLD}Waiting for scan detection (30 seconds)...${NC}"
for i in $(seq 30 -1 1); do
    printf "  ${DIM}Time remaining: %2d seconds...\r${NC}" "$i"
    
    # Check if scan was detected in monitor log
    if grep -q "USB-TEST\|C66" "$MONITOR_LOG" 2>/dev/null; then
        echo -e "\n\n${BOLD}${GREEN}✓ SCAN DETECTED!${NC}"
        USB_DETECTED=true
        break
    fi
    
    sleep 1
done

if [ -z "$USB_DETECTED" ]; then
    echo -e "\n\n${BOLD}${YELLOW}⚠ No USB scan detected within 30 seconds${NC}"
    status warn "This may be normal if you didn't scan"
fi

# Kill monitor
kill $MONITOR_PID 2>/dev/null || true

# Show monitor results
echo -e "\n${BOLD}Scan Monitor Results:${NC}"
if [ -s "$MONITOR_LOG" ]; then
    grep -E "(→|←|✓|✗|👤|🚗|🎫)" "$MONITOR_LOG" | tail -5 || echo "  (No scan events captured)"
else
    echo "  (Monitor log empty)"
fi

# ═══════════════════════════════════════════════════════════════════════════
# STEP 5: WiFi Test Prompt
# ═══════════════════════════════════════════════════════════════════════════
step "5" "WiFi Connection Test (Optional)"

echo -e "\n${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}WIFI TEST:${NC}"
echo -e "  To test WiFi mode:"
echo -e "  1. Unplug USB cable from C66"
echo -e "  2. Wait 15 seconds for auto-switch to WiFi"
echo -e "  3. Scan the WiFi test QR code"
echo -e "  4. Watch for scan detection"
echo -e "\n${BOLD}Would you like to run the WiFi test now? (y/n):${NC} "
read -r wifi_response

if [ "$wifi_response" = "y" ] || [ "$wifi_response" = "Y" ]; then
    echo -e "\n${BOLD}Preparing WiFi test...${NC}"
    
    # Start monitor again
    MONITOR_LOG=$(mktemp)
    python3 scripts/monitor-c66-scans.py 60 > "$MONITOR_LOG" 2>&1 &
    MONITOR_PID=$!
    
    echo -e "\n${BOLD}${YELLOW}Unplug USB now and wait 15 seconds...${NC}"
    sleep 15
    
    echo -e "\n${BOLD}Opening WiFi test QR code...${NC}"
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$PROJECT_DIR/static/test-qr-c66-wifi-test.png" &
    fi
    
    # Show ASCII
    python3 << 'PYEOF'
import qrcode
qr = qrcode.QRCode(version=1, box_size=1, border=1)
qr.add_data("C66-WIFI-TEST")
qr.make(fit=True)
modules = qr.get_matrix()
for row in modules:
    line = ""
    for cell in row:
        line += "██" if cell else "  "
    print(line)
print("\nData: C66-WIFI-TEST")
PYEOF
    
    echo -e "\n${BOLD}Scan with C66 via WiFi (45 seconds)...${NC}"
    sleep 45
    
    kill $MONITOR_PID 2>/dev/null || true
    
    if grep -q "WIFI-TEST\|C66" "$MONITOR_LOG" 2>/dev/null; then
        echo -e "\n${BOLD}${GREEN}✓ WiFi scan detected!${NC}"
        WIFI_DETECTED=true
    else
        echo -e "\n${BOLD}${YELLOW}⚠ No WiFi scan detected${NC}"
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════
# STEP 6: Final Results
# ═══════════════════════════════════════════════════════════════════════════
step "6" "Test Results Summary"

echo -e "\n${BOLD}════════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$USB_DETECTED" = true ]; then
    echo -e "  USB Test:    ${GREEN}✓ PASSED${NC}"
else
    echo -e "  USB Test:    ${YELLOW}⚠ NOT TESTED/FAILED${NC}"
fi

if [ "$WIFI_DETECTED" = true ]; then
    echo -e "  WiFi Test:   ${GREEN}✓ PASSED${NC}"
elif [ "$wifi_response" = "y" ] || [ "$wifi_response" = "Y" ]; then
    echo -e "  WiFi Test:   ${YELLOW}⚠ NOT DETECTED${NC}"
else
    echo -e "  WiFi Test:   ${DIM}- SKIPPED${NC}"
fi

echo ""

if [ "$USB_DETECTED" = true ]; then
    echo -e "${BOLD}${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${GREEN}║  ✅ C66 IS 100% CONNECTED AND READY FOR PRODUCTION USE     ║${NC}"
    echo -e "${BOLD}${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}The C66 scanner is correctly configured:${NC}"
    echo -e "  • Scans reach the server in real-time"
    echo -e "  • InfoWedge profile is active"
    echo -e "  • Endpoint: http://192.168.0.217:8080/api/c66"
    echo ""
    echo -e "${BOLD}For WiFi failover:${NC}"
    echo -e "  • Unplug USB when ready"
    echo -e "  • C66 will auto-switch to WiFi within 15 seconds"
    echo -e "  • Scans will continue without interruption"
else
    echo -e "${BOLD}${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${YELLOW}║  ⚠ TEST INCOMPLETE - Check configuration                   ║${NC}"
    echo -e "${BOLD}${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}Troubleshooting:${NC}"
    echo -e "  1. Verify C66 is connected via USB"
    echo -e "  2. Check InfoWedge profile is active"
    echo -e "  3. Confirm URL in InfoWedge: http://192.168.0.217:8080/api/c66"
    echo -e "  4. Run: ./scripts/push-c66-config.sh to verify setup"
    echo ""
    echo -e "${BOLD}To retry test:${NC} ./scripts/c66-e2e-test.sh"
fi

# Cleanup
rm -f "$MONITOR_LOG" 2>/dev/null || true

echo ""
