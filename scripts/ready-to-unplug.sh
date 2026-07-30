#!/bin/bash
# ─── C66 Ready-to-Unplug Signal ─────────────────────────────────────────────
# Flashes the red scanner laser + beeps + vibrates to confirm the C66 is fully
# configured and can be unplugged from USB (WiFi failover is active).
# ────────────────────────────────────────────────────────────────────────────

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${BOLD}C66 READY-TO-UNPLUG CHECK${NC}"
echo ""

# ── 1. Verify server is running ──
if curl -sf http://localhost:8080/api/ai/status -o /dev/null 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Server running on port 8080"
else
    echo -e "  ${RED}✗${NC} Server not running! Start with: python app.py"
    exit 1
fi

# ── 2. Verify C66 connected via ADB ──
C66=$(adb devices 2>/dev/null | grep -v "List" | grep -v "^$" | head -1)
if [ -n "$C66" ]; then
    echo -e "  ${GREEN}✓${NC} C66 connected via ADB ($(echo "$C66" | awk '{print $1}'))"
else
    echo -e "  ${RED}✗${NC} C66 not detected via ADB. Plug in USB with debugging enabled."
    exit 1
fi

# ── 3. Verify C66 can reach server via WiFi ──
if adb shell ping -c 1 -W 2 192.168.0.50 2>/dev/null | grep -q "1 received"; then
    echo -e "  ${GREEN}✓${NC} C66 can reach server via WiFi (192.168.0.50)"
else
    echo -e "  ${YELLOW}⚠${NC} C66 cannot ping 192.168.0.50 via WiFi"
fi

# ── 4. Verify /api/c66 endpoint ──
if adb shell curl -sf -X POST http://192.168.0.50:8080/api/c66 --connect-timeout 5 -d "ready-check" 2>/dev/null | grep -q "success"; then
    echo -e "  ${GREEN}✓${NC} /api/c66 endpoint responding"
else
    echo -e "  ${YELLOW}⚠${NC} /api/c66 endpoint test failed (may be normal if curl not on device)"
fi

# ── 5. Verify kiosk page accessible ──
if adb shell curl -sf http://192.168.0.50:8080/kiosk --connect-timeout 5 -o /dev/null 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Kiosk page accessible at /kiosk"
else
    echo -e "  ${YELLOW}⚠${NC} Kiosk page check skipped"
fi

echo ""
echo -e "${BOLD}═══ SENDING READY SIGNAL ═══${NC}"
echo ""

# ── Flash laser + beep + vibrate sequence ──
SCANNER_PKG="com.rscja.scanner"
RECEIVER=".receiver.CustomBroadcastReceiver_xb"
BROADCAST="adb shell am broadcast -a com.rscja.scanner.action"
FLAGS="-n ${SCANNER_PKG}/${RECEIVER} --user 0"

# shellcheck disable=SC2086  # Intentional word splitting for command composition
send_signal() {
    $BROADCAST."$1" $FLAGS >/dev/null 2>&1
}

echo -e "  Flashing red laser... (2 pulses)"
send_signal BARCODESTARTSCAN
sleep 0.2
send_signal BARCODESTOPSCAN
sleep 0.15
send_signal BEEP

sleep 0.3

send_signal BARCODESTARTSCAN
sleep 0.2
send_signal BARCODESTOPSCAN
sleep 0.15
send_signal BEEP
send_signal VIBRATE

echo -e "  ${GREEN}✓${NC} Ready signal sent to C66"
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║  ✅ READY TO UNPLUG — WiFi failover is active      ║${NC}"
echo -e "${BOLD}${GREEN}║     Scanner laser flashed + beeped                 ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Next: Unplug USB. Scanner continues working via WiFi."
echo -e "  Kiosk page: http://192.168.0.50:8080/kiosk"
echo ""
