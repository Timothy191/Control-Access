/**
 * Empirical Challenger M2 Stress Harness
 * Rigorously challenges Milestone 2 UI logic, API endpoints, date calculation oracles,
 * CSS glove restraint compliance, and database integrity.
 */

import { getMedicalStatus, getInductionStatus } from "../src/components/employees/EmployeeTable";
import { evaluateExpiry } from "../src/components/fleet/FleetExplorer";
import { evaluateCalibration } from "../src/components/equipment/EquipmentExplorer";
import prisma from "../src/lib/prisma";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:8080";

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function runTest(suite: string, name: string, fn: () => void | Promise<void>) {
  const start = Date.now();
  try {
    const res = fn();
    if (res && typeof (res as Promise<void>).then === "function") {
      return (res as Promise<void>)
        .then(() => {
          results.push({ suite, name, passed: true, durationMs: Date.now() - start });
          console.log(`  ✔ PASS: [${suite}] ${name} (${Date.now() - start}ms)`);
        })
        .catch((err) => {
          results.push({ suite, name, passed: false, error: String(err), durationMs: Date.now() - start });
          console.error(`  ✘ FAIL: [${suite}] ${name} (${Date.now() - start}ms) - ${err.message}`);
        });
    } else {
      results.push({ suite, name, passed: true, durationMs: Date.now() - start });
      console.log(`  ✔ PASS: [${suite}] ${name} (${Date.now() - start}ms)`);
      return Promise.resolve();
    }
  } catch (err: any) {
    results.push({ suite, name, passed: false, error: String(err), durationMs: Date.now() - start });
    console.error(`  ✘ FAIL: [${suite}] ${name} (${Date.now() - start}ms) - ${err.message}`);
    return Promise.resolve();
  }
}

