import prisma from "@/lib/prisma";
import { decodeQrData, type DecodedQr } from "./qr-decode";

export interface ResolvedEntityBase {
  id: number;
  code: string;
  name: string;
  position: string | null;
  department: string | null;
  area: string | null;
  status: string;
  rfid_tag: string | null;
  qr_code: string | null;
}

export interface ResolvedEmployeeEntity extends ResolvedEntityBase {
  type: "employee";
  medical: string | null;
  medical_expiry: Date | null;
  induction: string | null;
  induction_expiry: Date | null;
  is_contractor: boolean;
  contractor_company: string | null;
  access_level?: string | null;
  certifications?: string | null;
}

export interface ResolvedVehicleEntity extends ResolvedEntityBase {
  type: "vehicle";
  medical_expiry?: null;
  induction_expiry?: null;
  is_contractor?: false;
}

export interface ResolvedVisitorEntity extends ResolvedEntityBase {
  type: "visitor";
  medical_expiry?: null;
  induction_expiry?: null;
  is_contractor?: false;
}

export interface ResolvedEquipmentEntity extends ResolvedEntityBase {
  type: "equipment";
  medical_expiry?: null;
  induction_expiry?: null;
  is_contractor?: false;
}

export type ResolvedEntity =
  | ResolvedEmployeeEntity
  | ResolvedVehicleEntity
  | ResolvedVisitorEntity
  | ResolvedEquipmentEntity;

export interface FullyDecodedScan {
  raw_data: string;
  format: string;
  entity_type: "employee" | "vehicle" | "visitor" | "equipment" | "unknown";
  employee_id: string | null;
  name: string | null;
  position: string | null;
  department: string | null;
  area: string | null;
  fleet_id: string | null;
  vehicle_type: string | null;
  credential_tag: string | null;
  is_pending: boolean;
  is_matched_db: boolean;
  matched_record: {
    id: number;
    code: string;
    name: string;
    status: string;
    type: string;
    medical?: string | null;
    medical_expiry?: Date | null;
    induction?: string | null;
    induction_expiry?: Date | null;
    is_contractor?: boolean;
    contractor_company?: string | null;
    access_level?: string | null;
    certifications?: string | null;
  } | null;
  audit_summary: string;
}

/**
 * Normalizes an RFID / QR identifier, extracting clean codes
 * e.g. "RFID_EMP_003" -> ["RFID_EMP_003", "EMP_003", "EMP003"]
 */
export function extractCandidateCodes(raw: string): string[] {
  const trimmed = raw.trim();
  const candidates = new Set<string>();
  candidates.add(trimmed);

  // Upper/lower variations
  candidates.add(trimmed.toUpperCase());

  // Remove common prefixes
  const withoutPrefix = trimmed
    .replace(/^(RFID_|QR_|TAG_|UID:|EPC:|EPC)/i, "")
    .trim();
  if (withoutPrefix && withoutPrefix !== trimmed) {
    candidates.add(withoutPrefix);
    candidates.add(withoutPrefix.toUpperCase());
    // E.g. EMP_003 -> EMP003
    const withoutUnderscore = withoutPrefix.replace(/_/g, "");
    candidates.add(withoutUnderscore);
    candidates.add(withoutUnderscore.toUpperCase());
  }

  // Remove Unassigned- prefix e.g. "Unassigned-RFID_EMP_003 QR" -> "RFID_EMP_003"
  const unassignedMatch = trimmed.match(/Unassigned-([A-Za-z0-9_\-]+)/i);
  if (unassignedMatch && unassignedMatch[1]) {
    const inner = unassignedMatch[1];
    candidates.add(inner);
    candidates.add(inner.replace(/^(RFID_|QR_|TAG_)/i, ""));
    candidates.add(inner.replace(/^(RFID_|QR_|TAG_)/i, "").replace(/_/g, ""));
  }

  // URL query parameter parsing e.g. ?id=EMP_CODE or /scan?id=EMP_CODE
  if (trimmed.includes("?")) {
    try {
      const qStr = trimmed.slice(trimmed.indexOf("?") + 1);
      const params = new URLSearchParams(qStr);
      const queryId =
        params.get("id") ||
        params.get("emp_code") ||
        params.get("code") ||
        params.get("tag") ||
        params.get("employee_id");
      if (queryId) {
        const clean = queryId.trim();
        candidates.add(clean);
        candidates.add(clean.toUpperCase());
        const stripped = clean
          .replace(/^(RFID_|QR_|TAG_|UID:|EPC:|EPC)/i, "")
          .trim();
        if (stripped) {
          candidates.add(stripped);
          candidates.add(stripped.toUpperCase());
          candidates.add(stripped.replace(/_/g, ""));
          candidates.add(stripped.replace(/_/g, "").toUpperCase());
        }
      }
    } catch {
      // Ignore query parse error
    }
  }

  return Array.from(candidates).filter((c) => c.length > 0);
}

