"use client";

import { useMemo, useState } from "react";
import {
  IconSearch,
  IconClock,
  IconShieldCheck,
  IconShieldX,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconX,
  IconUser,
  IconHistory,
} from "@tabler/icons-react";

interface Employee {
  id: number;
  emp_code: string;
  first_name: string;
  surname: string;
  job_title: string | null;
  area: string | null;
  status: string;
}

interface EmployeeLog {
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

interface EmployeeTableProps {
  employees: Employee[];
  areas: string[];
}

export default function EmployeeTable({
  employees,
  areas,
}: EmployeeTableProps) {
  const [area, setArea] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  // Individual Employee History Modal
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [empLogs, setEmpLogs] = useState<EmployeeLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const handleOpenHistory = async (emp: Employee) => {
    setSelectedEmp(emp);
    setIsLoadingLogs(true);
    setEmpLogs([]);
    try {
      const res = await fetch(`/api/logs?employeeId=${emp.id}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        if (data.logs) {
          setEmpLogs(data.logs);
        }
      }
    } catch (err) {
      console.error("Failed to load employee logs:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      const areaMatch = area === "all" || (emp.area ?? "") === area;
      const statusMatch = status === "all" || emp.status === status;
      const searchMatch =
        !search.trim() ||
        `${emp.first_name} ${emp.surname}`.toLowerCase().includes(search.toLowerCase()) ||
        emp.emp_code.toLowerCase().includes(search.toLowerCase()) ||
        (emp.job_title && emp.job_title.toLowerCase().includes(search.toLowerCase()));

      return areaMatch && statusMatch && searchMatch;
    });
  }, [employees, area, status, search]);

  return (
    <div className="space-y-4">
      {/* Filter Area */}
      <div className="glass-card">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">
                Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name or EMP code..."
                  className="h-9 w-48 sm:w-64 rounded-lg bg-black/50 border border-white/15 pl-8 pr-3 text-xs text-white placeholder:text-neutral-500 focus:border-[#007AFF] focus:outline-none"
                />
                <IconSearch
                  size={14}
                  className="absolute left-2.5 top-2.5 text-neutral-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">
                Area / Section
              </label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="h-9 px-3 rounded-lg bg-black/50 border border-white/15 text-xs text-white focus:border-[#007AFF] focus:outline-none"
              >
                <option value="all">All Areas</option>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-text-secondary uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 px-3 rounded-lg bg-black/50 border border-white/15 text-xs text-white focus:border-[#007AFF] focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="text-xs font-mono text-neutral-400">
            Showing <strong className="text-white">{filtered.length}</strong> of {employees.length} personnel
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-table overflow-hidden">
        <table className="min-w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-white/10 bg-black/60 text-[10px] uppercase text-neutral-400">
              <th className="p-3">Personnel</th>
              <th className="p-3">Employee Code</th>
              <th className="p-3">Job Title</th>
              <th className="p-3">Area</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Gate History</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-sans">
            {filtered.map((emp) => (
              <tr key={emp.id} className="hover:bg-white/[0.02] transition">
                <td className="p-3 font-medium text-white flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-[#007AFF]/15 text-[#0A84FF] flex items-center justify-center text-xs font-bold border border-[#007AFF]/25">
                    {emp.first_name[0]}
                    {emp.surname[0]}
                  </div>
                  <span>
                    {emp.first_name} {emp.surname}
                  </span>
                </td>
                <td className="p-3 font-mono text-xs text-[#007AFF]">
                  {emp.emp_code}
                </td>
                <td className="p-3 text-neutral-300">{emp.job_title || "-"}</td>
                <td className="p-3 text-neutral-400">{emp.area || "-"}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full border font-mono ${
                      emp.status === "Active"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-red-500/15 text-red-300 border-red-500/30"
                    }`}
                  >
                    {emp.status}
                  </span>
                </td>
                <td className="p-3 text-right font-mono">
                  <button
                    type="button"
                    onClick={() => handleOpenHistory(emp)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-neutral-200 transition cursor-pointer inline-flex items-center gap-1"
                  >
                    <IconHistory size={13} className="text-[#007AFF]" />
                    <span>Logs</span>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-xs text-neutral-500 font-mono"
                >
                  No employees matched the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Individual Employee Access Logs Drawer */}
      {selectedEmp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-neutral-900 border border-white/15 rounded-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#007AFF]/20 text-[#007AFF] flex items-center justify-center font-bold text-sm border border-[#007AFF]/30">
                  <IconUser size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedEmp.first_name} {selectedEmp.surname}
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
                    <span className="text-[#007AFF]">{selectedEmp.emp_code}</span>
                    <span>•</span>
                    <span>{selectedEmp.job_title || "Personnel"}</span>
                    <span>•</span>
                    <span>{selectedEmp.area || "Site"}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEmp(null)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white cursor-pointer"
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Logs List for Individual Employee */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400 pb-1">
                <span>Access History by Day &amp; Shift</span>
                <span>{empLogs.length} total events</span>
              </div>

              {isLoadingLogs ? (
                <div className="py-12 text-center text-xs font-mono text-neutral-400 space-y-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#007AFF] border-t-transparent mx-auto" />
                  <p>Loading personal access history...</p>
                </div>
              ) : empLogs.length === 0 ? (
                <div className="py-12 text-center text-xs font-mono text-neutral-500 bg-black/40 rounded-xl border border-white/5">
                  No scan logs recorded for this individual yet.
                </div>
              ) : (
                empLogs.map((log) => {
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

                      <div className="flex items-center gap-2">
                        {log.access_granted ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-[10px] flex items-center gap-1">
                            <IconShieldCheck size={12} />
                            <span>GRANTED</span>
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
                onClick={() => setSelectedEmp(null)}
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
