#!/usr/bin/env python3
import os
import re
import subprocess
import sys
import time
from datetime import datetime

import requests

try:
    from rich import box
    from rich.console import Console
    from rich.layout import Layout
    from rich.live import Live
    from rich.panel import Panel
    from rich.table import Table
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    Console = None

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_URL = "http://localhost:8080"
WORKDIR = SCRIPT_DIR
VENV_PYTHON = os.path.join(SCRIPT_DIR, "venv", "bin", "python") if os.name != "nt" else os.path.join(SCRIPT_DIR, "venv", "Scripts", "python.exe")
CHECK_INTERVAL = 10
app_process = None
app_pid = None
LOG_FILE = os.path.join(WORKDIR, "monitor.log")
SERVER_LOG = os.path.join(WORKDIR, "server.log")
DB_PATH = os.path.join(WORKDIR, "mine_management.db")

console = Console() if RICH_AVAILABLE else None
start_time = None
last_log_size = 0
last_scan_logs = []

ARCH_LOGO = """
        __
       /  \\__
      / \\__   \\___
     /      \\      \\___
    /   /\\   \\          \\
   /   /  \\   \\          \\
  /___/    \\___\\_________\\
     A R C H - S Y S T E M
"""

title = "ARCH-SYSTEM MONITOR"

def log(msg):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

def get_system_stats():
    if not PSUTIL_AVAILABLE:
        return {"cpu": "N/A", "memory": "N/A", "uptime": "N/A", "procs": "N/A"}

    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory()
    boot_time = datetime.fromtimestamp(psutil.boot_time())
    uptime = datetime.now() - boot_time

    return {
        "cpu": f"{cpu:.1f}%",
        "memory": f"{mem.percent:.1f}%",
        "memory_used": f"{mem.used / (1024**3):.1f}GB",
        "memory_total": f"{mem.total / (1024**3):.1f}GB",
        "uptime": str(uptime).split('.')[0],
        "procs": len(psutil.pids()),
    }

def get_app_uptime():
    global start_time
    if start_time is None:
        start_time = datetime.now()
    uptime = datetime.now() - start_time
    return str(uptime).split('.')[0]

def kill_existing_flask():
    # Try each pkill pattern separately; ignore failures (no match = nonzero exit).
    for pattern in ["python.*app.py", "flask run"]:
        try:
            subprocess.run(
                ["pkill", "-f", pattern],
                capture_output=True,
                timeout=5,
            )
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
    time.sleep(2)

def start_app():
    global app_process, app_pid, start_time
    log("Starting Flask app...")
    python_bin = VENV_PYTHON if os.path.exists(VENV_PYTHON) else sys.executable
    app_process = subprocess.Popen(
        [python_bin, "-u", "app.py"],
        cwd=WORKDIR,
        stdout=open(SERVER_LOG, "a"),
        stderr=subprocess.STDOUT,
        bufsize=1,
    )
    app_pid = app_process.pid
    start_time = datetime.now()
    log(f"App started with PID {app_pid}")
    time.sleep(5)
    return app_process

def check_health():
    results = []
    issues = []
    timings = []

    global app_process, app_pid

    if app_process and app_pid:
        if app_process.poll() is not None:
            issues.append(f"App process {app_pid} died unexpectedly")
            log(f"CRITICAL: App process {app_pid} died, will restart")

    tests = [
        ("/", "Login"),
        ("/dashboard", "Dashboard"),
        ("/employees", "Employees"),
        ("/fleet", "Fleet"),
        ("/visitors", "Visitors"),
        ("/api/ai/status", "AI Status"),
    ]

    for path, name in tests:
        try:
            start = time.time()
            r = requests.get(BASE_URL + path, timeout=5, allow_redirects=False)
            elapsed = (time.time() - start) * 1000
            timings.append(elapsed)

            if r.status_code in [200, 302, 301]:
                results.append((name, True, elapsed))
            else:
                results.append((name, False, elapsed))
                issues.append(f"{name} returned {r.status_code}")
        except Exception as e:
            results.append((name, False, 0))
            issues.append(f"{name} - {e}")

    avg_time = sum(timings) / len(timings) if timings else 0
    return results, issues, avg_time

