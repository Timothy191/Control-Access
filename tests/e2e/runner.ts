import { setupTestData, cleanupTestData } from "./test-helpers";
import { tier1Suite } from "./tier1-feature-coverage.test";
import { tier2Suite } from "./tier2-boundary-corner.test";
import { tier3Suite } from "./tier3-pairwise-combinations.test";
import { tier4Suite } from "./tier4-application-scenarios.test";

async function runAllTests() {
  console.log("\n=======================================================");
  console.log(" 🚀 CONTROL-ACCESS: SPEC-DRIVEN E2E VERIFICATION SUITE ");
  console.log("=======================================================\n");

  // Pre-test cleanup: ensure pristine starting state
  await cleanupTestData();
  await setupTestData();

  const suites = [tier1Suite, tier2Suite, tier3Suite, tier4Suite];
  let totalPassed = 0;
  let totalFailed = 0;
  const startTime = Date.now();

  try {
    for (const suite of suites) {
      console.log(`\n▶ Running Suite: ${suite.name}`);
      console.log("-------------------------------------------------------");
      const result = await suite.run();
      totalPassed += result.passed;
      totalFailed += result.failed;

      for (const r of result.results) {
        if (r.passed) {
          console.log(`  ✔ PASS: ${r.name} (${r.durationMs}ms)`);
        } else {
          console.log(`  ✖ FAIL: ${r.name} (${r.durationMs}ms)`);
          console.log(`    Error: ${r.error}`);
        }
      }
      console.log(`  Suite Summary: ${result.passed} passed, ${result.failed} failed`);
    }
  } finally {
    // Post-test cleanup: ensure ZERO lingering records remain
    console.log("\n🧹 Purging transient test records from database...");
    await cleanupTestData();
    console.log("✔ Database restored to pristine seed state.");
  }

  const totalTime = Date.now() - startTime;
  const totalTests = totalPassed + totalFailed;
  const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : "0.0";

  console.log("\n=======================================================");
  console.log(" 📊 FINAL VERIFICATION REPORT");
  console.log("=======================================================");
  console.log(` Total Suites Executed: ${suites.length}`);
  console.log(` Total Tests Run:       ${totalTests}`);
  console.log(` Passed:                ${totalPassed}`);
  console.log(` Failed:                ${totalFailed}`);
  console.log(` Pass Rate:             ${passRate}%`);
  console.log(` Duration:              ${totalTime}ms`);
  console.log("=======================================================\n");

  if (totalFailed > 0) {
    console.error(`❌ Verification FAILED with ${totalFailed} errors.`);
    process.exit(1);
  } else {
    console.log("✅ All E2E Integration and Spec Verification Tests PASSED with 100% success!");
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error("Fatal Test Runner Error:", err);
  process.exit(1);
});
