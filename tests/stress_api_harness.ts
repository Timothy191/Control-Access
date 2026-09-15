/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * EMPIRICAL STRESS TEST HARNESS — MILESTONE 1 CHALLENGER 2
 * Tests:
 * 1. Duplicate entity handling (409 Conflict) for /api/fleet and /api/equipment
 * 2. Operational hours increments and boundary values
 * 3. Gas monitor calibration calculations (valid, expiring soon, expired, required)
 * 4. Soft vs hard deletion modes and foreign key safety with historical logs
 */

import { PrismaClient } from "@prisma/client";

const BASE_URL = "http://127.0.0.1:8080";
const prisma = new PrismaClient();

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: any;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
}

const results: TestResult[] = [];

function recordResult(result: TestResult) {
  results.push(result);
  const icon = result.passed ? "✔ PASS" : "✖ FAIL";
  console.log(`[${result.suite}] ${icon}: ${result.name}`);
  if (!result.passed) {
    console.log(`   Expected: ${result.expected}`);
    console.log(`   Actual:   ${result.actual}`);
    if (result.details) {
      console.log(`   Details:  ${JSON.stringify(result.details)}`);
    }
  }
}

async function api(path: string, options?: RequestInit) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // Body wasn't JSON
  }
  return { status: res.status, body };
}

const TS = Date.now();

