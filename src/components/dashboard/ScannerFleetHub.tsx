"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  IconDeviceMobile,
  IconWifi,
  IconCloud,
  IconRefresh,
  IconCheck,
  IconAlertCircle,
  IconBattery4,
  IconScan,
  IconChevronRight,
  IconShieldCheck,
} from "@tabler/icons-react";

interface DeviceRecord {
  id: number;
  device_name: string;
  device_type: string | null;
  mac_address: string | null;
  ip_address: string | null;
  last_seen: string;
  status: string;
  total_scans: number;
  isOnline: boolean;
  minutesAgo: number;
  formattedLastSeen: string;
  connectionMode: "LAN" | "TUNNEL";
  batteryEstimate: number;
}

export default function ScannerFleetHub() {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  const fetchFleetStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/devices");
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      }
    } catch (err) {
      console.error("Failed to load scanner fleet:", err);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }
  };

  useEffect(() => {
    fetchFleetStatus();
    const interval = setInterval(fetchFleetStatus, 15000); // 15s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const onlineDevices = devices.filter((d) => d.isOnline);

  return (
    <div className="rounded-2xl bg-[#18181b]/80 border border-white/10 p-4 sm:p-6 backdrop-blur-2xl shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#007AFF]/20 border border-[#007AFF]/30 text-[#007AFF]">
            <IconDeviceMobile size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white font-mono tracking-tight">
                C66 Scanner Fleet &amp; Hardware Telemetry
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{onlineDevices.length} / {devices.length} Online</span>
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-mono mt-0.5">
              Real-time hardware status, SSE stream connections, and gate terminals.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchFleetStatus}
            disabled={loading}
            className="touch-target-industrial min-h-[48px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.98] text-xs font-mono font-semibold text-neutral-300 flex items-center gap-2 transition border border-white/10 cursor-pointer disabled:opacity-50"
            title="Refresh Telemetry"
          >
            <IconRefresh size={16} className={loading ? "animate-spin text-[#007AFF]" : "text-neutral-400"} />
            <span className="hidden sm:inline">{loading ? "Syncing..." : "Refresh"}</span>
          </button>

          <Link
            href="/onboard/scanner"
            className="touch-target-industrial min-h-[48px] px-4 py-2 rounded-xl bg-[#007AFF] hover:bg-[#0A84FF] active:scale-[0.98] text-xs font-mono font-bold text-white flex items-center gap-2 transition shadow-md"
          >
            <IconScan size={16} />
            <span>Zero-Touch Onboarding</span>
            <IconChevronRight size={14} />
          </Link>
        </div>
      </div>

      {/* Fleet Cards Grid */}
      {devices.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-white/5 border border-white/5 font-mono text-xs text-neutral-400 space-y-2">
          <IconAlertCircle size={24} className="mx-auto text-amber-400" />
          <p>No mobile or stationary scanners currently registered in database.</p>
          <p className="text-[11px] text-neutral-500">Scan the Zero-Touch QR Code on an Android Chainway C66 device to auto-provision.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {devices.map((device) => (
            <div
              key={device.id}
              className={`p-3.5 rounded-xl border transition-all ${
                device.isOnline
                  ? "bg-neutral-900/90 border-emerald-500/30 hover:border-emerald-500/50"
                  : "bg-neutral-900/50 border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      device.isOnline ? "bg-emerald-400 animate-pulse" : "bg-neutral-500"
                    }`}
                  />
                  <span className="text-xs font-mono font-bold text-white truncate">
                    {device.device_name}
                  </span>
                </div>

                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono border ${
                    device.connectionMode === "LAN"
                      ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                      : "bg-orange-500/10 text-orange-300 border-orange-500/30"
                  }`}
                >
                  {device.connectionMode === "LAN" ? <IconWifi size={11} /> : <IconCloud size={11} />}
                  <span>{device.connectionMode}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono text-neutral-400">
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="text-neutral-200">{device.device_type || "Chainway C66"}</span>
                </div>
                <div className="flex justify-between">
                  <span>IP / Endpoint:</span>
                  <span className="text-neutral-300">{device.ip_address || "127.0.0.1 (Tunnel)"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Scans:</span>
                  <span className="text-amber-400 font-bold">{device.total_scans.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-white/5 text-[10px]">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <IconBattery4 size={12} />
                    <span>~{device.batteryEstimate}% Bat</span>
                  </span>
                  <span className="text-neutral-500">Last Seen: {device.formattedLastSeen}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Meta */}
      <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 pt-2 border-t border-white/5">
        <span className="flex items-center gap-1 text-emerald-400/80">
          <IconShieldCheck size={13} />
          <span>Cloudflare SSE Tunnel Push Active</span>
        </span>
        {lastRefreshed && <span>Auto-refreshed: {lastRefreshed}</span>}
      </div>
    </div>
  );
}
