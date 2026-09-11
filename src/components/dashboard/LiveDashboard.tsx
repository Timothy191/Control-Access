"use client";

import { useEffect, useState, useCallback } from "react";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useSite } from "@/components/layout/SiteContext";
import InteractiveStatCard from "./InteractiveStatCard";
import LiveScansTable from "./LiveScansTable";
import OperationalCommandStrip from "./OperationalCommandStrip";

interface ScanLog {
  id: number;
  access_type: string | null;
  entity_name: string | null;
  direction: string | null;
  access_granted: boolean;
  denial_reason: string | null;
  gate_location: string | null;
  scanned_at: string;
  qr_data?: string | null;
  parsed_qr_data?: string | null;
}

interface DashboardStats {
  totalScans: number;
  activeDevices: number;
  pendingApprovals: number;
  musterCount: number;
  recentScans: ScanLog[];
  updatedAt: string;
}

export default function LiveDashboard({
  initialStats,
}: {
  initialStats: DashboardStats;
}) {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const telemetry = useTelemetry();
  const { selectedSite } = useSite();

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/stats?site=${encodeURIComponent(selectedSite)}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Failed to refresh live stats:", err);
    }
  }, [selectedSite]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStats();
    }, 0);
    // Auto-update live system every 3 seconds
    const interval = setInterval(fetchStats, 3000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [fetchStats]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Operational Command Strip */}
      <div className="lg:col-span-12">
        <OperationalCommandStrip
          selectedSite={selectedSite}
          musterCount={stats.musterCount}
          lastUpdated={lastUpdated}
          onRefresh={fetchStats}
        />
      </div>

      {/* Bento Stats Grid */}
      <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <InteractiveStatCard
              id="total-scans"
              title="Total Scans"
              value={stats.totalScans}
              label="Real-time DB telemetry"
              iconSrc="/assets/icons/stat-scans.svg"
              accentColor="#30D158"
              gradientFrom="#30D158"
              badgeText="Active"
            />

        <InteractiveStatCard
              id="active-devices"
              title="Active Devices"
              value={stats.activeDevices}
              label="Gateways & C66 nodes"
              iconSrc="/assets/icons/stat-devices.svg"
              accentColor="#007AFF"
              gradientFrom="#007AFF"
              badgeText="Online"
            />

        <InteractiveStatCard
              id="pending-approvals"
              title="Approvals"
              value={stats.pendingApprovals}
              label="Awaiting supervisor"
              iconSrc="/assets/icons/stat-approvals.svg"
              accentColor="#FFD60A"
              gradientFrom="#FFD60A"
              badgeText="Pending"
            />

        <InteractiveStatCard
              id="muster-count"
              title="Muster Count"
              value={stats.musterCount}
              label="Inside perimeter"
              iconSrc="/assets/icons/stat-muster.svg"
              accentColor="#BF5AF2"
              gradientFrom="#BF5AF2"
              badgeText="On-Site"
            />
      </div>

      {/* Telemetry & Hardware Edge Stream */}
      <div className="lg:col-span-4 flex flex-col h-full relative rounded-2xl bg-black/40 p-[1px] overflow-hidden group/telemetry">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-transparent to-transparent opacity-0 group-hover/telemetry:opacity-100 transition-opacity duration-700" />
        <div className="relative h-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141418]/85 backdrop-blur-3xl shadow-xl flex flex-col font-mono text-xs">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
          <div className="p-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2 bg-black/20">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <h3 className="font-semibold text-xs text-white uppercase tracking-wider">
                Telemetry Stream
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>TCP 8080</span>
            </div>
          </div>
          <div className="p-4 overflow-auto space-y-2 flex-1 min-h-[250px]">
            {telemetry && telemetry.length > 0 ? (
              telemetry.map((event, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-black/40 border border-white/[0.04] text-gray-300 flex items-center justify-between hover:bg-white/[0.04] transition-all duration-300 hover:scale-[1.02] hover:border-white/10"
                >
                  <span className="flex flex-col">
                    <span className="text-[10px] text-neutral-500 mb-0.5">
                      {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : "Live"}
                    </span>
                    <span className="text-cyan-400">{event.type || "heartbeat"}</span>
                  </span>
                  <span className="text-emerald-400 font-medium text-right flex flex-col items-end">
                    <span className="text-[10px] text-neutral-500 mb-0.5">TCP Conn</span>
                    <span>{event.activeTCP ?? 1}</span>
                  </span>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-cyan-400 border-t-transparent shadow-[0_0_12px_rgba(34,211,238,0.3)]" />
                <p className="text-neutral-500 text-xs text-center px-4 leading-relaxed">
                  Streaming live hardware events from C66 & IoT gateways...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Access Scans - Premium QR Aesthetic Quick Action included */}
      <div className="lg:col-span-12 space-y-4">
        {/* QR Code Scan Quick Action Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-[#141418]/85 backdrop-blur-2xl shadow-xl flex items-center justify-between p-4 group">
          <div className="absolute inset-0 bg-gradient-to-r from-[#007AFF]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] relative group-hover:border-[#007AFF]/50 transition-colors">
               <div className="absolute inset-0 rounded-xl bg-[#007AFF] opacity-0 group-hover:opacity-20 blur-md transition-opacity" />
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                 <rect x="3" y="3" width="7" height="7" rx="1"/>
                 <rect x="14" y="3" width="7" height="7" rx="1"/>
                 <rect x="14" y="14" width="7" height="7" rx="1"/>
                 <rect x="3" y="14" width="7" height="7" rx="1"/>
                 <path d="M7 7h.01M18 7h.01M7 18h.01M18 18h.01M3 11h18M11 3v18"/>
               </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">QR Scanner Portal</h3>
              <p className="text-xs text-neutral-400 mt-0.5">Quickly verify visitor or employee QR credentials</p>
            </div>
          </div>
          <a
            href="/scanner"
            className="relative z-10 px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-medium text-white transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] flex items-center gap-2 hover:scale-[1.02] active:scale-95"
          >
            Open Scanner
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
        </div>

        <LiveScansTable
          scans={stats.recentScans || []}
          onRefresh={fetchStats}
          lastSync={lastUpdated}
        />
      </div>
    </div>
  );
}