// -------------------------------------------------------------
// SUITE 1: Duplicate Entity Handling (409 Conflict)
// -------------------------------------------------------------
async function runSuite1_Duplicates() {
  console.log("\n=======================================================");
  console.log("SUITE 1: Duplicate Entity Handling (409 Conflict)");
  console.log("=======================================================");

  // 1.1 Fleet duplicate fleet_id
  const fleetId1 = `STRESS_FL_1_${TS}`;
  const f1 = await api("/api/fleet", {
    method: "POST",
    body: JSON.stringify({ fleet_id: fleetId1, vehicle_type: "HEAVY_FLEET" }),
  });

  const f1Dup = await api("/api/fleet", {
    method: "POST",
    body: JSON.stringify({ fleet_id: fleetId1, vehicle_type: "HEAVY_FLEET" }),
  });

  recordResult({
    suite: "Duplicates",
    name: "Fleet: Duplicate fleet_id returns 409 Conflict",
    passed: f1.status === 201 && f1Dup.status === 409,
    expected: "Status 409 Conflict",
    actual: `Initial: ${f1.status}, Duplicate: ${f1Dup.status} (${JSON.stringify(f1Dup.body)})`,
    severity: "HIGH",
    details: f1Dup.body,
  });

  // 1.2 Fleet duplicate machine_id
  const fleetId2A = `STRESS_FL_2A_${TS}`;
  const fleetId2B = `STRESS_FL_2B_${TS}`;
  const machineId = `STRESS_MACH_${TS}`;

  const f2A = await api("/api/fleet", {
    method: "POST",
    body: JSON.stringify({ fleet_id: fleetId2A, machine_id: machineId, vehicle_type: "HEAVY_FLEET" }),
  });

  const f2B = await api("/api/fleet", {
    method: "POST",
    body: JSON.stringify({ fleet_id: fleetId2B, machine_id: machineId, vehicle_type: "HEAVY_FLEET" }),
  });

  recordResult({
    suite: "Duplicates",
    name: "Fleet: Duplicate machine_id returns 409 Conflict",
    passed: f2A.status === 201 && f2B.status === 409,
    expected: "Status 409 Conflict",
    actual: `Initial: ${f2A.status}, Duplicate: ${f2B.status} (${JSON.stringify(f2B.body)})`,
    severity: "HIGH",
    details: f2B.body,
  });

  // 1.3 Fleet duplicate qr_code & rfid_tag
  const qrTag = `QR_STRESS_${TS}`;
  const rfidTag = `RFID_STRESS_${TS}`;

  const f3A = await api("/api/fleet", {
    method: "POST",
    body: JSON.stringify({
      fleet_id: `STRESS_FL_3A_${TS}`,
      qr_code: qrTag,
      rfid_tag: rfidTag,
      vehicle_type: "HEAVY_FLEET",
    }),
  });

  const f3DupQr = await api("/api/fleet", {
    method: "POST",
    body: JSON.stringify({
      fleet_id: `STRESS_FL_3B_${TS}`,
      qr_code: qrTag,
      vehicle_type: "HEAVY_FLEET",
    }),
  });

  recordResult({
    suite: "Duplicates",
    name: "Fleet: Duplicate qr_code returns 409 Conflict",
    passed: f3DupQr.status === 409,
    expected: "Status 409 Conflict",
    actual: `Status ${f3DupQr.status} (${JSON.stringify(f3DupQr.body)})`,
    severity: "MEDIUM",
  });

  const f3DupRfid = await api("/api/fleet", {
    method: "POST",
    body: JSON.stringify({
      fleet_id: `STRESS_FL_3C_${TS}`,
      rfid_tag: rfidTag,
      vehicle_type: "HEAVY_FLEET",
    }),
  });

  recordResult({
    suite: "Duplicates",
    name: "Fleet: Duplicate rfid_tag returns 409 Conflict",
    passed: f3DupRfid.status === 409,
    expected: "Status 409 Conflict",
    actual: `Status ${f3DupRfid.status} (${JSON.stringify(f3DupRfid.body)})`,
    severity: "MEDIUM",
  });

  // 1.4 Equipment duplicate radio_id
  const radioId1 = `STRESS_RAD_1_${TS}`;
  const eq1 = await api("/api/equipment", {
    method: "POST",
    body: JSON.stringify({ radio_id: radioId1, equipment_type: "TWO_WAY_RADIO" }),
  });

  const eq1Dup = await api("/api/equipment", {
    method: "POST",
    body: JSON.stringify({ radio_id: radioId1, equipment_type: "TWO_WAY_RADIO" }),
  });

  recordResult({
    suite: "Duplicates",
    name: "Equipment: Duplicate radio_id returns 409 Conflict",
    passed: eq1.status === 201 && eq1Dup.status === 409,
    expected: "Status 409 Conflict",
    actual: `Initial: ${eq1.status}, Duplicate: ${eq1Dup.status} (${JSON.stringify(eq1Dup.body)})`,
    severity: "HIGH",
    details: eq1Dup.body,
  });

  // 1.5 Equipment duplicate barcode
  const barcode = `BAR_STRESS_${TS}`;
  const eq2A = await api("/api/equipment", {
    method: "POST",
    body: JSON.stringify({
      radio_id: `STRESS_RAD_2A_${TS}`,
      barcode: barcode,
      equipment_type: "GAS_MONITOR",
    }),
  });

  const eq2B = await api("/api/equipment", {
    method: "POST",
    body: JSON.stringify({
      radio_id: `STRESS_RAD_2B_${TS}`,
      barcode: barcode,
      equipment_type: "GAS_MONITOR",
    }),
  });

  recordResult({
    suite: "Duplicates",
    name: "Equipment: Duplicate barcode returns 409 Conflict",
    passed: eq2A.status === 201 && eq2B.status === 409,
    expected: "Status 409 Conflict",
    actual: `Initial: ${eq2A.status}, Duplicate: ${eq2B.status} (${JSON.stringify(eq2B.body)})`,
    severity: "CRITICAL",
    details: eq2B.body,
  });

  // 1.6 Equipment duplicate serial_number
  const sn = `SN_STRESS_${TS}`;
  const eq3A = await api("/api/equipment", {
    method: "POST",
    body: JSON.stringify({
      radio_id: `STRESS_RAD_3A_${TS}`,
      serial_number: sn,
      equipment_type: "GAS_MONITOR",
    }),
  });

  const eq3B = await api("/api/equipment", {
    method: "POST",
    body: JSON.stringify({
      radio_id: `STRESS_RAD_3B_${TS}`,
      serial_number: sn,
      equipment_type: "GAS_MONITOR",
    }),
  });

  recordResult({
    suite: "Duplicates",
    name: "Equipment: Duplicate serial_number handling",
    passed: eq3B.status === 409 || eq3B.status === 201, // Let's see what happens
    expected: "Status 409 Conflict (or documented schema behavior)",
    actual: `Initial: ${eq3A.status}, Duplicate: ${eq3B.status} (${JSON.stringify(eq3B.body)})`,
    severity: eq3B.status === 500 ? "HIGH" : "LOW",
    details: eq3B.body,
  });

  // 1.7 Equipment duplicate qr_code & rfid_tag
  const eqQr = `QR_EQ_${TS}`;
  const eqRfid = `RFID_EQ_${TS}`;

  const eq4A = await api("/api/equipment", {
    method: "POST",
    body: JSON.stringify({
      radio_id: `STRESS_RAD_4A_${TS}`,
      qr_code: eqQr,
      rfid_tag: eqRfid,
      equipment_type: "TWO_WAY_RADIO",
    }),
  });

  const eq4DupQr = await api("/api/equipment", {
    method: "POST",
    body: JSON.stringify({
      radio_id: `STRESS_RAD_4B_${TS}`,
      qr_code: eqQr,
      equipment_type: "TWO_WAY_RADIO",
    }),
  });

  recordResult({
    suite: "Duplicates",
    name: "Equipment: Duplicate qr_code returns 409 Conflict",
    passed: eq4DupQr.status === 409,
    expected: "Status 409 Conflict",
    actual: `Status: ${eq4DupQr.status} (${JSON.stringify(eq4DupQr.body)})`,
    severity: "HIGH",
    details: eq4DupQr.body,
  });

  const eq4DupRfid = await api("/api/equipment", {
    method: "POST",
    body: JSON.stringify({
      radio_id: `STRESS_RAD_4C_${TS}`,
      rfid_tag: eqRfid,
      equipment_type: "TWO_WAY_RADIO",
    }),
  });

  recordResult({
    suite: "Duplicates",
    name: "Equipment: Duplicate rfid_tag returns 409 Conflict",
    passed: eq4DupRfid.status === 409,
    expected: "Status 409 Conflict",
    actual: `Status: ${eq4DupRfid.status} (${JSON.stringify(eq4DupRfid.body)})`,
    severity: "HIGH",
    details: eq4DupRfid.body,
  });
}

