#!/usr/bin/env python3
"""Test script for Network Scan Listener functionality."""

import socket
import json
import sys
import time

def test_network_scanner(port=5000, host="127.0.0.1"):
    """Send a test scan to the network listener."""
    
    # Test scan data
    scan_data = {
        "qr_code": "TEST123",
        "direction": "IN",
        "gate_location": "Test Gate",
        "device_id": "test_device_001",
        "auth_token": "mine-net-scan-2024"
    }
    
    try:
        # Create socket
        client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client_socket.settimeout(10)
        
        # Connect to server
        print(f"Connecting to {host}:{port}...")
        client_socket.connect((host, port))
        print(f"✓ Connected successfully")
        
        # Send data
        json_data = json.dumps(scan_data)
        print(f"Sending: {json_data}")
        client_socket.send(json_data.encode())
        
        # Receive response
        response = client_socket.recv(4096).decode()
        print(f"Response: {response}")
        
        # Parse response
        try:
            response_data = json.loads(response)
            if response_data.get("success"):
                print("✓ Scan processed successfully!")
                print(f"  Entity: {response_data.get('entity_name')}")
                print(f"  Access: {'GRANTED' if response_data.get('open_gate') else 'DENIED'}")
            else:
                print(f"✗ Scan failed: {response_data.get('message')}")
        except json.JSONDecodeError:
            print(f"✗ Invalid response format: {response}")
        
        client_socket.close()
        return True
        
    except ConnectionRefusedError:
        print(f"✗ Connection refused - is the server running on {host}:{port}?")
        return False
    except socket.timeout:
        print(f"✗ Connection timeout")
        return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def discover_listener_port(start_port=5000, end_port=6000):
    """Try to find which port the network listener is running on."""
    print(f"Searching for network listener on ports {start_port}-{end_port}...")
    
    for port in range(start_port, end_port + 1):
        if port in [8080, 8081, 8082]:
            continue
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(0.5)
            result = sock.connect_ex(("127.0.0.1", port))
            sock.close()
            if result == 0:  # Port is open
                print(f"  Found open port: {port}")
                return port
        except:
            pass
    
    return None


def main():
    """Main test function."""
    print("=" * 60)
    print("Network Scan Listener Test")
    print("=" * 60)
    
    # Check if port was provided as argument
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    else:
        # Try to discover the port
        port = discover_listener_port()
        if not port:
            print("\n✗ Could not find network listener")
            print("Make sure the main app is running first!")
            sys.exit(1)
    
    print(f"\nTesting on port {port}...")
    print("-" * 60)
    
    success = test_network_scanner(port)
    
    print("-" * 60)
    if success:
        print("✓ Test completed")
    else:
        print("✗ Test failed")
    print("=" * 60)


if __name__ == "__main__":
    main()
