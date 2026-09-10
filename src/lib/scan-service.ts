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

  // 1. Resolve entity using multi-identifier database lookup & universal decoding
  const matched = await resolveEntityFromDatabase(normalized);
  const decoded = await decodePendingScan(normalized, {
    details: `QR scan at ${gateLocation || "Access Portal"}`,
  });

  const resolved =
    matched ||
    (decoded.matched_record
      ? {
          type: decoded.matched_record.type as "employee" | "vehicle" | "visitor" | "equipment",
          id: decoded.matched_record.id,
          code: decoded.matched_record.code,
          name: decoded.matched_record.name,
          status: decoded.matched_record.status,
          position: null,
          department: null,
          area: null,
          rfid_tag: null,
          qr_code: null,
        }
      : null);

  const entityType = resolved?.type || decoded.entity_type || "unknown";
  const entityId: number | null = resolved?.id || null;
  const entityName = resolved?.name || decoded.name || "Unknown";
  let accessGranted = false;
  let denialReason: string | null = null;

  if (isLockdown) {
    accessGranted = false;
    denialReason = "PERIMETER LOCKDOWN IN EFFECT";
  } else if (resolved) {
    // Registered entity status checks
    if (resolved.status === "Active" || resolved.status === "Checked In") {
      accessGranted = true;
      denialReason = null;
    } else {
      accessGranted = false;
      denialReason = `Credential status: ${resolved.status} - Verification required`;
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

  // 3. Temporal & Rich Day / Shift Metadata
  const now = new Date();
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dayOfWeek = dayNames[now.getDay()];
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toLocaleTimeString();
  const currentHour = now.getHours();
  const shiftName = currentHour >= 6 && currentHour < 18 ? "Day Shift" : "Night Shift";

  const enrichedPayload = {
    ...decoded,
    day_of_week: dayOfWeek,
    date: dateStr,
    time: timeStr,
    shift: shiftName,
    scanned_at_iso: now.toISOString(),
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    scanned_by: scannedBy || "Gate Terminal",
    gate_location: gateLocation,
    direction,
    access_granted: accessGranted,
  };

  // 4. Record Gate Log with explicit entity foreign keys & temporal details
  const createdLog = await prisma.gate_logs.create({
    data: {
      access_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      direction: direction,
      qr_data: normalized,
      access_granted: accessGranted,
      denial_reason: denialReason,
      gate_location: gateLocation,
      scanned_at: now,
      scanned_by: scannedBy,
      ip_address: ipAddress,
      user_agent: userAgent,
      parsed_qr_data: JSON.stringify(enrichedPayload),
      employee_id: entityType === "employee" ? entityId : null,
      vehicle_id: entityType === "vehicle" ? entityId : null,
      visitor_id: entityType === "visitor" ? entityId : null,
      equipment_id: entityType === "equipment" ? entityId : null,
    },
  });

  return {
    logId: createdLog.id,
    accessGranted,
    denialReason,
    entityType,
    entityId,
    entityName,
    direction,
    dayOfWeek,
    date: dateStr,
    shift: shiftName,
    scannedAt: now.toISOString(),
    decoded: enrichedPayload,
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

  // 1. Resolve entity using multi-identifier database lookup & universal decoding
  const matched = await resolveEntityFromDatabase(rfidTag);
  const decoded = await decodePendingScan(rfidTag, {
    details: `RFID scan at ${gateLocation || "Access Portal"}`,
  });

  const resolved =
    matched ||
    (decoded.matched_record
      ? {
          type: decoded.matched_record.type as "employee" | "vehicle" | "visitor" | "equipment",
          id: decoded.matched_record.id,
          code: decoded.matched_record.code,
          name: decoded.matched_record.name,
          status: decoded.matched_record.status,
          position: null,
          department: null,
          area: null,
          rfid_tag: null,
          qr_code: null,
        }
      : null);

  const entityType = resolved?.type || decoded.entity_type || "unknown";
  const entityId: number | null = resolved?.id || null;
  const entityName = resolved?.name || decoded.name || "Unknown";
  let accessGranted = false;
  let denialReason: string | null = null;

  if (isLockdown) {
    accessGranted = false;
    denialReason = "PERIMETER LOCKDOWN IN EFFECT";
  } else if (resolved) {
    if (resolved.status === "Active" || resolved.status === "Checked In") {
      accessGranted = true;
      denialReason = null;
    } else {
      accessGranted = false;
      denialReason = `Credential status: ${resolved.status} - Verification required`;
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

  // 3. Temporal & Rich Day / Shift Metadata
  const now = new Date();
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dayOfWeek = dayNames[now.getDay()];
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toLocaleTimeString();
  const currentHour = now.getHours();
  const shiftName = currentHour >= 6 && currentHour < 18 ? "Day Shift" : "Night Shift";

  const enrichedPayload = {
    ...decoded,
    day_of_week: dayOfWeek,
    date: dateStr,
    time: timeStr,
    shift: shiftName,
    scanned_at_iso: now.toISOString(),
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    scanned_by: scannedBy || "Gate Terminal",
    gate_location: gateLocation,
    direction,
    access_granted: accessGranted,
  };

  // 4. Record Gate Log with explicit entity foreign keys & temporal details
  const createdLog = await prisma.gate_logs.create({
    data: {
      access_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      direction: direction,
      qr_data: tag,
      access_granted: accessGranted,
      denial_reason: denialReason,
      gate_location: gateLocation,
      scanned_at: now,
      scanned_by: scannedBy,
      ip_address: ipAddress,
      user_agent: userAgent,
      parsed_qr_data: JSON.stringify(enrichedPayload),
      employee_id: entityType === "employee" ? entityId : null,
      vehicle_id: entityType === "vehicle" ? entityId : null,
      visitor_id: entityType === "visitor" ? entityId : null,
      equipment_id: entityType === "equipment" ? entityId : null,
    },
  });

  return {
    logId: createdLog.id,
    accessGranted,
    denialReason,
    entityType,
    entityId,
    entityName,
    direction,
    dayOfWeek,
    date: dateStr,
    shift: shiftName,
    scannedAt: now.toISOString(),
    decoded: enrichedPayload,
  };
}
