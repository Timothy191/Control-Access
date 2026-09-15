import prisma from "@/lib/prisma";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { parseCSVToObjects, serializeToCSV } from "./csv-parser";

export interface FleetFilterOptions {
  format?: "csv" | "json";
  typeParam?: string | null;
  isHeavyFleetParam?: string | null;
  status?: string | null;
  cert?: string | null;
  search?: string | null;
}

export interface FleetImportPayload {
  csvText?: string;
  vehicles?: Array<Record<string, unknown>>;
  generate_count?: number;
  vehicle_class?: "ALL" | "HEAVY" | "LIGHT";
  upsert?: boolean;
  compliance_profile?: "realistic" | "compliant" | "warning" | "expired";
}

const HEAVY_FLEET_PRESETS = [
  { make: "Caterpillar", model: "797F Ultra Hauler", type: "HEAVY_FLEET", cert: "HEAVY_HAUL_TIER_2", prefix: "CAT-797" },
  { make: "Komatsu", model: "PC8000-11 Excavator", type: "HEAVY_FLEET", cert: "EXCAVATOR_MASTER_TIER_3", prefix: "KOM-PC8" },
  { make: "Bell Equipment", model: "B50E Articulated Dump", type: "HEAVY_FLEET", cert: "ADT_OPERATOR_TIER_1", prefix: "BEL-B50" },
  { make: "Liebherr", model: "T 284 Mining Truck", type: "HEAVY_FLEET", cert: "HEAVY_HAUL_TIER_2", prefix: "LBH-T28" },
  { make: "Caterpillar", model: "994K Wheel Loader", type: "HEAVY_FLEET", cert: "LOADER_TIER_2", prefix: "CAT-994" },
  { make: "Sandvik", model: "DR412i Rotary Drill Rig", type: "HEAVY_FLEET", cert: "DRILL_RIG_OPERATOR", prefix: "SND-DR4" },
  { make: "Hitachi", model: "EX5600-7 Mining Shovel", type: "HEAVY_FLEET", cert: "EXCAVATOR_MASTER_TIER_3", prefix: "HIT-EX5" },
  { make: "Caterpillar", model: "D11 Track Type Dozer", type: "HEAVY_FLEET", cert: "BULLDOZER_TIER_2", prefix: "CAT-D11" },
];

const LIGHT_VEHICLE_PRESETS = [
  { make: "Toyota", model: "Hilux 2.8 GD-6 4x4 Mine Spec", type: "LIGHT_VEHICLE", cert: "PIT_PERMIT_LIGHT_VEHICLE", prefix: "TOY-HLX" },
  { make: "Ford", model: "Ranger 2.0 Bi-Turbo Pit Patrol", type: "LIGHT_VEHICLE", cert: "PIT_PERMIT_LIGHT_VEHICLE", prefix: "FRD-RNG" },
  { make: "Isuzu", model: "D-Max 3.0 Ddi Mine Safety", type: "LIGHT_VEHICLE", cert: "PIT_PERMIT_LIGHT_VEHICLE", prefix: "ISZ-DMX" },
  { make: "Mercedes-Benz", model: "Actros 3344 Fuel/Lube Tanker", type: "SERVICE_TRUCK", cert: "HAZMAT_TANKER_DRIVER", prefix: "MB-ACT" },
  { make: "Toyota", model: "Land Cruiser 79 Rescue Ambulance", type: "EMERGENCY", cert: "EMERGENCY_VEHICLE_PIT", prefix: "TOY-AMB" },
];

const PROVINCES = ["GP", "MP", "NW", "LP"];

function generateLicensePlate(): string {
  const letters = "BCDFGHJKLMNPQRSTVWXYZ";
  const l1 = letters[Math.floor(Math.random() * letters.length)];
  const l2 = letters[Math.floor(Math.random() * letters.length)];
  const num = Math.floor(10 + Math.random() * 89);
  const l3 = letters[Math.floor(Math.random() * letters.length)];
  const l4 = letters[Math.floor(Math.random() * letters.length)];
  const prov = PROVINCES[Math.floor(Math.random() * PROVINCES.length)];
  return `${l1}${l2} ${num} ${l3}${l4} ${prov}`;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str || str === "N/A" || str === "null") return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Export Fleet to CSV or JSON
 */
