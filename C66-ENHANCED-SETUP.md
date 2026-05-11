# C66 Enhanced Configuration with Fallback & Tunnel Support

## Overview
Fine-tuned C66 configuration with advanced fallback mechanisms, tunnel support, and connection health monitoring for maximum reliability.

## Connection Strategy

### Primary Connection
- **Type**: Direct HTTP
- **URL**: `http://192.168.0.217:8080/api/c66`
- **Priority**: 1 (Primary)
- **Timeout**: 5 seconds (adaptive)
- **Retries**: 3 (exponential backoff)

### Fallback Cascade
1. **Alternative Endpoint**: `/api/scan_alt` (7s timeout, 5 retries)
2. **Tunnel Proxy**: Port 8081 → 8080 (10s timeout, 7 retries)
3. **Mesh Network**: Multiple nodes (15s timeout, 10 retries)

### Auto-Switching Logic
- **Health Score**: Below 70% → Trigger fallback
- **Connection Lost**: Immediate fallback activation
- **Primary Restored**: Auto-switch back (with cooldown)

## Fine-Tuning Parameters

### Connection Optimization
```
Base Timeout: 5000ms
Max Timeout: 15000ms
Timeout Increment: 1000ms
Adaptive Timeout: Enabled
Connection Quality Threshold: 80%
```

### Buffer Management
```
Smart Buffering: Enabled
Base Buffer Size: 500 scans
Max Buffer Size: 1000 scans
Compression: Gzip
Priority Scans: Enabled
Flush Triggers: Connection restored, Buffer 80% full, 30s interval
```

### Health Monitoring
```
Continuous Ping: Every 5 seconds
Latency Tracking: Enabled
Packet Loss Tracking: Enabled
Connection Quality Scoring: Enabled
Auto Failover: Enabled
Health Score Threshold: 70%
```

## Step-by-Step Enhanced Setup

### 1. Primary Configuration
1. **Import Enhanced Config**
   - Download: `http://192.168.0.217:8080/static/infowedge-enhanced-config.json`
   - InfoWedge → Profiles → Import
   - Select enhanced config file

2. **Configure Primary Endpoint**
   - URL: `http://192.168.0.217:8080/api/c66`
   - Method: POST
   - Content-Type: application/json
   - Timeout: 5000ms
   - Retries: 3

3. **Enable Advanced Features**
   - Adaptive timeout: Enabled
   - Connection quality monitoring: Enabled
   - Smart buffering: Enabled
   - Performance optimization: Enabled

### 2. Fallback Configuration

#### Alternative Endpoint
```
URL: http://192.168.0.217:8080/api/scan_alt
Trigger: Primary timeout, error, connection lost
Timeout: 7000ms
Retries: 5
Priority: 2
```

#### Tunnel Support
```
Tunnel Type: HTTP Tunnel
Backup Server: http://192.168.0.217:8081
Tunnel Port: 8082
Load Balancing: Enabled
Auto Switch: Enabled
```

#### Mesh Network
```
Nodes: 
- 192.168.0.217:8080 (Primary)
- 192.168.0.217:8081 (Tunnel)
- 192.168.0.217:8082 (Mesh)
Discovery: Enabled
Auto Routing: Enabled
```

### 3. Health Monitoring Setup

#### Connection Quality Metrics
```
Metrics Tracked:
- Response time (latency)
- Packet loss rate
- Connection success rate
- Error frequency
- Bandwidth utilization
```

#### Auto-Failover Triggers
```
Health Score < 70%: Switch to fallback
3 consecutive failures: Switch to fallback
Connection timeout > 15s: Switch to fallback
Packet loss > 5%: Switch to fallback
```

## Advanced Features

### Adaptive Timeout
- **Base**: 5000ms
- **Maximum**: 15000ms
- **Adjustment**: +1000ms per failure
- **Reset**: On successful connection

### Smart Buffering
- **Compression**: Gzip enabled
- **Priority Scans**: Critical scans first
- **Batch Processing**: 10 scans per batch
- **Flush Triggers**: Multiple conditions

### Performance Optimization
- **Concurrent Connections**: Up to 3
- **Connection Pooling**: Enabled
- **Keep Alive**: Every 10 seconds
- **Load Balancing**: Weighted round-robin

## Testing Procedures

### 1. Primary Connection Test
```bash
# Test primary endpoint
curl -X POST http://192.168.0.217:8080/api/c66 \
  -H "Content-Type: application/json" \
  -H "User-Agent: C66-Enhanced-Primary" \
  -d '{"barcodeData":"PRIMARY-TEST","device":"C66-Enhanced"}' \
  --max-time 5
```

### 2. Fallback Cascade Test
```bash
# Test alternative endpoint
curl -X POST http://192.168.0.217:8080/api/scan_alt \
  -H "Content-Type: application/json" \
  -H "User-Agent: C66-Enhanced-Fallback" \
  -d '{"barcodeData":"FALLBACK-TEST","device":"C66-Fallback"}' \
  --max-time 7

# Test tunnel endpoint
curl -X POST http://192.168.0.217:8082/api/c66 \
  -H "Content-Type: application/json" \
  -H "User-Agent: C66-Enhanced-Tunnel" \
  -d '{"barcodeData":"TUNNEL-TEST","device":"C66-Tunnel"}' \
  --max-time 10
```

### 3. Stress Testing
```bash
# Concurrent scan test
for i in {1..20}; do
  curl -X POST http://192.168.0.217:8080/api/c66 \
    -H "Content-Type: application/json" \
    -d '{"barcodeData":"STRESS-'$i'","device":"C66-Stress"}' &
done

# Wait and check results
wait
```