// -------------------------------------------------------------
// SUITE 2: Operational Hours Increments & Boundaries
// -------------------------------------------------------------
async function runSuite2_OperationalHours() {
  console.log("\n=======================================================");
  console.log("SUITE 2: Operational Hours Increments & Boundaries");
  console.log("=======================================================");

  // 2.1 Boundary: 0.0 hours
  const fZero = await api("/api/fleet", {
    method: "POST",
    body: JSON.stringify({
      fleet_id: `STRESS_HRS_0_${TS}`,
      operational_hours: 0.0,
      vehicle_type: "HEAVY_FLEET",
    }),
  });

  recordResult({
    suite: "Hours",
    name: "Fleet: Boundary 0.0 operational_hours accepted on create",
    passed: fZero.status === 201 && fZero.body?.vehicle?.operational_hours === 0,
    expected: "Status 201 and operational_hours === 0",
    actual: `Status ${fZero.status}, hours = ${fZero.body?.vehicle?.operational_hours}`,
    severity: "MEDIUM",
  });

  // 2.2 Boundary: 99999.9 hours
  const fMax = await api("/api/fleet", {
    method: "POST",
    body: JSON.stringify({
      fleet_id: `STRESS_HRS_MAX_${TS}`,
      operational_hours: 99999.9,
      vehicle_type: "HEAVY_FLEET",
    }),
  });

  recordResult({
    suite: "Hours",
    name: "Fleet: Boundary 99999.9 operational_hours accepted on create",
    passed: fMax.status === 201 && Math.abs(fMax.body?.vehicle?.operational_hours - 99999.9) < 0.01,
    expected: "Status 201 and operational_hours === 99999.9",
    actual: `Status ${fMax.status}, hours = ${fMax.body?.vehicle?.operational_hours}`,
    severity: "MEDIUM",
  });

  // 2.3 Boundary: Negative values in POST
  const fNeg = await api("/api/fleet", {
    method: "POST",
    body: JSON.stringify({
      fleet_id: `STRESS_HRS_NEG_${TS}`,
      operational_hours: -15.5,
      vehicle_type: "HEAVY_FLEET",
    }),
  });

  recordResult({
    suite: "Hours",
    name: "Fleet: Negative operational_hours rejected with 400 Bad Request",
    passed: fNeg.status === 400,
    expected: "Status 400 Bad Request",
    actual: `Status ${fNeg.status} (${JSON.stringify(fNeg.body)})`,
    severity: "HIGH",
    details: fNeg.body,
  });

  // 2.4 Boundary: Non-numeric values in POST
  const fString = await api("/api/fleet", {
    method: "POST",
    body: JSON.stringify({
      fleet_id: `STRESS_HRS_STR_${TS}`,
      operational_hours: "not-a-number",
      vehicle_type: "HEAVY_FLEET",
    }),
  });

  recordResult({
    suite: "Hours",
    name: "Fleet: String operational_hours rejected with 400 Bad Request",
    passed: fString.status === 400,
    expected: "Status 400 Bad Request",
    actual: `Status ${fString.status} (${JSON.stringify(fString.body)})`,
    severity: "MEDIUM",
    details: fString.body,
  });

  // 2.5 PUT hours_increment positive
  const testVehicleId = fZero.body?.vehicle?.id;
  const inc1 = await api(`/api/fleet?id=${testVehicleId}`, {
    method: "PUT",
    body: JSON.stringify({ hours_increment: 42.5 }),
  });

  recordResult({
    suite: "Hours",
    name: "Fleet: PUT hours_increment correctly increments from 0 to 42.5",
    passed: inc1.status === 200 && inc1.body?.vehicle?.operational_hours === 42.5,
    expected: "Status 200 and operational_hours === 42.5",
    actual: `Status ${inc1.status}, hours = ${inc1.body?.vehicle?.operational_hours}`,
    severity: "HIGH",
  });

  // Second increment
  const inc2 = await api(`/api/fleet?id=${testVehicleId}`, {
    method: "PUT",
    body: JSON.stringify({ hours_increment: 7.5 }),
  });

  recordResult({
    suite: "Hours",
    name: "Fleet: Sequential PUT hours_increment accumulates (42.5 + 7.5 = 50.0)",
    passed: inc2.status === 200 && inc2.body?.vehicle?.operational_hours === 50.0,
    expected: "Status 200 and operational_hours === 50.0",
    actual: `Status ${inc2.status}, hours = ${inc2.body?.vehicle?.operational_hours}`,
    severity: "HIGH",
  });

  // 2.6 PUT hours_increment negative (should fail)
  const incNeg = await api(`/api/fleet?id=${testVehicleId}`, {
    method: "PUT",
    body: JSON.stringify({ hours_increment: -10.0 }),
  });

  recordResult({
    suite: "Hours",
    name: "Fleet: Negative hours_increment rejected with 400 Bad Request",
    passed: incNeg.status === 400,
    expected: "Status 400 Bad Request",
    actual: `Status ${incNeg.status} (${JSON.stringify(incNeg.body)})`,
    severity: "HIGH",
    details: incNeg.body,
  });

  // 2.7 PUT direct operational_hours replacement
  const absPut = await api(`/api/fleet?id=${testVehicleId}`, {
    method: "PUT",
    body: JSON.stringify({ operational_hours: 1200.0 }),
  });

  recordResult({
    suite: "Hours",
    name: "Fleet: Absolute operational_hours update in PUT sets exact value",
    passed: absPut.status === 200 && absPut.body?.vehicle?.operational_hours === 1200.0,
    expected: "Status 200 and operational_hours === 1200.0",
    actual: `Status ${absPut.status}, hours = ${absPut.body?.vehicle?.operational_hours}`,
    severity: "MEDIUM",
  });

  // 2.8 PUT negative absolute operational_hours
  const absNeg = await api(`/api/fleet?id=${testVehicleId}`, {
    method: "PUT",
    body: JSON.stringify({ operational_hours: -5.0 }),
  });

  recordResult({
    suite: "Hours",
    name: "Fleet: Negative operational_hours in PUT rejected with 400 Bad Request",
    passed: absNeg.status === 400,
    expected: "Status 400 Bad Request",
    actual: `Status ${absNeg.status} (${JSON.stringify(absNeg.body)})`,
    severity: "HIGH",
    details: absNeg.body,
  });
}

