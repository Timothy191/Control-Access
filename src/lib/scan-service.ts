import prisma from "@/lib/prisma";
import {
  resolveEntityFromDatabase,
  decodePendingScan,
  type ResolvedEntity,
  type ResolvedEmployeeEntity,
} from "./scan-decoder";

export function normalizeQrHash(qrHash: string | null): string | null {
  if (!qrHash) return null;
  qrHash = qrHash.trim();

  // Handle URL Query strings e.g. ?id=EMP001&name=... or /scan?id=EMP001
  if (qrHash.includes("?")) {
    try {
      const qStr = qrHash.slice(qrHash.indexOf("?") + 1);
      const params = new URLSearchParams(qStr);
      const queryId =
        params.get("id") ||
        params.get("emp_code") ||
        params.get("code") ||
        params.get("tag") ||
        params.get("employee_id");
      if (queryId) {
        return queryId.trim();
      }
    } catch {
      // Fall through to path normalization
    }
  }

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

export function isDatePast(
  dateValue: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!dateValue) return false;
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < now.getTime();
}

export interface GateComplianceResult {
  accessGranted: boolean;
  denialReason: string | null;
}

/**
 * Pure gate scan compliance evaluation engine
 */
export function evaluateGateCompliance(
  resolved: ResolvedEntity | null,
  isLockdown: boolean,
  isRfid: boolean = false,
  now: Date = new Date()
): GateComplianceResult {
  // P1: Perimeter Lockdown
  if (isLockdown) {
    return {
      accessGranted: false,
      denialReason: "PERIMETER LOCKDOWN IN EFFECT",
    };
  }

  // P2: Unregistered / Pending
  if (!resolved) {
    return {
      accessGranted: false,
      denialReason: isRfid
        ? "Pending supervisor approval - RFID tag not verified"
        : "Pending supervisor approval - Credential verification required",
    };
  }

  // P3: Credential Status
  if (resolved.status !== "Active" && resolved.status !== "Checked In") {
    return {
      accessGranted: false,
      denialReason: `Credential status: ${resolved.status} - Verification required`,
    };
  }

  // P4 - P6: Personnel Compliance (Employees & Contractors)
  if (resolved.type === "employee") {
    const emp = resolved as ResolvedEmployeeEntity;
    const isContractor = Boolean(
      emp.is_contractor ||
      (emp.contractor_company && emp.contractor_company.trim().length > 0) ||
      (emp.position && /contractor/i.test(emp.position))
    );

    // P4: Medical Fitness Expiry Check
    if (isDatePast(emp.medical_expiry, now)) {
      return {
        accessGranted: false,
        denialReason: "Access Denied: Medical Fitness Expired",
      };
    }

    // P5: Safety Induction Expiry Check
    if (isDatePast(emp.induction_expiry, now)) {
      return {
        accessGranted: false,
        denialReason: "Access Denied: Safety Induction Expired",
      };
    }

    // P6: Contractor Active Induction Check
    if (isContractor) {
      const hasInductionRecord = Boolean(
        emp.induction && emp.induction.trim().length > 0
      );
      const hasInductionExpiry = Boolean(emp.induction_expiry);

      if (!hasInductionRecord || !hasInductionExpiry) {
        return {
          accessGranted: false,
          denialReason: "Access Denied: Uninducted Contractor",
        };
      }
    }
  }

  // Compliant
  return {
    accessGranted: true,
    denialReason: null,
  };
}

export interface ScanPayload {
  // Identifier fields (at least one)
  qrHash?: string | null;
  rfidTag?: string | null;
  rawData?: string | null;
  scanType?: "QR" | "RFID" | "BARCODE";

  // Gate Context
  gateLocation?: string;
  scannedBy?: string;
  ipAddress?: string;
  userAgent?: string;

  // Telemetry (Optional for mobile/hardware scanners)
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  rssi?: number | null;
  antennaId?: string | null;
  deviceBattery?: number | null;
  readCount?: number | null;
  geofenceStatus?: string | null;
  operatorId?: string | null;
  telemetryData?: string | null;
}

export interface ScanResult {
  accessGranted: boolean;
  denialReason: string | null;
  entity: ResolvedEntity | null;
  logId: number;
  timestamp: string;

  // Extended properties for backwards-compatibility with existing routes
  entityType: string;
  entityId: number | null;
  entityName: string;
  direction: string;
  dayOfWeek: string;
  date: string;
  shift: string;
  scannedAt: string;
  decoded: Record<string, unknown>;
}

