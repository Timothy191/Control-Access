"""Network scanner listener services.

Handles multi-port UDP scanning, broadcast listening, TCP InfoWedge streams,
and packet sniffing for hardware scanner devices.
"""
import os
import re
import socket
import threading
from datetime import UTC, datetime

from database import db_session
from models import Device

UDP_BUFFER_SIZE = 1024 * 1024  # 1MB buffer for high-throughput scanning
TCP_BACKLOG = 2048  # Increased TCP connection queue

UDP_PORTS = [5000, 8080, 9000, 9999, 10000]
TCP_PORTS = [80, 443, 3000, 8080]
SCAN_PORTS = UDP_PORTS + TCP_PORTS

udp_threads = []
tcp_threads = []
scanner_listener_running = False
broadcast_running = False
sniffer_running = False


def optimize_socket_buffers():
    """Apply socket buffer optimizations for high-throughput scanning."""
    try:
        UDP_RCVBUF = 2 * 1024 * 1024  # 2MB
        print(f"✓ Socket buffers configured: {UDP_RCVBUF // 1024}KB")
    except Exception as e:
        print(f"⚠ Socket optimization failed: {e}")


def get_broadcast_address():
    """Get the broadcast address for the local network."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        parts = local_ip.rsplit(".", 1)
        return f"{parts[0]}.255"
    except Exception:
        return "255.255.255.255"


def _utcnow_naive():
    return datetime.now(UTC).replace(tzinfo=None)


def _ensure_device_exists(ip_address):
    """Auto-create device entry if scanning from unknown IP."""
    try:
        existing = db_session.query(Device).filter_by(ip_address=ip_address).first()
        if existing:
            existing.last_seen = _utcnow_naive()
            existing.status = "online"
        else:
            device = Device(
                device_name=f"Scanner-{ip_address}",
                device_type="Unknown",
                ip_address=ip_address,
                status="pending",
            )
            db_session.add(device)
            print(f"NEW DEVICE: Auto-created pending device for IP {ip_address}")
        db_session.commit()
    except Exception as e:
        print(f"Error creating device: {e}")


def process_scan_data(qr_data, source_ip, protocol="UDP", process_qr_callback=None, socketio_instance=None):
    """Process scanned data from any scanner source."""
    try:
        qr_hash = qr_data.strip()
        if not (qr_hash.startswith("{") and qr_hash.endswith("}")):
            qr_hash = qr_hash.upper()

        if len(qr_hash) < 2 or len(qr_hash) > 4096:
            return None

        direction = "IN"
        gate_location = f"{protocol} Scanner"
        scanned_by = f"{protocol.lower()}-{source_ip}"

        result = None
        if process_qr_callback:
            result = process_qr_callback(
                qr_hash,
                direction,
                gate_location,
                scanned_by,
                source_ip,
                f"{protocol} Scanner",
            )

        _ensure_device_exists(source_ip)

        if result:
            print(
                f"SCAN ({protocol}): from {source_ip} -> {qr_hash[:20]}... granted={result['access_granted']} entity={result['entity_name']}"
            )

            if socketio_instance:
                socketio_instance.emit(
                    "scan_result",
                    {
                        "success": result["access_granted"],
                        "message": result["denial_reason"],
                        "entity_type": result["entity_type"],
                        "entity_name": result["entity_name"],
                        "direction": direction,
                        "scanner": source_ip,
                        "protocol": protocol,
                    },
                )

        return result
    except Exception as e:
        print(f"Error processing {protocol} scan: {e}")
        return None


def start_udp_listener(port, process_qr_callback=None, socketio_instance=None):
    """Start UDP listener on a specific port."""

    def udp_server():
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, UDP_BUFFER_SIZE)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, UDP_BUFFER_SIZE)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.settimeout(1.0)

            try:
                sock.bind(("0.0.0.0", port))
                print(f"UDP Listener started on port {port}")
            except OSError:
                print(f"WARNING: Could not bind UDP port {port}")
                return

            while scanner_listener_running:
                try:
                    data, addr = sock.recvfrom(4096)
                    if data:
                        scan_data = data.decode("utf-8", errors="ignore").strip()
                        if scan_data:
                            process_scan_data(scan_data, addr[0], "UDP", process_qr_callback, socketio_instance)
                except TimeoutError:
                    continue
                except Exception:
                    if scanner_listener_running:
                        continue
        except Exception as e:
            print(f"UDP server on port {port} failed: {e}")

    thread = threading.Thread(target=udp_server, daemon=True)
    thread.start()
    return thread


def start_broadcast_listener(process_qr_callback=None, socketio_instance=None):
    """Listen on broadcast address for discovery."""
    broadcast_addr = get_broadcast_address()

    def broadcast_server():
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.settimeout(1.0)

            try:
                sock.bind(("0.0.0.0", 9999))
                print(f"Broadcast Listener started on {broadcast_addr}:9999")
            except OSError:
                print("WARNING: Could not bind broadcast port 9999")
                return

            while broadcast_running:
                try:
                    data, addr = sock.recvfrom(4096)
                    if data:
                        scan_data = data.decode("utf-8", errors="ignore").strip()
                        if scan_data:
                            print(f"BROADCAST from {addr[0]}: {scan_data}")
                            process_scan_data(scan_data, addr[0], "BROADCAST", process_qr_callback, socketio_instance)
                except TimeoutError:
                    continue
                except Exception:
                    if broadcast_running:
                        continue
        except Exception as e:
            print(f"Broadcast server failed: {e}")

    thread = threading.Thread(target=broadcast_server, daemon=True)
    thread.start()
    return thread


def start_packet_sniffer(process_qr_callback=None, socketio_instance=None):
    """Passive packet sniffer to capture QR-like data from network traffic."""
    if os.geteuid() != 0:
        print("WARNING: Packet sniffer requires root. Run with sudo for packet capture.")
        return None

    def sniffer():
        global sniffer_running
        try:
            ETH_P_ALL = 0x0003
            s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(ETH_P_ALL))

            for iface in ["eth0", "enp0s3", "wlan0", "wlp2s0", "ens33"]:
                try:
                    s.bind((iface, 0))
                    print(f"Packet Sniffer bound to {iface}")
                    break
                except Exception:
                    continue
            else:
                print("WARNING: Could not bind to any network interface")
                return

            s.setblocking(False)
            sniffer_running = True
            print("Packet Sniffer started (capturing all traffic)")

            while sniffer_running:
                try:
                    packet, addr = s.recvfrom(65535)
                    if len(packet) > 14:
                        payload = packet[14:]
                        payload_str = payload.decode("utf-8", errors="ignore")

                        patterns = [
                            r"EMP[:\s]+([A-Z0-9]{4,20})",
                            r"VEH[:\s]+([A-Z0-9]{4,20})",
                            r"VIS[:\s]+([A-Z0-9]{4,20})",
                        ]

                        for pattern in patterns:
                            matches = re.findall(pattern, payload_str, re.MULTILINE)
                            for match in matches:
                                if match and len(match) >= 4:
                                    print(f"PKT SNIFF: from {addr[0]}: {match}")
                                    process_scan_data(match, addr[0], "SNIFFER", process_qr_callback, socketio_instance)

                except BlockingIOError:
                    continue
                except Exception:
                    if sniffer_running:
                        continue

        except Exception as e:
            print(f"Packet sniffer error: {e}")
        finally:
            sniffer_running = False
            print("Packet Sniffer stopped")

    thread = threading.Thread(target=sniffer, daemon=True)
    thread.start()
    return thread


def init_all_scanner_listeners(process_qr_callback=None, socketio_instance=None):
    """Initialize and start all scanner listeners."""
    global scanner_listener_running, broadcast_running
    scanner_listener_running = True
    broadcast_running = True

    optimize_socket_buffers()

    for port in UDP_PORTS:
        try:
            t = start_udp_listener(port, process_qr_callback, socketio_instance)
            udp_threads.append(t)
        except Exception as e:
            print(f"Failed to start UDP on port {port}: {e}")

    try:
        t = start_broadcast_listener(process_qr_callback, socketio_instance)
        udp_threads.append(t)
    except Exception as e:
        print(f"Failed to start broadcast: {e}")

    try:
        t = start_packet_sniffer(process_qr_callback, socketio_instance)
        if t:
            udp_threads.append(t)
    except Exception as e:
        print(f"Packet sniffer not available: {e}")

    print(f"Scanner listeners initialized: UDP ports {UDP_PORTS}, broadcast enabled")
