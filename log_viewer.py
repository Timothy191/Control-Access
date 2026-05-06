#!/usr/bin/env python3
"""
Mine Management System — Grafana-Style Terminal Dashboard
Monitors logs, HTTP traffic, Scans, and System Resources.
Requires: rich, psutil, plotext (installed in venv)
"""

import os
import sys
import time
import re
import subprocess
import threading
from collections import deque
from datetime import datetime

try:
    from rich.console import Console
    from rich.text import Text
    from rich.live import Live
    from rich.layout import Layout
    from rich.panel import Panel
    from rich.table import Table
    from rich.align import Align
    from rich import box
    import psutil
    import plotext as plt
except ImportError:
    print("Dependencies missing — run: pip install rich psutil plotext")
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_LOG  = os.path.join(SCRIPT_DIR, "server.log")
MONITOR_LOG = os.path.join(SCRIPT_DIR, "monitor.log")

console = Console()

# ── Data History (for graphs) ────────────────────────────────────────────────
HISTORY_LEN = 40
cpu_history = deque([0]*HISTORY_LEN, maxlen=HISTORY_LEN)
ram_history = deque([0]*HISTORY_LEN, maxlen=HISTORY_LEN)
traffic_history = deque([0]*HISTORY_LEN, maxlen=HISTORY_LEN)

endpoints_hits = {}
recent_logs = deque(maxlen=15)

metrics = {
    "total_scans": 0,
    "approved": 0,
    "denied": 0,
    "in": 0,
    "out": 0,
    "http_timestamps": deque(maxlen=300)
}

lock = threading.Lock()

# ── Plot Builders (Plotext -> Rich) ──────────────────────────────────────────
def build_plot(title, y_data, color, w, h, fill=True, y_max=100):
    plt.clf()
    plt.plotsize(w, h)
    
    # Plotext config
    plt.theme("clear")
    plt.axes_color("black")
    plt.canvas_color("black")
    plt.ticks_color("white")
    
    plt.ylim(0, y_max)
    plt.plot(list(y_data), color=color, fillx=fill)
    
    return plt.build()

def build_pie(title, labels, values, w, h):
    plt.clf()
    plt.plotsize(w, h)
    plt.theme("clear")
    plt.axes_color("black")
    plt.canvas_color("black")
    
    if sum(values) == 0:
        values = [1]
        labels = ["No Data"]
        
    # Plotext pie chart doesn't accept size properly in some versions, but we'll try
    try:
        # Some plotext versions have pie, some don't. Fallback to bar if pie fails.
        pass
    except:
        pass
        
    try:
        # Bar chart as a safer alternative for categorical
        plt.bar(labels, values, color=["green", "red", "blue", "yellow"][:len(labels)])
    except:
        pass
        
    return plt.build()

# ── Log Parser ───────────────────────────────────────────────────────────────
def process_log_line(line: str, source: str):
    global metrics, endpoints_hits
    now_ts = time.time()
    line = line.rstrip()
    
    # --- HTTP requests ---
    http_match = re.search(r'"(GET|POST|PUT|DELETE|PATCH) ([^ ]+)[^"]*" (\d{3})', line)
    if http_match:
        metrics["http_timestamps"].append(now_ts)
        method, path, status = http_match.groups()
        
        # Track top endpoints
        base_path = path.split("?")[0]
        if base_path not in endpoints_hits:
            endpoints_hits[base_path] = 0
        endpoints_hits[base_path] += 1
        
        code = int(status)
        c = "green" if code < 300 else ("yellow" if code < 400 else "red")
        recent_logs.append(Text(f"[{method}] {path[:30]} {code}", style=c))
        return

    # --- SCAN events ---
    if "SCAN LOG" in line or "/api/scan_qr" in line:
        metrics["total_scans"] += 1
        
        if "granted: True" in line or '" 200 ' in line:
            metrics["approved"] += 1
            if "OUT" in line:
                metrics["out"] += 1
                recent_logs.append(Text(f"🚪 OUT SCAN", style="yellow"))
            else:
                metrics["in"] += 1
                recent_logs.append(Text(f"✅ IN SCAN", style="green"))
        elif "granted: False" in line or "DENIED" in line:
            metrics["denied"] += 1
            recent_logs.append(Text(f"❌ DENIED SCAN", style="red"))
        return

    if any(k in line for k in ["ERROR", "Exception", "CRITICAL"]):
        recent_logs.append(Text(f"⚠️ {line[:40]}", style="red"))

