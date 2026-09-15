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
  IconKey,
  IconCamera,
  IconX,
  IconWifi,
  IconCloud,
  IconArrowLeft,
  IconLayoutDashboard,
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

interface KeySession {
  sessionId: string;
  keyId: string;
  machineId: string;
  requiredCertification?: string | null;
  state: string;
  expiresAt: string;
  expiresAtTimestamp: number;
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

interface ChainwayHardwareInterface {
  scanBarcode?: () => void;
  triggerLaser?: () => void;
  readRfid?: () => void;
  openScanner?: () => void;
  closeScanner?: () => void;
  successFeedback?: () => void;
  errorFeedback?: () => void;
  saveTunnelConfig?: (tunnelUrl: string, deviceId: string) => void;
  applyZeroTouchConfig?: (json: string) => boolean;
  getDeviceInfo?: () => string;
}
interface BarcodeDetectorInstance {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
}
interface BarcodeDetectorConstructor {
  new (options?: { formats: string[] }): BarcodeDetectorInstance;
}
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type CustomWindow = Window & typeof globalThis & {
  chainway?: ChainwayHardwareInterface;
  ChainwayBarcode?: ChainwayHardwareInterface;
  ChainwayHardware?: ChainwayHardwareInterface;
  onBarcodeScanned?: (code: string) => void;
  onNativeScanReceived?: (code: string) => void;
  BarcodeDetector?: BarcodeDetectorConstructor;
};

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
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  // Key Control State Machine
  const [activeKeySession, setActiveKeySession] = useState<KeySession | null>(null);
  const [keyCountdown, setKeyCountdown] = useState<number>(30);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // 1. Service Worker & Permanent Device Link Ceremony on Mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const urlParams = new URLSearchParams(window.location.search);
    const urlDevice = urlParams.get("device") || urlParams.get("deviceId");
    const storedDevice = localStorage.getItem("plantcor_device_id");
    const chosenDevice = urlDevice || storedDevice || "Chainway-C66-01";

