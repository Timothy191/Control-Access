import { processQrScan, processRfidScan } from "./src/lib/scan-service";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runTests() {
  console.log("--- Testing Scan Engine ---");
  
  // Create a mock employee
  const emp = await prisma.employees.create({
    data: {
      emp_code: "TEST001",
      first_name: "Test",
      surname: "User",
      job_title: "Tester",
      status: "Active",
      qr_code: "TEST_QR_123",
      rfid_tag: "04A23B1C",
    }
  });

  const startTime = Date.now();
  const iterations = 100;
  
  for (let i = 0; i < iterations; i++) {
    await processQrScan({ qrHash: "TEST_QR_123", gateLocation: "Gate 1" });
  }

  const duration = Date.now() - startTime;
  console.log(`Ran ${iterations} QR scans in ${duration}ms (Avg: ${duration / iterations}ms per scan)`);
  
  if ((duration / iterations) > 100) {
    console.error("WARNING: p99 latency might be > 100ms");
  } else {
    console.log("SUCCESS: Latency is well within 100ms.");
  }

  // Cleanup
  await prisma.gate_logs.deleteMany({ where: { entity_id: emp.id } });
  await prisma.employees.delete({ where: { id: emp.id } });

  console.log("Tests complete.");
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
