#!/bin/bash

# C66 to PC Scan Forwarding Setup Script
# This script helps configure and test the C66 device connection to this PC

echo "=== C66 Chainway to PC Setup Script ==="
echo "PC IP Address: 192.168.0.217"
echo "Target Endpoint: http://192.168.0.217:8080/api/c66"
echo ""

# Check if mine management system is running
echo "1. Checking Mine Management System status..."
if pgrep -f "python app.py" > /dev/null; then
    echo "✅ Mine Management System is running"
else
    echo "❌ Mine Management System is NOT running"
    echo "   Please start it with: python app.py"
    exit 1
fi

# Check if port 8080 is listening
echo ""
echo "2. Checking port 8080..."
if netstat -tlnp 2>/dev/null | grep -q ":8080 "; then
    echo "✅ Port 8080 is listening"
else
    echo "❌ Port 8080 is NOT listening"
    echo "   Please ensure the system is properly started"
    exit 1
fi

# Check C66 device connection
echo ""
echo "3. Checking C66 device connection..."
C66_DEVICE=$(lsusb | grep -i chainway)
if [ ! -z "$C66_DEVICE" ]; then
    echo "✅ C66 device detected:"
    echo "   $C66_DEVICE"
else
    echo "❌ C66 device NOT detected"
    echo "   Please check USB connection"
    exit 1
fi

# Get PC IP address
PC_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "4. PC Network Information:"
echo "   IP Address: $PC_IP"
echo "   Target URL: http://$PC_IP:8080/api/c66"

# Test the C66 endpoint
echo ""
echo "5. Testing C66 endpoint..."
echo "   Sending test scan to endpoint..."
RESPONSE=$(curl -s -X POST "http://$PC_IP:8080/api/c66" \
    -H "Content-Type: application/json" \
    -H "User-Agent: C66-PC-Test" \
    -d '{"barcodeData":"C66-PC-SETUP-TEST","device":"C66-PC-Setup","scanner":"C66"}' \
    --connect-timeout 5)

if [ $? -eq 0 ]; then
    echo "✅ Endpoint test successful"
    echo "   Response: $RESPONSE"
else
    echo "❌ Endpoint test failed"
    echo "   Please check server and network settings"
    exit 1
fi

# Display configuration instructions
echo ""
echo "=== Android Device Configuration Instructions ==="
echo ""
echo "On the C66 Android device, follow these steps:"
echo ""
echo "1. Enable USB Tethering:"
echo "   Settings → Network & Internet → Hotspot & tethering → USB tethering"
echo ""
echo "2. Configure InfoWedge:"
echo "   - Profile Name: Mine Management PC-Forward"
echo "   - Target URL: http://$PC_IP:8080/api/c66"
echo "   - Method: POST"
echo "   - Content-Type: application/json"
echo ""
echo "3. Field Mapping:"
echo "   barcodeData → {{barcode}}"
echo "   barcodeType → {{barcodeFormat}}"
echo "   timestamp → {{timestamp}}"
echo "   device → {{deviceID}}"
echo "   scanner → C66-PC"
echo ""
echo "4. Test Configuration:"
echo "   - Open browser: http://$PC_IP:8080/scanner_config"
echo "   - Click 'Test C66 Connection'"
echo "   - Scan a test QR code"
echo ""

# Display monitoring commands
echo "=== Monitoring Commands ==="
echo ""
echo "Monitor scan logs in real-time:"
echo "   tail -f /home/tim/Desktop/01.mine-management-system/server.log | grep 'SCAN'"
echo ""
echo "Check server status:"
echo "   curl http://$PC_IP:8080/api/ai/status"
echo ""
echo "Test endpoint manually:"
echo "   curl -X POST http://$PC_IP:8080/api/c66 -H 'Content-Type: application/json' -d '{\"barcodeData\":\"TEST\",\"device\":\"C66\"}'"
echo ""

# Display configuration files
echo "=== Configuration Files ==="
echo ""
echo "Download InfoWedge configuration:"
echo "   http://$PC_IP:8080/static/infowedge-pc-config.json"
echo ""
echo "Setup documentation:"
echo "   /home/tim/Desktop/01.mine-management-system/C66-PC-FORWARD-SETUP.md"
echo ""

echo "=== Setup Complete ==="
echo "✅ PC is ready to receive scans from C66 device"
echo "📱 Configure the Android device using the instructions above"
echo "🧪 Test with the web interface at: http://$PC_IP:8080/scanner_config"
