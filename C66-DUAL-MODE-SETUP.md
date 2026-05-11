# C66 Dual-Mode USB/WiFi Setup Guide

## Overview
Configure your C66 Chainway scanner to automatically switch between USB (when plugged in) and WiFi (when unplugged) connections, ensuring continuous operation.

## Pre-Configuration: Push Config & Verify Readiness

**BEFORE unplugging USB**, run the master push script to configure the C66 and verify 100% readiness:

```bash
./scripts/push-c66-config.sh
```

This script will:
1. ✅ Detect C66 device via ADB (if USB debugging enabled)
2. ✅ Push config file to C66 Downloads folder (automatic)
3. ✅ Generate QR code for backup download method
4. ✅ Verify USB tethering is active
5. ✅ Confirm PC network is ready for WiFi connections
6. ✅ Provide **GO/NO-GO verdict** before unplug

### Alternative: Browser Download

If ADB is not available, open browser on C66 and navigate to:
```
http://192.168.0.217:8080/static/infowedge-dual-mode-config.json
```

Or scan the QR code at `http://192.168.0.217:8080/static/c66-config-qr.png`

**Wait for the ✅ GO FOR UNPLUG message before disconnecting USB.**

---

## Connection Modes

### 🟢 USB Mode (Primary)
- **When**: C66 connected to PC via USB
- **Priority**: 1 (Primary)
- **Method**: USB-RNDIS tethering
- **Endpoint**: `http://192.168.0.217:8080/api/c66`
- **Advantage**: Fast, reliable, no network dependency

### 🟡 WiFi Mode (Backup)
- **When**: USB unplugged, same WiFi network
- **Priority**: 2 (Fallback)
- **Method**: WiFi connection
- **Endpoint**: `http://192.168.0.217:8080/api/c66`
- **Advantage**: Wireless, mobility, automatic failover

## Auto-Switching Behavior

| Scenario | Action | Result |
|----------|--------|--------|
| **USB Plugged In** | Auto-switch to USB | USB active, WiFi standby |
| **USB Unplugged** | Auto-switch to WiFi | WiFi active, USB disabled |
| **Both Available** | Prefer USB | USB primary, WiFi backup |
| **Neither Available** | Buffer only | Scans buffered until connection |

> **Note:** Both USB and WiFi modes use the **same endpoint URL** (`http://192.168.0.217:8080/api/c66`). The C66 automatically switches the network path while keeping the same target address.

## Step-by-Step Configuration

### 1. USB Setup (Primary Mode)

#### Physical Connection
1. Connect C66 to PC via USB cable
2. On C66: Settings → Network → USB tethering → Enable
3. Verify connection shows "Connected"

#### InfoWedge USB Configuration
1. Open InfoWedge → Profiles → Create Profile
2. **Profile Name**: `Mine Management Dual-Mode`
3. **Associated App**: All Apps
4. **Input**: Enable barcode scanner with QR/Code128 support
5. **Output**: IP Output enabled

### 2. WiFi Setup (Backup Mode)

#### Network Connection
1. On C66: Settings → WiFi → Connect to same network as PC
2. **Network SSID**: Your WiFi network
3. **Password**: Your WiFi password
4. Verify IP address in 192.168.0.x range

#### InfoWedge WiFi Configuration
1. In same profile, configure backup connection:
2. **Failover URL**: `http://192.168.0.217:8080/api/c66`
3. **Connection Check**: Every 30 seconds
4. **Auto-reconnect**: Enabled

### 3. Dual-Mode Settings

#### IP Output Configuration
```
Primary URL: http://192.168.0.217:8080/api/c66
Backup URL: http://192.168.0.217:8080/api/c66
Method: POST
Content-Type: application/json
Timeout: 5000ms
Retry Attempts: 3
Failover Enabled: Yes
Connection Check: Every 15 seconds
```

#### Data Format (JSON)
```
barcodeData → {{barcode}}
barcodeType → {{barcodeFormat}}
timestamp → {{timestamp}}
device → {{deviceID}}
scanner → C66-Dual
connection_mode → {{connectionType}}
pc_target → 192.168.0.217
```

#### Advanced Settings
```
Buffer Scans: Enabled
Buffer Size: 200 scans
Auto Send Buffer: Enabled
Heartbeat: Every 15 seconds
Connection Timeout: 10 seconds
Failover Timeout: 5 seconds
```

### 4. Connection Management

#### USB Detection
- **Check Interval**: Every 10 seconds
- **Auto Switch**: Enabled
- **Priority Override**: Yes (USB always preferred)

#### WiFi Detection  
- **Check Interval**: Every 30 seconds
- **Auto Connect**: Enabled
- **Preferred Networks**: Your WiFi SSID
- **Fallback to Any**: Yes (if preferred not available)

