"use client";

import { useState } from "react";
import {
  IconX,
  IconSparkles,
  IconUpload,
  IconFileSpreadsheet,
  IconFileCode,
  IconCheck,
  IconAlertTriangle,
  IconTruck,
  IconCar,
} from "@tabler/icons-react";

interface FleetDataExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FleetDataExchangeModal({
  isOpen,
  onClose,
  onSuccess,
}: FleetDataExchangeModalProps) {
  const [activeTab, setActiveTab] = useState<"generate" | "import">("generate");

  // Mass Generator State
  const [genCount, setGenCount] = useState<number>(25);
  const [vehicleClass, setVehicleClass] = useState<"ALL" | "HEAVY" | "LIGHT">("ALL");
  const [complianceProfile, setComplianceProfile] = useState<
    "realistic" | "compliant" | "warning" | "expired"
  >("realistic");

  // Import State
  const [rawText, setRawText] = useState<string>("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [upsert, setUpsert] = useState<boolean>(true);

  // Submission State
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultSummary, setResultSummary] = useState<{
    total_processed: number;
    created: number;
    updated: number;
    skipped: number;
    errors_count: number;
    errors?: string[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        setRawText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleGenerate = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setResultSummary(null);

    try {
      const res = await fetch("/api/fleet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          generate_count: genCount,
          vehicle_class: vehicleClass,
          compliance_profile: complianceProfile,
          upsert: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate fleet records");
      }

      setResultSummary(data.summary);
      onSuccess();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!rawText.trim()) {
      setErrorMessage("Please paste CSV/JSON content or upload a file first.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setResultSummary(null);

    try {
      let payload: Record<string, unknown> = { upsert };

      const trimmed = rawText.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            payload.vehicles = parsed;
          } else if (parsed.vehicles && Array.isArray(parsed.vehicles)) {
            payload.vehicles = parsed.vehicles;
          } else {
            payload.vehicles = [parsed];
          }
        } catch {
          payload.csvText = rawText;
        }
      } else {
        payload.csvText = rawText;
      }

      payload.action = "import";

      const res = await fetch("/api/fleet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to import fleet records");
      }

      setResultSummary(data.summary);
      onSuccess();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#141418] border border-white/15 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl max-h-[90vh] flex flex-col font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold border border-purple-500/30">
              <IconTruck size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Fleet Machinery Data Exchange
              </h2>
              <p className="text-xs font-mono text-neutral-400">
                Mass generation, CSV/JSON bulk import, and collision-free upsert
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white cursor-pointer transition active:scale-[0.98]"
            aria-label="Close modal"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Segmented Control Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-neutral-900/80 border border-white/10 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setActiveTab("generate");
              setResultSummary(null);
              setErrorMessage(null);
            }}
            className={`flex-1 min-h-[48px] px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] ${
              activeTab === "generate"
                ? "bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/25"
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <IconSparkles size={16} />
            <span>Mass Fleet Generator</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("import");
              setResultSummary(null);
              setErrorMessage(null);
            }}
            className={`flex-1 min-h-[48px] px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] ${
              activeTab === "import"
                ? "bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/25"
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <IconUpload size={16} />
            <span>Import CSV / JSON</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-xs font-mono text-red-300 flex items-start gap-2.5">
              <IconAlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {resultSummary && (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-mono text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <IconCheck size={18} />
                <span>Operation Completed Successfully</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-neutral-200">
                <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[10px] text-neutral-400 block uppercase">Processed</span>
                  <strong className="text-base font-bold text-white">{resultSummary.total_processed}</strong>
                </div>
                <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[10px] text-emerald-400 block uppercase">Created</span>
                  <strong className="text-base font-bold text-emerald-300">+{resultSummary.created}</strong>
                </div>
                <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[10px] text-blue-400 block uppercase">Updated</span>
                  <strong className="text-base font-bold text-blue-300">{resultSummary.updated}</strong>
                </div>
                <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-[10px] text-amber-400 block uppercase">Skipped</span>
                  <strong className="text-base font-bold text-amber-300">{resultSummary.skipped}</strong>
                </div>
              </div>
              {resultSummary.errors && resultSummary.errors.length > 0 && (
                <div className="pt-2 text-[11px] text-red-300 space-y-1">
                  <span className="font-bold">Errors encountered:</span>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {resultSummary.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === "generate" ? (
            <div className="space-y-4">
              {/* Quantities */}
              <div>
                <label className="block text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-2">
                  Machinery Batch Volume
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 25, 50, 100].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setGenCount(num)}
                      className={`min-h-[48px] rounded-xl text-xs font-mono font-bold transition border cursor-pointer active:scale-[0.98] ${
                        genCount === num
                          ? "bg-purple-500/25 text-purple-300 border-purple-500/60 shadow-lg shadow-purple-500/15"
                          : "bg-black/50 text-neutral-300 border-white/10 hover:border-white/25 hover:text-white"
                      }`}
                    >
                      {num} Units
                    </button>
                  ))}
                </div>
              </div>

              {/* Machinery Class */}
              <div>
                <label className="block text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-2">
                  Machinery Class Specification
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setVehicleClass("ALL")}
                    className={`min-h-[48px] rounded-xl text-xs font-mono font-bold transition border cursor-pointer active:scale-[0.98] ${
                      vehicleClass === "ALL"
                        ? "bg-[#007AFF]/25 text-[#0A84FF] border-[#007AFF]/60"
                        : "bg-black/50 text-neutral-300 border-white/10"
                    }`}
                  >
                    Mixed Fleet (65% Heavy / 35% Light)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVehicleClass("HEAVY")}
                    className={`min-h-[48px] rounded-xl text-xs font-mono font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                      vehicleClass === "HEAVY"
                        ? "bg-purple-500/25 text-purple-300 border-purple-500/60"
                        : "bg-black/50 text-neutral-300 border-white/10"
                    }`}
                  >
                    <IconTruck size={15} />
                    <span>Heavy Machinery Only</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVehicleClass("LIGHT")}
                    className={`min-h-[48px] rounded-xl text-xs font-mono font-bold transition border cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                      vehicleClass === "LIGHT"
                        ? "bg-blue-500/25 text-blue-300 border-blue-500/60"
                        : "bg-black/50 text-neutral-300 border-white/10"
                    }`}
                  >
                    <IconCar size={15} />
                    <span>Light / Service Vehicles</span>
                  </button>
                </div>
              </div>

              {/* Compliance Profile */}
              <div>
                <label className="block text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-2">
                  Roadworthy &amp; License Disc Expiry Distribution
                </label>
                <select
                  value={complianceProfile}
                  onChange={(e) => setComplianceProfile(e.target.value as typeof complianceProfile)}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-black/50 border border-white/15 text-xs text-white font-mono focus:border-[#007AFF] focus:outline-none cursor-pointer"
                >
                  <option value="realistic">
                    Realistic Mining Mix (88% Valid, 6% Expiring Soon &le;30d, 6% Expired)
                  </option>
                  <option value="compliant">100% Fully Compliant (All Roadworthy &amp; Discs Valid)</option>
                  <option value="warning">Warning Stress Test (100% Expiring Within 30 Days)</option>
                  <option value="expired">Expired Roadworthy Stress Test (Immediate Gate Refusal)</option>
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-[11px] font-mono text-neutral-400 space-y-1">
                <span className="text-white font-medium block">Automatic Machinery Specs:</span>
                <p>• Heavy Fleet: CAT 797F Ultra Haulers, Komatsu PC8000, Bell B50E, Liebherr T284, Sandvik DR412i.</p>
                <p>• Operational engine hours automatically assigned (500 to 12,000 hrs).</p>
                <p>• Unique RFID EPC-96 tags &amp; tamper-evident QR codes linked to machine serials.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Upload Box */}
              <div>
                <label className="block text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-2">
                  Upload Fleet CSV or JSON File
                </label>
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/15 hover:border-[#007AFF]/60 rounded-2xl bg-black/40 cursor-pointer transition">
                  <div className="flex items-center gap-3 text-neutral-300 mb-1">
                    <IconFileSpreadsheet size={24} className="text-emerald-400" />
                    <IconFileCode size={24} className="text-blue-400" />
                  </div>
                  <span className="text-xs text-neutral-300 font-medium">
                    {fileName ? fileName : "Drag & drop file or click to browse"}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-mono mt-1">
                    Supports .csv (Excel UTF-8) and .json records
                  </span>
                  <input
                    type="file"
                    accept=".csv,.json,text/csv,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Raw Text Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                    Or Paste Raw CSV / JSON Data
                  </label>
                  {rawText && (
                    <button
                      type="button"
                      onClick={() => {
                        setRawText("");
                        setFileName(null);
                      }}
                      className="text-[10px] font-mono text-neutral-400 hover:text-white underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Fleet ID,Machine ID,Vehicle Type,Make,Model,License Plate,Operational Hours\nCAT-797-101,EQ-101,HEAVY_FLEET,Caterpillar,797F Ultra Hauler,CD 44 GP,3450.5\nTOY-HLX-202,LV-202,LIGHT_VEHICLE,Toyota,Hilux 2.8 GD-6 4x4,NW 88 MP,410.0`}
                  className="w-full p-3.5 rounded-xl bg-black/50 border border-white/15 text-xs text-white font-mono placeholder:text-neutral-600 focus:border-[#007AFF] focus:outline-none resize-none"
                />
              </div>

              {/* Upsert Option */}
              <label className="flex items-center gap-3 p-3 rounded-xl bg-black/40 border border-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={upsert}
                  onChange={(e) => setUpsert(e.target.checked)}
                  className="h-4 w-4 rounded bg-black/60 border-white/20 text-[#007AFF] focus:ring-0 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-medium text-white block">
                    Smart Upsert (Update Existing Fleet Units)
                  </span>
                  <span className="text-[11px] text-neutral-400 font-mono block">
                    Matches by Fleet ID: updates existing machine specs and adds new units without collisions.
                  </span>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-neutral-300 font-mono transition cursor-pointer active:scale-[0.98]"
          >
            Close
          </button>

          {activeTab === "generate" ? (
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleGenerate}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0A84FF] text-white text-xs font-mono font-bold transition shadow-lg shadow-[#007AFF]/25 cursor-pointer disabled:opacity-50 flex items-center gap-2 active:scale-[0.98]"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Generating {genCount} Vehicles...</span>
                </>
              ) : (
                <>
                  <IconSparkles size={16} />
                  <span>Generate {genCount} Fleet Units</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={isProcessing || !rawText.trim()}
              onClick={handleImport}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0A84FF] text-white text-xs font-mono font-bold transition shadow-lg shadow-[#007AFF]/25 cursor-pointer disabled:opacity-50 flex items-center gap-2 active:scale-[0.98]"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Importing Fleet...</span>
                </>
              ) : (
                <>
                  <IconUpload size={16} />
                  <span>Import Fleet Data</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
