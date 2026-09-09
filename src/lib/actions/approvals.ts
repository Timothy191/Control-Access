"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { encryptField } from "@/lib/crypto";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

function sha256(value: string): string {
  return crypto
    .createHash("sha256")
    .update(value.trim(), "utf-8")
    .digest("hex");
}

function asString(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function requireAdminOrManager(role: string | undefined) {
  if (!role || !["admin", "manager"].includes(role)) {
    throw new Error("Forbidden: admin or manager role required");
  }
}

export interface ApproveInput {
  comment?: string;
  targetTable?: string;
  formData?: Record<string, string>;
}

export async function approveRequest(id: number, input: ApproveInput = {}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireAdminOrManager((session.user as { role?: string }).role);

  const approval = await prisma.approvals.findUnique({ where: { id } });
  if (!approval) throw new Error("Approval not found");

  const comment = input.comment ?? "";
  const target = input.targetTable || approval.target_table || "employees";
  const formData = input.formData ?? {};

  let scannedData: Record<string, string | number | null | undefined> = {};
  if (approval.scanned_data) {
    try {
      scannedData = JSON.parse(approval.scanned_data) as Record<
        string,
        string | number | null | undefined
      >;
    } catch {
      scannedData = {};
    }
  }

  let newEntityId: number | null = null;
  let entityType: string | null = null;

  if (target === "employees") {
    const originalQrCode =
      asString(scannedData.qr_code) ||
      asString(scannedData.original_data) ||
      null;
    let empIdFromScan = asString(scannedData.employee_id);

    if (!empIdFromScan && originalQrCode) {
      const idMatch = originalQrCode.match(/ID[:\s]*(\d+)/);
      if (idMatch) empIdFromScan = idMatch[1];
    }
    if (!empIdFromScan)
      empIdFromScan = `TEMP${String(approval.id).padStart(8, "0")}`;

    let existing = null;
    if (originalQrCode) {
      existing = await prisma.employees.findUnique({
        where: { qr_code: originalQrCode },
      });
    }
    if (!existing && empIdFromScan) {
      existing = await prisma.employees.findUnique({
        where: { emp_code: empIdFromScan },
      });
    }

    if (!existing) {
      const fullName =
        asString(scannedData.name) ||
        formData.name ||
        approval.requester_name ||
        "Unknown";
      const nameParts = fullName.split(/\s+/);
      const firstName = nameParts[0] || "Unknown";
      const surname = nameParts.slice(1).join(" ");

      const idNumber =
        asString(scannedData.id_number) || formData.id_number || empIdFromScan;

      const newEmployee = await prisma.employees.create({
        data: {
          emp_code: empIdFromScan,
          first_name: firstName,
          surname,
          job_title:
            asString(scannedData.position) || formData.position || "Unknown",
          status: "Active",
          qr_code: originalQrCode,
          id_number: encryptField(idNumber),
          id_number_hash: sha256(idNumber),
        },
      });
      newEntityId = newEmployee.id;
      entityType = "employee";
    } else {
      await prisma.employees.update({
        where: { id: existing.id },
        data: { status: "Active" },
      });
      newEntityId = existing.id;
      entityType = "employee";
    }
  } else if (target === "fleet") {
    const fleetId =
      formData.registration ||
      asString(scannedData.employee_id) ||
      `TEMP${String(approval.id).padStart(4, "0")}`;

    let vehicle = await prisma.vehicles.findUnique({
      where: { fleet_id: fleetId },
    });

    if (!vehicle) {
      vehicle = await prisma.vehicles.create({
        data: { fleet_id: fleetId, status: "Active" },
      });

      const qrData = `VEH:${vehicle.id}:${fleetId}:${Date.now()}`;
      const qrHash = sha256(qrData).slice(0, 32).toUpperCase();
      await prisma.vehicles.update({
        where: { id: vehicle.id },
        data: { qr_code: qrHash },
      });

      newEntityId = vehicle.id;
      entityType = "vehicle";
    }
  }

  await prisma.approvals.update({
    where: { id },
    data: {
      status: "Approved",
      approved_by: session.user.name ?? null,
      approval_date: new Date(),
      comments: comment,
      target_table: target,
      request_id: newEntityId ?? approval.request_id,
    },
  });

  // Update the latest matching gate log, if any
  const gateLog = await prisma.gate_logs.findFirst({
    where: {
      entity_id: approval.request_id,
      entity_name: approval.requester_name,
    },
    orderBy: { scanned_at: "desc" },
  });

  if (gateLog) {
    await prisma.gate_logs.update({
      where: { id: gateLog.id },
      data: {
        access_granted: true,
        denial_reason: null,
        entity_id: newEntityId ?? gateLog.entity_id,
        ...(entityType === "employee" && newEntityId
          ? { employee_id: newEntityId }
          : {}),
        ...(entityType === "vehicle" && newEntityId
          ? { vehicle_id: newEntityId }
          : {}),
      },
    });
  }

  revalidatePath("/approvals");
  return {
    success: true,
    message: `Approved and added to ${target}`,
    entity_id: newEntityId,
    entity_type: entityType,
  };
}

export async function rejectRequest(id: number, comment = "") {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireAdminOrManager((session.user as { role?: string }).role);

  const approval = await prisma.approvals.findUnique({ where: { id } });
  if (!approval) throw new Error("Approval not found");

  await prisma.approvals.update({
    where: { id },
    data: {
      status: "Rejected",
      approved_by: session.user.name ?? null,
      approval_date: new Date(),
      comments: comment,
    },
  });

  const gateLog = await prisma.gate_logs.findFirst({
    where: {
      entity_id: approval.request_id,
      entity_name: approval.requester_name,
    },
    orderBy: { scanned_at: "desc" },
  });

  if (gateLog) {
    await prisma.gate_logs.update({
      where: { id: gateLog.id },
      data: {
        access_granted: false,
        denial_reason: `Rejected: ${comment || "No reason"}`,
      },
    });
  }

  revalidatePath("/approvals");
  return { success: true };
}
