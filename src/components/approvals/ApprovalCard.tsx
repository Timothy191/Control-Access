"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveRequest, rejectRequest } from "@/lib/actions/approvals";
import type { FullyDecodedScan } from "@/lib/scan-decoder";
import {
  IconCheck,
  IconX,
  IconClock,
  IconId,
  IconUser,
  IconBriefcase,
  IconBuilding,
  IconMapPin,
  IconCreditCard,
  IconCopy,
} from "@tabler/icons-react";

interface ApprovalCardProps {
  approval: {
    id: number;
    request_type: string | null;
    requester_name: string | null;
    details: string | null;
    created_at: Date;
    target_table: string | null;
  };
  decoded: FullyDecodedScan;
}

export default function ApprovalCard({ approval, decoded }: ApprovalCardProps) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      try {
        await approveRequest(approval.id, { comment });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to approve");
      }
    });
  };

  const handleReject = () => {
    setError(null);
    startTransition(async () => {
      try {
        await rejectRequest(approval.id, comment);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to reject");
      }
    });
  };

  const handleCopyTag = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayName = decoded.name || approval.requester_name || "Unassigned Entity";
  const displayPosition = decoded.position || approval.request_type || "Access Request";
  const displayDept = decoded.department || "Site Operations";
  const displayId = decoded.employee_id || decoded.credential_tag || "N/A";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#18181b]/85 backdrop-blur-2xl shadow-[0_8px_30px_rgba(0,0,0,0.36)] flex flex-col justify-between transition-all hover:border-white/20">
      {/* Top macOS Acrylic Accent */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* macOS Card Titlebar */}
      <div className="flex items-center justify-between p-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F56] border border-[#E0443E]/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E] border border-[#DEA123]/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#27C93F] border border-[#1AAB29]/80" />
          <span className="text-[11px] font-mono text-neutral-400 ml-1.5 font-medium">
            Pending Scan #{approval.id}
          </span>
        </div>

        {/* Status Badge */}
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold font-mono rounded-full border bg-amber-500/15 text-amber-300 border-amber-500/30">
          <IconClock size={11} className="animate-spin text-amber-400" />
          <span>Awaiting Review</span>
        </span>
      </div>

      <div className="p-4 space-y-4 text-xs font-sans flex-1">
        {/* Decoded Subject Header */}
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center text-[#007AFF] shrink-0 shadow-inner">
            <IconUser size={20} />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white truncate tracking-tight">
              {displayName}
            </h3>
            <p className="text-[11px] text-neutral-400 truncate mt-0.5 flex items-center gap-1.5">
              <span>{displayPosition}</span>
              <span className="text-neutral-600">•</span>
              <span className="truncate">{displayDept}</span>
            </p>
          </div>
        </div>

        {/* Database Match Status Banner */}
        <div
          className={`p-2.5 rounded-xl border text-[11px] font-mono flex items-center justify-between gap-2 ${
            decoded.is_matched_db
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
              : "bg-amber-500/10 border-amber-500/25 text-amber-300"
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            {decoded.is_matched_db ? (
              <IconCheck size={14} className="shrink-0 text-emerald-400" />
            ) : (
              <IconCreditCard size={14} className="shrink-0 text-amber-400" />
            )}
            <span className="truncate">
              {decoded.is_matched_db
                ? `Matched DB Profile: ${decoded.matched_record?.code}`
                : "New Unregistered Credential"}
            </span>
          </div>

          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-black/40 shrink-0">
            {decoded.format || "SCAN"}
          </span>
        </div>

        {/* Decoded Key-Value Specifications */}
        <div className="rounded-xl bg-black/40 border border-white/5 divide-y divide-white/5 text-xs font-mono">
          <div className="flex items-center justify-between p-2.5">
            <span className="text-neutral-400 text-[11px] flex items-center gap-1.5">
              <IconId size={13} className="text-neutral-500" />
              <span>Assigned ID / Code</span>
            </span>
            <span className="font-semibold text-white">{displayId}</span>
          </div>

          <div className="flex items-center justify-between p-2.5">
            <span className="text-neutral-400 text-[11px] flex items-center gap-1.5">
              <IconBriefcase size={13} className="text-neutral-500" />
              <span>Role / Title</span>
            </span>
            <span className="font-medium text-neutral-200 truncate max-w-[170px]">
              {displayPosition}
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5">
            <span className="text-neutral-400 text-[11px] flex items-center gap-1.5">
              <IconBuilding size={13} className="text-neutral-500" />
              <span>Department / Area</span>
            </span>
            <span className="font-medium text-neutral-200 truncate max-w-[170px]">
              {decoded.area || displayDept}
            </span>
          </div>

          {decoded.credential_tag && (
            <div className="flex items-center justify-between p-2.5">
              <span className="text-neutral-400 text-[11px] flex items-center gap-1.5">
                <IconCreditCard size={13} className="text-neutral-500" />
                <span>Raw Scanned Tag</span>
              </span>
              <button
                type="button"
                onClick={() => handleCopyTag(decoded.credential_tag || "")}
                className="flex items-center gap-1 text-[11px] text-[#007AFF] hover:underline cursor-pointer"
                title="Copy raw scanned tag"
              >
                <span className="truncate max-w-[120px] font-mono">
                  {decoded.credential_tag}
                </span>
                {copied ? <IconCheck size={12} className="text-emerald-400" /> : <IconCopy size={12} />}
              </button>
            </div>
          )}
        </div>

        {/* Scan Incident Details */}
        {approval.details && (
          <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 bg-white/[0.02] p-2 rounded-lg border border-white/5">
            <IconMapPin size={13} className="text-neutral-500 shrink-0" />
            <span className="truncate">{approval.details}</span>
          </div>
        )}
      </div>

      {/* Card Actions Footer */}
      <div className="p-4 pt-0 space-y-3">
        {/* Comment input */}
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Supervisor audit note (optional)..."
          className="w-full min-h-[38px] h-9.5 rounded-lg border border-white/10 bg-black/50 px-3 text-neutral-200 placeholder:text-neutral-600 text-xs focus:border-[#007AFF] focus:outline-none"
        />

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isPending}
            className="flex-1 min-h-[38px] h-9.5 rounded-lg bg-[#30D158] hover:bg-[#28B84D] active:scale-[0.98] disabled:opacity-50 text-black font-semibold text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer px-4"
          >
            <IconCheck size={16} className="stroke-[2.5]" />
            <span>{isPending ? "Authorizing..." : "Approve & Enroll"}</span>
          </button>

          <button
            type="button"
            onClick={handleReject}
            disabled={isPending}
            className="px-4 min-h-[38px] h-9.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 active:scale-[0.98] disabled:opacity-50 text-red-300 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <IconX size={16} />
            <span>Reject</span>
          </button>
        </div>
      </div>
    </div>
  );
}
