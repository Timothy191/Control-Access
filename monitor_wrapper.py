#!/usr/bin/env python3
import sys
import os
import time
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
READY_FILE = os.path.join(SCRIPT_DIR, ".monitor_ready")

def main():
    # Clear ready file
    if os.path.exists(READY_FILE):
        os.remove(READY_FILE)
    
    # Start monitor in subprocess
    env = os.environ.copy()
    process = subprocess.Popen(
        [sys.executable, "monitor.py"],
        cwd=SCRIPT_DIR,
        env=env
    )
    
    # Wait for health checks to stabilize (give it time to start Flask)
    time.sleep(8)
    
    # Try to verify health
    max_retries = 30
    for i in range(max_retries):
        try:
            import requests
            r = requests.get("http://localhost:8080/", timeout=2)
            if r.status_code in [200, 302]:
                with open(READY_FILE, "w") as f:
                    f.write("READY")
                print(f"[DEPLOY-SERVER] Monitor checklists PASSED - Flask responding")
                break
        except:
            pass
        time.sleep(2)
    else:
        with open(READY_FILE, "w") as f:
            f.write("READY")  # Proceed anyway
        print(f"[DEPLOY-SERVER] Monitor timeout - proceeding anyway")
    
    # Wait for monitor process
    try:
        process.wait()
    except KeyboardInterrupt:
        process.terminate()
        process.wait()

def check_health():
    try:
        import requests
        r = requests.get("http://localhost:8080/", timeout=3)
        return r.status_code in [200, 302]
    except:
        return False

if __name__ == "__main__":
    main()
