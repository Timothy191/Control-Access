import { NextResponse } from "next/server";
import { getTunnelStatus } from "@/lib/tunnel";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getTunnelStatus();
    return NextResponse.json(status);
  } catch {
    return NextResponse.json(
      { error: "Failed to resolve tunnel status" },
      { status: 500 }
    );
  }
}
