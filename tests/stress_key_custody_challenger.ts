/**
 * Empirical Challenger Gate 2 Stress Harness: Key Custody & Sequential Dual-Scan Verification
 *
 * Requirements:
 * 1. Initiate checkout with key tag -> verify 30s timeout countdown.
 * 2. Verify uninducted contractor rejection -> immediate denial strobe.
 * 3. Verify expired medical certificate rejection -> immediate denial strobe.
 * 4. Verify authorized compliant operator -> grant with audit log.
 * 5. Full HTTP API layer integration on port 8080.
 * 6. Zero DB pollution oracle: ensure pristine database state before and after test execution.
 */

import prisma from "../src/lib/prisma";
import {
  initiateKeyCheckout,
  verifyOperatorForKey,
  returnKey,
  getActiveKeySession,
} from "../src/lib/key-custody-service";
import {
  subscribeToDeviceNotifications,
  type DeviceNotification,
} from "../src/lib/device-notifications";

const BASE_URL = "http://127.0.0.1:8080";

interface TestReport {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const reports: TestReport[] = [];
let currentSuite = "";

function suite(name: string) {
  currentSuite = name;
  console.log(`\n▶ Suite: ${name}`);
}

async function test(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    reports.push({ suite: currentSuite, name, passed: true, durationMs });
    console.log(`  ✔ PASS: ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    reports.push({ suite: currentSuite, name, passed: false, error: err?.message || String(err), durationMs });
    console.error(`  ✖ FAIL: ${name} (${durationMs}ms) -> ${err?.message || err}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function main() {
  console.log("==================================================================");
  console.log(" 🔬 EMPIRICAL CHALLENGER GATE 2: KEY CUSTODY & DUAL-SCAN STRESS");
  console.log("==================================================================");

  // Baseline database snapshot
  const baselineEmployees = await prisma.employees.count();
  const baselineVehicles = await prisma.vehicles.count();
  const baselineKeys = await prisma.keys.count();
  const baselineLogs = await prisma.key_custody_logs.count();

  console.log(`\n[Baseline State] Employees: ${baselineEmployees}, Vehicles: ${baselineVehicles}, Keys: ${baselineKeys}, Custody Logs: ${baselineLogs}`);

  // Test identifiers with dedicated challenger prefix
  const PREFIX = "CHALL2_";
  const TEST_DEVICE_ID = `${PREFIX}DEVICE_01`;
  const TEST_GATE_ID = "North Pit Gate 4";

  // Notification capturing array
  const capturedNotifications: DeviceNotification[] = [];
  const unsubscribe = subscribeToDeviceNotifications((notif) => {
    capturedNotifications.push(notif);
  });

  // Seed test operators and vehicles
  const now = new Date();
  const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
  const futureDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days future

  // 1. Heavy Machine Vehicle with Required Certification
  const TEST_MACHINE_ID = `${PREFIX}CAT_797F`;
  const TEST_KEY_TAG = `KEY_${TEST_MACHINE_ID}`;

  const testVehicle = await prisma.vehicles.create({
    data: {
      fleet_id: TEST_MACHINE_ID,
      machine_id: TEST_MACHINE_ID,
      vehicle_type: "HEAVY_FLEET",
      is_heavy_fleet: true,
      required_certification: "CAT_797F_CERT",
      operational_hours: 1250.5,
      status: "Active",
    },
  });

  // 2. Uninducted Contractor (Valid Medical, No Induction)
  const uninductedContractor = await prisma.employees.create({
    data: {
      emp_code: `${PREFIX}CONTR_UNIND`,
      first_name: "Uninducted",
      surname: "Contractor",
      is_contractor: true,
      contractor_company: "Apex Drilling Contractors",
      status: "Active",
      medical: "FIT",
      medical_expiry: futureDate,
      induction: null,
      induction_expiry: null,
      rfid_tag: `${PREFIX}RFID_CONTR_UNIND`,
      qr_code: `${PREFIX}QR_CONTR_UNIND`,
      certifications: "CAT_797F_CERT",
    },
  });

  // 3. Expired Medical Operator (Valid Induction & Certs, Expired Medical)
  const expiredMedicalOperator = await prisma.employees.create({
    data: {
      emp_code: `${PREFIX}EMP_EXP_MED`,
      first_name: "Expired",
      surname: "Medical",
      is_contractor: false,
      status: "Active",
      medical: "FIT",
      medical_expiry: pastDate, // Expired
      induction: "COMPLETED",
      induction_expiry: futureDate,
      rfid_tag: `${PREFIX}RFID_EXP_MED`,
      qr_code: `${PREFIX}QR_EXP_MED`,
      certifications: "CAT_797F_CERT",
    },
  });

  // 4. Expired Induction Operator (Valid Medical, Expired Induction)
  const expiredInductionOperator = await prisma.employees.create({
    data: {
      emp_code: `${PREFIX}EMP_EXP_IND`,
      first_name: "Expired",
      surname: "Induction",
      is_contractor: false,
      status: "Active",
      medical: "FIT",
      medical_expiry: futureDate,
      induction: "COMPLETED",
      induction_expiry: pastDate, // Expired
      rfid_tag: `${PREFIX}RFID_EXP_IND`,
      qr_code: `${PREFIX}QR_EXP_IND`,
      certifications: "CAT_797F_CERT",
    },
  });

  // 5. Uncertified Operator (Valid Medical & Induction, Lacks CAT_797F_CERT)
  const uncertifiedOperator = await prisma.employees.create({
    data: {
      emp_code: `${PREFIX}EMP_UNCERT`,
      first_name: "Uncertified",
      surname: "Operator",
      is_contractor: false,
      status: "Active",
      medical: "FIT",
      medical_expiry: futureDate,
      induction: "COMPLETED",
      induction_expiry: futureDate,
      rfid_tag: `${PREFIX}RFID_UNCERT`,
      qr_code: `${PREFIX}QR_UNCERT`,
      certifications: "LIGHT_VEHICLE_ONLY", // Missing CAT_797F_CERT
    },
  });

  // 6. Fully Compliant Authorized Operator
  const compliantOperator = await prisma.employees.create({
    data: {
      emp_code: `${PREFIX}EMP_COMPLIANT`,
      first_name: "Compliant",
      surname: "Operator",
      is_contractor: false,
      status: "Active",
      medical: "FIT",
      medical_expiry: futureDate,
      induction: "COMPLETED",
      induction_expiry: futureDate,
      rfid_tag: `${PREFIX}RFID_COMPLIANT`,
      qr_code: `${PREFIX}QR_COMPLIANT`,
      certifications: "CAT_797F_CERT,GENERAL_MINE_SAFETY",
    },
  });

  try {
    // -------------------------------------------------------------
    // SUITE 1: Key Custody State Machine & 30s Timeout Countdown
    // -------------------------------------------------------------
    suite("Key Custody State Machine & 30s Timeout Lifecycle");

    await test("Initiate key checkout enters 'AWAITING_OPERATOR_VERIFICATION' with 30s countdown", async () => {
      const session = await initiateKeyCheckout(TEST_KEY_TAG, TEST_GATE_ID, TEST_DEVICE_ID, 30);
      assert(session.state === "AWAITING_OPERATOR_VERIFICATION", `Expected state AWAITING_OPERATOR_VERIFICATION, got ${session.state}`);
      assert(session.keyId === TEST_KEY_TAG, `Expected keyId ${TEST_KEY_TAG}, got ${session.keyId}`);
      assert(session.machineId === TEST_MACHINE_ID, `Expected machineId ${TEST_MACHINE_ID}, got ${session.machineId}`);
      assert(session.requiredCertification === "CAT_797F_CERT", `Expected cert CAT_797F_CERT, got ${session.requiredCertification}`);

      // Verify expiration window calculation (roughly 30s from now)
      const diffMs = session.expiresAtTimestamp - Date.now();
      assert(diffMs > 28000 && diffMs <= 30000, `Expected countdown ~30000ms, got ${diffMs}ms`);

      // Verify session is discoverable by device ID and session ID
      const activeByDevice = getActiveKeySession(TEST_DEVICE_ID);
      assert(activeByDevice !== null && activeByDevice.sessionId === session.sessionId, "Active session should be retrievable by deviceId");
      const activeBySession = getActiveKeySession(session.sessionId);
      assert(activeBySession !== null && activeBySession.sessionId === session.sessionId, "Active session should be retrievable by sessionId");
    });

    await test("Key checkout broadcast push notification sent upon initiation", async () => {
      const lastNotif = capturedNotifications[capturedNotifications.length - 1];
      assert(Boolean(lastNotif), "A notification should have been broadcasted");
      assert(lastNotif.type === "INFO", `Expected INFO notification, got ${lastNotif.type}`);
      assert(lastNotif.targetDeviceId === TEST_DEVICE_ID, `Expected target device ${TEST_DEVICE_ID}, got ${lastNotif.targetDeviceId}`);
      assert(lastNotif.title.includes("KEY SCANNED"), `Title should indicate key scanned, got: ${lastNotif.title}`);
    });

    await test("Re-initiating key checkout cleanly supersedes previous session on device", async () => {
      const session1 = await initiateKeyCheckout(TEST_KEY_TAG, TEST_GATE_ID, TEST_DEVICE_ID, 30);
      const session2 = await initiateKeyCheckout(TEST_KEY_TAG, TEST_GATE_ID, TEST_DEVICE_ID, 30);
      assert(session1.sessionId !== session2.sessionId, "New checkout must produce new session ID");

      const active = getActiveKeySession(TEST_DEVICE_ID);
      assert(active?.sessionId === session2.sessionId, "Active session must be the latest session");
    });

    await test("30s Timeout Expiration denies operator verification after TTL elapsed", async () => {
      // Initiate with 0-second timeout to simulate 30s elapsed
      const expiredSession = await initiateKeyCheckout(TEST_KEY_TAG, TEST_GATE_ID, TEST_DEVICE_ID, 0);
      await new Promise((resolve) => setTimeout(resolve, 15));

      const result = await verifyOperatorForKey(expiredSession.sessionId, compliantOperator.rfid_tag!);
      assert(result.status === "DENIED", `Expected DENIED status after timeout, got ${result.status}`);
      assert(
        Boolean(result.denialReason?.includes("timeout") || result.denialReason?.includes("No active key checkout session")),
        `Expected timeout denial reason, got: ${result.denialReason}`
      );
      // Verify session marked EXPIRED in memory
      const memSession = globalThis.__keyCustodySessions?.get(expiredSession.sessionId);
      assert(memSession?.state === "EXPIRED", `Expected session state EXPIRED in memory, got ${memSession?.state}`);
    });

    // -------------------------------------------------------------
    // SUITE 2: Adversarial Compliance Rejection Engine & Denial Strobe
    // -------------------------------------------------------------
    suite("Adversarial Compliance Rejection Engine & Denial Strobe");

    await test("Uninducted contractor rejection triggers immediate denial strobe alert", async () => {
      const session = await initiateKeyCheckout(TEST_KEY_TAG, TEST_GATE_ID, TEST_DEVICE_ID, 30);
      const initialNotifCount = capturedNotifications.length;

      const result = await verifyOperatorForKey(session.sessionId, uninductedContractor.rfid_tag!);
      assert(result.status === "DENIED", `Expected DENIED for uninducted contractor, got ${result.status}`);
      assert(result.denialReason === "Access Denied: Uninducted Contractor", `Expected exact denial reason, got: ${result.denialReason}`);

      // Verify immediate red denial strobe notification broadcasted
      const denialNotif = capturedNotifications.find(
        (n, idx) => idx >= initialNotifCount && n.type === "ACCESS_DENIED" && n.severity === "danger"
      );
      assert(Boolean(denialNotif), "Denial strobe notification with severity 'danger' must be dispatched");
      assert(denialNotif?.denialReason === "Access Denied: Uninducted Contractor", `Notification must carry exact denial reason: ${denialNotif?.denialReason}`);
      assert(Boolean(denialNotif?.title.includes("DENIED")), `Notification title must indicate DENIED: ${denialNotif?.title}`);

      // Verify audit log in SQLite key_custody_logs
      assert(Boolean(result.logId), "Result must contain logId for custody log entry");
      const log = await prisma.key_custody_logs.findUnique({ where: { id: result.logId } });
      assert(Boolean(log), "Custody log entry must exist in database");
      assert(log?.status === "DENIED", `Log status must be DENIED, got ${log?.status}`);
      assert(log?.action === "CHECKOUT_ATTEMPT", `Log action must be CHECKOUT_ATTEMPT, got ${log?.action}`);
      assert(log?.denial_reason === "Access Denied: Uninducted Contractor", `Log denial_reason must match, got ${log?.denial_reason}`);
    });

    await test("Expired medical certificate rejection triggers immediate denial strobe alert", async () => {
      const session = await initiateKeyCheckout(TEST_KEY_TAG, TEST_GATE_ID, TEST_DEVICE_ID, 30);
      const initialNotifCount = capturedNotifications.length;

      const result = await verifyOperatorForKey(session.sessionId, expiredMedicalOperator.rfid_tag!);
      assert(result.status === "DENIED", `Expected DENIED for expired medical, got ${result.status}`);
      assert(result.denialReason === "Access Denied: Medical Fitness Expired", `Expected exact denial reason, got: ${result.denialReason}`);

      // Verify denial strobe notification
      const denialNotif = capturedNotifications.find(
        (n, idx) => idx >= initialNotifCount && n.type === "ACCESS_DENIED" && n.severity === "danger"
      );
      assert(Boolean(denialNotif), "Denial strobe notification must be broadcasted for expired medical");
      assert(denialNotif?.denialReason === "Access Denied: Medical Fitness Expired", `Notification denial reason mismatch: ${denialNotif?.denialReason}`);

      // Verify database log
      const log = await prisma.key_custody_logs.findUnique({ where: { id: result.logId } });
      assert(log?.status === "DENIED", `Log status must be DENIED, got ${log?.status}`);
      assert(log?.denial_reason === "Access Denied: Medical Fitness Expired", `Log denial_reason mismatch: ${log?.denial_reason}`);
    });

    await test("Expired safety induction rejection triggers immediate denial", async () => {
      const session = await initiateKeyCheckout(TEST_KEY_TAG, TEST_GATE_ID, TEST_DEVICE_ID, 30);

      const result = await verifyOperatorForKey(session.sessionId, expiredInductionOperator.rfid_tag!);
      assert(result.status === "DENIED", `Expected DENIED for expired induction, got ${result.status}`);
      assert(result.denialReason === "Access Denied: Safety Induction Expired", `Expected exact denial reason, got: ${result.denialReason}`);
    });

    await test("Uncertified operator lacking machine certification triggers rejection", async () => {
      const session = await initiateKeyCheckout(TEST_KEY_TAG, TEST_GATE_ID, TEST_DEVICE_ID, 30);

      const result = await verifyOperatorForKey(session.sessionId, uncertifiedOperator.rfid_tag!);
      assert(result.status === "DENIED", `Expected DENIED for uncertified operator, got ${result.status}`);
      assert(
        result.denialReason === "Access Denied: Machine Authorization Required (CAT_797F_CERT)",
        `Expected machine authorization denial reason, got: ${result.denialReason}`
      );
    });

    await test("Unrecognized badge scan triggers rejection with clear refusal reason", async () => {
      const session = await initiateKeyCheckout(TEST_KEY_TAG, TEST_GATE_ID, TEST_DEVICE_ID, 30);

      const result = await verifyOperatorForKey(session.sessionId, "RFID_RANDOM_UNKNOWN_9999");
      assert(result.status === "DENIED", `Expected DENIED for unrecognized badge, got ${result.status}`);
      assert(result.denialReason === "Access Denied: Unrecognized Operator Badge", `Expected unrecognized badge denial reason, got: ${result.denialReason}`);
    });

    // -------------------------------------------------------------
    // SUITE 3: Authorized Compliant Operator Grant & Audit Log
    // -------------------------------------------------------------
    suite("Authorized Compliant Operator Grant & Return Audit Trail");

    await test("Compliant operator granted access with green push notification and audit log", async () => {
      const session = await initiateKeyCheckout(TEST_KEY_TAG, TEST_GATE_ID, TEST_DEVICE_ID, 30);
      const initialNotifCount = capturedNotifications.length;

      const result = await verifyOperatorForKey(session.sessionId, compliantOperator.rfid_tag!);
      assert(result.status === "GRANTED", `Expected GRANTED status, got ${result.status}`);
      assert(result.denialReason === null, `Expected denialReason to be null, got ${result.denialReason}`);
      assert(result.operatorName === "Compliant Operator", `Expected operator name Compliant Operator, got ${result.operatorName}`);
      assert(result.operatorId === compliantOperator.emp_code, `Expected operatorId ${compliantOperator.emp_code}, got ${result.operatorId}`);
      assert(Boolean(result.logId), "Granted checkout must return audit logId");

      // Verify push notification
      const grantedNotif = capturedNotifications.find(
        (n, idx) => idx >= initialNotifCount && n.type === "ACCESS_GRANTED" && n.severity === "success"
      );
      assert(Boolean(grantedNotif), "Green ACCESS_GRANTED notification with severity 'success' must be dispatched");
      assert(Boolean(grantedNotif?.message.includes("checked out to Compliant Operator")), `Notification message mismatch: ${grantedNotif?.message}`);

      // Verify Key database status updated to CHECKED_OUT
      const keyInDb = await prisma.keys.findUnique({ where: { key_tag: TEST_KEY_TAG } });
      assert(keyInDb?.status === "CHECKED_OUT", `Key status in DB must be CHECKED_OUT, got ${keyInDb?.status}`);
      assert(keyInDb?.assigned_operator_id === compliantOperator.id, "Key must be assigned to compliant operator");

      // Verify audit log
      const log = await prisma.key_custody_logs.findUnique({ where: { id: result.logId } });
      assert(log?.status === "GRANTED", `Custody log status must be GRANTED, got ${log?.status}`);
      assert(log?.action === "CHECKOUT", `Custody log action must be CHECKOUT, got ${log?.action}`);
      assert(log?.operator_id === compliantOperator.id, "Custody log operator_id must match compliant operator");
    });

    await test("Return key completes workflow and records RETURN audit log", async () => {
      const returnResult = await returnKey(TEST_KEY_TAG, compliantOperator.rfid_tag!);
      assert(returnResult.success === true, `Return key should return success: true, got ${returnResult.success}`);
      assert(returnResult.status === "IN_KEY_BOX", `Expected status IN_KEY_BOX, got ${returnResult.status}`);

      // Verify key status in database
      const keyInDb = await prisma.keys.findUnique({ where: { key_tag: TEST_KEY_TAG } });
      assert(keyInDb?.status === "IN_KEY_BOX", `Key status in DB must be IN_KEY_BOX, got ${keyInDb?.status}`);
      assert(keyInDb?.assigned_operator_id === null, "Assigned operator must be reset to null");

      // Verify RETURN audit log created
      const returnLog = await prisma.key_custody_logs.findFirst({
        where: { key_id: keyInDb!.id, action: "RETURN" },
        orderBy: { timestamp: "desc" },
      });
      assert(Boolean(returnLog), "Return custody log must be created");
      assert(returnLog?.status === "RETURNED", `Return log status must be RETURNED, got ${returnLog?.status}`);
      assert(returnLog?.operator_id === compliantOperator.id, "Return log must record operator");
    });

    // -------------------------------------------------------------
    // SUITE 4: Live HTTP API End-to-End Key Custody Endpoint Stress
    // -------------------------------------------------------------
    suite("Live HTTP API End-to-End Key Custody Endpoint Stress");

    const API_DEVICE_ID = `${PREFIX}HTTP_DEVICE_01`;
    const API_MACHINE_ID = `${PREFIX}HTTP_FLEET_01`;
    const API_KEY_TAG = `KEY_${API_MACHINE_ID}`;

    // Create a vehicle for the HTTP API test
    await prisma.vehicles.create({
      data: {
        fleet_id: API_MACHINE_ID,
        machine_id: API_MACHINE_ID,
        vehicle_type: "HEAVY_FLEET",
        is_heavy_fleet: true,
        required_certification: "CAT_797F_CERT",
        status: "Active",
      },
    });

    await test("POST /api/scanner/key-custody action: initiate", async () => {
      const res = await fetch(`${BASE_URL}/api/scanner/key-custody`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initiate",
          keyTag: API_KEY_TAG,
          deviceId: API_DEVICE_ID,
          gateLocation: TEST_GATE_ID,
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      assert(data.success === true, `Expected success true, got ${data.success}`);
      assert(data.action === "initiated", `Expected action initiated, got ${data.action}`);
      assert(data.session?.state === "AWAITING_OPERATOR_VERIFICATION", "Expected awaiting verification state");
    });

    await test("GET /api/scanner/key-custody?deviceId= verifies active session presence", async () => {
      const res = await fetch(`${BASE_URL}/api/scanner/key-custody?deviceId=${API_DEVICE_ID}`);
      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      assert(data.hasActiveSession === true, `Expected hasActiveSession true, got ${data.hasActiveSession}`);
      assert(data.activeSession?.keyId === API_KEY_TAG, `Expected keyId ${API_KEY_TAG}, got ${data.activeSession?.keyId}`);
    });

    await test("POST /api/scanner/key-custody action: verify with uninducted contractor", async () => {
      const res = await fetch(`${BASE_URL}/api/scanner/key-custody`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          deviceId: API_DEVICE_ID,
          badgeTag: uninductedContractor.rfid_tag,
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      assert(data.status === "DENIED", `Expected DENIED status, got ${data.status}`);
      assert(data.denialReason === "Access Denied: Uninducted Contractor", `Expected exact refusal reason, got ${data.denialReason}`);
    });

    await test("POST /api/scanner/key-custody action: initiate -> verify with compliant operator -> granted", async () => {
      // Re-initiate session
      await fetch(`${BASE_URL}/api/scanner/key-custody`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initiate",
          keyTag: API_KEY_TAG,
          deviceId: API_DEVICE_ID,
        }),
      });

      const res = await fetch(`${BASE_URL}/api/scanner/key-custody`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          deviceId: API_DEVICE_ID,
          badgeTag: compliantOperator.rfid_tag,
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      assert(data.status === "GRANTED", `Expected GRANTED status, got ${data.status}`);
      assert(data.denialReason === null, `Expected null denialReason, got ${data.denialReason}`);
      assert(data.operatorName === "Compliant Operator", `Operator mismatch: ${data.operatorName}`);
    });

    await test("POST /api/scanner/key-custody action: return", async () => {
      const res = await fetch(`${BASE_URL}/api/scanner/key-custody`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "return",
          keyTag: API_KEY_TAG,
          badgeTag: compliantOperator.rfid_tag,
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      assert(data.success === true, `Expected success true, got ${data.success}`);
      assert(data.status === "IN_KEY_BOX", `Expected status IN_KEY_BOX, got ${data.status}`);
    });

    await test("GET /api/scanner/key-custody?history=true returns logged custody events", async () => {
      const res = await fetch(`${BASE_URL}/api/scanner/key-custody?history=true`);
      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      assert(data.success === true, `Expected success true, got ${data.success}`);
      assert(Array.isArray(data.logs) && data.logs.length > 0, "Expected array of custody logs");
    });

  } finally {
    unsubscribe();

    // -------------------------------------------------------------
    // SUITE 5: Zero DB Pollution Oracle & Pristine State Restoration
    // -------------------------------------------------------------
    suite("Zero DB Pollution Oracle & Pristine State Restoration");

    await test("Purge all challenger test artifacts from SQLite", async () => {
      console.log("  Cleaning up challenger test entities from database...");

      // 1. Delete custody logs associated with test keys or test operators
      await prisma.key_custody_logs.deleteMany({
        where: {
          OR: [
            { key: { key_tag: { contains: PREFIX } } },
            { operator: { emp_code: { startsWith: PREFIX } } },
          ],
        },
      });

      // 2. Delete test keys
      await prisma.keys.deleteMany({
        where: {
          OR: [
            { key_tag: { contains: PREFIX } },
            { machine_id: { contains: PREFIX } },
          ],
        },
      });

      // 3. Delete test vehicles
      await prisma.vehicles.deleteMany({
        where: {
          OR: [
            { fleet_id: { startsWith: PREFIX } },
            { machine_id: { startsWith: PREFIX } },
          ],
        },
      });

      // 4. Delete test employees
      await prisma.employees.deleteMany({
        where: { emp_code: { startsWith: PREFIX } },
      });

      // 5. Delete test notifications generated during test
      await prisma.notifications.deleteMany({
        where: {
          OR: [
            { message: { contains: PREFIX } },
            { message: { contains: "Uninducted" } },
            { message: { contains: "Compliant Operator" } },
            { message: { contains: "Expired Medical" } },
          ],
        },
      });

      // In-memory session cleanup
      if (globalThis.__keyCustodySessions) {
        for (const [id, s] of globalThis.__keyCustodySessions.entries()) {
          if (s.keyId.includes(PREFIX) || s.deviceId.includes(PREFIX) || s.machineId.includes(PREFIX)) {
            globalThis.__keyCustodySessions.delete(id);
          }
        }
      }
    });

    await test("Oracle assertion: Database row counts perfectly match pristine baseline", async () => {
      const finalEmployees = await prisma.employees.count();
      const finalVehicles = await prisma.vehicles.count();
      const finalKeys = await prisma.keys.count();
      const finalLogs = await prisma.key_custody_logs.count();

      console.log(`  [Final State]    Employees: ${finalEmployees}, Vehicles: ${finalVehicles}, Keys: ${finalKeys}, Custody Logs: ${finalLogs}`);

      assert(finalEmployees === baselineEmployees, `Employees count mismatch: expected ${baselineEmployees}, got ${finalEmployees}`);
      assert(finalVehicles === baselineVehicles, `Vehicles count mismatch: expected ${baselineVehicles}, got ${finalVehicles}`);
      assert(finalKeys === baselineKeys, `Keys count mismatch: expected ${baselineKeys}, got ${finalKeys}`);
      assert(finalLogs === baselineLogs, `Custody Logs count mismatch: expected ${baselineLogs}, got ${finalLogs}`);
    });
  }

  // Summary
  const total = reports.length;
  const passed = reports.filter((r) => r.passed).length;
  const failed = reports.filter((r) => !r.passed).length;

  console.log("\n==================================================================");
  console.log(" 📊 CHALLENGER GATE 2 STRESS HARNESS SUMMARY");
  console.log("==================================================================");
  console.log(` Total Assertions: ${total}`);
  console.log(` Passed:           ${passed}`);
  console.log(` Failed:           ${failed}`);
  console.log(` Pass Rate:        ${((passed / total) * 100).toFixed(1)}%`);
  console.log("==================================================================");

  if (failed > 0) {
    console.error(`\n❌ CHALLENGER FAILED: ${failed} assertion(s) failed.`);
    process.exit(1);
  } else {
    console.log(`\n✅ ALL ${passed} EMPIRICAL CHALLENGER ASSERTIONS PASSED (100%).`);
  }
}

main()
  .catch((err) => {
    console.error("Fatal stress test runner error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
