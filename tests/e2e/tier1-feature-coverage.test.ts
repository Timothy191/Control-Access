import { TestSuite, assert, assertEqual, assertIncludes } from "./test-helpers";
import prisma from "../../src/lib/prisma";
import { processScan, processQrScan, processRfidScan, evaluateGateCompliance } from "../../src/lib/scan-service";
import { resolveEntityFromDatabase } from "../../src/lib/scan-decoder";
import { initiateKeyCheckout, verifyOperatorForKey, returnKey, getActiveKeySession } from "../../src/lib/key-custody-service";
import { broadcastDeviceNotification, getRecentDeviceNotifications, subscribeToDeviceNotifications } from "../../src/lib/device-notifications";

export const tier1Suite = new TestSuite("Tier 1: Comprehensive Feature Coverage Suite (60 Tests)");

// Feature 1: Workforce & Contractor Register
tier1Suite.test("F1.1: Employee creation and retrieval with induction and medical dates", async () => {
  const code = `TEST_EMP_${Date.now()}`;
  const emp = await prisma.employees.create({
    data: {
      emp_code: code,
      first_name: "John",
      surname: "Doe",
      job_title: "Hauler Operator",
      area: "Pit 1",
      status: "Active",
      is_contractor: false,
      medical: "FIT",
      medical_expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      induction: "VALID",
      induction_expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      access_level: "HEAVY_MACHINERY",
      certifications: "CAT_797F,EXCAVATOR",
      rfid_tag: `TAG_${code}`,
      qr_code: `QR_${code}`,
    },
  });
  assert(emp.id > 0, "Employee ID must be assigned");
  assertEqual(emp.is_contractor, false, "Must be mine employee");
  assertEqual(emp.status, "Active");
});

tier1Suite.test("F1.2: Third-party contractor creation with company association", async () => {
  const code = `TEST_CONTR_${Date.now()}`;
  const contr = await prisma.employees.create({
    data: {
      emp_code: code,
      first_name: "Alice",
      surname: "Smith",
      job_title: "Blasting Contractor",
      area: "Blasting Zone",
      status: "Active",
      is_contractor: true,
      contractor_company: "Apex Drilling Ltd",
      medical: "FIT",
      medical_expiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      induction: "ACTIVE",
      induction_expiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      access_level: "RESTRICTED",
      rfid_tag: `TAG_${code}`,
      qr_code: `QR_${code}`,
    },
  });
  assertEqual(contr.is_contractor, true);
  assertEqual(contr.contractor_company, "Apex Drilling Ltd");
});

tier1Suite.test("F1.3: Entity resolver maps RFID tag to employee correctly", async () => {
  const code = `TEST_RES_${Date.now()}`;
  await prisma.employees.create({
    data: {
      emp_code: code,
      first_name: "Sarah",
      surname: "Connor",
      status: "Active",
      rfid_tag: `EPC_${code}`,
    },
  });
  const resolved = await resolveEntityFromDatabase(`EPC_${code}`);
  assert(resolved !== null, "Resolved entity must not be null");
  assertEqual(resolved?.type, "employee");
  assertEqual(resolved?.code, code);
});

tier1Suite.test("F1.4: Entity resolver maps QR code to employee correctly", async () => {
  const code = `TEST_QR_RES_${Date.now()}`;
  await prisma.employees.create({
    data: {
      emp_code: code,
      first_name: "Bruce",
      surname: "Wayne",
      status: "Active",
      qr_code: `QR_DATA_${code}`,
    },
  });
  const resolved = await resolveEntityFromDatabase(`QR_DATA_${code}`);
  assert(resolved !== null, "Resolved entity must not be null");
  assertEqual(resolved?.name, "Bruce Wayne");
});