    queueMicrotask(() => {
      if (window.matchMedia("(display-mode: standalone)").matches) {
        setIsInstalled(true);
      }
      setDeviceId(chosenDevice);
      setTempDeviceId(chosenDevice);
      const isCf =
        window.location.hostname.includes("trycloudflare.com") ||
        window.location.hostname.includes("cloudflare") ||
        window.location.protocol === "https:";
      setActiveConnectionMode(isCf ? "Cloudflare" : "LAN");
    });

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
          setIsPermanentlyLinked(true);
          setLinkBannerVisible(true);
          setTimeout(() => setLinkBannerVisible(false), 5000);
        }
      } catch {
        setIsPermanentlyLinked(
          Boolean(localStorage.getItem("plantcor_device_linked"))
        );
      }
    };

    performPermanentLink(chosenDevice);

    const handleOnline = () => setSseConnected(true);
    const handleOffline = () => setSseConnected(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [gateLocation]);

  // 2. Android Screen WakeLock
  useEffect(() => {
    let sentinel: WakeLockSentinelLike | null = null;
    const requestLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          const nav = navigator as unknown as {
            wakeLock: { request: (type: string) => Promise<WakeLockSentinelLike> };
          };
          if (nav.wakeLock) {
            sentinel = await nav.wakeLock.request("screen");
          }
        }
      } catch {}
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

      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
      }
    } catch {}
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
          // Triple sawtooth alarm buzzer
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
          // Warning alert ping
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
      } catch {}
    },
    [audioEnabled]
  );

  // 4. Deny Prompt Trigger (Hardware Strobe + Vibrate + Heads Up Notification)
  const triggerDenyPrompt = useCallback(
    (alert: DeviceAlert) => {
      setActiveAlert(alert);
      setCountdown(10);
      playSound("denied");

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate([400, 150, 400, 150, 600, 150, 600]);
        } catch {}
      }

      const customWin = typeof window !== "undefined" ? (window as unknown as CustomWindow) : null;
      if (customWin?.ChainwayHardware) {
        try {
          customWin.ChainwayHardware.errorFeedback?.();
        } catch {}
      }

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
        } catch {}
      }
    },
    [playSound]
  );

  // 5. Permanent Hardware Scan Catcher Focus Trap
  useEffect(() => {
    inputRef.current?.focus();
    const handleTap = () => {
      if (!cameraActive && !isEditingDevice) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener("click", handleTap);
    window.addEventListener("touchstart", handleTap);
    return () => {
      window.removeEventListener("click", handleTap);
      window.removeEventListener("touchstart", handleTap);
    };
  }, [cameraActive, isEditingDevice]);

  // 6. Connect to SSE Stream (Targeted to this Device ID)
  useEffect(() => {
    if (!deviceId) return;
    let es: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let watchdogTimer: NodeJS.Timeout | null = null;
    let retryCount = 0;
    let isSubscribed = true;

    const resetWatchdog = () => {
      if (watchdogTimer) clearTimeout(watchdogTimer);
      watchdogTimer = setTimeout(() => {
        if (!isSubscribed) return;
        console.warn("[Scanner SSE] Watchdog expired (40s). Reconnecting...");
        if (es) { es.close(); es = null; }
        scheduleReconnect();
      }, 40_000);
    };

    const scheduleReconnect = () => {
      if (!isSubscribed || reconnectTimer) return;
      setSseConnected(false);
      const delay = Math.min(1000 * Math.pow(1.5, retryCount), 30_000) + Math.floor(Math.random() * 500);
      retryCount++;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (!isSubscribed) return;
      if (watchdogTimer) clearTimeout(watchdogTimer);
      try {
        const streamUrl = `/api/events?deviceId=${encodeURIComponent(deviceId)}`;
        es = new EventSource(streamUrl);
        es.onopen = () => {
          if (!isSubscribed) return;
          setSseConnected(true);
          retryCount = 0;
          resetWatchdog();
        };
        es.onmessage = (e) => {
          if (!isSubscribed) return;
          resetWatchdog();
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
          } catch {}
        };
        es.addEventListener("ping", () => {
          if (isSubscribed) resetWatchdog();
        });
        es.onerror = () => {
          if (!isSubscribed) return;
          if (es) { es.close(); es = null; }
          scheduleReconnect();
        };
      } catch (err) {
        console.error("SSE connection error:", err);
      }
    };
    connect();
    return () => {
      isSubscribed = false;
      if (es) es.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (watchdogTimer) clearTimeout(watchdogTimer);
    };
  }, [deviceId, triggerDenyPrompt, playSound]);

  // 7. Auto-dismiss Alert Countdown Timer
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

  // 7.5 Key Custody 30s Countdown Timer
  useEffect(() => {
    if (!activeKeySession) return;
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((activeKeySession.expiresAtTimestamp - Date.now()) / 1000)
      );
      setKeyCountdown(remaining);
      if (remaining <= 0) {
        setActiveKeySession(null);
        triggerDenyPrompt({
          id: `timeout_${Date.now()}`,
          type: "ACCESS_DENIED",
          title: "⏱️ KEY TIMEOUT EXPIRED",
          message: "30-second operator badge verification window elapsed",
          severity: "danger",
          entityName: `Key ${activeKeySession.machineId}`,
          denialReason: "Key verification timeout expired (30s window exceeded)",
          gateLocation,
          targetDeviceId: deviceId,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    }, 500);
    return () => clearInterval(interval);
  }, [activeKeySession, triggerDenyPrompt, gateLocation, deviceId]);

  // 8. Process Scan (Handles standard gate scan OR key custody state machine)
  const handleProcessScan = async (codeToScan?: string) => {
    const code = (codeToScan || scanInput).trim();
    if (!code || isProcessing) return;

    setIsProcessing(true);
    armAudio();

    try {
      // Branch 0: Zero-Touch QR Provisioning Interception
      if (code.trim().startsWith("{")) {
        try {
          const config = JSON.parse(code.trim());
          if (
            config.deviceId ||
            config.tunnelUrl ||
            config.serverUrl ||
            config.gateProfile
          ) {
            const newDeviceId = config.deviceId || deviceId;
            const newGateLocation =
              config.gateProfile?.gateName ||
              config.gateProfile?.gateId ||
              gateLocation;

            setDeviceId(newDeviceId);
            setTempDeviceId(newDeviceId);
            setGateLocation(newGateLocation);
            localStorage.setItem("plantcor_device_id", newDeviceId);

            const isCf = Boolean(
              config.tunnelUrl && !config.tunnelUrl.includes("127.0.0.1")
            );
            setActiveConnectionMode(isCf ? "Cloudflare" : "LAN");

            const customWin = window as unknown as CustomWindow;
            if (
              customWin?.ChainwayHardware?.saveTunnelConfig &&
              (config.tunnelUrl || config.serverUrl)
            ) {
              customWin.ChainwayHardware.saveTunnelConfig(
                config.tunnelUrl || config.serverUrl,
                newDeviceId
              );
            }
            if (customWin?.ChainwayHardware?.applyZeroTouchConfig) {
              customWin.ChainwayHardware.applyZeroTouchConfig(code.trim());
            }
            if (customWin?.ChainwayHardware?.successFeedback) {
              customWin.ChainwayHardware.successFeedback();
            }

            try {
              await fetch("/api/devices/link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  deviceId: newDeviceId,
                  deviceType: "Chainway C66 Android Handheld",
                  gateLocation: newGateLocation,
                }),
              });
            } catch {}

            localStorage.setItem("plantcor_device_linked", "true");
            setIsPermanentlyLinked(true);
            setLinkBannerVisible(true);
            setTimeout(() => setLinkBannerVisible(false), 5000);
            playSound("granted");

            const result: ScanResult = {
              accessGranted: true,
              denialReason: null,
              entityName: `Zero-Touch Provisioned: ${newDeviceId}`,
              direction: "CONFIG",
              gateLocation: newGateLocation,
              timestamp: new Date().toLocaleTimeString(),
            };
            setLastResult(result);
            setRecentScans((prev) => [result, ...prev.slice(0, 9)]);
            setScanInput("");
            return;
          }
        } catch (err) {
          console.error("Zero-Touch QR parsing error:", err);
        }
      }

      // Branch A: If currently in "Awaiting Operator Verification" state for Key Control
      if (activeKeySession) {
        const keyRes = await fetch("/api/scanner/key-custody", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "verify",
            sessionId: activeKeySession.sessionId,
            badgeTag: code,
            deviceId,
            gateLocation,
            scannedBy: "Chainway C66 Operator",
          }),
        });

        const keyData = await keyRes.json();
        setActiveKeySession(null);

        if (keyData.status === "GRANTED") {
          playSound("granted");
          const result: ScanResult = {
            accessGranted: true,
            denialReason: null,
            entityName: `${keyData.operatorName} (Key for ${keyData.machineId})`,
            direction: "CHECKOUT",
            gateLocation,
            timestamp: new Date().toLocaleTimeString(),
          };
          setLastResult(result);
          setRecentScans((prev) => [result, ...prev.slice(0, 9)]);
        } else {
          triggerDenyPrompt({
            id: `key_denial_${Date.now()}`,
            type: "ACCESS_DENIED",
            title: "⛔ KEY CHECKOUT DENIED",
            message: keyData.denialReason || "Operator Verification Failed",
            severity: "danger",
            entityName: keyData.operatorName || code,
            denialReason: keyData.denialReason || "Compliance check failed",
            gateLocation,
            rawTag: code,
            targetDeviceId: deviceId,
            timestamp: new Date().toLocaleTimeString(),
          });
        }
        setScanInput("");
        return;
      }

      // Branch B: If tag is a Key Tag e.g. "KEY-CAT-797F-01" or starts with "KEY_" / "KEY-"
      const isKeyTag =
        code.toUpperCase().startsWith("KEY-") ||
        code.toUpperCase().startsWith("KEY_") ||
        code.toUpperCase().startsWith("KEY");

      if (isKeyTag) {
        const keyRes = await fetch("/api/scanner/key-custody", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "initiate",
            keyTag: code,
            deviceId,
            gateLocation,
          }),
        });

        const keyData = await keyRes.json();
        if (keyData.success && keyData.session) {
          setActiveKeySession(keyData.session);
          setKeyCountdown(30);
          playSound("alert");
          setScanInput("");
          return;
        }
      }

      // Branch C: Standard Gate Access Scan
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

  // Native Android Bridge hook
  useEffect(() => {
    if (typeof window !== "undefined") {
      const customWin = window as unknown as CustomWindow;
      customWin.onNativeScanReceived = (barcode: string) => {
        handleProcessScan(barcode);
      };
    }
  });

  // Camera Fallback Scanner Activation
  const startCamera = async () => {
    setCameraActive(true);
    armAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Use native BarcodeDetector if available
      const customWin = window as unknown as CustomWindow;
      if (customWin.BarcodeDetector) {
        const detector = new customWin.BarcodeDetector({
          formats: ["qr_code", "code_128", "ean_13", "data_matrix"],
        });

        const interval = setInterval(async () => {
          if (!videoRef.current || !cameraActive) {
            clearInterval(interval);
            return;
          }
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              stopCamera();
              handleProcessScan(code);
            }
          } catch {}
        }, 300);
      }
    } catch (e) {
      console.error("Camera access failed:", e);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
    inputRef.current?.focus();
  };

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
    <div className="kiosk-container w-full h-dvh overflow-hidden overscroll-contain bg-black text-neutral-100 flex flex-col font-sans select-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* FULL-SCREEN RED STROBE ALERT ON ACCESS DENIED */}
      {activeAlert && activeAlert.severity === "danger" && (
        <div className="fixed inset-0 z-45 flex flex-col items-center justify-between p-6 bg-red-950/98 border-[10px] border-red-600 animate-pulse text-center">
          <div className="w-full flex items-center justify-between pt-2">
            <span className="text-[11px] uppercase font-mono font-bold tracking-widest text-red-200 px-3.5 py-1 rounded-full bg-red-900/90 border border-red-500/60 shadow-lg flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400 animate-ping" />
              <span>HARDWARE INTERCEPTION STROBE</span>
            </span>

            <span className="text-xs font-mono font-bold text-red-300 bg-black/60 px-3 py-1 rounded-lg border border-red-500/30">
              Clear in {countdown}s
            </span>
          </div>

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

          <div className="w-full max-w-md space-y-2 pb-2">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setActiveAlert(null)}
                className="h-14 min-h-[56px] rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-[0.98] active:brightness-90 border border-white/20 text-white font-mono font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg"
              >
                Acknowledge
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveAlert(null);
                  inputRef.current?.focus();
                }}
                className="h-14 min-h-[56px] rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] active:brightness-90 text-white font-mono font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-[0_0_30px_rgba(239,68,68,0.7)] flex items-center justify-center gap-2"
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

      {/* KEY CONTROL STATE MACHINE BANNER */}
      {activeKeySession && (
        <div className="bg-amber-950/95 border-b-2 border-amber-500 p-4 animate-pulse">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3 font-mono">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40">
                <IconKey size={24} />
              </div>
              <div>
                <strong className="text-white text-sm block">
                  KEY SCANNED: {activeKeySession.machineId}
                </strong>
                <span className="text-amber-300 text-xs">
                  Scan Operator Badge to verify compliance
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-amber-400 block font-mono">
                {keyCountdown}s
              </span>
              <button
                type="button"
                onClick={() => setActiveKeySession(null)}
                className="min-h-[48px] px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-xs font-mono font-bold text-amber-200 border border-amber-500/40 active:scale-[0.98] transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Header */}
      <header className="p-3 bg-neutral-900 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="min-h-[48px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.98] text-white flex items-center gap-2 text-xs font-mono font-bold transition border border-white/10"
            title="Return to Admin Dashboard"
          >
            <IconArrowLeft size={18} className="text-[#007AFF]" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <div className="h-6 w-[1px] bg-white/10 hidden sm:block" />

          <IconDeviceMobile size={22} className="text-[#007AFF] hidden xs:block" />
          <button
            type="button"
            onClick={() => setIsEditingDevice(true)}
            className="min-h-[48px] px-3.5 py-2 text-xs sm:text-sm font-mono font-bold text-white flex items-center gap-2 bg-white/5 rounded-xl hover:bg-white/10 active:scale-[0.98] transition cursor-pointer"
            title="Configure Scanner ID"
          >
            <span>{deviceId}</span>
            <IconSettings size={15} className="text-neutral-400" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono ${
              activeConnectionMode === "LAN"
                ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                : "bg-orange-500/10 text-orange-300 border-orange-500/30"
            }`}
          >
            {activeConnectionMode === "LAN" ? <IconWifi size={13} /> : <IconCloud size={13} />}
            <span>{activeConnectionMode}</span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono ${
              sseConnected
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-300 border-amber-500/30"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                sseConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span>{sseConnected ? "Push Live" : "Syncing"}</span>
          </div>

          {/* Camera Scanner Button */}
          <button
            type="button"
            onClick={cameraActive ? stopCamera : startCamera}
            className="touch-target-industrial min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.98] text-[#007AFF] cursor-pointer"
            title="Camera Barcode Scanner"
          >
            <IconCamera size={20} />
          </button>

          {/* Audio Buzzer Toggle */}
          <button
            type="button"
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="touch-target-industrial min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.98] text-neutral-300 cursor-pointer"
            title="Toggle Alarm Tone"
          >
            {audioEnabled ? (
              <IconVolume size={20} className="text-emerald-400" />
            ) : (
              <IconVolumeOff size={20} className="text-neutral-500" />
            )}
          </button>
        </div>
      </header>

      {/* One-Tap PWA Install Banner */}
      {installPrompt && !isInstalled && (
        <div className="p-3 bg-gradient-to-r from-[#007AFF]/20 via-[#007AFF]/10 to-transparent border-b border-[#007AFF]/30 flex items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <IconDownload size={18} className="text-[#007AFF]" />
            <span className="text-white">Install Control-Access PWA on Android</span>
          </div>
          <button
            type="button"
            onClick={handleInstallApp}
            className="min-h-[48px] px-4 py-2 rounded-xl bg-[#007AFF] hover:bg-[#0A84FF] text-white font-bold text-xs cursor-pointer"
          >
            Install App
          </button>
        </div>
      )}

      {/* Audio Arming Alert */}
      {!audioArmed && (
        <div
          onClick={armAudio}
          className="min-h-[48px] bg-amber-500/20 border-b border-amber-500/30 px-4 py-3 text-center text-xs font-mono text-amber-300 flex items-center justify-center gap-2.5 cursor-pointer hover:bg-amber-500/30 active:scale-[0.99] transition animate-pulse"
        >
          <IconBell size={18} />
          <span className="font-bold">
            Tap here to Arm Hardware Audio Buzzer & Haptic Vibration
          </span>
        </div>
      )}

      {/* Main Terminal Viewport */}
      <main className="flex-1 scroll-contained p-4 max-w-lg mx-auto w-full space-y-4">
        {/* Gate Selection */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-900 border border-white/10 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-neutral-300 font-semibold">
              {isPermanentlyLinked ? "Permanently Bound" : "Linking..."}
            </span>
          </div>
          <select
            value={gateLocation}
            onChange={(e) => setGateLocation(e.target.value)}
            className="h-12 rounded-xl bg-black text-white text-xs sm:text-sm px-3 py-2 border border-white/10 focus:outline-none max-w-[200px] truncate"
          >
            <option value="Brakfontein - Main Gate">Brakfontein - Main Gate</option>
            <option value="Brakfontein - C66 Mobile Gate">Brakfontein - C66 Mobile</option>
            <option value="Haulage Gate 2">Haulage Gate 2</option>
            <option value="Pit Security Post">Pit Security Post</option>
          </select>
        </div>

        {/* Camera Scanner Viewfinder Modal / Optical Camera HUD */}
        {cameraActive && (
          <div className="relative rounded-3xl overflow-hidden border-2 border-[#007AFF] bg-black">
            <video ref={videoRef} className="w-full h-64 object-cover" />
            {/* Optical Camera HUD Reticle & Targeting Grid */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="relative w-48 h-48 border-2 border-dashed border-[#007AFF]/60 rounded-2xl flex items-center justify-center">
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-[#007AFF]" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-[#007AFF]" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-[#007AFF]" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-[#007AFF]" />
                <div className="w-full h-0.5 bg-[#007AFF] shadow-[0_0_8px_#007AFF] opacity-75" />
              </div>
            </div>
            <button
              type="button"
              onClick={stopCamera}
              className="absolute top-3 right-3 min-h-[48px] min-w-[48px] rounded-full bg-black/70 text-white flex items-center justify-center"
            >
              <IconX size={20} />
            </button>
            <div className="absolute bottom-2 inset-x-0 text-center text-xs font-mono text-white bg-black/60 py-1">
              OPTICAL CAMERA HUD: Point camera at barcode or QR code
            </div>
          </div>
        )}

        {/* Main Status Display */}
        <div
          className={`relative overflow-hidden rounded-3xl border flex flex-col items-center justify-center text-center transition-all duration-300 min-h-[260px] shadow-2xl backdrop-blur-xl ${
            activeKeySession
              ? "bg-amber-950/30 border-amber-500/50 shadow-[0_0_80px_rgba(245,158,11,0.15)]"
              : lastResult
              ? lastResult.accessGranted
                ? "bg-emerald-950/20 border-emerald-500/30 shadow-[0_0_80px_rgba(16,185,129,0.15)]"
                : "bg-red-950/20 border-red-500/30 shadow-[0_0_80px_rgba(239,68,68,0.15)]"
              : "bg-[#0A0A0A]/60 border-white/10"
          }`}
        >
          {activeKeySession ? (
            <div className="relative z-10 flex flex-col items-center animate-in zoom-in-95 duration-200">
              <div className="h-16 w-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mb-3">
                <IconKey size={36} />
              </div>
              <h2 className="text-2xl font-black text-amber-300 font-mono">
                AWAITING OPERATOR BADGE
              </h2>
              <p className="text-white font-bold text-lg mt-1">
                Machine: {activeKeySession.machineId}
              </p>
              <div className="mt-3 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs">
                Timeout in {keyCountdown} seconds
              </div>
            </div>
          ) : lastResult ? (
            lastResult.accessGranted ? (
              <div className="relative z-10 flex flex-col items-center animate-in zoom-in-95 duration-200">
                <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                  <IconShieldCheck size={40} />
                </div>
                <h2 className="text-2xl font-black text-emerald-400 font-mono">
                  ACCESS GRANTED
                </h2>
                <p className="text-white font-bold text-lg mt-1 truncate max-w-[280px]">
                  {lastResult.entityName}
                </p>
                <div className="flex items-center gap-2 mt-3 text-[11px] font-mono text-emerald-400/80 bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-500/20">
                  <span>{lastResult.direction}</span>
                  <span>•</span>
                  <span>{lastResult.timestamp}</span>
                </div>
              </div>
            ) : (
              <div className="relative z-10 flex flex-col items-center animate-in zoom-in-95 duration-200">
                <div className="h-16 w-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mb-3 animate-pulse">
                  <IconShieldX size={40} />
                </div>
                <h2 className="text-2xl font-black text-red-400 font-mono">
                  ACCESS DENIED
                </h2>
                <p className="text-white font-bold text-base mt-1 truncate max-w-[280px]">
                  {lastResult.entityName}
                </p>
                <div className="mt-2 px-3 py-1 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 font-mono">
                  {lastResult.denialReason || "Security Restriction"}
                </div>
              </div>
            )
          ) : (
            <>
              <div className="h-16 w-16 rounded-2xl bg-white/5 text-[#007AFF] flex items-center justify-center mb-3 animate-pulse">
                <IconScan size={38} />
              </div>
              <h2 className="text-lg font-semibold text-white font-mono">Scanner Armed</h2>
              <p className="text-xs text-neutral-400 font-mono mt-1">
                Pull C66 yellow trigger or scan test badge below
              </p>
            </>
          )}
        </div>

        {/* Input Bar */}
        <div className="space-y-2">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeKeySession ? "Scan operator badge..." : "Hardware scan trigger listener active..."}
              className="w-full h-16 rounded-2xl bg-neutral-900 border border-white/20 pl-4 pr-16 text-base font-mono text-white placeholder:text-neutral-500 focus:border-[#007AFF] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleProcessScan()}
              disabled={isProcessing || !scanInput.trim()}
              className="absolute right-2 top-2 h-12 w-12 min-h-[48px] min-w-[48px] touch-target-industrial rounded-xl bg-[#007AFF] hover:bg-[#0A84FF] active:scale-[0.98] text-white flex items-center justify-center disabled:opacity-30 cursor-pointer shadow-md"
              title="Dispatch scan trigger"
            >
              <IconSend size={18} />
            </button>
          </div>
        </div>

        {/* Interactive Key Control & Verification Test Bench */}
        <div className="p-4 rounded-2xl bg-neutral-900/60 border border-white/10 space-y-2.5">
          <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
            Test Bench Credentials
          </span>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleProcessScan("KEY-CAT-797F-01")}
              className="min-h-[48px] p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 active:scale-[0.98] border border-amber-500/30 text-amber-300 text-xs font-mono text-left transition cursor-pointer flex flex-col justify-center"
            >
              <span className="font-bold block text-xs">🔑 Cat 797F Key</span>
              <span className="text-[10px] text-neutral-400">KEY-CAT-797F-01</span>
            </button>

            <button
              type="button"
              onClick={() => handleProcessScan("RFID_EMP_003")}
              className="min-h-[48px] p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-[0.98] border border-emerald-500/30 text-emerald-300 text-xs font-mono text-left transition cursor-pointer flex flex-col justify-center"
            >
              <span className="font-bold block text-xs">✓ Bob Johnson</span>
              <span className="text-[10px] text-neutral-400">EMP003 (Certified)</span>
            </button>

            <button
              type="button"
              onClick={() => handleProcessScan("TEST_EXPIRED_MED_001")}
              className="min-h-[48px] p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 active:scale-[0.98] border border-red-500/30 text-red-300 text-xs font-mono text-left transition cursor-pointer flex flex-col justify-center"
            >
              <span className="font-bold block text-xs">✕ Expired Med</span>
              <span className="text-[10px] text-neutral-400">Medical Expired</span>
            </button>

            <button
              type="button"
              onClick={() => handleProcessScan("TEST_UNINDUCTED_001")}
              className="min-h-[48px] p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 active:scale-[0.98] border border-red-500/30 text-red-300 text-xs font-mono text-left transition cursor-pointer flex flex-col justify-center"
            >
              <span className="font-bold block text-xs">✕ Uninducted</span>
              <span className="text-[10px] text-neutral-400">Contractor Uninducted</span>
            </button>
          </div>
        </div>

        {/* Recent Scans */}
        {recentScans.length > 0 && (
          <div className="space-y-2 flex-1 pb-4">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
              Recent Scans on {deviceId}
            </span>
            <div className="space-y-1.5">
              {recentScans.map((s, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-neutral-900 border border-white/5 flex items-center justify-between text-xs font-mono"
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

      {/* Device ID Modal */}
      {isEditingDevice && (
        <div className="fixed inset-0 z-35 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-neutral-900 border border-white/15 rounded-2xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white font-mono">Configure Scanner ID</h3>
            <input
              type="text"
              value={tempDeviceId}
              onChange={(e) => setTempDeviceId(e.target.value)}
              placeholder="e.g. Chainway-C66-01"
              className="w-full h-12 rounded-xl bg-black/60 border border-white/20 px-3.5 text-sm text-white font-mono focus:border-[#007AFF] focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsEditingDevice(false)}
                className="h-12 min-h-[48px] rounded-xl bg-white/5 text-xs text-neutral-300 font-mono hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDeviceId}
                className="h-12 min-h-[48px] rounded-xl bg-[#007AFF] text-xs text-white font-mono font-semibold hover:bg-[#0A84FF]"
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