export async function exportFleet(options: FleetFilterOptions = {}) {
  const format = options.format || "csv";
  const { typeParam, isHeavyFleetParam, status, cert, search } = options;

  const where: Prisma.vehiclesWhereInput = {};

  if (isHeavyFleetParam !== null && isHeavyFleetParam !== undefined) {
    where.vehicle_type = isHeavyFleetParam === "true" ? "HEAVY_FLEET" : "PERSONAL";
  } else if (typeParam && typeParam !== "all") {
    where.vehicle_type = typeParam.toUpperCase();
  }

  if (status && status !== "all") where.status = status;
  if (cert && cert !== "all") where.required_certification = cert;

  if (search) {
    where.OR = [
      { fleet_id: { contains: search } },
      { machine_id: { contains: search } },
      { license_plate: { contains: search } },
      { make: { contains: search } },
      { model: { contains: search } },
      { qr_code: { contains: search } },
      { rfid_tag: { contains: search } },
    ];
  }

  const vehicles = await prisma.vehicles.findMany({
    where,
    orderBy: { fleet_id: "asc" },
    include: { owner: true },
  });

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];

  if (format === "json") {
    return {
      contentType: "application/json; charset=utf-8",
      filename: `mine_fleet_export_${dateStr}.json`,
      data: JSON.stringify(
        {
          success: true,
          count: vehicles.length,
          timestamp: now.toISOString(),
          vehicles,
        },
        null,
        2
      ),
      count: vehicles.length,
    };
  }

  // CSV format
  const headers = [
    "Fleet ID",
    "Machine ID",
    "Vehicle Type",
    "Is Heavy Fleet",
    "Make",
    "Model",
    "License Plate",
    "Status",
    "Operational Hours",
    "Required Certification",
    "License Disc Expiry",
    "Roadworthy Expiry",
    "Registration Expiry",
    "Owner Employee Code",
    "Owner Full Name",
    "RFID Tag",
    "QR Code",
    "Created At",
  ];

  const rows = vehicles.map((v) => {
    const discExp = v.license_disc_expiry ? v.license_disc_expiry.toISOString().split("T")[0] : "N/A";
    const rdwExp = v.roadworthy_expiry ? v.roadworthy_expiry.toISOString().split("T")[0] : "N/A";
    const regExp = v.registration_expiry ? v.registration_expiry.toISOString().split("T")[0] : "N/A";
    const ownerCode = v.owner?.emp_code || "N/A";
    const ownerName = v.owner ? `${v.owner.first_name} ${v.owner.surname}` : "Mine Fleet / Unassigned";

    return [
      v.fleet_id,
      v.machine_id || v.fleet_id,
      v.vehicle_type,
      v.is_heavy_fleet ? "YES" : "NO",
      v.make || "N/A",
      v.model || "N/A",
      v.license_plate || "N/A",
      v.status,
      v.operational_hours ?? 0,
      v.required_certification || "STANDARD_PIT_PERMIT",
      discExp,
      rdwExp,
      regExp,
      ownerCode,
      ownerName,
      v.rfid_tag || "N/A",
      v.qr_code || "N/A",
      v.created_at ? v.created_at.toISOString() : now.toISOString(),
    ];
  });

  const csvContent = serializeToCSV(headers, rows);

  return {
    contentType: "text/csv; charset=utf-8",
    filename: `mine_fleet_export_${dateStr}.csv`,
    data: csvContent,
    count: vehicles.length,
  };
}

/**
 * Import or Mass Generate Fleet Vehicles with Collision Resolution & Upsert
 */
