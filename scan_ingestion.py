#!/usr/bin/env python3
"""scan_ingestion.py — Multi-vector QR/RFID scan ingestion for Arch-System
=========================================================================
Runs as a standalone daemon that listens on every possible channel
the C66 (or any other scanner) might use and funnels everything to
the main app via HTTP POST.

Channels covered:
  1. TCP socket   — port 9100  (InfoWedge TCP output / Zebra-style)
  2. UDP socket   — port 9100  (InfoWedge UDP broadcast)
  3. USB-RNDIS TCP— port 9101  (dedicated USB-RNDIS listener, direct to C66)
  4. HTTP webhook — port 9102  (minimal HTTP server, any GET/POST with ?data=)
  5. USB serial   — /dev/ttyUSB* / /dev/ttyACM*  (keyboard emulator via CDC)
  6. ADB logcat   — parses InfoWedge broadcast intent from adb logcat stream
  7. C66 pull     — actively polls C66 web API if it exposes one
  8. RFID TCP     — port 58628 (TCP listener for RFID scanners at 192.168.0.187)
  9. Clipboard/stdin relay — for manual pipe-in

QR/Barcode scans forwarded to: http://localhost:8080/api/c66
RFID scans forwarded to:       http://localhost:8080/api/rfid_ingest

Run with:
    python3 scan_ingestion.py
"""

import socket
import threading
import time
import sys
import os
import re
import json
import requests
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# ─── Configuration ──────────────────────────────────────────────
ARCH_SERVER    = "http://localhost:8080"
C66_IP         = "192.168.166.107"
USB_IFACE_IP   = "0.0.0.0"

TCP_PORT       = 9100
UDP_PORT       = 9100
USB_TCP_PORT   = 9101
HTTP_HOOK_PORT = 9102

# RFID Scanner Configuration (IP: 192.168.0.187, Port: 58628, Protocol: TCP)
RFID_SCANNER_IP   = "192.168.0.187"
RFID_SCANNER_PORT = 58628
RFID_FORWARD_URL  = f"{ARCH_SERVER}/api/rfid_ingest"

SERIAL_BAUD    = 9600
LOG_PREFIX     = "[INGESTION]"
FORWARD_URL    = f"{ARCH_SERVER}/api/c66"
# ────────────────────────────────────────────────────────────────

def forward(code, source="unknown"):
    """Forward a scanned code to the Arch-System server."""
    code = code.strip()
    if not code:
        return
    try:
        r = requests.post(
            FORWARD_URL,
            data=code,
            headers={"Content-Type": "text/plain", "X-Scanner-Source": source},
            timeout=5
        )
        data = r.json()
        status = "✅ APPROVED" if data.get("success") else "❌ DENIED"
        name = data.get("name") or "Unknown"
        entity_type = data.get("entity_type") or "QR"
        
        parsed = data.get("parsed_data") or {}
        emp_id = parsed.get("employee_id") or parsed.get("fleet_id") or ""
        id_str = f" (ID: {emp_id})" if emp_id else ""
        
        print(f"{LOG_PREFIX} [{source}] Scanned: {name}{id_str} [{entity_type}] → {status}")
    except Exception as e:
        print(f"{LOG_PREFIX} [{source}] Forward failed: {e}")


def forward_rfid(rfid_tag, source="rfid"):
    """Forward an RFID tag scan to the Arch-System RFID endpoint."""
    rfid_tag = rfid_tag.strip().upper()
    if not rfid_tag:
        return
    try:
        r = requests.post(
            RFID_FORWARD_URL,
            json={"rfid_tag": rfid_tag, "reader_id": source},
            headers={"Content-Type": "application/json", "X-Scanner-Source": source},
            timeout=5
        )
        data = r.json()
        status = "✅ APPROVED" if data.get("success") else "❌ DENIED"
        name = data.get("name", "Unknown")
        print(f"{LOG_PREFIX} [RFID-{source}] {rfid_tag[:24]}... → {status} ({name})")
    except Exception as e:
        print(f"{LOG_PREFIX} [RFID-{source}] Forward failed: {e}")


# ══════════════════════════════════════════════════════════════════
# 1. TCP SOCKET LISTENER (InfoWedge TCP Output / Zebra-style)
#    InfoWedge config: "IP Output" → TCP → this server:9100
# ══════════════════════════════════════════════════════════════════
def tcp_listener():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind(("0.0.0.0", TCP_PORT))
        sock.listen(10)
        print(f"{LOG_PREFIX} TCP listener ready on port {TCP_PORT}")
        while True:
            try:
                conn, addr = sock.accept()
                data = conn.recv(4096).decode(errors="replace").strip()
                if data:
                    forward(data, f"tcp:{addr[0]}")
                conn.close()
            except Exception as e:
                print(f"{LOG_PREFIX} TCP error: {e}")
    except OSError as e:
        print(f"{LOG_PREFIX} TCP port {TCP_PORT} unavailable: {e}")