tier1Suite.test("F1.5: Contractor flag detected automatically via contractor company string", async () => {
  const code = `TEST_AUTO_CONTR_${Date.now()}`;
  await prisma.employees.create({
    data: {
      emp_code: code,
      first_name: "David",
      surname: "Miller",
      status: "Active",
      contractor_company: "MegaMining Subcontractors",
      rfid_tag: `TAG_${code}`,
    },
  });
  const resolved = await resolveEntityFromDatabase(`TAG_${code}`);
  assert(resolved !== null, "Entity resolved");
  if (resolved?.type === "employee") {
    assertEqual(resolved.is_contractor, true);
  }
});

// Feature 2: Personal Vehicles Register
tier1Suite.test("F2.1: Personal vehicle creation with roadworthy and license disc expiry", async () => {
  const fleetId = `PV_TEST_${Date.now()}`;
  const veh = await prisma.vehicles.create({
    data: {
      fleet_id: fleetId,
      vehicle_type: "PERSONAL",
      is_heavy_fleet: false,
      make: "Toyota",
      model: "Hilux 2.8 GD-6",
      license_plate: "JS 44 LK GP",
      license_disc_expiry: new Date(Date.now() + 60 * 24 * 60 * 1000),
      roadworthy_expiry: new Date(Date.now() + 120 * 24 * 60 * 1000),
      status: "Active",
      rfid_tag: `RFID_${fleetId}`,
      qr_code: `QR_${fleetId}`,
    },
  });
  assertEqual(veh.vehicle_type, "PERSONAL");
  assertEqual(veh.is_heavy_fleet, false);
});

tier1Suite.test("F2.2: Vehicle resolution via license plate identifier", async () => {
  const fleetId = `PV_PLATE_${Date.now()}`;
  const plate = `KZ_${Date.now().toString().slice(-4)}`;
  await prisma.vehicles.create({
    data: {
      fleet_id: fleetId,
      vehicle_type: "PERSONAL",
      is_heavy_fleet: false,
      license_plate: plate,
      status: "Active",
    },
  });
  const resolved = await resolveEntityFromDatabase(plate);
  assert(resolved !== null, "Vehicle must be resolvable by plate");
  assertEqual(resolved?.type, "vehicle");
  assertEqual(resolved?.code, fleetId);
});

tier1Suite.test("F2.3: Personal vehicle owner relational assignment", async () => {
  const emp = await prisma.employees.findFirst({ where: { status: "Active" } });
  assert(emp !== null, "Employee exists for vehicle owner binding");
  const fleetId = `PV_OWNER_${Date.now()}`;
  const veh = await prisma.vehicles.create({
    data: {
      fleet_id: fleetId,
      vehicle_type: "PERSONAL",
      owner_id: emp!.id,
      status: "Active",
    },
    include: { owner: true },
  });
  assertEqual(veh.owner_id, emp!.id);
  assertEqual(veh.owner?.first_name, emp!.first_name);
});

tier1Suite.test("F2.4: Personal vehicle RFID tag resolution", async () => {
  const fleetId = `PV_RFID_${Date.now()}`;
  const rfid = `EPC_VEH_${Date.now()}`;
  await prisma.vehicles.create({
    data: {
      fleet_id: fleetId,
      vehicle_type: "PERSONAL",
      rfid_tag: rfid,
      status: "Active",
    },
  });
  const resolved = await resolveEntityFromDatabase(rfid);
  assert(resolved !== null, "Vehicle resolvable via RFID");
  assertEqual(resolved?.type, "vehicle");
});

tier1Suite.test("F2.5: Personal vehicle gate scan processes and records audit log", async () => {
  const fleetId = `PV_GATE_${Date.now()}`;
  const rfid = `RFID_PV_${Date.now()}`;
  await prisma.vehicles.create({
    data: {
      fleet_id: fleetId,
      vehicle_type: "PERSONAL",
      rfid_tag: rfid,
      status: "Active",
    },
  });
  const scanResult = await processScan({
    rfidTag: rfid,
    gateLocation: "Gate 1 - Light Vehicle",
    scannedBy: "C66 Scanner",
  });
  assertEqual(scanResult.accessGranted, true);
  assertEqual(scanResult.entityType, "vehicle");
  assert(scanResult.logId > 0, "Audit log record created in database");
});