/**
 * Authoritative unified gate scan processing engine
 */
export async function processScan(scanData: ScanPayload): Promise<ScanResult> {
  const rawData = (
    scanData.rawData ||
    scanData.qrHash ||
    scanData.rfidTag ||
    ""
  ).trim();

  const isRfid =
    scanData.scanType === "RFID" ||
    Boolean(scanData.rfidTag) ||
    rawData.startsWith("RFID_") ||
    rawData.startsWith("TAG_") ||
    rawData.startsWith("EPC:") ||
    rawData.startsWith("UID:") ||
    /^[0-9A-F]{16,32}$/i.test(rawData);

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
  const shiftName =
    currentHour >= 6 && currentHour < 18 ? "Day Shift" : "Night Shift";

  if (!rawData) {
    return {
      accessGranted: false,
      denialReason: isRfid ? "Empty RFID" : "Empty QR",
      entity: null,
      logId: 0,
      timestamp: now.toISOString(),
      entityType: "unknown",
      entityId: null,
      entityName: "Unknown",
      direction: "IN",
      dayOfWeek,
      date: dateStr,
      shift: shiftName,
      scannedAt: now.toISOString(),
      decoded: {},
    };
  }

  // 1. Lockdown Check
  const lockdownSetting = await prisma.site_settings.findUnique({
    where: { key: "system_lockdown" },
  });
  const isLockdown = lockdownSetting?.value === "true";

  // 2. Tag Normalization
  let normalizedTag = rawData;
  if (isRfid) {
    let cleanTag = rawData.toUpperCase().replace(/[:\-\s\.]/g, "");
    ["EPC:", "UID:", "TAG:", "RFID:", "[", "]"].forEach((p) => {
      cleanTag = cleanTag.replace(p, "");
    });
    normalizedTag = cleanTag;
  } else {
    normalizedTag = normalizeQrHash(rawData) || rawData;
  }

  // 3. Multi-Tier Entity Resolution
  const matched =
    (await resolveEntityFromDatabase(normalizedTag)) ||
    (await resolveEntityFromDatabase(rawData));
  const decoded = await decodePendingScan(normalizedTag || rawData, {
    details: `Scan at ${scanData.gateLocation || "Access Portal"}`,
  });

  let fallbackResolved: ResolvedEntity | null = null;
  if (decoded.matched_record) {
    const mr = decoded.matched_record;
    if (mr.type === "employee") {
      fallbackResolved = {
        type: "employee",
        id: mr.id,
        code: mr.code,
        name: mr.name,
        position: decoded.position || null,
        department: decoded.department || null,
        area: decoded.area || null,
        status: mr.status,
        rfid_tag: decoded.credential_tag || null,
        qr_code: decoded.raw_data || null,
        medical: mr.medical ?? null,
        medical_expiry: mr.medical_expiry
          ? new Date(mr.medical_expiry)
          : null,
        induction: mr.induction ?? null,
        induction_expiry: mr.induction_expiry
          ? new Date(mr.induction_expiry)
          : null,
        is_contractor: mr.is_contractor ?? false,
        contractor_company: mr.contractor_company ?? null,
        access_level: mr.access_level ?? "STANDARD",
        certifications: mr.certifications ?? null,
      };
    } else if (mr.type === "vehicle") {
      fallbackResolved = {
        type: "vehicle",
        id: mr.id,
        code: mr.code,
        name: mr.name,
        position: decoded.position || null,
        department: decoded.department || null,
        area: decoded.area || null,
        status: mr.status,
        rfid_tag: decoded.credential_tag || null,
        qr_code: decoded.raw_data || null,
        medical_expiry: null,
        induction_expiry: null,
        is_contractor: false,
      };
    } else if (mr.type === "visitor") {
      fallbackResolved = {
        type: "visitor",
        id: mr.id,
        code: mr.code,
        name: mr.name,
        position: decoded.position || null,
        department: decoded.department || null,
        area: decoded.area || null,
        status: mr.status,
        rfid_tag: decoded.credential_tag || null,
        qr_code: decoded.raw_data || null,
        medical_expiry: null,
        induction_expiry: null,
        is_contractor: false,
      };
    } else if (mr.type === "equipment") {
      fallbackResolved = {
        type: "equipment",
        id: mr.id,
        code: mr.code,
        name: mr.name,
        position: decoded.position || null,
        department: decoded.department || null,
        area: decoded.area || null,
        status: mr.status,
        rfid_tag: decoded.credential_tag || null,
        qr_code: decoded.raw_data || null,
        medical_expiry: null,
        induction_expiry: null,
        is_contractor: false,
      };
    }
  }

  const resolved: ResolvedEntity | null = matched || fallbackResolved;

  const entityType = resolved?.type || decoded.entity_type || "unknown";
  const entityId: number | null = resolved?.id || null;
  const entityName = resolved?.name || decoded.name || "Unknown";

  // 4. Compliance Evaluation
  const compliance = evaluateGateCompliance(resolved, isLockdown, isRfid, now);
  const accessGranted = compliance.accessGranted;
  const denialReason = compliance.denialReason;

  // Auto-create pending approval for unassigned / unregistered entities
  if (!resolved && !isLockdown) {
    try {
      const existingPending = await prisma.approvals.findFirst({
        where: {
          scanned_data: { contains: rawData },
          status: "Pending",
        },
      });

      if (!existingPending) {
        await prisma.approvals.create({
          data: {
            request_type: isRfid
              ? "New RFID Access Request"
              : "New QR Access Request",
            requester_name: decoded.name || "Unassigned Entity",
            details: `${isRfid ? "RFID" : "QR"} scan at ${
              scanData.gateLocation || "Access Portal"
            } (Tag: ${rawData})`,
            status: "Pending",
            target_table:
              decoded.entity_type === "vehicle" ? "fleet" : "employees",
            scanned_data: JSON.stringify(decoded),
          },
        });
      }
    } catch (e) {
      console.error("Failed to auto-create pending approval:", e);
    }
  }

  // 5. Direction Auto-Toggle (Only checks last GRANTED scan)
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

  const enrichedPayload: Record<string, unknown> = {
    ...decoded,
    day_of_week: dayOfWeek,
    date: dateStr,
    time: timeStr,
    shift: shiftName,
    scanned_at_iso: now.toISOString(),
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    scanned_by: scanData.scannedBy || "Gate Terminal",
    gate_location: scanData.gateLocation,
    direction,
    access_granted: accessGranted,
    denial_reason: denialReason,
  };

  // 6. Gate Log Creation (Persistent Audit Record)
  const createdLog = await prisma.gate_logs.create({
    data: {
      access_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      direction: direction,
      qr_data: isRfid ? normalizedTag : normalizeQrHash(rawData) || rawData,
      access_granted: accessGranted,
      denial_reason: denialReason,
      gate_location: scanData.gateLocation,
      scanned_at: now,
      scanned_by: scanData.scannedBy,
      ip_address: scanData.ipAddress,
      user_agent: scanData.userAgent,
      parsed_qr_data: JSON.stringify(enrichedPayload),
      employee_id: entityType === "employee" ? entityId : null,
      vehicle_id: entityType === "vehicle" ? entityId : null,
      visitor_id: entityType === "visitor" ? entityId : null,
      equipment_id: entityType === "equipment" ? entityId : null,
      latitude: scanData.latitude ?? null,
      longitude: scanData.longitude ?? null,
      altitude: scanData.altitude ?? null,
      accuracy: scanData.accuracy ?? null,
      speed: scanData.speed ?? null,
      heading: scanData.heading ?? null,
      rssi: scanData.rssi ?? null,
      antenna_id: scanData.antennaId ?? null,
      device_battery: scanData.deviceBattery ?? null,
      read_count: scanData.readCount ?? null,
      geofence_status: scanData.geofenceStatus ?? null,
      operator_id: scanData.operatorId ?? null,
      telemetry_data: scanData.telemetryData ?? null,
    },
  });

  return {
    logId: createdLog.id,
    accessGranted,
    denialReason,
    entity: resolved,
    timestamp: now.toISOString(),
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

/**
 * Backward-compatible wrapper for QR scans
 */
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
}): Promise<ScanResult> {
  return processScan({
    qrHash,
    scanType: "QR",
    gateLocation,
    scannedBy,
    ipAddress,
    userAgent,
  });
}

/**
 * Backward-compatible wrapper for RFID scans
 */
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
}): Promise<ScanResult> {
  return processScan({
    rfidTag,
    scanType: "RFID",
    gateLocation,
    scannedBy,
    ipAddress,
    userAgent,
  });
}