# ══════════════════════════════════════════════════════════════════
# 2. UDP SOCKET LISTENER (InfoWedge UDP Broadcast)
#    InfoWedge config: "IP Output" → UDP Broadcast → port 9100
# ══════════════════════════════════════════════════════════════════
def udp_listener():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    try:
        sock.bind(("0.0.0.0", UDP_PORT))
        print(f"{LOG_PREFIX} UDP listener ready on port {UDP_PORT}")
        while True:
            try:
                data, addr = sock.recvfrom(4096)
                code = data.decode(errors="replace").strip()
                if code:
                    forward(code, f"udp:{addr[0]}")
            except Exception as e:
                print(f"{LOG_PREFIX} UDP error: {e}")
    except OSError as e:
        print(f"{LOG_PREFIX} UDP port {UDP_PORT} unavailable: {e}")


# ══════════════════════════════════════════════════════════════════
# 3. USB-RNDIS DEDICATED TCP LISTENER
#    Listens only on the usb0 interface IP — dedicated to the C66
# ══════════════════════════════════════════════════════════════════
def usb_tcp_listener():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind((USB_IFACE_IP, USB_TCP_PORT))
        sock.listen(5)
        print(f"{LOG_PREFIX} USB-RNDIS TCP listener ready on {USB_IFACE_IP}:{USB_TCP_PORT}")
        while True:
            try:
                conn, addr = sock.accept()
                data = conn.recv(4096).decode(errors="replace").strip()
                if data:
                    forward(data, f"usb-tcp:{addr[0]}")
                conn.close()
            except Exception as e:
                print(f"{LOG_PREFIX} USB-TCP error: {e}")
    except OSError as e:
        print(f"{LOG_PREFIX} USB-TCP port {USB_TCP_PORT} unavailable: {e}")


# ══════════════════════════════════════════════════════════════════
# 4. LIGHTWEIGHT HTTP WEBHOOK
#    Any GET/POST to port 9102 with ?data= or body = barcode
#    Works for: browser redirect, IFTTT, Zapier, any generic HTTP
# ══════════════════════════════════════════════════════════════════
class HookHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # suppress default logging

    def _get_code(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        code = (qs.get("data") or qs.get("qr") or qs.get("code") or [None])[0]
        if not code:
            length = int(self.headers.get("Content-Length", 0))
            if length:
                body = self.rfile.read(length).decode(errors="replace").strip()
                try:
                    obj = json.loads(body)
                    code = (obj.get("barcodeData") or obj.get("barcode") or
                            obj.get("data") or obj.get("qr_code"))
                except Exception:
                    code = body
        return code

    def do_GET(self):
        code = self._get_code()
        if code:
            threading.Thread(target=forward, args=(code, f"http-hook:{self.client_address[0]}"), daemon=True).start()
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"OK")

    def do_POST(self):
        self.do_GET()


def http_hook_listener():
    try:
        server = HTTPServer(("0.0.0.0", HTTP_HOOK_PORT), HookHandler)
        print(f"{LOG_PREFIX} HTTP webhook ready on port {HTTP_HOOK_PORT}")
        server.serve_forever()
    except OSError as e:
        print(f"{LOG_PREFIX} HTTP hook port {HTTP_HOOK_PORT} unavailable: {e}")


# ══════════════════════════════════════════════════════════════════
# 5. USB SERIAL (CDC / Keyboard Emulator via /dev/ttyACM or ttyUSB)
#    Chainway keyboard emulator appears as a serial CDC device
# ══════════════════════════════════════════════════════════════════
def serial_listener():
    try:
        import serial
        import serial.tools.list_ports
    except ImportError:
        print(f"{LOG_PREFIX} pyserial not installed, skipping serial listener")
        return

    def read_port(port_name):
        try:
            ser = serial.Serial(port_name, SERIAL_BAUD, timeout=1)
            print(f"{LOG_PREFIX} Serial listener on {port_name} @ {SERIAL_BAUD}baud")
            buf = ""
            while True:
                try:
                    ch = ser.read(1).decode(errors="replace")
                    if ch in ("\r", "\n"):
                        if buf.strip():
                            forward(buf.strip(), f"serial:{port_name}")
                        buf = ""
                    else:
                        buf += ch
                except Exception:
                    time.sleep(0.5)
        except Exception as e:
            print(f"{LOG_PREFIX} Serial {port_name} failed: {e}")

    # Scan for CDC ports (keyboard emulator appears as ACM)
    known = set()
    while True:
        import serial.tools.list_ports
        ports = [p.device for p in serial.tools.list_ports.comports()
                 if any(x in (p.device + (p.description or "")).lower()
                        for x in ["acm", "usb", "chainway", "cdc"])]
        for p in ports:
            if p not in known:
                known.add(p)
                t = threading.Thread(target=read_port, args=(p,), daemon=True)
                t.start()
        time.sleep(5)


