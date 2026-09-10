import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

    const musterWhere = {
      direction: "IN",
      access_granted: true,
      ...(site
        ? {
            OR: [
              { gate_location: { contains: site } },
              { employee: { area: { contains: site } } },
            ],
          }
        : {}),
    };

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

    // Calculate muster count: individuals whose most recent scan was 'IN' for this site
    const musterCount = await prisma.gate_logs.count({
      where: musterWhere,
    });

    return NextResponse.json({
      totalScans,
      activeDevices: activeDevices || 1, // At least the server itself
      pendingApprovals,
      musterCount,
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
