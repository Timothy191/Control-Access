#!/usr/bin/env python3
"""
Display test QR codes for C66 scanning
Usage: python3 scripts/show-test-qr.py [test_name]
"""

import os
import sys

import qrcode

# Test codes
TEST_CODES = {
    'usb': ('C66-USB-TEST', 'USB Connection Test'),
    'wifi': ('C66-WIFI-TEST', 'WiFi Connection Test'),
    'general': ('TEST-SCAN-001', 'General Test'),
    'employee': ('EMP-TEST-001', 'Employee Test'),
    'vehicle': ('LDV-TEST-001', 'Vehicle Test'),
}

def show_ascii_qr(data, title=""):
    """Display QR code as ASCII art in terminal"""
    qr = qrcode.QRCode(version=1, box_size=1, border=1)
    qr.add_data(data)
    qr.make(fit=True)

    print(f"\n{'='*60}")
    if title:
        print(f"  {title}")
    print(f"  Data: {data}")
    print(f"{'='*60}\n")

    modules = qr.get_matrix()
    for row in modules:
        line = ""
        for cell in row:
            line += "██" if cell else "  "
        print(f"  {line}")

    print()

def save_qr_image(data, filename):
    """Save QR code as PNG image"""
    project_dir = '/home/tim/Desktop/01.mine-management-system'
    filepath = os.path.join(project_dir, 'static', filename)

    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img.save(filepath)
    return filepath

def main():
    if len(sys.argv) > 1:
        test_name = sys.argv[1].lower()
    else:
        test_name = None

    if test_name and test_name in TEST_CODES:
        # Show specific test
        data, desc = TEST_CODES[test_name]
        show_ascii_qr(data, desc)
        filepath = save_qr_image(data, f'test-qr-{test_name}.png')
        print(f"  Image saved: {filepath}")
    else:
        # Show all tests
        print("\n" + "="*60)
        print("  C66 TEST QR CODES")
        print("="*60)

        for key, (data, desc) in TEST_CODES.items():
            show_ascii_qr(data, desc)
            filepath = save_qr_image(data, f'test-qr-{key}.png')
            print(f"  Image saved: {filepath}\n")

        print("="*60)
        print("Usage:")
        print(f"  python3 {sys.argv[0]} [usb|wifi|general|employee|vehicle]")
        print("="*60)

if __name__ == '__main__':
    main()
