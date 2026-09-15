import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { entityType, entityId, cardType, cardData } = await req.json();

    if (!entityType || !entityId || !cardType || !cardData) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let result;
    const updateData = cardType === "RFID" ? { rfid_tag: cardData } : { qr_code: cardData };

    if (entityType === "EMPLOYEE") {
      result = await prisma.employees.update({ where: { id: Number(entityId) }, data: updateData });
    } else if (entityType === "VISITOR") {
      result = await prisma.visitors.update({ where: { id: Number(entityId) }, data: updateData });
    } else if (entityType === "VEHICLE") {
      result = await prisma.vehicles.update({ where: { id: Number(entityId) }, data: updateData });
    } else {
      return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    console.error("Assign card error:", error);
    return NextResponse.json(
      { error: "Failed to assign card", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
