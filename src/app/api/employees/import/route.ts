import { NextResponse } from "next/server";
import { importEmployees } from "@/lib/data-exchange/employee-exchange";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const result = await importEmployees(body);

    if (!result.success && result.summary.total_processed === 0) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Employee import error:", error);
    return NextResponse.json(
      { error: "Failed to process employee import", details: String(error) },
      { status: 500 }
    );
  }
}
