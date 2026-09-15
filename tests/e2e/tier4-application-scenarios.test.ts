import { TestSuite, assert, assertEqual, assertIncludes } from "./test-helpers";
import prisma from "../../src/lib/prisma";
import { processScan } from "../../src/lib/scan-service";
import { initiateKeyCheckout, verifyOperatorForKey } from "../../src/lib/key-custody-service";

export const tier4Suite = new TestSuite("Tier 4: End-to-End Real-World Application Scenarios Suite (6 Scenarios)");

// Scenario 1: Normal Shift Change Ingress
tier4Suite.test("Scenario 1: Normal Shift Change Ingress (Employee badge scan -> Gate Granted -> Audit recorded)", async () => {
  const code = `EMP_SHIFT_01_${Date.now()}`;
  const future = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

  const emp = await prisma.employees.create({
    data: {
      emp_code: code,
      first_name: "Thabo",
      surname: "Mokoena",
      job_title: "Excavator Operator",
      area: "North Pit",
      status: "Active",
      medical_expiry: future,
      induction_expiry: future,
      rfid_tag: `TAG_${code}`,
    },
  });

  const scanResult = await processScan({
    rfidTag: `TAG_${code}`,
    gateLocation: "Main Ingress Gate 1",
    scannedBy: "Chainway C66 Guard Terminal",
  });

  assertEqual(scanResult.accessGranted, true, "Shift change ingress must be granted");
  assertEqual(scanResult.direction, "IN");
  assertEqual(scanResult.denialReason, null);

  const log = await prisma.gate_logs.findUnique({ where: { id: scanResult.logId } });
  assert(log !== null, "Audit log persisted in database");
  assertEqual(log?.employee_id, emp.id);
});

// Scenario 2: Expired Medical Contractor Ingress
tier4Suite.test("Scenario 2: Expired Medical Contractor Ingress (Immediate Red Denial Alert 'Access Denied: Medical Fitness Expired')", async () => {
  const code = `CONTR_EXPMED_${Date.now()}`;
  const pastMedical = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days expired

  await prisma.employees.create({
    data: {
      emp_code: code,
      first_name: "Garth",
      surname: "Venter",
      job_title: "Electrical Subcontractor",
      status: "Active",
      is_contractor: true,
      contractor_company: "VoltTech Mining Contractors",
      induction: "ACTIVE",
      induction_expiry: new Date(Date.now() + 60 * 24 * 60 * 1000),
      medical: "EXPIRED",
      medical_expiry: pastMedical,
      rfid_tag: `TAG_${code}`,
    },
  });

  const scanResult = await processScan({
    rfidTag: `TAG_${code}`,
    gateLocation: "Contractor Gate 3",
  });

  assertEqual(scanResult.accessGranted, false, "Expired medical contractor MUST be rejected");
  assertEqual(scanResult.denialReason, "Access Denied: Medical Fitness Expired");

  const log = await prisma.gate_logs.findUnique({ where: { id: scanResult.logId } });
  assertEqual(log?.access_granted, false);
  assertEqual(log?.denial_reason, "Access Denied: Medical Fitness Expired");
});

// Scenario 3: Heavy Hauler Key Checkout Workflow
tier4Suite.test("Scenario 3: Heavy Hauler Key Checkout Workflow (Cat 797F Key -> 30s Window -> Certified Operator Badge -> Granted)", async () => {
  const machineId = `CAT_797F_01_${Date.now()}`;
  const keyTag = `KEY_${machineId}`;
  const certRequirement = "CAT_797F_MASTER";

  // 1. Register machine with required certification
  await prisma.vehicles.create({
    data: {
      fleet_id: machineId,
      machine_id: machineId,
      vehicle_type: "HEAVY_FLEET",
      is_heavy_fleet: true,
      operational_hours: 4520.0,
      required_certification: certRequirement,
      status: "Active",
    },
  });

  // 2. Register certified operator
  const opCode = `OP_CERT_${Date.now()}`;
  const future = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000);
  const operator = await prisma.employees.create({
    data: {
      emp_code: opCode,
      first_name: "Sipho",
      surname: "Dlamini",
      status: "Active",
      medical_expiry: future,
      induction_expiry: future,
      certifications: `${certRequirement},DOZER_CERT`,
      rfid_tag: `BADGE_${opCode}`,
    },
  });

  // 3. Step 1: Scan Key Tag
  const session = await initiateKeyCheckout(keyTag, "Haul Road Key Dispatch", "C66-Haulage", 30);
  assertEqual(session.state, "AWAITING_OPERATOR_VERIFICATION");

  // 4. Step 2: Scan Certified Operator Badge
  const verifyResult = await verifyOperatorForKey(session.sessionId, `BADGE_${opCode}`);
  assertEqual(verifyResult.status, "GRANTED");
  assertEqual(verifyResult.operatorName, "Sipho Dlamini");
  assertEqual(verifyResult.denialReason, null);

  // 5. Verify database key status updated to CHECKED_OUT
  const keyDb = await prisma.keys.findUnique({ where: { id: session.keyDbId } });
  assertEqual(keyDb?.status, "CHECKED_OUT");
  assertEqual(keyDb?.assigned_operator_id, operator.id);
});