def tail_file(path: str, source: str):
    try:
        with open(path, "r", errors="replace") as f:
            f.seek(0, 2)
            while True:
                line = f.readline()
                if line:
                    with lock:
                        process_log_line(line, source)
                else:
                    time.sleep(0.1)
    except FileNotFoundError:
        while not os.path.exists(path):
            time.sleep(1)
        tail_file(path, source)


# ── Dashboard Generators ─────────────────────────────────────────────────────

def get_top_endpoints() -> Table:
    t = Table(show_header=False, show_edge=False, box=None, padding=(0,1))
    t.add_column(ratio=2)
    t.add_column(justify="right")
    
    # Sort dict
    sorted_eps = sorted(endpoints_hits.items(), key=lambda x: x[1], reverse=True)[:8]
    
    for path, count in sorted_eps:
        # Simple progress bar
        bar_len = min(15, count)
        bar = "█" * bar_len
        t.add_row(
            Text(path[:25], style="cyan"),
            Text(f"{count} {bar}", style="blue")
        )
    return t

def get_disk_bars() -> Table:
    t = Table(show_header=False, show_edge=False, box=None)
    t.add_column()
    
    parts = psutil.disk_partitions()
    for p in parts[:4]:  # Show up to 4 partitions
        try:
            usage = psutil.disk_usage(p.mountpoint)
            pct = usage.percent
            c = "green" if pct < 70 else "yellow" if pct < 90 else "red"
            bar_len = int((pct / 100) * 20)
            bar = "█" * bar_len + "░" * (20 - bar_len)
            
            t.add_row(Text(f"{p.mountpoint[:10]:<12} {pct:5.1f}% [{bar}]", style=c))
        except:
            pass
    return t

def get_recent_logs_panel() -> Text:
    txt = Text()
    for l in recent_logs:
        txt.append(l)
        txt.append("\n")
    return txt

def get_stats_text(pid: str) -> Table:
    t = Table(show_header=False, show_edge=False, box=None)
    t.add_column()
    
    t.add_row(Text("SCAN METRICS", style="bold magenta"))
    t.add_row(Text(f"Total Scans: {metrics['total_scans']}", style="white"))
    t.add_row(Text(f"✅ Approved:  {metrics['approved']} ( IN: {metrics['in']} | OUT: {metrics['out']} )", style="green"))
    t.add_row(Text(f"❌ Denied:    {metrics['denied']}", style="red"))
    t.add_row(Text(""))
    
    t.add_row(Text("FLASK PROCESS", style="bold cyan"))
    if pid and pid.isdigit():
        try:
            p = psutil.Process(int(pid))
            up = int(time.time() - p.create_time())
            hrs, rem = divmod(up, 3600)
            mins, secs = divmod(rem, 60)
            t.add_row(Text(f"Uptime:  {hrs:02d}:{mins:02d}:{secs:02d}", style="cyan"))
            t.add_row(Text(f"RAM:     {p.memory_info().rss / (1024**2):.1f} MB", style="cyan"))
            t.add_row(Text(f"Threads: {p.num_threads()}", style="cyan"))
        except:
            t.add_row(Text("Offline", style="red"))
    else:
        t.add_row(Text("Offline", style="red"))
        
    return t