## Testing Dual-Mode Operation

### Test 1: USB Mode
1. **Connect** C66 via USB
2. **Enable** USB tethering
3. **Scan** test QR code
4. **Verify**: Scan appears in PC logs
5. **Check**: Connection mode shows "USB-RNDIS"

### Test 2: Full End-to-End Connection Test
**Comprehensive test to verify 100% C66 → Server connectivity:**

```bash
./scripts/c66-e2e-test.sh
```

This script will:
1. Check system status
2. Generate test QR codes
3. Start real-time scan monitor
4. **Prompt you to scan with C66**
5. Detect scan receipt within 30 seconds
6. Provide ✅ PASS/FAIL results

**Alternative quick status check:**
```bash
python3 scripts/c66-status.py
```

### Test 3: WiFi Mode (Quick Verification)
1. **Run** `./scripts/push-c66-config.sh` on PC first (get ✅ GO FOR UNPLUG)
2. **Disconnect** USB cable
3. **Wait** 10-15 seconds for auto-switch
4. **Scan** test QR code
5. **Verify**: Scan appears in PC logs via WiFi
6. **Check**: Connection mode shows "WiFi"

### Extended WiFi Testing
1. **Disconnect** USB cable
2. **Wait** 15-30 seconds for auto-switch
3. **Scan** test QR code
4. **Verify**: Scan still works via WiFi
5. **Check**: Connection mode shows "WiFi"

## Real-Time Monitoring Tools

### Live Scan Monitor
Watch C66 scans arrive in real-time:
```bash
python3 scripts/monitor-c66-scans.py
```

Shows:
- 👤 Employee / 🚗 Vehicle / 🎫 Visitor scans
- → IN / ← OUT direction
- ✓ GRANTED / ✗ DENIED access decisions
- Timestamps and entity names

### Status Dashboard
Quick health check of C66 → Server connection:
```bash
python3 scripts/c66-status.py
```

Checks:
- Server running on port 8080
- API endpoint responding
- Network accessible (192.168.0.217)
- C66 endpoint (/api/c66) ready
- Recent scan activity
- Provides ✅ GO/❌ NO-GO verdict

### Test QR Codes
Display test QR codes for C66 scanning:
```bash
# Show all test QR codes
python3 scripts/show-test-qr.py

# Show specific test
python3 scripts/show-test-qr.py usb
python3 scripts/show-test-qr.py wifi
```

QR codes are also saved to `static/test-qr-*.png` for display.

### Test 4: Mode Switching
1. **Start** with WiFi mode (USB unplugged)
2. **Connect** USB cable
3. **Wait** 10 seconds for auto-switch
4. **Verify**: Switched back to USB mode
5. **Check**: Buffered scans sent automatically

### Test 5: Buffer Recovery
1. **Disconnect** both USB and WiFi
2. **Scan** several QR codes (buffered)
3. **Reconnect** USB or WiFi
4. **Verify**: Buffered scans sent automatically
5. **Check**: No data lost

## Expected Data Flow

### USB Mode Flow
```
Physical Scan → C66 USB → PC Direct → System Processing → Response
```

### WiFi Mode Flow
```
Physical Scan → C66 WiFi → Router → PC → System Processing → Response
```

### Switching Flow
```
USB Unplugged → Detection → WiFi Enable → Buffer Send → Continue Scanning
USB Plugged → Detection → WiFi Disable → USB Enable → Buffer Send
```

## Data Format Examples

### Scan Data (Both Modes)
```json
{
  "barcodeData": "EMP001-JOHN-DOE-2024",
  "barcodeType": "QR_CODE",
  "timestamp": "2024-05-07T10:30:00Z",
  "device": "C66-001",
  "scanner": "C66-Dual",
  "connection_mode": "USB-RNDIS", // or "WiFi"
  "pc_target": "192.168.0.217"
}
```

### Response (Both Modes)
```json
{
  "success": true,
  "message": "Access granted",
  "name": "John Doe",
  "entity_type": "employee",
  "status": "approved",
  "open_gate": true
}
```

## Troubleshooting Dual-Mode

### Common Issues

#### "Not Switching to WiFi When USB Unplugged"
**Causes**:
- WiFi not connected
- Failover settings disabled
- Connection check interval too long

**Solutions**:
1. Verify WiFi connection on C66
2. Check InfoWedge failover settings
3. Reduce connection check interval to 15 seconds

#### "USB Not Detected When Plugged In"
**Causes**:
- USB tethering disabled
- USB cable faulty
- PC USB port issues

**Solutions**:
1. Enable USB tethering on C66
2. Try different USB cable/port
3. Restart both devices