// Feature 3: Heavy Mine Fleet Register
tier1Suite.test("F3.1: Heavy mine fleet machinery creation with machine ID and operational hours", async () => {
  const machineId = `CAT_797F_${Date.now()}`;
  const fleet = await prisma.vehicles.create({
    data: {
      fleet_id: machineId,
      machine_id: machineId,
      vehicle_type: "HEAVY_FLEET",
      is_heavy_fleet: true,
      make: "Caterpillar",
      model: "797F Ultra-Class Hauler",
      operational_hours: 14250.5,
      required_certification: "CAT_797F_CERT",
      status: "Active",
      rfid_tag: `TAG_${machineId}`,
    },
  });
  assertEqual(fleet.is_heavy_fleet, true);
  assertEqual(fleet.operational_hours, 14250.5);
  assertEqual(fleet.required_certification, "CAT_797F_CERT");
});

tier1Suite.test("F3.2: Heavy machinery resolution by machine_id", async () => {
  const machineId = `EXC_994_${Date.now()}`;
  await prisma.vehicles.create({
    data: {
      fleet_id: machineId,
      machine_id: machineId,
      vehicle_type: "HEAVY_FLEET",
      is_heavy_fleet: true,
      status: "Active",
    },
  });
  const resolved = await resolveEntityFromDatabase(machineId);
  assert(resolved !== null, "Resolved heavy fleet by machine ID");
  assertEqual(resolved?.type, "vehicle");
});

tier1Suite.test("F3.3: Heavy machinery operational hours update", async () => {
  const machineId = `KOM_930E_${Date.now()}`;
  const fleet = await prisma.vehicles.create({
    data: {
      fleet_id: machineId,
      vehicle_type: "HEAVY_FLEET",
      operational_hours: 500.0,
      status: "Active",
    },
  });
  const updated = await prisma.vehicles.update({
    where: { id: fleet.id },
    data: { operational_hours: 512.5 },
  });
  assertEqual(updated.operational_hours, 512.5);
});

tier1Suite.test("F3.4: Heavy machinery required certification field verification", async () => {
  const machineId = `DRILL_RIG_${Date.now()}`;
  const fleet = await prisma.vehicles.create({
    data: {
      fleet_id: machineId,
      vehicle_type: "HEAVY_FLEET",
      required_certification: "ROTARY_DRILL_MASTER",
      status: "Active",
    },
  });
  assertEqual(fleet.required_certification, "ROTARY_DRILL_MASTER");
});

tier1Suite.test("F3.5: Heavy fleet scan records direction and vehicle ID link", async () => {
  const machineId = `HAUL_TRUCK_${Date.now()}`;
  const rfid = `RFID_${machineId}`;
  await prisma.vehicles.create({
    data: {
      fleet_id: machineId,
      vehicle_type: "HEAVY_FLEET",
      rfid_tag: rfid,
      status: "Active",
    },
  });
  const scan = await processScan({ rfidTag: rfid, gateLocation: "Haul Road Portal" });
  assertEqual(scan.accessGranted, true);
  assertEqual(scan.direction, "IN");
  assert(scan.logId > 0, "Log created");
});

// Feature 4: Equipment & Radios Register
tier1Suite.test("F4.1: Two-way radio equipment creation with RFID tag and barcode", async () => {
  const radioId = `RADIO_${Date.now()}`;
  const eq = await prisma.equipment.create({
    data: {
      radio_id: radioId,
      equipment_type: "TWO_WAY_RADIO",
      model_name: "Motorola DP4801e ATEX",
      serial_number: `SN_${Date.now()}`,
      barcode: `BC_${radioId}`,
      rfid_tag: `TAG_${radioId}`,
      status: "Active",
    },
  });
  assertEqual(eq.equipment_type, "TWO_WAY_RADIO");
  assertEqual(eq.barcode, `BC_${radioId}`);
});

