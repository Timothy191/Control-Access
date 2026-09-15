import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  initiateKeyCheckout,
  verifyOperatorForKey,
  returnKey,
  getActiveKeySession,
} from "@/lib/key-custody-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const deviceId = url.searchParams.get("deviceId") || url.searchParams.get("device");
    const sessionId = url.searchParams.get("sessionId");
    const history = url.searchParams.get("history") === "true";
    const keyId = url.searchParams.get("keyId") || url.searchParams.get("key");

    if (history) {
      const logs = await prisma.key_custody_logs.findMany({
        take: 50,
        orderBy: { timestamp: "desc" },
        include: {
          key: true,
          operator: true,
        },
      });
      return NextResponse.json({ success: true, logs });
    }

    if (keyId) {
      const key = await prisma.keys.findFirst({
        where: {
          OR: [{ key_tag: keyId }, { machine_id: keyId }],
        },
        include: {
          vehicle: true,
          assigned_operator: true,
          custody_logs: {
            take: 10,
            orderBy: { timestamp: "desc" },
            include: { operator: true },
          },
        },
      });
      if (!key) {
        return NextResponse.json({ error: "Key not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, key });
    }

    const lookupId = sessionId || deviceId;
    if (!lookupId) {
      const allKeys = await prisma.keys.findMany({
        include: { vehicle: true, assigned_operator: true },
        orderBy: { updated_at: "desc" },
      });
      return NextResponse.json({ success: true, keys: allKeys });
    }

    const activeSession = getActiveKeySession(lookupId);
    return NextResponse.json({
      success: true,
      activeSession,
      hasActiveSession: Boolean(activeSession),
    });
  } catch (err) {
    console.error("Key custody GET error:", err);
    return NextResponse.json({ error: "Failed to query key custody" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "auto"; // "initiate", "verify", "return", "auto"
    const keyTag = body.keyTag || body.key || body.key_tag;
    const badgeTag = body.badgeTag || body.badge || body.operatorBadge || body.rfidTag || body.barcodeData;
    const sessionId = body.sessionId;
    const deviceId = body.deviceId || body.deviceName || "Chainway-C66-01";
    const gateLocation = body.gateLocation || body.gate || "Main Ingress Gate 1";
    const scannedBy = body.scannedBy || body.operator || deviceId;

    if (action === "initiate" || (action === "auto" && keyTag && !badgeTag)) {
      if (!keyTag) {
        return NextResponse.json({ error: "Missing keyTag for initiation" }, { status: 400 });
      }
      const session = await initiateKeyCheckout(keyTag, gateLocation, deviceId);
      return NextResponse.json({
        success: true,
        action: "initiated",
        session,
      });
    }

    if (action === "verify" || (action === "auto" && (sessionId || deviceId) && badgeTag)) {
      if (!badgeTag) {
        return NextResponse.json({ error: "Missing badgeTag for verification" }, { status: 400 });
      }
      const targetSessionId = sessionId || deviceId;
      const result = await verifyOperatorForKey(targetSessionId, badgeTag, gateLocation, scannedBy);
      return NextResponse.json({
        success: true,
        action: "verified",
        ...result,
      });
    }

    if (action === "return") {
      if (!keyTag) {
        return NextResponse.json({ error: "Missing keyTag for return" }, { status: 400 });
      }
      const result = await returnKey(keyTag, badgeTag, gateLocation, scannedBy);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid key custody action or parameters" }, { status: 400 });
  } catch (err) {
    console.error("Key custody POST error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