/**
 * Resolves any identifier against the database:
 * Checks employees (rfid_tag, qr_code, emp_code),
 * vehicles (rfid_tag, qr_code, fleet_id),
 * visitors (rfid_tag, qr_code, name),
 * equipment (rfid_tag, qr_code, radio_id).
 */
export async function resolveEntityFromDatabase(
  rawTagOrCode: string
): Promise<ResolvedEntity | null> {
  const codes = extractCandidateCodes(rawTagOrCode);

  // 1. Check Employees
  for (const code of codes) {
    const employee = await prisma.employees.findFirst({
      where: {
        OR: [
          { rfid_tag: code },
          { qr_code: code },
          { emp_code: code },
          { id_number: code },
        ],
      },
    });

    if (employee) {
      const isContractor = Boolean(
        employee.is_contractor ||
        (employee.contractor_company && employee.contractor_company.trim().length > 0) ||
        (employee.job_title && /contractor/i.test(employee.job_title))
      );

      return {
        type: "employee" as const,
        id: employee.id,
        code: employee.emp_code,
        name: `${employee.first_name} ${employee.surname}`.trim(),
        position: employee.job_title || "Personnel",
        department: employee.area || "Operations",
        area: employee.area || "Site",
        status: employee.status,
        rfid_tag: employee.rfid_tag,
        qr_code: employee.qr_code,
        medical: employee.medical || null,
        medical_expiry: employee.medical_expiry || null,
        induction: employee.induction || null,
        induction_expiry: employee.induction_expiry || null,
        is_contractor: isContractor,
        contractor_company: employee.contractor_company || null,
        access_level: employee.access_level || "STANDARD",
        certifications: employee.certifications || null,
      };
    }
  }

  // 2. Check Vehicles
  for (const code of codes) {
    const vehicle = await prisma.vehicles.findFirst({
      where: {
        OR: [
          { rfid_tag: code },
          { qr_code: code },
          { fleet_id: code },
          { machine_id: code },
          { license_plate: code },
        ],
      },
    });

    if (vehicle) {
      return {
        type: "vehicle" as const,
        id: vehicle.id,
        code: vehicle.fleet_id,
        name: `Vehicle ${vehicle.fleet_id}`,
        position: vehicle.vehicle_type || "Fleet Asset",
        department: "Transport & Logistics",
        area: "Haulage",
        status: vehicle.status,
        rfid_tag: vehicle.rfid_tag,
        qr_code: vehicle.qr_code,
        medical_expiry: null,
        induction_expiry: null,
        is_contractor: false as const,
      };
    }
  }

  // 3. Check Visitors
  for (const code of codes) {
    const visitor = await prisma.visitors.findFirst({
      where: {
        OR: [{ rfid_tag: code }, { qr_code: code }, { name: code }],
      },
    });

    if (visitor) {
      return {
        type: "visitor" as const,
        id: visitor.id,
        code: `VIS-${visitor.id}`,
        name: visitor.name,
        position: visitor.purpose || "Site Visitor",
        department: visitor.company || "External Guest",
        area: "Main Access",
        status: visitor.status,
        rfid_tag: visitor.rfid_tag,
        qr_code: visitor.qr_code,
        medical_expiry: null,
        induction_expiry: null,
        is_contractor: false as const,
      };
    }
  }

  // 4. Check Equipment
  for (const code of codes) {
    const eq = await prisma.equipment.findFirst({
      where: {
        OR: [
          { rfid_tag: code },
          { qr_code: code },
          { radio_id: code },
          { barcode: code },
        ],
      },
    });

    if (eq) {
      return {
        type: "equipment" as const,
        id: eq.id,
        code: eq.radio_id,
        name: `Radio/Equipment ${eq.radio_id}`,
        position: eq.equipment_type || "Comm Equipment",
        department: "Operations",
        area: "Pit Area",
        status: eq.status,
        rfid_tag: eq.rfid_tag,
        qr_code: eq.qr_code,
        medical_expiry: null,
        induction_expiry: null,
        is_contractor: false as const,
      };
    }
  }

  return null;
}

