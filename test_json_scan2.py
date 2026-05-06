import app
from flask import request

print("Original code inside app.scan_qr_code:")
with open("app.py", "r") as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if "def scan_qr_code():" in line:
            for j in range(i, i+15):
                print(lines[j], end="")
            break
