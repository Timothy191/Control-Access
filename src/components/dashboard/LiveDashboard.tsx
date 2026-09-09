"use client";

import { useEffect, useState } from "react";
import { useTelemetry } from "@/hooks/useTelemetry";

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

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/dashboard/stats", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Failed to refresh live stats:", err);
    }
  };

  useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString());
    // Auto-update live system every 2.5 seconds
    const interval = setInterval(fetchStats, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      {/* Live System Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">
            Live Cloudflare Edge Sync
          </span>
        </div>
        <div className="text-xs text-gray-400 font-mono">
          Auto-refresh: 2.5s {lastUpdated && `| Last sync: ${lastUpdated}`}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 transition-all hover:bg-white/[0.12]">
          <h3 className="text-gray-400 text-sm font-medium">Total Scans</h3>
          <p className="text-3xl font-bold mt-2 text-white">{stats.totalScans.toLocaleString()}</p>
          <span className="text-xs text-emerald-400 mt-1 inline-block">Real-time DB count</span>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 transition-all hover:bg-white/[0.12]">
          <h3 className="text-gray-400 text-sm font-medium">Active Devices</h3>
          <p className="text-3xl font-bold mt-2 text-white">{stats.activeDevices.toLocaleString()}</p>
          <span className="text-xs text-cyan-400 mt-1 inline-block">Online Gateways</span>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 transition-all hover:bg-white/[0.12]">
          <h3 className="text-gray-400 text-sm font-medium">Pending Approvals</h3>
          <p className="text-3xl font-bold mt-2 text-white">{stats.pendingApprovals.toLocaleString()}</p>
          <span className="text-xs text-amber-400 mt-1 inline-block">Awaiting Review</span>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 transition-all hover:bg-white/[0.12]">
          <h3 className="text-gray-400 text-sm font-medium">Muster Count</h3>
          <p className="text-3xl font-bold mt-2 text-white">{stats.musterCount.toLocaleString()}</p>
          <span className="text-xs text-purple-400 mt-1 inline-block">Inside Perimeter</span>
        </div>
      </div>

      {/* Real-time Activity Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Scans Table */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 flex flex-col h-[420px] overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-semibold text-lg">Live Access Scans</h2>
            <span className="text-xs font-mono text-gray-400">Latest 10 logs</span>
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
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 flex flex-col h-[420px] overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-semibold text-lg">Telemetry & Edge Stream</h2>
            <span className="text-xs text-emerald-400 font-mono">SSE Stream Active</span>
          </div>
          <div className="p-4 flex-1 overflow-auto space-y-2 font-mono text-xs">
            {telemetry && telemetry.length > 0 ? (
              telemetry.map((event, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-black/40 border border-white/5 text-gray-300 flex items-center justify-between"
                >
                  <span>
                    [{new Date(event.timestamp || Date.now()).toLocaleTimeString()}] Type: {event.type || "heartbeat"}
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
