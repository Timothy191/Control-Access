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

    const [totalScans, activeDevices, pendingApprovals, rawRecentScans, grantedLogs] =
    await Promise.all([
      prisma.gate_logs.count({ where: gateLogWhere }),
      prisma.devices.count({ where: deviceWhere }),
      prisma.approvals.count({ where: { status: "Pending" } }),
      prisma.gate_logs.findMany({
        where: gateLogWhere,
        take: 25,
        orderBy: { id: "desc" },
      }),
      prisma.gate_logs.findMany({
        where: {
          access_granted: true,
          ...(isFiltered ? gateLogWhere : {}),
        },
        orderBy: { id: "desc" },
      }),
    ]);

  // Calculate mathematically real muster count:
  // Determine unique individuals/entities whose latest granted scan was 'IN'
  const seenEntities = new Set<string>();
  let musterCount = 0;
  for (const log of grantedLogs) {
    const key = log.entity_name || log.qr_data || `log_${log.id}`;
    if (!seenEntities.has(key)) {
      seenEntities.add(key);
      if (log.direction === "IN") {
        musterCount++;
      }
    }
  }

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
    qr_data: scan.qr_data,
    parsed_qr_data: scan.parsed_qr_data,
  }));

  const initialStats = {
    totalScans,
    activeDevices, // 100% Real DB count
    pendingApprovals,
    musterCount, // 100% Real on-site headcount
    recentScans,
    updatedAt: new Date().toISOString(),
  };

  return <LiveDashboard initialStats={initialStats} />;
}
