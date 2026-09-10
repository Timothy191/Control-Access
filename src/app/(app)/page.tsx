import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import LiveDashboard from "@/components/dashboard/LiveDashboard";
import { normalizeSiteName } from "@/lib/sites";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent("/")}`);

  const cookieStore = await cookies();
  const sp = searchParams ? await searchParams : {};
  const rawSite = sp.site || cookieStore.get("selected_site")?.value;
  const site = normalizeSiteName(rawSite);
  const isFiltered = site !== "all";

  const gateLogWhere = isFiltered
    ? {
        OR: [
          { gate_location: { contains: site } },
          { employee: { area: { contains: site } } },
        ],
      }
    : {};

  const deviceWhere = isFiltered
    ? {
        status: "online",
        device_name: { contains: site },
      }
    : { status: "online" };

  const musterWhere = {
    direction: "IN",
    access_granted: true,
    ...(isFiltered
      ? {
          OR: [
            { gate_location: { contains: site } },
            { employee: { area: { contains: site } } },
          ],
        }
      : {}),
  };

  const [totalScans, activeDevices, pendingApprovals, rawRecentScans] =
    await Promise.all([
      prisma.gate_logs.count({ where: gateLogWhere }),
      prisma.devices.count({ where: deviceWhere }),
      prisma.approvals.count({ where: { status: "Pending" } }),
      prisma.gate_logs.findMany({
        where: gateLogWhere,
        take: 25,
        orderBy: { id: "desc" },
      }),
    ]);

  const musterCount = await prisma.gate_logs.count({
    where: musterWhere,
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
