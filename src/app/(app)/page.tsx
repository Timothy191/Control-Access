import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import LiveDashboard from "@/components/dashboard/LiveDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent("/")}`);

  const [totalScans, activeDevices, pendingApprovals, rawRecentScans] =
    await Promise.all([
      prisma.gate_logs.count(),
      prisma.devices.count({ where: { status: "online" } }),
      prisma.approvals.count({ where: { status: "Pending" } }),
      prisma.gate_logs.findMany({
        take: 10,
        orderBy: { id: "desc" },
      }),
    ]);

  const musterCount = await prisma.gate_logs.count({
    where: { direction: "IN", access_granted: true },
  });

  const recentScans = rawRecentScans.map((scan) => ({
    id: scan.id,
    access_type: scan.access_type,
    entity_name: scan.entity_name,
    direction: scan.direction,
    access_granted: scan.access_granted,
    denial_reason: scan.denial_reason,
    gate_location: scan.gate_location,
    scanned_at: scan.scanned_at
      ? scan.scanned_at.toISOString()
      : new Date().toISOString(),
  }));

  const initialStats = {
    totalScans,
    activeDevices: activeDevices || 1,
    pendingApprovals,
    musterCount,
    recentScans,
    updatedAt: new Date().toISOString(),
  };

  return <LiveDashboard initialStats={initialStats} />;
}