#### "Buffered Scans Not Sending"
**Causes**:
- Buffer settings incorrect
- Connection not fully restored
- Buffer size exceeded

**Solutions**:
1. Verify auto-send buffer enabled
2. Check connection is fully established
3. Increase buffer size to 500

#### "Frequent Mode Switching"
**Causes**:
- Intermittent USB connection
- WiFi signal fluctuations
- Check intervals too frequent

**Solutions**:
1. Check USB cable connection
2. Improve WiFi signal strength
3. Adjust check intervals (USB: 10s, WiFi: 30s)

### Verification Commands

#### Check PC Server Status
```bash
# Verify server running
curl -s http://192.168.0.217:8080/api/ai/status

# Test USB endpoint
curl -X POST http://192.168.0.217:8080/api/c66 \
  -H "Content-Type: application/json" \
  -d '{"barcodeData":"USB-TEST","device":"C66-USB"}'

# Monitor scan logs
tail -f /home/tim/Desktop/01.mine-management-system/server.log | grep "SCAN"
```

#### Check Network Connectivity
```bash
# From C66 (using ADB shell or terminal app)
ping 192.168.0.217

# Check PC network
hostname -I
ip route | grep default
```

## Configuration Files

### Download Dual-Mode Configuration

**Option 1: Direct Download (Browser)**
- **URL**: `http://192.168.0.217:8080/static/infowedge-dual-mode-config.json`
- On C66: Open browser → Navigate to URL → Download → Import in InfoWedge

**Option 2: QR Code Scan**
- **QR Code**: `http://192.168.0.217:8080/static/c66-config-qr.png`
- Open this URL on your PC to display the QR code, then scan with C66

**Option 3: Automatic Push (ADB)**
- Run `./scripts/push-c66-config.sh` on PC while USB connected
- Config automatically pushed to C66 Downloads folder

**Config includes:**
- **Primary URL**: `http://192.168.0.217:8080/api/c66`
- **Backup URL**: `http://192.168.0.217:8080/api/c66` (same!)
- **Connection Check**: Every 15 seconds
- **Failover**: Enabled
- **Buffer**: 200 scans with auto-send

### Web Interface Tools
- **URL**: `http://192.168.0.217:8080/scanner_config`
- **Features**: Test both modes, monitor switching, generate test QR codes

## Performance Optimization

### USB Mode Optimization
- Use high-quality USB cable
- Ensure stable USB connection
- Monitor USB tethering status

### WiFi Mode Optimization
- Position C66 within good WiFi range
- Use 5GHz WiFi if available
- Monitor WiFi signal strength

### Buffer Optimization
- Set buffer size based on expected offline time
- Enable auto-send on reconnection
- Monitor buffer fill level

## Security Considerations

### Network Security
- USB connection provides physical security
- WiFi uses same network as PC (trusted)
- Both modes use local network only

### Data Protection
- All scan data logged on PC
- Connection mode tracked in logs
- Failed scans monitored for security

## Maintenance

### Daily Checks
1. Verify both connection modes working
2. Test mode switching functionality
3. Check buffer status and size

### Weekly Maintenance
1. Review connection switching logs
2. Test failover scenarios
3. Verify WiFi network stability

### Monthly Tasks
1. Update InfoWedge configuration if needed
2. Review security logs for both modes
3. Test with different USB cables and WiFi networks

## Success Indicators

✅ **Dual-Mode Working When:**
- USB mode activates when plugged in
- WiFi mode activates when USB unplugged
- Automatic switching happens within 15-30 seconds
- Buffered scans sent on reconnection
- No scan data lost during mode switches
- Both modes show same scan processing speed

## Emergency Procedures

### USB Failure
1. **Immediate**: Switch to WiFi mode (unplug USB)
2. **Verify**: WiFi connection established
3. **Test**: Scan functionality via WiFi
4. **Backup**: Use mobile hotspot if WiFi unavailable

### WiFi Failure
1. **Immediate**: Connect USB cable
2. **Verify**: USB tethering enabled
3. **Test**: Scan functionality via USB
4. **Backup**: Use alternative WiFi network

### Both Failures
1. **Immediate**: Enable buffer-only mode
2. **Action**: Continue scanning (buffered)
3. **Recovery**: Restore any connection to send buffer
4. **Alert**: Notify system administrator

## Advanced Features

### Connection Monitoring
- Real-time connection status display
- Automatic connection quality assessment
- Historical connection pattern analysis

### Smart Buffering
- Intelligent buffer size management
- Priority-based scan sending
- Connection-aware buffer optimization

### Network Health
- Continuous connectivity testing
- Automatic network troubleshooting
- Performance metrics collection

The dual-mode configuration ensures your C66 scanner works seamlessly whether connected via USB or WiFi, with automatic switching and no data loss.
