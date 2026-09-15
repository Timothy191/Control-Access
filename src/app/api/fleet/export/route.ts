import { NextResponse } from "next/server";
import { exportFleet } from "@/lib/data-exchange/fleet-exchange";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") || "csv").toLowerCase() as "csv" | "json";
    const typeParam = url.searchParams.get("type") || url.searchParams.get("vehicle_type");
    const isHeavyFleetParam = url.searchParams.get("is_heavy_fleet");
    const status = url.searchParams.get("status");
    const cert = url.searchParams.get("required_certification");
    const search = url.searchParams.get("search")?.trim();

    const result = await exportFleet({
      format,
      typeParam,
      isHeavyFleetParam,
      status,
      cert,
      search,
    });

    return new Response(result.data, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch (error) {
    console.error("Fleet export error:", error);
    return NextResponse.json(
      { error: "Failed to export fleet", details: String(error) },
      { status: 500 }
    );
  }
}