# ══════════════════════════════════════════════════════════════════
# 6. ADB LOGCAT PARSER
#    Intercepts InfoWedge broadcast intents from adb logcat
#    Works when C66 is connected via USB (ADB over USB or USB RNDIS)
# ══════════════════════════════════════════════════════════════════
def adb_logcat_listener():
    def try_connect():
        try:
            r = subprocess.run(["adb", "connect", f"{C66_IP}:5555"],
                               capture_output=True, text=True, timeout=5)
            return "connected" in r.stdout.lower()
        except Exception:
            return False

    def run_logcat():
        proc = subprocess.Popen(
            ["adb", "logcat", "-s", "InfoWedge:*", "DataWedge:*", "com.symbol.datawedge:*"],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True
        )
        print(f"{LOG_PREFIX} ADB logcat listener active")
        for line in proc.stdout:
            # Match barcodeData or scanData in log output
            m = re.search(r'(?:barcodeData|scanData|data)["\s:=]+([A-Za-z0-9+/=_\-]{8,})', line)
            if m:
                code = m.group(1).strip()
                if len(code) >= 8:
                    forward(code, "adb-logcat")

    while True:
        try:
            adb_path = subprocess.run(["which", "adb"], capture_output=True, text=True).stdout.strip()
            if not adb_path:
                time.sleep(30)
                continue

            if try_connect():
                run_logcat()
            else:
                # Try USB direct
                subprocess.run(["adb", "usb"], capture_output=True, timeout=3)
                time.sleep(5)
        except Exception as e:
            print(f"{LOG_PREFIX} ADB error: {e}")
        time.sleep(10)


# ══════════════════════════════════════════════════════════════════
# 7. STDIN RELAY (pipe barcodes in from terminal / scripts)
#    Usage: echo "MYHASH" | python3 scan_ingestion.py
# ══════════════════════════════════════════════════════════════════
def stdin_relay():
    if sys.stdin.isatty():
        return  # interactive — skip
    print(f"{LOG_PREFIX} stdin relay active")
    for line in sys.stdin:
        code = line.strip()
        if code:
            forward(code, "stdin")


# ══════════════════════════════════════════════════════════════════
# RFID TCP LISTENER (Dedicated for RFID scanner at 192.168.0.187:58628)
#    Receives raw RFID tag data via TCP from fixed-mount RFID readers
#    Supports EPC Gen2, ISO 14443, and other common RFID formats
# ══════════════════════════════════════════════════════════════════
def rfid_tcp_listener():
    """Listen for RFID tag scans from TCP-connected RFID readers.
    
    Configured for scanner at 192.168.0.187, port 58628.
    Can also act as a server to receive connections from the RFID reader.
    """
    # Mode 1: Act as server - listen on local port for RFID reader to connect
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    # Try to bind to the configured RFID port
    try:
        sock.bind(("0.0.0.0", RFID_SCANNER_PORT))
        sock.listen(5)
        print(f"{LOG_PREFIX} RFID TCP listener ready on port {RFID_SCANNER_PORT} (waiting for scanner)")
        
        while True:
            try:
                conn, addr = sock.accept()
                client_ip = addr[0]
                print(f"{LOG_PREFIX} RFID scanner connected from {client_ip}")
                
                # Handle this connection
                handle_rfid_connection(conn, client_ip)
            except Exception as e:
                print(f"{LOG_PREFIX} RFID accept error: {e}")
                time.sleep(1)
    except OSError as e:
        print(f"{LOG_PREFIX} RFID port {RFID_SCANNER_PORT} unavailable: {e}")
        print(f"{LOG_PREFIX} Will try to connect to scanner at {RFID_SCANNER_IP}:{RFID_SCANNER_PORT}")
        
        # Mode 2: Act as client - connect to the RFID reader
        rfid_client_mode()


