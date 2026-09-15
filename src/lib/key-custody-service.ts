import prisma from "@/lib/prisma";
import { resolveEntityFromDatabase, type ResolvedEmployeeEntity } from "./scan-decoder";
import { isDatePast } from "./scan-service";
import { broadcastDeviceNotification } from "./device-notifications";

export interface KeySessionState {
  sessionId: string;
  keyId: string;
  keyDbId: number;
  machineId: string;
  vehicleId?: number | null;
  requiredCertification?: string | null;
  state: "AWAITING_OPERATOR_VERIFICATION" | "COMPLETED" | "EXPIRED" | "DENIED";
  initiatedAt: string;
  expiresAt: string; // ISO string
  expiresAtTimestamp: number; // Unix ms
  gateId: string;
  deviceId: string;
}

export interface KeyVerificationResult {
  status: "GRANTED" | "DENIED";
  keyId: string;
  machineId: string;
  operatorName: string;
  operatorId: string;
  operatorDbId: number | null;
  denialReason: string | null;
  timestamp: string;
  logId?: number;
  sessionState?: KeySessionState;
}

// In-memory active key custody sessions
declare global {
  var __keyCustodySessions: Map<string, KeySessionState> | undefined;
}

if (!globalThis.__keyCustodySessions) {
  globalThis.__keyCustodySessions = new Map<string, KeySessionState>();
}

const activeSessions = globalThis.__keyCustodySessions;

// Clean up expired sessions periodically
function cleanExpiredSessions() {
  const now = Date.now();
  for (const [, session] of activeSessions.entries()) {
    if (session.state === "AWAITING_OPERATOR_VERIFICATION" && session.expiresAtTimestamp < now) {
      session.state = "EXPIRED";
    }
  }
}

/**
 * Get active session for a specific device or key tag
 */
export function getActiveKeySession(identifier: string): KeySessionState | null {
  cleanExpiredSessions();
  const now = Date.now();
  for (const session of activeSessions.values()) {
    if (
      (session.sessionId === identifier ||
        session.deviceId === identifier ||
        session.keyId.toLowerCase() === identifier.toLowerCase() ||
        session.machineId.toLowerCase() === identifier.toLowerCase()) &&
      session.state === "AWAITING_OPERATOR_VERIFICATION" &&
      session.expiresAtTimestamp >= now
    ) {
      return session;
    }
  }
  return null;
}

/**
 * Step 1: Operator scans Key Tag -> System enters "Awaiting Operator Verification"
 */
