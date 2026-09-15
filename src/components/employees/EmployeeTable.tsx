"use client";

import { useMemo, useState } from "react";
import {
  IconSearch,
  IconShieldCheck,
  IconShieldX,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconX,
  IconUser,
  IconHistory,
  IconAlertTriangle,
  IconCertificate,
  IconHeartbeat,
  IconBuilding,
  IconIdBadge2,
} from "@tabler/icons-react";

export interface Employee {
  id: number;
  emp_code: string;
  initials?: string | null;
  first_name: string;
  second_name?: string | null;
  surname: string;
  id_number?: string | null;
  job_title: string | null;
  area: string | null;
  status: string;
  is_contractor?: boolean;
  contractor_company?: string | null;
  induction?: string | null;
  induction_expiry?: string | Date | null;
  medical?: string | null;
  medical_expiry?: string | Date | null;
  access_level?: string | null;
  certifications?: string | null;
  rfid_tag?: string | null;
  qr_code?: string | null;
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
  accessLevels?: string[];
}

export interface ExpiryEvaluation {
  status: "valid" | "warning" | "expired" | "missing" | "uninducted";
  label: string;
  diffDays: number | null;
  color: "green" | "yellow" | "red";
  formattedDate: string | null;
}

export function getMedicalStatus(dateVal?: string | Date | null): ExpiryEvaluation {
  if (!dateVal) {
    return {
      status: "missing",
      label: "Missing Medical",
      diffDays: null,
      color: "red",
      formattedDate: null,
    };
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) {
    return {
      status: "missing",
      label: "Invalid Date",
      diffDays: null,
      color: "red",
      formattedDate: null,
    };
  }
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const formattedDate = d.toISOString().split("T")[0];

  if (diffDays < 0) {
    return {
      status: "expired",
      label: `Expired (${Math.abs(diffDays)}d ago)`,
      diffDays,
      color: "red",
      formattedDate,
    };
  }
  if (diffDays <= 30) {
    return {
      status: "warning",
      label: diffDays === 0 ? "Expires Today" : `Expires in ${diffDays}d`,
      diffDays,
      color: "yellow",
      formattedDate,
    };
  }
  return {
    status: "valid",
    label: `Valid (${diffDays}d)`,
    diffDays,
    color: "green",
    formattedDate,
  };
}

export function getInductionStatus(
  dateVal?: string | Date | null,
  inductionText?: string | null,
  isContractor?: boolean
): ExpiryEvaluation {
  if (isContractor && (!inductionText?.trim() || !dateVal)) {
    return {
      status: "uninducted",
      label: "Uninducted Contractor",
      diffDays: null,
      color: "red",
      formattedDate: null,
    };
  }
  if (!dateVal) {
    return {
      status: "missing",
      label: "No Induction Record",
      diffDays: null,
      color: "red",
      formattedDate: null,
    };
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) {
    return {
      status: "missing",
      label: "Invalid Date",
      diffDays: null,
      color: "red",
      formattedDate: null,
    };
  }
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const formattedDate = d.toISOString().split("T")[0];

  if (diffDays < 0) {
    return {
      status: "expired",
      label: `Expired (${Math.abs(diffDays)}d ago)`,
      diffDays,
      color: "red",
      formattedDate,
    };
  }
  if (diffDays <= 30) {
    return {
      status: "warning",
      label: diffDays === 0 ? "Expires Today" : `Expires in ${diffDays}d`,
      diffDays,
      color: "yellow",
      formattedDate,
    };
  }
  return {
    status: "valid",
    label: `Valid (${diffDays}d)`,
    diffDays,
    color: "green",
    formattedDate,
  };
}

export interface GateClearance {
  allowed: boolean;
  status: "CLEARED" | "EXPIRING_SOON" | "ACCESS_BLOCKED";
  label: string;
  reason: string;
}