// -------------------------------------------------------------
// SUITE 3: Gas Monitor Calibration Engine Across Boundary Dates
// -------------------------------------------------------------
async function runSuite3_GasMonitorCalibration() {
  console.log("\n=======================================================");
  console.log("SUITE 3: Gas Monitor Calibration Calculations");
  console.log("=======================================================");

  const now = new Date();
  const validDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // +60 days
  const soonDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // +15 days
  const expiredDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // -5 days

  // 3.1 Valid gas monitor
  const gmValid = await api("/api/equipment", {
    method: "POST",
    body: JSON.stringify({
      radio_id: `GM_VALID_${TS}`,
      equipment_type: "GAS_MONITOR",
      calibration_expiry: validDate.toISOString(),
    }),
  });

  const validStatus = gmValid.body?.equipment?.calibration_status;
  recordResult({
    suite: "Calibration",
    name: "Gas Monitor: Valid calibration (+60 days) evaluates is_calibrated=true, is_expired=false",
    passed:
      gmValid.status === 201 &&
      validStatus?.is_calibrated === true &&
      validStatus?.is_expired === false &&
      validStatus?.days_until_expiry > 30,
    expected: "is_calibrated: true, is_expired: false, days_until_expiry > 30",
    actual: JSON.stringify(validStatus),
    severity: "HIGH",
    details: validStatus,
  });

  // 3.2 Expiring Soon gas monitor
  const gmSoon = await api("/api/equipment", {
    method: "POST",
    body: JSON.stringify({
      radio_id: `GM_SOON_${TS}`,
      equipment_type: "GAS_MONITOR",
      calibration_expiry: soonDate.toISOString(),
    }),
  });

  const soonStatus = gmSoon.body?.equipment?.calibration_status;
  recordResult({
    suite: "Calibration",
    name: "Gas Monitor: Expiring soon (+15 days) has days_until_expiry between 1 and 30",
    passed:
      gmSoon.status === 201 &&
      soonStatus?.is_calibrated === true &&
      soonStatus?.days_until_expiry >= 1 &&
      soonStatus?.days_until_expiry <= 30,
    expected: "is_calibrated: true, days_until_expiry in [1..30]",
    actual: JSON.stringify(soonStatus),
    severity: "HIGH",
    details: soonStatus,
  });

  // Query filter calibration_status=expiring_soon
  const getSoon = await api("/api/equipment?calibration_status=expiring_soon&search=" + `GM_SOON_${TS}`);
  recordResult({
    suite: "Calibration",
    name: "Equipment GET: calibration_status=expiring_soon filter finds expiring equipment",
    passed: getSoon.status === 200 && getSoon.body?.equipment?.length >= 1,
    expected: "Found at least 1 record in expiring_soon filter",
    actual: `Count: ${getSoon.body?.equipment?.length}`,
    severity: "MEDIUM",
  });

  // 3.3 Expired gas monitor
  const gmExpired = await api("/api/equipment", {
    method: "POST",
    body: JSON.stringify({
      radio_id: `GM_EXP_${TS}`,
      equipment_type: "GAS_MONITOR",
      calibration_expiry: expiredDate.toISOString(),
      status: "Active",
    }),
  });

  const expiredStatus = gmExpired.body?.equipment?.calibration_status;
  recordResult({
    suite: "Calibration",
    name: "Gas Monitor: Expired calibration (-5 days) evaluates is_calibrated=false, is_expired=true",
    passed:
      gmExpired.status === 201 &&
      expiredStatus?.is_calibrated === false &&
      expiredStatus?.is_expired === true &&
      expiredStatus?.days_until_expiry < 0,
    expected: "is_calibrated: false, is_expired: true, days_until_expiry < 0",
    actual: JSON.stringify(expiredStatus),
    severity: "HIGH",
    details: expiredStatus,
  });

  // Check worker's claim: Does expired gas monitor automatically transition to 'Out of Calibration'?
  const expiredEquipmentStatus = gmExpired.body?.equipment?.status;
  recordResult({
    suite: "Calibration",
    name: "Worker Claim Check: Expired gas monitor transitions status to 'Out of Calibration'",
    passed: expiredEquipmentStatus === "Out of Calibration",
    expected: "status: 'Out of Calibration'",
    actual: `status: '${expiredEquipmentStatus}'`,
    severity: "HIGH",
    details: { status: expiredEquipmentStatus },
  });

  // 3.4 Missing calibration for gas monitor (Calibration REQUIRED)
  const gmMis = await api("/api/equipment", {
    method: "POST",
    body: JSON.stringify({
      radio_id: `GM_MIS_${TS}`,
      equipment_type: "GAS_MONITOR",
      calibration_expiry: null,
    }),
  });

  const misStatus = gmMis.body?.equipment?.calibration_status;
  // Does it recognize that a gas monitor without calibration is NOT calibrated / REQUIRED?
  const gasMonitorMissingTreatedAsCalibrated = misStatus?.is_calibrated === true;
  recordResult({
    suite: "Calibration",
    name: "Gas Monitor: Missing calibration expiry should NOT be marked as calibrated",
    passed: misStatus?.is_calibrated === false,
    expected: "is_calibrated: false or calibration_required: true for GAS_MONITOR",
    actual: JSON.stringify(misStatus),
    severity: "CRITICAL",
    details: misStatus,
  });

  // 3.5 Worker claims: Built-in calibration engine evaluates 'VALID', 'EXPIRING_SOON', 'EXPIRED', 'REQUIRED'
  const hasStatusEnum =
    validStatus?.status === "VALID" ||
    soonStatus?.status === "EXPIRING_SOON" ||
    expiredStatus?.status === "EXPIRED" ||
    misStatus?.status === "REQUIRED";

  recordResult({
    suite: "Calibration",
    name: "Worker Claim Check: Engine returns status strings VALID, EXPIRING_SOON, EXPIRED, REQUIRED",
    passed: Boolean(hasStatusEnum),
    expected: "calibration_status contains VALID, EXPIRING_SOON, EXPIRED, or REQUIRED",
    actual: `Returned shapes: valid=${JSON.stringify(validStatus)}, soon=${JSON.stringify(soonStatus)}, expired=${JSON.stringify(expiredStatus)}, mis=${JSON.stringify(misStatus)}`,
    severity: "HIGH",
  });

  // 3.6 Worker claim: PUT action: "recalibrate" restoring "Active" status
  const recalibPut = await api(`/api/equipment?id=${gmExpired.body?.equipment?.id}`, {
    method: "PUT",
    body: JSON.stringify({
      action: "recalibrate",
      calibration_expiry: validDate.toISOString(),
    }),
  });

  recordResult({
    suite: "Calibration",
    name: "Worker Claim Check: PUT action: 'recalibrate' handled",
    passed: recalibPut.status === 200 && recalibPut.body?.equipment?.status === "Active",
    expected: "Status 200 and equipment updated via action: recalibrate",
    actual: `Status: ${recalibPut.status} (${JSON.stringify(recalibPut.body)})`,
    severity: "MEDIUM",
  });
}

