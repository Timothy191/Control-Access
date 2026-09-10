import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { processQrScan, processRfidScan } from "@/lib/scan-service";
import { broadcastDeviceNotification } from "@/lib/device-notifications";

export async function POST(req: Request) {
  try {
    const ipAddress = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "Chainway-C66-Infowedge";

    const body = await req.json().catch(() => ({}));
    const rawData =
      body.barcodeData ||
      body.qr_code ||
      body.rfidTag ||
      body.data ||
      body.tag ||
      "";
    const deviceId =
      body.deviceId ||
      body.device_id ||
      body.deviceName ||
      body.device ||
      "Chainway C66 Handheld";
    const deviceName = body.deviceName || body.device || deviceId;
    const deviceType = body.deviceType || (body.rfidTag ? "C66 RFID Reader" : "C66 Barcode Scanner");
    const gateLocation = body.gateLocation || body.gate || "Mobile Patrol C66";
    const scannedBy = body.scannedBy || body.operator || "C66 Operator";

    if (!rawData) {
      return NextResponse.json(
        { error: "Missing barcode or RFID scan data" },
        { status: 400 }
      );
    }

    // 1. Update or Auto-Register Device in Database
    try {
      const existingDevice = await prisma.devices.findFirst({
        where: {
          OR: [
            { device_name: deviceName },
            { ip_address: ipAddress },
          ],
        },
      });

      if (existingDevice) {
        await prisma.devices.update({
          where: { id: existingDevice.id },
          data: {
            device_name: deviceName,
            device_type: deviceType,
            ip_address: ipAddress,
            status: "online",
            total_scans: { increment: 1 },
            last_seen: new Date(),
          },
        });
      } else {
        await prisma.devices.create({
          data: {
            device_name: deviceName,
            device_type: deviceType,
            ip_address: ipAddress,
            status: "online",
            total_scans: 1,
            last_seen: new Date(),
          },
        });
      }
    } catch (dbErr) {
      console.error("Device registration error:", dbErr);
    }

    // 2. Process Scan (RFID vs QR / Barcode)
    const isRfidTag =
      Boolean(body.rfidTag) ||
      rawData.startsWith("RFID_") ||
      rawData.startsWith("TAG_") ||
      rawData.startsWith("EPC:") ||
      rawData.startsWith("UID:") ||
      /^[0-9A-F]{16,32}$/i.test(rawData);

    let result;
    if (isRfidTag) {
      result = await processRfidScan({
        rfidTag: rawData,
        gateLocation,
        scannedBy,
        ipAddress,
        userAgent,
      });
    } else {
      result = await processQrScan({
        qrHash: rawData,
        gateLocation,
        scannedBy,
        ipAddress,
        userAgent,
      });
    }

    // 3. Send Notification to Scanner (especially if Access Denied)
    let notification;
    if (!result.accessGranted) {
      notification = await broadcastDeviceNotification({
        type: "ACCESS_DENIED",
        severity: "danger",
        title: "⛔ ACCESS DENIED",
        message: `${result.entityName || "Unknown Subject"} - ${
          result.denialReason || "Unauthorized Credential"
        }`,
        entityName: result.entityName || "Unknown Subject",
        denialReason: result.denialReason || "Access Denied",
        gateLocation,
        rawTag: rawData,
        targetDeviceId: deviceId,
      });
    } else {
      notification = await broadcastDeviceNotification({
        type: "ACCESS_GRANTED",
        severity: "success",
        title: "✓ ACCESS GRANTED",
        message: `${result.entityName} authorized for entry @ ${gateLocation}`,
        entityName: result.entityName,
        gateLocation,
        rawTag: rawData,
        targetDeviceId: deviceId,
      });
    }

    return NextResponse.json({
      success: true,
      accessGranted: result.accessGranted,
      denialReason: result.denialReason,
      entityName: result.entityName,
      entityType: result.entityType,
      direction: result.direction,
      gateLocation,
      targetDeviceId: deviceId,
      notificationSent: Boolean(notification),
      notification,
    });
  } catch (err) {
    console.error("Error processing C66 scan:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
