"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import {
  IconSearch,
  IconFilter,
  IconCalendar,
  IconClock,
  IconDownload,
  IconRefresh,
  IconUser,
  IconTruck,
  IconRadio,
  IconShieldX,
  IconShieldCheck,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconEye,
  IconX,
  IconDeviceMobile,
  IconSun,
  IconMoon,
  IconAlertTriangle,
} from "@tabler/icons-react";

export interface LogItem {
  id: number;
  access_type: string;
  entity_id: number | null;
  entity_name: string;
  direction: string;
  access_granted: boolean;
  denial_reason: string | null;
  gate_location: string;
  scanned_by: string;
  scanned_at: string | Date;
  day_of_week?: string;
  date?: string;
  time?: string;
  shift?: string;
  qr_data?: string | null;
  employee?: {
    id: number;
    emp_code: string;
    name: string;
    job_title: string | null;
    area: string | null;
    status: string;
    photo: string | null;
  } | null;
  vehicle?: {
    id: number;
    fleet_id: string;
    status: string | null;
  } | null;
  visitor?: {
    id: number;
    name: string;
    company: string | null;
    purpose: string | null;
  } | null;
  equipment?: {
    id: number;
    radio_id: string;
  } | null;
  raw_meta?: Record<string, unknown>;
}

interface AccessLogsExplorerProps {
  initialLogs: LogItem[];
  siteFilter?: string;
}

