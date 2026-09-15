"use client";

import { useState, useMemo } from "react";
import PremiumQRCode from "@/components/onboard/PremiumQRCode";
import {
  IconQrcode,
  IconCopy,
  IconCheck,
  IconRefresh,
  IconExternalLink,
} from "@tabler/icons-react";

interface AdminZeroTouchProps {
  serverUrl: string;
  tunnelUrl: string;
  defaultGate: string;
}

export default function AdminZeroTouchSection({
  serverUrl,
  tunnelUrl,
  defaultGate,
}: AdminZeroTouchProps) {
  const [gateId, setGateId] = useState(defaultGate || "GATE-MAIN-01");
  const [gateName, setGateName] = useState("Main Ingress Gate 1");
  const [direction, setDirection] = useState<"IN" | "OUT" | "BIDIRECTIONAL">("IN");
  const [allowedTypes, setAllowedTypes] = useState<Array<"EMPLOYEE" | "CONTRACTOR" | "VEHICLE" | "KEY">>([
    "EMPLOYEE",
    "CONTRACTOR",
    "VEHICLE",
    "KEY",
  ]);
  const [deviceId, setDeviceId] = useState("Chainway-C66-01");
  const [copied, setCopied] = useState(false);
  const [authToken] = useState(() => `gate_sec_${Date.now().toString(16)}`);

  // Authoritative dual-compatible payload
  const payload = useMemo(
    () => ({
      version: 1,
      deviceId,
      baseUrl: serverUrl,
      serverUrl,
      tunnelUrl,
      token: authToken,
      authToken,
      gateProfile: {
        gateId,
        gateName,
        direction,
        allowedTypes,
      },
      timestamp: new Date().toISOString(),
    }),
    [deviceId, serverUrl, tunnelUrl, authToken, gateId, gateName, direction, allowedTypes]
  );

  const payloadString = JSON.stringify(payload, null, 2);
  const directScannerUrl = `${tunnelUrl}/scanner?link=true&device=${encodeURIComponent(
    deviceId
  )}&gateId=${encodeURIComponent(gateId)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(payloadString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleType = (type: "EMPLOYEE" | "CONTRACTOR" | "VEHICLE" | "KEY") => {
    setAllowedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="glass-card space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#007AFF]/20 text-[#007AFF] flex items-center justify-center border border-[#007AFF]/30 shrink-0">
            <IconQrcode size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Zero-Touch Android Scanner Setup (Chainway C66)
            </h2>
            <p className="text-xs text-neutral-400 font-mono">
              Scan this QR with a handheld Android terminal or Infowedge to auto-provision tunnel and gate profile.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDeviceId(`Chainway-C66-${Math.floor(10 + Math.random() * 90)}`)}
          className="min-h-[48px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-neutral-300 font-mono flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
        >
          <IconRefresh size={14} />
          <span>New Device ID</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* QR Code Column */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 rounded-2xl bg-white/5 border border-white/10 text-center space-y-4">
          <PremiumQRCode
            value={payloadString}
            title="Zero-Touch Scanner Profile"
            subtitle={`${deviceId} @ ${gateName}`}
          />
          <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Encrypted Zero-Touch Setup QR</span>
          </span>
          <div className="flex flex-col gap-2 w-full pt-1">
            <a
              href={directScannerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#007AFF] hover:underline font-mono inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#007AFF]/10 border border-[#007AFF]/20"
            >
              <span>Direct PWA Terminal Link</span>
              <IconExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* Configuration Controls Column */}
        <div className="lg:col-span-8 space-y-4 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Device ID */}
            <div>
              <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                Target Device Identifier
              </label>
              <input
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="w-full h-12 px-3 rounded-xl bg-black/60 border border-white/15 text-white focus:border-[#007AFF] focus:outline-none"
              />
            </div>

            {/* Gate Profile */}
            <div>
              <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                Assigned Gate Profile
              </label>
              <select
                value={gateId}
                onChange={(e) => {
                  setGateId(e.target.value);
                  if (e.target.value === "GATE-MAIN-01") setGateName("Main Ingress Gate 1");
                  else if (e.target.value === "GATE-HAUL-02") setGateName("Haulage Road Gate 2");
                  else if (e.target.value === "GATE-PIT-03") setGateName("Pit Perimeter Gate 3");
                  else setGateName("Custom Gate Portal");
                }}
                className="w-full h-12 px-3 rounded-xl bg-black/60 border border-white/15 text-white focus:border-[#007AFF] focus:outline-none"
              >
                <option value="GATE-MAIN-01">GATE-MAIN-01 (Main Ingress 1)</option>
                <option value="GATE-HAUL-02">GATE-HAUL-02 (Haulage Road 2)</option>
                <option value="GATE-PIT-03">GATE-PIT-03 (Pit Security Post)</option>
              </select>
            </div>
          </div>

          {/* Direction & Allowed Types */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                Gate Direction Control
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["IN", "OUT", "BIDIRECTIONAL"] as const).map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => setDirection(dir)}
                    className={`min-h-[48px] rounded-lg border text-xs font-bold transition cursor-pointer ${
                      direction === dir
                        ? "bg-[#007AFF] text-white border-[#007AFF]"
                        : "bg-black/40 text-neutral-400 border-white/10 hover:text-white"
                    }`}
                  >
                    {dir}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                Allowed Credential Types
              </label>
              <div className="flex flex-wrap gap-2">
                {(["EMPLOYEE", "CONTRACTOR", "VEHICLE", "KEY"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    className={`min-h-[48px] px-3 py-2 rounded-lg border text-[11px] font-bold transition cursor-pointer flex items-center ${
                      allowedTypes.includes(type)
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-black/40 text-neutral-500 border-white/10"
                    }`}
                  >
                    {allowedTypes.includes(type) ? "✓ " : ""}{type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Network Discovery Details */}
          <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-2 text-neutral-300">
            <div className="flex justify-between items-center">
              <span className="text-neutral-500">Cloudflare Ingress:</span>
              <code className="text-[#007AFF] truncate max-w-[280px]">{tunnelUrl}</code>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-500">Local LAN Fallback:</span>
              <code className="text-neutral-400">{serverUrl}</code>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-500">Security Token:</span>
              <code className="text-amber-400">{authToken.substring(0, 16)}...</code>
            </div>
          </div>

          {/* Quick Copy & Action */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[48px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-white flex items-center gap-2 transition cursor-pointer"
            >
              {copied ? <IconCheck size={16} className="text-emerald-400" /> : <IconCopy size={16} />}
              <span>{copied ? "Copied Provisioning JSON" : "Copy Setup Payload"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Operator Step-by-Step Instructions */}
      <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/10 space-y-2 text-xs">
        <h4 className="font-semibold text-white uppercase tracking-wider text-[11px] font-mono text-neutral-300">
          Handheld Scanner Onboarding Instructions (Chainway C66):
        </h4>
        <ol className="list-decimal list-inside space-y-1 text-neutral-400 font-mono text-[11px] leading-relaxed">
          <li>Launch the Scanner Terminal on the C66 or open Chrome to <code className="text-white">/scanner</code>.</li>
          <li>Aim the C66 hardware scanner or camera at the Zero-Touch QR code above.</li>
          <li>The device automatically saves the tunnel URL, sets the assigned gate profile, and arming state initiates.</li>
        </ol>
      </div>
    </div>
  );
}
