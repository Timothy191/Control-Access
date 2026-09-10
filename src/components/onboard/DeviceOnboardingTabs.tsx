"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import {
  IconDeviceMobile,
  IconQrcode,
  IconBell,
  IconServer,
  IconDownload,
  IconCheck,
  IconAlertTriangle,
  IconSend,
  IconRadio,
  IconShieldX,
  IconShieldCheck,
  IconCopy,
  IconExternalLink,
  IconBolt,
  IconBroadcast,
  IconWifi,
  IconCloud,
} from "@tabler/icons-react";
import type { DeviceNotification } from "@/lib/device-notifications";

interface DeviceItem {
  id: number;
  device_name: string;
  device_type: string | null;
  ip_address: string | null;
  mac_address: string | null;
  last_seen: string | null;
  status: string;
  total_scans: number;
}

interface DeviceOnboardingTabsProps {
  serverIp: string;
  serverPort: string;
  publicUrl: string;
  scannerTerminalQr: string;
  infowedgeConfigQr: string;
  activeTestTagQr: string;
  deniedTestTagQr: string;
  devices: DeviceItem[];
  initialNotifications: DeviceNotification[];
}

export default function DeviceOnboardingTabs({
  serverIp,
  serverPort,
  publicUrl,
  scannerTerminalQr,
  infowedgeConfigQr,
  activeTestTagQr,
  deniedTestTagQr,
  devices,
  initialNotifications,
}: DeviceOnboardingTabsProps) {
  const [activeTab, setActiveTab] = useState<
    "c66" | "notifications" | "devices" | "config"
  >("c66");

  // Notifications & Pairing State
  const [notifications, setNotifications] = useState<DeviceNotification[]>(
    initialNotifications
  );
  const [networkMode, setNetworkMode] = useState<"public" | "lan">("public");
  const [pairingDeviceId, setPairingDeviceId] = useState("Chainway-C66-01");
  const [terminalQr, setTerminalQr] = useState(scannerTerminalQr);
  const [selectedTargetDevice, setSelectedTargetDevice] = useState("ALL");
  const [customTitle, setCustomTitle] = useState("Security Gate Alert");
  const [customMessage, setCustomMessage] = useState(
    "ACCESS DENIED: Unregistered credential presented at East Turnstile"
  );
  const [customSeverity, setCustomSeverity] = useState<
    "danger" | "warning" | "success" | "info"
  >("danger");
  const [isSending, setIsSending] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Dynamic QR Code generation for Permanent Link
  useEffect(() => {
    const dev = pairingDeviceId.trim() || "Chainway-C66-01";
    const baseUrl = networkMode === "public" ? publicUrl : `http://${serverIp}:${serverPort}`;
    const url = `${baseUrl}/scanner?link=true&device=${encodeURIComponent(dev)}`;
    QRCode.toDataURL(url, { width: 260, margin: 2 })
      .then(setTerminalQr)
      .catch(() => {});
  }, [pairingDeviceId, networkMode, publicUrl, serverIp, serverPort]);

  // SSE Real-Time Listener for Dispatched Notifications
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/scanner/notifications");
      eventSource.onmessage = (e) => {
        try {
          const notif = JSON.parse(e.data);
          if (notif && notif.id) {
            setNotifications((prev) => {
              if (prev.some((n) => n.id === notif.id)) return prev;
              return [notif, ...prev.slice(0, 40)];
            });
          }
        } catch {
          // ignore keepalives
        }
      };
    } catch (err) {
      console.error("SSE stream error:", err);
    }
    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleSendNotification = async (preset?: {
    title: string;
    msg: string;
    severity: "danger" | "warning" | "success" | "info";
    targetDeviceId?: string;
  }) => {
    setIsSending(true);
    const title = preset ? preset.title : customTitle;
    const message = preset ? preset.msg : customMessage;
    const severity = preset ? preset.severity : customSeverity;
    const targetDeviceId = preset?.targetDeviceId || selectedTargetDevice;

    try {
      const res = await fetch("/api/scanner/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          severity,
          type: severity === "danger" ? "ACCESS_DENIED" : "ALERT",
          gateLocation: "Mobile Patrol C66",
          targetDeviceId,
        }),
      });

      if (res.ok) {
        setFeedbackToast(
          `Dispatched to ${targetDeviceId === "ALL" ? "All Scanners" : targetDeviceId}: "${title}"`
        );
        setTimeout(() => setFeedbackToast(null), 3500);
      }
    } catch (err) {
      console.error("Failed to dispatch push alert:", err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {feedbackToast && (
        <div className="fixed top-18 right-6 z-50 p-3 rounded-xl bg-neutral-900/95 border border-emerald-500/40 text-emerald-300 text-xs font-mono shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-2">
          <IconCheck size={16} className="text-emerald-400 shrink-0" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* macOS-Styled Segmented Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-2 rounded-2xl bg-[#18181b]/80 border border-white/10 backdrop-blur-2xl shadow-sm">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/5 text-xs font-sans">
          <button
            type="button"
            onClick={() => setActiveTab("c66")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition cursor-pointer ${
              activeTab === "c66"
                ? "bg-white/15 text-white shadow-xs font-semibold"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <IconQrcode size={15} className="text-[#007AFF]" />
            <span>C66 Infowedge & RFID Setup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition cursor-pointer ${
              activeTab === "notifications"
                ? "bg-white/15 text-white shadow-xs font-semibold"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <IconBell size={15} className="text-[#FF5F56]" />
            <span>Device Notifications & Alerts</span>
            {notifications.filter((n) => n.severity === "danger").length > 0 && (
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("devices")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition cursor-pointer ${
              activeTab === "devices"
                ? "bg-white/15 text-white shadow-xs font-semibold"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <IconRadio size={15} className="text-[#30D158]" />
            <span>Connected Devices ({devices.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("config")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition cursor-pointer ${
              activeTab === "config"
                ? "bg-white/15 text-white shadow-xs font-semibold"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <IconDownload size={15} className="text-[#FFBD2E]" />
            <span>Profiles & Downloads</span>
          </button>
        </div>

        {/* Quick Launch Button to C66 Scanner Terminal */}
        <Link
          href="/onboard/scanner"
          target="_blank"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#007AFF] hover:bg-[#0A84FF] active:scale-[0.98] text-white text-xs font-semibold transition shadow-md cursor-pointer"
        >
          <IconDeviceMobile size={15} />
          <span>Launch C66 Terminal</span>
          <IconExternalLink size={13} className="opacity-75" />
        </Link>
      </div>

      {/* TAB 1: C66 Infowedge & RFID Provisioning */}
      {activeTab === "c66" && (
        <div className="space-y-6">
          {/* Top Instruction Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#007AFF]/15 via-neutral-900/60 to-neutral-900/60 border border-[#007AFF]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#007AFF] font-mono text-xs font-bold uppercase tracking-wider">
                <IconBolt size={16} />
                <span>Chainway C66 Android Handheld Provisioning</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed max-w-2xl">
                Scan the terminal QR code using your Chainway C66 camera or browser to instantly open the real-time RFID and barcode terminal with automatic access denial strobe alarms.
              </p>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-neutral-300 bg-black/40 px-3 py-2 rounded-xl border border-white/10 shrink-0">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Target: {serverIp}:{serverPort}</span>
            </div>
          </div>

          {/* Dual Provisioning QR Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Universal Permanent Link & Setup QR */}
            {(() => {
              const matchedDevice = devices.find(
                (d) => d.device_name.toLowerCase() === pairingDeviceId.trim().toLowerCase()
              );
              const baseUrl = networkMode === "public" ? publicUrl : `http://${serverIp}:${serverPort}`;
              const terminalLinkUrl = `${baseUrl}/scanner?link=true&device=${encodeURIComponent(
                pairingDeviceId.trim() || "Chainway-C66-01"
              )}`;

              return (
                <div className="rounded-2xl border border-white/10 bg-[#18181b]/85 backdrop-blur-2xl p-6 flex flex-col justify-between items-center text-center space-y-4 shadow-xl">
                  <div>
                    <span className="text-[10px] font-mono text-[#007AFF] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-[#007AFF]/10 border border-[#007AFF]/25">
                      1-Scan Permanent Device Link
                    </span>
                    <h3 className="text-base font-semibold text-white mt-2">
                      Universal C66 Setup &amp; Link QR
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                      Scan this QR code with your Chainway C66 camera or browser to permanently link the hardware, configure wake-lock, and enable real-time deny strobe alarms.
                    </p>
                  </div>

                  {/* Network Mode Switcher */}
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-black/60 border border-white/10 text-[11px] font-mono w-full">
                    <button
                      type="button"
                      onClick={() => setNetworkMode("public")}
                      className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        networkMode === "public"
                          ? "bg-[#007AFF] text-white font-semibold shadow-xs"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      <IconCloud size={13} />
                      <span>Cloudflare (Recommended)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNetworkMode("lan")}
                      className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        networkMode === "lan"
                          ? "bg-[#007AFF] text-white font-semibold shadow-xs"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      <IconWifi size={13} />
                      <span>Local Site Wi-Fi</span>
                    </button>
                  </div>

                  {/* QR Image */}
                  <div className="p-3.5 rounded-2xl bg-white shadow-2xl relative group">
                    <Image
                      src={terminalQr}
                      alt="Universal Permanent Link QR"
                      width={210}
                      height={210}
                      className="rounded-lg"
                    />
                  </div>

                  {/* Link Status Pill */}
                  {matchedDevice ? (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>
                        Permanently Linked ({matchedDevice.total_scans} total scans)
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-mono">
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                      <span>Scan to Link Device Permanently</span>
                    </div>
                  )}

                  {/* Pairing Device Identity Input */}
                  <div className="w-full space-y-2">
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-black/50 border border-white/10 text-left">
                      <span className="text-[10px] font-mono text-neutral-400 uppercase shrink-0">
                        Device ID:
                      </span>
                      <input
                        type="text"
                        value={pairingDeviceId}
                        onChange={(e) => setPairingDeviceId(e.target.value)}
                        placeholder="e.g. Chainway-C66-01"
                        className="flex-1 bg-transparent text-xs text-[#007AFF] font-mono font-bold focus:outline-none"
                      />
                    </div>

                    <div className="p-2 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono text-neutral-300 flex items-center justify-between">
                      <span className="truncate max-w-[210px]">{terminalLinkUrl}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(terminalLinkUrl, "terminalUrl")}
                        className="p-1 hover:text-white text-neutral-400 cursor-pointer"
                        title="Copy Permanent Link URL"
                      >
                        {copiedText === "terminalUrl" ? (
                          <IconCheck size={14} className="text-emerald-400" />
                        ) : (
                          <IconCopy size={14} />
                        )}
                      </button>
                    </div>

                    <Link
                      href={terminalLinkUrl}
                      target="_blank"
                      className="block w-full py-2 rounded-lg bg-[#007AFF]/15 hover:bg-[#007AFF]/25 border border-[#007AFF]/30 text-xs font-mono text-white text-center transition"
                    >
                      Launch Fullscreen Terminal as {pairingDeviceId} ➔
                    </Link>
                  </div>
                </div>
              );
            })()}

            {/* Card 2: Chainway Infowedge Auto-Config Profile QR */}
            <div className="rounded-2xl border border-white/10 bg-[#18181b]/85 backdrop-blur-2xl p-6 flex flex-col justify-between items-center text-center space-y-4 shadow-xl">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
                  Infowedge Service Profile
                </span>
                <h3 className="text-base font-semibold text-white mt-2">
                  Infowedge API Webhook Profile
                </h3>
                <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                  Scan in Infowedge to set endpoint to <code>/api/scanner/receive</code>.
                </p>
              </div>

              {/* QR Image */}
              <div className="p-3.5 rounded-2xl bg-white shadow-2xl">
                <Image
                  src={infowedgeConfigQr}
                  alt="Infowedge Auto Config QR"
                  width={210}
                  height={210}
                  className="rounded-lg"
                />
              </div>

              <div className="w-full space-y-2">
                <div className="p-2 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono text-neutral-300 flex items-center justify-between">
                  <span className="truncate max-w-[210px]">
                    {networkMode === "public"
                      ? `${publicUrl}/api/scanner/receive`
                      : `http://${serverIp}:${serverPort}/api/scanner/receive`}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        networkMode === "public"
                          ? `${publicUrl}/api/scanner/receive`
                          : `http://${serverIp}:${serverPort}/api/scanner/receive`,
                        "apiUrl"
                      )
                    }
                    className="p-1 hover:text-white text-neutral-400 cursor-pointer"
                    title="Copy API Webhook URL"
                  >
                    {copiedText === "apiUrl" ? (
                      <IconCheck size={14} className="text-emerald-400" />
                    ) : (
                      <IconCopy size={14} />
                    )}
                  </button>
                </div>

                <a
                  href="/downloads/infowedge-c66-config.json"
                  download="infowedge-c66-config.json"
                  className="block w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-neutral-200 text-center transition"
                >
                  Download Profile JSON (Direct) ➔
                </a>
              </div>
            </div>
          </div>

          {/* Interactive RFID / QR Test Bench */}
          <div className="rounded-2xl border border-white/10 bg-[#18181b]/80 backdrop-blur-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <IconRadio size={16} className="text-[#007AFF]" />
                  <span>On-Screen RFID & QR Test Credentials</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Point your C66 physical scanner directly at these barcodes/QRs to test granted clearance vs denied alarm behavior.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Test 1: Granted Scan */}
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center gap-4">
                <div className="p-2 rounded-xl bg-white shrink-0">
                  <Image
                    src={activeTestTagQr}
                    alt="Active Tag QR"
                    width={100}
                    height={100}
                    className="rounded"
                  />
                </div>
                <div className="min-w-0 space-y-1 text-xs">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    TEST: ACCESS GRANTED
                  </span>
                  <h4 className="font-semibold text-white">Bob Johnson (EMP003)</h4>
                  <p className="text-neutral-400 font-mono text-[11px]">
                    RFID: <code>RFID_EMP_003</code>
                  </p>
                  <p className="text-emerald-400/80 text-[11px]">
                    Expected: Chime tone + Green screen
                  </p>
                </div>
              </div>

              {/* Test 2: Denied Scan */}
              <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 flex items-center gap-4">
                <div className="p-2 rounded-xl bg-white shrink-0">
                  <Image
                    src={deniedTestTagQr}
                    alt="Denied Tag QR"
                    width={100}
                    height={100}
                    className="rounded"
                  />
                </div>
                <div className="min-w-0 space-y-1 text-xs">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                    TEST: ACCESS DENIED (ALARM)
                  </span>
                  <h4 className="font-semibold text-white">Unregistered Credential</h4>
                  <p className="text-neutral-400 font-mono text-[11px]">
                    Tag: <code>TEST_UNAUTHORIZED_999</code>
                  </p>
                  <p className="text-red-400/80 text-[11px]">
                    Expected: Harsh Buzzer + Flashing Strobe
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Device Notifications & Alert Stream */}
      {activeTab === "notifications" && (
        <div className="space-y-6">
          {/* Dispatcher Console */}
          <div className="rounded-2xl border border-white/10 bg-[#18181b]/80 backdrop-blur-2xl p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <IconBell size={16} className="text-[#FF5F56]" />
                <span>Dispatch Alert to Chainway C66 Scanners</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Send an immediate real-time push notification and visual/audible strobe to all connected handheld devices.
              </p>
            </div>

            {/* Quick Alert Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
                Quick Alert Presets
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleSendNotification({
                      title: "⛔ ACCESS DENIED ALERT",
                      msg: "Unregistered RFID Credential presented at East Boom Gate",
                      severity: "danger",
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-mono transition cursor-pointer"
                >
                  [Preset: Access Denied Strobe]
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSendNotification({
                      title: "⚠ PERIMETER LOCKDOWN",
                      msg: "Security protocol delta activated: Hold all gate turnstiles",
                      severity: "danger",
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-mono transition cursor-pointer"
                >
                  [Preset: Emergency Lockdown]
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSendNotification({
                      title: "Shift Handover Call",
                      msg: "Day Ops handover starting in 15 minutes at Central Portal",
                      severity: "info",
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#007AFF]/15 hover:bg-[#007AFF]/25 border border-[#007AFF]/30 text-blue-300 text-xs font-mono transition cursor-pointer"
                >
                  [Preset: Shift Handover]
                </button>
              </div>
            </div>

            {/* Target Scanner Selection Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-black/40 border border-white/10">
              <div className="text-xs font-mono text-neutral-300 flex items-center gap-2">
                <IconDeviceMobile size={15} className="text-[#007AFF]" />
                <span className="uppercase text-[11px] text-neutral-400 font-bold">
                  Target Handheld Scanner:
                </span>
              </div>
              <select
                value={selectedTargetDevice}
                onChange={(e) => setSelectedTargetDevice(e.target.value)}
                className="h-8 rounded-lg bg-black/60 border border-white/20 px-2.5 text-xs text-white font-mono focus:border-[#007AFF] focus:outline-none"
              >
                <option value="ALL">📢 Broadcast to All Handhelds (ALL)</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.device_name}>
                    📱 {d.device_name} ({d.ip_address || "127.0.0.1"})
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Message Dispatch Form */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="sm:col-span-1">
                <label className="block text-[11px] font-mono text-neutral-400 mb-1 uppercase">
                  Alert Title
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full h-9 rounded-lg bg-black/50 border border-white/15 px-3 text-xs text-white focus:border-[#007AFF] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-mono text-neutral-400 mb-1 uppercase">
                  Alert Description / Message
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="flex-1 h-9 rounded-lg bg-black/50 border border-white/15 px-3 text-xs text-white focus:border-[#007AFF] focus:outline-none"
                  />

                  <select
                    value={customSeverity}
                    onChange={(e) =>
                      setCustomSeverity(
                        e.target.value as "danger" | "warning" | "success" | "info"
                      )
                    }
                    className="h-9 rounded-lg bg-black/50 border border-white/15 px-2 text-xs text-neutral-200 focus:border-[#007AFF] focus:outline-none"
                  >
                    <option value="danger">Danger (Alarm Strobe)</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleSendNotification()}
                    disabled={isSending || !customTitle.trim()}
                    className="px-4 h-9 rounded-lg bg-[#007AFF] hover:bg-[#0A84FF] active:scale-[0.98] disabled:opacity-50 text-white font-medium text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <IconSend size={14} />
                    <span>{isSending ? "Sending..." : "Dispatch Push"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Live Notification Log Feed */}
          <div className="rounded-2xl border border-white/10 bg-[#18181b]/80 backdrop-blur-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <IconBroadcast size={16} className="text-emerald-400" />
                <span>Live Hardware Push Notification Feed</span>
              </h3>
              <span className="text-xs font-mono text-neutral-400">
                {notifications.length} alerts logged
              </span>
            </div>

            <div className="divide-y divide-white/5 rounded-xl bg-black/40 border border-white/5 max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-500 font-mono">
                  No notifications recorded yet. Scan a credential or dispatch a test alert above.
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-3.5 flex items-start justify-between gap-3 text-xs font-mono hover:bg-white/[0.02] transition"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          notif.severity === "danger"
                            ? "bg-red-500/20 text-red-400"
                            : notif.severity === "success"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        {notif.severity === "danger" ? (
                          <IconShieldX size={15} />
                        ) : notif.severity === "success" ? (
                          <IconShieldCheck size={15} />
                        ) : (
                          <IconAlertTriangle size={15} />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-semibold ${
                              notif.severity === "danger"
                                ? "text-red-300"
                                : notif.severity === "success"
                                ? "text-emerald-300"
                                : "text-amber-300"
                            }`}
                          >
                            {notif.title}
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            {new Date(notif.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-neutral-300 text-[11px] mt-0.5 truncate max-w-lg">
                          {notif.message}
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-neutral-400 shrink-0 uppercase">
                      {notif.type}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Connected Hardware Matrix */}
      {activeTab === "devices" && (
        <div className="rounded-2xl border border-white/10 bg-[#18181b]/80 backdrop-blur-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Registered Scanners & Hardware Nodes
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Active Chainway C66 handheld terminals, stationary turnstiles, and mobile patrol readers
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 bg-black/60 text-[10px] uppercase text-neutral-400">
                  <th className="p-3">Device Identity</th>
                  <th className="p-3">Hardware Type</th>
                  <th className="p-3">IP / Network</th>
                  <th className="p-3">Total Scans</th>
                  <th className="p-3">Last Seen</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {devices.map((d) => (
                  <tr key={d.id} className="hover:bg-white/[0.02] transition">
                    <td className="p-3 font-semibold text-white flex items-center gap-2">
                      <IconDeviceMobile size={15} className="text-[#007AFF]" />
                      <span>{d.device_name}</span>
                    </td>
                    <td className="p-3 text-neutral-300">
                      {d.device_type || "C66 Scanner"}
                    </td>
                    <td className="p-3 text-neutral-400">
                      {d.ip_address || "127.0.0.1"}
                    </td>
                    <td className="p-3 text-neutral-200">
                      {d.total_scans} scans
                    </td>
                    <td className="p-3 text-neutral-400">
                      {d.last_seen
                        ? new Date(d.last_seen).toLocaleTimeString()
                        : "Never"}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleSendNotification({
                              title: `⛔ ACCESS DENIED (TEST)`,
                              msg: `Unauthorized RFID tag intercepted by ${d.device_name}`,
                              severity: "danger",
                              targetDeviceId: d.device_name,
                            })
                          }
                          className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-[11px] text-red-400 font-mono transition cursor-pointer"
                          title="Trigger full-screen Access Denied strobe on this Android scanner"
                        >
                          Push Deny Strobe
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSendNotification({
                              title: `Ping -> ${d.device_name}`,
                              msg: "Hardware connectivity check and vibration test",
                              severity: "info",
                              targetDeviceId: d.device_name,
                            })
                          }
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] text-[#007AFF] transition cursor-pointer"
                          title="Send ping to scanner"
                        >
                          Ping
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Profiles & Downloads */}
      {activeTab === "config" && (
        <div className="rounded-2xl border border-white/10 bg-[#18181b]/80 backdrop-blur-2xl p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Chainway C66 Infowedge Configuration Manual & Downloads
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Official setup instructions to bind the Android physical scanner button to the Control-Access server.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Step-by-Step Guide */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3 text-xs">
              <h4 className="font-semibold text-white font-mono flex items-center gap-2">
                <IconServer size={15} className="text-[#007AFF]" />
                <span>Step-by-Step Infowedge App Setup</span>
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-neutral-300 leading-relaxed font-sans">
                <li>
                  On the <strong>Chainway C66</strong>, open the pre-installed <strong>InfoWedge</strong> app.
                </li>
                <li>
                  Go to <strong>Settings</strong> ➔ <strong>Data Output Mode</strong>.
                </li>
                <li>
                  Select <strong>Web Server POST</strong> or <strong>Keyboard Emulation</strong>.
                </li>
                <li>
                  Enter Target URL: <code>http://{serverIp}:{serverPort}/api/scanner/receive</code>
                </li>
                <li>
                  Under <strong>RFID Settings</strong>, select UHF EPC Gen2 and enable auto-upload.
                </li>
                <li>
                  Alternatively, open Chrome and visit: <code>http://{serverIp}:{serverPort}/onboard/scanner</code>
                </li>
              </ol>
            </div>

            {/* Downloadable Package Box */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-4 flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-white font-mono flex items-center gap-2">
                  <IconDownload size={15} className="text-[#30D158]" />
                  <span>Ready-to-Deploy Provisioning Files</span>
                </h4>
                <p className="text-xs text-neutral-400 mt-2">
                  Pre-configured JSON profiles and APK files for zero-touch configuration.
                </p>
              </div>

              <div className="space-y-2">
                <a
                  href="/downloads/infowedge-c66-config.json"
                  download="infowedge-c66-config.json"
                  className="w-full py-2.5 px-4 rounded-lg bg-[#007AFF] hover:bg-[#0A84FF] text-white font-medium text-xs transition flex items-center justify-between"
                >
                  <span>infowedge-c66-config.json</span>
                  <IconDownload size={15} />
                </a>

                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-[11px] font-mono text-neutral-400">
                  Public Tunnel Endpoint: <code className="text-emerald-400">{publicUrl}/api/scanner/receive</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
