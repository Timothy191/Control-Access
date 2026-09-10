"use client";

import { useEffect, useState, useCallback } from "react";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useSite } from "@/components/layout/SiteContext";

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

      {/* Elevated KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Scans */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0e]/85 p-5 backdrop-blur-xl shadow-lg transition-all duration-200 hover:border-white/25 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
          <div className="flex items-center justify-between">
            <h3 className="text-neutral-400 text-xs font-medium uppercase tracking-wider font-mono">Total Scans</h3>
            <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
          </div>
          <p className="text-3xl font-bold mt-2.5 text-white tracking-tight">{stats.totalScans.toLocaleString()}</p>
          <span className="text-[11px] text-emerald-400/90 font-mono mt-1.5 inline-flex items-center gap-1">
            <span>●</span> Real-time DB telemetry
          </span>
        </div>

        {/* Active Devices */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0e]/85 p-5 backdrop-blur-xl shadow-lg transition-all duration-200 hover:border-white/25 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
          <div className="flex items-center justify-between">
            <h3 className="text-neutral-400 text-xs font-medium uppercase tracking-wider font-mono">Active Devices</h3>
            <span className="h-2 w-2 rounded-full bg-cyan-400/80" />
          </div>
          <p className="text-3xl font-bold mt-2.5 text-white tracking-tight">{stats.activeDevices.toLocaleString()}</p>
          <span className="text-[11px] text-cyan-400/90 font-mono mt-1.5 inline-flex items-center gap-1">
            <span>●</span> Online Gateways & C66
          </span>
        </div>

        {/* Pending Approvals */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0e]/85 p-5 backdrop-blur-xl shadow-lg transition-all duration-200 hover:border-white/25 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
          <div className="flex items-center justify-between">
            <h3 className="text-neutral-400 text-xs font-medium uppercase tracking-wider font-mono">Pending Approvals</h3>
            <span className="h-2 w-2 rounded-full bg-amber-400/80" />
          </div>
          <p className="text-3xl font-bold mt-2.5 text-white tracking-tight">{stats.pendingApprovals.toLocaleString()}</p>
          <span className="text-[11px] text-amber-400/90 font-mono mt-1.5 inline-flex items-center gap-1">
            <span>●</span> Awaiting Supervisor
          </span>
        </div>

        {/* Muster Count */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0e]/85 p-5 backdrop-blur-xl shadow-lg transition-all duration-200 hover:border-white/25 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />
          <div className="flex items-center justify-between">
            <h3 className="text-neutral-400 text-xs font-medium uppercase tracking-wider font-mono">Muster Count</h3>
            <span className="h-2 w-2 rounded-full bg-purple-400/80" />
          </div>
          <p className="text-3xl font-bold mt-2.5 text-white tracking-tight">{stats.musterCount.toLocaleString()}</p>
          <span className="text-[11px] text-purple-400/90 font-mono mt-1.5 inline-flex items-center gap-1">
            <span>●</span> Inside Perimeter
          </span>
        </div>
      </div>

      {/* Real-time Activity Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Scans Table */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0e]/85 backdrop-blur-xl shadow-lg flex flex-col h-[420px]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-neutral-200 uppercase tracking-wider font-mono">Live Access Scans</h2>
            <span className="text-xs font-mono text-neutral-400">Latest 10 logs</span>
          </div>
          <div className="p-4 flex-1 overflow-auto">
            {stats.recentScans && stats.recentScans.length > 0 ? (
              <div className="space-y-2">
                {stats.recentScans.map((scan) => (
                  <div
                    key={scan.id}
                    className="p-3 rounded-lg bg-black/20 border border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-white">
                          {scan.entity_name || "Unknown Entity"}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-300 font-mono">
                          {scan.direction || "SCAN"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {scan.gate_location || "Main Gate"} &bull; {new Date(scan.scanned_at).toLocaleTimeString()}
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        scan.access_granted
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {scan.access_granted ? "GRANTED" : scan.denial_reason || "DENIED"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-500">No recent scans recorded</p>
              </div>
            )}
          </div>
        </div>

        {/* Telemetry Stream */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0e]/85 backdrop-blur-xl shadow-lg flex flex-col h-[420px]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-neutral-200 uppercase tracking-wider font-mono">Telemetry & Edge Stream</h2>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>SSE Stream Active</span>
            </div>
          </div>
          <div className="p-4 flex-1 overflow-auto space-y-2 font-mono text-xs">
            {telemetry && telemetry.length > 0 ? (
              telemetry.map((event, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-black/40 border border-white/5 text-gray-300 flex items-center justify-between"
                >
                  <span>
                    [{event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : "Live"}] Type: {event.type || "heartbeat"}
                  </span>
                  <span className="text-emerald-400">TCP: {event.activeTCP ?? 1}</span>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-400 border-t-transparent"></div>
                <p className="text-gray-400 text-sm">Streaming live hardware events...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
