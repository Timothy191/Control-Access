/**
 * Public Cloudflare Tunnel Status API Route
 * File: src/app/api/tunnel-status/route.ts
 *
 * Exposes real-time tunnel endpoint, edge location, and daemon telemetry.
 */

import { NextResponse } from "next/server";
import { getTunnelStatus } from "@/lib/tunnel";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get("refresh") === "true";
    const status = await getTunnelStatus(forceRefresh);

    return NextResponse.json(status, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("Tunnel status API error:", err);
    return NextResponse.json(
      {
        active: false,
        error: "Failed to determine tunnel status",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
