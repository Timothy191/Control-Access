# C66 to PC Scan Forwarding Setup Guide

## Device Status
✅ **C66 Chainway device detected and connected**
- **Manufacturer**: CHAINWAY
- **Product**: BENGAL-IDP _SN:A8331872  
- **Serial Number**: 67b8d1c2
- **Connection**: USB-RNDIS (wwan0 interface)
- **PC IP Address**: 192.168.0.217

## Overview
Configure the C66 Android device to forward all barcode scans directly to this PC via USB connection, eliminating network dependency.

## Step-by-Step Configuration

### 1. Enable USB Tethering/RNDIS on C66
1. On the C66 Android device, go to **Settings**
2. Navigate to **Network & Internet** → **Hotspot & tethering**
3. Enable **USB tethering** (this creates the RNDIS connection)
4. Verify connection status shows "Connected to PC"

### 2. Configure InfoWedge for PC Forwarding

#### Create New Profile
1. Open **InfoWedge** app on C66 device
2. Go to **Profiles** tab
3. Tap **Create Profile**
4. Enter profile name: `Mine Management PC-Forward`
5. Set **Associated App** to **All Apps**
6. Tap **Save**

#### Input Configuration
1. Select the new profile
2. Go to **Input** → **Barcode Input**
3. Enable barcode input
4. Configure settings:
   - **Device**: C66 Built-in Scanner
   - **Decoder Types**: QR Code, Code 128, Code 39
   - **Scan Mode**: Continuous
   - **Aim Mode**: Dot
   - **Illumination**: Auto

#### Output Configuration (CRITICAL)
1. Go to **Output** → **IP Output**
2. Enable IP output
3. Configure EXACT settings:
   ```
   Target URL: http://192.168.0.217:8080/api/c66
   Method: POST
   Content-Type: application/json
   Timeout: 5000ms
   Retry Attempts: 3
   Retry Delay: 1000ms
   ```

#### Data Format Configuration
1. In IP Output, tap **Data Formatting**
2. Set **Format** to **JSON**
3. Configure field mapping:
   ```
   barcodeData → {{barcode}}
   barcodeType → {{barcodeFormat}}
   timestamp → {{timestamp}}
   device → {{deviceID}}
   scanner → C66-PC
   pc_target → 192.168.0.217
   ```

#### Advanced Settings
1. Go to **Advanced** section
2. Configure:
   - **Buffer Scans**: Enabled
   - **Buffer Size**: 100
   - **Auto Send Buffer**: Enabled
   - **Heartbeat Interval**: 30 seconds

### 3. Activate Profile
1. Go back to profile list
2. Tap the "Mine Management PC-Forward" profile
3. Verify it shows **Active** status

### 4. Test Connection

#### Method 1: Web Interface Test
1. On this PC, open browser to: `http://192.168.0.217:8080/scanner_config`
2. Click **Test C66 Connection** button
3. Should show "Connection Successful"

#### Method 2: Direct Scan Test
1. Generate a test QR code from the web interface
2. Scan it with the C66 device
3. Check PC server logs for scan receipt
4. Verify access control response

#### Method 3: Command Line Test
```bash
curl -X POST http://192.168.0.217:8080/api/c66 \
  -H "Content-Type: application/json" \
  -d '{"barcodeData":"C66-PC-TEST","device":"C66-PC"}'
```

## Expected Data Flow

### Scan → Android Device → PC → System
```
1. Physical scan on C66 device
2. InfoWedge captures barcode data
3. JSON formatted with scan data
4. HTTP POST to PC (192.168.0.217:8080/api/c66)
5. PC processes scan and returns access decision
6. Response sent back to C66 device
```

### Data Format
**From C66 to PC:**
```json
{
  "barcodeData": "EMP001-JOHN-DOE-2024",
  "barcodeType": "QR_CODE", 
  "timestamp": "2024-05-07T10:30:00Z",
  "device": "C66-001",
  "scanner": "C66-PC",
  "pc_target": "192.168.0.217"
}
```

**From PC to C66:**
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

## Troubleshooting

### Common Issues

#### "PC Not Reachable" Error
**Cause**: USB-RNDIS connection not established
**Solution**:
1. Check USB cable connection
2. Enable USB tethering on C66 device
3. Restart both PC and C66 device
4. Verify PC IP address: `hostname -I`

#### "Connection Timeout" Error  
**Cause**: Mine Management System not running
**Solution**:
1. Start the system: `python app.py`
2. Verify port 8080 is listening: `netstat -tlnp | grep 8080`
3. Check firewall settings

#### "Invalid Data Format" Error
**Cause**: InfoWedge field mapping incorrect
**Solution**:
1. Verify Content-Type is `application/json`
2. Check field mapping exactly as specified
3. Review PC server logs for parsing errors

### Verification Commands

#### Check PC Server Status
```bash
# Check if server is running
ps aux | grep "python app.py"

# Check port 8080
netstat -tlnp | grep 8080

# Check recent scan logs
tail -f /home/tim/Desktop/01.mine-management-system/server.log | grep "SCAN"
```

#### Check USB Connection
```bash
# Check C66 device is connected
lsusb | grep -i chainway

# Check network interface
ip link show wwan0

# Check device logs
dmesg | grep -i chainway
```

## Configuration Files

### Download PC-Specific Configuration
- **URL**: `http://192.168.0.217:8080/static/infowedge-pc-config.json`
- **Purpose**: Complete InfoWedge configuration for PC forwarding

### Web Interface
- **URL**: `http://192.168.0.217:8080/scanner_config`
- **Features**: Test connection, generate QR codes, monitor status

## Security Considerations

### Network Security
- USB connection provides physical security
- PC endpoint restricted to local network
- No external network dependency

### Data Protection
- All scan data logged on PC
- IP address tracking for audit trail
- Failed scans logged for security monitoring

## Performance Optimization

### USB Connection
- Use high-quality USB cable
- Ensure stable connection
- Monitor connection status

### Buffer Settings
- Enable buffering for reliability
- Set appropriate buffer size (100 scans)
- Auto-send on connection restoration

## Maintenance

### Daily Checks
1. Verify USB connection status
2. Test scan functionality
3. Check server logs for errors

### Weekly Maintenance
1. Review scan success rates
2. Check buffer status
3. Verify PC system performance

### Monthly Tasks
1. Update InfoWedge configuration if needed
2. Review security logs
3. Backup configuration files

## Support

### Quick Test Commands
```bash
# Test PC endpoint
curl -X POST http://192.168.0.217:8080/api/c66 \
  -H "Content-Type: application/json" \
  -d '{"barcodeData":"QUICK-TEST","device":"C66"}'

# Check server status
curl http://192.168.0.217:8080/api/ai/status

# Monitor scan logs in real-time
tail -f /home/tim/Desktop/01.mine-management-system/server.log | grep "SCAN"
```

### Emergency Procedures
1. **Connection Lost**: Restart USB tethering on C66 device
2. **Server Down**: Restart mine management system on PC
3. **Data Not Processing**: Check InfoWedge profile settings
4. **Hardware Issues**: Try different USB port or cable

## Success Indicators

✅ **Configuration Complete When:**
- C66 device shows "Connected" in USB tethering
- InfoWedge profile shows "Active" status
- Web interface test shows "Connection Successful"
- Scan test appears in PC server logs
- Access control response received on C66 device

The system is now configured for direct PC forwarding via USB connection.
