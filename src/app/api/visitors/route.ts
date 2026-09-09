import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const visitors = await prisma.visitors.findMany();
    return NextResponse.json(visitors);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch visitors" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newVisitor = await prisma.visitors.create({
      data: body,
    });
    return NextResponse.json(newVisitor, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create visitor" }, { status: 500 });
  }
}
