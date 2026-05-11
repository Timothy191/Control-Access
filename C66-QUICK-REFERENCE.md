# C66 Chainway Scanner - Quick Reference

## Primary Endpoint
```
URL: http://your-server:8080/api/c66
Method: POST
Auth: IP-based (local network only)
```

## InfoWedge Settings

### Profile Configuration
- **Profile Name**: Mine Management C66
- **Associated App**: All Apps
- **Input Device**: C66 Built-in Scanner
- **Output**: IP Output

### IP Output Settings
```
Target URL: http://your-server:8080/api/c66
Method: POST
Content-Type: application/json
Timeout: 5000ms
Retry: 3 attempts
```

### Data Format (JSON)
```
barcodeData → {{barcode}}
barcodeType → {{barcodeFormat}}
timestamp → {{timestamp}}
device → {{deviceID}}
scanner → C66
```

## Test Commands

### Web Interface Test
1. Go to: `http://your-server:8080/scanner_config`
2. Click "Test C66 Connection"
3. Verify success response

### API Test
```bash
curl -X POST http://your-server:8080/api/c66 \
  -H "Content-Type: application/json" \
  -d '{"barcodeData":"TEST-123","device":"C66"}'
```

## Expected Response
```json
{
  "success": true/false,
  "message": "Access granted/denied",
  "name": "Entity Name",
  "entity_type": "employee/vehicle/visitor",
  "status": "approved/denied/pending",
  "open_gate": true/false
}
```

## Troubleshooting

### 403 Forbidden
- Check network connectivity
- Verify IP is local (192.168.x.x, 10.x.x.x, 172.16-31.x.x)

### Connection Timeout
- Test server accessibility: `ping your-server-ip`
- Verify server running on port 8080
- Check firewall settings

### Invalid Data
- Verify Content-Type: application/json
- Check field mapping in InfoWedge
- Review server logs

## Support Files
- **Full Guide**: `C66-INFOWEDGE-SETUP.md`
- **Config JSON**: `/static/infowedge-config.json`
- **Web Interface**: `/scanner_config`

## Emergency Fallback
If `/api/c66` fails, use: `http://your-server:8080/api/scan_alt`
