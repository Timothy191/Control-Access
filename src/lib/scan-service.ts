import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeQrHash(qrHash: string | null): string | null {
  if (!qrHash) return null;
  qrHash = qrHash.trim();

  if (qrHash.includes("://") && qrHash.includes("/scan/")) {
    qrHash = qrHash.split("/scan/").pop()?.split("?")[0] || qrHash;
  } else if (qrHash.includes("://") && qrHash.includes("/s/")) {
    qrHash = qrHash.split("/s/").pop()?.split("?")[0] || qrHash;
  } else if (qrHash.startsWith("/scan/")) {
    qrHash = qrHash.replace("/scan/", "");
  } else if (qrHash.startsWith("/s/")) {
    qrHash = qrHash.replace("/s/", "");
  }

  return qrHash;
}

export async function processQrScan({
  qrHash,
  gateLocation,
  scannedBy,
  ipAddress,
  userAgent,
}: {
  qrHash: string;
  gateLocation?: string;
  scannedBy?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const normalized = normalizeQrHash(qrHash);
  if (!normalized) return { accessGranted: false, denialReason: "Empty QR" };

  // 1. Look up Employee by QR code
  let entityType = "unknown";
  let entityId: number | null = null;
  let entityName = "Unknown";
  let accessGranted = false;
  let denialReason: string | null = null;

  let employee = await prisma.employees.findFirst({
    where: { qr_code: normalized },
  });

  if (employee) {
    entityType = "employee";
    entityId = employee.id;
    entityName = `${employee.first_name} ${employee.surname}`;
  }

  // Handle vehicle, visitor, equipment fallbacks...
  // For the sake of the port, let's assume it's just employees for now to simplify, or add simple checks:
  if (!entityId) {
    const vehicle = await prisma.vehicles.findFirst({ where: { qr_code: normalized } });
    if (vehicle) {
      entityType = "vehicle";
      entityId = vehicle.id;
      entityName = vehicle.fleet_id || "Unknown Vehicle";
    }
  }

  if (!entityId) {
    // If not found, deny access
    denialReason = "Not registered in system";
  }

  // 2. Auto-Direction
  let direction = "IN";
  if (entityId && entityType) {
    const lastLog = await prisma.gate_logs.findFirst({
      where: {
        entity_id: entityId,
        access_type: entityType,
        access_granted: true,
      },
      orderBy: { scanned_at: "desc" },
    });
    if (lastLog && lastLog.direction === "IN") {
      direction = "OUT";
    }
  }

  // 3. Expiry and Status Checks
  if (entityType === "employee" && employee) {
    const now = new Date();
    if (employee.medical_expiry && new Date(employee.medical_expiry) < now) {
      accessGranted = false;
      denialReason = "Medical certificate expired";
    } else if (employee.induction_expiry && new Date(employee.induction_expiry) < now) {
      accessGranted = false;
      denialReason = "Induction expired";
    } else if (employee.status === "Active") {
      accessGranted = true;
      denialReason = null;
    } else {
      accessGranted = false;
      denialReason = "Employee not active";
    }
  }

  // 4. Record Gate Log
  await prisma.gate_logs.create({
    data: {
      access_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      direction: direction,
      qr_data: normalized,
      access_granted: accessGranted,
      denial_reason: denialReason,
      gate_location: gateLocation,
      scanned_by: scannedBy,
      ip_address: ipAddress,
      user_agent: userAgent,
    }
  });

  return {
    accessGranted,
    denialReason,
    entityType,
    entityId,
    entityName,
    direction
  };
}

export async function processRfidScan({
  rfidTag,
  gateLocation,
  scannedBy,
  ipAddress,
  userAgent,
}: {
  rfidTag: string;
  gateLocation?: string;
  scannedBy?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  if (!rfidTag) return { accessGranted: false, denialReason: "Empty RFID" };

  // Normalize RFID
  let tag = rfidTag.trim().toUpperCase().replace(/[:\-\s\.]/g, "");
  ["EPC:", "UID:", "TAG:", "RFID:", "[", "]"].forEach(p => {
    tag = tag.replace(p, "");
  });

  let entityType = "unknown";
  let entityId: number | null = null;
  let entityName = "Unknown";
  let accessGranted = false;
  let denialReason: string | null = null;

  let employee = await prisma.employees.findFirst({
    where: { rfid_tag: tag },
  });

  if (employee) {
    entityType = "employee";
    entityId = employee.id;
    entityName = `${employee.first_name} ${employee.surname}`;
    if (employee.status === "Active") {
      accessGranted = true;
    } else {
      denialReason = "Employee not active";
    }
  } else {
    denialReason = "RFID tag not registered";
  }

  // 2. Auto-Direction
  let direction = "IN";
  if (entityId && entityType) {
    const lastLog = await prisma.gate_logs.findFirst({
      where: {
        entity_id: entityId,
        access_type: entityType,
        access_granted: true,
      },
      orderBy: { scanned_at: "desc" },
    });
    if (lastLog && lastLog.direction === "IN") {
      direction = "OUT";
    }
  }

  // Record Gate Log
  await prisma.gate_logs.create({
    data: {
      access_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      direction: direction,
      qr_data: tag, // RFID stored in qr_data for compatibility
      access_granted: accessGranted,
      denial_reason: denialReason,
      gate_location: gateLocation,
      scanned_by: scannedBy,
      ip_address: ipAddress,
      user_agent: userAgent,
    }
  });

  return {
    accessGranted,
    denialReason,
    entityType,
    entityId,
    entityName,
    direction
  };
}
