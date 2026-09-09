import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Fleet API Endpoint" });
}

export async function POST() {
  return NextResponse.json({ message: "Fleet POST Endpoint" });
}