export async function importFleet(payload: FleetImportPayload) {
  const {
    csvText,
    vehicles: providedVehicles,
    generate_count,
    vehicle_class = "ALL",
    upsert = true,
    compliance_profile = "realistic",
  } = payload;

  const itemsToProcess: Array<Record<string, unknown>> = [];

  // 1. Synthetic Mass Generation Mode
  if (typeof generate_count === "number" && generate_count > 0) {
    const count = Math.min(Math.max(generate_count, 1), 300);
    const now = new Date();

    for (let i = 0; i < count; i++) {
      let isHeavy = true;
      if (vehicle_class === "LIGHT") isHeavy = false;
      else if (vehicle_class === "HEAVY") isHeavy = true;
      else isHeavy = Math.random() > 0.35; // 65% Heavy, 35% Light

      const presetList = isHeavy ? HEAVY_FLEET_PRESETS : LIGHT_VEHICLE_PRESETS;
      const preset = presetList[Math.floor(Math.random() * presetList.length)];

      const uniqueSuffix = `${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 899)}`;
      const fleetId = `${preset.prefix}-${uniqueSuffix}`;
      const machineId = isHeavy ? `EQ-${uniqueSuffix}` : `LV-${uniqueSuffix}`;
      const licensePlate = generateLicensePlate();

      const hours = isHeavy
        ? Math.round((500 + Math.random() * 6500) * 10) / 10
        : Math.round((50 + Math.random() * 1800) * 10) / 10;

      let discDays = 180;
      let roadworthyDays = 200;

      if (compliance_profile === "compliant") {
        discDays = Math.floor(Math.random() * 250) + 60;
        roadworthyDays = Math.floor(Math.random() * 250) + 60;
      } else if (compliance_profile === "warning") {
        discDays = Math.floor(Math.random() * 25) + 1; // <= 30d
        roadworthyDays = Math.floor(Math.random() * 25) + 1;
      } else if (compliance_profile === "expired") {
        discDays = -Math.floor(Math.random() * 40) - 1;
        roadworthyDays = -Math.floor(Math.random() * 40) - 1;
      } else {
        // "realistic" mix: 88% valid, 6% warning, 6% expired
        const r = Math.random();
        if (r < 0.06) {
          discDays = -Math.floor(Math.random() * 40) - 1;
          roadworthyDays = -Math.floor(Math.random() * 40) - 1;
        } else if (r < 0.12) {
          discDays = Math.floor(Math.random() * 25) + 1;
          roadworthyDays = Math.floor(Math.random() * 25) + 1;
        } else {
          discDays = Math.floor(Math.random() * 300) + 45;
          roadworthyDays = Math.floor(Math.random() * 300) + 45;
        }
      }

      const discExpiry = new Date(now.getTime() + discDays * 24 * 60 * 60 * 1000);
      const roadworthyExpiry = new Date(now.getTime() + roadworthyDays * 24 * 60 * 60 * 1000);

      const rfidTag = `RFID-FLT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const qrCode = `QR-FLT-${fleetId}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

      itemsToProcess.push({
        fleet_id: fleetId,
        machine_id: machineId,
        vehicle_type: preset.type,
        is_heavy_fleet: isHeavy,
        make: preset.make,
        model: preset.model,
        license_plate: licensePlate,
        status: Math.random() > 0.1 ? "Active" : "Maintenance",
        operational_hours: hours,
        required_certification: preset.cert,
        license_disc_expiry: discExpiry.toISOString(),
        roadworthy_expiry: roadworthyExpiry.toISOString(),
        registration_expiry: discExpiry.toISOString(),
        rfid_tag: rfidTag,
        qr_code: qrCode,
      });
    }
  }
  // 2. CSV Import Mode
  else if (csvText && typeof csvText === "string") {
    const parsedRows = parseCSVToObjects(csvText);
    parsedRows.forEach((row) => {
      const typeStr = (row["vehicle type"] || row["vehicle_type"] || row["type"] || "HEAVY_FLEET").toUpperCase();
      const isHeavy =
        String(row["is heavy fleet"] || row["is_heavy_fleet"] || row["heavy"]).toLowerCase() === "yes" ||
        String(row["is heavy fleet"] || row["is_heavy_fleet"] || row["heavy"]).toLowerCase() === "true" ||
        typeStr.includes("HEAVY");

      itemsToProcess.push({
        fleet_id: row["fleet id"] || row["fleet_id"] || row["id"] || row["unit_id"] || row["vehicle_id"],
        machine_id: row["machine id"] || row["machine_id"] || null,
        vehicle_type: typeStr,
        is_heavy_fleet: isHeavy,
        make: row["make"] || row["manufacturer"] || null,
        model: row["model"] || null,
        license_plate: row["license plate"] || row["license_plate"] || row["plate"] || row["registration"] || null,
        status: row["status"] || "Active",
        operational_hours: parseFloat(row["operational hours"] || row["operational_hours"] || row["hours"] || "0") || 0,
        required_certification: row["required certification"] || row["required_certification"] || row["cert"] || null,
        license_disc_expiry: row["license disc expiry"] || row["license_disc_expiry"] || row["disc_expiry"] || null,
        roadworthy_expiry: row["roadworthy expiry"] || row["roadworthy_expiry"] || row["roadworthy"] || null,
        registration_expiry: row["registration expiry"] || row["registration_expiry"] || null,
        rfid_tag: row["rfid tag"] || row["rfid_tag"] || row["rfid"] || null,
        qr_code: row["qr code"] || row["qr_code"] || row["qr"] || null,
      });
    });
  }
  // 3. Array of objects
  else if (Array.isArray(providedVehicles)) {
    itemsToProcess.push(...providedVehicles);
  }

  if (itemsToProcess.length === 0) {
    return {
      success: false,
      error: "No vehicle records provided. Send 'csvText', 'vehicles' array, or 'generate_count'.",
      summary: { total_processed: 0, created: 0, updated: 0, skipped: 0, errors_count: 1 },
      errors: ["No valid fleet records received"],
    };
  }

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < itemsToProcess.length; i++) {
    const item = itemsToProcess[i];
    const fleetId = String(item.fleet_id || "").trim();

    if (!fleetId) {
      errors.push(`Row ${i + 1}: Missing fleet identifier (fleet_id)`);
      skippedCount++;
      continue;
    }

    const vehicleType = String(item.vehicle_type || "HEAVY_FLEET").toUpperCase();
    const isHeavy = Boolean(item.is_heavy_fleet ?? vehicleType === "HEAVY_FLEET");
    const hours =
      typeof item.operational_hours === "number"
        ? item.operational_hours
        : parseFloat(String(item.operational_hours || "0")) || 0;

    const discExpiry = parseDate(item.license_disc_expiry);
    const roadworthyExpiry = parseDate(item.roadworthy_expiry);
    const regExpiry = parseDate(item.registration_expiry);

    const rfidTag = item.rfid_tag
      ? String(item.rfid_tag).trim()
      : `RFID-${fleetId}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    const qrCode = item.qr_code
      ? String(item.qr_code).trim()
      : `QR-${fleetId}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

    try {
      const existing = await prisma.vehicles.findFirst({
        where: { fleet_id: fleetId },
      });

      if (existing) {
        if (!upsert) {
          skippedCount++;
          continue;
        }

        // Check if updating RFID/QR collides with a DIFFERENT vehicle
        let safeRfid = rfidTag;
        if (safeRfid !== existing.rfid_tag) {
          const rfidConflict = await prisma.vehicles.findUnique({ where: { rfid_tag: safeRfid } });
          if (rfidConflict && rfidConflict.id !== existing.id) {
            safeRfid = existing.rfid_tag || `RFID-${fleetId}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
          }
        }

        let safeQr = qrCode;
        if (safeQr !== existing.qr_code) {
          const qrConflict = await prisma.vehicles.findUnique({ where: { qr_code: safeQr } });
          if (qrConflict && qrConflict.id !== existing.id) {
            safeQr = existing.qr_code || `QR-${fleetId}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
          }
        }

        await prisma.vehicles.update({
          where: { id: existing.id },
          data: {
            machine_id: item.machine_id ? String(item.machine_id).trim() : existing.machine_id,
            vehicle_type: vehicleType,
            is_heavy_fleet: isHeavy,
            make: item.make ? String(item.make).trim() : existing.make,
            model: item.model ? String(item.model).trim() : existing.model,
            license_plate: item.license_plate ? String(item.license_plate).trim() : existing.license_plate,
            status: item.status ? String(item.status).trim() : existing.status,
            operational_hours: hours,
            required_certification: item.required_certification
              ? String(item.required_certification).trim()
              : existing.required_certification,
            license_disc_expiry: discExpiry || existing.license_disc_expiry,
            roadworthy_expiry: roadworthyExpiry || existing.roadworthy_expiry,
            registration_expiry: regExpiry || existing.registration_expiry,
            rfid_tag: safeRfid,
            qr_code: safeQr,
          },
        });
        updatedCount++;
      } else {
        // Safe check for unique constraints on create
        let safeRfid = rfidTag;
        const rfidConflict = await prisma.vehicles.findUnique({ where: { rfid_tag: safeRfid } });
        if (rfidConflict) {
          safeRfid = `RFID-${fleetId}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
        }

        let safeQr = qrCode;
        const qrConflict = await prisma.vehicles.findUnique({ where: { qr_code: safeQr } });
        if (qrConflict) {
          safeQr = `QR-${fleetId}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
        }

        let safeMachineId = item.machine_id ? String(item.machine_id).trim() : isHeavy ? fleetId : null;
        if (safeMachineId) {
          const machineConflict = await prisma.vehicles.findUnique({ where: { machine_id: safeMachineId } });
          if (machineConflict) {
            safeMachineId = `${safeMachineId}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
          }
        }

        await prisma.vehicles.create({
          data: {
            fleet_id: fleetId,
            machine_id: safeMachineId,
            vehicle_type: vehicleType,
            is_heavy_fleet: isHeavy,
            make: item.make ? String(item.make).trim() : null,
            model: item.model ? String(item.model).trim() : null,
            license_plate: item.license_plate ? String(item.license_plate).trim() : null,
            status: item.status ? String(item.status).trim() : "Active",
            operational_hours: hours,
            required_certification: item.required_certification
              ? String(item.required_certification).trim()
              : null,
            license_disc_expiry: discExpiry,
            roadworthy_expiry: roadworthyExpiry,
            registration_expiry: regExpiry,
            rfid_tag: safeRfid,
            qr_code: safeQr,
          },
        });
        createdCount++;
      }
    } catch (rowErr) {
      const msg = rowErr instanceof Error ? rowErr.message : String(rowErr);
      errors.push(`Row ${i + 1} (${fleetId}): ${msg}`);
      skippedCount++;
    }
  }

  return {
    success: true,
    summary: {
      total_processed: itemsToProcess.length,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors_count: errors.length,
    },
    errors: errors.slice(0, 15),
  };
}
