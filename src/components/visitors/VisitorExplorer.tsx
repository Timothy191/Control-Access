"use client";

import { useState } from "react";
import {
  IconUser,
  IconHistory,
  IconShieldCheck,
  IconShieldX,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconX,
  IconSearch,
  IconBuildingCommunity,
  IconBriefcase,
  IconUserCheck,
} from "@tabler/icons-react";

interface Host {
  id: number;
  first_name: string;
  surname: string;
  department?: string | null;
}

interface Visitor {
  id: number;
  name: string;
  company: string | null;
  purpose: string | null;
  meeting_person: string | null;
  qr_code: string | null;
  rfid_tag: string | null;
  host_id: number | null;
  host?: Host | null;
  check_in_time: string | Date;
  check_out_time?: string | Date | null;
  status: string;
  created_at: string | Date;
}

interface VisitorLog {
  id: number;
  direction: string;
  access_granted: boolean;
  denial_reason: string | null;
  gate_location: string;
  scanned_at: string;
  day_of_week?: string;
  date?: string;
  time?: string;
  shift?: string;
  scanned_by?: string;
}

export default function VisitorExplorer({ visitors }: { visitors: Visitor[] }) {
  const [search, setSearch] = useState("");
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const handleOpenHistory = async (vis: Visitor) => {
    setSelectedVisitor(vis);
    setIsLoadingLogs(true);
    setVisitorLogs([]);
    try {
      const res = await fetch(`/api/logs?visitorId=${vis.id}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        if (data.logs) {
          setVisitorLogs(data.logs);
        }
      }
    } catch (err) {
      console.error("Failed to load visitor logs:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const filtered = visitors.filter(
    (v) =>
      !search.trim() ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.company && v.company.toLowerCase().includes(search.toLowerCase())) ||
      (v.purpose && v.purpose.toLowerCase().includes(search.toLowerCase())) ||
      (v.meeting_person && v.meeting_person.toLowerCase().includes(search.toLowerCase())) ||
      (v.qr_code && v.qr_code.toLowerCase().includes(search.toLowerCase())) ||
      (v.rfid_tag && v.rfid_tag.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Site Visitors & Contractors ({visitors.length})
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Audited visitor register with individual daily gate scans, host assignments, and security clearance.
          </p>
        </div>

        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search visitor, company, host, tag..."
            className="h-9 w-64 rounded-xl bg-black/50 border border-white/15 pl-8 pr-3 text-xs text-white placeholder:text-neutral-500 focus:border-[#007AFF] focus:outline-none"
          />
          <IconSearch
            size={14}
            className="absolute left-2.5 top-2.5 text-neutral-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((visitor) => (
          <div
            key={visitor.id}
            className="rounded-2xl border border-white/10 bg-[#18181b]/80 backdrop-blur-xl p-5 space-y-3.5 shadow-lg hover:border-white/20 transition"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                  <IconUser size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {visitor.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-sans">
                    <IconBuildingCommunity size={13} className="text-neutral-500" />
                    <span>{visitor.company || "Independent"}</span>
                  </div>
                </div>
              </div>

              <span
                className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full border ${
                  visitor.status === "Checked In"
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : "bg-white/10 text-neutral-400 border-white/10"
                }`}
              >
                {visitor.status}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-[11px] font-mono text-neutral-300 space-y-1.5">
              {visitor.purpose && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 flex items-center gap-1">
                    <IconBriefcase size={12} /> Purpose:
                  </span>
                  <span className="text-neutral-200 truncate max-w-[170px]">{visitor.purpose}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 flex items-center gap-1">
                  <IconUserCheck size={12} /> Host / Meeting:
                </span>
                <span className="text-neutral-200">
                  {visitor.host
                    ? `${visitor.host.first_name} ${visitor.host.surname}`
                    : visitor.meeting_person || "Site General"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Credential / Tag:</span>
                <span className="text-amber-300 truncate max-w-[160px]">
                  {visitor.rfid_tag || visitor.qr_code || "Badge Assigned"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenHistory(visitor)}
              className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-white flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <IconHistory size={14} className="text-amber-400" />
              <span>View Gate Log History</span>
            </button>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full p-8 text-center text-xs font-mono text-neutral-500 bg-[#18181b]/50 rounded-2xl border border-white/10">
            No visitors recorded matching search.
          </div>
        )}
      </div>

      {/* Individual Visitor Access Logs Drawer */}
      {selectedVisitor && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-neutral-900 border border-white/15 rounded-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm border border-amber-500/30">
                  <IconUser size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Visitor: {selectedVisitor.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
                    <span>{selectedVisitor.company || "Independent"}</span>
                    <span>•</span>
                    <span className="text-emerald-400">{selectedVisitor.status}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedVisitor(null)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white cursor-pointer"
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Visitor Logs by Day & Shift */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400 pb-1">
                <span>Gate Ingress & Egress Events</span>
                <span>{visitorLogs.length} total events</span>
              </div>

              {isLoadingLogs ? (
                <div className="py-12 text-center text-xs font-mono text-neutral-400 space-y-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-amber-400 border-t-transparent mx-auto" />
                  <p>Loading visitor gate history...</p>
                </div>
              ) : visitorLogs.length === 0 ? (
                <div className="py-12 text-center text-xs font-mono text-neutral-500 bg-black/40 rounded-xl border border-white/5">
                  No gate scans logged for this visitor yet.
                </div>
              ) : (
                visitorLogs.map((log) => {
                  const d = log.scanned_at ? new Date(log.scanned_at) : new Date();
                  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                  const dayOfWeek = log.day_of_week || dayNames[d.getDay()];
                  const dateStr = log.date || d.toISOString().split("T")[0];
                  const timeStr = log.time || d.toLocaleTimeString();
                  const shiftStr = log.shift || (d.getHours() >= 6 && d.getHours() < 18 ? "Day Shift" : "Night Shift");

                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-black/50 border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono hover:bg-white/[0.02] transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`h-7 w-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                            log.direction === "IN"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                          }`}
                        >
                          {log.direction === "IN" ? (
                            <IconArrowDownLeft size={14} />
                          ) : (
                            <IconArrowUpRight size={14} />
                          )}
                        </span>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{dayOfWeek}</span>
                            <span className="text-neutral-400">{dateStr}</span>
                            <span className="text-neutral-500">•</span>
                            <span className="text-neutral-300">{timeStr}</span>
                          </div>
                          <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                            <span>{log.gate_location}</span>
                            <span>•</span>
                            <span className="text-neutral-500">{shiftStr}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        {log.access_granted ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-[10px] flex items-center gap-1">
                            <IconShieldCheck size={12} />
                            <span>CLEARED</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 font-bold text-[10px] flex items-center gap-1">
                            <IconShieldX size={12} />
                            <span>DENIED</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedVisitor(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-mono cursor-pointer"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