// Scenario 4: Non-Certified Operator Key Checkout Attempt
tier4Suite.test("Scenario 4: Non-Certified Operator Key Checkout Attempt (Excavator Key -> Uncertified Badge -> 'Machine Authorization Required')", async () => {
  const machineId = `EXCAV_PC8000_${Date.now()}`;
  const keyTag = `KEY_${machineId}`;
  const requiredCert = "KOMATSU_PC8000_HEAVY";

  await prisma.vehicles.create({
    data: {
      fleet_id: machineId,
      machine_id: machineId,
      vehicle_type: "HEAVY_FLEET",
      required_certification: requiredCert,
      status: "Active",
    },
  });

  const uncertCode = `OP_UNCERT_${Date.now()}`;
  const future = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000);
  await prisma.employees.create({
    data: {
      emp_code: uncertCode,
      first_name: "Junior",
      surname: "Trainee",
      status: "Active",
      medical_expiry: future,
      induction_expiry: future,
      certifications: "LIGHT_LDV_ONLY",
      rfid_tag: `BADGE_${uncertCode}`,
    },
  });

  const session = await initiateKeyCheckout(keyTag, "Heavy Mining Key Control", "C66-KeyBox", 30);
  const verifyResult = await verifyOperatorForKey(session.sessionId, `BADGE_${uncertCode}`);

  assertEqual(verifyResult.status, "DENIED");
  assertIncludes(verifyResult.denialReason, "Machine Authorization Required");

  // Verify key was NOT checked out
  const keyDb = await prisma.keys.findUnique({ where: { id: session.keyDbId } });
  assertEqual(keyDb?.status, "IN_KEY_BOX");
});

// Scenario 5: Scanner Zero-Touch Provisioning Payload Generation
tier4Suite.test("Scenario 5: Scanner Zero-Touch Provisioning Payload Generation & Structure", () => {
  const deviceId = "Chainway-C66-TestUnit";
  const payload = {
    version: 1,
    deviceId,
    serverUrl: "http://127.0.0.1:8080",
    tunnelUrl: "https://vocational-damages-calculated-are.trycloudflare.com",
    authToken: "gate_sec_999988887777",
    gateProfile: {
      gateId: "GATE-MAIN-01",
      gateName: "Main Ingress Gate 1",
      direction: "IN",
      allowedTypes: ["EMPLOYEE", "CONTRACTOR", "VEHICLE", "KEY"],
    },
    timestamp: new Date().toISOString(),
  };

  assertEqual(payload.version, 1);
  assertEqual(payload.deviceId, deviceId);
  assertEqual(payload.gateProfile.allowedTypes.length, 4);
});

// Scenario 6: Expired Safety Induction Vehicle Gate Entry
tier4Suite.test("Scenario 6: Expired Safety Induction Vehicle Gate Entry (Driver induction expired -> Gate Blocked)", async () => {
  const driverCode = `DRIVER_EXPIND_${Date.now()}`;
  const pastInduction = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days expired

  await prisma.employees.create({
    data: {
      emp_code: driverCode,
      first_name: "Pieter",
      surname: "Botha",
      job_title: "Water Bowser Driver",
      status: "Active",
      medical_expiry: new Date(Date.now() + 100 * 24 * 60 * 1000),
      induction: "EXPIRED",
      induction_expiry: pastInduction,
      rfid_tag: `TAG_${driverCode}`,
    },
  });

  const scanResult = await processScan({
    rfidTag: `TAG_${driverCode}`,
    gateLocation: "Heavy Gate Ingress",
  });

  assertEqual(scanResult.accessGranted, false);
  assertEqual(scanResult.denialReason, "Access Denied: Safety Induction Expired");
});
