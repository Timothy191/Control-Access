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
import { 
  IconShieldCheck, 
  IconActivity, 
  IconBuildingSkyscraper, 
  IconQrcode, 
  IconChevronRight, 
  IconFileCheck,
  IconCpu,
  IconUsers
} from "@tabler/icons-react";
import Link from "next/link";

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
  const { selectedSite, siteInfo } = useSite();

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
    <div className="max-w-7xl 2xl:max-w-screen-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-3 space-y-6">
      {/* Executive Command Strip: Incident Control & Shift Telemetry */}
      <OperationalCommandStrip
        selectedSite={selectedSite}
        musterCount={stats.musterCount}
        lastUpdated={lastUpdated}
        onRefresh={fetchStats}
      />

      {/* Executive KPI Bento Grid with Geospatial Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Bento Stats Grid - 8 Cols */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InteractiveStatCard
            id="total-scans"
            title="Total Access Scans"
            value={stats.totalScans}
            label="Verified ingress/egress transactions"
            iconSrc="/assets/icons/stat-scans.svg"
            accentColor="#10B981"
            gradientFrom="#10B981"
            badgeText="Audited"
          />

          <InteractiveStatCard
            id="active-devices"
            title="Active Hardware Nodes"
            value={stats.activeDevices}
            label="C66 mobile & stationary turnstiles"
            iconSrc="/assets/icons/stat-devices.svg"
            accentColor="#2563EB"
            gradientFrom="#2563EB"
            badgeText="Online"
          />

          <InteractiveStatCard
            id="pending-approvals"
            title="Supervisory Approvals"
            value={stats.pendingApprovals}
            label="Awaiting biometric & gate signoff"
            iconSrc="/assets/icons/stat-approvals.svg"
            accentColor="#F59E0B"
            gradientFrom="#F59E0B"
            badgeText="Action Req"
          />

          <InteractiveStatCard
            id="muster-count"
            title="Perimeter Headcount"
            value={stats.musterCount}
            label="Active workforce inside boundary"
            iconSrc="/assets/icons/stat-muster.svg"
            accentColor="#8B5CF6"
            gradientFrom="#8B5CF6"
            badgeText="Muster"
          />
        </div>

        {/* 3D Digital Rotating Globe Telemetry - 4 Cols */}
        <div className="lg:col-span-4 flex">
          <DigitalGlobeTelemetry
            recentScans={stats.recentScans}
            totalScans={stats.totalScans}
          />
        </div>
      </div>

      {/* Corporate Kiosk Quick Launch & Operational Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/scanner"
          className="corporate-card p-4 flex items-center justify-between group hover:border-blue-500/40 transition-all min-h-[48px]"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <IconQrcode size={22} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">
                Scanner Terminal
              </h4>
              <p className="text-xs text-slate-400">High-speed QR &amp; RFID barcode kiosk</p>
            </div>
          </div>
          <IconChevronRight size={18} className="text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
        </Link>

        <Link
          href="/approvals"
          className="corporate-card p-4 flex items-center justify-between group hover:border-amber-500/40 transition-all min-h-[48px]"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
              <IconFileCheck size={22} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
                Authorizations
              </h4>
              <p className="text-xs text-slate-400">Supervisor custody &amp; medical clearances</p>
            </div>
          </div>
          <IconChevronRight size={18} className="text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
        </Link>

        <Link
          href="/onboard/scanner"
          className="corporate-card p-4 flex items-center justify-between group hover:border-emerald-500/40 transition-all min-h-[48px]"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
              <IconCpu size={22} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                Zero-Touch Provisioning
              </h4>
              <p className="text-xs text-slate-400">Instant QR config for Chainway C66 fleet</p>
            </div>
          </div>
          <IconChevronRight size={18} className="text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>

      {/* C66 Scanner Fleet Hub */}
      <ScannerFleetHub />

      {/* Real-Time Access Audit Ledger */}
      <LiveScansTable
        scans={stats.recentScans || []}
        onRefresh={fetchStats}
        lastSync={lastUpdated}
      />
    </div>
  );
}
