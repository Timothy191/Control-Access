import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Normalizes input date strings into valid Date objects or null
 */
function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Check if the equipment type has safety-critical mandatory calibration requirements
 */
function isCalibrationRequired(equipmentType?: string | null): boolean {
  if (!equipmentType) return false;
  const upper = equipmentType.toUpperCase();
  return upper === "GAS_MONITOR" || upper.includes("GAS") || upper.includes("BREATH");
}

export interface CalibrationStatusResult {
  is_calibrated: boolean;
  is_expired: boolean;
  days_until_expiry: number | null;
  status: "VALID" | "EXPIRING_SOON" | "EXPIRED" | "REQUIRED" | "NOT_REQUIRED";
}

/**
 * Comprehensive calibration engine evaluating expiration, days remaining,
 * and industry safety compliance status.
 */
function evaluateCalibrationStatus(item: {
  calibration_expiry?: Date | string | null;
  equipment_type?: string | null;
}): CalibrationStatusResult {
  const now = new Date();
  const requiresCalib = isCalibrationRequired(item.equipment_type);

  if (!item.calibration_expiry) {
    if (requiresCalib) {
      return {
        is_calibrated: false,
        is_expired: true,
        days_until_expiry: null,
        status: "REQUIRED",
      };
    }
    return {
      is_calibrated: true,
      is_expired: false,
      days_until_expiry: null,
      status: "NOT_REQUIRED",
    };
  }

  const expiry = new Date(item.calibration_expiry);
  if (isNaN(expiry.getTime())) {
    if (requiresCalib) {
      return {
        is_calibrated: false,
        is_expired: true,
        days_until_expiry: null,
        status: "REQUIRED",
      };
    }
    return {
      is_calibrated: true,
      is_expired: false,
      days_until_expiry: null,
      status: "NOT_REQUIRED",
    };
  }

  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isExpired = diffMs < 0;

  let statusEnum: "VALID" | "EXPIRING_SOON" | "EXPIRED" | "REQUIRED" = "VALID";
  if (isExpired) {
    statusEnum = "EXPIRED";
  } else if (diffDays <= 30) {
    statusEnum = "EXPIRING_SOON";
  } else {
    statusEnum = "VALID";
  }

  return {
    is_calibrated: !isExpired,
    is_expired: isExpired,
    days_until_expiry: diffDays,
    status: statusEnum,
  };
}

/**
 * Format database record into clean, consistent API response
 */
function formatEquipment(e: Record<string, unknown>) {
  const calibrationExpiry = e.calibration_expiry ? new Date(String(e.calibration_expiry)) : null;
  const eqType = (e.equipment_type as string) || "TWO_WAY_RADIO";
  const calib = evaluateCalibrationStatus({
    calibration_expiry: calibrationExpiry,
    equipment_type: eqType,
  });

  let status = (e.status as string) || "Active";
  // Automatic transition: If status is Active, but calibration is expired or required and missing,
  // evaluate status as "Out of Calibration" to prevent assigning uncalibrated equipment.
  if (status === "Active" && (calib.is_expired || !calib.is_calibrated)) {
    status = "Out of Calibration";
  }

  return {
    id: e.id as number,
    radio_id: e.radio_id as string,
    equipment_type: eqType,
    model_name: (e.model_name as string) || null,
    serial_number: (e.serial_number as string) || null,
    barcode: (e.barcode as string) || null,
    rfid_tag: (e.rfid_tag as string) || null,
    qr_code: (e.qr_code as string) || null,
    status,
    calibration_expiry: calibrationExpiry ? calibrationExpiry.toISOString() : null,
    registration_expiry: e.registration_expiry ? new Date(String(e.registration_expiry)).toISOString() : null,
    assigned_to_id: (e.assigned_to_id as number) || null,
    assigned_to: e.assigned_to || null,
    calibration_status: calib,
    created_at: e.created_at ? new Date(String(e.created_at)).toISOString() : new Date().toISOString(),
  };
}