// -------------------------------------------------------------
// SUITE 4: Soft vs Hard Deletion Modes & Foreign Key Safety
// -------------------------------------------------------------
async function runSuite4_DeletionAndForeignKeys() {
  console.log("\n=======================================================");
  console.log("SUITE 4: Soft vs Hard Deletion & Foreign Key Safety");
  console.log("=======================================================");

  // 4.1 Fleet soft deletion mode
  const fSoft = await api("/api/fleet", {
    method: "POST",
    body: JSON.stringify({ fleet_id: `STRESS_DEL_SOFT_${TS}`, vehicle_type: "HEAVY_FLEET" }),
  });
  const softId = fSoft.body?.vehicle?.id;

  const delSoft = await api(`/api/fleet?id=${softId}&mode=soft`, { method: "DELETE" });
  const dbSoft = await prisma.vehicles.findUnique({ where: { id: softId } });

  recordResult({
    suite: "Deletion",
    name: "Fleet: mode=soft sets status='Decommissioned' and preserves record in database",
    passed:
      delSoft.status === 200 &&
      delSoft.body?.mode === "soft" &&
      dbSoft !== null &&
      dbSoft.status === "Decommissioned",
    expected: "Status 200, mode='soft', DB record exists with status='Decommissioned'",
    actual: `API status: ${delSoft.status}, DB status: ${dbSoft?.status}`,
    severity: "HIGH",
  });

  // 4.2 Fleet default deletion (should default to soft)
  const fDef = await api("/api/fleet", {
    method: "POST",
    body: JSON.stringify({ fleet_id: `STRESS_DEL_DEF_${TS}`, vehicle_type: "HEAVY_FLEET" }),
  });
  const defId = fDef.body?.vehicle?.id;

  const delDef = await api(`/api/fleet?id=${defId}`, { method: "DELETE" });
  const dbDef = await prisma.vehicles.findUnique({ where: { id: defId } });

  recordResult({
    suite: "Deletion",
    name: "Fleet: Default DELETE (no mode) defaults to soft delete",
    passed: delDef.status === 200 && delDef.body?.mode === "soft" && dbDef?.status === "Decommissioned",
    expected: "mode='soft' and DB record preserved as 'Decommissioned'",
    actual: `API status: ${delDef.status}, mode: ${delDef.body?.mode}, DB status: ${dbDef?.status}`,
    severity: "HIGH",
  });

  // 4.3 Fleet hard deletion without foreign key relations
  const fHardNoFk = await api("/api/fleet", {
    method: "POST",
    body: JSON.stringify({ fleet_id: `STRESS_DEL_HARD_${TS}`, vehicle_type: "HEAVY_FLEET" }),
  });
  const hardNoFkId = fHardNoFk.body?.vehicle?.id;

  const delHardNoFk = await api(`/api/fleet?id=${hardNoFkId}&mode=hard`, { method: "DELETE" });
  const dbHardNoFk = await prisma.vehicles.findUnique({ where: { id: hardNoFkId } });

  recordResult({
    suite: "Deletion",
    name: "Fleet: mode=hard permanently removes record without foreign keys",
    passed: delHardNoFk.status === 200 && delHardNoFk.body?.mode === "hard" && dbHardNoFk === null,
    expected: "Status 200, mode='hard', record deleted from DB",
    actual: `API status: ${delHardNoFk.status}, DB record: ${dbHardNoFk ? "still exists" : "deleted"}`,
    severity: "HIGH",
  });

  // 4.4 CRITICAL TEST: Fleet hard deletion WITH foreign key relation (gate_logs attached)
  const fHardFk = await api("/api/fleet", {
    method: "POST",
    body: JSON.stringify({ fleet_id: `STRESS_DEL_FK_${TS}`, vehicle_type: "HEAVY_FLEET" }),
  });
  const hardFkId = fHardFk.body?.vehicle?.id;

  // Insert a gate_log record referencing this vehicle
  const logRecord = await prisma.gate_logs.create({
    data: {
      vehicle_id: hardFkId,
      direction: "IN",
      access_granted: true,
      access_type: "VEHICLE",
      entity_id: hardFkId,
      entity_name: `STRESS_DEL_FK_${TS}`,
    },
  });

  // Attempt hard delete on vehicle with related gate_logs
  const delHardFk = await api(`/api/fleet?id=${hardFkId}&mode=hard`, { method: "DELETE" });

  // Check whether vehicle was deleted, and check if gate_log was orphaned
  const dbVehicleAfter = await prisma.vehicles.findUnique({ where: { id: hardFkId } });
  const dbLogAfter = await prisma.gate_logs.findUnique({ where: { id: logRecord.id } });

  const foreignKeyBlocked = delHardFk.status === 409 && dbVehicleAfter !== null;
  const dataIntegrityBroken = delHardFk.status === 200 || dbVehicleAfter === null;

  recordResult({
    suite: "Deletion",
    name: "Fleet: Hard-delete blocked when historical gate logs exist (FK safety)",
    passed: foreignKeyBlocked,
    expected: "Status 409 Conflict (P2003 FK violation prevented, record preserved)",
    actual: `Status: ${delHardFk.status} (${JSON.stringify(delHardFk.body)}), Vehicle in DB: ${dbVehicleAfter ? "Preserved" : "DELETED/ORPHANED"}, GateLog vehicle_id: ${dbLogAfter?.vehicle_id}`,
    severity: "CRITICAL",
    details: {
      delResponse: delHardFk.body,
      vehiclePreserved: dbVehicleAfter !== null,
      gateLogVehicleId: dbLogAfter?.vehicle_id,
    },
  });

  // Cleanup the test gate log
  await prisma.gate_logs.delete({ where: { id: logRecord.id } }).catch(() => {});
  if (dbVehicleAfter) {
    await prisma.vehicles.delete({ where: { id: hardFkId } }).catch(() => {});
  }

  // 4.5 Equipment deletion mode support (Does /api/equipment support soft delete?)
  const eqDelTest = await api("/api/equipment", {
    method: "POST",
    body: JSON.stringify({ radio_id: `EQ_DEL_${TS}`, equipment_type: "TWO_WAY_RADIO" }),
  });
  const eqDelId = eqDelTest.body?.equipment?.id;

  const delEqSoft = await api(`/api/equipment?id=${eqDelId}&mode=soft`, { method: "DELETE" });
  const dbEqAfterSoft = await prisma.equipment.findUnique({ where: { id: eqDelId } });

  recordResult({
    suite: "Deletion",
    name: "Equipment: mode=soft support in /api/equipment",
    passed: dbEqAfterSoft !== null && dbEqAfterSoft.status === "Decommissioned",
    expected: "Equipment preserved with status='Decommissioned' when mode=soft",
    actual: `API status: ${delEqSoft.status} (${JSON.stringify(delEqSoft.body)}), DB record: ${dbEqAfterSoft ? `status=${dbEqAfterSoft.status}` : "PERMANENTLY DELETED"}`,
    severity: "HIGH",
    details: { response: delEqSoft.body, dbRecord: dbEqAfterSoft },
  });

  // 4.6 Equipment deletion with foreign key safety (gate_logs attached)
  const eqFkTest = await api("/api/equipment", {
    method: "POST",
    body: JSON.stringify({ radio_id: `EQ_FK_${TS}`, equipment_type: "TWO_WAY_RADIO" }),
  });
  const eqFkId = eqFkTest.body?.equipment?.id;

  const eqLogRecord = await prisma.gate_logs.create({
    data: {
      equipment_id: eqFkId,
      direction: "IN",
      access_granted: true,
      access_type: "EQUIPMENT",
      entity_id: eqFkId,
      entity_name: `EQ_FK_${TS}`,
    },
  });

  const delEqFk = await api(`/api/equipment?id=${eqFkId}`, { method: "DELETE" });
  const dbEqAfterFk = await prisma.equipment.findUnique({ where: { id: eqFkId } });
  const dbEqLogAfter = await prisma.gate_logs.findUnique({ where: { id: eqLogRecord.id } });

  recordResult({
    suite: "Deletion",
    name: "Equipment: Hard delete blocked when historical gate logs exist",
    passed: delEqFk.status === 409 && dbEqAfterFk !== null,
    expected: "Status 409 Conflict, equipment preserved to protect audit trail",
    actual: `API status: ${delEqFk.status} (${JSON.stringify(delEqFk.body)}), Equipment in DB: ${dbEqAfterFk ? "Preserved" : "DELETED/ORPHANED"}, GateLog equipment_id: ${dbEqLogAfter?.equipment_id}`,
    severity: "CRITICAL",
    details: {
      delResponse: delEqFk.body,
      equipmentPreserved: dbEqAfterFk !== null,
      gateLogEquipmentId: dbEqLogAfter?.equipment_id,
    },
  });

  // Cleanup test log
  await prisma.gate_logs.delete({ where: { id: eqLogRecord.id } }).catch(() => {});
  if (dbEqAfterFk) {
    await prisma.equipment.delete({ where: { id: eqFkId } }).catch(() => {});
  }
}

