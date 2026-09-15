import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const devices = await prisma.devices.findMany({
      orderBy: { last_seen: "desc" },
    });

    const now = new Date();
    const enrichedDevices = devices.map((d) => {
      const minutesAgo = Math.floor((now.getTime() - new Date(d.last_seen).getTime()) / (1000 * 60));
      const isOnline = minutesAgo <= 15 && d.status === "online";

      return {
        ...d,
        isOnline,
        minutesAgo,
        formattedLastSeen: minutesAgo === 0 ? "Just now" : `${minutesAgo}m ago`,
        connectionMode: d.ip_address?.startsWith("192.168") || d.ip_address?.startsWith("10.") ? "LAN" : "TUNNEL",
        batteryEstimate: Math.max(20, 100 - (d.total_scans % 80)), // simulated telemetry estimate
      };
    });

    return NextResponse.json({
      devices: enrichedDevices,
      totalCount: devices.length,
      onlineCount: enrichedDevices.filter((d) => d.isOnline).length,
      updatedAt: now.toISOString(),
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Fetch devices error:", error);
    return NextResponse.json({ error: "Failed to fetch devices" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newDevice = await prisma.devices.create({
      data: {
        device_name: body.device_name || "Chainway-C66-Unassigned",
        device_type: body.device_type || "Chainway C66 RFID",
        mac_address: body.mac_address || null,
        ip_address: body.ip_address || null,
        status: body.status || "online",
        total_scans: body.total_scans || 0,
        last_seen: new Date(),
      },
    });
    return NextResponse.json(newDevice, { status: 201 });
  } catch (error) {
    console.error("Create device error:", error);
    return NextResponse.json({ error: "Failed to create device" }, { status: 500 });
  }
}
