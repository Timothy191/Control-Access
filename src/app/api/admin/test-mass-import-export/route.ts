import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { exportEmployees, importEmployees } from "@/lib/data-exchange/employee-exchange";
import { exportFleet, importFleet } from "@/lib/data-exchange/fleet-exchange";
import { parseCSVToObjects } from "@/lib/data-exchange/csv-parser";

export const dynamic = "force-dynamic";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export async function GET() {
  const results: TestResult[] = [];
  const createdTestEmpCodes: string[] = [];
  const createdTestFleetIds: string[] = [];

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion Failed: ${message}`);
    }
  }

  function assertEqual<T>(actual: T, expected: T, message?: string) {
    if (actual !== expected) {
      throw new Error(
        `Assertion Failed: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}. ${message || ""}`
      );
    }
  }

  async function runTest(name: string, fn: () => Promise<void> | void) {
    const start = Date.now();
    try {
      await fn();
      const durationMs = Date.now() - start;
      results.push({ name, passed: true, durationMs });
    } catch (err) {
      const durationMs = Date.now() - start;
      const msg = err instanceof Error ? err.stack || err.message : String(err);
      results.push({ name, passed: false, error: msg, durationMs });
    }
  }

  // 1. Employee Export Verification
  await runTest("Employee Export: JSON Format produces valid payload with metadata", async () => {
    const res = await exportEmployees({ format: "json" });
    assert(res.contentType.includes("application/json"), `Expected JSON content-type, got ${res.contentType}`);
    assert(res.filename.endsWith(".json"), `Expected .json extension, got ${res.filename}`);

    const parsed = JSON.parse(res.data as string);
    assert(parsed.success === true, "Expected success: true");
    assert(typeof parsed.count === "number", "Expected count property");
    assert(Array.isArray(parsed.employees), "Expected employees array");
    assert(parsed.employees.length === res.count, "Count mismatch with array length");
  });

  await runTest("Employee Export: CSV Format produces RFC-4180 BOM-prefixed table", async () => {
    const res = await exportEmployees({ format: "csv" });
    assert(res.contentType.includes("text/csv"), `Expected CSV content-type, got ${res.contentType}`);
    assert(res.filename.endsWith(".csv"), `Expected .csv extension, got ${res.filename}`);

    const csvData = res.data as string;
    assert(csvData.startsWith("\uFEFF"), "Expected UTF-8 BOM prefix for Excel interoperability");

    const parsedRows = parseCSVToObjects(csvData);
    assert(Array.isArray(parsedRows), "Expected parseCSVToObjects to return array");
    assert(parsedRows.length === res.count, `Expected ${res.count} parsed rows, got ${parsedRows.length}`);
  });

  // 2. Fleet Export Verification
  await runTest("Fleet Export: JSON Format produces valid payload with vehicle telemetry", async () => {
    const res = await exportFleet({ format: "json" });
    assert(res.contentType.includes("application/json"), `Expected JSON content-type, got ${res.contentType}`);
    assert(res.filename.endsWith(".json"), `Expected .json extension, got ${res.filename}`);

    const parsed = JSON.parse(res.data as string);
    assert(parsed.success === true, "Expected success: true");
    assert(Array.isArray(parsed.vehicles), "Expected vehicles array");
  });

  await runTest("Fleet Export: CSV Format produces RFC-4180 BOM-prefixed fleet table", async () => {
    const res = await exportFleet({ format: "csv" });
    assert(res.contentType.includes("text/csv"), `Expected CSV content-type, got ${res.contentType}`);
    assert(res.filename.endsWith(".csv"), `Expected .csv extension, got ${res.filename}`);

    const csvData = res.data as string;
    assert(csvData.startsWith("\uFEFF"), "Expected UTF-8 BOM prefix for Excel interoperability");

    const parsedRows = parseCSVToObjects(csvData);
    assert(Array.isArray(parsedRows), "Expected parseCSVToObjects to return array");
    assert(parsedRows.length === res.count, `Expected ${res.count} parsed rows, got ${parsedRows.length}`);
  });

  // 3. Employee Mass Generation
  await runTest("Employee Mass Generator: Generates 10 realistic personnel with unique codes & credentials", async () => {
    const res = await importEmployees({
      generate_count: 10,
      compliance_profile: "realistic",
      contractor_ratio: 0.4,
    });

    assert(res.success, `Expected success, got error: ${res.error}`);
    assertEqual(res.summary.created, 10, "Expected 10 created employees");
    assertEqual(res.summary.errors_count, 0, "Expected 0 errors");

    const recent = await prisma.employees.findMany({
      take: 10,
      orderBy: { id: "desc" },
    });

    for (const emp of recent) {
      createdTestEmpCodes.push(emp.emp_code);
      assert(emp.emp_code.startsWith("EMP-") || emp.emp_code.startsWith("CON-"), `Invalid code: ${emp.emp_code}`);
      assert(Boolean(emp.rfid_tag?.startsWith("RFID-EMP-")), `Invalid RFID: ${emp.rfid_tag}`);
      assert(Boolean(emp.qr_code?.startsWith("QR-EMP-")), `Invalid QR: ${emp.qr_code}`);
    }
  });

  await runTest("Employee Mass Generator: Generates 25 fully compliant personnel without collisions", async () => {
    const res = await importEmployees({
      generate_count: 25,
      compliance_profile: "compliant",
      target_site: "North Pit",
    });

    assert(res.success, `Expected success, got error: ${res.error}`);
    assertEqual(res.summary.created, 25, "Expected 25 created employees");

    const recent = await prisma.employees.findMany({
      take: 25,
      orderBy: { id: "desc" },
    });

    const now = new Date();
    for (const emp of recent) {
      createdTestEmpCodes.push(emp.emp_code);
      assertEqual(emp.area, "North Pit", "Target site must be assigned");
      assert(emp.medical_expiry !== null && emp.medical_expiry > now, "Medical must be compliant (> today)");
    }
  });

  // 4. Fleet Mass Generation
  await runTest("Fleet Mass Generator: Generates 10 Heavy Machinery units with engine hours & cert requirements", async () => {
    const res = await importFleet({
      generate_count: 10,
      vehicle_class: "HEAVY",
      compliance_profile: "compliant",
    });

    assert(res.success, `Expected success, got error: ${res.error}`);
    assertEqual(res.summary.created, 10, "Expected 10 created vehicles");

    const recent = await prisma.vehicles.findMany({
      take: 10,
      orderBy: { id: "desc" },
    });

    for (const veh of recent) {
      createdTestFleetIds.push(veh.fleet_id);
      assertEqual(veh.is_heavy_fleet, true, "is_heavy_fleet must be true for heavy fleet");
      assert((veh.operational_hours ?? 0) >= 500, "Expected operational hours >= 500");
    }
  });

  // 5. CSV Import & Upsert
  await runTest("Employee CSV Import: Upserts existing record and creates new record simultaneously", async () => {
    const testCode1 = `TEST-EMP-${Date.now()}-A`;
    const testCode2 = `TEST-EMP-${Date.now()}-B`;
    createdTestEmpCodes.push(testCode1, testCode2);

    await prisma.employees.create({
      data: {
        emp_code: testCode1,
        first_name: "OriginalFirst",
        surname: "OriginalSurname",
        job_title: "Junior Welder",
        status: "Active",
      },
    });

    const csvPayload = [
      "EMP Code,First Name,Surname,Job Title,Status",
      `${testCode1},UpdatedFirst,UpdatedSurname,Senior Master Welder,Active`,
      `${testCode2},NewbieFirst,NewbieSurname,Haul Truck Trainee,Active`,
    ].join("\n");

    const res = await importEmployees({
      csvText: csvPayload,
      upsert: true,
    });

    assert(res.success, `Expected success, got error: ${res.error}`);
    assertEqual(res.summary.created, 1, "Expected exactly 1 created record");
    assertEqual(res.summary.updated, 1, "Expected exactly 1 updated record");

    const emp1 = await prisma.employees.findUnique({ where: { emp_code: testCode1 } });
    assertEqual(emp1?.first_name, "UpdatedFirst", "First name should have been updated");
  });

  await runTest("Fleet JSON Import: Safely handles RFID collision gracefully", async () => {
    const existingFleetId = `TEST-FLT-${Date.now()}-EXIST`;
    const newFleetId = `TEST-FLT-${Date.now()}-NEW`;
    const sharedRfid = `RFID-COLLISION-${Date.now()}`;
    createdTestFleetIds.push(existingFleetId, newFleetId);

    await prisma.vehicles.create({
      data: {
        fleet_id: existingFleetId,
        vehicle_type: "HEAVY_FLEET",
        rfid_tag: sharedRfid,
        status: "Active",
      },
    });

    const res = await importFleet({
      vehicles: [
        {
          fleet_id: newFleetId,
          vehicle_type: "HEAVY_FLEET",
          rfid_tag: sharedRfid,
          make: "Komatsu",
          operational_hours: 4500,
        },
      ],
      upsert: true,
    });

    assert(res.success, `Expected collision resolution to succeed without throwing, got error: ${res.error}`);
    assertEqual(res.summary.created, 1, "Expected vehicle to be created with resolved RFID");

    const newVeh = await prisma.vehicles.findUnique({ where: { fleet_id: newFleetId } });
    assert(newVeh !== null, "New vehicle must exist");
    assert(newVeh?.rfid_tag !== sharedRfid, "RFID tag must have been regenerated to avoid unique collision");
  });

  // Cleanup
  if (createdTestEmpCodes.length > 0) {
    await prisma.employees.deleteMany({
      where: { emp_code: { in: createdTestEmpCodes } },
    });
  }

  if (createdTestFleetIds.length > 0) {
    await prisma.vehicles.deleteMany({
      where: { fleet_id: { in: createdTestFleetIds } },
    });
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  return NextResponse.json({
    success: failed === 0,
    summary: {
      total,
      passed,
      failed,
      pass_rate: `${((passed / total) * 100).toFixed(1)}%`,
    },
    results,
  });
}
