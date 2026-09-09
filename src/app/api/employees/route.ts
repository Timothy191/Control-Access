import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const employees = await prisma.employees.findMany();
    return NextResponse.json(employees);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newEmployee = await prisma.employees.create({
      data: body,
    });
    return NextResponse.json(newEmployee, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}
