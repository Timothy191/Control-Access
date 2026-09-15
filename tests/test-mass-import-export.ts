import prisma from "../src/lib/prisma";
import { exportEmployees, importEmployees } from "../src/lib/data-exchange/employee-exchange";
import { exportFleet, importFleet } from "../src/lib/data-exchange/fleet-exchange";
import { parseCSVToObjects } from "../src/lib/data-exchange/csv-parser";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

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
    console.log(`  ✔ PASS: ${name} (${durationMs}ms)`);
  } catch (err) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    results.push({ name, passed: false, error: msg, durationMs });
    console.log(`  ✖ FAIL: ${name} (${durationMs}ms)`);
    console.log(`    Error: ${msg}`);
  }
}

async function runAllTests() {
  console.log("\n=======================================================");
  console.log(" 🧪 CONTROL-ACCESS: MASS IMPORT & EXPORT TEST SUITE ");
  console.log("=======================================================\n");

  // ========================================================
  // 1. Employee Export Verification (CSV & JSON)
  // ========================================================
  console.log("▶ Tier 1: Employee Export Pipeline");
  console.log("-------------------------------------------------------");

  await runTest("Employee Export: JSON Format produces valid payload with metadata", async () => {
    const res = await exportEmployees({ format: "json" });
    assert(res.contentType.includes("application/json"), `Expected JSON content-type, got ${res.contentType}`);
    assert(res.filename.endsWith(".json"), `Expected .json extension, got ${res.filename}`);

    const parsed = JSON.parse(res.data as string);
    assert(parsed.success === true, "Expected success: true");
    assert(typeof parsed.count === "number", "Expected count property");
    assert(Array.isArray(parsed.employees), "Expected employees array");
    assert(parsed.employees.length === res.count, "Count mismatch with array length");

    if (parsed.employees.length > 0) {
      const emp = parsed.employees[0];
      assert(Boolean(emp.emp_code), "Expected emp_code on employee");
      assert(Boolean(emp.first_name), "Expected first_name on employee");
      assert(Boolean(emp.surname), "Expected surname on employee");
    }
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

    if (parsedRows.length > 0) {
      const row = parsedRows[0];
      assert(Boolean(row["emp code"]), "Missing 'emp code' header in CSV export");
      assert(Boolean(row["first name"]), "Missing 'first name' header in CSV export");
      assert(Boolean(row["surname"]), "Missing 'surname' header in CSV export");
      assert(Boolean(row["medical certificate"]), "Missing 'medical certificate' header in CSV export");
    }
  });

  // ========================================================
  // 2. Fleet Export Verification (CSV & JSON)
  // ========================================================
  console.log("\n▶ Tier 2: Fleet Export Pipeline");
  console.log("-------------------------------------------------------");

  await runTest("Fleet Export: JSON Format produces valid payload with vehicle telemetry", async () => {
    const res = await exportFleet({ format: "json" });
    assert(res.contentType.includes("application/json"), `Expected JSON content-type, got ${res.contentType}`);
    assert(res.filename.endsWith(".json"), `Expected .json extension, got ${res.filename}`);

    const parsed = JSON.parse(res.data as string);
    assert(parsed.success === true, "Expected success: true");
    assert(Array.isArray(parsed.vehicles), "Expected vehicles array");
    assert(parsed.vehicles.length === res.count, "Count mismatch with array length");

    if (parsed.vehicles.length > 0) {
      const veh = parsed.vehicles[0];
      assert(Boolean(veh.fleet_id), "Expected fleet_id on vehicle");
      assert(typeof veh.operational_hours === "number" || veh.operational_hours === null, "Expected operational_hours");
    }
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

    if (parsedRows.length > 0) {
      const row = parsedRows[0];
      assert(Boolean(row["fleet id"]), "Missing 'fleet id' header in CSV export");
      assert(Boolean(row["vehicle type"]), "Missing 'vehicle type' header in CSV export");
      assert(Boolean(row["operational hours"]), "Missing 'operational hours' header in CSV export");
    }
  });

  // ========================================================
  // 3. Employee Mass Generation Verification (10, 25, 50)
  // ========================================================
  console.log("\n▶ Tier 3: Autonomous Employee Mass Generation");
  console.log("-------------------------------------------------------");

  await runTest("Employee Mass Generator: Generates 10 realistic personnel with unique codes & credentials", async () => {
    const res = await importEmployees({
      generate_count: 10,
      compliance_profile: "realistic",
      contractor_ratio: 0.4,
    });

    assert(res.success, `Expected success, got error: ${res.error}`);
    assertEqual(res.summary.created, 10, "Expected 10 created employees");
    assertEqual(res.summary.errors_count, 0, "Expected 0 errors");

    // Query recent employees from DB
    const recent = await prisma.employees.findMany({
      take: 10,
      orderBy: { id: "desc" },
    });

    for (const emp of recent) {
      createdTestEmpCodes.push(emp.emp_code);
      assert(emp.emp_code.startsWith("EMP-") || emp.emp_code.startsWith("CON-"), `Invalid code: ${emp.emp_code}`);
      assert(Boolean(emp.rfid_tag?.startsWith("RFID-EMP-")), `Invalid RFID: ${emp.rfid_tag}`);
      assert(Boolean(emp.qr_code?.startsWith("QR-EMP-")), `Invalid QR: ${emp.qr_code}`);
      assert(Boolean(emp.first_name && emp.surname), "First name and surname must be populated");
      assert(Boolean(emp.id_number), "SA ID number must be populated");
      assert(Boolean(emp.id_number_hash), "SA ID hash must be populated");
      assert(emp.medical_expiry !== null, "Medical expiry date must be set");
      assert(emp.induction_expiry !== null, "Induction expiry date must be set");
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
    assertEqual(res.summary.errors_count, 0, "Expected 0 errors");

    const recent = await prisma.employees.findMany({
      take: 25,
      orderBy: { id: "desc" },
    });

    const now = new Date();
    for (const emp of recent) {
      createdTestEmpCodes.push(emp.emp_code);
      assertEqual(emp.area, "North Pit", "Target site must be assigned");
      assert(emp.medical_expiry !== null && emp.medical_expiry > now, "Medical must be compliant (> today)");
      assert(emp.induction_expiry !== null && emp.induction_expiry > now, "Induction must be compliant (> today)");
    }
  });

  await runTest("Employee Mass Generator: Generates 10 expired/non-compliant personnel for gate refusal testing", async () => {
    const res = await importEmployees({
      generate_count: 10,
      compliance_profile: "expired",
    });

    assert(res.success, `Expected success, got error: ${res.error}`);
    assertEqual(res.summary.created, 10, "Expected 10 created employees");

    const recent = await prisma.employees.findMany({
      take: 10,
      orderBy: { id: "desc" },
    });

    const now = new Date();
    for (const emp of recent) {
      createdTestEmpCodes.push(emp.emp_code);
      assert(emp.medical_expiry !== null && emp.medical_expiry < now, "Medical must be expired (< today)");
      assert(emp.induction_expiry !== null && emp.induction_expiry < now, "Induction must be expired (< today)");
    }
  });

  // ========================================================
  // 4. Fleet Mass Generation Verification (10, 25)
  // ========================================================
  console.log("\n▶ Tier 4: Autonomous Heavy Fleet & Machinery Generation");
  console.log("-------------------------------------------------------");

  await runTest("Fleet Mass Generator: Generates 10 Heavy Machinery units with engine hours & cert requirements", async () => {
    const res = await importFleet({
      generate_count: 10,
      vehicle_class: "HEAVY",
      compliance_profile: "compliant",
    });

    assert(res.success, `Expected success, got error: ${res.error}`);
    assertEqual(res.summary.created, 10, "Expected 10 created vehicles");
    assertEqual(res.summary.errors_count, 0, "Expected 0 errors");

    const recent = await prisma.vehicles.findMany({
      take: 10,
      orderBy: { id: "desc" },
    });

    for (const veh of recent) {
      createdTestFleetIds.push(veh.fleet_id);
      assertEqual(veh.is_heavy_fleet, true, "is_heavy_fleet must be true for heavy fleet");
      assert((veh.operational_hours ?? 0) >= 500, `Expected operational_hours >= 500, got ${veh.operational_hours}`);
      assert(Boolean(veh.required_certification), "Heavy fleet must have required_certification set");
      assert(Boolean(veh.rfid_tag?.startsWith("RFID-FLT-")), `Invalid RFID: ${veh.rfid_tag}`);
      assert(Boolean(veh.qr_code?.startsWith("QR-FLT-")), `Invalid QR: ${veh.qr_code}`);
    }
  });

  await runTest("Fleet Mass Generator: Generates 25 mixed units (Heavy Excavators & Light Pit Patrols)", async () => {
    const res = await importFleet({
      generate_count: 25,
      vehicle_class: "ALL",
      compliance_profile: "realistic",
    });

    assert(res.success, `Expected success, got error: ${res.error}`);
    assertEqual(res.summary.created, 25, "Expected 25 created vehicles");
    assertEqual(res.summary.errors_count, 0, "Expected 0 errors");

    const recent = await prisma.vehicles.findMany({
      take: 25,
      orderBy: { id: "desc" },
    });

    let heavyFound = false;
    let lightFound = false;

    for (const veh of recent) {
      createdTestFleetIds.push(veh.fleet_id);
      if (veh.is_heavy_fleet) heavyFound = true;
      else lightFound = true;
      assert(Boolean(veh.license_plate), "License plate must be generated");
    }

    assert(heavyFound, "Expected at least one heavy fleet unit in mixed generation");
    assert(lightFound, "Expected at least one light vehicle in mixed generation");
  });

  // ========================================================
  // 5. CSV & JSON Import with Upsert & Collision Handling
  // ========================================================
  console.log("\n▶ Tier 5: CSV & JSON Import, Upsert, and Duplicate Collision Resolution");
  console.log("-------------------------------------------------------");

  await runTest("Employee CSV Import: Upserts existing record and creates new record simultaneously", async () => {
    const testCode1 = `TEST-EMP-${Date.now()}-A`;
    const testCode2 = `TEST-EMP-${Date.now()}-B`;
    createdTestEmpCodes.push(testCode1, testCode2);

    // Seed testCode1
    await prisma.employees.create({
      data: {
        emp_code: testCode1,
        first_name: "OriginalFirst",
        surname: "OriginalSurname",
        job_title: "Junior Welder",
        status: "Active",
      },
    });

    // Prepare CSV with update to testCode1 and brand-new testCode2
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
    assertEqual(res.summary.skipped, 0, "Expected 0 skipped records");

    // Verify DB state
    const emp1 = await prisma.employees.findUnique({ where: { emp_code: testCode1 } });
    assert(emp1 !== null, "Employee 1 must exist");
    assertEqual(emp1?.first_name, "UpdatedFirst", "First name should have been updated");
    assertEqual(emp1?.job_title, "Senior Master Welder", "Job title should have been updated");

    const emp2 = await prisma.employees.findUnique({ where: { emp_code: testCode2 } });
    assert(emp2 !== null, "Employee 2 must exist");
    assertEqual(emp2?.first_name, "NewbieFirst", "New employee first name must match");
  });

  await runTest("Employee Import: Non-upsert mode skips existing record without overwriting", async () => {
    const testCode = `TEST-EMP-${Date.now()}-SKIP`;
    createdTestEmpCodes.push(testCode);

    await prisma.employees.create({
      data: {
        emp_code: testCode,
        first_name: "ImmutableFirst",
        surname: "ImmutableSurname",
        status: "Active",
      },
    });

    const csvPayload = [
      "EMP Code,First Name,Surname",
      `${testCode},MaliciousOverwrite,MaliciousSurname`,
    ].join("\n");

    const res = await importEmployees({
      csvText: csvPayload,
      upsert: false,
    });

    assert(res.success, `Expected success, got error: ${res.error}`);
    assertEqual(res.summary.updated, 0, "Expected 0 updated records in upsert=false mode");
    assertEqual(res.summary.skipped, 1, "Expected 1 skipped record");

    const check = await prisma.employees.findUnique({ where: { emp_code: testCode } });
    assertEqual(check?.first_name, "ImmutableFirst", "Record must remain unchanged");
  });

  await runTest("Fleet JSON Import: Safely handles RFID and Machine ID collision gracefully", async () => {
    const existingFleetId = `TEST-FLT-${Date.now()}-EXIST`;
    const newFleetId = `TEST-FLT-${Date.now()}-NEW`;
    const sharedRfid = `RFID-COLLISION-${Date.now()}`;
    createdTestFleetIds.push(existingFleetId, newFleetId);

    // Create existing vehicle with the shared RFID
    await prisma.vehicles.create({
      data: {
        fleet_id: existingFleetId,
        vehicle_type: "HEAVY_FLEET",
        rfid_tag: sharedRfid,
        status: "Active",
      },
    });

    // Attempt to import new vehicle with the exact same RFID
    const res = await importFleet({
      vehicles: [
        {
          fleet_id: newFleetId,
          vehicle_type: "HEAVY_FLEET",
          rfid_tag: sharedRfid, // Collision!
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
    assert(Boolean(newVeh?.rfid_tag?.startsWith("RFID-")), "Regenerated RFID must follow valid prefix convention");
  });

  // ========================================================
  // 6. Test Teardown & Database State Restoration
  // ========================================================
  console.log("\n🧹 Purging synthetic test fixtures from database...");
  if (createdTestEmpCodes.length > 0) {
    const delEmps = await prisma.employees.deleteMany({
      where: { emp_code: { in: createdTestEmpCodes } },
    });
    console.log(`  ✔ Cleaned up ${delEmps.count} test employee records.`);
  }

  if (createdTestFleetIds.length > 0) {
    const delFleet = await prisma.vehicles.deleteMany({
      where: { fleet_id: { in: createdTestFleetIds } },
    });
    console.log(`  ✔ Cleaned up ${delFleet.count} test fleet records.`);
  }

  // ========================================================
  // Final Verification Summary
  // ========================================================
  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.filter((r) => !r.passed).length;
  const totalTests = results.length;
  const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : "0.0";

  console.log("\n=======================================================");
  console.log(" 📊 FINAL MASS IMPORT & EXPORT VERIFICATION REPORT");
  console.log("=======================================================");
  console.log(` Total Tests Run: ${totalTests}`);
  console.log(` Passed:          ${totalPassed}`);
  console.log(` Failed:          ${totalFailed}`);
  console.log(` Pass Rate:       ${passRate}%`);
  console.log("=======================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