export function getOverallGateClearance(
  emp: Employee,
  med: ExpiryEvaluation,
  ind: ExpiryEvaluation,
  isContractor: boolean
): GateClearance {
  if (emp.status !== "Active") {
    return {
      allowed: false,
      status: "ACCESS_BLOCKED",
      label: "BLOCKED",
      reason: `Account status: ${emp.status}`,
    };
  }
  if (med.status === "expired" || med.status === "missing") {
    return {
      allowed: false,
      status: "ACCESS_BLOCKED",
      label: "BLOCKED",
      reason: "Access Denied: Medical Fitness Expired",
    };
  }
  if (ind.status === "expired" || ind.status === "missing") {
    return {
      allowed: false,
      status: "ACCESS_BLOCKED",
      label: "BLOCKED",
      reason: "Access Denied: Safety Induction Expired",
    };
  }
  if (isContractor && ind.status === "uninducted") {
    return {
      allowed: false,
      status: "ACCESS_BLOCKED",
      label: "BLOCKED",
      reason: "Access Denied: Uninducted Contractor",
    };
  }
  if (med.status === "warning" || ind.status === "warning") {
    return {
      allowed: true,
      status: "EXPIRING_SOON",
      label: "EXPIRING SOON",
      reason: "Permitted — Certifications Expiring Soon",
    };
  }
  return {
    allowed: true,
    status: "CLEARED",
    label: "CLEARED",
    reason: "Gate Ingress Approved",
  };
}