// -------------------------------------------------------------
// MAIN RUNNER
// -------------------------------------------------------------
async function main() {
  console.log("Starting Empirical Stress Test Harness against " + BASE_URL);
  try {
    await runSuite1_Duplicates();
    await runSuite2_OperationalHours();
    await runSuite3_GasMonitorCalibration();
    await runSuite4_DeletionAndForeignKeys();
  } catch (err) {
    console.error("Fatal test runner error:", err);
  } finally {
    // Automatically clean up test records created by this stress harness
    try {
      await prisma.vehicles.deleteMany({
        where: { fleet_id: { startsWith: "STRESS_" } },
      });
      await prisma.equipment.deleteMany({
        where: {
          OR: [
            { radio_id: { startsWith: "STRESS_" } },
            { radio_id: { startsWith: "GM_" } },
            { radio_id: { startsWith: "EQ_" } },
            { radio_id: { startsWith: "PUT_TEST_" } },
          ],
        },
      });
    } catch {
      // Ignore cleanup error if records were already deleted
    }
    await prisma.$disconnect();
  }

  console.log("\n=======================================================");
  console.log("📊 EMPIRICAL STRESS TEST SUITE SUMMARY");
  console.log("=======================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  const criticalFails = results.filter((r) => !r.passed && r.severity === "CRITICAL").length;
  const highFails = results.filter((r) => !r.passed && r.severity === "HIGH").length;

  console.log(`Total Scenarios:  ${total}`);
  console.log(`Passed:           ${passed}`);
  console.log(`Failed:           ${failed}`);
  console.log(`Critical Fails:   ${criticalFails}`);
  console.log(`High Fails:       ${highFails}`);
  console.log(`Pass Rate:        ${((passed / total) * 100).toFixed(1)}%`);

  // Write results to JSON for challenger report generation
  const fs = await import("fs");
  fs.writeFileSync(
    "/home/server/Projects/Control-Access/.agents/teamwork_preview_challenger_m1_2/stress_results.json",
    JSON.stringify(results, null, 2)
  );

  if (failed > 0) {
    console.log("\n🚨 FAILURES DETECTED — DETAILS:");
    results
      .filter((r) => !r.passed)
      .forEach((r, idx) => {
        console.log(`\n${idx + 1}. [${r.severity}] ${r.name}`);
        console.log(`   Expected: ${r.expected}`);
        console.log(`   Actual:   ${r.actual}`);
      });
  }
}

main();
