import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { broadcastDeviceNotification } from "@/lib/device-notifications";
import fs from "node:fs/promises";
import path from "node:path";

export async function POST(req: Request) {
  try {
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const body = await req.json().catch(() => ({}));

    const deviceId = (body.deviceId || body.deviceName || "Chainway-C66-01").trim();
    const deviceType = body.deviceType || "Chainway C66 Android Handheld";
    const gateLocation = body.gateLocation || "Brakfontein - Main Gate";

    let publicUrl = "https://francisco-wing-appointment-gap.trycloudflare.com";
    try {
      const txtPath = path.join(process.cwd(), "public_url.txt");
      const content = (await fs.readFile(txtPath, "utf-8")).trim();
      if (content.startsWith("http")) publicUrl = content;
    } catch {
      // fallback
    }

    // Find or update/create device in SQLite database
    const existing = await prisma.devices.findFirst({
      where: {
        OR: [
          { device_name: deviceId },
          { ip_address: ipAddress },
        ],
      },
    });

    let deviceRecord;
    if (existing) {
      deviceRecord = await prisma.devices.update({
        where: { id: existing.id },
        data: {
          device_name: deviceId,
          device_type: deviceType,
          ip_address: ipAddress,
          status: "online",
          last_seen: new Date(),
        },
      });
    } else {
      deviceRecord = await prisma.devices.create({
        data: {
          device_name: deviceId,
          device_type: deviceType,
          ip_address: ipAddress,
          status: "online",
          total_scans: 0,
          last_seen: new Date(),
        },
      });
    }

    // Broadcast real-time notification to all dashboards & devices
    await broadcastDeviceNotification({
      type: "INFO",
      severity: "success",
      title: "🔗 DEVICE PERMANENTLY LINKED",
      message: `${deviceId} (${deviceType}) successfully paired and permanently bound to Control-Access`,
      targetDeviceId: "ALL",
      entityName: deviceId,
      gateLocation,
    });

    return NextResponse.json({
      success: true,
      linked: true,
      device: {
        id: deviceRecord.id,
        name: deviceRecord.device_name,
        type: deviceRecord.device_type,
        status: deviceRecord.status,
        totalScans: deviceRecord.total_scans,
        lastSeen: deviceRecord.last_seen,
        ipAddress: deviceRecord.ip_address,
      },
      config: {
        deviceId,
        lanUrl: "http://192.168.1.79:8080",
        publicUrl,
        scanEndpoint: "/api/scanner/receive",
        notificationsEndpoint: `/api/scanner/notifications?deviceId=${encodeURIComponent(deviceId)}`,
        gateLocation,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Failed to link device:", err);
    return NextResponse.json({ error: "Failed to link device" }, { status: 500 });
  }
}
