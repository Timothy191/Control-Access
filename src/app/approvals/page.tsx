import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { decodeQrData, type DecodedQr } from "@/lib/qr-decode";
import ApprovalCard from "@/components/approvals/ApprovalCard";

export default async function ApprovalsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const approvals = await prisma.approvals.findMany({
    where: { status: "Pending" },
    orderBy: { created_at: "desc" },
  });

  // Decode scanned QR data for each approval, merging stored fields over decoded
  const decodedMap: Record<number, DecodedQr> = {};
  for (const appr of approvals) {
    if (appr.scanned_data) {
      try {
        const stored = JSON.parse(appr.scanned_data);
        const rawQr =
          stored.qr_code || stored.raw_data || stored.original_data || "";
        const decoded = decodeQrData(rawQr) as unknown as Record<
          string,
          string | null | undefined
        >;
        for (const k of [
          "employee_id",
          "name",
          "position",
          "department",
          "area",
        ]) {
          if (stored[k] && !decoded[k]) {
            decoded[k] = stored[k];
          }
        }
        decodedMap[appr.id] = decoded as unknown as DecodedQr;
      } catch {
        decodedMap[appr.id] = decodeQrData(appr.scanned_data);
      }
    } else {
      decodedMap[appr.id] = { raw_data: "", format: "none" };
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">
        Pending Approvals ({approvals.length})
      </h1>

      {approvals.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow border border-gray-200 text-center text-gray-500">
          No pending approvals. New scan requests will appear here for review.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {approvals.map((appr) => (
            <ApprovalCard
              key={appr.id}
              approval={{
                id: appr.id,
                request_type: appr.request_type,
                requester_name: appr.requester_name,
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