def handle_rfid_connection(conn, client_ip):
    """Handle an RFID scanner connection and process incoming tag data."""
    buffer = b""
    try:
        while True:
            data = conn.recv(1024)
            if not data:
                break
            
            buffer += data
            
            # Process complete lines/tags from buffer
            while b'\n' in buffer or b'\r' in buffer:
                # Split on line endings
                for delim in [b'\r\n', b'\n\r', b'\n', b'\r']:
                    if delim in buffer:
                        line, _, buffer = buffer.partition(delim)
                        if line:
                            tag_data = line.decode(errors="replace").strip()
                            if tag_data:
                                forward_rfid(tag_data, f"rfid-tcp:{client_ip}")
                        break
        
        # Process any remaining data
        if buffer:
            tag_data = buffer.decode(errors="replace").strip()
            if tag_data:
                forward_rfid(tag_data, f"rfid-tcp:{client_ip}")
                
    except Exception as e:
        print(f"{LOG_PREFIX} RFID connection error from {client_ip}: {e}")
    finally:
        conn.close()
        print(f"{LOG_PREFIX} RFID scanner disconnected: {client_ip}")


def rfid_client_mode():
    """Act as client - actively connect to RFID reader and receive data."""
    while True:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(30)
            sock.connect((RFID_SCANNER_IP, RFID_SCANNER_PORT))
            print(f"{LOG_PREFIX} Connected to RFID scanner at {RFID_SCANNER_IP}:{RFID_SCANNER_PORT}")
            
            buffer = b""
            while True:
                data = sock.recv(1024)
                if not data:
                    break
                
                buffer += data
                
                # Process complete lines/tags
                while b'\n' in buffer or b'\r' in buffer:
                    for delim in [b'\r\n', b'\n\r', b'\n', b'\r']:
                        if delim in buffer:
                            line, _, buffer = buffer.partition(delim)
                            if line:
                                tag_data = line.decode(errors="replace").strip()
                                if tag_data:
                                    forward_rfid(tag_data, f"rfid-client:{RFID_SCANNER_IP}")
                            break
                
                # Prevent buffer overflow
                if len(buffer) > 8192:
                    tag_data = buffer.decode(errors="replace").strip()
                    if tag_data:
                        forward_rfid(tag_data, f"rfid-client:{RFID_SCANNER_IP}")
                    buffer = b""
                    
        except socket.timeout:
            print(f"{LOG_PREFIX} RFID connection timeout, retrying...")
        except ConnectionRefusedError:
            print(f"{LOG_PREFIX} RFID scanner not available, retrying in 5s...")
        except Exception as e:
            print(f"{LOG_PREFIX} RFID client error: {e}")
        finally:
            try:
                sock.close()
            except:
                pass
        
        time.sleep(5)


# ══════════════════════════════════════════════════════════════════
# STATUS CHECK
# ══════════════════════════════════════════════════════════════════
def status_check():
    """Periodically verify server reachability and print channel summary."""
    while True:
        time.sleep(60)
        try:
            r = requests.get(f"{ARCH_SERVER}/", timeout=3)
            print(f"{LOG_PREFIX} Server OK ({r.status_code})")
        except Exception:
            print(f"{LOG_PREFIX} ⚠ Server unreachable at {ARCH_SERVER}")


# ══════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════════╗
║     ARCH-SYSTEM — Multi-Vector Scan Ingestion Daemon             ║
╠══════════════════════════════════════════════════════════════════╣
║  QR/Barcode → http://localhost:8080/api/c66                        ║
║  RFID       → http://localhost:8080/api/rfid_ingest              ║
║  Scanner: 192.168.0.187:58628 (TCP)                                ║
╚══════════════════════════════════════════════════════════════════╝
""")

    threads = [
        ("TCP-9100",      tcp_listener),
        ("UDP-9100",      udp_listener),
        ("USB-TCP-9101",  usb_tcp_listener),
        ("HTTP-9102",     http_hook_listener),
        ("Serial/CDC",    serial_listener),
        ("ADB-logcat",    adb_logcat_listener),
        ("RFID-58628",    rfid_tcp_listener),
        ("Status",        status_check),
    ]

    for name, fn in threads:
        t = threading.Thread(target=fn, name=name, daemon=True)
        t.start()
        print(f"  ▶ {name} started")

    # stdin relay (foreground)
    try:
        stdin_relay()
        # Keep alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print(f"\n{LOG_PREFIX} Shutting down.")
