import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { exportFleet, importFleet } from "@/lib/data-exchange/fleet-exchange";

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
 * Helper to determine compliance status for personal vehicles
 */
function evaluateVehicleCompliance(vehicle: {
  roadworthy_expiry?: Date | null;
  license_disc_expiry?: Date | null;
}) {
  const now = new Date();
  const roadworthyValid = vehicle.roadworthy_expiry
    ? new Date(vehicle.roadworthy_expiry) >= now
    : true;
  const licenseDiscValid = vehicle.license_disc_expiry
    ? new Date(vehicle.license_disc_expiry) >= now
    : true;

  return {
    roadworthy_valid: roadworthyValid,
    license_disc_valid: licenseDiscValid,
    is_compliant: roadworthyValid && licenseDiscValid,
  };
}

/**
 * Format database record into clean, consistent API response
 */
function formatVehicle(v: Record<string, unknown>) {
  const vehicleType = String(v.vehicle_type || "HEAVY_FLEET");
  const isHeavyFleet = Boolean(v.is_heavy_fleet ?? vehicleType === "HEAVY_FLEET");
  const operationalHours = typeof v.operational_hours === "number" ? v.operational_hours : 0;
  const roadworthyExpiry = v.roadworthy_expiry ? new Date(String(v.roadworthy_expiry)) : null;
  const licenseDiscExpiry = v.license_disc_expiry ? new Date(String(v.license_disc_expiry)) : null;

  const compliance = evaluateVehicleCompliance({
    roadworthy_expiry: roadworthyExpiry,
    license_disc_expiry: licenseDiscExpiry,
  });

  return {
    id: v.id as number,
    fleet_id: v.fleet_id as string,
    machine_id: (v.machine_id as string) || (v.fleet_id as string),
    vehicle_type: vehicleType,
    is_heavy_fleet: isHeavyFleet,
    make: (v.make as string) || null,
    model: (v.model as string) || null,
    license_plate: (v.license_plate as string) || null,
    status: (v.status as string) || "Active",
    operational_hours: operationalHours,
    required_certification: (v.required_certification as string) || null,
    license_disc_expiry: licenseDiscExpiry ? licenseDiscExpiry.toISOString() : null,
    roadworthy_expiry: roadworthyExpiry ? roadworthyExpiry.toISOString() : null,
    registration_expiry: v.registration_expiry
      ? new Date(String(v.registration_expiry)).toISOString()
      : null,
    owner_id: (v.owner_id as number) || null,
    owner: v.owner || null,
    qr_code: (v.qr_code as string) || null,
    rfid_tag: (v.rfid_tag as string) || null,
    compliance_status: compliance,
    created_at: v.created_at ? new Date(String(v.created_at)).toISOString() : new Date().toISOString(),
  };
}

