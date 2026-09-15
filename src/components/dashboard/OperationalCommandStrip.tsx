"use client";

import { useState, useEffect, useCallback } from "react";
import {
  IconShieldCheck,
  IconShieldExclamation,
  IconLockOpen,
  IconRefresh,
  IconClock,
  IconUsers,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconDoor,
  IconChevronDown,
  IconFlame,
  IconActivity,
} from "@tabler/icons-react";

interface OperationalCommandStripProps {
  selectedSite: string;
  musterCount: number;
  lastUpdated: string;
  onRefresh: () => void | Promise<void>;
}

export default function OperationalCommandStrip({
  selectedSite,
  musterCount,
  lastUpdated,
  onRefresh,
}: OperationalCommandStripProps) {
  // Live Clock State
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [shiftName, setShiftName] = useState<string>("Day Shift");

  // System State
  const [isLockdown, setIsLockdown] = useState<boolean>(false);
  const [lockdownReason, setLockdownReason] = useState<string>("");
  const [availableGates, setAvailableGates] = useState<string[]>([
    "Brakfontein - Main Gate",
    "Thando Tech - Remote Turnstile",
    "Optimum - Port 9100",
    "Brakfontein - North Pit Portal",
    "Head Office - Mobile Terminal",
  ]);

  // Modals & User Feedback
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [showLockdownModal, setShowLockdownModal] = useState<boolean>(false);
  const [selectedGate, setSelectedGate] = useState<string>("Brakfontein - Main Gate");
  const [pulseDuration, setPulseDuration] = useState<number>(15);
  const [overrideReason, setOverrideReason] = useState<string>("Manual Security Release");
  const [lockdownReasonInput, setLockdownReasonInput] = useState<string>("Precautionary Security Protocol");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [bannerNotice, setBannerNotice] = useState<{ type: "success" | "alert" | "info"; msg: string } | null>(null);

  // Active override countdown
  const [overrideCountdown, setOverrideCountdown] = useState<{ gate: string; secondsLeft: number } | null>(null);

  // 1. Live Clock & Shift detection
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-ZA", { hour12: false }));
      setCurrentDate(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      );
      const hour = now.getHours();
      if (hour >= 6 && hour < 18) {
        setShiftName("Day Ops • Alpha");
      } else {
        setShiftName("Night Ops • Bravo");
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Countdown timer for gate override pulse
  const isCountingDown = Boolean(overrideCountdown);

  useEffect(() => {
    if (!isCountingDown) return;
    const interval = setInterval(() => {
      setOverrideCountdown((prev) => {
        if (!prev || prev.secondsLeft <= 1) return null;
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isCountingDown]);

  // 3. Fetch Command Status from Server
  const fetchCommandStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/command", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setIsLockdown(Boolean(data.lockdown));
        if (data.lockdownReason) setLockdownReason(data.lockdownReason);
        if (Array.isArray(data.gates) && data.gates.length > 0) {
          setAvailableGates(data.gates);
          setSelectedGate((current) => current || data.gates[0]);
        }
      }
    } catch {
      // offline fallback maintains current state
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCommandStatus();
    }, 0);
    const interval = setInterval(fetchCommandStatus, 5000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [fetchCommandStatus]);

  // Handlers
  const handleInstantSync = async () => {
    setIsSyncing(true);
    try {
      await Promise.all([onRefresh(), fetchCommandStatus()]);
      setBannerNotice({ type: "info", msg: "Dashboard & Hardware Edge Synced" });
      setTimeout(() => setBannerNotice(null), 3000);
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  const handleToggleLockdown = async (enable: boolean, reasonText?: string) => {
    try {
      const res = await fetch("/api/dashboard/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TOGGLE_LOCKDOWN",
          lockdown: enable,
          reason: reasonText || "Operational Command Protocol",
          operator: "Console Supervisor",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsLockdown(data.lockdown);
        setLockdownReason(data.lockdownReason || "");
        setShowLockdownModal(false);
        setBannerNotice({
          type: enable ? "alert" : "success",
          msg: enable
            ? "PERIMETER LOCKDOWN ACTIVATED: All access gates secured"
            : "LOCKDOWN CLEARED: All access gates restored to nominal mode",
        });
        setTimeout(() => setBannerNotice(null), 4000);
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to toggle lockdown:", err);
    }
  };

  const handleSendGateOverride = async () => {
    try {
      const res = await fetch("/api/dashboard/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GATE_OVERRIDE",
          gate: selectedGate,
          durationSeconds: pulseDuration,
          reason: overrideReason,
          operator: "Console Supervisor",
        }),
      });
      if (res.ok) {
        setShowOverrideModal(false);
        setOverrideCountdown({
          gate: selectedGate,
          secondsLeft: pulseDuration,
        });
        setBannerNotice({
          type: "success",
          msg: `Gate pulse dispatched to ${selectedGate} (${pulseDuration}s unlock)`,
        });
        setTimeout(() => setBannerNotice(null), 4000);
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to send gate override:", err);
    }
  };

  return (
    <div className="relative">
      {/* Main Operational Command Strip */}
      <div
        className={`relative overflow-hidden rounded-2xl border transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.36)] backdrop-blur-2xl ${
          isLockdown
            ? "bg-red-950/40 border-red-500/40 shadow-[0_0_25px_rgba(239,68,68,0.2)]"
            : "bg-[#141418]/80 border-white/10 hover:border-white/20"
        }`}
      >
        {/* Subtle macOS Top Acrylic Highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between p-3.5 sm:p-4 gap-4">
          {/* LEFT: Perimeter Status & Site Identity */}
          <div className="flex items-center gap-3.5">
            {/* Status Beacon Icon */}
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all ${
                isLockdown
                  ? "bg-red-500/15 border-red-500/40 text-red-400 animate-pulse"
                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              }`}
            >
              {isLockdown ? (
                <IconShieldExclamation size={24} className="stroke-[2.2]" />
              ) : (
                <IconShieldCheck size={24} className="stroke-[2.2]" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-xs font-bold tracking-wider uppercase font-mono px-2 py-0.5 rounded-md ${
                    isLockdown
                      ? "bg-red-500/25 text-red-300 border border-red-500/40 animate-pulse"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {isLockdown ? "⚠ Restricted Lockdown Active" : "● Perimeter Secure"}
                </span>

                {/* On-Site Headcount Pill */}
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-neutral-300 text-xs font-mono">
                  <IconUsers size={12} className="text-[#007AFF]" />
                  <span>
                    <strong className="text-white font-semibold">{musterCount}</strong> On-Site
                  </span>
                </div>
              </div>

              <div className="text-xs text-neutral-400 font-sans truncate mt-1 flex items-center gap-1.5">
                <span className="text-neutral-200 font-medium">{selectedSite}</span>
                <span className="text-neutral-600">•</span>
                <span className="truncate">
                  {isLockdown
                    ? `Reason: ${lockdownReason || "Security Alert"}`
                    : "All gate controllers & turnstiles nominal"}
                </span>
              </div>
            </div>
          </div>

          {/* CENTER: Shift Telemetry & Live Clock */}
          <div className="flex flex-wrap items-center gap-3 py-1 px-3 rounded-xl bg-black/30 border border-white/5 lg:self-center">
            {/* Live Clock with Tabular Digits */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <IconClock size={14} className="text-neutral-400" />
              <span className="font-semibold text-white tracking-tight tabular-nums text-sm">
                {currentTime || "--:--:--"}
              </span>
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-sans">
                SAST
              </span>
            </div>

            <div className="h-3 w-px bg-white/10 hidden sm:block" />

            {/* Shift & Date Pill */}
            <div className="flex items-center gap-2 text-xs text-neutral-300 font-sans">
              <span className="px-1.5 py-0.5 rounded bg-white/5 text-[11px] font-mono text-neutral-400 border border-white/5">
                {shiftName}
              </span>
              <span className="text-neutral-500 text-xs hidden md:inline">
                {currentDate}
              </span>
            </div>

            <div className="h-3 w-px bg-white/10 hidden sm:block" />

            {/* Live Heartbeat / Sync Telemetry */}
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span className="hidden sm:inline">Edge: 2ms</span>
              {lastUpdated && (
                <span className="text-neutral-500 hidden xl:inline">
                  • Sync: {lastUpdated}
                </span>
              )}
            </div>
          </div>

          {/* RIGHT: Operational Quick Actions (Industrial / Kiosk Touch Standards) */}
          <div className="flex items-center flex-wrap gap-2.5 sm:justify-end">
            {/* Gate Override Button */}
            <button
              type="button"
              onClick={() => setShowOverrideModal(true)}
              className="flex items-center gap-2 min-h-[48px] px-4 py-2.5 rounded-xl border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] active:scale-[0.98] active:brightness-90 text-xs sm:text-sm font-sans font-medium text-neutral-200 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] cursor-pointer"
              title="Trigger Momentary Gate Unlock Pulse"
            >
              <IconDoor size={16} className="text-[#007AFF]" />
              <span>Gate Override</span>
            </button>

            {/* Instant Sync Button */}
            <button
              type="button"
              onClick={handleInstantSync}
              disabled={isSyncing}
              className="flex items-center gap-2 min-h-[48px] px-4 py-2.5 rounded-xl border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] active:scale-[0.98] active:brightness-90 disabled:opacity-50 text-xs sm:text-sm font-sans font-medium text-neutral-200 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] cursor-pointer"
              title="Force Immediate Data Sync"
            >
              <IconRefresh
                size={16}
                className={`text-neutral-300 ${isSyncing ? "animate-spin text-[#007AFF]" : ""}`}
              />
              <span className="hidden sm:inline">Sync</span>
            </button>

            {/* Emergency Lockdown Toggle Button - Glove Action Standard */}
            {isLockdown ? (
              <button
                type="button"
                onClick={() => handleToggleLockdown(false)}
                className="flex items-center gap-2 min-h-[48px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] active:brightness-90 text-white text-xs sm:text-sm font-sans font-semibold transition shadow-md shadow-emerald-950 cursor-pointer"
                title="Deactivate Perimeter Lockdown"
              >
                <IconLockOpen size={16} />
                <span>Release Lockdown</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowLockdownModal(true)}
                className="flex items-center gap-2 min-h-[48px] px-5 py-2.5 rounded-xl border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 active:scale-[0.98] active:brightness-90 text-xs sm:text-sm font-sans font-semibold text-red-200 transition shadow-[inset_0_1px_0_rgba(239,68,68,0.2)] cursor-pointer"
                title="Initiate Emergency Site Lockdown"
              >
                <IconShieldExclamation size={16} className="text-red-400" />
                <span>Lockdown</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Active Gate Override Pulse Notification Bar */}
        {overrideCountdown && (
          <div className="px-4 py-2 bg-[#007AFF]/15 border-t border-[#007AFF]/30 flex items-center justify-between text-xs font-mono text-[#58A6FF]">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#007AFF] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#007AFF]"></span>
              </span>
              <span>
                OVERRIDE PULSE ACTIVE: <strong>{overrideCountdown.gate}</strong> unlocked
              </span>
            </div>
            <div className="font-bold text-white bg-black/40 px-2 py-0.5 rounded border border-white/10">
              {overrideCountdown.secondsLeft}s remaining
            </div>
          </div>
        )}

        {/* Toast / Banner Notification */}
        {bannerNotice && (
          <div
            className={`px-4 py-2 border-t text-xs font-mono flex items-center gap-2 ${
              bannerNotice.type === "alert"
                ? "bg-red-500/20 border-red-500/40 text-red-200"
                : bannerNotice.type === "success"
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200"
                : "bg-[#007AFF]/20 border-[#007AFF]/40 text-blue-200"
            }`}
          >
            {bannerNotice.type === "alert" ? (
              <IconAlertTriangle size={14} className="text-red-400 shrink-0" />
            ) : bannerNotice.type === "success" ? (
              <IconCheck size={14} className="text-emerald-400 shrink-0" />
            ) : (
              <IconActivity size={14} className="text-blue-400 shrink-0" />
            )}
            <span>{bannerNotice.msg}</span>
          </div>
        )}
      </div>

      {/* MODAL 1: Gate Override Dialog */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-35 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-[#18181b]/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl space-y-5">
            {/* macOS Titlebar */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="h-3.5 w-3.5 rounded-full bg-[#FF5F56] border border-[#E0443E]/80 hover:opacity-80 transition cursor-pointer"
                  title="Close"
                />
                <div className="h-3.5 w-3.5 rounded-full bg-[#FFBD2E] border border-[#DEA123]/80" />
                <div className="h-3.5 w-3.5 rounded-full bg-[#27C93F] border border-[#1AAB29]/80" />
              </div>
              <div className="text-xs font-mono text-neutral-300 font-semibold">
                Gate Override Pulse Dispatch
              </div>
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans">
              {/* Target Gate Selector */}
              <div>
                <label className="block text-neutral-400 font-mono mb-1.5 text-[11px] uppercase tracking-wider">
                  Target Perimeter Gate / Barrier
                </label>
                <div className="relative">
                  <select
                    value={selectedGate}
                    onChange={(e) => setSelectedGate(e.target.value)}
                    className="w-full h-12 rounded-xl border border-white/15 bg-black/50 px-3.5 pr-8 text-neutral-100 text-sm font-medium focus:border-[#007AFF] focus:outline-none appearance-none cursor-pointer"
                  >
                    {availableGates.map((gate) => (
                      <option key={gate} value={gate} className="bg-neutral-900 text-neutral-100">
                        {gate}
                      </option>
                    ))}
                  </select>
                  <IconChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3.5 top-3.5 text-neutral-400"
                  />
                </div>
              </div>

              {/* Pulse Duration Segmented Selector */}
              <div>
                <label className="block text-neutral-400 font-mono mb-1.5 text-[11px] uppercase tracking-wider">
                  Momentary Unlock Duration
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { sec: 15, label: "15s (Pedestrian)" },
                    { sec: 30, label: "30s (Vehicle)" },
                    { sec: 60, label: "60s (Convoy)" },
                  ].map((d) => (
                    <button
                      key={d.sec}
                      type="button"
                      onClick={() => setPulseDuration(d.sec)}
                      className={`h-12 min-h-[48px] px-3 rounded-xl border text-xs font-mono transition active:scale-[0.98] cursor-pointer flex items-center justify-center text-center ${
                        pulseDuration === d.sec
                          ? "bg-[#007AFF] border-[#007AFF] text-white font-semibold shadow-sm"
                          : "bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason Input */}
              <div>
                <label className="block text-neutral-400 font-mono mb-1.5 text-[11px] uppercase tracking-wider">
                  Authorized Reason / Operator Audit Note
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. VIP Contractor Escort, RFID Failure Bypass"
                  className="w-full h-12 rounded-xl border border-white/15 bg-black/50 px-3.5 text-neutral-100 text-sm placeholder:text-neutral-500 focus:border-[#007AFF] focus:outline-none"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
                <IconAlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-400" />
                <span className="leading-relaxed">
                  This command triggers a hardware relay pulse to temporarily unlock the selected access barrier. An audit record will be logged immediately.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="min-h-[48px] px-5 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 active:scale-[0.98] text-neutral-300 text-xs sm:text-sm font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendGateOverride}
                className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0A84FF] active:scale-[0.98] active:brightness-90 text-white text-xs sm:text-sm font-semibold transition shadow-md cursor-pointer flex items-center gap-2"
              >
                <IconLockOpen size={16} />
                <span>Send Unlock Pulse ({pulseDuration}s)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Emergency Lockdown Guarded Confirmation Dialog */}
      {showLockdownModal && (
        <div className="fixed inset-0 z-35 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-red-500/40 bg-[#1a0f0f]/95 p-6 shadow-[0_20px_60px_rgba(239,68,68,0.25)] backdrop-blur-2xl space-y-5">
            {/* macOS Titlebar */}
            <div className="flex items-center justify-between pb-3 border-b border-red-500/20">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLockdownModal(false)}
                  className="h-3.5 w-3.5 rounded-full bg-[#FF5F56] border border-[#E0443E]/80 hover:opacity-80 transition cursor-pointer"
                  title="Close"
                />
                <div className="h-3.5 w-3.5 rounded-full bg-[#FFBD2E] border border-[#DEA123]/80" />
                <div className="h-3.5 w-3.5 rounded-full bg-[#27C93F] border border-[#1AAB29]/80" />
              </div>
              <div className="text-xs font-mono text-red-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <IconShieldExclamation size={16} />
                <span>Emergency Perimeter Lockdown Protocol</span>
              </div>
              <button
                type="button"
                onClick={() => setShowLockdownModal(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans">
              <div className="p-3.5 rounded-xl bg-red-900/30 border border-red-500/30 text-red-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-red-400 font-mono uppercase text-xs">
                  <IconFlame size={16} />
                  <span>High-Priority Security Action</span>
                </div>
                <p className="text-xs leading-relaxed">
                  Activating Emergency Lockdown restricts all automated gate turnstiles and vehicle barriers across <strong>{selectedSite}</strong>. Standard RFID credentials will be held for supervisor clearance until the restriction is lifted.
                </p>
              </div>

              {/* Quick Incident Preset Chips */}
              <div>
                <label className="block text-neutral-400 font-mono mb-1.5 text-[11px] uppercase tracking-wider">
                  Quick Incident Reason Preset
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Unscheduled Evacuation",
                    "Perimeter Breach",
                    "Muster Drill",
                    "Hazardous Gas Leak",
                    "Safety Roll-Call",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setLockdownReasonInput(chip)}
                      className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-mono border transition active:scale-[0.98] cursor-pointer ${
                        lockdownReasonInput === chip
                          ? "bg-red-500/30 border-red-500/60 text-red-200 font-semibold shadow-xs"
                          : "bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10"
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lockdown Reason Custom Input */}
              <div>
                <label className="block text-neutral-400 font-mono mb-1.5 text-[11px] uppercase tracking-wider">
                  Audit Incident Description
                </label>
                <input
                  type="text"
                  value={lockdownReasonInput}
                  onChange={(e) => setLockdownReasonInput(e.target.value)}
                  placeholder="Describe emergency reason"
                  className="w-full h-12 rounded-xl border border-red-500/30 bg-black/60 px-3.5 text-red-100 text-sm placeholder:text-neutral-600 focus:border-red-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-red-500/20">
              <button
                type="button"
                onClick={() => setShowLockdownModal(false)}
                className="min-h-[48px] px-5 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 active:scale-[0.98] text-neutral-300 text-xs sm:text-sm font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleToggleLockdown(true, lockdownReasonInput)}
                className="min-h-[56px] h-14 px-6 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] active:brightness-90 text-white text-xs sm:text-sm font-bold transition shadow-lg shadow-red-950 cursor-pointer flex items-center gap-2"
              >
                <IconShieldExclamation size={18} />
                <span>Confirm Immediate Lockdown</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