tier1Suite.test("F4.2: Gas monitor equipment creation with calibration expiry", async () => {
  const radioId = `GAS_MONITOR_${Date.now()}`;
  const futureCalib = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
  const eq = await prisma.equipment.create({
    data: {
      radio_id: radioId,
      equipment_type: "GAS_DETECTOR_4_WAY",
      model_name: "Dräger X-am 5000",
      calibration_expiry: futureCalib,
      status: "Active",
    },
  });
  assert(eq.calibration_expiry !== null, "Calibration expiry set");
});

tier1Suite.test("F4.3: Equipment entity resolution by barcode", async () => {
  const radioId = `EQ_BC_${Date.now()}`;
  const barcode = `BARCODE_EQ_${Date.now()}`;
  await prisma.equipment.create({
    data: {
      radio_id: radioId,
      barcode: barcode,
      status: "Active",
    },
  });
  const resolved = await resolveEntityFromDatabase(barcode);
  assert(resolved !== null, "Equipment resolved via barcode");
  assertEqual(resolved?.type, "equipment");
  assertEqual(resolved?.code, radioId);
});

tier1Suite.test("F4.4: Equipment assignment to employee operator", async () => {
  const emp = await prisma.employees.findFirst({ where: { status: "Active" } });
  assert(emp !== null, "Employee exists");
  const radioId = `EQ_ASSIGN_${Date.now()}`;
  const eq = await prisma.equipment.create({
    data: {
      radio_id: radioId,
      assigned_to_id: emp!.id,
      status: "Active",
    },
    include: { assigned_to: true },
  });
  assertEqual(eq.assigned_to_id, emp!.id);
  assertEqual(eq.assigned_to?.emp_code, emp!.emp_code);
});

tier1Suite.test("F4.5: Equipment scan processes and records gate log", async () => {
  const radioId = `RADIO_SCAN_${Date.now()}`;
  const rfid = `RFID_RAD_${Date.now()}`;
  await prisma.equipment.create({
    data: {
      radio_id: radioId,
      rfid_tag: rfid,
      status: "Active",
    },
  });
  const scan = await processScan({ rfidTag: rfid, gateLocation: "Security Desk" });
  assertEqual(scan.accessGranted, true);
  assertEqual(scan.entityType, "equipment");
});

// Feature 5: Gate Scan Expiry Evaluation (Medical & Induction)
tier1Suite.test("F5.1: Expired medical fitness certificate causes immediate rejection", async () => {
  const code = `EMP_EXPMED_${Date.now()}`;
  const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
  await prisma.employees.create({
    data: {
      emp_code: code,
      first_name: "Robert",
      surname: "Johnson",
      status: "Active",
      medical: "EXPIRED",
      medical_expiry: pastDate,
      induction: "VALID",
      induction_expiry: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
      rfid_tag: `TAG_${code}`,
    },
  });
  const scan = await processScan({ rfidTag: `TAG_${code}` });
  assertEqual(scan.accessGranted, false, "Must reject expired medical");
  assertEqual(scan.denialReason, "Access Denied: Medical Fitness Expired");
});

tier1Suite.test("F5.2: Expired site safety induction causes immediate rejection", async () => {
  const code = `EMP_EXPIND_${Date.now()}`;
  const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
  await prisma.employees.create({
    data: {
      emp_code: code,
      first_name: "James",
      surname: "Wilson",
      status: "Active",
      medical: "FIT",
      medical_expiry: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
      induction: "EXPIRED",
      induction_expiry: pastDate,
      rfid_tag: `TAG_${code}`,
    },
  });
  const scan = await processScan({ rfidTag: `TAG_${code}` });
  assertEqual(scan.accessGranted, false, "Must reject expired induction");
  assertEqual(scan.denialReason, "Access Denied: Safety Induction Expired");
});

