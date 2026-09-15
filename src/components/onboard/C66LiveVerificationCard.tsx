"use client";

import { useState, useCallback } from "react";
import { useScanEvents } from "@/hooks/useScanEvents";
import type { DeviceNotification } from "@/lib/device-notifications";
import {
  IconRadio,
  IconCheck,
  IconX,
  IconScan,
  IconDeviceMobile,
  IconArrowUpRight,
  IconShieldCheck,
  IconCpu,
  IconRefresh,
} from "@tabler/icons-react";

interface C66LiveVerificationCardProps {
  tunnelUrl: string;
}

export default function C66LiveVerificationCard({ tunnelUrl }: C66LiveVerificationCardProps) {
  const [lastLiveScan, setLastLiveScan] = useState<DeviceNotification | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [pulseActive, setPulseActive] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleIncomingScan = useCallback((event: DeviceNotification) => {
    setLastLiveScan(event);
    setScanCount((c) => c + 1);
    setPulseActive(true);
    setTimeout(() => setPulseActive(false), 2500);

    // Audio chime on PC
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = event.severity === "success" ? "sine" : "sawtooth";
        osc.frequency.setValueAtTime(event.severity === "success" ? 880 : 220, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {}
  }, []);

  const { status, connectionMode } = useScanEvents({
    deviceId: "ALL",
    onScanEvent: handleIncomingScan,
    onAlert: handleIncomingScan,
  });

  const handleSimulateScan = async () => {
    setIsSimulating(true);
    try {
      await fetch("/api/scanner/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawData: "EPC:TEST-C66-" + Math.floor(1000 + Math.random() * 9000),
          rfidTag: "RFID-EMP-00001",
          deviceId: "Chainway-C66-Test",
          deviceType: "Chainway C66 UHF Handheld",
          gateLocation: "Main Ingress Gate 1",
          operator: "Live Verification Test",
        }),
      });
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className={`glass-card p-6 border transition-all duration-500 relative overflow-hidden ${
      pulseActive
        ? lastLiveScan?.severity === "danger"
          ? "border-red-500 shadow-2xl shadow-red-500/25 bg-red-950/20"
          : "border-emerald-500 shadow-2xl shadow-emerald-500/25 bg-emerald-950/20"
        : "border-white/10 hover:border-white/20"
    }`}>
      {/* Top Banner & Status Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className={`h-11 w-11 rounded-2xl flex items-center justify-center border shrink-0 transition-colors ${
            pulseActive
              ? lastLiveScan?.severity === "danger"
                ? "bg-red-500/20 text-red-400 border-red-500/40"
                : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
              : "bg-[#007AFF]/20 text-[#007AFF] border-[#007AFF]/30"
          }`}>
            <IconRadio size={24} className={status === "connected" ? "animate-pulse" : ""} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Live PC Screen Tap Verification Terminal
              </h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                status === "connected"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status === "connected" ? "bg-emerald-400 animate-ping" : "bg-amber-400"}`} />
                <span>{status === "connected" ? `PC LISTENING (${connectionMode})` : "CONNECTING..."}</span>
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-mono mt-0.5">
              Pull the trigger on your Chainway C66 or tap the screen button — scans will register here instantly.
            </p>
          </div>
        </div>

        {/* Action button to test loopback */}
        <button
          type="button"
          onClick={handleSimulateScan}
          disabled={isSimulating}
          className="min-h-[48px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-mono text-neutral-200 transition flex items-center gap-2 cursor-pointer self-start sm:self-auto border border-white/10"
        >
          <IconScan size={16} className="text-[#007AFF]" />
          <span>{isSimulating ? "Transmitting..." : "Send Test Tap to PC"}</span>
        </button>
      </div>

      {/* Live Scan Results Display */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {lastLiveScan ? (
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold tracking-wider ${
                lastLiveScan.severity === "danger"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              }`}>
                {lastLiveScan.severity === "danger" ? "ACCESS DENIED" : "ACCESS GRANTED"}
              </span>
              <span className="text-xs font-mono text-neutral-400">
                {lastLiveScan.timestamp ? new Date(lastLiveScan.timestamp).toLocaleTimeString() : "Just now"}
              </span>
              <span className="text-xs font-mono text-neutral-500 ml-auto">
                Scan #{scanCount}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-black/50 border border-white/10 font-mono space-y-1.5">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>{lastLiveScan.entityName || "Scanned Credential"}</span>
              </div>
              <div className="text-xs text-neutral-300">
                {lastLiveScan.message}
              </div>
              {lastLiveScan.rawTag && (
                <div className="text-[11px] text-neutral-500 flex items-center gap-1 pt-1">
                  <span className="text-neutral-400">RAW TAG DATA:</span>
                  <code className="text-[#007AFF] bg-black/80 px-1.5 py-0.5 rounded border border-white/10">
                    {lastLiveScan.rawTag}
                  </code>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 p-6 rounded-xl bg-black/40 border border-dashed border-white/15 text-center space-y-2 font-mono">
            <IconCpu size={28} className="mx-auto text-neutral-500" />
            <div className="text-xs text-neutral-300 font-bold">
              Ready to verify C66 RFID Reader
            </div>
            <div className="text-[11px] text-neutral-500 max-w-md mx-auto">
              Aim your C66 at an RFID access badge or vehicle tag and pull the physical yellow trigger button. This terminal will display the scan instantaneously.
            </div>
          </div>
        )}

        {/* Diagnostics & Quick Setup Summary */}
        <div className="lg:col-span-4 p-4 rounded-xl bg-white/[0.03] border border-white/10 font-mono text-xs space-y-2.5">
          <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-bold">
            C66 Hardware Link Profile
          </div>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-neutral-400">Stream Connection:</span>
              <span className="text-emerald-400 font-semibold">{status.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Network Pipeline:</span>
              <span className="text-[#007AFF] font-semibold">{connectionMode} (QUIC)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Physical Trigger:</span>
              <span className="text-neutral-200">KeyCode 139 / 280</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Screen Trigger:</span>
              <span className="text-cyan-400">Active (Overlay FAB)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
