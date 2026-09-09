import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const approvalId = Number(id);
  if (Number.isNaN(approvalId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const approval = await prisma.approvals.findUnique({
    where: { id: approvalId },
  });
  if (!approval) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let scannedData: unknown = null;
  if (approval.scanned_data) {
    try {
      scannedData = JSON.parse(approval.scanned_data);
    } catch {
      scannedData = approval.scanned_data;
    }
  }

  const response: Record<string, unknown> = {
    id: approval.id,
    request_type: approval.request_type,
    request_id: approval.request_id,
    requester_name: approval.requester_name,
    details: approval.details,
    created_at: approval.created_at
      .toISOString()
      .slice(0, 16)
      .replace("T", " "),
    status: approval.status,
    target_table: approval.target_table,
    scanned_data: scannedData,
  };

  // Add entity-specific details
  if (approval.request_type === "Employee" && approval.request_id) {
    const employee = await prisma.employees.findUnique({
      where: { id: approval.request_id },
    });
    if (employee) {
      response["entity_data"] = {
        id: employee.id,
        emp_code: employee.emp_code,
        first_name: employee.first_name,
        surname: employee.surname,
        job_title: employee.job_title || "N/A",
        status: employee.status,
      };
    }
  } else if (approval.request_type === "Vehicle" && approval.request_id) {
    const vehicle = await prisma.vehicles.findUnique({
      where: { id: approval.request_id },
    });
    if (vehicle) {
      response["entity_data"] = {
        id: vehicle.id,
        fleet_id: vehicle.fleet_id,
        status: vehicle.status,
      };
    }
  } else if (approval.request_type === "Visitor" && approval.request_id) {
    const visitor = await prisma.visitors.findUnique({
      where: { id: approval.request_id },
    });
    if (visitor) {
      response["entity_data"] = {
        id: visitor.id,
        name: visitor.name,
        company: visitor.company || "N/A",
        purpose: visitor.purpose || "N/A",
        status: visitor.status,
      };
    }
  }

  return NextResponse.json(response);
}