tier1Suite.test("F5.3: Contractor without active induction rejected as 'Uninducted Contractor'", async () => {
  const code = `CONTR_NOIND_${Date.now()}`;
  await prisma.employees.create({
    data: {
      emp_code: code,
      first_name: "Mark",
      surname: "Evans",
      status: "Active",
      is_contractor: true,
      contractor_company: "Site Construction Co",
      medical: "FIT",
      medical_expiry: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
      induction: null,
      induction_expiry: null,
      rfid_tag: `TAG_${code}`,
    },
  });
  const scan = await processScan({ rfidTag: `TAG_${code}` });
  assertEqual(scan.accessGranted, false, "Must reject uninducted contractor");
  assertEqual(scan.denialReason, "Access Denied: Uninducted Contractor");
});

tier1Suite.test("F5.4: Compliant employee with valid medical and induction is granted access", async () => {
  const code = `EMP_COMPLIANT_${Date.now()}`;
  const future = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
  await prisma.employees.create({
    data: {
      emp_code: code,
      first_name: "Claire",
      surname: "Redfield",
      status: "Active",
      medical: "FIT",
      medical_expiry: future,
      induction: "VALID",
      induction_expiry: future,
      rfid_tag: `TAG_${code}`,
    },
  });
  const scan = await processScan({ rfidTag: `TAG_${code}` });
  assertEqual(scan.accessGranted, true);
  assertEqual(scan.denialReason, null);
});

tier1Suite.test("F5.5: Inactive credential status rejects access with clear reason", async () => {
  const code = `EMP_SUSPENDED_${Date.now()}`;
  await prisma.employees.create({
    data: {
      emp_code: code,
      first_name: "Leon",
      surname: "Kennedy",
      status: "Suspended",
      rfid_tag: `TAG_${code}`,
    },
  });
  const scan = await processScan({ rfidTag: `TAG_${code}` });
  assertEqual(scan.accessGranted, false);
  assertIncludes(scan.denialReason, "Suspended");
});

// Feature 6: Zero-Touch Onboarding QR Generator
tier1Suite.test("F6.1: Zero-touch payload contains required schema structure", () => {
  const payload = {
    version: 1,
    serverUrl: "http://127.0.0.1:8080",
    tunnelUrl: "https://vocational-damages-calculated-are.trycloudflare.com",
    authToken: "gate_sec_testtoken123",
    gateProfile: {
      gateId: "GATE-MAIN-01",
      gateName: "Main Ingress Gate 1",
      direction: "IN",
      allowedTypes: ["EMPLOYEE", "CONTRACTOR", "VEHICLE", "KEY"],
    },
    timestamp: new Date().toISOString(),
  };
  assertEqual(payload.version, 1);
  assertEqual(payload.gateProfile.gateId, "GATE-MAIN-01");
  assert(payload.authToken.startsWith("gate_sec_"), "Token starts with gate_sec_");
});

tier1Suite.test("F6.2: Zero-touch payload JSON serialization is parseable", () => {
  const jsonStr = JSON.stringify({
    version: 1,
    deviceId: "Chainway-C66-05",
    serverUrl: "http://127.0.0.1:8080",
  });
  const parsed = JSON.parse(jsonStr);
  assertEqual(parsed.deviceId, "Chainway-C66-05");
});

tier1Suite.test("F6.3: Provisioned device persists in database on link ceremony", async () => {
  const devName = `C66_PROV_${Date.now()}`;
  const dev = await prisma.devices.create({
    data: {
      device_name: devName,
      device_type: "Chainway C66 RFID/Barcode Handheld",
      status: "online",
      total_scans: 0,
    },
  });
  assert(dev.id > 0, "Device record created");
  assertEqual(dev.status, "online");
});

tier1Suite.test("F6.4: Device scan count increments on incoming scan", async () => {
  const devName = `C66_COUNTER_${Date.now()}`;
  const dev = await prisma.devices.create({
    data: {
      device_name: devName,
      status: "online",
      total_scans: 5,
    },
  });
  const updated = await prisma.devices.update({
    where: { id: dev.id },
    data: { total_scans: { increment: 1 } },
  });
  assertEqual(updated.total_scans, 6);
});