/**
 * GET /api/fleet
 * Query heavy fleet and personal vehicles with rich filtering
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const exportParam = url.searchParams.get("export");
    const formatParam = url.searchParams.get("format");

    // Check if Export requested
    if (exportParam === "true" || formatParam === "csv") {
      const typeParam = url.searchParams.get("type") || url.searchParams.get("vehicle_type");
      const isHeavyFleetParam = url.searchParams.get("is_heavy_fleet");
      const status = url.searchParams.get("status");
      const cert = url.searchParams.get("required_certification");
      const search = url.searchParams.get("search")?.trim();

      const exportResult = await exportFleet({
        format: formatParam === "json" ? "json" : "csv",
        typeParam,
        isHeavyFleetParam,
        status,
        cert,
        search,
      });

      return new Response(exportResult.data, {
        status: 200,
        headers: {
          "Content-Type": exportResult.contentType,
          "Content-Disposition": `attachment; filename="${exportResult.filename}"`,
          "Cache-Control": "no-cache, no-store",
        },
      });
    }

    const idParam = url.searchParams.get("id");
    const fleetIdParam = url.searchParams.get("fleet_id") || url.searchParams.get("machine_id");

    // 1. Single vehicle lookup
    if (idParam || fleetIdParam) {
      const vehicle = await prisma.vehicles.findFirst({
        where: idParam ? { id: parseInt(idParam, 10) } : { fleet_id: fleetIdParam! },
        include: {
          gate_logs: {
            take: 5,
            orderBy: { id: "desc" },
          },
          owner: true,
        },
      });

      if (!vehicle) {
        return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        vehicle: formatVehicle(vehicle as unknown as Record<string, unknown>),
      });
    }

    // 2. Multi-record filtering
    const typeParam = url.searchParams.get("type") || url.searchParams.get("vehicle_type");
    const isHeavyFleetParam = url.searchParams.get("is_heavy_fleet");
    const status = url.searchParams.get("status");
    const cert = url.searchParams.get("required_certification");
    const ownerIdParam = url.searchParams.get("owner_id");
    const search = url.searchParams.get("search")?.trim();
    const hoursMin = url.searchParams.get("hours_min");
    const hoursMax = url.searchParams.get("hours_max");
    const roadworthyStatus = url.searchParams.get("roadworthy_status");
    const discStatus = url.searchParams.get("license_disc_status");
    const format = url.searchParams.get("format");

    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "100", 10), 1), 500);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);

    const where: Prisma.vehiclesWhereInput = {};

    // Vehicle Type Filter
    if (isHeavyFleetParam !== null) {
      const isHeavy = isHeavyFleetParam === "true";
      where.vehicle_type = isHeavy ? "HEAVY_FLEET" : "PERSONAL";
    } else if (typeParam && typeParam !== "all") {
      where.vehicle_type = typeParam.toUpperCase();
    }

    // Status Filter
    if (status && status !== "all") {
      where.status = status;
    }

    // Required Certification Filter
    if (cert && cert !== "all") {
      where.required_certification = cert;
    }

    // Owner ID Filter
    if (ownerIdParam) {
      where.owner_id = parseInt(ownerIdParam, 10);
    }

    // Operational Hours Range Filter
    if (hoursMin !== null || hoursMax !== null) {
      const hoursFilter: Prisma.FloatNullableFilter = {};
      if (hoursMin !== null) hoursFilter.gte = parseFloat(hoursMin);
      if (hoursMax !== null) hoursFilter.lte = parseFloat(hoursMax);
      where.operational_hours = hoursFilter;
    }

    // Roadworthy Status Filter
    const now = new Date();
    if (roadworthyStatus === "expired") {
      where.roadworthy_expiry = { lt: now };
    } else if (roadworthyStatus === "valid") {
      where.roadworthy_expiry = { gte: now };
    } else if (roadworthyStatus === "expiring_soon") {
      const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      where.roadworthy_expiry = { gte: now, lte: soon };
    }

    // License Disc Status Filter
    if (discStatus === "expired") {
      where.license_disc_expiry = { lt: now };
    } else if (discStatus === "valid") {
      where.license_disc_expiry = { gte: now };
    } else if (discStatus === "expiring_soon") {
      const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      where.license_disc_expiry = { gte: now, lte: soon };
    }

    // Free Text Search Filter
    if (search) {
      where.OR = [
        { fleet_id: { contains: search } },
        { license_plate: { contains: search } },
        { make: { contains: search } },
        { model: { contains: search } },
        { qr_code: { contains: search } },
        { rfid_tag: { contains: search } },
      ];
    }

    // Execute queries
    const [total, rawVehicles] = await Promise.all([
      prisma.vehicles.count({ where }),
      prisma.vehicles.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: limit,
        skip: offset,
        include: { owner: true },
      }),
    ]);

    const formattedVehicles = rawVehicles.map((v) =>
      formatVehicle(v as unknown as Record<string, unknown>)
    );

    if (format === "array") {
      return NextResponse.json(formattedVehicles);
    }

    const heavyCount = formattedVehicles.filter((v) => v.is_heavy_fleet).length;
    const personalCount = formattedVehicles.length - heavyCount;
    const roadworthyExpiredCount = formattedVehicles.filter(
      (v) => !v.compliance_status.roadworthy_valid
    ).length;
    const discExpiredCount = formattedVehicles.filter(
      (v) => !v.compliance_status.license_disc_valid
    ).length;

    return NextResponse.json({
      success: true,
      total,
      count: formattedVehicles.length,
      limit,
      offset,
      summary: {
        heavy_fleet_count: heavyCount,
        personal_vehicle_count: personalCount,
        roadworthy_expired_count: roadworthyExpiredCount,
        disc_expired_count: discExpiredCount,
      },
      vehicles: formattedVehicles,
    });
  } catch (error) {
    console.error("Fleet GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch fleet vehicles", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fleet
 * Create a new heavy fleet machinery or personal vehicle record
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Check if Mass Generator or Import Payload was sent to /api/fleet
    if (
      body.generate_count !== undefined ||
      body.csvText !== undefined ||
      Array.isArray(body.vehicles) ||
      body.action === "import" ||
      body.action === "generate"
    ) {
      const importResult = await importFleet(body);
      if (!importResult.success && importResult.summary.total_processed === 0) {
        return NextResponse.json(importResult, { status: 400 });
      }
      return NextResponse.json(importResult, { status: 200 });
    }

    const fleetId = (body.fleet_id || body.machine_id)?.trim();
    if (!fleetId || fleetId.length < 2) {
      return NextResponse.json(
        { error: "Field 'fleet_id' is required (minimum 2 characters)", field: "fleet_id" },
        { status: 400 }
      );
    }

    // Check unique fleet_id
    const existing = await prisma.vehicles.findUnique({
      where: { fleet_id: fleetId },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Vehicle with fleet_id '${fleetId}' already exists`, field: "fleet_id" },
        { status: 409 }
      );
    }

    // Check unique qr_code & rfid_tag
    const qrCode = body.qr_code?.trim() || null;
    if (qrCode) {
      const qrConflict = await prisma.vehicles.findUnique({ where: { qr_code: qrCode } });
      if (qrConflict) {
        return NextResponse.json(
          { error: `QR code '${qrCode}' is already assigned to vehicle ${qrConflict.fleet_id}`, field: "qr_code" },
          { status: 409 }
        );
      }
    }

    const rfidTag = body.rfid_tag?.trim() || null;
    if (rfidTag) {
      const rfidConflict = await prisma.vehicles.findUnique({ where: { rfid_tag: rfidTag } });
      if (rfidConflict) {
        return NextResponse.json(
          { error: `RFID tag '${rfidTag}' is already assigned to vehicle ${rfidConflict.fleet_id}`, field: "rfid_tag" },
          { status: 409 }
        );
      }
    }

    // Determine vehicle type
    let vehicleType = "HEAVY_FLEET";
    if (body.vehicle_type) {
      vehicleType = body.vehicle_type.toUpperCase();
    } else if (body.is_heavy_fleet === false) {
      vehicleType = "PERSONAL";
    }

    const isHeavyFleet = vehicleType === "HEAVY_FLEET";

    // Validate personal vehicle owner if provided
    let ownerId: number | null = null;
    if (body.owner_id) {
      ownerId = parseInt(String(body.owner_id), 10);
      const ownerExists = await prisma.employees.findUnique({ where: { id: ownerId } });
      if (!ownerExists) {
        return NextResponse.json(
          { error: `Owner employee with ID ${ownerId} does not exist`, field: "owner_id" },
          { status: 400 }
        );
      }
    }

    // Validate operational hours
    const operationalHours = body.operational_hours !== undefined ? parseFloat(body.operational_hours) : 0.0;
    if (isNaN(operationalHours) || operationalHours < 0) {
      return NextResponse.json(
        { error: "Field 'operational_hours' must be a non-negative number", field: "operational_hours" },
        { status: 400 }
      );
    }

    const created = await prisma.vehicles.create({
      data: {
        fleet_id: fleetId,
        machine_id: body.machine_id?.trim() || (isHeavyFleet ? fleetId : null),
        vehicle_type: vehicleType,
        is_heavy_fleet: isHeavyFleet,
        make: body.make?.trim() || null,
        model: body.model?.trim() || null,
        license_plate: body.license_plate?.trim() || null,
        status: body.status?.trim() || "Active",
        operational_hours: operationalHours,
        required_certification: body.required_certification?.trim() || null,
        license_disc_expiry: parseDate(body.license_disc_expiry),
        roadworthy_expiry: parseDate(body.roadworthy_expiry),
        registration_expiry: parseDate(body.registration_expiry),
        owner_id: ownerId,
        qr_code: qrCode,
        rfid_tag: rfidTag,
      },
      include: { owner: true },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Vehicle registered successfully",
        vehicle: formatVehicle(created as unknown as Record<string, unknown>),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Fleet POST error:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "A unique constraint violation occurred on vehicle registration" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create vehicle", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * PUT / PATCH /api/fleet
 * Update existing vehicle, increment operational hours, or update credentials
 */
