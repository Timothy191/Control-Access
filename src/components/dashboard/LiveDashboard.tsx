"use client";

import { useEffect, useState, useCallback } from "react";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useSite } from "@/components/layout/SiteContext";
import InteractiveStatCard from "./InteractiveStatCard";
import LiveScansTable from "./LiveScansTable";

interface ScanLog {
  id: number;
  access_type: string | null;
  entity_name: string | null;
  direction: string | null;
  access_granted: boolean;
  denial_reason: string | null;
  gate_location: string | null;
  scanned_at: string;
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
    <div className="space-y-8">
      {/* Live System Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-neutral-900/80 backdrop-blur-xl border border-white/10 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
          </span>
          <span className="text-xs font-semibold text-emerald-400 font-mono tracking-wider uppercase">
            Live Cloudflare Edge Sync • Connected
          </span>
        </div>
        <div className="text-xs text-neutral-400 font-mono">
          Auto-refresh: 3s {lastUpdated && `• Last sync: ${lastUpdated}`}
        </div>
      </div>

      {/* Compact Interactive KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Scans */}
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

        {/* Active Devices */}
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

        {/* Pending Approvals */}
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

        {/* Muster Count */}
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

      {/* Live Access Scans - Professional Grid & Table */}
      <LiveScansTable
        scans={stats.recentScans || []}
        onRefresh={fetchStats}
        lastSync={lastUpdated}
      />

      {/* Telemetry & Hardware Edge Stream */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-[#141418]/85 backdrop-blur-2xl shadow-xl flex flex-col font-mono text-xs">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <h3 className="font-semibold text-xs sm:text-sm text-white uppercase tracking-wider">
              Telemetry & Hardware Edge Stream
            </h3>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>SSE Stream Active • TCP 8080/9100</span>
          </div>
        </div>
        <div className="p-4 max-h-56 overflow-auto space-y-2">
          {telemetry && telemetry.length > 0 ? (
            telemetry.map((event, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-gray-300 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
              >
                <span>
                  [{event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : "Live"}] Type:{" "}
                  <span className="text-cyan-400">{event.type || "heartbeat"}</span>
                </span>
                <span className="text-emerald-400 font-medium">TCP Connections: {event.activeTCP ?? 1}</span>
              </div>
            ))
          ) : (
            <div className="py-8 flex flex-col items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyan-400 border-t-transparent" />
              <p className="text-neutral-500 text-xs">Streaming live hardware events from C66 & IoT gateways...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