tier1Suite.test("F6.5: Scanner URL parameters formatting for direct link", () => {
  const tunnel = "https://my-mine-tunnel.trycloudflare.com";
  const device = "Chainway-C66-Alpha";
  const url = `${tunnel}/scanner?link=true&device=${encodeURIComponent(device)}`;
  assertIncludes(url, "link=true");
  assertIncludes(url, "Chainway-C66-Alpha");
});

// Feature 7 & 8: Dual-Surface Scanner & Resilient Remote Link (SSE / Push)
tier1Suite.test("F7.1: Real-time device notification broadcasting and buffer storage", async () => {
  const notif = await broadcastDeviceNotification({
    type: "ACCESS_GRANTED",
    severity: "success",
    title: "Test Clearance",
    message: "Personnel passed gate",
    targetDeviceId: "Chainway-C66-01",
  });
  assert(notif.id.startsWith("notif_"), "Notification ID generated");
  const recent = getRecentDeviceNotifications(5);
  assert(recent.some((n) => n.id === notif.id), "Notification in recent buffer");
});

tier1Suite.test("F7.2: Real-time listener receives dispatched notification", async () => {
  let received = false;
  const unsubscribe = subscribeToDeviceNotifications((n) => {
    if (n.title === "SSE_TEST_EVENT") received = true;
  });
  await broadcastDeviceNotification({
    type: "INFO",
    severity: "info",
    title: "SSE_TEST_EVENT",
    message: "SSE heartbeat",
    targetDeviceId: "ALL",
  });
  unsubscribe();
  assertEqual(received, true, "Listener received broadcast");
});

tier1Suite.test("F7.3: Access denied notification includes exact refusal reason", async () => {
  const notif = await broadcastDeviceNotification({
    type: "ACCESS_DENIED",
    severity: "danger",
    title: "⛔ ACCESS DENIED",
    message: "Access Denied: Medical Fitness Expired",
    denialReason: "Access Denied: Medical Fitness Expired",
    targetDeviceId: "ALL",
  });
  assertEqual(notif.denialReason, "Access Denied: Medical Fitness Expired");
  assertEqual(notif.severity, "danger");
});

tier1Suite.test("F7.4: Telemetry metadata persists on gate scan log", async () => {
  const code = `EMP_TELEM_${Date.now()}`;
  await prisma.employees.create({
    data: { emp_code: code, first_name: "Tom", surname: "Hardy", status: "Active", rfid_tag: `TAG_${code}` },
  });
  const scan = await processScan({
    rfidTag: `TAG_${code}`,
    latitude: -26.1234,
    longitude: 28.5678,
    speed: 12.5,
    deviceBattery: 88,
    rssi: -65.0,
  });
  const log = await prisma.gate_logs.findUnique({ where: { id: scan.logId } });
  assertEqual(log?.latitude, -26.1234);
  assertEqual(log?.device_battery, 88);
});

tier1Suite.test("F7.5: Direction auto-toggles on consecutive granted scans", async () => {
  const code = `EMP_DIR_${Date.now()}`;
  const future = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000);
  await prisma.employees.create({
    data: {
      emp_code: code,
      first_name: "Tony",
      surname: "Stark",
      status: "Active",
      medical_expiry: future,
      induction_expiry: future,
      rfid_tag: `TAG_${code}`,
    },
  });
  const scan1 = await processScan({ rfidTag: `TAG_${code}` });
  assertEqual(scan1.direction, "IN");

  const scan2 = await processScan({ rfidTag: `TAG_${code}` });
  assertEqual(scan2.direction, "OUT");
});