def parse_scan_logs():
    global last_log_size, last_scan_logs

    if not os.path.exists(SERVER_LOG):
        return []

    try:
        current_size = os.path.getsize(SERVER_LOG)

        if current_size < last_log_size:
            last_log_size = 0

        if current_size > last_log_size:
            with open(SERVER_LOG) as f:
                f.seek(last_log_size)
                new_lines = f.readlines()
                last_log_size = current_size

            scan_pattern = r"SCAN LOG:.*?'granted':\s*(True|False).*?'entity':\s*'([^']+)'.*?'direction':\s*'([^']+)'.*?'type':\s*'([^']+)'"

            for line in new_lines:
                match = re.search(scan_pattern, line)
                if match:
                    granted = match.group(1) == 'True'
                    entity = match.group(2)
                    direction = match.group(3)
                    etype = match.group(4)
                    ts = datetime.now().strftime("%H:%M:%S")
                    last_scan_logs.append({
                        'time': ts,
                        'type': etype,
                        'entity': entity,
                        'direction': direction,
                        'granted': granted
                    })

            last_scan_logs = last_scan_logs[-20:]

    except Exception:
        pass

    return last_scan_logs

_engine = None
_session_factory = None
_db_session = None

def _get_db_session():
    global _engine, _session_factory, _db_session
    if _engine is None:
        db_url = f"sqlite:///{DB_PATH}"
        from sqlalchemy import create_engine
        from sqlalchemy.orm import scoped_session, sessionmaker
        _engine = create_engine(db_url, connect_args={"check_same_thread": False})
        _session_factory = sessionmaker(bind=_engine)
        _db_session = scoped_session(_session_factory)
    return _db_session

def get_dashboard_stats():
    if not os.path.exists(DB_PATH):
        return {}

    try:

        db_session = _get_db_session()

        from models import Approval, Employee, GateLog, Vehicle, Visitor

        today = datetime.now().date()
        today_start = datetime.combine(today, datetime.min.time())

        employee_count = db_session.query(Employee).count()
        vehicle_count = db_session.query(Vehicle).count()
        visitors_checked_in = db_session.query(Visitor).filter_by(status="Checked In").count()
        pending_approvals = db_session.query(Approval).filter_by(status="Pending").count()

        today_logs = db_session.query(GateLog).filter(GateLog.scanned_at >= today_start).count()
        today_granted = db_session.query(GateLog).filter(
            GateLog.scanned_at >= today_start,
            GateLog.access_granted
        ).count()
        today_denied = db_session.query(GateLog).filter(
            GateLog.scanned_at >= today_start,
            not GateLog.access_granted
        ).count()

        on_site_employees = db_session.query(Employee).filter_by(status="Active").count()
        active_vehicles = db_session.query(Vehicle).filter_by(status="Active").count()

        db_session.remove()

        return {
            'employees': employee_count,
            'vehicles': vehicle_count,
            'visitors_on_site': visitors_checked_in,
            'pending': pending_approvals,
            'today_scans': today_logs,
            'today_granted': today_granted,
            'today_denied': today_denied,
            'on_site': on_site_employees,
            'fleet_active': active_vehicles
        }

    except Exception as e:
        return {'error': str(e)}

def render_rich_display(health_results, issues, avg_time, stats):
    if not RICH_AVAILABLE:
        return

    console.clear()

    sys_stats = get_system_stats()
    app_uptime = get_app_uptime()

    print(ARCH_LOGO)
    console.print(Panel(f"[bold cyan]Website:[/bold cyan] {BASE_URL} | [bold cyan]PID:[/bold cyan] {app_pid or 'N/A'} | [bold cyan]Status:[/bold cyan] {'[green]RUNNING[/green]' if app_process and app_process.poll() is None else '[red]STOPPED[/red]'}",
                         title=title, border_style="cyan", box=box.DOUBLE))

    console.print()
    console.print("[bold yellow]SYSTEM STATUS[/bold yellow]")
    console.print(f"  CPU: {sys_stats['cpu']} | Memory: {sys_stats['memory']} ({sys_stats['memory_used']}/{sys_stats['memory_total']}) | Procs: {sys_stats['procs']}")
    console.print(f"  App Uptime: {app_uptime}")
    console.print()

    table = Table(title="[bold yellow]HEALTH CHECKS[/bold yellow]", box=box.SIMPLE)
    table.add_column("Endpoint", style="cyan")
    table.add_column("Status", style="white")
    table.add_column("Time", justify="right", style="magenta")

    for name, ok, elapsed in health_results:
        status = "[green]OK[/green]" if ok else "[red]FAIL[/red]"
        time_str = f"{elapsed:.0f}ms" if elapsed > 0 else "N/A"
        table.add_row(name, status, time_str)

    console.print(table)

    console.print()
    console.print(f"[bold yellow]Response Time:[/bold yellow] {avg_time:.0f}ms average")
    console.print()

    scan_logs = parse_scan_logs()
    if scan_logs:
        scan_table = Table(title=f"[bold yellow]GATE ACTIVITY (Last {len(scan_logs)})[/bold yellow]", box=box.SIMPLE)
        scan_table.add_column("Time", style="cyan")
        scan_table.add_column("Type", style="yellow")
        scan_table.add_column("Name", style="white")
        scan_table.add_column("Dir", style="magenta")
        scan_table.add_column("Status", style="white")

        for log_entry in scan_logs[-10:]:
            status = "[green]GRANTED[/green]" if log_entry['granted'] else "[red]DENIED[/red]"
            scan_table.add_row(
                log_entry['time'],
                log_entry['type'],
                log_entry['entity'],
                log_entry['direction'],
                status
            )

        console.print(scan_table)

    if issues:
        console.print()
        console.print("[bold red]ISSUES DETECTED:[/bold red]")
        for issue in issues:
            console.print(f"  [red]-[/red] {issue}")

    if stats and 'error' not in stats:
        console.print()
        console.print("[bold yellow]DASHBOARD SUMMARY[/bold yellow]")
        console.print(f"  Employees: {stats['employees']} | Fleet: {stats['vehicles']} | Visitors on-site: {stats['visitors_on_site']}")
        console.print(f"  Today's Scans: {stats['today_scans']} | Granted: {stats['today_granted']} | Denied: {stats['today_denied']}")
        console.print(f"  Pending Approvals: {stats['pending']}")

    console.print()
    console.print(f"[dim]Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}[/dim]")

