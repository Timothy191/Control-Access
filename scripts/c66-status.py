#!/usr/bin/env python3
"""
C66 Connection Status Dashboard
Shows complete connection status between C66 scanner and server
Usage: python3 scripts/c66-status.py
"""

import os
import subprocess
import sys
from datetime import datetime, timedelta

import requests

sys.path.insert(0, '/home/tim/Desktop/01.mine-management-system')

# Colors
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
CYAN = '\033[96m'
MAGENTA = '\033[95m'
BOLD = '\033[1m'
DIM = '\033[2m'
END = '\033[0m'

def check_server_running():
    """Check if server is running on port 8080"""
    try:
        result = subprocess.run(
            ['netstat', '-tlnp'],
            capture_output=True,
            text=True,
            timeout=2
        )
        if ':8080' in result.stdout:
            return True, "Port 8080 is listening"

        # Try ss command as fallback
        result = subprocess.run(
            ['ss', '-tlnp'],
            capture_output=True,
            text=True,
            timeout=2
        )
        if ':8080' in result.stdout:
            return True, "Port 8080 is listening"

        return False, "Port 8080 not found"
    except Exception as e:
        return False, f"Check failed: {str(e)[:30]}"

def check_api_endpoint():
    """Check if API endpoint is responding"""
    try:
        response = requests.get('http://localhost:8080/api/ai/status', timeout=3)
        if response.status_code == 200:
            data = response.json()
            provider = data.get('provider', 'unknown')
            return True, f"API responding (AI: {provider})"
        return False, f"API returned {response.status_code}"
    except requests.exceptions.ConnectionError:
        return False, "Connection refused - server down"
    except requests.exceptions.Timeout:
        return False, "API timeout"
    except Exception as e:
        return False, f"Error: {str(e)[:30]}"

def check_network_accessible():
    """Check if server is accessible from network IP"""
    try:
        response = requests.get('http://192.168.0.50:8080/api/ai/status', timeout=3)
        if response.status_code == 200:
            return True, "Network accessible (192.168.0.50:8080)"
        return False, f"Network returned {response.status_code}"
    except requests.exceptions.ConnectionError:
        return False, "Network connection refused"
    except requests.exceptions.Timeout:
        return False, "Network timeout"
    except Exception as e:
        return False, f"Network error: {str(e)[:30]}"

def check_c66_endpoint():
    """Check if C66 endpoint is accessible"""
    try:
        # Test the C66 endpoint with a simple POST
        response = requests.post(
            'http://192.168.0.50:8080/api/c66',
            data='TEST-CHECK',
            headers={'Content-Type': 'text/plain'},
            timeout=3
        )
        # We expect a 200 or 403 (if IP restricted)
        if response.status_code in [200, 403]:
            return True, f"C66 endpoint OK ({response.status_code})"
        return False, f"C66 endpoint returned {response.status_code}"
    except requests.exceptions.ConnectionError:
        return False, "C66 endpoint connection refused"
    except Exception as e:
        return False, f"C66 error: {str(e)[:30]}"

def get_last_scan_info():
    """Get information about the last scan from server.log"""
    try:
        from database import db_session, init_db
        from models import GateLog

        init_db()
        last_scan = db_session.query(GateLog).order_by(GateLog.scanned_at.desc()).first()

        if last_scan:
            time_ago = datetime.now() - last_scan.scanned_at
            minutes_ago = int(time_ago.total_seconds() / 60)

            if minutes_ago < 1:
                time_str = "Just now"
            elif minutes_ago < 60:
                time_str = f"{minutes_ago} min ago"
            else:
                hours_ago = minutes_ago // 60
                time_str = f"{hours_ago}h ago"

            return True, f"{last_scan.entity_name} ({time_str})"
        else:
            return False, "No scans in database"
    except Exception as e:
        return False, f"DB error: {str(e)[:30]}"