export default function EmployeeTable({
  employees,
  areas,
  accessLevels = [],
}: EmployeeTableProps) {
  const [personnelType, setPersonnelType] = useState<"all" | "employees" | "contractors">("all");
  const [area, setArea] = useState("all");
  const [status, setStatus] = useState("all");
  const [accessLevel, setAccessLevel] = useState("all");
  const [complianceFilter, setComplianceFilter] = useState<"all" | "valid" | "expiring" | "expired">("all");
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
      const isContractor = Boolean(
        emp.is_contractor ||
        (emp.contractor_company && emp.contractor_company.trim().length > 0) ||
        (emp.job_title && /contractor/i.test(emp.job_title))
      );

      if (personnelType === "employees" && isContractor) return false;
      if (personnelType === "contractors" && !isContractor) return false;

      const areaMatch = area === "all" || (emp.area ?? "") === area;
      const statusMatch = status === "all" || emp.status === status;
      const accessLevelMatch = accessLevel === "all" || (emp.access_level ?? "STANDARD") === accessLevel;

      const medStatus = getMedicalStatus(emp.medical_expiry);
      const indStatus = getInductionStatus(emp.induction_expiry, emp.induction, isContractor);

      if (complianceFilter === "expired") {
        const isBlocked =
          medStatus.status === "expired" ||
          medStatus.status === "missing" ||
          indStatus.status === "expired" ||
          indStatus.status === "missing" ||
          indStatus.status === "uninducted" ||
          emp.status !== "Active";
        if (!isBlocked) return false;
      } else if (complianceFilter === "expiring") {
        const hasWarning =
          (medStatus.status === "warning" || indStatus.status === "warning") &&
          medStatus.status !== "expired" &&
          indStatus.status !== "expired" &&
          indStatus.status !== "uninducted" &&
          emp.status === "Active";
        if (!hasWarning) return false;
      } else if (complianceFilter === "valid") {
        const isValid =
          medStatus.status === "valid" &&
          indStatus.status === "valid" &&
          emp.status === "Active";
        if (!isValid) return false;
      }

      const q = search.trim().toLowerCase();
      const searchMatch =
        !q ||
        `${emp.first_name} ${emp.surname}`.toLowerCase().includes(q) ||
        emp.emp_code.toLowerCase().includes(q) ||
        (emp.job_title && emp.job_title.toLowerCase().includes(q)) ||
        (emp.contractor_company && emp.contractor_company.toLowerCase().includes(q)) ||
        (emp.area && emp.area.toLowerCase().includes(q)) ||
        (emp.access_level && emp.access_level.toLowerCase().includes(q)) ||
        (emp.certifications && emp.certifications.toLowerCase().includes(q)) ||
        (emp.rfid_tag && emp.rfid_tag.toLowerCase().includes(q));

      return areaMatch && statusMatch && accessLevelMatch && searchMatch;
    });
  }, [employees, personnelType, area, status, accessLevel, complianceFilter, search]);

  return (
    <div className="space-y-4">
      {/* Type Toggle Tabs (Segmented Control - min 48px touch targets) */}
      <div className="flex items-center gap-2 p-1.5 bg-neutral-900/80 border border-white/10 rounded-2xl w-fit backdrop-blur-md">
        <button
          type="button"
          onClick={() => setPersonnelType("all")}
          className={`min-h-[48px] px-5 py-2.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer active:scale-[0.98] ${
            personnelType === "all"
              ? "bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/25"
              : "text-neutral-400 hover:text-white hover:bg-white/5"
          }`}
        >
          All Workforce ({employees.length})
        </button>
        <button
          type="button"
          onClick={() => setPersonnelType("employees")}
          className={`min-h-[48px] px-5 py-2.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-[0.98] ${
            personnelType === "employees"
              ? "bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/25"
              : "text-neutral-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <IconIdBadge2 size={16} />
          <span>Mine Staff</span>
        </button>
        <button
          type="button"
          onClick={() => setPersonnelType("contractors")}
          className={`min-h-[48px] px-5 py-2.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-[0.98] ${
            personnelType === "contractors"
              ? "bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/25"
              : "text-neutral-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <IconBuilding size={16} />
          <span>Contractors</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl border border-white/10 bg-[#141418]/80 backdrop-blur-xl shadow-lg space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3 flex-1">
            {/* Search Input */}
            <div className="flex-1 min-w-[220px] max-w-sm">
              <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-1">
                Search Personnel
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, EMP code, contractor, RFID..."
                  className="h-12 w-full rounded-xl bg-black/50 border border-white/15 pl-10 pr-9 text-xs text-white placeholder:text-neutral-500 focus:border-[#007AFF] focus:outline-none"
                />
                <IconSearch
                  size={16}
                  className="absolute left-3 top-3.5 text-neutral-500"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-2.5 h-7 w-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <IconX size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Compliance Filter */}
            <div>
              <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-1">
                Compliance Status
              </label>
              <select
                value={complianceFilter}
                onChange={(e) =>
                  setComplianceFilter(
                    e.target.value as "all" | "valid" | "expiring" | "expired"
                  )
                }
                className="h-12 px-4 rounded-xl bg-black/50 border border-white/15 text-xs text-white font-mono focus:border-[#007AFF] focus:outline-none cursor-pointer"
              >
                <option value="all">All Compliance</option>
                <option value="valid">100% Valid (Cleared)</option>
                <option value="expiring">Expiring Soon (&le; 30d)</option>
                <option value="expired">Non-Compliant / Blocked</option>
              </select>
            </div>

            {/* Access Level Filter */}
            <div>
              <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-1">
                Access Level
              </label>
              <select
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value)}
                className="h-12 px-4 rounded-xl bg-black/50 border border-white/15 text-xs text-white font-mono focus:border-[#007AFF] focus:outline-none cursor-pointer"
              >
                <option value="all">All Access Levels</option>
                {accessLevels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            {/* Area Filter */}
            <div>
              <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-1">
                Area / Section
              </label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="h-12 px-4 rounded-xl bg-black/50 border border-white/15 text-xs text-white font-mono focus:border-[#007AFF] focus:outline-none cursor-pointer"
              >
                <option value="all">All Areas</option>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Account Status Filter */}
            <div>
              <label className="block text-[10px] font-mono text-neutral-400 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-12 px-4 rounded-xl bg-black/50 border border-white/15 text-xs text-white font-mono focus:border-[#007AFF] focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="text-xs font-mono text-neutral-400 self-end pb-3">
            Showing <strong className="text-white">{filtered.length}</strong> of {employees.length} personnel
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#101014]/90 backdrop-blur-xl shadow-2xl">
        <table className="min-w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-white/10 bg-black/60 text-[10px] uppercase tracking-wider text-neutral-400">
              <th className="p-4">Personnel &amp; Role</th>
              <th className="p-4">Employee Code</th>
              <th className="p-4">Category &amp; Affiliation</th>
              <th className="p-4">Medical Fitness</th>
              <th className="p-4">Safety Induction</th>
              <th className="p-4">Gate Clearance</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-sans">
            {filtered.map((emp) => {
              const isContractor = Boolean(
                emp.is_contractor ||
                (emp.contractor_company && emp.contractor_company.trim().length > 0) ||
                (emp.job_title && /contractor/i.test(emp.job_title))
              );
              const medStatus = getMedicalStatus(emp.medical_expiry);
              const indStatus = getInductionStatus(emp.induction_expiry, emp.induction, isContractor);
              const clearance = getOverallGateClearance(emp, medStatus, indStatus, isContractor);

              return (
                <tr key={emp.id} className="hover:bg-white/[0.02] transition">
                  {/* Personnel & Role */}
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-[#007AFF]/15 text-[#0A84FF] flex items-center justify-center text-xs font-bold border border-[#007AFF]/25 shrink-0 font-mono">
                        {emp.first_name[0]}
                        {emp.surname[0]}
                      </div>
                      <div>
                        <strong className="block text-white font-medium text-sm">
                          {emp.first_name} {emp.surname}
                        </strong>
                        <span className="text-[11px] text-neutral-400 block truncate max-w-[200px]">
                          {emp.job_title || "Personnel"} • {emp.area || "Site"}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Employee Code & RFID */}
                  <td className="p-4 font-mono text-xs">
                    <code className="text-[#007AFF] bg-[#007AFF]/10 px-2 py-1 rounded-lg border border-[#007AFF]/20 font-bold">
                      {emp.emp_code}
                    </code>
                    {emp.rfid_tag && (
                      <span className="block text-[10px] text-neutral-500 mt-1 truncate max-w-[140px]">
                        RFID: {emp.rfid_tag}
                      </span>
                    )}
                  </td>

                  {/* Category & Affiliation */}
                  <td className="p-4">
                    {isContractor ? (
                      <div className="space-y-1">
                        <span className="px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold inline-flex items-center gap-1">
                          <IconBuilding size={12} />
                          <span>CONTRACTOR</span>
                        </span>
                        <span className="text-xs text-white font-medium block">
                          {emp.contractor_company || "External Vendor"}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="px-2.5 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-mono font-bold inline-flex items-center gap-1">
                          <IconIdBadge2 size={12} />
                          <span>MINE STAFF</span>
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-neutral-300 font-mono">
                            {emp.access_level || "STANDARD"}
                          </span>
                          {emp.certifications && (
                            <span className="text-[10px] text-purple-300 bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.2 rounded font-mono">
                              {emp.certifications}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Medical Fitness */}
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold inline-flex items-center gap-1.5 ${
                        medStatus.color === "green"
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : medStatus.color === "yellow"
                          ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          : "bg-red-500/15 text-red-300 border-red-500/30"
                      }`}
                    >
                      <IconHeartbeat size={13} />
                      <span>{medStatus.label}</span>
                    </span>
                    {medStatus.formattedDate && (
                      <span className="block text-[10px] text-neutral-400 font-mono mt-1">
                        Expiry: {medStatus.formattedDate}
                      </span>
                    )}
                  </td>

                  {/* Safety Induction */}
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold inline-flex items-center gap-1.5 ${
                        indStatus.color === "green"
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : indStatus.color === "yellow"
                          ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          : "bg-red-500/15 text-red-300 border-red-500/30"
                      }`}
                    >
                      <IconCertificate size={13} />
                      <span>{indStatus.label}</span>
                    </span>
                    {indStatus.formattedDate && (
                      <span className="block text-[10px] text-neutral-400 font-mono mt-1">
                        Expiry: {indStatus.formattedDate}
                      </span>
                    )}
                  </td>

                  {/* Gate Clearance */}
                  <td className="p-4">
                    <span
                      title={clearance.reason}
                      className={`px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold inline-flex items-center gap-1.5 ${
                        clearance.status === "CLEARED"
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : clearance.status === "EXPIRING_SOON"
                          ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          : "bg-red-500/15 text-red-300 border-red-500/30"
                      }`}
                    >
                      {clearance.status === "CLEARED" ? (
                        <IconShieldCheck size={13} />
                      ) : clearance.status === "EXPIRING_SOON" ? (
                        <IconAlertTriangle size={13} />
                      ) : (
                        <IconShieldX size={13} />
                      )}
                      <span>{clearance.label}</span>
                    </span>
                    {clearance.status === "ACCESS_BLOCKED" && (
                      <span className="block text-[10px] text-red-400/80 font-mono mt-1 truncate max-w-[150px]">
                        {clearance.reason}
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="p-4">
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

                  {/* Actions (48px Touch Target) */}
                  <td className="p-4 text-right font-mono">
                    <button
                      type="button"
                      onClick={() => handleOpenHistory(emp)}
                      className="min-h-[48px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-neutral-200 transition cursor-pointer inline-flex items-center gap-2 active:scale-[0.98]"
                    >
                      <IconHistory size={16} className="text-[#007AFF]" />
                      <span>Logs</span>
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="p-12 text-center text-xs text-neutral-400 font-mono"
                >
                  No personnel match the selected filters or query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Individual Employee Access Logs Drawer */}
      {selectedEmp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#141418] border border-white/15 rounded-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-[#007AFF]/20 text-[#007AFF] flex items-center justify-center font-bold text-base border border-[#007AFF]/30">
                  <IconUser size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedEmp.first_name} {selectedEmp.surname}
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mt-0.5">
                    <span className="text-[#007AFF] font-bold">{selectedEmp.emp_code}</span>
                    <span>•</span>
                    <span>{selectedEmp.job_title || "Personnel"}</span>
                    <span>•</span>
                    <span>
                      {selectedEmp.is_contractor
                        ? selectedEmp.contractor_company || "Contractor"
                        : "Mine Staff"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEmp(null)}
                className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white cursor-pointer active:scale-[0.98]"
                aria-label="Close modal"
              >
                <IconX size={20} />
              </button>
            </div>

            {/* Compliance Quick Banner */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-black/40 border border-white/5 text-xs font-mono">
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase">
                  Medical Expiry:
                </span>
                <span className="text-white font-bold">
                  {selectedEmp.medical_expiry
                    ? new Date(selectedEmp.medical_expiry).toISOString().split("T")[0]
                    : "Not Registered"}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px] uppercase">
                  Induction Expiry:
                </span>
                <span className="text-white font-bold">
                  {selectedEmp.induction_expiry
                    ? new Date(selectedEmp.induction_expiry).toISOString().split("T")[0]
                    : "Not Registered"}
                </span>
              </div>
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
                  const dayNames = [
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ];
                  const dayOfWeek = log.day_of_week || dayNames[d.getDay()];
                  const dateStr = log.date || d.toISOString().split("T")[0];
                  const timeStr = log.time || d.toLocaleTimeString();
                  const shiftStr =
                    log.shift ||
                    (d.getHours() >= 6 && d.getHours() < 18 ? "Day Shift" : "Night Shift");

                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-black/50 border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono hover:bg-white/[0.02] transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            log.direction === "IN"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                          }`}
                        >
                          {log.direction === "IN" ? (
                            <IconArrowDownLeft size={16} />
                          ) : (
                            <IconArrowUpRight size={16} />
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
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-[10px] flex items-center gap-1 font-mono">
                            <IconShieldCheck size={12} />
                            <span>GRANTED</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 font-bold text-[10px] flex items-center gap-1 font-mono">
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

            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEmp(null)}
                className="min-h-[48px] px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-mono cursor-pointer active:scale-[0.98]"
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
