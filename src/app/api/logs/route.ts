import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const entityType = url.searchParams.get("entityType"); // "employee" | "vehicle" | "visitor" | "equipment" | "denied"
    const entityId = url.searchParams.get("entityId");
    const employeeId = url.searchParams.get("employeeId");
    const vehicleId = url.searchParams.get("vehicleId");
    const visitorId = url.searchParams.get("visitorId");
    const equipmentId = url.searchParams.get("equipmentId");
    const search = url.searchParams.get("search")?.trim();
    const dateParam = url.searchParams.get("date"); // "2026-09-10" or "today" or "yesterday"
    const shift = url.searchParams.get("shift"); // "Day Shift" | "Night Shift"
    const status = url.searchParams.get("status"); // "granted" | "denied"
    const gateLocation = url.searchParams.get("gate");
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "100", 10), 1), 500);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);

    const where: Prisma.gate_logsWhereInput = {};

    // 1. Filter by specific foreign key IDs
    if (employeeId) {
      where.employee_id = parseInt(employeeId, 10);
    } else if (vehicleId) {
      where.vehicle_id = parseInt(vehicleId, 10);
    } else if (visitorId) {
      where.visitor_id = parseInt(visitorId, 10);
    } else if (equipmentId) {
      where.equipment_id = parseInt(equipmentId, 10);
    } else if (entityId && entityType) {
      if (entityType === "employee") where.employee_id = parseInt(entityId, 10);
      else if (entityType === "vehicle") where.vehicle_id = parseInt(entityId, 10);
      else if (entityType === "visitor") where.visitor_id = parseInt(entityId, 10);
      else if (entityType === "equipment") where.equipment_id = parseInt(entityId, 10);
    }

    // 2. Filter by Entity Type
    if (entityType && entityType !== "all") {
      if (entityType === "denied") {
        where.access_granted = false;
      } else {
        where.access_type = entityType;
      }
    }

    // 3. Filter by Access Status
    if (status === "granted") {
      where.access_granted = true;
    } else if (status === "denied") {
      where.access_granted = false;
    }

    // 4. Filter by Gate Location
    if (gateLocation && gateLocation !== "all") {
      where.gate_location = { contains: gateLocation };
    }

    // 5. Filter by Day / Date
    if (dateParam && dateParam !== "all") {
      let targetDateStr = dateParam;
      const today = new Date();
      if (dateParam === "today") {
        targetDateStr = today.toISOString().split("T")[0];
      } else if (dateParam === "yesterday") {
        const yest = new Date(today);
        yest.setDate(yest.getDate() - 1);
        targetDateStr = yest.toISOString().split("T")[0];
      }

      const startOfDay = new Date(`${targetDateStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${targetDateStr}T23:59:59.999Z`);
      where.scanned_at = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    // 6. Free text search across entity name, code, tag, gate, and reason
    if (search) {
      where.OR = [
        { entity_name: { contains: search } },
        { qr_data: { contains: search } },
        { gate_location: { contains: search } },
        { denial_reason: { contains: search } },
        { scanned_by: { contains: search } },
        { employee: { emp_code: { contains: search } } },
        { vehicle: { fleet_id: { contains: search } } },
        { visitor: { name: { contains: search } } },
        { equipment: { radio_id: { contains: search } } },
      ];
    }

    // 7. Filter by Shift (if requested)
    if (shift && shift !== "all") {
      where.parsed_qr_data = { contains: shift };
    }

    const [total, logs] = await Promise.all([
      prisma.gate_logs.count({ where }),
      prisma.gate_logs.findMany({
        where,
        include: {
          employee: true,
          vehicle: true,
          visitor: true,
          equipment: true,
        },
        orderBy: { id: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);

    // Format logs with clean day and metadata extraction
    const formattedLogs = logs.map((log) => {
      let meta: Record<string, unknown> = {};
      try {
        if (log.parsed_qr_data) {
          meta = JSON.parse(log.parsed_qr_data);
        }
      } catch {
        // ignore parse error
      }

      const scannedDate = log.scanned_at ? new Date(log.scanned_at) : new Date();
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayOfWeek = (meta.day_of_week as string) || dayNames[scannedDate.getDay()];
      const dateString = (meta.date as string) || scannedDate.toISOString().split("T")[0];
      const timeString = (meta.time as string) || scannedDate.toLocaleTimeString();
      const shiftName =
        (meta.shift as string) ||
        (scannedDate.getHours() >= 6 && scannedDate.getHours() < 18 ? "Day Shift" : "Night Shift");

      return {
        id: log.id,
        access_type: log.access_type || "unknown",
        entity_id: log.entity_id,
        entity_name:
          log.employee
            ? `${log.employee.first_name} ${log.employee.surname}`
            : log.vehicle
            ? `Vehicle ${log.vehicle.fleet_id}`
            : log.visitor
            ? log.visitor.name
            : log.equipment
            ? `Radio ${log.equipment.radio_id}`
            : log.entity_name || "Unknown Entity",
        direction: log.direction || "IN",
        access_granted: log.access_granted,
        denial_reason: log.denial_reason,
        gate_location: log.gate_location || "Central Gate",
        scanned_by: log.scanned_by || "System",
        scanned_at: log.scanned_at,
        day_of_week: dayOfWeek,
        date: dateString,
        time: timeString,
        shift: shiftName,
        qr_data: log.qr_data,
        employee: log.employee
          ? {
              id: log.employee.id,
              emp_code: log.employee.emp_code,
              name: `${log.employee.first_name} ${log.employee.surname}`,
              job_title: log.employee.job_title,
              area: log.employee.area,
              status: log.employee.status,
              photo: log.employee.photo,
            }
          : null,
        vehicle: log.vehicle
          ? {
              id: log.vehicle.id,
              fleet_id: log.vehicle.fleet_id,
              status: log.vehicle.status,
            }
          : null,
        visitor: log.visitor
          ? {
              id: log.visitor.id,
              name: log.visitor.name,
              company: log.visitor.company,
              purpose: log.visitor.purpose,
            }
          : null,
        equipment: log.equipment
          ? {
              id: log.equipment.id,
              radio_id: log.equipment.radio_id,
            }
          : null,
        raw_meta: meta,
      };
    });

    return NextResponse.json({
      success: true,
      total,
      count: formattedLogs.length,
      limit,
      offset,
      logs: formattedLogs,
    });
  } catch (error) {
    console.error("Logs API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch access logs", details: String(error) },
      { status: 500 }
    );
  }
}