# ── Main UI Loop ─────────────────────────────────────────────────────────────
def main():
    threading.Thread(target=tail_file, args=(SERVER_LOG, "SERVER"), daemon=True).start()
    threading.Thread(target=tail_file, args=(MONITOR_LOG, "MONITOR"), daemon=True).start()

    console.clear()
    
    # Pre-warm psutil
    psutil.cpu_percent()

    def generate_layout() -> Layout:
        term_w, term_h = console.size
        # Calculate dynamic graph size to fit terminal perfectly
        # We divide width by 3, height by 3, minus borders
        gw = max(10, (term_w // 3) - 6)
        gh = max(5, ((term_h - 4) // 3) - 4)

        now = time.time()
        
        with lock:
            # Update Traffic
            while metrics["http_timestamps"] and (now - metrics["http_timestamps"][0] > 60):
                metrics["http_timestamps"].popleft()
            reqs_per_sec = len(metrics["http_timestamps"]) / 60.0
            traffic_history.append(reqs_per_sec)
            
            # Update System
            cpu_history.append(psutil.cpu_percent())
            ram_history.append(psutil.virtual_memory().percent)

        layout = Layout()
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="main")
        )
        
        # Header
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        header = Table.grid(expand=True)
        header.add_column(ratio=1); header.add_column(justify="center", ratio=1); header.add_column(justify="right", ratio=1)
        header.add_row(
            Text("⛏  MINE MANAGEMENT SYSTEM", style="bold white"),
            Text("GRAFANA TERMINAL DASHBOARD", style="bold bright_cyan"),
            Text(f"🕐 {ts}", style="dim white")
        )
        layout["header"].update(Panel(header, box=box.HEAVY, border_style="cyan"))

        # 3x3 Grid
        layout["main"].split_column(
            Layout(name="row1"),
            Layout(name="row2"),
            Layout(name="row3")
        )
        for r in ["row1", "row2", "row3"]:
            layout[r].split_row(
                Layout(name=f"{r}_c1"), 
                Layout(name=f"{r}_c2"), 
                Layout(name=f"{r}_c3")
            )

        # Build plots using plotext
        with lock:
            p_cpu = build_plot("CPU", cpu_history, "red", gw, gh, fill=True)
            p_ram = build_plot("RAM", ram_history, "green", gw, gh, fill=True)
            p_trf = build_plot("Req/s", traffic_history, "magenta", gw, gh, fill=True, y_max=max(10, max(traffic_history)*1.2))
            
            # Build scan breakdown chart
            p_pie = build_pie("Scans", ["Appr", "Deny"], [metrics["approved"], metrics["denied"]], gw, gh)

        # Row 1
        layout["row1_c1"].update(Panel(Text.from_ansi(p_cpu), title="[bold red]System CPU Load (%)", border_style="red"))
        layout["row1_c2"].update(Panel(Text.from_ansi(p_trf), title="[bold magenta]Network Traffic (Req/s)", border_style="magenta"))
        layout["row1_c3"].update(Panel(Text.from_ansi(p_pie), title="[bold green]Scan Outcomes (Apprv / Deny)", border_style="green"))

        # Row 2
        layout["row2_c1"].update(Panel(Text.from_ansi(p_ram), title="[bold green]Memory Usage (%)", border_style="green"))
        
        # Get monitor PID
        try:
            result = subprocess.run(["pgrep", "-f", "monitor.py"], capture_output=True, text=True)
            raw_pid = result.stdout.strip().split("\n")[0]
        except:
            raw_pid = ""
            
        layout["row2_c2"].update(Panel(get_stats_text(raw_pid), title="[bold yellow]Key Metrics", border_style="yellow"))
        layout["row2_c3"].update(Panel(get_recent_logs_panel(), title="[bold blue]Recent Log Stream", border_style="blue"))

        # Row 3
        layout["row3_c1"].update(Panel(get_top_endpoints(), title="[bold cyan]Top API Endpoints", border_style="cyan"))
        layout["row3_c2"].update(Panel(get_disk_bars(), title="[bold yellow]Disk Volumes", border_style="yellow"))
        
        # Bottom right - Uptime & Details
        details = Table.grid()
        details.add_column()
        details.add_row(Text("Platform:  Linux / Mine OS", style="dim"))
        details.add_row(Text("Database:  SQLite3", style="dim"))
        details.add_row(Text("Host IP:   " + os.popen("hostname -I | awk '{print $1}'").read().strip(), style="dim"))
        layout["row3_c3"].update(Panel(Align.center(details, vertical="middle"), title="[bold white]System Info", border_style="white"))

        return layout

    try:
        with Live(generate_layout(), refresh_per_second=2, screen=True) as live:
            while True:
                time.sleep(0.5)
                live.update(generate_layout())
    except KeyboardInterrupt:
        console.print("\n[yellow]Dashboard closed.[/yellow]")

if __name__ == "__main__":
    main()