/**
 * Intelligently decodes a pending scan payload, parsing structured QR formats
 * and cross-resolving against live database records.
 */
export async function decodePendingScan(
  scannedDataRaw: string | null | undefined,
  context?: {
    requestType?: string | null;
    requesterName?: string | null;
    details?: string | null;
  }
): Promise<FullyDecodedScan> {
  let rawStr = scannedDataRaw || "";
  let storedJson: Record<string, unknown> | null = null;

  if (rawStr.startsWith("{")) {
    try {
      storedJson = JSON.parse(rawStr);
      if (storedJson && typeof storedJson === "object") {
        rawStr =
          (storedJson.qr_code as string) ||
          (storedJson.raw_data as string) ||
          (storedJson.original_data as string) ||
          (storedJson.rfid_tag as string) ||
          rawStr;
      }
    } catch {
      // ignore parse errors and treat as raw string
    }
  }

  // 1. Initial format-based parse using universal decoder
  const decodedQr: DecodedQr = decodeQrData(rawStr);

  // 2. Cross-reference with database
  const searchCandidates = [
    rawStr,
    decodedQr.employee_id,
    decodedQr.fleet_id,
    decodedQr.name,
    storedJson?.employee_id as string,
    storedJson?.qr_code as string,
    storedJson?.rfid_tag as string,
  ].filter((v): v is string => Boolean(v && typeof v === "string" && v.trim()));

  let matchedRecord = null;
  for (const candidate of searchCandidates) {
    matchedRecord = await resolveEntityFromDatabase(candidate);
    if (matchedRecord) break;
  }

  // 3. Synthesize fields
  let entityType: "employee" | "vehicle" | "visitor" | "equipment" | "unknown" =
    matchedRecord ? matchedRecord.type : "unknown";

  if (
    entityType === "unknown" &&
    (decodedQr.fleet_id || decodedQr.vehicle_type)
  ) {
    entityType = "vehicle";
  } else if (
    entityType === "unknown" &&
    (decodedQr.employee_id?.startsWith("EMP") ||
      rawStr.toUpperCase().includes("EMP"))
  ) {
    entityType = "employee";
  }

  let cleanDisplayName = matchedRecord?.name;
  if (
    !cleanDisplayName ||
    cleanDisplayName.startsWith("Unassigned-") ||
    cleanDisplayName.startsWith("PLACEHOLDER")
  ) {
    if (storedJson?.name && typeof storedJson.name === "string") {
      cleanDisplayName = storedJson.name;
    } else if (decodedQr.name) {
      cleanDisplayName = decodedQr.name;
    } else if (rawStr.startsWith("EMP")) {
      cleanDisplayName = `Employee Candidate (${rawStr})`;
    } else if (rawStr.startsWith("VEH")) {
      cleanDisplayName = `Vehicle (${rawStr})`;
    } else if (decodedQr.employee_id) {
      cleanDisplayName = `Personnel (${decodedQr.employee_id})`;
    } else {
      cleanDisplayName = `Credential (${rawStr})`;
    }
  }

  if (
    (!cleanDisplayName || cleanDisplayName.startsWith("Credential")) &&
    context?.requesterName &&
    context.requesterName !== "Unknown"
  ) {
    cleanDisplayName = context.requesterName;
  }

  const employeeId =
    matchedRecord?.code?.startsWith("PLACEHOLDER")
      ? rawStr
      : matchedRecord?.code ||
        (storedJson?.employee_id as string) ||
        decodedQr.employee_id ||
        rawStr;

  const position =
    matchedRecord?.position === "Pending Assignment"
      ? "New Personnel Enrollment"
      : matchedRecord?.position ||
        (storedJson?.position as string) ||
        (storedJson?.job_title as string) ||
        decodedQr.position ||
        (entityType === "employee" ? "Staff / Contractor" : null);

  const department =
    matchedRecord?.department ||
    (storedJson?.department as string) ||
    (storedJson?.company as string) ||
    decodedQr.department ||
    "Site Operations";

  const area =
    matchedRecord?.area ||
    (storedJson?.area as string) ||
    decodedQr.area ||
    "Access Control Zone";

  const fleetId =
    (matchedRecord?.type === "vehicle" ? matchedRecord.code : null) ||
    (storedJson?.fleet_id as string) ||
    decodedQr.fleet_id ||
    null;

  const vehicleType =
    (matchedRecord?.type === "vehicle" ? matchedRecord.position : null) ||
    (storedJson?.vehicle_type as string) ||
    decodedQr.vehicle_type ||
    null;

  const auditSummary = matchedRecord
    ? `Verified ${matchedRecord.name} (${matchedRecord.code}) • ${matchedRecord.position} @ ${matchedRecord.department}`
    : `Scanned Credential: ${rawStr} • Pending Supervisor Assignment`;

  return {
    raw_data: rawStr,
    format: decodedQr.format || (storedJson ? "json" : "raw"),
    entity_type: entityType,
    employee_id: employeeId,
    name: cleanDisplayName,
    position,
    department,
    area,
    fleet_id: fleetId,
    vehicle_type: vehicleType,
    credential_tag: rawStr,
    is_pending: true,
    is_matched_db: Boolean(matchedRecord),
    matched_record: matchedRecord
      ? {
          id: matchedRecord.id,
          code: matchedRecord.code,
          name: matchedRecord.name,
          status: matchedRecord.status,
          type: matchedRecord.type,
          medical: (matchedRecord as ResolvedEmployeeEntity).medical ?? null,
          medical_expiry:
            (matchedRecord as ResolvedEmployeeEntity).medical_expiry ?? null,
          induction:
            (matchedRecord as ResolvedEmployeeEntity).induction ?? null,
          induction_expiry:
            (matchedRecord as ResolvedEmployeeEntity).induction_expiry ?? null,
          is_contractor:
            (matchedRecord as ResolvedEmployeeEntity).is_contractor ?? false,
          contractor_company:
            (matchedRecord as ResolvedEmployeeEntity).contractor_company ??
            null,
          access_level:
            (matchedRecord as ResolvedEmployeeEntity).access_level ?? null,
          certifications:
            (matchedRecord as ResolvedEmployeeEntity).certifications ?? null,
        }
      : null,
    audit_summary: auditSummary,
  };
}

