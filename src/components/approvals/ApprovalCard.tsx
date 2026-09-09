"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveRequest, rejectRequest } from "@/lib/actions/approvals";
import type { DecodedQr } from "@/lib/qr-decode";

interface ApprovalCardProps {
  approval: {
    id: number;
    request_type: string | null;
    requester_name: string | null;
    details: string | null;
    created_at: Date;
    target_table: string | null;
  };
  decoded: DecodedQr;
}

export default function ApprovalCard({ approval, decoded }: ApprovalCardProps) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
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

  const decodedFields: Array<[string, string | null | undefined]> = [
    ["Employee ID", decoded.employee_id],
    ["Name", decoded.name],
    ["Position", decoded.position],
    ["Department", decoded.department],
    ["Area", decoded.area],
    ["Fleet ID", decoded.fleet_id],
    ["Vehicle Type", decoded.vehicle_type],
  ].filter(([, v]) => v) as Array<[string, string]>;

  return (
    <div className="glass-card flex flex-col">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-medium text-text-primary">
            {approval.requester_name || "Unknown"}
          </h3>
          <p className="text-sm text-text-secondary">
            {approval.request_type || "Request"} ·{" "}
            {new Date(approval.created_at).toLocaleString()}
          </p>
        </div>
        <span className="px-2 py-1 text-xs font-semibold rounded-full border bg-warning/20 text-warning border-warning/30">
          Pending
        </span>
      </div>

      {approval.details && (
        <p className="text-sm text-text-secondary mb-3">{approval.details}</p>
      )}

      {decodedFields.length > 0 && (
        <dl className="text-sm mb-4">
          {decodedFields.map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between py-1 border-b border-white/10 last:border-0"
            >
              <dt className="text-text-secondary">{label}</dt>
              <dd className="font-medium text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <input
        type="text"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comment (optional)"
        className="mt-auto mb-3 w-full px-3 py-2 border border-steel/30 rounded-md bg-black/40 text-text-primary placeholder:text-text-secondary text-sm"
      />

      {error && <p className="text-sm text-danger mb-2">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="flex-1 px-4 py-2 bg-success text-white rounded hover:opacity-90 disabled:opacity-50 transition"
        >
          {isPending ? "Working..." : "Approve"}
        </button>
        <button
          onClick={handleReject}
          disabled={isPending}
          className="flex-1 px-4 py-2 bg-danger text-white rounded hover:opacity-90 disabled:opacity-50 transition"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
