# C66 Chainway Scanner with InfoWedge Setup Guide

## Overview
This guide provides complete instructions for configuring the C66 Chainway scanner with InfoWedge app to integrate with the Mine Management System.

## System Requirements
- C66 Chainway mobile device
- InfoWedge app installed (version 6.0+)
- Mine Management System v2.1.0 running on server
- Network connectivity between scanner and server

## Available Endpoints

### Primary Endpoint: `/api/c66`
- **URL**: `http://your-server:8080/api/c66`
- **Method**: POST
- **Authentication**: IP-based (local network only)
- **Features**: Optimized for InfoWedge, accepts multiple data formats

### Alternative Endpoint: `/api/scan_alt`
- **URL**: `http://your-server:8080/api/scan_alt`
- **Method**: POST
- **Authentication**: None
- **Features**: Flexible data format support

### Fallback Endpoint: `/api/scan_qr`
- **URL**: `http://your-server:8080/api/scan_qr`
- **Method**: POST
- **Authentication**: API key required
- **Features**: Main endpoint with full validation

## Step-by-Step Configuration

### 1. Install InfoWedge
1. Download InfoWedge from Google Play Store
2. Grant necessary permissions (Camera, Network, Storage)
3. Launch the app and complete initial setup

### 2. Create New Profile
1. Open InfoWedge
2. Go to **Profiles** tab
3. Tap **Create Profile**
4. Enter profile name: `Mine Management C66`
5. Set **Associated App** to **All Apps**
6. Tap **Save**

### 3. Configure Input Settings
1. Select the newly created profile
2. Go to **Input** section
3. Tap **Barcode Input**
4. Enable barcode input
5. Configure settings:
   - **Device**: C66 Built-in Scanner
   - **Decoder Types**: 
     - ✅ QR Code
     - ✅ Code 128
     - ✅ Code 39
     - ✅ EAN-13
     - ✅ UPC-A
   - **Scan Mode**: Continuous
   - **Aim Mode**: Dot
   - **Illumination**: Auto
   - **Decode Timeout**: 5000ms

### 4. Configure IP Output
1. Go to **Output** section
2. Tap **IP Output**
3. Enable IP output
4. Configure settings:
   - **Target URL**: `http://your-server:8080/api/c66`
   - **Method**: POST
   - **Content Type**: `application/json`
   - **Timeout**: 5000ms
   - **Retry Attempts**: 3
   - **Retry Delay**: 1000ms

### 5. Configure Data Format
1. In IP Output settings, tap **Data Formatting**
2. Set **Format** to **JSON**
3. Configure field mapping:
   ```
   barcodeData → {{barcode}}
   barcodeType → {{barcodeFormat}}
   timestamp → {{timestamp}}
   device → {{deviceID}}
   scanner → C66
   ```

### 6. Advanced Settings
1. Go to **Advanced** section
2. Configure:
   - **Buffer Scans**: Enabled
   - **Buffer Size**: 100
   - **Auto Send Buffer**: Enabled
   - **Heartbeat Interval**: 30 seconds
   - **Connection Timeout**: 10 seconds

### 7. Activate Profile
1. Go back to profile list
2. Tap the profile to activate it
3. Verify profile shows **Active** status

## Testing the Configuration

### Method 1: Web Interface Test
1. Open browser to `http://your-server:8080/scanner_config`
2. Click **Test C66 Connection** button
3. Verify successful connection response

### Method 2: Manual Scan Test
1. Generate a test QR code from the web interface
2. Scan the QR code with C66 device
3. Check server logs for scan receipt
4. Verify access control response

### Method 3. Direct API Test
```bash
curl -X POST http://your-server:8080/api/c66 \
  -H "Content-Type: application/json" \
  -d '{"barcodeData":"TEST-SCAN-123","device":"C66-TEST"}'
```

## Data Format Examples

### InfoWedge JSON Output
```json
{
  "barcodeData": "EMP001-JOHN-DOE-2024",
  "barcodeType": "QR_CODE",
  "timestamp": "2024-05-07T10:30:00Z",
  "device": "C66-001",
  "scanner": "C66"
}
```

### Expected System Response
```json
{
  "success": true,
  "message": "Access granted",
  "name": "John Doe",
  "entity_type": "employee",
  "entity_name": "John Doe",
  "direction": "AUTO",
  "status": "approved",
  "open_gate": true
}
```

## Troubleshooting

### Common Issues

#### 1. "403 Forbidden" Error
**Cause**: Scanner IP not in local network range
**Solution**: 
- Verify scanner and server are on same network
- Check server IP restrictions (192.168.x.x, 10.x.x.x, 172.16-31.x.x)

#### 2. "Connection Timeout" Error
**Cause**: Network connectivity issues
**Solution**:
- Check WiFi connection on C66 device
- Verify server is running and accessible
- Test with `ping your-server-ip`

#### 3. "No Response from Server" Error
**Cause**: Server not running or wrong port
**Solution**:
- Verify Mine Management System is running on port 8080
- Check firewall settings
- Test endpoint with browser or curl

#### 4. "Invalid Data Format" Error
**Cause**: InfoWedge field mapping incorrect
**Solution**:
- Verify JSON field mapping in InfoWedge
- Check Content-Type is set to `application/json`
- Review server logs for parsing errors

### Log Locations

#### InfoWedge Logs
- Path: `/sdcard/Android/data/com.symbol.datawedge/files/logs/`
- Files: `DataWedge.log`, `IP_Output.log`

#### Server Logs
- Path: `/path/to/mine-management-system/server.log`
- Look for: "SCAN LOG:", "C66", "infowedge"

## Security Considerations

### Network Security
- C66 endpoints restricted to local network IPs only
- No API keys required for C66 endpoints (IP-based auth)
- SSL optional for internal networks

### Data Protection
- All scan data logged in audit trail
- IP addresses recorded for traceability
- Failed scans logged for security monitoring

## Performance Optimization

### Buffer Settings
- Enable buffering for offline operation
- Set buffer size to 100-500 scans
- Auto-send buffer when connection restored

### Network Settings
- Set appropriate timeout values (5-10 seconds)
- Configure retry attempts (3-5 retries)
- Monitor heartbeat for connection health

## Maintenance

### Regular Checks
1. Weekly connection tests
2. Monthly log review
3. Quarterly firmware updates
4. Annual security audit

### Monitoring
- Monitor scan success rates
- Track response times
- Alert on connection failures
- Review access denied patterns

## Support

### Technical Support
- Check system logs first
- Test with known working QR codes
- Verify network connectivity
- Review InfoWedge configuration

### Emergency Procedures
1. Switch to alternative endpoint if primary fails
2. Enable manual entry mode
3. Use backup scanner if available
4. Contact system administrator

## Configuration File Download

The complete InfoWedge configuration can be downloaded from:
`http://your-server:8080/static/infowedge-config.json`

This file contains all settings needed for quick deployment across multiple devices.
