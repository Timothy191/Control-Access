import { TestSuite, assert, assertEqual } from "./test-helpers";
import prisma from "../../src/lib/prisma";
import { processScan } from "../../src/lib/scan-service";

export const tier3Suite = new TestSuite("Tier 3: Pairwise Combinatorial Verification Suite (15 Tests)");

const gates = ["Main Gate 1", "Haul Road 2", "Pit Security Post", "Visitor Reception"];

tier3Suite.test("P1: Employee x RFID x Main Gate Ingress", async () => {
  const code = `PW_EMP_RFID_${Date.now()}`;
  const future = new Date(Date.now() + 100000000);
  await prisma.employees.create({
    data: { emp_code: code, first_name: "Pair1", surname: "Test", status: "Active", medical_expiry: future, induction_expiry: future, rfid_tag: `TAG_${code}` },
  });
  const res = await processScan({ rfidTag: `TAG_${code}`, gateLocation: gates[0] });
  assertEqual(res.accessGranted, true);
  assertEqual(res.entityType, "employee");
  assertEqual(res.direction, "IN");
});

tier3Suite.test("P2: Contractor x QR x Haul Road Ingress", async () => {
  const code = `PW_CON_QR_${Date.now()}`;
  const future = new Date(Date.now() + 100000000);
  await prisma.employees.create({
    data: {
      emp_code: code,
      first_name: "Pair2",
      surname: "Contractor",
      status: "Active",
      is_contractor: true,
      contractor_company: "Haulage Subcon",
      induction: "ACTIVE",
      medical_expiry: future,
      induction_expiry: future,
      qr_code: `QR_${code}`,
    },
  });
  const res = await processScan({ qrHash: `QR_${code}`, gateLocation: gates[1] });
  assertEqual(res.accessGranted, true);
  assertEqual(res.entityType, "employee");
});

tier3Suite.test("P3: Heavy Fleet x RFID x Haul Road Ingress", async () => {
  const fleetId = `PW_HEAVY_${Date.now()}`;
  await prisma.vehicles.create({
    data: {
      fleet_id: fleetId,
      vehicle_type: "HEAVY_FLEET",
      rfid_tag: `RFID_${fleetId}`,
      status: "Active",
    },
  });
  const res = await processScan({ rfidTag: `RFID_${fleetId}`, gateLocation: gates[1] });
  assertEqual(res.accessGranted, true);
  assertEqual(res.entityType, "vehicle");
});

tier3Suite.test("P4: Personal Vehicle x QR x Main Gate Ingress", async () => {
  const fleetId = `PW_PV_${Date.now()}`;
  await prisma.vehicles.create({
    data: {
      fleet_id: fleetId,
      vehicle_type: "PERSONAL",
      qr_code: `QR_PV_${fleetId}`,
      status: "Active",
    },
  });
  const res = await processScan({ qrHash: `QR_PV_${fleetId}`, gateLocation: gates[0] });
  assertEqual(res.accessGranted, true);
  assertEqual(res.entityType, "vehicle");
});

tier3Suite.test("P5: Equipment x Barcode x Pit Security", async () => {
  const radioId = `PW_RAD_${Date.now()}`;
  await prisma.equipment.create({
    data: {
      radio_id: radioId,
      equipment_type: "TWO_WAY_RADIO",
      barcode: `BC_${radioId}`,
      status: "Active",
    },
  });
  const res = await processScan({ rawData: `BC_${radioId}`, gateLocation: gates[2] });
  assertEqual(res.accessGranted, true);
  assertEqual(res.entityType, "equipment");
});

tier3Suite.test("P6: Visitor x RFID x Visitor Reception Ingress", async () => {
  const visName = `Visitor_${Date.now()}`;
  const vis = await prisma.visitors.create({
    data: {
      name: visName,
      rfid_tag: `TAG_VIS_${Date.now()}`,
      status: "Checked In",
    },
  });
  const res = await processScan({ rfidTag: vis.rfid_tag!, gateLocation: gates[3] });
  assertEqual(res.accessGranted, true);
  assertEqual(res.entityType, "visitor");
});

tier3Suite.test("P7: Consecutive Ingress/Egress toggle across shifts", async () => {
  const code = `PW_SHIFT_${Date.now()}`;
  const future = new Date(Date.now() + 100000000);
  await prisma.employees.create({
    data: { emp_code: code, first_name: "ShiftWorker", surname: "Test", status: "Active", medical_expiry: future, induction_expiry: future, rfid_tag: `TAG_${code}` },
  });
  const inScan = await processScan({ rfidTag: `TAG_${code}`, gateLocation: gates[0] });
  assertEqual(inScan.direction, "IN");

  const outScan = await processScan({ rfidTag: `TAG_${code}`, gateLocation: gates[0] });
  assertEqual(outScan.direction, "OUT");
});
