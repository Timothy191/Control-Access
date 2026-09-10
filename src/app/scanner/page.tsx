"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  IconScan,
  IconShieldCheck,
  IconShieldX,
  IconDeviceMobile,
  IconVolume,
  IconVolumeOff,
  IconSend,
  IconAlertTriangle,
  IconBell,
  IconRefresh,
  IconSettings,
  IconCheck,
  IconDownload,
  IconBolt,
  IconWifi,
  IconCloud,
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

export default function PermanentC66ScannerPage() {
  const [deviceId, setDeviceId] = useState("Chainway-C66-01");
  const [isPermanentlyLinked, setIsPermanentlyLinked] = useState(false);
  const [linkBannerVisible, setLinkBannerVisible] = useState(false);
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
  const [gateLocation, setGateLocation] = useState("Brakfontein - Main Gate");
  const [countdown, setCountdown] = useState(10);
  const [activeConnectionMode, setActiveConnectionMode] = useState<"LAN" | "Cloudflare">("LAN");
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // 1. Permanent Device Link Ceremony on Mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if running as standalone PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const urlDevice = urlParams.get("device") || urlParams.get("deviceId");
    const storedDevice = localStorage.getItem("plantcor_device_id");
    const chosenDevice = urlDevice || storedDevice || "Chainway-C66-01";
    setDeviceId(chosenDevice);
    setTempDeviceId(chosenDevice);

    const performPermanentLink = async (devId: string) => {
      try {
        const res = await fetch("/api/devices/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: devId,
            deviceType: "Chainway C66 Android Handheld",
            gateLocation,
          }),
        });

        if (res.ok) {
          localStorage.setItem("plantcor_device_id", devId);
          localStorage.setItem("plantcor_device_linked", "true");
          localStorage.setItem("plantcor_linked_at", new Date().toISOString());
          setIsPermanentlyLinked(true);
          setLinkBannerVisible(true);
          setTimeout(() => setLinkBannerVisible(false), 6000);
        }
      } catch (e) {
        console.warn("Permanent link heartbeat error:", e);
        setIsPermanentlyLinked(Boolean(localStorage.getItem("plantcor_device_linked")));
      }
    };

    performPermanentLink(chosenDevice);

    // Detect if on Cloudflare Tunnel or local LAN
    if (window.location.hostname.includes("trycloudflare.com") || window.location.hostname.includes("cloudflare")) {
      setActiveConnectionMode("Cloudflare");
    } else {
      setActiveConnectionMode("LAN");
    }

    // Capture PWA beforeinstallprompt
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, [gateLocation]);

  // 2. Android Screen WakeLock (Permanent Screen On)
  useEffect(() => {
    let sentinel: any = null;
    const requestLock = async () => {
      try {
        if ("wakeLock" in navigator && (navigator as any).wakeLock) {
          sentinel = await (navigator as any).wakeLock.request("screen");
        }
      } catch {
        // ignore
      }
    };
    requestLock();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        requestLock();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (sentinel && sentinel.release) {
        sentinel.release().catch(() => {});
      }
    };
  }, []);

  // 3. Audio Synthesizer Engine
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

      // Notification permission request
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
          // Double harmonic chime (E5 -> B5)
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(659.25, now);
          osc.frequency.setValueAtTime(987.77, now + 0.12);
          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.45);
        } else if (type === "denied") {
          // Harsh triple sawtooth alarm buzzer
          [0, 0.22, 0.44].forEach((offset, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sawtooth";
            const freq = idx === 0 ? 260 : idx === 1 ? 190 : 130;
            osc.frequency.setValueAtTime(freq, now + offset);
            osc.frequency.linearRampToValueAtTime(freq * 0.7, now + offset + 0.18);
            gain.gain.setValueAtTime(0.65, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.19);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + 0.19);
          });
        } else {
          // Alert ping
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(480, now);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.25);
        }
      } catch {
        // ignore
      }
    },
    [audioEnabled]
  );

  // 4. Deny Prompt Trigger (Hardware Strobe + Vibrate + Heads Up Notification)
  const triggerDenyPrompt = useCallback(
    (alert: DeviceAlert) => {
      setActiveAlert(alert);
      setCountdown(10);
      playSound("denied");

      // Hardware haptic vibration
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate([400, 150, 400, 150, 600, 150, 600]);
        } catch {
          // ignore
        }
      }

      // Chainway C66 Native Bridge API Call
      if (typeof window !== "undefined" && (window as any).ChainwayHardware) {
        try {
          (window as any).ChainwayHardware.errorFeedback();
        } catch {
          // ignore
        }
      }

      // Android push notification
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

  // 5. Permanent Hardware Scan Catcher Focus Trap
  useEffect(() => {
    inputRef.current?.focus();
    const handleTap = () => {
      inputRef.current?.focus();
    };
    window.addEventListener("click", handleTap);
    window.addEventListener("touchstart", handleTap);
    return () => {
      window.removeEventListener("click", handleTap);
      window.removeEventListener("touchstart", handleTap);
    };
  }, []);

  // 6. Connect to SSE Stream (Targeted to this Device ID)
  useEffect(() => {
    if (!deviceId) return;
    let es: EventSource | null = null;
    let timer: NodeJS.Timeout | null = null;

    const connect = () => {
      try {
        const streamUrl = `/api/scanner/notifications?deviceId=${encodeURIComponent(
          deviceId
        )}`;
        es = new EventSource(streamUrl);

        es.onopen = () => {
          setSseConnected(true);
        };

        es.onmessage = (e) => {
          try {
            const notif = JSON.parse(e.data);
            if (!notif || !notif.type) return;

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

        es.onerror = () => {
          setSseConnected(false);
          if (es) {
            es.close();
            es = null;
          }
          timer = setTimeout(connect, 3500);
        };
      } catch (err) {
        console.error("SSE connection error:", err);
      }
    };

    connect();

    return () => {
      if (es) es.close();
      if (timer) clearTimeout(timer);
    };
  }, [deviceId, triggerDenyPrompt, playSound]);

  // 7. Auto-dismiss Countdown Timer
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

  // 8. Process Scan via Physical Trigger or Input
  const handleProcessScan = async (codeToScan?: string) => {
    const code = (codeToScan || scanInput).trim();
    if (!code || isProcessing) return;

    setIsProcessing(true);
    armAudio();
    try {
      const res = await fetch("/api/scanner/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcodeData: code,
          rfidTag: code.startsWith("RFID_") ? code : undefined,
          deviceId,
          deviceName: deviceId,
          deviceType: "Chainway C66 RFID/Barcode Handheld",
          gateLocation,
          operator: "Handheld Operator",
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
      setRecentScans((prev) => [result, ...prev.slice(0, 9)]);

      if (result.accessGranted) {
        playSound("granted");
      } else {
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
        message: "Unable to reach Control-Access server",
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

  // 8.5 Native Android Bridge (Chainway C66)
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).onNativeScanReceived = (barcode: string) => {
        handleProcessScan(barcode);
      };
    }
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleProcessScan();
    }
  };

  const handleInstallApp = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setInstallPrompt(null);
    }
  };

  const handleSaveDeviceId = async () => {
    const clean = tempDeviceId.trim() || "Chainway-C66-01";
    setDeviceId(clean);
    localStorage.setItem("plantcor_device_id", clean);
    setIsEditingDevice(false);
    try {
      await fetch("/api/devices/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: clean,
          deviceType: "Chainway C66 Android Handheld",
          gateLocation,
        }),
      });
    } catch {}
  };

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* FULL-SCREEN FLASHING RED STROBE ALERT ON ACCESS DENIED */}
      {activeAlert && activeAlert.severity === "danger" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 bg-red-950/98 border-[10px] border-red-600 animate-pulse text-center">
          {/* Top Header Pill */}
          <div className="w-full flex items-center justify-between pt-2">
            <span className="text-[11px] uppercase font-mono font-bold tracking-widest text-red-200 px-3.5 py-1 rounded-full bg-red-900/90 border border-red-500/60 shadow-lg flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400 animate-ping" />
              <span>HARDWARE INTERCEPTION STROBE</span>
            </span>

            <span className="text-xs font-mono font-bold text-red-300 bg-black/60 px-3 py-1 rounded-lg border border-red-500/30">
              Clear in {countdown}s
            </span>
          </div>

          {/* Central Alert Icon & Headline */}
          <div className="flex flex-col items-center max-w-md w-full my-auto space-y-4">
            <div className="h-28 w-28 rounded-full bg-red-600 text-white flex items-center justify-center shadow-[0_0_80px_rgba(239,68,68,1)] animate-bounce">
              <IconShieldX size={72} className="stroke-[2.5]" />
            </div>

            <div>
              <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-wider font-mono">
                ACCESS DENIED
              </h1>
              <p className="text-red-300 text-xs font-mono mt-1">
                Active Scanner: <strong className="text-white">{deviceId}</strong>
              </p>
            </div>

            {/* Rejection Details Box */}
            <div className="w-full bg-black/85 rounded-2xl border border-red-500/50 p-4 space-y-2.5 text-left shadow-2xl">
              <div>
                <span className="text-red-400 block text-[10px] uppercase font-mono font-bold">
                  Subject / Identified Personnel
                </span>
                <strong className="text-white text-lg block font-semibold truncate">
                  {activeAlert.entityName || "Unregistered Credential"}
                </strong>
              </div>

              <div className="pt-2 border-t border-red-500/20">
                <span className="text-red-400 block text-[10px] uppercase font-mono font-bold">
                  Security Denial Reason
                </span>
                <div className="flex items-start gap-1.5 mt-0.5">
                  <IconAlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <span className="text-red-200 font-bold text-sm leading-tight">
                    {activeAlert.denialReason || activeAlert.message}
                  </span>
                </div>
              </div>

              {activeAlert.rawTag && (
                <div className="pt-2 border-t border-red-500/20 flex items-center justify-between text-xs font-mono text-neutral-400">
                  <span>Tag / Code:</span>
                  <code className="text-red-300 bg-red-950/60 px-2 py-0.5 rounded border border-red-500/30">
                    {activeAlert.rawTag}
                  </code>
                </div>
              )}

              {activeAlert.gateLocation && (
                <div className="text-xs font-mono text-neutral-400 flex items-center justify-between">
                  <span>Gate Location:</span>
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
                className="h-14 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-[0.98] border border-white/20 text-white font-mono font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg"
              >
                Acknowledge
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveAlert(null);
                  inputRef.current?.focus();
                }}
                className="h-14 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-mono font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-[0_0_30px_rgba(239,68,68,0.7)] flex items-center justify-center gap-1.5"
              >
                <IconRefresh size={18} />
                <span>Re-Scan Trigger</span>
              </button>
            </div>
            <p className="text-[11px] font-mono text-red-300/80">
              Pull physical C66 yellow trigger to resume scan
            </p>
          </div>
        </div>
      )}

      {/* Permanent Link Confirmation Toast */}
      {linkBannerVisible && (
        <div className="fixed top-2 inset-x-4 z-40 p-3.5 rounded-2xl bg-emerald-950/95 border border-emerald-500/50 text-emerald-200 text-xs font-mono shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top-3">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <IconCheck size={16} />
            </div>
            <div>
              <strong className="block text-white font-bold">PERMANENTLY LINKED TO SYSTEM</strong>
              <span className="text-[11px] text-emerald-300/80">
                Device bound as <code>{deviceId}</code> • Auto-reconnect active
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLinkBannerVisible(false)}
            className="text-xs text-emerald-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Terminal Top Bar */}
      <header className="p-3 bg-neutral-900 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <IconDeviceMobile size={20} className="text-[#007AFF]" />
            <button
              type="button"
              onClick={() => setIsEditingDevice(true)}
              className="text-xs font-mono font-bold text-white flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Configure Scanner ID"
            >
              <span>{deviceId}</span>
              <IconSettings size={13} className="text-neutral-400" />
            </button>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2 text-xs font-mono">
          {/* Connection Mode Indicator */}
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] ${
              activeConnectionMode === "LAN"
                ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                : "bg-orange-500/10 text-orange-300 border-orange-500/30"
            }`}
            title={`Connected via ${activeConnectionMode}`}
          >
            {activeConnectionMode === "LAN" ? <IconWifi size={12} /> : <IconCloud size={12} />}
            <span>{activeConnectionMode}</span>
          </div>

          {/* SSE Live Push */}
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
            <span>{sseConnected ? "Push Live" : "Syncing"}</span>
          </div>

          {/* Audio Toggle */}
          <button
            type="button"
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 cursor-pointer"
            title="Toggle Alarm Tone"
          >
            {audioEnabled ? (
              <IconVolume size={16} className="text-emerald-400" />
            ) : (
              <IconVolumeOff size={16} className="text-neutral-500" />
            )}
          </button>
        </div>
      </header>

      {/* One-Tap PWA Install Banner */}
      {installPrompt && !isInstalled && (
        <div className="p-3 bg-gradient-to-r from-[#007AFF]/20 via-[#007AFF]/10 to-transparent border-b border-[#007AFF]/30 flex items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <IconDownload size={16} className="text-[#007AFF]" />
            <span className="text-white">Install Plantcor C66 Scanner as Android Home App</span>
          </div>
          <button
            type="button"
            onClick={handleInstallApp}
            className="px-3 py-1 rounded-lg bg-[#007AFF] hover:bg-[#0A84FF] text-white font-bold text-xs transition cursor-pointer shrink-0"
          >
            Install App ➔
          </button>
        </div>
      )}

      {/* Audio & Haptic Arming Banner */}
      {!audioArmed && (
        <div
          onClick={armAudio}
          className="bg-amber-500/20 border-b border-amber-500/30 px-3 py-2.5 text-center text-xs font-mono text-amber-300 flex items-center justify-center gap-2 cursor-pointer hover:bg-amber-500/30 transition animate-pulse"
        >
          <IconBell size={16} />
          <span className="font-bold">
            Tap here to Arm Hardware Audio Buzzer & Haptic Vibration
          </span>
        </div>
      )}

      {/* Main Terminal Viewport */}
      <main className="flex-1 flex flex-col p-4 max-w-lg mx-auto w-full space-y-4">
        {/* Permanent Link Status Ribbon */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900 border border-white/10 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            <span className="text-neutral-300 font-semibold">
              {isPermanentlyLinked ? "Permanently Bound" : "Linking to Server..."}
            </span>
          </div>
          <select
            value={gateLocation}
            onChange={(e) => setGateLocation(e.target.value)}
            className="bg-black text-white text-xs px-2 py-1 rounded border border-white/10 focus:outline-none max-w-[180px] truncate"
          >
            <option value="Brakfontein - Main Gate">Brakfontein - Main Gate</option>
            <option value="Brakfontein - C66 Mobile Gate">Brakfontein - C66 Mobile</option>
            <option value="Haulage Gate 2">Haulage Gate 2</option>
            <option value="Pit Security Post">Pit Security Post</option>
            <option value="Visitor Reception">Visitor Reception</option>
          </select>
        </div>

        {/* Big Scanner Status Card */}
        <div
          className={`rounded-2xl border p-6 flex flex-col items-center justify-center text-center transition-all duration-200 min-h-[220px] shadow-lg ${
            lastResult
              ? lastResult.accessGranted
                ? "bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_40px_rgba(52,211,153,0.2)]"
                : "bg-red-950/40 border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.25)]"
              : "bg-neutral-900/80 border-white/15"
          }`}
        >
          {lastResult ? (
            lastResult.accessGranted ? (
              <>
                <div className="h-16 w-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                  <IconShieldCheck size={40} className="stroke-[2.5]" />
                </div>
                <h2 className="text-2xl font-bold text-emerald-300 font-mono tracking-wider">
                  ACCESS GRANTED
                </h2>
                <p className="text-white font-semibold text-lg mt-1 truncate max-w-[280px]">
                  {lastResult.entityName}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs font-mono text-emerald-400/80">
                  <span>{lastResult.direction}</span>
                  <span>•</span>
                  <span>{lastResult.gateLocation}</span>
                  <span>•</span>
                  <span>{lastResult.timestamp}</span>
                </div>
              </>
            ) : (
              <>
                <div className="h-16 w-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mb-3 animate-pulse">
                  <IconShieldX size={40} className="stroke-[2.5]" />
                </div>
                <h2 className="text-2xl font-bold text-red-400 font-mono tracking-wider">
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
                <IconScan size={40} />
              </div>
              <h2 className="text-xl font-semibold text-white">Scanner Armed</h2>
              <p className="text-xs text-neutral-400 font-mono mt-1 max-w-xs">
                Pull C66 hardware scan trigger or tap a test credential below
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
              placeholder="Hardware trigger listener active..."
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
          <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono">
            <span>Hardware: Chainway C66</span>
            <span>Trigger Mode: Auto-Capture</span>
          </div>
        </div>

        {/* Quick Test Bench Credentials */}
        <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-white/10 space-y-2">
          <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
            Instant Test Verification
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
              <span className="text-[10px] text-neutral-400">UNAUTH_999 (Alarm)</span>
            </button>
          </div>
        </div>

        {/* Recent Scanner History */}
        {recentScans.length > 0 && (
          <div className="space-y-1.5 flex-1 pb-4">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
              Recent Scans on {deviceId}
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
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-neutral-500">{s.timestamp}</span>
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
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Device ID Rename Modal */}
      {isEditingDevice && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-neutral-900 border border-white/15 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white font-mono">Configure Scanner ID</h3>
            <p className="text-xs text-neutral-400 font-mono">
              Permanently identifies this Android terminal in the system.
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
                Save & Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
