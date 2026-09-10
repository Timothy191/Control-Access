import prisma from "@/lib/prisma";
import { resolveEntityFromDatabase, decodePendingScan } from "./scan-decoder";

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

  // Check system lockdown setting
  const lockdownSetting = await prisma.site_settings.findUnique({
    where: { key: "system_lockdown" },
  });
  const isLockdown = lockdownSetting?.value === "true";

  // 1. Resolve entity using multi-identifier database lookup
  const matched = await resolveEntityFromDatabase(normalized);
  const decoded = await decodePendingScan(normalized, {
    details: `QR scan at ${gateLocation || "Access Portal"}`,
  });

  const entityType = matched?.type || decoded.entity_type || "unknown";
  const entityId: number | null = matched?.id || null;
  const entityName = matched?.name || decoded.name || "Unknown";
  let accessGranted = false;
  let denialReason: string | null = null;

  if (isLockdown) {
    accessGranted = false;
    denialReason = "PERIMETER LOCKDOWN IN EFFECT";
  } else if (matched) {
    // Registered entity status checks
    if (matched.status === "Active") {
      accessGranted = true;
      denialReason = null;
    } else {
      accessGranted = false;
      denialReason = `Credential status: ${matched.status} - Verification required`;
    }
  } else {
    // Unregistered / Pending scan
    accessGranted = false;
    denialReason = "Pending supervisor approval - Credential verification required";

    // Auto-create pending approval request for supervisor review
    try {
      const existingPending = await prisma.approvals.findFirst({
        where: {
          scanned_data: { contains: normalized },
          status: "Pending",
        },
      });

      if (!existingPending) {
        await prisma.approvals.create({
          data: {
            request_type: "New QR Access Request",
            requester_name: decoded.name || "Unassigned Entity",
            details: `QR scan at ${gateLocation || "Access Portal"} (ID: ${decoded.employee_id || normalized})`,
            status: "Pending",
            target_table: decoded.entity_type === "vehicle" ? "fleet" : "employees",
            scanned_data: JSON.stringify(decoded),
          },
        });
      }
    } catch (e) {
      console.error("Failed to auto-create pending approval:", e);
    }
  }

  // 2. Auto-Direction determination
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

  // 3. Record Gate Log with full decoded JSON
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
      parsed_qr_data: JSON.stringify(decoded),
      employee_id: entityType === "employee" ? entityId : null,
      vehicle_id: entityType === "vehicle" ? entityId : null,
      visitor_id: entityType === "visitor" ? entityId : null,
      equipment_id: entityType === "equipment" ? entityId : null,
    },
  });

  return {
    accessGranted,
    denialReason,
    entityType,
    entityId,
    entityName,
    direction,
    decoded,
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

  // Check system lockdown setting
  const lockdownSetting = await prisma.site_settings.findUnique({
    where: { key: "system_lockdown" },
  });
  const isLockdown = lockdownSetting?.value === "true";

  // Normalize RFID
  let tag = rfidTag.trim().toUpperCase().replace(/[:\-\s\.]/g, "");
  ["EPC:", "UID:", "TAG:", "RFID:", "[", "]"].forEach((p) => {
    tag = tag.replace(p, "");
  });

  // 1. Resolve entity using multi-identifier database lookup
  const matched = await resolveEntityFromDatabase(rfidTag);
  const decoded = await decodePendingScan(rfidTag, {
    details: `RFID scan at ${gateLocation || "Access Portal"}`,
  });

  const entityType = matched?.type || decoded.entity_type || "unknown";
  const entityId: number | null = matched?.id || null;
  const entityName = matched?.name || decoded.name || "Unknown";
  let accessGranted = false;
  let denialReason: string | null = null;

  if (isLockdown) {
    accessGranted = false;
    denialReason = "PERIMETER LOCKDOWN IN EFFECT";
  } else if (matched) {
    if (matched.status === "Active") {
      accessGranted = true;
      denialReason = null;
    } else {
      accessGranted = false;
      denialReason = `Credential status: ${matched.status} - Verification required`;
    }
  } else {
    // Unregistered RFID scan -> create pending approval
    accessGranted = false;
    denialReason = "Pending supervisor approval - RFID tag not verified";

    try {
      const existingPending = await prisma.approvals.findFirst({
        where: {
          scanned_data: { contains: rfidTag },
          status: "Pending",
        },
      });

      if (!existingPending) {
        await prisma.approvals.create({
          data: {
            request_type: "New RFID Access Request",
            requester_name: decoded.name || "Unassigned RFID Credential",
            details: `RFID scan at ${gateLocation || "Access Portal"} (Tag: ${rfidTag})`,
            status: "Pending",
            target_table: decoded.entity_type === "vehicle" ? "fleet" : "employees",
            scanned_data: JSON.stringify(decoded),
          },
        });
      }
    } catch (e) {
      console.error("Failed to auto-create pending approval for RFID:", e);
    }
  }

  // 2. Auto-Direction determination
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

  // 3. Record Gate Log with full decoded JSON
  await prisma.gate_logs.create({
    data: {
      access_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      direction: direction,
      qr_data: tag,
      access_granted: accessGranted,
      denial_reason: denialReason,
      gate_location: gateLocation,
      scanned_by: scannedBy,
      ip_address: ipAddress,
      user_agent: userAgent,
      parsed_qr_data: JSON.stringify(decoded),
      employee_id: entityType === "employee" ? entityId : null,
      vehicle_id: entityType === "vehicle" ? entityId : null,
      visitor_id: entityType === "visitor" ? entityId : null,
      equipment_id: entityType === "equipment" ? entityId : null,
    },
  });

  return {
    accessGranted,
    denialReason,
    entityType,
    entityId,
    entityName,
    direction,
    decoded,
  };
}