export async function PUT(req: Request) {
  try {
    const url = new URL(req.url);
    const body = await req.json();

    const targetId = parseInt(url.searchParams.get("id") || String(body.id || ""), 10);
    const targetFleetId = url.searchParams.get("fleet_id") || body.fleet_id;

    if (!targetId && !targetFleetId) {
      return NextResponse.json(
        { error: "A vehicle 'id' or 'fleet_id' is required for update" },
        { status: 400 }
      );
    }

    const existing = await prisma.vehicles.findFirst({
      where: targetId ? { id: targetId } : { fleet_id: targetFleetId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    const updateData: Prisma.vehiclesUpdateInput = {};

    if (body.status !== undefined) updateData.status = body.status;
    if (body.make !== undefined) updateData.make = body.make?.trim() || null;
    if (body.model !== undefined) updateData.model = body.model?.trim() || null;
    if (body.license_plate !== undefined) updateData.license_plate = body.license_plate?.trim() || null;
    if (body.required_certification !== undefined)
      updateData.required_certification = body.required_certification?.trim() || null;
    if (body.vehicle_type !== undefined) {
      const vt = body.vehicle_type.toUpperCase();
      updateData.vehicle_type = vt;
      updateData.is_heavy_fleet = vt === "HEAVY_FLEET";
    }

    // Operational hours updates: either absolute or incremental
    if (body.hours_increment !== undefined) {
      const inc = parseFloat(body.hours_increment);
      if (isNaN(inc) || inc < 0) {
        return NextResponse.json({ error: "hours_increment must be a positive number" }, { status: 400 });
      }
      const currentHours = existing.operational_hours || 0;
      updateData.operational_hours = currentHours + inc;
    } else if (body.operational_hours !== undefined) {
      const hours = parseFloat(body.operational_hours);
      if (isNaN(hours) || hours < 0) {
        return NextResponse.json({ error: "operational_hours must be a non-negative number" }, { status: 400 });
      }
      updateData.operational_hours = hours;
    }

    if (body.license_disc_expiry !== undefined)
      updateData.license_disc_expiry = parseDate(body.license_disc_expiry);
    if (body.roadworthy_expiry !== undefined)
      updateData.roadworthy_expiry = parseDate(body.roadworthy_expiry);
    if (body.registration_expiry !== undefined)
      updateData.registration_expiry = parseDate(body.registration_expiry);

    if (body.owner_id !== undefined) {
      if (body.owner_id === null) {
        updateData.owner = { disconnect: true };
      } else {
        const ownerId = parseInt(String(body.owner_id), 10);
        const ownerExists = await prisma.employees.findUnique({ where: { id: ownerId } });
        if (!ownerExists) {
          return NextResponse.json({ error: `Owner employee ${ownerId} not found` }, { status: 400 });
        }
        updateData.owner = { connect: { id: ownerId } };
      }
    }

    // QR and RFID updates with conflict checks
    if (body.qr_code !== undefined) {
      const qr = body.qr_code?.trim() || null;
      if (qr && qr !== existing.qr_code) {
        const conflict = await prisma.vehicles.findUnique({ where: { qr_code: qr } });
        if (conflict && conflict.id !== existing.id) {
          return NextResponse.json({ error: `QR code '${qr}' already in use`, field: "qr_code" }, { status: 409 });
        }
      }
      updateData.qr_code = qr;
    }

    if (body.rfid_tag !== undefined) {
      const rfid = body.rfid_tag?.trim() || null;
      if (rfid && rfid !== existing.rfid_tag) {
        const conflict = await prisma.vehicles.findUnique({ where: { rfid_tag: rfid } });
        if (conflict && conflict.id !== existing.id) {
          return NextResponse.json({ error: `RFID tag '${rfid}' already in use`, field: "rfid_tag" }, { status: 409 });
        }
      }
      updateData.rfid_tag = rfid;
    }

    const updated = await prisma.vehicles.update({
      where: { id: existing.id },
      data: updateData,
      include: { owner: true },
    });

    return NextResponse.json({
      success: true,
      message: "Vehicle updated successfully",
      vehicle: formatVehicle(updated as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error("Fleet PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update vehicle", details: String(error) },
      { status: 500 }
    );
  }
}

export const PATCH = PUT;

/**
 * DELETE /api/fleet
 * Decommission (soft delete) or remove (hard delete) vehicle
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const idParam = url.searchParams.get("id");
    const fleetIdParam = url.searchParams.get("fleet_id");
    const mode = url.searchParams.get("mode") || "soft";

    if (!idParam && !fleetIdParam) {
      return NextResponse.json(
        { error: "Parameter 'id' or 'fleet_id' is required for deletion" },
        { status: 400 }
      );
    }

    const existing = await prisma.vehicles.findFirst({
      where: idParam ? { id: parseInt(idParam, 10) } : { fleet_id: fleetIdParam! },
    });

    if (!existing) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    if (mode === "hard") {
      try {
        await prisma.vehicles.delete({ where: { id: existing.id } });
        return NextResponse.json({
          success: true,
          message: "Vehicle permanently deleted",
          mode: "hard",
          id: existing.id,
        });
      } catch (delError) {
        if (delError instanceof Prisma.PrismaClientKnownRequestError && delError.code === "P2003") {
          return NextResponse.json(
            {
              error: "Cannot hard-delete vehicle because related gate logs exist. Use mode=soft instead.",
              canSoftDelete: true,
            },
            { status: 409 }
          );
        }
        throw delError;
      }
    }

    // Default: Soft Delete
    const decommissioned = await prisma.vehicles.update({
      where: { id: existing.id },
      data: { status: "Decommissioned" },
      include: { owner: true },
    });

    return NextResponse.json({
      success: true,
      message: "Vehicle decommissioned successfully",
      mode: "soft",
      vehicle: formatVehicle(decommissioned as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error("Fleet DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete vehicle", details: String(error) },
      { status: 500 }
    );
  }
}