export default function AccessLogsExplorer({
  initialLogs,
  siteFilter,
}: AccessLogsExplorerProps) {
  const [logs, setLogs] = useState<LogItem[]>(initialLogs);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState<
    "all" | "employee" | "vehicle" | "visitor" | "equipment" | "denied"
  >("all");
  const [directionFilter, setDirectionFilter] = useState<"all" | "IN" | "OUT">("all");
  const [dateQuickFilter, setDateQuickFilter] = useState<"all" | "today" | "yesterday" | "custom">("all");
  const [customDate, setCustomDate] = useState("");
  const [shiftFilter, setShiftFilter] = useState<"all" | "Day Shift" | "Night Shift">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "granted" | "denied">("all");
  const [isolatedEntity, setIsolatedEntity] = useState<string | null>(null);

  // Modal inspection
  const [inspectedLog, setInspectedLog] = useState<LogItem | null>(null);

  // Refresh logs from API
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/logs?limit=200", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.logs) {
          setLogs(data.logs);
        }
      }
    } catch (err) {
      console.error("Failed to refresh logs:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Filtered dataset
  const filteredLogs = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yesterdayStr = yest.toISOString().split("T")[0];

    return logs.filter((log) => {
      // 1. Isolated individual entity
      if (isolatedEntity) {
        const matchesEntity =
          log.entity_name.toLowerCase().includes(isolatedEntity.toLowerCase()) ||
          log.employee?.emp_code?.toLowerCase() === isolatedEntity.toLowerCase() ||
          log.vehicle?.fleet_id?.toLowerCase() === isolatedEntity.toLowerCase();
        if (!matchesEntity) return false;
      }

      // 2. Entity type filter
      if (entityTypeFilter === "denied") {
        if (log.access_granted) return false;
      } else if (entityTypeFilter !== "all") {
        if (log.access_type.toLowerCase() !== entityTypeFilter.toLowerCase()) return false;
      }

      // 3. Status filter
      if (statusFilter === "granted" && !log.access_granted) return false;
      if (statusFilter === "denied" && log.access_granted) return false;

      // 4. Direction filter
      if (directionFilter !== "all") {
        if ((log.direction || "").toUpperCase() !== directionFilter) return false;
      }

      // 5. Shift filter
      if (shiftFilter !== "all") {
        const logShift = log.shift || (new Date(log.scanned_at).getHours() >= 6 && new Date(log.scanned_at).getHours() < 18 ? "Day Shift" : "Night Shift");
        if (logShift !== shiftFilter) return false;
      }

      // 6. Day / Date filter
      const logDateStr =
        log.date ||
        (log.scanned_at ? new Date(log.scanned_at).toISOString().split("T")[0] : "");

      if (dateQuickFilter === "today" && logDateStr !== todayStr) return false;
      if (dateQuickFilter === "yesterday" && logDateStr !== yesterdayStr) return false;
      if (dateQuickFilter === "custom" && customDate && logDateStr !== customDate) return false;

      // 7. Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesSearch =
          log.entity_name.toLowerCase().includes(q) ||
          (log.employee?.emp_code && log.employee.emp_code.toLowerCase().includes(q)) ||
          (log.vehicle?.fleet_id && log.vehicle.fleet_id.toLowerCase().includes(q)) ||
          (log.visitor?.company && log.visitor.company.toLowerCase().includes(q)) ||
          (log.gate_location && log.gate_location.toLowerCase().includes(q)) ||
          (log.scanned_by && log.scanned_by.toLowerCase().includes(q)) ||
          (log.qr_data && log.qr_data.toLowerCase().includes(q)) ||
          (log.denial_reason && log.denial_reason.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [
    logs,
    isolatedEntity,
    entityTypeFilter,
    statusFilter,
    directionFilter,
    shiftFilter,
    dateQuickFilter,
    customDate,
    search,
  ]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let granted = 0;
    let denied = 0;
    const employeeSet = new Set<string>();
    const vehicleSet = new Set<string>();

    filteredLogs.forEach((l) => {
      if (l.access_granted) granted++;
      else denied++;

      if (l.access_type === "employee" && l.entity_id) {
        employeeSet.add(`emp_${l.entity_id}`);
      } else if (l.access_type === "vehicle" && l.entity_id) {
        vehicleSet.add(`veh_${l.entity_id}`);
      }
    });

    return {
      total: filteredLogs.length,
      granted,
      denied,
      uniqueEmployees: employeeSet.size,
      uniqueVehicles: vehicleSet.size,
    };
  }, [filteredLogs]);

  // Export filtered logs to CSV
  const handleExportCsv = () => {
    const headers = [
      "Log ID",
      "Timestamp",
      "Day of Week",
      "Date",
      "Time",
      "Shift",
      "Entity Type",
      "Entity Name",
      "Entity Code",
      "Direction",
      "Access Status",
      "Denial Reason",
      "Gate Location",
      "Scanned By / Device",
      "Credential Tag",
    ];

    const rows = filteredLogs.map((l) => {
      const d = l.scanned_at ? new Date(l.scanned_at) : new Date();
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayOfWeek = l.day_of_week || dayNames[d.getDay()];
      const dateStr = l.date || d.toISOString().split("T")[0];
      const timeStr = l.time || d.toLocaleTimeString();
      const shiftStr = l.shift || (d.getHours() >= 6 && d.getHours() < 18 ? "Day Shift" : "Night Shift");
      const code = l.employee?.emp_code || l.vehicle?.fleet_id || l.equipment?.radio_id || "-";

      return [
        l.id,
        d.toISOString(),
        dayOfWeek,
        dateStr,
        timeStr,
        shiftStr,
        l.access_type,
        `"${l.entity_name.replace(/"/g, '""')}"`,
        code,
        l.direction,
        l.access_granted ? "GRANTED" : "DENIED",
        l.denial_reason ? `"${l.denial_reason.replace(/"/g, '""')}"` : "",
        `"${l.gate_location.replace(/"/g, '""')}"`,
        `"${l.scanned_by.replace(/"/g, '""')}"`,
        `"${(l.qr_data || "").replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `access_logs_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Export Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Access Scans &amp; Audit Logs
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#007AFF]/15 text-[#0A84FF] border border-[#007AFF]/30">
              Live Gateway DB
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Tracking individual employees, vehicles, visitors, and assets by day, date, gate portal, and shift.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {siteFilter && (
            <span className="text-xs font-mono text-neutral-400 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
              Site: <strong className="text-white">{siteFilter}</strong>
            </span>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-neutral-200 transition cursor-pointer"
          >
            <IconRefresh size={14} className={isRefreshing ? "animate-spin text-[#007AFF]" : ""} />
            <span>{isRefreshing ? "Refreshing..." : "Sync Logs"}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#007AFF] hover:bg-[#0A84FF] active:scale-[0.98] text-white text-xs font-semibold shadow-md transition cursor-pointer"
          >
            <IconDownload size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-[#18181b]/80 border border-white/10 backdrop-blur-xl space-y-1">
          <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
            Total Scans
          </span>
          <div className="text-xl font-bold font-mono text-white">
            {metrics.total}
          </div>
          <span className="text-[10px] text-neutral-500">In filtered view</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#18181b]/80 border border-emerald-500/20 backdrop-blur-xl space-y-1">
          <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider block">
            Granted
          </span>
          <div className="text-xl font-bold font-mono text-emerald-300">
            {metrics.granted}
          </div>
          <span className="text-[10px] text-emerald-500/80">Authorized entries</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#18181b]/80 border border-red-500/20 backdrop-blur-xl space-y-1">
          <span className="text-[11px] font-mono text-red-400 uppercase tracking-wider block">
            Denied / Strobe
          </span>
          <div className="text-xl font-bold font-mono text-red-300">
            {metrics.denied}
          </div>
          <span className="text-[10px] text-red-500/80">Security rejections</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#18181b]/80 border border-[#007AFF]/20 backdrop-blur-xl space-y-1">
          <span className="text-[11px] font-mono text-[#007AFF] uppercase tracking-wider block">
            Employees
          </span>
          <div className="text-xl font-bold font-mono text-blue-300">
            {metrics.uniqueEmployees}
          </div>
          <span className="text-[10px] text-blue-500/80">Individual staff active</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#18181b]/80 border border-purple-500/20 backdrop-blur-xl space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[11px] font-mono text-purple-400 uppercase tracking-wider block">
            Fleet / Vehicles
          </span>
          <div className="text-xl font-bold font-mono text-purple-300">
            {metrics.uniqueVehicles}
          </div>
          <span className="text-[10px] text-purple-500/80">Unique units logged</span>
        </div>
      </div>

      {/* Filter Toolbar (macOS Glassmorphic Console) */}
      <div className="rounded-2xl border border-white/10 bg-[#18181b]/85 backdrop-blur-2xl p-4 space-y-3.5 shadow-xl">
        {/* Row 1: Entity Type Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-black/50 border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setEntityTypeFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                entityTypeFilter === "all"
                  ? "bg-white/15 text-white font-semibold shadow-xs"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              All Entities
            </button>

            <button
              type="button"
              onClick={() => setEntityTypeFilter("employee")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                entityTypeFilter === "employee"
                  ? "bg-[#007AFF]/20 text-[#0A84FF] border border-[#007AFF]/30 font-semibold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <IconUser size={14} />
              <span>Employees</span>
            </button>

            <button
              type="button"
              onClick={() => setEntityTypeFilter("vehicle")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                entityTypeFilter === "vehicle"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <IconTruck size={14} />
              <span>Vehicles / Fleet</span>
            </button>

            <button
              type="button"
              onClick={() => setEntityTypeFilter("visitor")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                entityTypeFilter === "visitor"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <IconUser size={14} />
              <span>Visitors</span>
            </button>

            <button
              type="button"
              onClick={() => setEntityTypeFilter("equipment")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                entityTypeFilter === "equipment"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <IconRadio size={14} />
              <span>Equipment</span>
            </button>

            <button
              type="button"
              onClick={() => setEntityTypeFilter("denied")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                entityTypeFilter === "denied"
                  ? "bg-red-500/20 text-red-300 border border-red-500/30 font-semibold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <IconShieldX size={14} />
              <span>Denied / Violations</span>
            </button>
          </div>

          {/* Active Entity Isolation Pill */}
          {isolatedEntity && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#007AFF]/20 border border-[#007AFF]/40 text-[#0A84FF] text-xs font-mono">
              <span>Isolated: <strong>{isolatedEntity}</strong></span>
              <button
                type="button"
                onClick={() => setIsolatedEntity(null)}
                className="hover:text-white cursor-pointer"
                title="Clear filter"
              >
                <IconX size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Row 2: Day, Date, Shift & Search Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
          {/* Day / Date Quick Picker */}
          <div>
            <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <IconCalendar size={12} />
              <span>Day / Date Filter</span>
            </label>
            <div className="flex gap-1">
              <select
                value={dateQuickFilter}
                onChange={(e) =>
                  setDateQuickFilter(
                    e.target.value as "all" | "today" | "yesterday" | "custom"
                  )
                }
                className="flex-1 h-9 rounded-lg bg-black/60 border border-white/15 px-2.5 text-xs text-white focus:border-[#007AFF] focus:outline-none"
              >
                <option value="all">All Days</option>
                <option value="today">Today (2026-09-10)</option>
                <option value="yesterday">Yesterday</option>
                <option value="custom">Specific Date...</option>
              </select>

              {dateQuickFilter === "custom" && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="h-9 rounded-lg bg-black/60 border border-white/15 px-2 text-xs text-white focus:border-[#007AFF] focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Shift Filter */}
          <div>
            <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <IconClock size={12} />
              <span>Operational Shift</span>
            </label>
            <select
              value={shiftFilter}
              onChange={(e) =>
                setShiftFilter(e.target.value as "all" | "Day Shift" | "Night Shift")
              }
              className="w-full h-9 rounded-lg bg-black/60 border border-white/15 px-2.5 text-xs text-white focus:border-[#007AFF] focus:outline-none"
            >
              <option value="all">All Shifts (24h)</option>
              <option value="Day Shift">☀️ Day Shift (06:00 - 18:00)</option>
              <option value="Night Shift">🌙 Night Shift (18:00 - 06:00)</option>
            </select>
          </div>

          {/* Direction & Status */}
          <div>
            <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <IconFilter size={12} />
              <span>Direction &amp; Status</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={directionFilter}
                onChange={(e) =>
                  setDirectionFilter(e.target.value as "all" | "IN" | "OUT")
                }
                className="h-9 rounded-lg bg-black/60 border border-white/15 px-2 text-xs text-white focus:border-[#007AFF] focus:outline-none"
              >
                <option value="all">Any Dir</option>
                <option value="IN">IN (Entry)</option>
                <option value="OUT">OUT (Exit)</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "all" | "granted" | "denied")
                }
                className="h-9 rounded-lg bg-black/60 border border-white/15 px-2 text-xs text-white focus:border-[#007AFF] focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="granted">Granted</option>
                <option value="denied">Denied</option>
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <IconSearch size={12} />
              <span>Search Personnel / Asset</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, EMP code, HT-104, gate..."
                className="w-full h-9 rounded-lg bg-black/60 border border-white/15 pl-8 pr-3 text-xs text-white placeholder:text-neutral-500 focus:border-[#007AFF] focus:outline-none"
              />
              <IconSearch
                size={14}
                className="absolute left-2.5 top-2.5 text-neutral-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Access Logs Table */}
      <div className="rounded-2xl border border-white/10 bg-[#18181b]/80 backdrop-blur-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/10 bg-black/60 text-[10px] uppercase text-neutral-400">
                <th className="p-3.5">Entity / Subject</th>
                <th className="p-3.5">Day &amp; Time</th>
                <th className="p-3.5">Shift</th>
                <th className="p-3.5">Direction</th>
                <th className="p-3.5">Gate &amp; Scanner</th>
                <th className="p-3.5">Access Status</th>
                <th className="p-3.5 text-right">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-neutral-500 text-xs font-mono">
                    No gate access logs matched the selected filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const d = log.scanned_at ? new Date(log.scanned_at) : new Date();
                  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                  const dayOfWeek = log.day_of_week || dayNames[d.getDay()];
                  const dateStr = log.date || d.toISOString().split("T")[0];
                  const timeStr = log.time || d.toLocaleTimeString();
                  const shiftStr = log.shift || (d.getHours() >= 6 && d.getHours() < 18 ? "Day Shift" : "Night Shift");

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Entity Column */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          {log.access_type === "employee" ? (
                            log.employee?.photo ? (
                              <Image
                                src={log.employee.photo}
                                alt={log.entity_name}
                                width={36}
                                height={36}
                                className="h-9 w-9 rounded-full object-cover border border-white/10 shrink-0"
                              />
                            ) : (
                              <div className="h-9 w-9 rounded-full bg-[#007AFF]/15 text-[#0A84FF] border border-[#007AFF]/30 flex items-center justify-center shrink-0">
                                <IconUser size={18} />
                              </div>
                            )
                          ) : log.access_type === "vehicle" ? (
                            <div className="h-9 w-9 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                              <IconTruck size={18} />
                            </div>
                          ) : log.access_type === "visitor" ? (
                            <div className="h-9 w-9 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                              <IconUser size={18} />
                            </div>
                          ) : log.access_type === "equipment" ? (
                            <div className="h-9 w-9 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                              <IconRadio size={18} />
                            </div>
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
                              <IconShieldX size={18} />
                            </div>
                          )}

                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setIsolatedEntity(log.entity_name)}
                              className="font-semibold text-white hover:text-[#007AFF] text-xs sm:text-sm block truncate text-left transition cursor-pointer"
                              title="Click to view history for this individual"
                            >
                              {log.entity_name}
                            </button>
                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400">
                              <span className="uppercase text-[10px] text-neutral-500">
                                {log.access_type}
                              </span>
                              {log.employee?.emp_code && (
                                <>
                                  <span>•</span>
                                  <span className="text-[#007AFF]">{log.employee.emp_code}</span>
                                </>
                              )}
                              {log.vehicle?.fleet_id && (
                                <>
                                  <span>•</span>
                                  <span className="text-purple-400">{log.vehicle.fleet_id}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Day & Time Column */}
                      <td className="p-3.5 text-xs font-mono">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-white font-medium">
                            <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-neutral-300">
                              {dayOfWeek}
                            </span>
                            <span>{timeStr}</span>
                          </div>
                          <span className="text-[11px] text-neutral-400 block">
                            {dateStr}
                          </span>
                        </div>
                      </td>

                      {/* Shift Column */}
                      <td className="p-3.5 text-xs font-mono">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            shiftStr.includes("Day")
                              ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                              : "bg-purple-500/10 text-purple-300 border-purple-500/30"
                          }`}
                        >
                          {shiftStr.includes("Day") ? (
                            <IconSun size={11} className="text-amber-400" />
                          ) : (
                            <IconMoon size={11} className="text-purple-400" />
                          )}
                          <span>{shiftStr}</span>
                        </span>
                      </td>

                      {/* Direction Column */}
                      <td className="p-3.5 text-xs font-mono">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            log.direction === "IN"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                          }`}
                        >
                          {log.direction === "IN" ? (
                            <IconArrowDownLeft size={12} className="text-emerald-400" />
                          ) : (
                            <IconArrowUpRight size={12} className="text-blue-400" />
                          )}
                          <span>{log.direction}</span>
                        </span>
                      </td>

                      {/* Gate & Scanner Column */}
                      <td className="p-3.5 text-xs font-mono text-neutral-300">
                        <div className="space-y-0.5 max-w-[180px]">
                          <div className="truncate font-medium text-white">
                            {log.gate_location}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-neutral-400 truncate">
                            <IconDeviceMobile size={11} className="text-[#007AFF]" />
                            <span className="truncate">{log.scanned_by}</span>
                          </div>
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="p-3.5 text-xs font-mono">
                        {log.access_granted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                            <IconShieldCheck size={13} className="text-emerald-400" />
                            <span>ACCESS GRANTED</span>
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 font-bold text-[10px]">
                              <IconShieldX size={13} className="text-red-400" />
                              <span>ACCESS DENIED</span>
                            </span>
                            {log.denial_reason && (
                              <p className="text-[10px] text-red-400/90 truncate max-w-[200px]" title={log.denial_reason}>
                                {log.denial_reason}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Audit Action Column */}
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setInspectedLog(log)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-neutral-300 font-mono transition cursor-pointer flex items-center gap-1 ml-auto"
                        >
                          <IconEye size={13} />
                          <span>Audit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Audit Drawer / Modal */}
      {inspectedLog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-neutral-900 border border-white/15 rounded-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                {inspectedLog.access_granted ? (
                  <div className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <IconShieldCheck size={18} />
                  </div>
                ) : (
                  <div className="h-8 w-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                    <IconShieldX size={18} />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-white font-mono">
                    Scan Log Audit #{inspectedLog.id}
                  </h3>
                  <span className="text-xs text-neutral-400 font-mono">
                    {inspectedLog.day_of_week || "Day"} • {inspectedLog.date || "Date"} {inspectedLog.time || ""}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectedLog(null)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white cursor-pointer"
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Rejection Details */}
            {!inspectedLog.access_granted && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs font-mono space-y-1">
                <span className="text-red-400 font-bold block flex items-center gap-1">
                  <IconAlertTriangle size={14} />
                  <span>Access Denial Strobe Triggered</span>
                </span>
                <p className="text-red-200">
                  {inspectedLog.denial_reason || "Verification required"}
                </p>
              </div>
            )}

            {/* Key Field Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono bg-black/40 p-3.5 rounded-xl border border-white/5">
              <div>
                <span className="text-[10px] text-neutral-500 uppercase block">Subject / Name</span>
                <strong className="text-white truncate block">{inspectedLog.entity_name}</strong>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase block">Entity Type</span>
                <span className="text-[#007AFF] uppercase">{inspectedLog.access_type}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase block">Direction</span>
                <span className="text-white">{inspectedLog.direction}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase block">Shift</span>
                <span className="text-white">{inspectedLog.shift || "Day Shift"}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase block">Gate Portal</span>
                <span className="text-white">{inspectedLog.gate_location}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase block">Scanner / Operator</span>
                <span className="text-white">{inspectedLog.scanned_by}</span>
              </div>
              {inspectedLog.qr_data && (
                <div className="col-span-2 pt-1 border-t border-white/5">
                  <span className="text-[10px] text-neutral-500 uppercase block">Scanned Raw Tag</span>
                  <code className="text-xs text-neutral-300 bg-black/60 px-2 py-0.5 rounded border border-white/10 block mt-0.5">
                    {inspectedLog.qr_data}
                  </code>
                </div>
              )}
            </div>

            {/* Raw Metadata JSON */}
            {inspectedLog.raw_meta && Object.keys(inspectedLog.raw_meta).length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-neutral-500 block">
                  Enriched Telemetry JSON
                </span>
                <pre className="p-3 rounded-xl bg-black/80 border border-white/10 text-[11px] font-mono text-neutral-300 overflow-x-auto max-h-40">
                  {JSON.stringify(inspectedLog.raw_meta, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectedLog(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-mono cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
