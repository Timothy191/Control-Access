# C66 Dual-Mode Quick Reference

## Auto-Switching Behavior
- **USB Plugged In** → USB Mode (Primary)
- **USB Unplugged** → WiFi Mode (Backup)
- **Both Available** → USB Preferred, WiFi Standby
- **Neither Available** → Buffer Scans

## Endpoints
```
Primary: http://192.168.0.217:8080/api/c66
Backup:  http://192.168.0.217:8080/api/c66
Alt:     http://192.168.0.217:8080/api/scan_alt
```

## InfoWedge Settings

### Profile Configuration
- **Name**: Mine Management Dual-Mode
- **Primary URL**: `http://192.168.0.217:8080/api/c66`
- **Backup URL**: `http://192.168.0.217:8080/api/c66`
- **Failover**: Enabled
- **Connection Check**: Every 15 seconds

### Data Format (JSON)
```
barcodeData → {{barcode}}
barcodeType → {{barcodeFormat}}
timestamp → {{timestamp}}
device → {{deviceID}}
scanner → C66-Dual
connection_mode → {{connectionType}}
```

## Setup Steps

### 1. USB Mode Setup
1. Connect C66 to PC via USB
2. Enable USB tethering on C66
3. Import dual-mode config into InfoWedge
4. Activate profile

### 2. WiFi Mode Setup
1. Connect C66 to same WiFi as PC (192.168.0.x)
2. Verify ping to 192.168.0.217
3. Auto-switching will handle WiFi when USB unplugged

### 3. Test Configuration
```bash
# Test endpoint
curl -X POST http://192.168.0.217:8080/api/c66 \
  -H "Content-Type: application/json" \
  -d '{"barcodeData":"TEST","device":"C66"}'

# Monitor logs
tail -f /home/tim/Desktop/01.mine-management-system/server.log | grep "SCAN"
```

## Configuration Files
- **Dual-Mode Config**: `/static/infowedge-dual-mode-config.json`
- **Download**: `http://192.168.0.217:8080/static/infowedge-dual-mode-config.json`
- **Web Interface**: `http://192.168.0.217:8080/scanner_config`

## Troubleshooting

### USB Not Working
- Check USB cable and tethering enabled
- Verify wwan0 interface exists
- Test with different USB port

### WiFi Not Working  
- Connect to same WiFi as PC
- Verify IP in 192.168.0.x range
- Test ping to 192.168.0.217

### Auto-Switching Not Working
- Check failover settings in InfoWedge
- Verify connection check intervals
- Review InfoWedge logs

## Test Commands
```bash
# Run full dual-mode test
./test-dual-mode.sh

# Test USB mode specifically
curl -X POST http://192.168.0.217:8080/api/c66 \
  -H "User-Agent: C66-USB-Test" \
  -d '{"barcodeData":"USB-TEST","device":"C66-USB"}'

# Test WiFi mode specifically  
curl -X POST http://192.168.0.217:8080/api/c66 \
  -H "User-Agent: C66-WiFi-Test" \
  -d '{"barcodeData":"WIFI-TEST","device":"C66-WiFi"}'
```

## Success Indicators
✅ USB mode activates when plugged in  
✅ WiFi mode activates when USB unplugged  
✅ Auto-switching happens within 15-30 seconds  
✅ Buffered scans sent on reconnection  
✅ No scan data lost during mode switches

## Emergency Fallback
If both modes fail:
1. Enable buffer-only mode
2. Continue scanning (buffered)
3. Restore any connection to send buffer
4. Use alternative endpoint if needed
