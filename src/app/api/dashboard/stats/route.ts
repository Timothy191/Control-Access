import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [totalScans, activeDevices, pendingApprovals, recentScans] = await Promise.all([
      prisma.gate_logs.count(),
      prisma.devices.count({ where: { status: "online" } }),
      prisma.approvals.count({ where: { status: "Pending" } }),
      prisma.gate_logs.findMany({
        take: 10,
        orderBy: { id: "desc" },
      }),
    ]);

    // Calculate muster count: individuals whose most recent scan was 'IN'
    const musterCount = await prisma.gate_logs.count({
      where: { direction: "IN", access_granted: true },
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
  } catch (error: any) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats", details: error.message },
      { status: 500 }
    );
  }
}