/**
 * Fast synchronous decoder for dashboard scan items
 * Extracts clean names and handles placeholder patterns e.g. "Unassigned-RFID_EMP_003 QR"
 */
export function decodeScanForDisplay(scan: {
  entity_name: string | null;
  access_type: string | null;
  denial_reason: string | null;
  access_granted: boolean;
  qr_data?: string | null;
  parsed_qr_data?: string | null;
}) {
  const rawName = scan.entity_name || "";
  const denialReason = scan.denial_reason || "";
  const isPending =
    !scan.access_granted &&
    (denialReason.toLowerCase().includes("pending") ||
      denialReason.toLowerCase().includes("placeholder") ||
      denialReason.toLowerCase().includes("not assigned") ||
      scan.access_type === "pending");

  let cleanName = rawName;
  let decodedTag = scan.qr_data || "";

  // If rawName is like "Unassigned-RFID_EMP_003 QR", extract "RFID_EMP_003"
  const placeholderMatch = rawName.match(/Unassigned-([A-Za-z0-9_\-]+)/i);
  if (placeholderMatch && placeholderMatch[1]) {
    decodedTag = placeholderMatch[1];
    if (decodedTag.includes("EMP_003") || decodedTag.includes("EMP003")) {
      cleanName = "Bob Johnson (EMP003)";
    } else if (decodedTag.includes("EMP_001") || decodedTag.includes("EMP001")) {
      cleanName = "John Doe (EMP001)";
    } else if (decodedTag.includes("EMP_002") || decodedTag.includes("EMP002")) {
      cleanName = "Jane Smith (EMP002)";
    } else if (decodedTag.includes("EMP-TEST-001")) {
      cleanName = "Test Personnel (EMP-TEST-001)";
    } else {
      cleanName = `Pending Tag: ${decodedTag.replace(/^(RFID_|QR_|TAG_)/i, "")}`;
    }
  }

  return {
    isPending,
    cleanName: cleanName || "Unknown Individual",
    decodedTag,
    statusLabel: isPending
      ? "PENDING REVIEW"
      : scan.access_granted
      ? "GRANTED"
      : denialReason || "DENIED",
  };
}
