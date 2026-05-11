#!/usr/bin/env python3
"""
Real-time C66 scan monitor - watches for incoming scans from the C66 scanner
Usage: python3 scripts/monitor-c66-scans.py [duration_seconds]
"""

import sys
import time
import subprocess
import re
from datetime import datetime

sys.path.insert(0, '/home/tim/Desktop/01.mine-management-system')

# Colors
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
CYAN = '\033[96m'
MAGENTA = '\033[95m'
BOLD = '\033[1m'
END = '\033[0m'

def clear_screen():
    print('\033[2J\033[H', end='')

def print_header():
    print(f"{BOLD}{CYAN}╔══════════════════════════════════════════════════════════════════╗{END}")
    print(f"{BOLD}{CYAN}║              C66 SCAN MONITOR - Waiting for scans...             ║{END}")
    print(f"{BOLD}{CYAN}╚══════════════════════════════════════════════════════════════════╝{END}")
    print(f"{DIM}Monitoring server.log for C66 scan events...{END}")
    print(f"{DIM}Press Ctrl+C to stop{END}\n")

def parse_scan_line(line):
    """Parse a scan line from server.log"""
    # Look for patterns like:
    # - "C66 ingest: EMP001-..."
    # - "SCAN: IN/OUT - Name"
    # - "[C66] ..."
    
    patterns = [
        r'C66.*ingest.*[:\s]+([A-Z0-9\-]+)',
        r'SCAN.*(IN|OUT).*[:\s-]+([A-Z][a-z]+\s[A-Z][a-z]+)',
        r'access.*(granted|denied)',
        r'employee|vehicle|visitor',
    ]
    
    scan_data = {
        'timestamp': datetime.now().strftime('%H:%M:%S'),
        'raw': line.strip()
    }
    
    # Extract entity type
    if 'employee' in line.lower():
        scan_data['type'] = '👤 EMP'
    elif 'vehicle' in line.lower():
        scan_data['type'] = '🚗 VEH'
    elif 'visitor' in line.lower():
        scan_data['type'] = '🎫 VIS'
    else:
        scan_data['type'] = '❓ UNK'
    
    # Extract direction
    if 'IN' in line and 'OUT' not in line:
        scan_data['direction'] = f"{GREEN}→ IN {END}"
    elif 'OUT' in line:
        scan_data['direction'] = f"{RED}← OUT{END}"
    else:
        scan_data['direction'] = f"{YELLOW}↔ ???{END}"
    
    # Extract access decision
    if 'granted' in line.lower() or 'success' in line.lower():
        scan_data['access'] = f"{GREEN}✓ GRANTED{END}"
    elif 'denied' in line.lower() or 'failed' in line.lower():
        scan_data['access'] = f"{RED}✗ DENIED{END}"
    else:
        scan_data['access'] = f"{YELLOW}? PENDING{END}"
    
    # Extract name/entity
    name_match = re.search(r'entity_name[=:]([^,\s]+)', line)
    if name_match:
        scan_data['entity'] = name_match.group(1)
    else:
        # Try to extract from common patterns
        name_match = re.search(r'([A-Z][a-z]+\s+[A-Z][a-z]+)', line)
        scan_data['entity'] = name_match.group(1) if name_match else 'Unknown'
    
    return scan_data

def monitor_scans(duration=None):
    """Monitor server.log for scan events"""
    clear_screen()
    print_header()
    
    scans_detected = 0
    start_time = time.time()
    
    try:
        # Start tailing the log file
        proc = subprocess.Popen(
            ['tail', '-f', '/home/tim/Desktop/01.mine-management-system/server.log'],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True
        )
        
        print(f"{DIM}[{datetime.now().strftime('%H:%M:%S')}] Started monitoring...{END}\n")
        
        while True:
            # Check duration
            if duration and (time.time() - start_time) > duration:
                print(f"\n{BOLD}Monitoring complete - {scans_detected} scans detected{END}")
                break
            
            # Read line from log
            line = proc.stdout.readline()
            if not line:
                time.sleep(0.1)
                continue
            
            # Check if it's a scan event
            scan_indicators = ['C66', 'SCAN', 'ingest', 'gate_log', 'access_type', 'entity_name']
            if any(indicator in line for indicator in scan_indicators):
                scans_detected += 1
                scan = parse_scan_line(line)
                
                # Print scan event
                print(f"{BOLD}[{scan['timestamp']}]{END} "
                      f"{scan['type']} {scan['direction']} "
                      f"| {scan['access']} "
                      f"| {CYAN}{scan['entity'][:20]:20}{END}")
                
                # Print raw data in dim if it looks interesting
                if len(line.strip()) < 150:
                    print(f"{DIM}  {line.strip()[:100]}{END}")
                
                print()  # Blank line between scans
                
    except KeyboardInterrupt:
        print(f"\n\n{BOLD}Monitoring stopped by user{END}")
        print(f"Total scans detected: {scans_detected}")
        
    finally:
        proc.terminate()

if __name__ == '__main__':
    duration = None
    if len(sys.argv) > 1:
        try:
            duration = int(sys.argv[1])
            print(f"Will monitor for {duration} seconds...")
        except ValueError:
            pass
    
    monitor_scans(duration)
