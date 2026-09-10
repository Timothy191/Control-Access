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
  IconAlertTriangle,
  IconBell,
  IconRefresh,
  IconSettings,
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
  rawTag?: string;
  targetDeviceId?: string;
  timestamp: string;
}

export default function C66ScannerTerminalPage() {
  const [deviceId, setDeviceId] = useState("Chainway-C66-01");
  const [isEditingDevice, setIsEditingDevice] = useState(false);
  const [tempDeviceId, setTempDeviceId] = useState("");
  const [scanInput, setScanInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [activeAlert, setActiveAlert] = useState<DeviceAlert | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioArmed, setAudioArmed] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const [gateLocation, setGateLocation] = useState("Brakfontein - C66 Mobile Gate");
  const [countdown, setCountdown] = useState(10);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // 1. Initialize Device ID from URL or LocalStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlDevice = urlParams.get("device") || urlParams.get("deviceId");
      const stored = localStorage.getItem("c66_device_id");
      const chosen = urlDevice || stored || "Chainway-C66-01";
      setDeviceId(chosen);
      setTempDeviceId(chosen);
      if (urlDevice) {
        localStorage.setItem("c66_device_id", urlDevice);
      }
    } catch {
      // ignore
    }
  }, []);

  // 2. Android Screen Wake Lock (keeps screen awake during guard shift)
  useEffect(() => {
    let wakeLockSentinel: unknown = null;
    const requestWakeLock = async () => {
      try {
        if (
          "wakeLock" in navigator &&
          (navigator as unknown as { wakeLock?: { request: (type: string) => Promise<unknown> } }).wakeLock
        ) {
          wakeLockSentinel = await (
            navigator as unknown as { wakeLock: { request: (type: string) => Promise<unknown> } }
          ).wakeLock.request("screen");
        }
      } catch {
        // wakeLock may fail if battery saver is on
      }
    };
    requestWakeLock();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (
        wakeLockSentinel &&
        typeof (wakeLockSentinel as { release?: () => Promise<void> }).release === "function"
      ) {
        (wakeLockSentinel as { release: () => Promise<void> }).release().catch(() => {});
      }
    };
  }, []);

  // 3. Audio Synthesizer (hardware chimes and multi-tone alarm buzzer)
  const armAudio = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
      setAudioArmed(true);

      // Request system push notification permission on Android
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const playSound = useCallback(
    (type: "granted" | "denied" | "alert") => {
      if (!audioEnabled) return;
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;

        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioCtx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") {
          ctx.resume();
        }

        const now = ctx.currentTime;

        if (type === "granted") {
          // Double pleasant chime (D5 -> A5)
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(587.33, now);
          osc.frequency.setValueAtTime(880, now + 0.12);
          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.4);
        } else if (type === "denied") {
          // Triple harsh sawtooth alarm buzzer (220Hz -> 160Hz -> 110Hz)
          [0, 0.22, 0.44].forEach((offset, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sawtooth";
            const freq = idx === 0 ? 240 : idx === 1 ? 180 : 130;
            osc.frequency.setValueAtTime(freq, now + offset);
            osc.frequency.linearRampToValueAtTime(freq * 0.75, now + offset + 0.18);
            gain.gain.setValueAtTime(0.6, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.19);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + 0.19);
          });
        } else {
          // Warning alert ping
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
        // audio policy fallback
      }
    },
    [audioEnabled]
  );

  // 4. Trigger Deny Prompt with Android Vibration & Native Notification
  const triggerDenyPrompt = useCallback(
    (alert: DeviceAlert) => {
      setActiveAlert(alert);
      setCountdown(10);
      playSound("denied");

      // Hardware haptic vibration on Android C66
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate([300, 120, 300, 120, 500, 120, 500]);
        } catch {
          // ignore
        }
      }

      // Android Heads-Up notification if minimized
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(alert.title || "⛔ ACCESS DENIED", {
            body: `${alert.entityName || "Unknown Subject"}: ${
              alert.denialReason || alert.message
            }`,
            icon: "/icon.svg",
            tag: "access-denied-alarm",
          });
        } catch {
          // ignore
        }
      }
    },
    [playSound]
  );

  // 5. Keep hardware scan input focused permanently
  useEffect(() => {
    inputRef.current?.focus();
    const handleClick = () => {
      inputRef.current?.focus();
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  // 6. Connect to SSE Real-time Push Stream (targeted to this device)
  useEffect(() => {
    if (!deviceId) return;
    let eventSource: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connect = () => {
      try {
        const streamUrl = `/api/scanner/notifications?deviceId=${encodeURIComponent(
          deviceId
        )}`;
        eventSource = new EventSource(streamUrl);

        eventSource.onopen = () => {
          setSseConnected(true);
        };

        eventSource.onmessage = (e) => {
          try {
            const notif = JSON.parse(e.data);
            if (!notif || !notif.type) return;

            // Check if alert is targeted to this device or ALL
            const isForThisDevice =
              !notif.targetDeviceId ||
              notif.targetDeviceId === "ALL" ||
              notif.targetDeviceId.toLowerCase() === deviceId.toLowerCase();

            if (isForThisDevice) {
              if (notif.severity === "danger" || notif.type === "ACCESS_DENIED") {
                triggerDenyPrompt(notif);
              } else if (notif.severity === "success") {
                setActiveAlert(notif);
                playSound("granted");
              } else {
                setActiveAlert(notif);
                playSound("alert");
              }
            }
          } catch {
            // ignore non-json keepalive
          }
        };

        eventSource.onerror = () => {
          setSseConnected(false);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Auto-reconnect after 3s
          reconnectTimer = setTimeout(connect, 3000);
        };
      } catch (err) {
        console.error("SSE connection error:", err);
      }
    };

    connect();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [deviceId, triggerDenyPrompt, playSound]);

  // 7. Auto-dismiss timer countdown
  useEffect(() => {
    if (!activeAlert) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setActiveAlert(null);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeAlert]);

  // 8. Submit Scan via Webhook / Keyboard Emulation
  const handleProcessScan = async (codeToScan?: string) => {
    const code = (codeToScan || scanInput).trim();
    if (!code || isProcessing) return;

    setIsProcessing(true);
    armAudio(); // Unlock audio on user scan interaction
    try {
      const res = await fetch("/api/scanner/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcodeData: code,
          rfidTag: code.startsWith("RFID_") ? code : undefined,
          deviceId,
          deviceName: deviceId,
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
        // PUSH AND DISPLAY DENY PROMPT IMMEDIATELY ON ANDROID SCREEN!
        triggerDenyPrompt({
          id: `denial_${Date.now()}`,
          type: "ACCESS_DENIED",
          title: "⛔ ACCESS DENIED",
          message: data.denialReason || "Security Clearance Required",
          severity: "danger",
          entityName: data.entityName || "Unauthorized Subject",
          denialReason: data.denialReason || "Security Clearance Required",
          gateLocation: data.gateLocation || gateLocation,
          rawTag: code,
          targetDeviceId: deviceId,
          timestamp: new Date().toLocaleTimeString(),
        });
      }

      setScanInput("");
    } catch (err) {
      console.error("Scan dispatch error:", err);
      triggerDenyPrompt({
        id: `denial_net_${Date.now()}`,
        type: "ACCESS_DENIED",
        title: "⚠️ NETWORK ERROR",
        message: "Failed to verify credential with central server",
        severity: "danger",
        entityName: code,
        denialReason: "Network / Server unreachable",
        gateLocation,
        rawTag: code,
        targetDeviceId: deviceId,
        timestamp: new Date().toLocaleTimeString(),
      });
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

  const handleSaveDeviceId = () => {
    const clean = tempDeviceId.trim() || "Chainway-C66-01";
    setDeviceId(clean);
    localStorage.setItem("c66_device_id", clean);
    setIsEditingDevice(false);
  };

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col font-sans select-none">
      {/* FULL-SCREEN FLASHING RED ALERT ON ACCESS DENIED */}
      {activeAlert && activeAlert.severity === "danger" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 bg-red-950/98 border-[8px] border-red-600 animate-pulse text-center">
          {/* Top Strobe Pill & Countdown */}
          <div className="w-full flex items-center justify-between pt-2">
            <span className="text-[11px] uppercase font-mono font-bold tracking-widest text-red-200 px-3.5 py-1 rounded-full bg-red-900/90 border border-red-500/60 shadow-lg flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400 animate-ping" />
              <span>HARDWARE INTERCEPTION STROBE</span>
            </span>

            <span className="text-xs font-mono font-bold text-red-300 bg-black/60 px-2.5 py-1 rounded-lg border border-red-500/30">
              Auto-clear in {countdown}s
            </span>
          </div>

          {/* Central Alert Icon & Headline */}
          <div className="flex flex-col items-center max-w-md w-full my-auto space-y-4">
            <div className="h-24 w-24 rounded-full bg-red-600 text-white flex items-center justify-center shadow-[0_0_60px_rgba(239,68,68,1)] animate-bounce">
              <IconShieldX size={64} className="stroke-[2.5]" />
            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-wider font-mono">
                ACCESS DENIED
              </h1>
              <p className="text-red-300 text-xs font-mono mt-1">
                Target Device: <strong className="text-white">{deviceId}</strong>
              </p>
            </div>

            {/* Rejection Details Box */}
            <div className="w-full bg-black/80 rounded-2xl border border-red-500/50 p-4 space-y-2.5 text-left shadow-2xl">
              <div>
                <span className="text-red-400 block text-[10px] uppercase font-mono font-bold">
                  Subject / Identified Personnel
                </span>
                <strong className="text-white text-base block font-semibold truncate">
                  {activeAlert.entityName || "Unregistered Credential"}
                </strong>
              </div>

              <div className="pt-2 border-t border-red-500/20">
                <span className="text-red-400 block text-[10px] uppercase font-mono font-bold">
                  Security Denial Reason
                </span>
                <div className="flex items-start gap-1.5 mt-0.5">
                  <IconAlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <span className="text-red-200 font-bold text-sm leading-tight">
                    {activeAlert.denialReason || activeAlert.message}
                  </span>
                </div>
              </div>

              {activeAlert.rawTag && (
                <div className="pt-2 border-t border-red-500/20 flex items-center justify-between text-[11px] font-mono text-neutral-400">
                  <span>Tag / Code:</span>
                  <code className="text-red-300 bg-red-950/60 px-2 py-0.5 rounded border border-red-500/30">
                    {activeAlert.rawTag}
                  </code>
                </div>
              )}

              {activeAlert.gateLocation && (
                <div className="text-[11px] font-mono text-neutral-400 flex items-center justify-between">
                  <span>Gate Portal:</span>
                  <span className="text-white font-medium">{activeAlert.gateLocation}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons for Handheld Operator */}
          <div className="w-full max-w-md space-y-2 pb-2">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setActiveAlert(null)}
                className="h-12 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-[0.98] border border-white/20 text-white font-mono font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg"
              >
                Acknowledge
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveAlert(null);
                  inputRef.current?.focus();
                }}
                className="h-12 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-mono font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-[0_0_25px_rgba(239,68,68,0.7)] flex items-center justify-center gap-1.5"
              >
                <IconRefresh size={16} />
                <span>Re-Scan</span>
              </button>
            </div>
            <p className="text-[11px] font-mono text-red-300/80">
              Tap Acknowledge or Re-Scan to resume scanning
            </p>
          </div>
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

          <div className="flex items-center gap-1.5 ml-1">
            <IconDeviceMobile size={18} className="text-[#007AFF]" />
            <button
              type="button"
              onClick={() => setIsEditingDevice(true)}
              className="text-xs font-mono font-bold text-white flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Change Scanner ID"
            >
              <span>{deviceId}</span>
              <IconSettings size={12} className="text-neutral-400" />
            </button>
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
            <span>{sseConnected ? "Push Online" : "Connecting"}</span>
          </div>

          <button
            type="button"
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 cursor-pointer"
            title="Toggle Audio Buzzer"
          >
            {audioEnabled ? (
              <IconVolume size={16} className="text-emerald-400" />
            ) : (
              <IconVolumeOff size={16} className="text-neutral-500" />
            )}
          </button>
        </div>
      </header>

      {/* Audio & Haptic Arming Banner (Required for Android Chrome sound autoplay) */}
      {!audioArmed && (
        <div
          onClick={armAudio}
          className="bg-amber-500/20 border-b border-amber-500/30 px-3 py-2 text-center text-xs font-mono text-amber-300 flex items-center justify-center gap-2 cursor-pointer hover:bg-amber-500/30 transition animate-pulse"
        >
          <IconBell size={15} />
          <span className="font-semibold">
            Tap here to Arm Hardware Audio Buzzer & Haptics for C66
          </span>
        </div>
      )}

      {/* Device ID Rename Modal */}
      {isEditingDevice && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-neutral-900 border border-white/15 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white font-mono">
              Configure Scanner ID
            </h3>
            <p className="text-xs text-neutral-400 font-mono">
              Identifies this Android terminal for targeted push alerts.
            </p>
            <input
              type="text"
              value={tempDeviceId}
              onChange={(e) => setTempDeviceId(e.target.value)}
              placeholder="e.g. Chainway-C66-01"
              className="w-full h-9 rounded-lg bg-black/60 border border-white/20 px-3 text-xs text-white font-mono focus:border-[#007AFF] focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditingDevice(false)}
                className="h-8 rounded-lg bg-white/5 text-xs text-neutral-300 font-mono hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDeviceId}
                className="h-8 rounded-lg bg-[#007AFF] text-xs text-white font-mono font-semibold hover:bg-[#0A84FF] cursor-pointer"
              >
                Save ID
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Terminal Viewport */}
      <main className="flex-1 flex flex-col p-4 max-w-lg mx-auto w-full space-y-4">
        {/* Gate Location Selector */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900 border border-white/10 text-xs font-mono">
          <span className="text-neutral-400">Gate Location:</span>
          <select
            value={gateLocation}
            onChange={(e) => setGateLocation(e.target.value)}
            className="bg-black text-white text-xs px-2 py-1 rounded border border-white/10 focus:outline-none"
          >
            <option value="Brakfontein - Main Gate">Brakfontein - Main Gate</option>
            <option value="Brakfontein - C66 Mobile Gate">
              Brakfontein - C66 Mobile Gate
            </option>
            <option value="Optimum - Port 9100">Optimum - Port 9100</option>
            <option value="Thando Tech - Remote Turnstile">
              Thando Tech - Remote Turnstile
            </option>
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
              <h2 className="text-lg font-semibold text-white">Scanner Armed</h2>
              <p className="text-xs text-neutral-400 font-mono mt-1">
                Pull C66 hardware trigger or scan test credential below
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
            Targeted Scanner: <code className="text-[#007AFF]">{deviceId}</code>
          </p>
        </div>

        {/* Quick Test Bench Credentials */}
        <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-white/10 space-y-2">
          <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
            Interactive Test Credentials
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleProcessScan("RFID_EMP_003")}
              className="p-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-mono text-left transition cursor-pointer"
            >
              <span className="font-bold block">✓ Bob Johnson</span>
              <span className="text-[10px] text-neutral-400">RFID_EMP_003 (Pass)</span>
            </button>

            <button
              type="button"
              onClick={() => handleProcessScan("TEST_UNAUTHORIZED_999")}
              className="p-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-mono text-left transition cursor-pointer"
            >
              <span className="font-bold block">✕ Denied Tag</span>
              <span className="text-[10px] text-neutral-400">UNAUTH_999 (Strobe)</span>
            </button>
          </div>
        </div>

        {/* Recent Scanner History */}
        {recentScans.length > 0 && (
          <div className="space-y-1.5 flex-1">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
              Recent Activity on {deviceId}
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
