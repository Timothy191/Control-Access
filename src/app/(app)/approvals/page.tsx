import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { decodePendingScan, type FullyDecodedScan } from "@/lib/scan-decoder";
import ApprovalCard from "@/components/approvals/ApprovalCard";

export default async function ApprovalsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/approvals")}`);
  }

  const approvals = await prisma.approvals.findMany({
    where: { status: "Pending" },
    orderBy: { created_at: "desc" },
  });

  const decodedMap: Record<number, FullyDecodedScan> = {};
  for (const appr of approvals) {
    const decoded = await decodePendingScan(appr.scanned_data, {
      requestType: appr.request_type,
      requesterName: appr.requester_name,
      details: appr.details,
    });
    decodedMap[appr.id] = decoded;

    // Proactively backfill database if the approval had "Unknown" requester name but is now resolved
    if (
      appr.requester_name === "Unknown" &&
      decoded.name &&
      decoded.name !== "Unregistered Entity"
    ) {
      try {
        await prisma.approvals.update({
          where: { id: appr.id },
          data: {
            requester_name: decoded.name,
            request_type: decoded.is_matched_db
              ? "Registered Credential Verification"
              : "New Credential Enrollment",
            details:
              appr.details?.replace(
                "ID: N/A",
                `ID: ${decoded.employee_id || "Identified"}`
              ) || appr.details,
          },
        });
      } catch {
        // non-blocking
      }
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
            Pending Scans & Approvals ({approvals.length})
          </h1>
          <p className="text-xs text-neutral-400 font-sans mt-1">
            Real-time supervisor authorization queue for unverified, restricted, or newly presented credentials
          </p>
        </div>
      </div>

      {approvals.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-white/10 bg-neutral-900/40 backdrop-blur-xl">
          <p className="text-sm font-medium text-neutral-300">
            No pending scan authorizations in queue
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            All presented RFID tags and QR credentials have been fully verified and processed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {approvals.map((appr) => (
            <ApprovalCard
              key={appr.id}
              approval={{
                id: appr.id,
                request_type: appr.request_type,
                requester_name: decodedMap[appr.id]?.name || appr.requester_name,
                details: appr.details,
                created_at: appr.created_at,
                target_table: appr.target_table,
              }}
              decoded={decodedMap[appr.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