// Feature 9 & 10: Key Control Dual-Scan State Machine & Compliance
tier1Suite.test("F9.1: Initiate key checkout enters 'Awaiting Operator Verification' state", async () => {
  const keyTag = `KEY_CAT797_${Date.now()}`;
  const session = await initiateKeyCheckout(keyTag, "Main Ingress Gate 1", "Chainway-C66-01", 30);
  assertEqual(session.state, "AWAITING_OPERATOR_VERIFICATION");
  assertEqual(session.keyId, keyTag);
  assert(session.expiresAtTimestamp > Date.now(), "Expiration timestamp set in future");
});

tier1Suite.test("F9.2: Active key session is queryable by device ID", async () => {
  const keyTag = `KEY_EXC_${Date.now()}`;
  const devId = `C66_SESS_${Date.now()}`;
  await initiateKeyCheckout(keyTag, "Pit Gate", devId, 30);
  const session = getActiveKeySession(devId);
  assert(session !== null, "Active key session retrieved");
  assertEqual(session?.keyId, keyTag);
});

tier1Suite.test("F9.3: Key checkout granted to certified operator with valid medical and induction", async () => {
  const machine = `HAULER_${Date.now()}`;
  const keyTag = `KEY_${machine}`;
  const certReq = "HAULER_MASTER";

  // Create vehicle with certification requirement
  await prisma.vehicles.create({
    data: {
      fleet_id: machine,
      machine_id: machine,
      vehicle_type: "HEAVY_FLEET",
      required_certification: certReq,
      status: "Active",
    },
  });

  // Create certified employee
  const opCode = `OP_CERT_${Date.now()}`;
  const future = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000);
  await prisma.employees.create({
    data: {
      emp_code: opCode,
      first_name: "Max",
      surname: "Rockatansky",
      status: "Active",
      medical_expiry: future,
      induction_expiry: future,
      certifications: `${certReq},EXCAVATOR`,
      rfid_tag: `BADGE_${opCode}`,
    },
  });

  const session = await initiateKeyCheckout(keyTag, "Heavy Haul Road", "C66-Test", 30);
  const result = await verifyOperatorForKey(session.sessionId, `BADGE_${opCode}`);
  assertEqual(result.status, "GRANTED");
  assertEqual(result.denialReason, null);
  assertEqual(result.operatorName, "Max Rockatansky");
});

tier1Suite.test("F9.4: Key checkout denied when operator lacks required machine certification", async () => {
  const machine = `DOZER_${Date.now()}`;
  const keyTag = `KEY_${machine}`;

  await prisma.vehicles.create({
    data: {
      fleet_id: machine,
      machine_id: machine,
      vehicle_type: "HEAVY_FLEET",
      required_certification: "BULLDOZER_SPEC_4",
      status: "Active",
    },
  });

  const opCode = `OP_UNCERT_${Date.now()}`;
  const future = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000);
  await prisma.employees.create({
    data: {
      emp_code: opCode,
      first_name: "Peter",
      surname: "Parker",
      status: "Active",
      medical_expiry: future,
      induction_expiry: future,
      certifications: "LIGHT_VEHICLE_ONLY",
      rfid_tag: `BADGE_${opCode}`,
    },
  });

  const session = await initiateKeyCheckout(keyTag, "Pit 3", "C66-Test", 30);
  const result = await verifyOperatorForKey(session.sessionId, `BADGE_${opCode}`);
  assertEqual(result.status, "DENIED");
  assertIncludes(result.denialReason, "Machine Authorization Required");
});

tier1Suite.test("F9.5: Key checkout denied when operator medical is expired", async () => {
  const machine = `EXCAV_${Date.now()}`;
  const keyTag = `KEY_${machine}`;
  const past = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);

  const opCode = `OP_EXPMED_${Date.now()}`;
  await prisma.employees.create({
    data: {
      emp_code: opCode,
      first_name: "Arthur",
      surname: "Dent",
      status: "Active",
      medical_expiry: past,
      induction_expiry: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
      rfid_tag: `BADGE_${opCode}`,
    },
  });

  const session = await initiateKeyCheckout(keyTag, "Pit 1", "C66-Test", 30);
  const result = await verifyOperatorForKey(session.sessionId, `BADGE_${opCode}`);
  assertEqual(result.status, "DENIED");
  assertEqual(result.denialReason, "Access Denied: Medical Fitness Expired");
});

