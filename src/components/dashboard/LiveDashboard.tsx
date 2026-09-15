"use client";

import { useEffect, useState, useCallback } from "react";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useScanEvents } from "@/hooks/useScanEvents";
import { useSite } from "@/components/layout/SiteContext";
import InteractiveStatCard from "./InteractiveStatCard";
import LiveScansTable from "./LiveScansTable";
import OperationalCommandStrip from "./OperationalCommandStrip";
import ScannerFleetHub from "./ScannerFleetHub";
import DigitalGlobeTelemetry from "./DigitalGlobeTelemetry";

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

  // Zero-latency real-time push: whenever a C66 scanner or RFID gate reads a tag, refresh PC screen immediately
  useScanEvents({
    deviceId: "ALL",
    onScanEvent: () => {
      fetchStats();
    },
    onKeyCustodyEvent: () => {
      fetchStats();
    },
    onAlert: () => {
      fetchStats();
    },
  });

  return (
    <div className="max-w-7xl 2xl:max-w-screen-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-2">
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

      {/* 3D Digital Rotating Globe Telemetry with Scan Pins */}
      <DigitalGlobeTelemetry
        recentScans={stats.recentScans}
        totalScans={stats.totalScans}
      />

      {/* Live Access Scans - Premium QR Aesthetic Quick Action included */}
      <div className="lg:col-span-12 space-y-4">
        {/* QR Code Scan Quick Action Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 hover:border-white/20 bg-[#141418]/80 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.36)] flex items-center justify-between p-4 sm:p-5 group transition-all duration-200">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
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
            className="relative z-10 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-medium text-white transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] flex items-center gap-2 hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            Open Scanner
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
        </div>

        {/* C66 Scanner Fleet Telemetry Hub */}
        <ScannerFleetHub />

        <LiveScansTable
          scans={stats.recentScans || []}
          onRefresh={fetchStats}
          lastSync={lastUpdated}
        />
      </div>
    </div>
  </div>
);
}