/**
 * GET /api/equipment
 * Query equipment and gas monitors with rich filtering
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const idParam = url.searchParams.get("id");
    const radioIdParam = url.searchParams.get("radio_id") || url.searchParams.get("equipment_id");
    const barcodeParam = url.searchParams.get("barcode");
    const rfidParam = url.searchParams.get("rfid_tag");

    // 1. Single lookup
    if (idParam || radioIdParam || barcodeParam || rfidParam) {
      const item = await prisma.equipment.findFirst({
        where: {
          OR: [
            idParam ? { id: parseInt(idParam, 10) } : {},
            radioIdParam ? { radio_id: radioIdParam } : {},
            barcodeParam ? { barcode: barcodeParam } : {},
            rfidParam ? { rfid_tag: rfidParam } : {},
          ],
        },
        include: { assigned_to: true },
      });

      if (!item) {
        return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        equipment: formatEquipment(item as unknown as Record<string, unknown>),
      });
    }

    // 2. Multi-item filter
    const typeParam = url.searchParams.get("type") || url.searchParams.get("equipment_type");
    const status = url.searchParams.get("status");
    const calibrationStatus = url.searchParams.get("calibration_status");
    const search = url.searchParams.get("search")?.trim();
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "100", 10), 1), 500);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);

    const where: Prisma.equipmentWhereInput = {};

    if (typeParam && typeParam !== "all") {
      where.equipment_type = typeParam.toUpperCase();
    }

    if (status && status !== "all") {
      where.status = status;
    }

    const now = new Date();
    if (calibrationStatus === "expired") {
      where.calibration_expiry = { lt: now };
    } else if (calibrationStatus === "valid") {
      where.calibration_expiry = { gte: now };
    } else if (calibrationStatus === "expiring_soon") {
      const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      where.calibration_expiry = { gte: now, lte: soon };
    } else if (calibrationStatus === "required" || calibrationStatus === "calibration_required") {
      where.calibration_expiry = null;
      where.equipment_type = "GAS_MONITOR";
    }

    if (search) {
      where.OR = [
        { radio_id: { contains: search } },
        { barcode: { contains: search } },
        { rfid_tag: { contains: search } },
        { model_name: { contains: search } },
        { serial_number: { contains: search } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.equipment.count({ where }),
      prisma.equipment.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: limit,
        skip: offset,
        include: { assigned_to: true },
      }),
    ]);

    const formatted = items.map((e) =>
      formatEquipment(e as unknown as Record<string, unknown>)
    );

    return NextResponse.json({
      success: true,
      total,
      count: formatted.length,
      limit,
      offset,
      equipment: formatted,
    });
  } catch (error) {
    console.error("Equipment GET error:", error);
    return NextResponse.json({ error: "Failed to fetch equipment", details: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/equipment
 * Register equipment or atmospheric monitors with strict uniqueness and safety verification
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const radioId = (body.radio_id || body.equipment_id || body.id)?.trim();

    if (!radioId) {
      return NextResponse.json(
        { error: "Field 'radio_id' is required", field: "radio_id" },
        { status: 400 }
      );
    }

    // 1. Check unique radio_id
    const existing = await prisma.equipment.findUnique({
      where: { radio_id: radioId },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Equipment with radio_id '${radioId}' already exists`, field: "radio_id" },
        { status: 409 }
      );
    }

    // 2. Check unique barcode
    const barcode = body.barcode?.trim() || null;
    if (barcode) {
      const barcodeConflict = await prisma.equipment.findUnique({ where: { barcode } });
      if (barcodeConflict) {
        return NextResponse.json(
          { error: `Barcode '${barcode}' is already assigned to equipment ${barcodeConflict.radio_id}`, field: "barcode" },
          { status: 409 }
        );
      }
    }

    // 3. Check unique qr_code
    const qrCode = body.qr_code?.trim() || null;
    if (qrCode) {
      const qrConflict = await prisma.equipment.findUnique({ where: { qr_code: qrCode } });
      if (qrConflict) {
        return NextResponse.json(
          { error: `QR code '${qrCode}' is already assigned to equipment ${qrConflict.radio_id}`, field: "qr_code" },
          { status: 409 }
        );
      }
    }

    // 4. Check unique rfid_tag
    const rfidTag = body.rfid_tag?.trim() || null;
    if (rfidTag) {
      const rfidConflict = await prisma.equipment.findUnique({ where: { rfid_tag: rfidTag } });
      if (rfidConflict) {
        return NextResponse.json(
          { error: `RFID tag '${rfidTag}' is already assigned to equipment ${rfidConflict.radio_id}`, field: "rfid_tag" },
          { status: 409 }
        );
      }
    }

    // Validate assigned employee if provided
    let assignedToId: number | null = null;
    if (body.assigned_to_id) {
      assignedToId = parseInt(String(body.assigned_to_id), 10);
      const employeeExists = await prisma.employees.findUnique({ where: { id: assignedToId } });
      if (!employeeExists) {
        return NextResponse.json(
          { error: `Assigned employee with ID ${assignedToId} does not exist`, field: "assigned_to_id" },
          { status: 400 }
        );
      }
    }

    // Evaluate safety calibration status and transition status if expired or uncalibrated
    const eqType = (body.equipment_type || "TWO_WAY_RADIO").toUpperCase();
    const calibExpiryDate = parseDate(body.calibration_expiry);
    let initialStatus = body.status?.trim() || "Active";

    const calib = evaluateCalibrationStatus({
      calibration_expiry: calibExpiryDate,
      equipment_type: eqType,
    });

    if (initialStatus === "Active" && (calib.is_expired || !calib.is_calibrated)) {
      initialStatus = "Out of Calibration";
    }

    const created = await prisma.equipment.create({
      data: {
        radio_id: radioId,
        equipment_type: eqType,
        model_name: body.model_name?.trim() || null,
        serial_number: body.serial_number?.trim() || null,
        barcode,
        rfid_tag: rfidTag,
        qr_code: qrCode,
        status: initialStatus,
        calibration_expiry: calibExpiryDate,
        registration_expiry: parseDate(body.registration_expiry),
        assigned_to_id: assignedToId,
      },
      include: { assigned_to: true },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Equipment registered successfully",
        equipment: formatEquipment(created as unknown as Record<string, unknown>),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Equipment POST error:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = (error.meta?.target as string[]) || [];
      const field = Array.isArray(target) ? target.join(", ") : String(target);
      return NextResponse.json(
        {
          error: `A unique constraint violation occurred on equipment registration${field ? ` (${field})` : ""}`,
          field: field || undefined,
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create equipment", details: String(error) }, { status: 500 });
  }
}

/**
 * PUT / PATCH /api/equipment
 * Update equipment details, execute lifecycle actions (recalibrate, assign, return)
 */
