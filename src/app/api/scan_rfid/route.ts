import { NextResponse } from "next/server";
import { processRfidScan } from "@/lib/scan-service";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { rfid_tag, gate_location, direction, scanned_by } = data;

    if (!rfid_tag) {
      return NextResponse.json({ error: "Missing rfid_tag" }, { status: 400 });
    }

    const ipAddress = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "unknown";

    const result = await processRfidScan({
      rfidTag: rfid_tag,
      gateLocation: gate_location || "API",
      scannedBy: scanned_by || "Hardware Device",
      ipAddress,
      userAgent,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("RFID Scan API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
