"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  IconScan,
  IconShieldCheck,
  IconShieldX,
  IconArrowLeft,
  IconDeviceMobile,
  IconVolume,
  IconVolumeOff,
  IconSend,
} from "@tabler/icons-react";

interface ScanResult {
  accessGranted: boolean;
  denialReason: string | null;
  entityName: string | null;
  direction?: string | null;
  gateLocation?: string | null;
  timestamp: string;
}

interface DeviceAlert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "danger" | "warning" | "success" | "info";
  entityName?: string;
  denialReason?: string;
  gateLocation?: string;
  timestamp: string;
}

export default function C66ScannerTerminalPage() {
  const [scanInput, setScanInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [activeAlert, setActiveAlert] = useState<DeviceAlert | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const [gateLocation, setGateLocation] = useState("Brakfontein - C66 Mobile Gate");
  const inputRef = useRef<HTMLInputElement>(null);

  // Audio Synthesizer for hardware chimes and denied buzzers
  const playSound = useCallback((type: "granted" | "denied" | "alert") => {
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === "granted") {
        // High dual-tone chime
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.1); // A5
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "denied") {
        // Harsh buzzer / alarm tone
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(160, now + 0.15);
        osc.frequency.setValueAtTime(130, now + 0.3);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);

        // Vibrate if available on Android device
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([250, 100, 250, 100, 400]);
        }
      } else {
        // Warning alert ping
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch {
      // Audio autoplay policy catch
    }
  }, [audioEnabled]);

  // Keep input focused for physical C66 hardware scanner buttons
  useEffect(() => {
    inputRef.current?.focus();
    const handleClickAnywhere = () => {
      inputRef.current?.focus();
    };
    window.addEventListener("click", handleClickAnywhere);
    return () => window.removeEventListener("click", handleClickAnywhere);
  }, []);

  // Connect to SSE notifications stream
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/scanner/notifications");

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.onmessage = (e) => {
        try {
          const notif = JSON.parse(e.data);
          if (notif && notif.type) {
            setActiveAlert(notif);
            if (notif.severity === "danger" || notif.type === "ACCESS_DENIED") {
              playSound("denied");
            } else if (notif.severity === "success") {
              playSound("granted");
            } else {
              playSound("alert");
            }
          }
        } catch {
          // ignore non-json keepalive comments
        }
      };

      eventSource.onerror = () => {
        setSseConnected(false);
      };
    } catch (err) {
      console.error("SSE connection error:", err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [playSound]);

  // Auto-dismiss alert after 6s
  useEffect(() => {
    if (!activeAlert) return;
    const timer = setTimeout(() => {
      setActiveAlert(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [activeAlert]);

  // Submit scan to server
  const handleProcessScan = async (codeToScan?: string) => {
    const code = (codeToScan || scanInput).trim();
    if (!code || isProcessing) return;

    setIsProcessing(true);
    try {
      const res = await fetch("/api/scanner/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcodeData: code,
          rfidTag: code.startsWith("RFID_") ? code : undefined,
          deviceId: "C66-Handheld-01",
          deviceName: "Chainway C66 Handheld",
          deviceType: "Chainway C66 RFID/Barcode",
          gateLocation,
          operator: "Handheld Patrol",
        }),
      });

      const data = await res.json();
      const result: ScanResult = {
        accessGranted: Boolean(data.accessGranted),
        denialReason: data.denialReason || null,
        entityName: data.entityName || "Unknown Subject",
        direction: data.direction || "SCAN",
        gateLocation: data.gateLocation || gateLocation,
        timestamp: new Date().toLocaleTimeString(),
      };

      setLastResult(result);
      setRecentScans((prev) => [result, ...prev.slice(0, 7)]);

      if (result.accessGranted) {
        playSound("granted");
      } else {
        playSound("denied");
      }

      setScanInput("");
    } catch (err) {
      console.error("Scan dispatch error:", err);
      playSound("denied");
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleProcessScan();
    }
  };

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col font-sans select-none">
      {/* FULL-SCREEN FLASHING RED ALERT ON ACCESS DENIED */}
      {activeAlert && activeAlert.severity === "danger" && (
        <div
          onClick={() => setActiveAlert(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-red-950/95 border-8 border-red-600 animate-pulse text-center cursor-pointer"
        >
          <div className="h-24 w-24 rounded-full bg-red-600 text-white flex items-center justify-center shadow-[0_0_50px_rgba(239,68,68,1)] mb-6 animate-bounce">
            <IconShieldX size={60} className="stroke-[2.5]" />
          </div>

          <span className="text-xs uppercase font-mono font-bold tracking-widest text-red-300 px-3 py-1 rounded-full bg-red-900/80 border border-red-500/50 mb-3">
            Hardware Alarm Strobe
          </span>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
            ACCESS DENIED
          </h1>

          <div className="max-w-md bg-black/60 rounded-2xl border border-red-500/40 p-5 mt-3 space-y-2 text-left">
            <div className="text-sm font-mono text-neutral-300">
              <span className="text-red-400 block text-[11px] uppercase font-bold">Subject / Name</span>
              <strong className="text-white text-base block truncate">
                {activeAlert.entityName || "Unregistered Credential"}
              </strong>
            </div>

            <div className="text-sm font-mono text-neutral-300 pt-2 border-t border-red-500/20">
              <span className="text-red-400 block text-[11px] uppercase font-bold">Denial Reason</span>
              <span className="text-red-200 font-semibold block">
                {activeAlert.denialReason || activeAlert.message}
              </span>
            </div>

            {activeAlert.gateLocation && (
              <div className="text-xs font-mono text-neutral-400 pt-1">
                Gate: {activeAlert.gateLocation}
              </div>
            )}
          </div>

          <p className="text-xs font-mono text-neutral-400 mt-6 animate-pulse">
            Tap screen anywhere to dismiss alert
          </p>
        </div>
      )}

      {/* Terminal Top Bar */}
      <header className="p-3 bg-neutral-900 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/onboard"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 text-xs flex items-center gap-1"
          >
            <IconArrowLeft size={16} />
            <span className="hidden sm:inline">Exit</span>
          </Link>

          <div className="flex items-center gap-1.5 ml-2">
            <IconDeviceMobile size={18} className="text-[#007AFF]" />
            <span className="font-mono font-bold text-xs text-white">
              C66 Terminal
            </span>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] ${
              sseConnected
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-300 border-amber-500/30"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                sseConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span>{sseConnected ? "Push Online" : "Reconnecting"}</span>
          </div>

          <button
            type="button"
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300"
            title="Toggle Audio Feedback"
          >
            {audioEnabled ? <IconVolume size={16} className="text-emerald-400" /> : <IconVolumeOff size={16} className="text-neutral-500" />}
          </button>
        </div>
      </header>

      {/* Main Terminal Viewport */}
      <main className="flex-1 flex flex-col p-4 max-w-lg mx-auto w-full space-y-4">
        {/* Gate Location Selector */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900 border border-white/10 text-xs font-mono">
          <span className="text-neutral-400">Current Portal:</span>
          <select
            value={gateLocation}
            onChange={(e) => setGateLocation(e.target.value)}
            className="bg-black text-white text-xs px-2 py-1 rounded border border-white/10 focus:outline-none"
          >
            <option value="Brakfontein - Main Gate">Brakfontein - Main Gate</option>
            <option value="Brakfontein - C66 Mobile Gate">Brakfontein - C66 Mobile Gate</option>
            <option value="Optimum - Port 9100">Optimum - Port 9100</option>
            <option value="Thando Tech - Remote Turnstile">Thando Tech - Remote Turnstile</option>
          </select>
        </div>

        {/* Big Scanner Status Card */}
        <div
          className={`rounded-2xl border p-6 flex flex-col items-center justify-center text-center transition-all duration-200 min-h-[200px] shadow-lg ${
            lastResult
              ? lastResult.accessGranted
                ? "bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_30px_rgba(52,211,153,0.15)]"
                : "bg-red-950/40 border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]"
              : "bg-neutral-900/80 border-white/15"
          }`}
        >
          {lastResult ? (
            lastResult.accessGranted ? (
              <>
                <div className="h-16 w-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                  <IconShieldCheck size={36} className="stroke-[2.5]" />
                </div>
                <h2 className="text-xl font-bold text-emerald-300 font-mono tracking-wider">
                  ACCESS GRANTED
                </h2>
                <p className="text-white font-semibold text-lg mt-1 truncate max-w-[280px]">
                  {lastResult.entityName}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs font-mono text-emerald-400/80">
                  <span>{lastResult.direction}</span>
                  <span>•</span>
                  <span>{lastResult.timestamp}</span>
                </div>
              </>
            ) : (
              <>
                <div className="h-16 w-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mb-3 animate-pulse">
                  <IconShieldX size={36} className="stroke-[2.5]" />
                </div>
                <h2 className="text-xl font-bold text-red-400 font-mono tracking-wider">
                  ACCESS DENIED
                </h2>
                <p className="text-white font-semibold text-base mt-1 truncate max-w-[280px]">
                  {lastResult.entityName}
                </p>
                <p className="text-xs text-red-300 font-mono mt-1 px-3 py-1 rounded bg-red-950/60 border border-red-500/30">
                  {lastResult.denialReason || "Security Restriction"}
                </p>
              </>
            )
          ) : (
            <>
              <div className="h-16 w-16 rounded-2xl bg-white/5 text-[#007AFF] flex items-center justify-center mb-3 animate-pulse">
                <IconScan size={36} />
              </div>
              <h2 className="text-lg font-semibold text-white">
                Scanner Ready
              </h2>
              <p className="text-xs text-neutral-400 font-mono mt-1">
                Pull C66 hardware trigger or scan barcode/RFID
              </p>
            </>
          )}
        </div>

        {/* Input Bar (Hardware Scan Catcher) */}
        <div className="space-y-2">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Waiting for RFID / Barcode trigger..."
              className="w-full h-12 rounded-xl bg-neutral-900 border border-white/20 pl-4 pr-12 text-sm font-mono text-white placeholder:text-neutral-500 focus:border-[#007AFF] focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
            />
            <button
              type="button"
              onClick={() => handleProcessScan()}
              disabled={isProcessing || !scanInput.trim()}
              className="absolute right-2 top-2 h-8 w-8 rounded-lg bg-[#007AFF] text-white flex items-center justify-center disabled:opacity-30 cursor-pointer"
            >
              <IconSend size={15} />
            </button>
          </div>
          <p className="text-[11px] text-neutral-500 font-mono text-center">
            Hardware Infowedge input auto-submits on trigger release
          </p>
        </div>

        {/* Quick Test Bench Credentials */}
        <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-white/10 space-y-2">
          <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
            Test Bench Credentials
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleProcessScan("RFID_EMP_003")}
              className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-mono text-left transition cursor-pointer"
            >
              <span className="font-bold block">✓ Bob Johnson</span>
              <span className="text-[10px] text-neutral-400">RFID_EMP_003 (Pass)</span>
            </button>

            <button
              type="button"
              onClick={() => handleProcessScan("TEST_UNAUTHORIZED_999")}
              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-mono text-left transition cursor-pointer"
            >
              <span className="font-bold block">✕ Denied Tag</span>
              <span className="text-[10px] text-neutral-400">UNAUTH_999 (Alarm)</span>
            </button>
          </div>
        </div>

        {/* Recent Scanner History */}
        {recentScans.length > 0 && (
          <div className="space-y-1.5 flex-1">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
              Recent Handheld Scans
            </span>
            <div className="space-y-1">
              {recentScans.map((s, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-lg bg-neutral-900 border border-white/5 flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        s.accessGranted ? "bg-emerald-400" : "bg-red-400"
                      }`}
                    />
                    <span className="truncate text-neutral-200">{s.entityName}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      s.accessGranted
                        ? "text-emerald-400 bg-emerald-500/10"
                        : "text-red-400 bg-red-500/10"
                    }`}
                  >
                    {s.accessGranted ? "PASS" : "DENIED"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
