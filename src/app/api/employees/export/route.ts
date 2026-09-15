import { NextResponse } from "next/server";
import { exportEmployees } from "@/lib/data-exchange/employee-exchange";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") || "csv").toLowerCase() as "csv" | "json";
    const site = url.searchParams.get("site");
    const status = url.searchParams.get("status");
    const contractor = url.searchParams.get("contractor");
    const accessLevel = url.searchParams.get("access_level");
    const search = url.searchParams.get("search")?.trim();

    const result = await exportEmployees({
      format,
      site,
      status,
      contractor,
      accessLevel,
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
    console.error("Employee export error:", error);
    return NextResponse.json(
      { error: "Failed to export employees", details: String(error) },
      { status: 500 }
    );
  }
}
