"use client";

import { useState, useMemo } from "react";
import {
  IconSearch,
  IconLayoutGrid,
  IconLayoutList,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconCheck,
  IconX,
  IconDownload,
  IconUser,
  IconTruck,
  IconMapPin,
  IconId,
  IconFilter,
  IconEye,
  IconRefresh,
} from "@tabler/icons-react";

export interface ScanEvent {
  id: number;
  access_type: string | null;
  entity_name: string | null;
  direction: string | null;
  access_granted: boolean;
  denial_reason: string | null;
  gate_location: string | null;
  scanned_at: string;
}

interface LiveScansTableProps {
  scans: ScanEvent[];
  onRefresh?: () => void;
  lastSync?: string;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 15) return "Just now";
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return "Recent";
  }
}

export default function LiveScansTable({
  scans,
  onRefresh,
  lastSync,
}: LiveScansTableProps) {
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "GRANTED" | "DENIED">("ALL");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [inspectedScan, setInspectedScan] = useState<ScanEvent | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Filter scans
  const filteredScans = useMemo(() => {
    return scans.filter((scan) => {
      // Direction match
      if (directionFilter !== "ALL") {
        const dir = (scan.direction || "").toUpperCase();
        if (dir !== directionFilter) return false;
      }
      // Status match
      if (statusFilter === "GRANTED" && !scan.access_granted) return false;
      if (statusFilter === "DENIED" && scan.access_granted) return false;

      // Text search match
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = (scan.entity_name || "").toLowerCase();
        const gate = (scan.gate_location || "").toLowerCase();
        const type = (scan.access_type || "").toLowerCase();
        const reason = (scan.denial_reason || "").toLowerCase();
        const idStr = String(scan.id);
        if (
          !name.includes(q) &&
          !gate.includes(q) &&
          !type.includes(q) &&
          !reason.includes(q) &&
          !idStr.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [scans, search, directionFilter, statusFilter]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!filteredScans.length) return;
    const headers = [
      "ID",
      "Timestamp",
      "Entity Name",
      "Access Type",
      "Direction",
      "Gate Location",
      "Access Granted",
      "Denial Reason",
    ];
    const rows = filteredScans.map((s) => [
      s.id,
      `"${s.scanned_at}"`,
      `"${s.entity_name || "Unknown"}"`,
      `"${s.access_type || "N/A"}"`,
      `"${s.direction || "N/A"}"`,
      `"${s.gate_location || "N/A"}"`,
      s.access_granted ? "GRANTED" : "DENIED",
      `"${s.denial_reason || ""}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `live_scans_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyScan = (scan: ScanEvent) => {
    navigator.clipboard.writeText(JSON.stringify(scan, null, 2)).catch(() => {});
    setCopiedId(scan.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const getEntityIcon = (accessType?: string | null) => {
    const t = (accessType || "").toLowerCase();
    if (t.includes("veh") || t.includes("truck") || t.includes("fleet")) {
      return <IconTruck size={15} className="text-[#007AFF]" />;
    }
    if (t.includes("vis")) {
      return <IconId size={15} className="text-[#BF5AF2]" />;
    }
    return <IconUser size={15} className="text-[#30D158]" />;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.14] bg-[#141418]/85 backdrop-blur-2xl shadow-xl flex flex-col font-sans transition-all duration-300">
      {/* Top Hairline Sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#007AFF]/60 to-transparent" />

      {/* Control Center Header Toolbar */}
      <div className="p-4 sm:p-5 border-b border-white/[0.08] flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title & Live Status Beacon */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              </span>
              <h2 className="font-semibold text-sm sm:text-base text-white tracking-tight uppercase font-mono">
                Live Access Scans
              </h2>
            </div>
            <span className="text-[11px] font-mono text-neutral-400 px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/10">
              {filteredScans.length} {filteredScans.length === 1 ? "Event" : "Events"}
            </span>
          </div>

          {/* Action Buttons: View Toggle & CSV Export */}
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono text-neutral-300 transition cursor-pointer"
                title="Refresh Live Scans"
              >
                <IconRefresh size={14} className="text-neutral-400" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredScans.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 text-xs font-mono text-neutral-300 transition cursor-pointer"
              title="Export Filtered Scans as CSV"
            >
              <IconDownload size={14} className="text-neutral-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            {/* View Mode Toggle: Table Data Grid vs Card Grid */}
            <div className="flex items-center rounded-lg border border-white/10 bg-black/40 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono transition cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white/15 text-white font-semibold shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
                title="Table Data Grid View"
              >
                <IconLayoutList size={14} />
                <span className="hidden md:inline">Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono transition cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-white/15 text-white font-semibold shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
                title="Cards Grid View"
              >
                <IconLayoutGrid size={14} />
                <span className="hidden md:inline">Cards</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search Input & Interactive Filter Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Quick Search Input */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
              <IconSearch size={14} />
            </div>
            <input
              type="text"
              placeholder="Search by name, gate, type, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full appearance-none rounded-lg border border-white/[0.12] bg-black/40 pl-8 pr-3 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-[#007AFF] focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-[#007AFF]/40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-neutral-500 hover:text-neutral-200 cursor-pointer"
              >
                <IconX size={12} />
              </button>
            )}
          </div>

          {/* Filter Badges: Direction & Status */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Direction Filter */}
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5 text-[11px] font-mono">
              <span className="px-1.5 text-neutral-500 hidden sm:inline">DIR:</span>
              {(["ALL", "IN", "OUT"] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setDirectionFilter(dir)}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    directionFilter === dir
                      ? "bg-white/15 text-white font-semibold"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {dir === "IN" ? "↑ IN" : dir === "OUT" ? "↓ OUT" : "All"}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5 text-[11px] font-mono">
              <span className="px-1.5 text-neutral-500 hidden sm:inline">STATUS:</span>
              {(["ALL", "GRANTED", "DENIED"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    statusFilter === st
                      ? "bg-white/15 text-white font-semibold"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {st === "GRANTED" ? "Granted" : st === "DENIED" ? "Denied" : "All"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content Area: Table Data Grid or Cards Grid */}
      <div className="flex-1 overflow-auto min-h-[320px] max-h-[500px]">
        {filteredScans.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-center p-6">
            <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-neutral-500">
              <IconFilter size={18} />
            </div>
            <p className="text-sm font-medium text-neutral-300">No scan events match your filters</p>
            <p className="text-xs text-neutral-500 max-w-sm">
              Try adjusting your search query, or clear direction and status filters to view all activity.
            </p>
            {(search || directionFilter !== "ALL" || statusFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setDirectionFilter("ALL");
                  setStatusFilter("ALL");
                }}
                className="mt-2 text-xs text-[#007AFF] hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : viewMode === "table" ? (
          /* Professional Data Table Grid */
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-[#17171b]/95 backdrop-blur-md border-b border-white/10 text-neutral-400 font-mono text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Time & Status</th>
                <th className="py-2.5 px-4 font-semibold">Subject / Entity</th>
                <th className="py-2.5 px-4 font-semibold hidden sm:table-cell">Type</th>
                <th className="py-2.5 px-4 font-semibold">Direction</th>
                <th className="py-2.5 px-4 font-semibold hidden md:table-cell">Gate / Location</th>
                <th className="py-2.5 px-4 font-semibold text-right">Clearance</th>
                <th className="py-2.5 px-4 font-semibold text-center w-12">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredScans.map((scan) => {
                const isGranted = scan.access_granted;
                const isEntry = (scan.direction || "").toUpperCase() === "IN";

                return (
                  <tr
                    key={scan.id}
                    onClick={() => setInspectedScan(scan)}
                    className="group hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    {/* Time & Status Dot */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 shadow-xs ${
                            isGranted ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.8)]"
                          }`}
                        />
                        <div>
                          <div className="font-mono text-neutral-200 text-xs font-medium">
                            {new Date(scan.scanned_at).toLocaleTimeString()}
                          </div>
                          <div className="text-[10px] font-mono text-neutral-500">
                            {formatRelativeTime(scan.scanned_at)}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Entity / Subject */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center shrink-0">
                          {getEntityIcon(scan.access_type)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-white text-xs truncate max-w-[160px] sm:max-w-[220px]">
                            {scan.entity_name || "Unknown Individual"}
                          </div>
                          <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-1.5">
                            <span>ID: #{scan.id}</span>
                            <span className="sm:hidden text-neutral-600">•</span>
                            <span className="sm:hidden text-neutral-400">{scan.access_type || "Gate"}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Access Type */}
                    <td className="py-3 px-4 hidden sm:table-cell whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-white/[0.05] border border-white/10 text-neutral-300">
                        {scan.access_type || "Employee"}
                      </span>
                    </td>

                    {/* Direction */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                          isEntry
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                        }`}
                      >
                        {isEntry ? <IconArrowUpRight size={12} /> : <IconArrowDownLeft size={12} />}
                        <span>{scan.direction || "SCAN"}</span>
                      </span>
                    </td>

                    {/* Gate Location */}
                    <td className="py-3 px-4 hidden md:table-cell whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-neutral-300 text-xs">
                        <IconMapPin size={13} className="text-neutral-500 shrink-0" />
                        <span className="truncate max-w-[180px]">{scan.gate_location || "Main Portal"}</span>
                      </div>
                    </td>

                    {/* Clearance / Decision */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium border ${
                          isGranted
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                        }`}
                      >
                        {isGranted ? <IconCheck size={12} /> : <IconX size={12} />}
                        <span>{isGranted ? "GRANTED" : scan.denial_reason || "DENIED"}</span>
                      </span>
                    </td>

                    {/* Quick Action */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectedScan(scan);
                        }}
                        className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                        title="View Full Scan Telemetry"
                      >
                        <IconEye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* Cards Grid View */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredScans.map((scan) => {
              const isGranted = scan.access_granted;
              const isEntry = (scan.direction || "").toUpperCase() === "IN";

              return (
                <div
                  key={scan.id}
                  onClick={() => setInspectedScan(scan)}
                  className="rounded-xl border border-white/[0.1] bg-black/35 p-3.5 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-150 cursor-pointer flex flex-col justify-between gap-3 group"
                >
                  {/* Top Meta Row */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                        isEntry
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                      }`}
                    >
                      {isEntry ? <IconArrowUpRight size={12} /> : <IconArrowDownLeft size={12} />}
                      <span>{scan.direction || "SCAN"}</span>
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                        isGranted
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                      }`}
                    >
                      {isGranted ? <IconCheck size={11} /> : <IconX size={11} />}
                      <span>{isGranted ? "GRANTED" : "DENIED"}</span>
                    </span>
                  </div>

                  {/* Entity Information */}
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center shrink-0">
                      {getEntityIcon(scan.access_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-white text-sm truncate">
                        {scan.entity_name || "Unknown Entity"}
                      </h4>
                      <p className="text-[11px] text-neutral-400 truncate flex items-center gap-1 mt-0.5 font-mono">
                        <IconMapPin size={12} className="text-neutral-500 shrink-0" />
                        <span>{scan.gate_location || "Main Portal"}</span>
                      </p>
                    </div>
                  </div>

                  {/* Card Footer: Timestamp & Details Link */}
                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[10px] font-mono text-neutral-400">
                    <div>
                      <span>{new Date(scan.scanned_at).toLocaleTimeString()}</span>
                      <span className="text-neutral-600 mx-1">•</span>
                      <span>{formatRelativeTime(scan.scanned_at)}</span>
                    </div>
                    <span className="text-[#007AFF] group-hover:underline flex items-center gap-1">
                      Inspect ➔
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Table Footer Status Ribbon */}
      <div className="px-4 py-2.5 border-t border-white/[0.08] bg-black/40 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-neutral-400">
        <div className="flex items-center gap-2">
          <span>Showing {filteredScans.length} of {scans.length} events</span>
          {lastSync && (
            <>
              <span className="text-neutral-600">•</span>
              <span>Synced at {lastSync}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-neutral-500">
          <span>Live SQLite WAL Stream</span>
        </div>
      </div>

      {/* Modal: Full Scan Telemetry Inspection */}
      {inspectedScan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div
            className="fixed inset-0"
            onClick={() => setInspectedScan(null)}
          />
          <div className="relative w-full max-w-lg mac-window border border-white/20 p-5 rounded-2xl shadow-2xl z-10 flex flex-col gap-4">
            {/* Modal Titlebar with Traffic Lights */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 -mx-1">
              <div className="flex items-center gap-2">
                <div
                  onClick={() => setInspectedScan(null)}
                  className="h-3 w-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/80 cursor-pointer"
                  title="Close Modal"
                />
                <div className="h-3 w-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/80" />
                <div className="h-3 w-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/80" />
              </div>
              <div className="text-xs font-mono text-neutral-300 font-semibold">
                Scan Audit Event #{inspectedScan.id}
              </div>
              <button
                type="button"
                onClick={() => setInspectedScan(null)}
                className="text-neutral-400 hover:text-white transition cursor-pointer"
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Modal Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-neutral-500 block text-[10px] uppercase">Entity Subject</span>
                <span className="font-semibold text-white text-sm mt-0.5 block truncate">
                  {inspectedScan.entity_name || "Unknown"}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-neutral-500 block text-[10px] uppercase">Access Type</span>
                <span className="font-medium text-neutral-200 mt-0.5 block">
                  {inspectedScan.access_type || "Employee Gate"}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-neutral-500 block text-[10px] uppercase">Direction & Gate</span>
                <span className="font-medium text-neutral-200 mt-0.5 block">
                  {inspectedScan.direction || "SCAN"} @ {inspectedScan.gate_location || "Main Portal"}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-neutral-500 block text-[10px] uppercase">Clearance Decision</span>
                <span
                  className={`font-semibold mt-0.5 block ${
                    inspectedScan.access_granted ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {inspectedScan.access_granted ? "ACCESS GRANTED" : inspectedScan.denial_reason || "ACCESS DENIED"}
                </span>
              </div>

              <div className="col-span-2 p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-neutral-500 block text-[10px] uppercase">Full Timestamp</span>
                <span className="font-medium text-neutral-300 mt-0.5 block">
                  {new Date(inspectedScan.scanned_at).toLocaleString()} ({formatRelativeTime(inspectedScan.scanned_at)})
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => handleCopyScan(inspectedScan)}
                className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-mono text-neutral-200 transition cursor-pointer flex items-center gap-1.5"
              >
                {copiedId === inspectedScan.id ? (
                  <>
                    <IconCheck size={14} className="text-emerald-400" />
                    <span>Copied JSON</span>
                  </>
                ) : (
                  <>
                    <IconId size={14} />
                    <span>Copy JSON Log</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setInspectedScan(null)}
                className="px-4 py-1.5 rounded-lg bg-[#007AFF] hover:bg-[#0A84FF] text-white text-xs font-medium transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