def count_recent_scans():
    """Count scans in last hour"""
    try:
        from database import db_session, init_db
        from models import GateLog

        init_db()
        one_hour_ago = datetime.now() - timedelta(hours=1)
        count = db_session.query(GateLog).filter(GateLog.scanned_at >= one_hour_ago).count()

        if count > 0:
            return True, f"{count} scans/hour"
        else:
            return False, "No scans in last hour"
    except Exception as e:
        return False, f"Count error: {str(e)[:30]}"

def check_log_file():
    """Check if server.log exists and is being written"""
    log_path = '/home/tim/Desktop/01.mine-management-system/server.log'

    if not os.path.exists(log_path):
        return False, "server.log not found"

    try:
        # Check last modified time
        mtime = os.path.getmtime(log_path)
        last_write = datetime.fromtimestamp(mtime)
        time_ago = datetime.now() - last_write

        if time_ago.total_seconds() < 300:  # Written in last 5 minutes
            return True, f"Log active (updated {int(time_ago.total_seconds()/60)}m ago)"
        else:
            return False, f"Log stale ({int(time_ago.total_seconds()/60)}m old)"
    except Exception as e:
        return False, f"Log check failed: {str(e)[:30]}"

def print_status():
    """Print complete status dashboard"""
    print(f"\n{BOLD}{CYAN}╔══════════════════════════════════════════════════════════════════╗{END}")
    print(f"{BOLD}{CYAN}║                   C66 CONNECTION STATUS                          ║{END}")
    print(f"{BOLD}{CYAN}╚══════════════════════════════════════════════════════════════════╝{END}")
    print(f"{DIM}Checked at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{END}\n")

    # Run all checks
    checks = [
        ("Server Running (Port 8080)", check_server_running),
        ("API Endpoint (localhost)", check_api_endpoint),
        ("Network Accessible (192.168.0.50)", check_network_accessible),
        ("C66 Endpoint (/api/c66)", check_c66_endpoint),
        ("Log File Active", check_log_file),
        ("Recent Scan Activity", count_recent_scans),
        ("Last Scan Recorded", get_last_scan_info),
    ]

    all_ok = True

    for name, check_func in checks:
        ok, message = check_func()
        status_icon = f"{GREEN}✓{END}" if ok else f"{RED}✗{END}"
        status_color = GREEN if ok else RED

        print(f"  {status_icon} {name:35} {status_color}{message}{END}")

        if not ok:
            all_ok = False

    # Print summary
    print(f"\n{BOLD}{'─' * 70}{END}")

    if all_ok:
        print(f"\n{BOLD}{GREEN}╔══════════════════════════════════════════════════════════════════╗{END}")
        print(f"{BOLD}{GREEN}║  ✅ ALL SYSTEMS GO - C66 Ready for USB/WiFi Scanning           ║{END}")
        print(f"{BOLD}{GREEN}╚══════════════════════════════════════════════════════════════════╝{END}")
        print(f"\n{BOLD}Next Steps:{END}")
        print("  1. Ensure C66 InfoWedge is configured with: http://192.168.0.50:8080/api/c66")
        print("  2. Scan a test QR code with C66")
        print("  3. Monitor with: python3 scripts/monitor-c66-scans.py")
        print("  4. For full test: ./scripts/c66-e2e-test.sh")
    else:
        print(f"\n{BOLD}{RED}╔══════════════════════════════════════════════════════════════════╗{END}")
        print(f"{BOLD}{RED}║  ❌ ISSUES DETECTED - Check failed items above                   ║{END}")
        print(f"{BOLD}{RED}╚══════════════════════════════════════════════════════════════════╝{END}")
        print(f"\n{BOLD}Troubleshooting:{END}")
        print("  • Server not running? Run: ./deploy-full-server.sh")
        print("  • Network issue? Check: sudo ufw allow 8080/tcp")
        print("  • No recent scans? This is normal if no scanning has occurred")

    print()

    return all_ok

if __name__ == '__main__':
    success = print_status()
    sys.exit(0 if success else 1)