def render_text_display(health_results, issues, avg_time, stats):
    sys_stats = get_system_stats()
    app_uptime = get_app_uptime()

    print()
    print(ARCH_LOGO)
    print("=" * 60)
    print("ARCH-SYSTEM - MONITOR")
    print("=" * 60)
    print(f"Website: {BASE_URL} | PID: {app_pid or 'N/A'} | Status: {'RUNNING' if app_process and app_process.poll() is None else 'STOPPED'}")
    print("-" * 60)
    print(f"CPU: {sys_stats['cpu']} | Memory: {sys_stats['memory']} | App Uptime: {app_uptime}")
    print("-" * 60)

    print("\nHEALTH CHECKS:")
    for name, ok, elapsed in health_results:
        status = "OK" if ok else "FAIL"
        print(f"  {name}: {status} ({elapsed:.0f}ms)")

    print(f"\nResponse Time: {avg_time:.0f}ms average")

    scan_logs = parse_scan_logs()
    if scan_logs:
        print(f"\nGATE ACTIVITY (Last {len(scan_logs)}):")
        for log_entry in scan_logs[-10:]:
            status = "GRANTED" if log_entry['granted'] else "DENIED"
            print(f"  {log_entry['time']} | {log_entry['type']:8} | {log_entry['entity']:15} | {log_entry['direction']} | {status}")

    if issues:
        print("\nISSUES DETECTED:")
        for issue in issues:
            print(f"  - {issue}")

    if stats and 'error' not in stats:
        print("\nDASHBOARD SUMMARY:")
        print(f"  Employees: {stats['employees']} | Fleet: {stats['vehicles']} | Visitors on-site: {stats['visitors_on_site']}")
        print(f"  Today's Scans: {stats['today_scans']} | Granted: {stats['today_granted']} | Denied: {stats['today_denied']}")
        print(f"  Pending Approvals: {stats['pending']}")

    print(f"\nLast updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60 + "\n")

def run_loop():
    global app_process, app_pid

    log(ARCH_LOGO)
    log("=== Arch-System Monitor Started ===")
    log(f"Rich available: {RICH_AVAILABLE}")
    log(f"Psutil available: {PSUTIL_AVAILABLE}")
    log(f"Check interval: {CHECK_INTERVAL} seconds")
    log(f"Workdir: {WORKDIR}")
    log(ARCH_LOGO)

    kill_existing_flask()
    start_app()

    log("Entering continuous monitoring loop.")

    iteration = 0

    while True:
        results, issues, avg_time = check_health()
        stats = get_dashboard_stats()

        iteration += 1

        if iteration % 6 == 0:
            log(f"Health check #{iteration}: {' | '.join([f'{r[0]}:{"OK" if r[1] else "FAIL"}' for r in results])} | Avg: {avg_time:.0f}ms")

        if issues:
            log(f"ISSUES: {issues}")

        if RICH_AVAILABLE:
            render_rich_display(results, issues, avg_time, stats)
        else:
            render_text_display(results, issues, avg_time, stats)

        time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    try:
        run_loop()
    except KeyboardInterrupt:
        log("Monitor stopped by user")
        if app_process:
            app_process.terminate()