export async function PUT(req: Request) {
  try {
    const url = new URL(req.url);
    const body = await req.json();
    const id = parseInt(url.searchParams.get("id") || String(body.id || ""), 10);
    const radioId = url.searchParams.get("radio_id") || body.radio_id;

    if (!id && !radioId) {
      return NextResponse.json({ error: "Equipment 'id' or 'radio_id' required" }, { status: 400 });
    }

    const existing = await prisma.equipment.findFirst({
      where: id ? { id } : { radio_id: radioId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
    }

    // Unique conflict pre-checks for updates
    if (body.radio_id !== undefined) {
      const newRadioId = body.radio_id?.trim();
      if (newRadioId && newRadioId !== existing.radio_id) {
        const conflict = await prisma.equipment.findUnique({ where: { radio_id: newRadioId } });
        if (conflict && conflict.id !== existing.id) {
          return NextResponse.json({ error: `radio_id '${newRadioId}' already in use`, field: "radio_id" }, { status: 409 });
        }
      }
    }

    if (body.barcode !== undefined) {
      const bc = body.barcode?.trim() || null;
      if (bc && bc !== existing.barcode) {
        const conflict = await prisma.equipment.findUnique({ where: { barcode: bc } });
        if (conflict && conflict.id !== existing.id) {
          return NextResponse.json({ error: `Barcode '${bc}' already in use`, field: "barcode" }, { status: 409 });
        }
      }
    }

    if (body.qr_code !== undefined) {
      const qr = body.qr_code?.trim() || null;
      if (qr && qr !== existing.qr_code) {
        const conflict = await prisma.equipment.findUnique({ where: { qr_code: qr } });
        if (conflict && conflict.id !== existing.id) {
          return NextResponse.json({ error: `QR code '${qr}' already in use`, field: "qr_code" }, { status: 409 });
        }
      }
    }

    if (body.rfid_tag !== undefined) {
      const rfid = body.rfid_tag?.trim() || null;
      if (rfid && rfid !== existing.rfid_tag) {
        const conflict = await prisma.equipment.findUnique({ where: { rfid_tag: rfid } });
        if (conflict && conflict.id !== existing.id) {
          return NextResponse.json({ error: `RFID tag '${rfid}' already in use`, field: "rfid_tag" }, { status: 409 });
        }
      }
    }

    const updateData: Prisma.equipmentUpdateInput = {};

    if (body.equipment_type !== undefined) updateData.equipment_type = body.equipment_type.toUpperCase();
    if (body.model_name !== undefined) updateData.model_name = body.model_name?.trim() || null;
    if (body.serial_number !== undefined) updateData.serial_number = body.serial_number?.trim() || null;
    if (body.barcode !== undefined) updateData.barcode = body.barcode?.trim() || null;
    if (body.rfid_tag !== undefined) updateData.rfid_tag = body.rfid_tag?.trim() || null;
    if (body.qr_code !== undefined) updateData.qr_code = body.qr_code?.trim() || null;
    if (body.radio_id !== undefined) updateData.radio_id = body.radio_id?.trim();
    if (body.calibration_expiry !== undefined) updateData.calibration_expiry = parseDate(body.calibration_expiry);
    if (body.registration_expiry !== undefined) updateData.registration_expiry = parseDate(body.registration_expiry);

    // Lifecycle Action Handlers
    if (body.action === "recalibrate") {
      updateData.status = "Active";
      if (body.calibration_expiry !== undefined) {
        updateData.calibration_expiry = parseDate(body.calibration_expiry);
      }
    } else if (body.action === "assign") {
      if (body.assigned_to_id !== undefined) {
        const empId = parseInt(String(body.assigned_to_id), 10);
        const employeeExists = await prisma.employees.findUnique({ where: { id: empId } });
        if (!employeeExists) {
          return NextResponse.json({ error: `Employee ${empId} not found`, field: "assigned_to_id" }, { status: 400 });
        }
        updateData.assigned_to = { connect: { id: empId } };
      }
      updateData.status = body.status || "Assigned";
    } else if (body.action === "return") {
      updateData.assigned_to = { disconnect: true };
      updateData.status = body.status || "Active";
    } else {
      if (body.status !== undefined) updateData.status = body.status;
      if (body.assigned_to_id !== undefined) {
        if (body.assigned_to_id === null) {
          updateData.assigned_to = { disconnect: true };
        } else {
          const empId = parseInt(String(body.assigned_to_id), 10);
          const employeeExists = await prisma.employees.findUnique({ where: { id: empId } });
          if (!employeeExists) {
            return NextResponse.json({ error: `Employee ${empId} not found`, field: "assigned_to_id" }, { status: 400 });
          }
          updateData.assigned_to = { connect: { id: empId } };
        }
      }
    }

    // Check if resulting state requires status transition to "Out of Calibration"
    const resultingStatus = (updateData.status as string) !== undefined ? (updateData.status as string) : existing.status;
    const resultingExpiry = updateData.calibration_expiry !== undefined ? (updateData.calibration_expiry as Date | null) : existing.calibration_expiry;
    const resultingType = (updateData.equipment_type as string) !== undefined ? (updateData.equipment_type as string) : existing.equipment_type;

    const calib = evaluateCalibrationStatus({
      calibration_expiry: resultingExpiry,
      equipment_type: resultingType,
    });

    if (resultingStatus === "Active" && (calib.is_expired || !calib.is_calibrated)) {
      updateData.status = "Out of Calibration";
    }

    const updated = await prisma.equipment.update({
      where: { id: existing.id },
      data: updateData,
      include: { assigned_to: true },
    });

    return NextResponse.json({
      success: true,
      equipment: formatEquipment(updated as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error("Equipment PUT error:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = (error.meta?.target as string[]) || [];
      const field = Array.isArray(target) ? target.join(", ") : String(target);
      return NextResponse.json(
        {
          error: `A unique constraint violation occurred on equipment update${field ? ` (${field})` : ""}`,
          field: field || undefined,
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to update equipment", details: String(error) }, { status: 500 });
  }
}

export const PATCH = PUT;

/**
 * DELETE /api/equipment
 * Decommission (mode=soft) or permanently delete (mode=hard) equipment
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const idParam = url.searchParams.get("id");
    const radioIdParam = url.searchParams.get("radio_id");
    const mode = url.searchParams.get("mode");

    if (!idParam && !radioIdParam) {
      return NextResponse.json({ error: "Equipment 'id' or 'radio_id' required" }, { status: 400 });
    }

    const existing = await prisma.equipment.findFirst({
      where: idParam ? { id: parseInt(idParam, 10) } : { radio_id: radioIdParam! },
    });

    if (!existing) {
      return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
    }

    // Soft Deletion mode: preserves record and audit logs, updates status to Decommissioned
    if (mode === "soft") {
      const decommissioned = await prisma.equipment.update({
        where: { id: existing.id },
        data: { status: "Decommissioned" },
        include: { assigned_to: true },
      });

      return NextResponse.json({
        success: true,
        message: "Equipment decommissioned successfully",
        mode: "soft",
        equipment: formatEquipment(decommissioned as unknown as Record<string, unknown>),
      });
    }

    // Hard Deletion mode (mode=hard or default): safely catches foreign key violations
    try {
      await prisma.equipment.delete({ where: { id: existing.id } });
      return NextResponse.json({
        success: true,
        message: "Equipment permanently deleted",
        mode: "hard",
        id: existing.id,
      });
    } catch (delError) {
      if (delError instanceof Prisma.PrismaClientKnownRequestError && delError.code === "P2003") {
        return NextResponse.json(
          {
            error: "Cannot hard-delete equipment because related gate logs exist. Use mode=soft instead.",
            canSoftDelete: true,
          },
          { status: 409 }
        );
      }
      throw delError;
    }
  } catch (error) {
    console.error("Equipment DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete equipment", details: String(error) }, { status: 500 });
  }
}
