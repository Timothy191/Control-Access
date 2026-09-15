import { NextResponse } from "next/server";
import { importFleet } from "@/lib/data-exchange/fleet-exchange";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const result = await importFleet(body);

    if (!result.success && result.summary.total_processed === 0) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Fleet import error:", error);
    return NextResponse.json(
      { error: "Failed to process fleet import", details: String(error) },
      { status: 500 }
    );
  }
}