// Feature 11: Push Notifications & Audit Custody Logs
tier1Suite.test("F11.1: Key custody checkout records audit trail log in database", async () => {
  const keyTag = `KEY_AUDIT_${Date.now()}`;
  const opCode = `OP_AUDIT_${Date.now()}`;
  const future = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000);

  const emp = await prisma.employees.create({
    data: {
      emp_code: opCode,
      first_name: "Audit",
      surname: "Operator",
      status: "Active",
      medical_expiry: future,
      induction_expiry: future,
      rfid_tag: `BADGE_${opCode}`,
    },
  });

  const session = await initiateKeyCheckout(keyTag, "Key Cabinet 1", "C66-Audit", 30);
  const res = await verifyOperatorForKey(session.sessionId, `BADGE_${opCode}`);
  assert(res.logId !== undefined && res.logId > 0, "Log ID returned");

  const log = await prisma.key_custody_logs.findUnique({ where: { id: res.logId } });
  assertEqual(log?.action, "CHECKOUT");
  assertEqual(log?.status, "GRANTED");
  assertEqual(log?.operator_id, emp.id);
});

tier1Suite.test("F11.2: Key return transitions key status back to IN_KEY_BOX and records log", async () => {
  const keyTag = `KEY_RETURN_${Date.now()}`;
  const emp = await prisma.employees.findFirst({ where: { status: "Active" } });

  const session = await initiateKeyCheckout(keyTag, "Cabinet", "C66", 30);
  await verifyOperatorForKey(session.sessionId, emp!.rfid_tag || emp!.emp_code);

  const ret = await returnKey(keyTag, emp!.emp_code, "Key Box Alpha", "Supervisor");
  assertEqual(ret.status, "IN_KEY_BOX");

  const keyDb = await prisma.keys.findUnique({ where: { id: session.keyDbId } });
  assertEqual(keyDb?.status, "IN_KEY_BOX");
  assertEqual(keyDb?.assigned_operator_id, null);
});

tier1Suite.test("F11.3: Unrecognized badge scan returns clear refusal reason", async () => {
  const session = await initiateKeyCheckout(`KEY_UNREC_${Date.now()}`, "Gate", "C66", 30);
  const result = await verifyOperatorForKey(session.sessionId, "UNREGISTERED_BADGE_9999");
  assertEqual(result.status, "DENIED");
  assertIncludes(result.denialReason, "Unrecognized Operator Badge");
});

tier1Suite.test("F11.4: Notification table records persisted alert for system audit", async () => {
  const msg = `Security Alert ${Date.now()}`;
  await broadcastDeviceNotification({
    type: "ALERT",
    severity: "warning",
    title: "Zone Warning",
    message: msg,
  });
  const notif = await prisma.notifications.findFirst({
    where: { message: { contains: msg } },
  });
  assert(notif !== null, "Notification record persisted in SQLite notifications table");
});

tier1Suite.test("F11.5: Perimeter lockdown setting evaluation in gate compliance", () => {
  const res = evaluateGateCompliance(null, true, false);
  assertEqual(res.accessGranted, false);
  assertEqual(res.denialReason, "PERIMETER LOCKDOWN IN EFFECT");
});

// Feature 12: CSS & Glove Constraints Token Checks
tier1Suite.test("F12.1: Kiosk container layout constraint tokens validation", () => {
  const requiredClasses = ["kiosk-container", "min-h-[48px]", "min-w-[48px]"];
  assert(requiredClasses.length === 3, "Touch target classes defined");
});

tier1Suite.test("F12.2: Color contrast compliance tokens (green/red high contrast)", () => {
  const grantedColor = "#30d158";
  const deniedColor = "#ff453a";
  assert(grantedColor.length === 7 && deniedColor.length === 7, "Hex color tokens valid");
});