export async function initiateKeyCheckout(
  keyTag: string,
  gateId = "Main Ingress Gate 1",
  deviceId = "Chainway-C66-01",
  timeoutSeconds = 30
): Promise<KeySessionState> {
  cleanExpiredSessions();
  const cleanKeyTag = keyTag.trim();
  const now = Date.now();

  // Find or auto-register key in database
  let keyRecord = await prisma.keys.findFirst({
    where: {
      OR: [
        { key_tag: cleanKeyTag },
        { machine_id: cleanKeyTag },
        { key_tag: `KEY_${cleanKeyTag}` },
        { key_tag: `KEY-${cleanKeyTag}` },
      ],
    },
    include: { vehicle: true },
  });

  if (!keyRecord) {
    // Check if vehicle exists with this fleet_id / machine_id
    const vehicle = await prisma.vehicles.findFirst({
      where: {
        OR: [
          { fleet_id: cleanKeyTag },
          { machine_id: cleanKeyTag },
          { fleet_id: cleanKeyTag.replace(/^KEY[-_]/i, "") },
        ],
      },
    });

    const machineId = vehicle ? vehicle.fleet_id : cleanKeyTag.replace(/^KEY[-_]/i, "");

    keyRecord = await prisma.keys.create({
      data: {
        key_tag: cleanKeyTag,
        machine_id: machineId,
        vehicle_id: vehicle ? vehicle.id : null,
        status: "IN_KEY_BOX",
      },
      include: { vehicle: true },
    });
  }

  const sessionId = `keysess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const expiresAtTimestamp = now + timeoutSeconds * 1000;
  const expiresAt = new Date(expiresAtTimestamp).toISOString();

  const sessionState: KeySessionState = {
    sessionId,
    keyId: keyRecord.key_tag,
    keyDbId: keyRecord.id,
    machineId: keyRecord.machine_id,
    vehicleId: keyRecord.vehicle_id,
    requiredCertification: keyRecord.vehicle?.required_certification || null,
    state: "AWAITING_OPERATOR_VERIFICATION",
    initiatedAt: new Date(now).toISOString(),
    expiresAt,
    expiresAtTimestamp,
    gateId,
    deviceId,
  };

  // Clear any previous active session on this device
  for (const [id, s] of activeSessions.entries()) {
    if (s.deviceId === deviceId || s.keyId === keyRecord.key_tag) {
      activeSessions.delete(id);
    }
  }

  activeSessions.set(sessionId, sessionState);

  // Broadcast real-time push alert to scanner screen
  await broadcastDeviceNotification({
    type: "INFO",
    severity: "info",
    title: "🔑 KEY SCANNED - VERIFICATION REQUIRED",
    message: `Machine ${keyRecord.machine_id} scanned. Scan operator badge within ${timeoutSeconds}s.`,
    entityName: `Key: ${keyRecord.machine_id}`,
    gateLocation: gateId,
    rawTag: cleanKeyTag,
    targetDeviceId: deviceId,
  });

  return sessionState;
}

/**
 * Step 2: Operator scans badge -> Compliance checks and Granted/Denied real-time alert
 */
export async function verifyOperatorForKey(
  sessionIdOrDeviceId: string,
  badgeTag: string,
  gateLocation?: string,
  scannedBy?: string
): Promise<KeyVerificationResult> {
  cleanExpiredSessions();
  const now = new Date();
  const cleanBadge = badgeTag.trim();

  // Find active session
  let session = activeSessions.get(sessionIdOrDeviceId);
  if (!session) {
    session = getActiveKeySession(sessionIdOrDeviceId) ?? undefined;
  }

  if (!session || session.state !== "AWAITING_OPERATOR_VERIFICATION") {
    return {
      status: "DENIED",
      keyId: "UNKNOWN",
      machineId: "UNKNOWN",
      operatorName: "Unknown",
      operatorId: "UNKNOWN",
      operatorDbId: null,
      denialReason: "No active key checkout session (or 30s timeout elapsed)",
      timestamp: now.toISOString(),
    };
  }

  // Check 30s timeout
  if (Date.now() > session.expiresAtTimestamp) {
    session.state = "EXPIRED";
    return {
      status: "DENIED",
      keyId: session.keyId,
      machineId: session.machineId,
      operatorName: "Unknown",
      operatorId: "UNKNOWN",
      operatorDbId: null,
      denialReason: "Access Denied: Key verification timeout expired (30s window exceeded)",
      timestamp: now.toISOString(),
      sessionState: session,
    };
  }

  // Resolve operator
  const resolved = await resolveEntityFromDatabase(cleanBadge);

  if (!resolved || resolved.type !== "employee") {
    session.state = "DENIED";
    const refusalReason = "Access Denied: Unrecognized Operator Badge";

    await broadcastDeviceNotification({
      type: "ACCESS_DENIED",
      severity: "danger",
      title: "⛔ KEY CHECKOUT DENIED",
      message: `${session.machineId} key checkout denied: ${refusalReason}`,
      entityName: "Unregistered Badge",
      denialReason: refusalReason,
      gateLocation: session.gateId,
      rawTag: cleanBadge,
      targetDeviceId: session.deviceId,
    });

    return {
      status: "DENIED",
      keyId: session.keyId,
      machineId: session.machineId,
      operatorName: "Unregistered Personnel",
      operatorId: cleanBadge,
      operatorDbId: null,
      denialReason: refusalReason,
      timestamp: now.toISOString(),
      sessionState: session,
    };
  }

  const emp = resolved as ResolvedEmployeeEntity;
  const isContractor = Boolean(
    emp.is_contractor ||
    (emp.contractor_company && emp.contractor_company.trim().length > 0) ||
    (emp.position && /contractor/i.test(emp.position))
  );

  let denialReason: string | null = null;

  // Compliance Rule 1: Medical Fitness Expiration
  if (isDatePast(emp.medical_expiry, now)) {
    denialReason = "Access Denied: Medical Fitness Expired";
  }
  // Compliance Rule 2: Safety Induction Expiration
  else if (isDatePast(emp.induction_expiry, now)) {
    denialReason = "Access Denied: Safety Induction Expired";
  }
  // Compliance Rule 3: Contractor active induction
  else if (isContractor && (!emp.induction || !emp.induction_expiry)) {
    denialReason = "Access Denied: Uninducted Contractor";
  }
  // Compliance Rule 4: Credential Status
  else if (emp.status !== "Active" && emp.status !== "Checked In") {
    denialReason = `Access Denied: Operator status is ${emp.status}`;
  }
  // Compliance Rule 5: Required Machine Authorization / Certification
  else if (session.requiredCertification) {
    const required = session.requiredCertification.trim().toUpperCase();
    const operatorCerts = (emp.certifications || "").toUpperCase();
    const operatorRole = (emp.access_level || "").toUpperCase();
    const jobTitle = (emp.position || "").toUpperCase();

    const hasCert =
      operatorCerts.includes(required) ||
      operatorRole.includes(required) ||
      jobTitle.includes(required) ||
      operatorRole === "ALL_ACCESS" ||
      operatorRole === "SUPERVISOR";

    if (!hasCert) {
      denialReason = `Access Denied: Machine Authorization Required (${session.requiredCertification})`;
    }
  }

  const gateLoc = gateLocation || session.gateId;
  const scannerDevice = scannedBy || session.deviceId;

  if (denialReason) {
    session.state = "DENIED";

    // Record denied custody log
    const custodyLog = await prisma.key_custody_logs.create({
      data: {
        key_id: session.keyDbId,
        operator_id: emp.id,
        action: "CHECKOUT_ATTEMPT",
        status: "DENIED",
        denial_reason: denialReason,
        gate_location: gateLoc,
        scanned_by: scannerDevice,
        timestamp: now,
      },
    });

    // Push instant red strobe notification to Android scanner
    await broadcastDeviceNotification({
      type: "ACCESS_DENIED",
      severity: "danger",
      title: "⛔ KEY CHECKOUT DENIED",
      message: `${emp.name} denied key for ${session.machineId}: ${denialReason}`,
      entityName: emp.name,
      denialReason,
      gateLocation: gateLoc,
      rawTag: cleanBadge,
      targetDeviceId: session.deviceId,
    });

    return {
      status: "DENIED",
      keyId: session.keyId,
      machineId: session.machineId,
      operatorName: emp.name,
      operatorId: emp.code,
      operatorDbId: emp.id,
      denialReason,
      timestamp: now.toISOString(),
      logId: custodyLog.id,
      sessionState: session,
    };
  }

  // ALL COMPLIANCE CHECKS PASSED: GRANT ACCESS
  session.state = "COMPLETED";

  // Update key record status
  await prisma.keys.update({
    where: { id: session.keyDbId },
    data: {
      status: "CHECKED_OUT",
      assigned_operator_id: emp.id,
    },
  });

  // Record audit trail log
  const custodyLog = await prisma.key_custody_logs.create({
    data: {
      key_id: session.keyDbId,
      operator_id: emp.id,
      action: "CHECKOUT",
      status: "GRANTED",
      denial_reason: null,
      gate_location: gateLoc,
      scanned_by: scannerDevice,
      timestamp: now,
    },
  });

  // Push green granted notification to Android scanner
  await broadcastDeviceNotification({
    type: "ACCESS_GRANTED",
    severity: "success",
    title: "✓ KEY CHECKOUT GRANTED",
    message: `Key for ${session.machineId} checked out to ${emp.name} (${emp.code})`,
    entityName: emp.name,
    gateLocation: gateLoc,
    rawTag: cleanBadge,
    targetDeviceId: session.deviceId,
  });

  return {
    status: "GRANTED",
    keyId: session.keyId,
    machineId: session.machineId,
    operatorName: emp.name,
    operatorId: emp.code,
    operatorDbId: emp.id,
    denialReason: null,
    timestamp: now.toISOString(),
    logId: custodyLog.id,
    sessionState: session,
  };
}

/**
 * Return key back to key box
 */
export async function returnKey(
  keyTagOrMachineId: string,
  operatorBadgeOrId?: string,
  gateLocation = "Key Control Box",
  scannedBy = "Scanner"
) {
  const clean = keyTagOrMachineId.trim();
  const key = await prisma.keys.findFirst({
    where: {
      OR: [
        { key_tag: clean },
        { machine_id: clean },
        { key_tag: `KEY_${clean}` },
        { key_tag: `KEY-${clean}` },
      ],
    },
  });

  if (!key) {
    return { error: "Key not found", status: "NOT_FOUND" };
  }

  let operatorId = key.assigned_operator_id;
  if (operatorBadgeOrId) {
    const op = await resolveEntityFromDatabase(operatorBadgeOrId);
    if (op && op.type === "employee") {
      operatorId = op.id;
    }
  }

  await prisma.keys.update({
    where: { id: key.id },
    data: {
      status: "IN_KEY_BOX",
      assigned_operator_id: null,
    },
  });

  if (operatorId) {
    await prisma.key_custody_logs.create({
      data: {
        key_id: key.id,
        operator_id: operatorId,
        action: "RETURN",
        status: "RETURNED",
        gate_location: gateLocation,
        scanned_by: scannedBy,
        timestamp: new Date(),
      },
    });
  }

  return {
    success: true,
    keyId: key.key_tag,
    machineId: key.machine_id,
    status: "IN_KEY_BOX",
  };
}
