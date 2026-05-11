#!/bin/bash
# -----------------------------------------------------------------------------
# C66 WiFi Failover Verification Script
# -----------------------------------------------------------------------------
# Verifies PC is ready to receive C66 scans via WiFi connection
# Run this before unplugging USB to ensure seamless failover
# -----------------------------------------------------------------------------

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

PC_IP="192.168.0.217"
PORT=8080

echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     C66 WiFi Failover - Network Verification               ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Get current IP addresses
echo -e "${BLUE}[1/6]${NC} Checking PC network configuration..."
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -n "$LAN_IP" ]; then
    echo -e "  ${GREEN}✓${NC} PC IP Address: ${BOLD}$LAN_IP${NC}"
    
    # Check if PC_IP matches actual IP
    if [ "$LAN_IP" != "$PC_IP" ]; then
        echo -e "  ${YELLOW}⚠${NC} Note: Configured IP ($PC_IP) differs from actual IP ($LAN_IP)"
        echo -e "      Update C66 InfoWedge URL to: http://$LAN_IP:$PORT/api/c66"
    fi
else
    echo -e "  ${RED}✗${NC} Could not detect IP address"
fi

# 2. Check if port 8080 is listening
echo -e "${BLUE}[2/6]${NC} Checking server port $PORT..."
if netstat -tlnp 2>/dev/null | grep -q ":$PORT " || ss -tlnp 2>/dev/null | grep -q ":$PORT "; then
    echo -e "  ${GREEN}✓${NC} Port $PORT is listening"
else
    echo -e "  ${RED}✗${NC} Port $PORT is NOT listening - Start the server first!"
    echo -e "      Run: ./deploy-full-server.sh"
fi

# 3. Test local API endpoint
echo -e "${BLUE}[3/6]${NC} Testing API endpoint locally..."
if curl -sf "http://localhost:$PORT/api/ai/status" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} API endpoint responding on localhost"
else
    echo -e "  ${RED}✗${NC} API not responding - Server may be down"
fi

# 4. Test from LAN IP
echo -e "${BLUE}[4/6]${NC} Testing API from network interface..."
if [ -n "$LAN_IP" ]; then
    if curl -sf "http://$LAN_IP:$PORT/api/ai/status" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} API accessible from network (${LAN_IP})"
    else
        echo -e "  ${RED}✗${NC} API not accessible from network IP"
        echo -e "      Check firewall settings"
    fi
fi

# 5. Check firewall
echo -e "${BLUE}[5/6]${NC} Checking firewall status..."
if command -v ufw >/dev/null 2>&1; then
    if sudo ufw status | grep -q "$PORT"; then
        echo -e "  ${GREEN}✓${NC} UFW firewall allows port $PORT"
    else
        echo -e "  ${YELLOW}⚠${NC} UFW may block port $PORT"
        echo -e "      Run: sudo ufw allow $PORT/tcp"
    fi
elif command -v firewall-cmd >/dev/null 2>&1; then
    echo -e "  ${YELLOW}⚠${NC} firewalld detected - ensure port $PORT is open"
else
    echo -e "  ${GREEN}✓${NC} No firewall detected or using iptables"
fi

# 6. Verify scan_ingestion listeners
echo -e "${BLUE}[6/6]${NC} Checking scan ingestion listeners..."
for check_port in 9100 9101 9102; do
    if netstat -tlnp 2>/dev/null | grep -q ":$check_port " || ss -tlnp 2>/dev/null | grep -q ":$check_port "; then
        echo -e "  ${GREEN}✓${NC} Port $check_port (ingestion) listening"
    else
        echo -e "  ${YELLOW}⚠${NC} Port $check_port not listening (OK if not using)"
    fi
done

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Summary
echo -e "${BOLD}C66 InfoWedge Configuration:${NC}"
echo -e "  Primary URL:   http://${PC_IP}:8080/api/c66"
echo -e "  Backup URL:    http://${PC_IP}:8080/api/c66"
echo -e "  Content-Type:  application/json"
echo ""

# Test command
echo -e "${BOLD}Test Command (run from another device on same network):${NC}"
echo -e "  curl -X POST http://${PC_IP}:8080/api/c66 \\"
echo -e "    -H 'Content-Type: application/json' \\"
echo -e "    -d '{\"barcodeData\":\"WIFI-TEST\",\"device\":\"C66\"}'"
echo ""

# Download config
echo -e "${BOLD}Download Configuration:${NC}"
echo -e "  http://${PC_IP}:8080/static/infowedge-dual-mode-config.json"
echo ""

echo -e "${GREEN}Ready for WiFi failover!${NC} You can now unplug USB."
echo -e "The C66 will auto-switch to WiFi within 15 seconds."
