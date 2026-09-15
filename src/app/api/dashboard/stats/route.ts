import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const siteParam = url.searchParams.get("site");
    const isFiltered = siteParam && siteParam !== "all" && !siteParam.toLowerCase().includes("all");
    const site = isFiltered ? siteParam.trim() : null;

    const gateLogWhere = site
      ? {
          OR: [
            { gate_location: { contains: site } },
            { employee: { area: { contains: site } } },
          ],
        }
      : {};

    const deviceWhere = site
      ? {
          status: "online",
          device_name: { contains: site },
        }
      : { status: "online" };

    const [totalScans, activeDevices, pendingApprovals, recentScans] = await Promise.all([
      prisma.gate_logs.count({ where: gateLogWhere }),
      prisma.devices.count({ where: deviceWhere }),
      prisma.approvals.count({ where: { status: "Pending" } }),
      prisma.gate_logs.findMany({
        where: gateLogWhere,
        take: 25,
        orderBy: { id: "desc" },
      }),
    ]);

    // Calculate mathematically real muster count:
    // Determine unique individuals/entities whose latest granted scan was 'IN'
    const grantedLogs = await prisma.gate_logs.findMany({
      where: {
        access_granted: true,
        ...(site
          ? {
              OR: [
                { gate_location: { contains: site } },
                { employee: { area: { contains: site } } },
              ],
            }
          : {}),
      },
      orderBy: { id: "desc" },
    });

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

    return NextResponse.json({
      totalScans,
      activeDevices, // 100% Real DB count (no fake || 1 fallback)
      pendingApprovals,
      musterCount, // 100% Real on-site headcount (deduplicated latest direction)
      recentScans,
      updatedAt: new Date().toISOString(),
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

