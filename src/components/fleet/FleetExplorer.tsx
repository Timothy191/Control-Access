"use client";

import { useState, useMemo } from "react";
import {
  IconTruck,
  IconCar,
  IconHistory,
  IconShieldCheck,
  IconShieldX,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconX,
  IconSearch,
  IconCertificate,
  IconGauge,
  IconFileCertificate,
  IconUser,
  IconPlus,
  IconCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";

export interface Vehicle {
  id: number;
  fleet_id: string;
  machine_id?: string | null;
  vehicle_type?: string;
  is_heavy_fleet?: boolean;
  make?: string | null;
  model?: string | null;
  license_plate?: string | null;
  license_disc_expiry?: string | Date | null;
  roadworthy_expiry?: string | Date | null;
  registration_expiry?: string | Date | null;
  operational_hours?: number | null;
  required_certification?: string | null;
  owner_id?: number | null;
  owner?: {
    id: number;
    emp_code: string;
    first_name: string;
    surname: string;
  } | null;
  qr_code: string | null;
  rfid_tag: string | null;
  status: string;
  created_at: string | Date;
}

interface VehicleLog {
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

export function evaluateExpiry(dateVal?: string | Date | null) {
  if (!dateVal) return { status: "missing", label: "Not Registered", days: null, color: "neutral" };
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return { status: "missing", label: "Invalid Date", days: null, color: "neutral" };
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { status: "expired", label: `Expired (${Math.abs(diffDays)}d ago)`, days: diffDays, color: "red" };
  if (diffDays <= 30) return { status: "warning", label: `Expires in ${diffDays}d`, days: diffDays, color: "yellow" };
  return { status: "valid", label: `Valid (${diffDays}d)`, days: diffDays, color: "green" };
}

export default function FleetExplorer({ vehicles: initialVehicles }: { vehicles: Vehicle[] }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [vehicleTab, setVehicleTab] = useState<"all" | "heavy" | "personal">("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [complianceFilter, setComplianceFilter] = useState("all");

  // Operational Hours Increment Modal State
  const [incrementModalVehicle, setIncrementModalVehicle] = useState<Vehicle | null>(null);
  const [hoursToAdd, setHoursToAdd] = useState<string>("50");
  const [isSubmittingHours, setIsSubmittingHours] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // History Drawer State
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicleLogs, setVehicleLogs] = useState<VehicleLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleIncrementHours = async () => {
    if (!incrementModalVehicle) return;
    const increment = parseFloat(hoursToAdd);
    if (isNaN(increment) || increment <= 0) {
      alert("Please enter a valid positive number of hours.");
      return;
    }

    setIsSubmittingHours(true);
    try {
      const res = await fetch("/api/fleet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: incrementModalVehicle.id,
          hours_increment: increment,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update operational hours");
      }

      const data = await res.json();
      const newHours = data.vehicle?.operational_hours ?? (incrementModalVehicle.operational_hours || 0) + increment;

      setVehicles((prev) =>
        prev.map((v) => (v.id === incrementModalVehicle.id ? { ...v, operational_hours: newHours } : v))
      );

      showToast(`Logged +${increment} operational hours for ${incrementModalVehicle.fleet_id} (Total: ${newHours.toFixed(1)} hrs)`);
      setIncrementModalVehicle(null);
    } catch (error) {
      alert(String(error));
    } finally {
      setIsSubmittingHours(false);
    }
  };

  const handleOpenHistory = async (veh: Vehicle) => {
    setSelectedVehicle(veh);
    setIsLoadingLogs(true);
    setVehicleLogs([]);
    try {
      const res = await fetch(`/api/logs?vehicleId=${veh.id}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        if (data.logs) {
          setVehicleLogs(data.logs);
        }
      }
    } catch (err) {
      console.error("Failed to load vehicle logs:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const counts = useMemo(() => {
    let heavy = 0;
    let personal = 0;
    let expiredDiscs = 0;
    let expiredRoadworthy = 0;

    vehicles.forEach((v) => {
      const isHeavy = v.is_heavy_fleet ?? (v.vehicle_type !== "PERSONAL");
      if (isHeavy) heavy++;
      else {
        personal++;
        const disc = evaluateExpiry(v.license_disc_expiry);
        const rw = evaluateExpiry(v.roadworthy_expiry);
        if (disc.status === "expired") expiredDiscs++;
        if (rw.status === "expired") expiredRoadworthy++;
      }
    });

    return { total: vehicles.length, heavy, personal, expiredDiscs, expiredRoadworthy };
  }, [vehicles]);

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      const isHeavy = v.is_heavy_fleet ?? (v.vehicle_type !== "PERSONAL");
      if (vehicleTab === "heavy" && !isHeavy) return false;
      if (vehicleTab === "personal" && isHeavy) return false;

      if (statusFilter !== "all" && v.status !== statusFilter) return false;

      if (complianceFilter !== "all") {
        const disc = evaluateExpiry(v.license_disc_expiry);
        const rw = evaluateExpiry(v.roadworthy_expiry);
        if (complianceFilter === "expired") {
          if (disc.status !== "expired" && rw.status !== "expired") return false;
        } else if (complianceFilter === "valid") {
          if (disc.status !== "valid" || rw.status !== "valid") return false;
        } else if (complianceFilter === "warning") {
          if (disc.status !== "warning" && rw.status !== "warning") return false;
        }
      }

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        v.fleet_id.toLowerCase().includes(q) ||
        (v.machine_id && v.machine_id.toLowerCase().includes(q)) ||
        (v.license_plate && v.license_plate.toLowerCase().includes(q)) ||
        (v.make && v.make.toLowerCase().includes(q)) ||
        (v.model && v.model.toLowerCase().includes(q)) ||
        (v.owner && `${v.owner.first_name} ${v.owner.surname}`.toLowerCase().includes(q)) ||
        (v.qr_code && v.qr_code.toLowerCase().includes(q)) ||
        (v.rfid_tag && v.rfid_tag.toLowerCase().includes(q))
      );
    });
  }, [vehicles, vehicleTab, statusFilter, complianceFilter, search]);

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/90 text-white font-mono text-xs shadow-2xl backdrop-blur-md border border-emerald-400/40">
          <IconCheck size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header and Summary KPIs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Fleet &amp; Vehicle Registers ({vehicles.length})
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Mine earth-moving machinery, personal staff vehicles, license disc renewals &amp; operator permits.
          </p>
        </div>

        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fleet ID, machine ID, plate, model..."
            className="min-h-[48px] w-64 sm:w-80 rounded-xl bg-black/50 border border-white/15 pl-10 pr-4 text-xs text-white placeholder:text-neutral-500 focus:border-[#007AFF] focus:outline-none"
          />
          <IconSearch
            size={16}
            className="absolute left-3.5 top-4 text-neutral-500"
          />
        </div>
      </div>

      {/* Metric Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#141418]/80 border border-white/10 backdrop-blur-xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center border border-purple-500/30 shrink-0">
            <IconTruck size={22} />
          </div>
          <div>
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">Heavy Machinery</span>
            <strong className="text-lg font-bold text-white font-mono">{counts.heavy}</strong>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#141418]/80 border border-white/10 backdrop-blur-xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
            <IconCar size={22} />
          </div>
          <div>
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">Personal Vehicles</span>
            <strong className="text-lg font-bold text-white font-mono">{counts.personal}</strong>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#141418]/80 border border-white/10 backdrop-blur-xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
            <IconFileCertificate size={22} />
          </div>
          <div>
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">Discs Expired</span>
            <strong className="text-lg font-bold text-amber-300 font-mono">{counts.expiredDiscs}</strong>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#141418]/80 border border-white/10 backdrop-blur-xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
            <IconAlertTriangle size={22} />
          </div>
          <div>
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">Roadworthy Expired</span>
            <strong className="text-lg font-bold text-rose-400 font-mono">{counts.expiredRoadworthy}</strong>
          </div>
        </div>
      </div>

      {/* Tabs and Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 p-1.5 bg-neutral-900/80 border border-white/10 rounded-2xl">
          <button
            type="button"
            onClick={() => setVehicleTab("all")}
            className={`min-h-[48px] px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
              vehicleTab === "all"
                ? "bg-[#007AFF] text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            All Fleet ({vehicles.length})
          </button>
          <button
            type="button"
            onClick={() => setVehicleTab("heavy")}
            className={`min-h-[48px] px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
              vehicleTab === "heavy"
                ? "bg-[#007AFF] text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <IconTruck size={16} />
            <span>Heavy Earth-Moving Fleet ({counts.heavy})</span>
          </button>
          <button
            type="button"
            onClick={() => setVehicleTab("personal")}
            className={`min-h-[48px] px-4 py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
              vehicleTab === "personal"
                ? "bg-[#007AFF] text-white shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <IconCar size={16} />
            <span>Personal Staff Vehicles ({counts.personal})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={complianceFilter}
            onChange={(e) => setComplianceFilter(e.target.value)}
            className="min-h-[48px] px-3 rounded-xl bg-black/50 border border-white/15 text-xs text-white font-mono focus:border-[#007AFF] focus:outline-none"
          >
            <option value="all">All Compliance</option>
            <option value="valid">100% Valid Only</option>
            <option value="warning">Expiring Soon (≤30d)</option>
            <option value="expired">Expired Disc/Roadworthy</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[48px] px-3 rounded-xl bg-black/50 border border-white/15 text-xs text-white font-mono focus:border-[#007AFF] focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Decommissioned">Decommissioned</option>
          </select>
        </div>
      </div>

      {/* Grid of Vehicle Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((vehicle) => {
          const isHeavy = vehicle.is_heavy_fleet ?? (vehicle.vehicle_type !== "PERSONAL");
          const disc = evaluateExpiry(vehicle.license_disc_expiry);
          const rw = evaluateExpiry(vehicle.roadworthy_expiry);

          return (
            <div
              key={vehicle.id}
              className="rounded-2xl border border-white/10 bg-[#18181b]/80 backdrop-blur-xl p-5 space-y-3.5 shadow-lg hover:border-white/20 transition flex flex-col justify-between"
            >
              <div>
                {/* Header of Card */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-11 w-11 rounded-xl flex items-center justify-center border ${
                        isHeavy
                          ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                          : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                      }`}
                    >
                      {isHeavy ? <IconTruck size={24} /> : <IconCar size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-bold text-white font-mono">
                          {isHeavy ? (vehicle.machine_id || vehicle.fleet_id) : (vehicle.license_plate || vehicle.fleet_id)}
                        </h3>
                      </div>
                      <span className="text-[11px] font-mono text-neutral-400 block">
                        {isHeavy
                          ? `Fleet ID: ${vehicle.fleet_id}`
                          : `${vehicle.make || ""} ${vehicle.model || "Personal Vehicle"}`}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full border ${
                      vehicle.status === "Active"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-red-500/15 text-red-300 border-red-500/30"
                    }`}
                  >
                    {vehicle.status}
                  </span>
                </div>

                {/* Heavy Fleet Machinery Specific Specs */}
                {isHeavy ? (
                  <div className="mt-3.5 p-3 rounded-xl bg-black/40 border border-white/5 text-xs font-mono space-y-2 text-neutral-300">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500 flex items-center gap-1">
                        <IconGauge size={13} />
                        <span>Op Hours:</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <strong className="text-purple-300 font-bold text-sm">
                          {vehicle.operational_hours !== null && vehicle.operational_hours !== undefined
                            ? `${vehicle.operational_hours.toFixed(1)} hrs`
                            : "0.0 hrs"}
                        </strong>
                        <button
                          type="button"
                          onClick={() => {
                            setIncrementModalVehicle(vehicle);
                            setHoursToAdd("50");
                          }}
                          className="min-h-[32px] px-2 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                          title="Log / Increment Engine Hours"
                        >
                          <IconPlus size={12} />
                          <span>Log</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-neutral-500 flex items-center gap-1">
                        <IconCertificate size={13} />
                        <span>Prereq Cert:</span>
                      </span>
                      <code className="text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded text-[10px] border border-amber-500/25">
                        {vehicle.required_certification || "STANDARD_HEAVY"}
                      </code>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                      <span className="text-neutral-500">Make &amp; Model:</span>
                      <span className="text-neutral-300 truncate max-w-[170px]">
                        {vehicle.make || "Caterpillar"} {vehicle.model || "Mine Spec"}
                      </span>
                    </div>

                    <div className="flex justify-between pt-1 border-t border-white/5 text-[11px]">
                      <span className="text-neutral-500">RFID Tag:</span>
                      <code className="text-neutral-400">{vehicle.rfid_tag || "None"}</code>
                    </div>
                  </div>
                ) : (
                  /* Personal Vehicle Specific Specs */
                  <div className="mt-3.5 p-3 rounded-xl bg-black/40 border border-white/5 text-xs font-mono space-y-2 text-neutral-300">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500 flex items-center gap-1">
                        <IconFileCertificate size={13} />
                        <span>Plate:</span>
                      </span>
                      <code className="text-white bg-white/10 px-2 py-0.5 rounded text-[12px] font-bold tracking-wider border border-white/15">
                        {vehicle.license_plate || "UNREGISTERED"}
                      </code>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500 flex items-center gap-1">
                        <IconUser size={13} />
                        <span>Owner:</span>
                      </span>
                      <span className="text-neutral-200 truncate max-w-[160px]">
                        {vehicle.owner ? `${vehicle.owner.first_name} ${vehicle.owner.surname} (${vehicle.owner.emp_code})` : "Unassigned"}
                      </span>
                    </div>

                    {/* License Disc Countdown */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-neutral-500">License Disc:</span>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            disc.color === "green"
                              ? "text-emerald-300 bg-emerald-500/15 border border-emerald-500/30"
                              : disc.color === "yellow"
                              ? "text-amber-300 bg-amber-500/15 border border-amber-500/30"
                              : "text-red-300 bg-red-500/15 border border-red-500/30"
                          }`}
                        >
                          {disc.label}
                        </span>
                        {vehicle.license_disc_expiry && (
                          <span className="block text-[9px] text-neutral-500 mt-0.5">
                            {new Date(vehicle.license_disc_expiry).toISOString().split("T")[0]}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Roadworthy Expiry */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-neutral-500">Roadworthy:</span>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            rw.color === "green"
                              ? "text-emerald-300 bg-emerald-500/15 border border-emerald-500/30"
                              : rw.color === "yellow"
                              ? "text-amber-300 bg-amber-500/15 border border-amber-500/30"
                              : "text-red-300 bg-red-500/15 border border-red-500/30"
                          }`}
                        >
                          {rw.label}
                        </span>
                        {vehicle.roadworthy_expiry && (
                          <span className="block text-[9px] text-neutral-500 mt-0.5">
                            {new Date(vehicle.roadworthy_expiry).toISOString().split("T")[0]}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between pt-1 border-t border-white/5 text-[11px]">
                      <span className="text-neutral-500">RFID:</span>
                      <code className="text-neutral-400">{vehicle.rfid_tag || "None"}</code>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button: View History */}
              <button
                type="button"
                onClick={() => handleOpenHistory(vehicle)}
                className="w-full min-h-[48px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-white flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <IconHistory size={16} className="text-[#007AFF]" />
                <span>View Gate History Logs</span>
              </button>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full p-12 text-center text-xs font-mono text-neutral-500 bg-[#18181b]/50 rounded-2xl border border-white/10">
            No vehicles matched your search and filter criteria.
          </div>
        )}
      </div>

      {/* Modal: Operational Hours Quick Increment */}
      {incrementModalVehicle && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-white/15 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm border border-purple-500/30">
                  <IconGauge size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono">
                    Log Hours: {incrementModalVehicle.fleet_id}
                  </h3>
                  <p className="text-xs font-mono text-neutral-400">
                    Current Engine Hours: {(incrementModalVehicle.operational_hours || 0).toFixed(1)} hrs
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIncrementModalVehicle(null)}
                className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white cursor-pointer"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <label className="block text-neutral-300">
                Hours to Add (Shift Ingress / Telemetry Update):
              </label>

              {/* Preset Buttons (Glove Friendly min 48px) */}
              <div className="grid grid-cols-4 gap-2">
                {["10", "25", "50", "100"].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setHoursToAdd(val)}
                    className={`min-h-[48px] rounded-xl border text-xs font-bold transition cursor-pointer ${
                      hoursToAdd === val
                        ? "bg-purple-600 text-white border-purple-400"
                        : "bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    +{val}h
                  </button>
                ))}
              </div>

              <input
                type="number"
                step="0.1"
                min="0.1"
                value={hoursToAdd}
                onChange={(e) => setHoursToAdd(e.target.value)}
                placeholder="Custom hours increment..."
                className="w-full min-h-[48px] rounded-xl bg-black/60 border border-white/15 px-4 text-sm text-white font-mono focus:border-purple-400 focus:outline-none"
              />

              <p className="text-[11px] text-neutral-500">
                New Total: {((incrementModalVehicle.operational_hours || 0) + (parseFloat(hoursToAdd) || 0)).toFixed(1)} hrs
              </p>
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3 font-mono">
              <button
                type="button"
                onClick={() => setIncrementModalVehicle(null)}
                className="min-h-[48px] px-4 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-neutral-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingHours}
                onClick={handleIncrementHours}
                className="min-h-[48px] px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs text-white font-bold cursor-pointer disabled:opacity-50 transition"
              >
                {isSubmittingHours ? "Saving..." : "Confirm & Update Hours"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Drawer Modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-neutral-900 border border-white/15 rounded-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm border border-purple-500/30">
                  <IconTruck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Vehicle {selectedVehicle.fleet_id}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <span>RFID: {selectedVehicle.rfid_tag || "N/A"}</span>
                    <span>•</span>
                    <span className="text-emerald-400">{selectedVehicle.status}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedVehicle(null)}
                className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white cursor-pointer"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <div className="flex items-center justify-between text-xs text-neutral-400 pb-1">
                <span>Gate Ingress &amp; Egress Events</span>
                <span>{vehicleLogs.length} total events</span>
              </div>

              {isLoadingLogs ? (
                <div className="py-12 text-center text-xs text-neutral-400 space-y-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-400 border-t-transparent mx-auto" />
                  <p>Loading vehicle gate history...</p>
                </div>
              ) : vehicleLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-500 bg-black/40 rounded-xl border border-white/5">
                  No gate scans logged for this vehicle yet.
                </div>
              ) : (
                vehicleLogs.map((log) => {
                  const d = log.scanned_at ? new Date(log.scanned_at) : new Date();
                  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                  const dayOfWeek = log.day_of_week || dayNames[d.getDay()];
                  const dateStr = log.date || d.toISOString().split("T")[0];
                  const timeStr = log.time || d.toLocaleTimeString();
                  const shiftStr = log.shift || (d.getHours() >= 6 && d.getHours() < 18 ? "Day Shift" : "Night Shift");

                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-black/50 border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs hover:bg-white/[0.02] transition"
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
                onClick={() => setSelectedVehicle(null)}
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white cursor-pointer"
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

