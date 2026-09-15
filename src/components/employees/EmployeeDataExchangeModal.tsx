"use client";

import { useState } from "react";
import {
  IconX,
  IconSparkles,
  IconUpload,
  IconDownload,
  IconFileSpreadsheet,
  IconFileCode,
  IconCheck,
  IconAlertTriangle,
  IconUsers,
  IconBuilding,
} from "@tabler/icons-react";

interface EmployeeDataExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  areas: string[];
}

export default function EmployeeDataExchangeModal({
  isOpen,
  onClose,
  onSuccess,
  areas,
}: EmployeeDataExchangeModalProps) {
  const [activeTab, setActiveTab] = useState<"generate" | "import">("generate");

  // Mass Generator State
  const [genCount, setGenCount] = useState<number>(25);
  const [complianceProfile, setComplianceProfile] = useState<
    "realistic" | "compliant" | "warning" | "expired"
  >("realistic");
  const [targetSite, setTargetSite] = useState<string>("");
  const [contractorPercent, setContractorPercent] = useState<number>(35);

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
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          generate_count: genCount,
          compliance_profile: complianceProfile,
          target_site: targetSite || undefined,
          contractor_ratio: contractorPercent / 100,
          upsert: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate employee records");
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

      // Attempt to parse as JSON first
      const trimmed = rawText.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            payload.employees = parsed;
          } else if (parsed.employees && Array.isArray(parsed.employees)) {
            payload.employees = parsed.employees;
          } else {
            payload.employees = [parsed];
          }
        } catch {
          // If JSON parse failed, fall back to csvText
          payload.csvText = rawText;
        }
      } else {
        payload.csvText = rawText;
      }

      payload.action = "import";

      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to import employee records");
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
            <div className="h-11 w-11 rounded-2xl bg-[#007AFF]/20 text-[#007AFF] flex items-center justify-center font-bold border border-[#007AFF]/30">
              <IconUsers size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Workforce Data Exchange
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

        {/* Segmented Control Tabs (min 48px touch targets) */}
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
            <span>Mass Synthetic Generator</span>
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

        {/* Scrollable Body */}
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
              {/* Preset Quantities */}
              <div>
                <label className="block text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-2">
                  Record Batch Volume
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 25, 50, 100].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setGenCount(num)}
                      className={`min-h-[48px] rounded-xl text-xs font-mono font-bold transition border cursor-pointer active:scale-[0.98] ${
                        genCount === num
                          ? "bg-[#007AFF]/25 text-[#0A84FF] border-[#007AFF]/60 shadow-lg shadow-[#007AFF]/15"
                          : "bg-black/50 text-neutral-300 border-white/10 hover:border-white/25 hover:text-white"
                      }`}
                    >
                      {num} Personnel
                    </button>
                  ))}
                </div>
              </div>

              {/* Compliance Profile */}
              <div>
                <label className="block text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-2">
                  Compliance Distribution
                </label>
                <select
                  value={complianceProfile}
                  onChange={(e) => setComplianceProfile(e.target.value as typeof complianceProfile)}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-black/50 border border-white/15 text-xs text-white font-mono focus:border-[#007AFF] focus:outline-none cursor-pointer"
                >
                  <option value="realistic">
                    Realistic Mining Mix (80% Cleared, 10% Expiring Soon &le;30d, 10% Expired)
                  </option>
                  <option value="compliant">100% Fully Compliant (All Medicals &amp; Inductions Valid)</option>
                  <option value="warning">Warning Stress Test (100% Expiring Within 30 Days)</option>
                  <option value="expired">Non-Compliant Stress Test (100% Expired / Gate Refusal)</option>
                </select>
              </div>

              {/* Site Assignment & Contractor Ratio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-2">
                    Target Site / Area
                  </label>
                  <select
                    value={targetSite}
                    onChange={(e) => setTargetSite(e.target.value)}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-black/50 border border-white/15 text-xs text-white font-mono focus:border-[#007AFF] focus:outline-none cursor-pointer"
                  >
                    <option value="">Random Pit / Plant Distribution</option>
                    {areas.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                      Contractor Affiliation Ratio
                    </label>
                    <span className="text-xs font-mono font-bold text-amber-300">
                      {contractorPercent}% Contractors
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={contractorPercent}
                    onChange={(e) => setContractorPercent(parseInt(e.target.value, 10))}
                    className="w-full h-3 bg-black/60 rounded-lg appearance-none cursor-pointer accent-[#007AFF] mt-3"
                  />
                  <span className="text-[10px] font-mono text-neutral-500 block mt-1">
                    Direct staff: {100 - contractorPercent}% • External vendors: {contractorPercent}%
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-[11px] font-mono text-neutral-400 space-y-1">
                <span className="text-white font-medium block">Automatic Attributes:</span>
                <p>
                  • RFC-compliant unique <code>RFID-EMP-XXXXXX</code> tags &amp; <code>QR-EMP-XXXXXX</code> codes.
                </p>
                <p>• Valid South African National ID numbers and SHA-256 hashes.</p>
                <p>• Heavy equipment certifications (CAT 797, Komatsu PC8000, Working at Heights, Blasting).</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Upload Box */}
              <div>
                <label className="block text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-2">
                  Upload CSV or JSON File
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
                  placeholder={`EMP Code,First Name,Surname,Job Title,Area,Status\nEMP-1001,Sipho,Dlamini,Excavator Operator,Brakfontein,Active\nCON-1002,Johan,Botha,Diesel Mechanic,Optimum,Active`}
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
                    Smart Upsert (Update Existing Records)
                  </span>
                  <span className="text-[11px] text-neutral-400 font-mono block">
                    Matches by EMP Code: updates existing records and creates new personnel without duplicate crashes.
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
                  <span>Generating {genCount} Personnel...</span>
                </>
              ) : (
                <>
                  <IconSparkles size={16} />
                  <span>Generate {genCount} Personnel</span>
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
                  <span>Importing Workforce...</span>
                </>
              ) : (
                <>
                  <IconUpload size={16} />
                  <span>Import Personnel Data</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
