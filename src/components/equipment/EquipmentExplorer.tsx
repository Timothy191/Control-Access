"use client";

import { useState, useMemo } from "react";
import {
  IconRadio,
  IconGauge,
  IconBarcode,
  IconSearch,
  IconAlertTriangle,
  IconUser,
  IconCheck,
  IconRefresh,
  IconLifebuoy,
  IconX,
} from "@tabler/icons-react";

export interface EquipmentItem {
  id: number;
  radio_id: string;
  equipment_type: string;
  model_name?: string | null;
  serial_number?: string | null;
  barcode?: string | null;
  rfid_tag?: string | null;
  qr_code?: string | null;
  status: string;
  calibration_expiry?: string | null;
  registration_expiry?: string | null;
  assigned_to?: {
    id: number;
    emp_code: string;
    first_name: string;
    surname: string;
  } | null;
  created_at: string;
}

export type CalibrationStatusEnum = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "REQUIRED" | "NOT_REQUIRED";

export function evaluateCalibration(item: { equipment_type: string; calibration_expiry?: string | null }): {
  status: CalibrationStatusEnum;
  label: string;
  days: number | null;
  color: "green" | "yellow" | "red" | "neutral";
} {
  const isGasMonitor = item.equipment_type.toUpperCase().includes("GAS") || item.equipment_type.toUpperCase().includes("MONITOR");

  if (!item.calibration_expiry) {
    if (isGasMonitor) {
      return { status: "REQUIRED", label: "CALIBRATION REQUIRED", days: null, color: "red" };
    }
    return { status: "NOT_REQUIRED", label: "N/A (Standard Asset)", days: null, color: "neutral" };
  }

  const d = new Date(item.calibration_expiry);
  if (isNaN(d.getTime())) {
    if (isGasMonitor) {
      return { status: "REQUIRED", label: "CALIBRATION REQUIRED", days: null, color: "red" };
    }
    return { status: "NOT_REQUIRED", label: "Invalid Date", days: null, color: "neutral" };
  }

  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { status: "EXPIRED", label: `EXPIRED (${Math.abs(diffDays)}d ago)`, days: diffDays, color: "red" };
  }
  if (diffDays <= 30) {
    return { status: "EXPIRING_SOON", label: `EXPIRING SOON (${diffDays}d)`, days: diffDays, color: "yellow" };
  }
  return { status: "VALID", label: `VALID (${diffDays}d)`, days: diffDays, color: "green" };
}

