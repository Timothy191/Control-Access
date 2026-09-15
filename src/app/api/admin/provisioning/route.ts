import { NextResponse } from "next/server";
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { getTunnelUrl } from "@/lib/tunnel";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const gateId = url.searchParams.get("gateId") || "GATE-MAIN-01";
    const gateName = url.searchParams.get("gateName") || "Main Ingress Gate 1";
    const direction = url.searchParams.get("direction") || "IN";
    const deviceId =
      url.searchParams.get("deviceId") ||
      `Chainway-C66-${Math.floor(10 + Math.random() * 90)}`;

    const tunnelUrl = await getTunnelUrl();
    const serverUrl = process.env.BASE_URL || "http://127.0.0.1:8080";

    // Generate or get device token
    const tokenBytes = crypto.randomBytes(16).toString("hex");
    const authToken = `gate_sec_${tokenBytes}`;

    const provisioningPayload = {
      version: 1,
      deviceId,
      baseUrl: serverUrl,
      serverUrl,
      tunnelUrl,
      token: authToken,
      authToken,
      gateProfile: {
        gateId,
        gateName,
        direction,
        allowedTypes: ["EMPLOYEE", "CONTRACTOR", "VEHICLE", "KEY"],
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      provisioningPayload,
      qrString: JSON.stringify(provisioningPayload),
      scannerAppUrl: `${tunnelUrl}/scanner?link=true&device=${encodeURIComponent(
        deviceId
      )}`,
    });
  } catch (err) {
    console.error("Provisioning API error:", err);
    return NextResponse.json(
      { error: "Failed to generate provisioning payload" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { deviceId, gateProfile, authToken } = body;

    if (!deviceId) {
      return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
    }

    const gateName = gateProfile?.gateName || "Main Gate";
    const allowed = gateProfile?.allowedTypes
      ? gateProfile.allowedTypes.join(",")
      : "ALL";

    // Register or update provisioned device by device_name
    const existing = await prisma.devices.findFirst({
      where: { device_name: deviceId },
    });

    let device;
    if (existing) {
      device = await prisma.devices.update({
        where: { id: existing.id },
        data: {
          device_type: "Chainway C66 RFID/Barcode Handheld",
          status: "online",
          last_seen: new Date(),
        },
      });
    } else {
      device = await prisma.devices.create({
        data: {
          device_name: deviceId,
          device_type: "Chainway C66 RFID/Barcode Handheld",
          status: "online",
          total_scans: 0,
          last_seen: new Date(),
        },
      });
    }

    // Persist provisioning audit event
    await prisma.audit_logs
      .create({
        data: {
          action: "DEVICE_PROVISIONED",
          user: deviceId,
          entity_type: "device",
          entity_id: device.id,
          details: `Device provisioned for ${gateName} (Types: ${allowed}, Token: ${
            authToken ? "Active" : "None"
          })`,
          created_at: new Date(),
        },
      })
      .catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Device ${deviceId} registered with gate profile`,
      device,
      gateProfile,
    });
  } catch (err) {
    console.error("Provisioning POST error:", err);
    return NextResponse.json(
      { error: "Failed to process provisioning register" },
      { status: 500 }
    );
  }
}