async function main() {
  console.log("\n==================================================================");
  console.log(" 🔬 EMPIRICAL CHALLENGER M2: UI & API REGRESSION STRESS HARNESS");
  console.log("==================================================================\n");

  // Record baseline DB counts
  const initialEmployeesCount = await prisma.employees.count();
  const initialVehiclesCount = await prisma.vehicles.count();
  const initialEquipmentCount = await prisma.equipment.count();
  const initialGateLogsCount = await prisma.gate_logs.count();

  // -------------------------------------------------------------------------
  // SUITE 1: Workforce & Contractor Date Evaluation Oracles
  // -------------------------------------------------------------------------
  console.log("▶ Suite 1: Workforce & Contractor Date Calculation Oracles");

  await runTest("S1-Oracles", "getMedicalStatus: null returns missing medical status", () => {
    const res = getMedicalStatus(null);
    assert(res.status === "missing", `Expected status 'missing', got ${res.status}`);
    assert(res.color === "red", `Expected color 'red', got ${res.color}`);
    assert(res.diffDays === null, `Expected diffDays null, got ${res.diffDays}`);
  });

  await runTest("S1-Oracles", "getMedicalStatus: invalid string returns invalid date status", () => {
    const res = getMedicalStatus("not-a-valid-date");
    assert(res.status === "missing", `Expected status 'missing', got ${res.status}`);
    assert(res.label === "Invalid Date", `Expected label 'Invalid Date', got ${res.label}`);
  });

  await runTest("S1-Oracles", "getMedicalStatus: past date (10 days ago) evaluates expired with red color", () => {
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const res = getMedicalStatus(past.toISOString());
    assert(res.status === "expired", `Expected status 'expired', got ${res.status}`);
    assert(res.color === "red", `Expected color 'red', got ${res.color}`);
    assert(res.label.includes("ago"), `Expected label to include 'ago', got ${res.label}`);
    assert(res.diffDays !== null && res.diffDays < 0, `Expected negative diffDays, got ${res.diffDays}`);
  });

  await runTest("S1-Oracles", "getMedicalStatus: near future (15 days ahead) evaluates warning with yellow color", () => {
    const near = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const res = getMedicalStatus(near.toISOString());
    assert(res.status === "warning", `Expected status 'warning', got ${res.status}`);
    assert(res.color === "yellow", `Expected color 'yellow', got ${res.color}`);
    assert(res.label.includes("Expires in"), `Expected label to include 'Expires in', got ${res.label}`);
  });

  await runTest("S1-Oracles", "getMedicalStatus: far future (90 days ahead) evaluates valid with green color", () => {
    const far = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const res = getMedicalStatus(far.toISOString());
    assert(res.status === "valid", `Expected status 'valid', got ${res.status}`);
    assert(res.color === "green", `Expected color 'green', got ${res.color}`);
    assert(res.label.includes("Valid"), `Expected label to include 'Valid', got ${res.label}`);
  });

  await runTest("S1-Oracles", "getInductionStatus: contractor without induction returns uninducted", () => {
    const res = getInductionStatus(null, "", true);
    assert(res.status === "uninducted", `Expected 'uninducted', got ${res.status}`);
    assert(res.label === "Uninducted Contractor", `Expected label 'Uninducted Contractor', got ${res.label}`);
    assert(res.color === "red", `Expected color 'red', got ${res.color}`);
  });

  await runTest("S1-Oracles", "getInductionStatus: contractor with text but missing date returns uninducted", () => {
    const res = getInductionStatus(null, "Standard Surface Induction", true);
    assert(res.status === "uninducted", `Expected 'uninducted', got ${res.status}`);
  });

  await runTest("S1-Oracles", "getInductionStatus: contractor with valid induction text & future expiry returns valid", () => {
    const future = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);
    const res = getInductionStatus(future.toISOString(), "Induction Certified", true);
    assert(res.status === "valid", `Expected 'valid', got ${res.status}`);
    assert(res.color === "green", `Expected 'green', got ${res.color}`);
  });

  await runTest("S1-Oracles", "getInductionStatus: employee with expired induction returns expired status", () => {
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const res = getInductionStatus(past.toISOString(), "Induction", false);
    assert(res.status === "expired", `Expected 'expired', got ${res.status}`);
    assert(res.color === "red", `Expected 'red', got ${res.color}`);
  });

  // -------------------------------------------------------------------------
  // SUITE 2: Fleet & Equipment Expiry & Calibration Oracles
  // -------------------------------------------------------------------------
  console.log("\n▶ Suite 2: Fleet & Equipment Expiry/Calibration Oracles");

  await runTest("S2-Oracles", "evaluateExpiry (Fleet): missing date returns not registered", () => {
    const res = evaluateExpiry(null);
    assert(res.status === "missing", `Expected 'missing', got ${res.status}`);
    assert(res.label === "Not Registered", `Expected 'Not Registered', got ${res.label}`);
  });

  await runTest("S2-Oracles", "evaluateExpiry (Fleet): expired roadworthy returns expired", () => {
    const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const res = evaluateExpiry(past.toISOString());
    assert(res.status === "expired", `Expected 'expired', got ${res.status}`);
    assert(res.color === "red", `Expected 'red', got ${res.color}`);
  });

  await runTest("S2-Oracles", "evaluateExpiry (Fleet): warning window (20d) returns warning", () => {
    const near = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const res = evaluateExpiry(near.toISOString());
    assert(res.status === "warning", `Expected 'warning', got ${res.status}`);
    assert(res.color === "yellow", `Expected 'yellow', got ${res.color}`);
  });

  await runTest("S2-Oracles", "evaluateCalibration (Gas Monitor): missing expiry returns REQUIRED", () => {
    const res = evaluateCalibration({ equipment_type: "GAS_MONITOR_4_GAS", calibration_expiry: null });
    assert(res.status === "REQUIRED", `Expected 'REQUIRED', got ${res.status}`);
    assert(res.color === "red", `Expected 'red', got ${res.color}`);
  });

  await runTest("S2-Oracles", "evaluateCalibration (Two-Way Radio): missing expiry returns NOT_REQUIRED", () => {
    const res = evaluateCalibration({ equipment_type: "TWO_WAY_RADIO", calibration_expiry: null });
    assert(res.status === "NOT_REQUIRED", `Expected 'NOT_REQUIRED', got ${res.status}`);
    assert(res.color === "neutral", `Expected 'neutral', got ${res.color}`);
  });

  await runTest("S2-Oracles", "evaluateCalibration (Gas Monitor): valid calibration returns VALID", () => {
    const future = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
    const res = evaluateCalibration({ equipment_type: "GAS_MONITOR_4_GAS", calibration_expiry: future.toISOString() });
    assert(res.status === "VALID", `Expected 'VALID', got ${res.status}`);
    assert(res.color === "green", `Expected 'green', got ${res.color}`);
  });

  await runTest("S2-Oracles", "evaluateCalibration (Gas Monitor): expired calibration returns EXPIRED", () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const res = evaluateCalibration({ equipment_type: "GAS_DETECTOR_MULTIGAS", calibration_expiry: past.toISOString() });
    assert(res.status === "EXPIRED", `Expected 'EXPIRED', got ${res.status}`);
    assert(res.color === "red", `Expected 'red', got ${res.color}`);
  });

  // -------------------------------------------------------------------------
  // SUITE 3: HTTP API Live Endpoints & Schema Compliance
  // -------------------------------------------------------------------------
  console.log("\n▶ Suite 3: Live API Endpoints & Contract Compliance");

  await runTest("S3-API", "GET /api/fleet returns 200 with summary and vehicle list", async () => {
    const res = await fetch(`${BASE_URL}/api/fleet`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, "Expected success: true");
    assert(typeof data.total === "number", "Expected total to be number");
    assert(Array.isArray(data.vehicles), "Expected vehicles array");
    assert(data.summary && typeof data.summary.heavy_fleet_count === "number", "Expected summary object");
    for (const v of data.vehicles) {
      assert(typeof v.id === "number", "Vehicle id must be number");
      assert(typeof v.fleet_id === "string", "Vehicle fleet_id must be string");
      assert(v.compliance_status !== undefined, "compliance_status must be present");
      assert(typeof v.compliance_status.is_compliant === "boolean", "is_compliant must be boolean");
    }
  });

  await runTest("S3-API", "GET /api/equipment returns 200 with equipment list and calibration_status", async () => {
    const res = await fetch(`${BASE_URL}/api/equipment`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, "Expected success: true");
    assert(typeof data.total === "number", "Expected total to be number");
    assert(Array.isArray(data.equipment), "Expected equipment array");
    for (const e of data.equipment) {
      assert(typeof e.id === "number", "Equipment id must be number");
      assert(typeof e.radio_id === "string", "Equipment radio_id must be string");
      assert(e.calibration_status !== undefined, "calibration_status must be present");
      assert(typeof e.calibration_status.is_calibrated === "boolean", "is_calibrated must be boolean");
      assert(typeof e.calibration_status.status === "string", "status must be string");
    }
  });

  await runTest("S3-API", "Adversarial: SQL injection payload in /api/fleet?search= handles safely", async () => {
    const res = await fetch(`${BASE_URL}/api/fleet?search=' OR 1=1 --`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, "Expected valid json response");
    assert(Array.isArray(data.vehicles), "Expected vehicles array");
  });

  await runTest("S3-API", "Adversarial: Extremely large limit /api/fleet?limit=99999 is capped", async () => {
    const res = await fetch(`${BASE_URL}/api/fleet?limit=99999`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.limit <= 500, `Expected limit capped at 500, got ${data.limit}`);
  });

  await runTest("S3-API", "Adversarial: Unicode & emoji search in /api/equipment?search= handles safely", async () => {
    const res = await fetch(`${BASE_URL}/api/equipment?search=${encodeURIComponent("🔥🚀⚙️")}`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, "Expected success");
    assert(data.equipment.length === 0, "Expected 0 results for non-matching emoji");
  });

  // -------------------------------------------------------------------------
  // SUITE 4: CSS Layout Constraints & Industrial Touch Targets
  // -------------------------------------------------------------------------
  console.log("\n▶ Suite 4: CSS Layout Constraints & Glove Touch Target Scanner");

  const sidebarPath = path.resolve(__dirname, "../src/components/layout/Sidebar.tsx");
  const scannerPath = path.resolve(__dirname, "../src/app/scanner/page.tsx");
  const approvalCardPath = path.resolve(__dirname, "../src/components/approvals/ApprovalCard.tsx");

  await runTest("S4-CSS", "Sidebar.tsx enforces min-h-[48px] on nav items and 8px gap", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert(content.includes("min-h-[48px]"), "Sidebar must contain min-h-[48px]");
    assert(content.includes("gap-2"), "Sidebar nav list must enforce gap-2 (8px adjacent separation)");
    assert(content.includes("/employees"), "Sidebar must contain direct link to /employees");
    assert(content.includes("/fleet"), "Sidebar must contain direct link to /fleet");
    assert(content.includes("/equipment"), "Sidebar must contain direct link to /equipment");
  });

  await runTest("S4-CSS", "scanner/page.tsx enforces 48x48px glove touch targets on dispatch button and kiosk bounce prevention", () => {
    const content = fs.readFileSync(scannerPath, "utf-8");
    assert(content.includes("min-h-[48px]"), "Scanner page must contain min-h-[48px] buttons");
    assert(content.includes("min-w-[48px]"), "Scanner page must contain min-w-[48px] on dispatch button");
    assert(content.includes("kiosk-container"), "Scanner page must contain kiosk-container class");
    assert(content.includes("overscroll-contain") || content.includes("overflow-hidden"), "Scanner must prevent bounce");
  });

  await runTest("S4-CSS", "ApprovalCard.tsx enforces min-h-[38px] desktop touch target", () => {
    const content = fs.readFileSync(approvalCardPath, "utf-8");
    assert(content.includes("min-h-[38px]"), "ApprovalCard must contain min-h-[38px] on action controls");
  });

  // -------------------------------------------------------------------------
  // SUITE 5: Database Integrity Oracle
  // -------------------------------------------------------------------------
  console.log("\n▶ Suite 5: Database Integrity & Residual State Oracle");

  await runTest("S5-DB", "Zero lingering test rows and pristine database baseline", async () => {
    const finalEmployeesCount = await prisma.employees.count();
    const finalVehiclesCount = await prisma.vehicles.count();
    const finalEquipmentCount = await prisma.equipment.count();
    const finalGateLogsCount = await prisma.gate_logs.count();

    assert(finalEmployeesCount === initialEmployeesCount, `Employees count mutated: ${initialEmployeesCount} -> ${finalEmployeesCount}`);
    assert(finalVehiclesCount === initialVehiclesCount, `Vehicles count mutated: ${initialVehiclesCount} -> ${finalVehiclesCount}`);
    assert(finalEquipmentCount === initialEquipmentCount, `Equipment count mutated: ${initialEquipmentCount} -> ${finalEquipmentCount}`);
    assert(finalGateLogsCount === initialGateLogsCount, `Gate logs count mutated: ${initialGateLogsCount} -> ${finalGateLogsCount}`);

    // Check for any temporary test records in database
    const lingeringTestEmployees = await prisma.employees.findMany({
      where: {
        OR: [
          { emp_code: { startsWith: "TEST_" } },
          { emp_code: { startsWith: "STRESS_" } },
          { first_name: { startsWith: "TEST_" } },
        ],
      },
    });
    assert(lingeringTestEmployees.length === 0, `Found ${lingeringTestEmployees.length} lingering test employees`);

    const lingeringTestVehicles = await prisma.vehicles.findMany({
      where: {
        OR: [
          { fleet_id: { startsWith: "TEST_" } },
          { fleet_id: { startsWith: "STRESS_" } },
        ],
      },
    });
    assert(lingeringTestVehicles.length === 0, `Found ${lingeringTestVehicles.length} lingering test vehicles`);

    const lingeringTestEquipment = await prisma.equipment.findMany({
      where: {
        OR: [
          { radio_id: { startsWith: "TEST_" } },
          { radio_id: { startsWith: "STRESS_" } },
        ],
      },
    });
    assert(lingeringTestEquipment.length === 0, `Found ${lingeringTestEquipment.length} lingering test equipment`);
  });

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n==================================================================");
  console.log(" 📊 CHALLENGER M2 STRESS HARNESS SUMMARY");
  console.log("==================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log(` Total Assertions: ${total}`);
  console.log(` Passed:           ${passed}`);
  console.log(` Failed:           ${failed}`);
  console.log(` Pass Rate:        ${passRate}%`);
  console.log("==================================================================\n");

  if (failed > 0) {
    console.error(`❌ STRESS HARNESS FAILED: ${failed} assertions failed.`);
    process.exit(1);
  } else {
    console.log(`✅ ALL ${total} EMPIRICAL CHALLENGER M2 ASSERTIONS PASSED (100%).`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Unhandled harness error:", err);
  process.exit(1);
});
