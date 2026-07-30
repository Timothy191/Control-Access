#!/usr/bin/env python3
"""
rfid_listener.py — Standalone RFID TCP Listener
=================================================
Dedicated listener for RFID scanners configured at:
  - IP: 192.168.0.187
  - Port: 58628
  - Protocol: TCP

Receives raw RFID tag data (EPC Gen2, ISO 14443, etc.) and forwards
to the main application API at /api/rfid_ingest.

Data Formatting:
- Strips separators (: - space .)
- Removes common prefixes (EPC: UID: TAG: RFID:)
- Validates hex content for RFID tags
- Normalizes to uppercase

Run with:
    python3 rfid_listener.py

Or run in background:
    nohup python3 rfid_listener.py &
"""

import socket
import sys
import threading
import time

import requests

# Configuration
ARCH_SERVER = "http://localhost:8080"
RFID_SCANNER_IP = "192.168.0.187"
RFID_SCANNER_PORT = 58628
RFID_FORWARD_URL = f"{ARCH_SERVER}/api/rfid_ingest"
LOG_PREFIX = "[RFID]"


def format_rfid_tag(raw_tag):
    """Format and normalize RFID tag data."""
    if not raw_tag:
        return None

    tag = raw_tag.strip().upper()
    tag = tag.replace(":", "").replace("-", "").replace(" ", "").replace(".", "")

    prefixes = ["EPC:", "UID:", "TAG:", "RFID:", "[", "]"]
    for prefix in prefixes:
        tag = tag.replace(prefix, "")

    return tag


def forward_rfid(rfid_tag, source):
    """Forward RFID tag to the main server."""
    rfid_tag = rfid_tag.strip().upper()
    if not rfid_tag:
        return

    formatted = format_rfid_tag(rfid_tag)

    try:
        r = requests.post(
            RFID_FORWARD_URL,
            json={"rfid_tag": formatted, "reader_id": source},
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        data = r.json()
        status = "✅ APPROVED" if data.get("success") else "❌ DENIED"
        name = data.get("name", "Unknown")
        print(f"{LOG_PREFIX} [{source}] {formatted[:24]}... → {status} ({name})")
    except Exception as e:
        print(f"{LOG_PREFIX} [{source}] Forward failed: {e}")


def handle_connection(conn, addr):
    """Handle an RFID scanner connection."""
    client_ip = addr[0]
    print(f"{LOG_PREFIX} Scanner connected from {client_ip}")

    buffer = b""
    try:
        while True:
            data = conn.recv(1024)
            if not data:
                break

            buffer += data

            # Process line-by-line
            while b'\n' in buffer:
                line, _, buffer = buffer.partition(b'\n')
                tag_data = line.decode(errors="replace").strip()
                if tag_data:
                    forward_rfid(tag_data, f"rfid:{client_ip}")

        # Process remaining data
        if buffer:
            tag_data = buffer.decode(errors="replace").strip()
            if tag_data:
                forward_rfid(tag_data, f"rfid:{client_ip}")

    except Exception as e:
        print(f"{LOG_PREFIX} Connection error from {client_ip}: {e}")
    finally:
        conn.close()
        print(f"{LOG_PREFIX} Scanner disconnected: {client_ip}")


def server_mode():
    """Run as server - listen for incoming connections."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    try:
        sock.bind(("0.0.0.0", RFID_SCANNER_PORT))
        sock.listen(5)
        print(f"{LOG_PREFIX} RFID listener started on port {RFID_SCANNER_PORT}")
        print(f"{LOG_PREFIX} Waiting for scanner connections...")

        while True:
            conn, addr = sock.accept()
            threading.Thread(target=handle_connection, args=(conn, addr), daemon=True).start()

    except OSError as e:
        print(f"{LOG_PREFIX} Cannot bind port {RFID_SCANNER_PORT}: {e}")
        sys.exit(1)


def client_mode():
    """Run as client - connect to RFID reader."""
    print(f"{LOG_PREFIX} Client mode - connecting to {RFID_SCANNER_IP}:{RFID_SCANNER_PORT}")

    while True:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(30)
            sock.connect((RFID_SCANNER_IP, RFID_SCANNER_PORT))
            print(f"{LOG_PREFIX} Connected to RFID scanner")

            buffer = b""
            while True:
                data = sock.recv(1024)
                if not data:
                    break

                buffer += data
                while b'\n' in buffer:
                    line, _, buffer = buffer.partition(b'\n')
                    tag_data = line.decode(errors="replace").strip()
                    if tag_data:
                        forward_rfid(tag_data, f"rfid:{RFID_SCANNER_IP}")

            if buffer:
                tag_data = buffer.decode(errors="replace").strip()
                if tag_data:
                    forward_rfid(tag_data, f"rfid:{RFID_SCANNER_IP}")

        except ConnectionRefusedError:
            print(f"{LOG_PREFIX} Connection refused, retrying in 5s...")
        except TimeoutError:
            print(f"{LOG_PREFIX} Connection timeout, retrying...")
        except Exception as e:
            print(f"{LOG_PREFIX} Error: {e}")
        finally:
            try:
                sock.close()
            except:
                pass

        time.sleep(5)


if __name__ == "__main__":
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║     RFID TCP Listener                                        ║
╠══════════════════════════════════════════════════════════════╣
║  Scanner IP:   {RFID_SCANNER_IP:<20}                     ║
║  Port:         {RFID_SCANNER_PORT:<20}                     ║
║  Forward to:   {RFID_FORWARD_URL:<35}     ║
╚══════════════════════════════════════════════════════════════╝
""")

    # Default to server mode (most common for fixed RFID readers)
    # Pass --client flag to use client mode
    if len(sys.argv) > 1 and sys.argv[1] == "--client":
        client_mode()
    else:
        server_mode()
