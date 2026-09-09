import { NextResponse } from "next/server";
import { processQrScan } from "@/lib/scan-service";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { qr_data, gate_location, direction, scanned_by } = data;

    if (!qr_data) {
      return NextResponse.json({ error: "Missing qr_data" }, { status: 400 });
    }

    const ipAddress = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "unknown";

    const result = await processQrScan({
      qrHash: qr_data,
      gateLocation: gate_location || "API",
      scannedBy: scanned_by || "Hardware Device",
      ipAddress,
      userAgent,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("QR Scan API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
