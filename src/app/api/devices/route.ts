import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const devices = await prisma.devices.findMany();
    return NextResponse.json(devices);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch devices" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newDevice = await prisma.devices.create({
      data: body,
    });
    return NextResponse.json(newDevice, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create device" }, { status: 500 });
  }
}