export default function EquipmentExplorer({ equipment: initialEquipment }: { equipment: EquipmentItem[] }) {
  const [equipment, setEquipment] = useState<EquipmentItem[]>(initialEquipment);
  const [typeTab, setTypeTab] = useState<"all" | "radios" | "detectors" | "safety">("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [calibFilter, setCalibFilter] = useState("all");

  // Recalibration Modal State
  const [recalibrateTarget, setRecalibrateTarget] = useState<EquipmentItem | null>(null);
  const [calibDurationDays, setCalibDurationDays] = useState<number>(180);
  const [isRecalibrating, setIsRecalibrating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRecalibrate = async () => {
    if (!recalibrateTarget) return;
    setIsRecalibrating(true);

    try {
      const nextExpiry = new Date();
      nextExpiry.setDate(nextExpiry.getDate() + calibDurationDays);

      const res = await fetch(`/api/equipment?id=${recalibrateTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "recalibrate",
          calibration_expiry: nextExpiry.toISOString(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Recalibration failed");
      }

      const data = await res.json();
      const updatedExpiry = data.equipment?.calibration_expiry || nextExpiry.toISOString();

      setEquipment((prev) =>
        prev.map((e) =>
          e.id === recalibrateTarget.id
            ? { ...e, status: "Active", calibration_expiry: updatedExpiry }
            : e
        )
      );

      showToast(`Successfully recalibrated ${recalibrateTarget.radio_id}! Valid for ${calibDurationDays} days.`);
      setRecalibrateTarget(null);
    } catch (error) {
      alert(String(error));
    } finally {
      setIsRecalibrating(false);
    }
  };

  const counts = useMemo(() => {
    let radios = 0;
    let detectors = 0;
    let safety = 0;
    let overdueCalib = 0;

    equipment.forEach((item) => {
      const type = item.equipment_type.toUpperCase();
      if (type.includes("GAS") || type.includes("MONITOR") || type.includes("DETECTOR")) {
        detectors++;
        const cal = evaluateCalibration(item);
        if (cal.status === "EXPIRED" || cal.status === "REQUIRED") overdueCalib++;
      } else if (type.includes("SAFETY") || type.includes("HARNESS") || type.includes("SCSR") || type.includes("RESPIRATOR")) {
        safety++;
      } else {
        radios++;
      }
    });

    return { total: equipment.length, radios, detectors, safety, overdueCalib };
  }, [equipment]);

  const filtered = useMemo(() => {
    return equipment.filter((item) => {
      const type = item.equipment_type.toUpperCase();
      const isRadio = type.includes("RADIO");
      const isDetector = type.includes("GAS") || type.includes("MONITOR") || type.includes("DETECTOR");
      const isSafety = type.includes("SAFETY") || type.includes("HARNESS") || type.includes("SCSR") || type.includes("RESPIRATOR");

      if (typeTab === "radios" && !isRadio) return false;
      if (typeTab === "detectors" && !isDetector) return false;
      if (typeTab === "safety" && !isSafety) return false;

      if (statusFilter !== "all" && item.status !== statusFilter) return false;

      if (calibFilter !== "all") {
        const cal = evaluateCalibration(item);
        if (calibFilter === "valid" && cal.status !== "VALID") return false;
        if (calibFilter === "expiring_soon" && cal.status !== "EXPIRING_SOON") return false;
        if (calibFilter === "expired" && cal.status !== "EXPIRED") return false;
        if (calibFilter === "required" && cal.status !== "REQUIRED") return false;
      }

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.radio_id.toLowerCase().includes(q) ||
        (item.model_name && item.model_name.toLowerCase().includes(q)) ||
        (item.serial_number && item.serial_number.toLowerCase().includes(q)) ||
        (item.barcode && item.barcode.toLowerCase().includes(q)) ||
        (item.rfid_tag && item.rfid_tag.toLowerCase().includes(q)) ||
        (item.assigned_to && `${item.assigned_to.first_name} ${item.assigned_to.surname}`.toLowerCase().includes(q))
      );
    });
  }, [equipment, typeTab, statusFilter, calibFilter, search]);

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/90 text-white font-mono text-xs shadow-2xl backdrop-blur-md border border-emerald-400/40">
          <IconCheck size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Equipment &amp; Radio Registers ({equipment.length})
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Two-way radios, multi-gas monitors, portable safety gear &amp; mandatory calibration control.
          </p>
        </div>

        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search equipment ID, barcode, serial, model..."
            className="min-h-[48px] w-64 sm:w-80 rounded-xl bg-black/50 border border-white/15 pl-10 pr-4 text-xs text-white placeholder:text-neutral-500 focus:border-[#007AFF] focus:outline-none"
          />
          <IconSearch
            size={16}
            className="absolute left-3.5 top-4 text-neutral-500"
          />
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#141418]/80 border border-white/10 backdrop-blur-xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center border border-cyan-500/30 shrink-0">
            <IconRadio size={22} />
          </div>
          <div>
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">Two-Way Radios</span>
            <strong className="text-lg font-bold text-white font-mono">{counts.radios}</strong>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#141418]/80 border border-white/10 backdrop-blur-xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
            <IconGauge size={22} />
          </div>
          <div>
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">Gas Monitors</span>
            <strong className="text-lg font-bold text-white font-mono">{counts.detectors}</strong>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#141418]/80 border border-white/10 backdrop-blur-xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
            <IconLifebuoy size={22} />
          </div>
          <div>
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">Portable Safety</span>
            <strong className="text-lg font-bold text-white font-mono">{counts.safety}</strong>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#141418]/80 border border-white/10 backdrop-blur-xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
            <IconAlertTriangle size={22} />
          </div>
          <div>
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">Overdue / Calib Req</span>
            <strong className="text-lg font-bold text-rose-400 font-mono">{counts.overdueCalib}</strong>
          </div>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 p-1.5 bg-neutral-900/80 border border-white/10 rounded-2xl">
          <button
            type="button"
            onClick={() => setTypeTab("all")}
            className={`min-h-[48px] px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              typeTab === "all"
                ? "bg-[#007AFF] text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            All Equipment ({equipment.length})
          </button>
          <button
            type="button"
            onClick={() => setTypeTab("radios")}
            className={`min-h-[48px] px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
              typeTab === "radios"
                ? "bg-[#007AFF] text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <IconRadio size={16} />
            <span>Two-Way Radios ({counts.radios})</span>
          </button>
          <button
            type="button"
            onClick={() => setTypeTab("detectors")}
            className={`min-h-[48px] px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
              typeTab === "detectors"
                ? "bg-[#007AFF] text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <IconGauge size={16} />
            <span>Gas Monitors ({counts.detectors})</span>
          </button>
          <button
            type="button"
            onClick={() => setTypeTab("safety")}
            className={`min-h-[48px] px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
              typeTab === "safety"
                ? "bg-[#007AFF] text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <IconLifebuoy size={16} />
            <span>Portable Safety ({counts.safety})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={calibFilter}
            onChange={(e) => setCalibFilter(e.target.value)}
            className="min-h-[48px] px-3 rounded-xl bg-black/50 border border-white/15 text-xs text-white font-mono focus:border-[#007AFF] focus:outline-none"
          >
            <option value="all">All Calibration Statuses</option>
            <option value="valid">VALID (Calibrated)</option>
            <option value="expiring_soon">EXPIRING SOON (≤30d)</option>
            <option value="expired">EXPIRED</option>
            <option value="required">CALIBRATION REQUIRED</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[48px] px-3 rounded-xl bg-black/50 border border-white/15 text-xs text-white font-mono focus:border-[#007AFF] focus:outline-none"
          >
            <option value="all">All Operational Statuses</option>
            <option value="Active">Active</option>
            <option value="Assigned">Assigned</option>
            <option value="Out of Calibration">Out of Calibration</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Decommissioned">Decommissioned</option>
          </select>
        </div>
      </div>

      {/* Grid of Equipment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => {
          const type = item.equipment_type.toUpperCase();
          const isGasMonitor = type.includes("GAS") || type.includes("MONITOR") || type.includes("DETECTOR");
          const isSafety = type.includes("SAFETY") || type.includes("HARNESS") || type.includes("SCSR") || type.includes("RESPIRATOR");
          const calib = evaluateCalibration(item);

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-[#18181b]/80 backdrop-blur-xl p-5 space-y-3.5 shadow-lg hover:border-white/20 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-11 w-11 rounded-xl flex items-center justify-center border ${
                        isGasMonitor
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          : isSafety
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                      }`}
                    >
                      {isGasMonitor ? (
                        <IconGauge size={24} />
                      ) : isSafety ? (
                        <IconLifebuoy size={24} />
                      ) : (
                        <IconRadio size={24} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white font-mono">
                        {item.radio_id}
                      </h3>
                      <span className="text-[11px] font-mono text-neutral-400 block">
                        {item.model_name || item.equipment_type}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full border ${
                      item.status === "Active"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : item.status === "Assigned"
                        ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                        : item.status === "Out of Calibration"
                        ? "bg-rose-500/15 text-rose-300 border-rose-500/30 animate-pulse"
                        : "bg-red-500/15 text-red-300 border-red-500/30"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                {/* Specs Box */}
                <div className="mt-3.5 p-3 rounded-xl bg-black/40 border border-white/5 text-xs font-mono space-y-2 text-neutral-300">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 flex items-center gap-1">
                      <IconBarcode size={13} />
                      <span>Barcode:</span>
                    </span>
                    <code className="text-white bg-white/10 px-2 py-0.5 rounded text-[11px]">
                      {item.barcode || "None"}
                    </code>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">RFID Tag:</span>
                    <code className="text-purple-300">{item.rfid_tag || "None"}</code>
                  </div>

                  {item.serial_number && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Serial No:</span>
                      <span className="text-neutral-400">{item.serial_number}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <span className="text-neutral-500 flex items-center gap-1">
                      <IconUser size={13} />
                      <span>Assigned:</span>
                    </span>
                    <span className="text-neutral-200 truncate max-w-[160px]">
                      {item.assigned_to
                        ? `${item.assigned_to.first_name} ${item.assigned_to.surname} (${item.assigned_to.emp_code})`
                        : "Pool / Unassigned"}
                    </span>
                  </div>

                  {/* Gas Monitor Mandatory Calibration Section */}
                  {isGasMonitor && (
                    <div className="pt-2 border-t border-white/10 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400 font-bold flex items-center gap-1">
                          <IconGauge size={13} className="text-amber-400" />
                          <span>Calibration Status:</span>
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            calib.status === "VALID"
                              ? "text-emerald-300 bg-emerald-500/15 border border-emerald-500/30"
                              : calib.status === "EXPIRING_SOON"
                              ? "text-amber-300 bg-amber-500/15 border border-amber-500/30"
                              : "text-rose-300 bg-rose-500/20 border border-rose-500/40 animate-pulse"
                          }`}
                        >
                          {calib.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-500">Calibration Expiry:</span>
                        <span className="text-neutral-300 font-mono">
                          {item.calibration_expiry
                            ? new Date(item.calibration_expiry).toISOString().split("T")[0]
                            : "Missing / No Record"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                {isGasMonitor && (
                  <button
                    type="button"
                    onClick={() => setRecalibrateTarget(item)}
                    className="w-full min-h-[48px] rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <IconRefresh size={16} />
                    <span>Recalibrate Gas Monitor</span>
                  </button>
                )}

                <div className="text-[11px] font-mono text-neutral-500 flex items-center justify-between pt-1">
                  <span>Registered:</span>
                  <span>{new Date(item.created_at).toISOString().split("T")[0]}</span>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full p-12 text-center text-xs font-mono text-neutral-500 bg-[#18181b]/50 rounded-2xl border border-white/10">
            No equipment matched your filters.
          </div>
        )}
      </div>

      {/* Modal: Recalibrate Gas Monitor */}
      {recalibrateTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-white/15 rounded-2xl p-6 space-y-4 shadow-2xl font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm border border-amber-500/30">
                  <IconGauge size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Recalibrate {recalibrateTarget.radio_id}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    {recalibrateTarget.model_name || "Multi-Gas Detector"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRecalibrateTarget(null)}
                className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white cursor-pointer"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block text-neutral-300">
                Select Bump / Calibration Certificate Validity:
              </label>

              {/* Preset Validity Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "90 Days (Bump)", days: 90 },
                  { label: "180 Days (Standard)", days: 180 },
                  { label: "365 Days (Annual)", days: 365 },
                ].map((p) => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => setCalibDurationDays(p.days)}
                    className={`min-h-[48px] rounded-xl border text-xs font-bold transition cursor-pointer p-2 text-center ${
                      calibDurationDays === p.days
                        ? "bg-amber-500/25 text-amber-300 border-amber-500"
                        : "bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-black/50 border border-white/5 space-y-1 text-[11px] text-neutral-400">
                <div>Current Calibration: {recalibrateTarget.calibration_expiry ? new Date(recalibrateTarget.calibration_expiry).toISOString().split("T")[0] : "None"}</div>
                <div className="text-emerald-400 font-bold">
                  New Calibration Expiry:{" "}
                  {
                    new Date(Date.now() + calibDurationDays * 24 * 60 * 60 * 1000)
                      .toISOString()
                      .split("T")[0]
                  }
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRecalibrateTarget(null)}
                className="min-h-[48px] px-4 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-neutral-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRecalibrating}
                onClick={handleRecalibrate}
                className="min-h-[48px] px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs text-white font-bold cursor-pointer disabled:opacity-50 transition"
              >
                {isRecalibrating ? "Applying..." : "Confirm Recalibration"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