### 4. Failure Simulation
```bash
# Simulate primary failure
curl -X POST http://192.168.0.217:8080/api/c66 \
  -H "Content-Type: application/json" \
  -d '{"barcodeData":"SIMULATE-FAILURE","device":"C66-Fail-Sim"}' \
  --max-time 1 \
  --connect-timeout 1
```

## Data Flow Examples

### Enhanced Scan Data
```json
{
  "barcodeData": "EMP001-JOHN-DOE-2024",
  "barcodeType": "QR_CODE",
  "timestamp": "2024-05-07T10:30:00Z",
  "device": "C66-Enhanced-001",
  "scanner": "C66-Enhanced",
  "connection_mode": "HTTP-Direct",
  "pc_target": "192.168.0.217",
  "fallback_used": "none",
  "retry_count": 0,
  "health_score": 95,
  "latency": 45
}
```

### Fallback Response
```json
{
  "barcodeData": "EMP001-JOHN-DOE-2024",
  "barcodeType": "QR_CODE",
  "timestamp": "2024-05-07T10:30:00Z",
  "device": "C66-Enhanced-001",
  "scanner": "C66-Enhanced",
  "connection_mode": "HTTP-Fallback",
  "pc_target": "192.168.0.217",
  "fallback_used": "alternative_endpoint",
  "retry_count": 2,
  "health_score": 65,
  "latency": 120
}
```

## Monitoring & Diagnostics

### Real-Time Health Dashboard
```bash
# Monitor connection health
watch -n 5 'curl -s http://192.168.0.217:8080/api/c66 \
  -H "Content-Type: application/json" \
  -d "{\"health_check\":true}" \
  -w "%{time_total}\n" | tail -1'

# Check server logs for health metrics
tail -f /home/tim/Desktop/01.mine-management-system/server.log | \
  grep -E "(HEALTH|LATENCY|FALLBACK|TUNNEL|BUFFER)"
```

### Performance Metrics
```bash
# Generate performance report
curl -X POST http://192.168.0.217:8080/api/c66 \
  -H "Content-Type: application/json" \
  -d '{"action":"performance_report","device":"C66-Enhanced"}'

# Check buffer status
curl -X POST http://192.168.0.217:8080/api/c66 \
  -H "Content-Type: application/json" \
  -d '{"action":"buffer_status","device":"C66-Enhanced"}'
```

## Troubleshooting Advanced Issues

### Fallback Not Triggering
**Symptoms**: Primary fails but fallback doesn't activate
**Causes**:
- Health score threshold too high
- Failure detection not working
- Switch cooldown active

**Solutions**:
1. Lower health score threshold to 60%
2. Check failure detection logic
3. Verify switch cooldown settings
4. Review InfoWedge logs

### Tunnel Connection Issues
**Symptoms**: Tunnel endpoint not accessible
**Causes**:
- Backup server not running
- Port 8081 blocked
- Tunnel routing misconfigured

**Solutions**:
1. Start backup server on port 8081
2. Check firewall rules for tunnel
3. Verify tunnel configuration
4. Test tunnel connectivity directly

### Buffer Management Problems
**Symptoms**: Scans lost during failover
**Causes**:
- Buffer not flushing on switch
- Buffer size too small
- Compression not working

**Solutions**:
1. Enable buffer flush on connection change
2. Increase buffer size to 1000
3. Verify compression is enabled
4. Check buffer flush triggers

### Performance Degradation
**Symptoms**: Slow response times, high latency
**Causes**:
- Network congestion
- Server overload
- Connection pool exhaustion

**Solutions**:
1. Enable connection pooling
2. Adjust timeout values
3. Enable load balancing
4. Monitor server resources

## Configuration Files

### Enhanced Configuration
- **Download**: `http://192.168.0.217:8080/static/infowedge-enhanced-config.json`
- **Features**: All advanced fallback and tuning options

### Testing Scripts
- **Enhanced Test**: `test-enhanced.sh` (comprehensive testing suite)
- **Stress Test**: `stress-test.sh` (load testing)
- **Health Monitor**: `health-monitor.sh` (continuous monitoring)

## Emergency Procedures

### Complete Network Failure
1. **Enable Emergency Mode**: All endpoints failed
2. **Buffer All Scans**: Maximum buffer size
3. **Local Storage**: Save scans to device
4. **Retry All Endpoints**: Continuous retry attempts
5. **Manual Notification**: Alert system administrator

### Tunnel Failure
1. **Switch to Mesh**: Use mesh nodes if available
2. **Alternative Tunnels**: Try different tunnel protocols
3. **Direct Connection**: Bypass tunnel if possible
4. **Network Reset**: Reset network stack if needed

### Performance Emergency
1. **Disable Advanced Features**: Reduce overhead
2. **Increase Timeouts**: Allow more time for responses
3. **Reduce Concurrent**: Limit to 1 connection
4. **Basic Mode**: Fallback to simple configuration

## Success Indicators

✅ **Enhanced Configuration Working When:**
- Primary endpoint responds within 5 seconds
- Fallback activates within 2 seconds of primary failure
- Tunnel provides backup connectivity when needed
- Health monitoring shows scores above 80%
- Buffer management prevents data loss
- Performance optimization maintains <100ms response times
- Stress testing handles 20+ concurrent scans
- Emergency procedures activate correctly

The enhanced configuration provides enterprise-grade reliability with multiple fallback layers, intelligent routing, and comprehensive monitoring for continuous operation.
