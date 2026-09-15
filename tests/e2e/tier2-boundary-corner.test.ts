import { TestSuite, assert, assertEqual, assertIncludes } from "./test-helpers";
import prisma from "../../src/lib/prisma";
import { processScan, evaluateGateCompliance, isDatePast, normalizeQrHash } from "../../src/lib/scan-service";
import { resolveEntityFromDatabase, extractCandidateCodes } from "../../src/lib/scan-decoder";
import { initiateKeyCheckout, verifyOperatorForKey, returnKey, getActiveKeySession } from "../../src/lib/key-custody-service";

export const tier2Suite = new TestSuite("Tier 2: Boundary Value & Edge-Case Suite (35 Tests)");

// B1: Empty and Null Input Boundaries
tier2Suite.test("B1.1: Empty raw scan string returns graceful denial without crash", async () => {
  const result = await processScan({ rawData: "" });
  assertEqual(result.accessGranted, false);
  assertEqual(result.logId, 0);
});

tier2Suite.test("B1.2: Whitespace-only scan string returns graceful denial", async () => {
  const result = await processScan({ rawData: "     " });
  assertEqual(result.accessGranted, false);
});

tier2Suite.test("B1.3: Null and undefined fields in payload handled safely", async () => {
  const result = await processScan({
    qrHash: null,
    rfidTag: null,
    rawData: null,
  });
  assertEqual(result.accessGranted, false);
});

// B2: Date Expiry Boundary Analysis
tier2Suite.test("B2.1: Date in the past (1 second ago) evaluates as past", () => {
  const past = new Date(Date.now() - 1000);
  assertEqual(isDatePast(past), true);
});

tier2Suite.test("B2.2: Date in the future (10 minutes ahead) evaluates as NOT past", () => {
  const future = new Date(Date.now() + 600000);
  assertEqual(isDatePast(future), false);
});

tier2Suite.test("B2.3: Null date evaluates as NOT past for isDatePast check", () => {
  assertEqual(isDatePast(null), false);
  assertEqual(isDatePast(undefined), false);
});

tier2Suite.test("B2.4: Invalid date string returns false without crashing", () => {
  assertEqual(isDatePast("not-a-valid-date"), false);
});

tier2Suite.test("B2.5: Medical expiring exactly yesterday triggers medical expired denial", async () => {
  const code = `BVA_MED_YEST_${Date.now()}`;
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.employees.create({
    data: {
      emp_code: code,
      first_name: "Bruce",
      surname: "Banner",
      status: "Active",
      medical_expiry: yesterday,
      induction_expiry: new Date(Date.now() + 1000000),
      rfid_tag: `TAG_${code}`,
    },
  });
  const res = await processScan({ rfidTag: `TAG_${code}` });
  assertEqual(res.accessGranted, false);
  assertEqual(res.denialReason, "Access Denied: Medical Fitness Expired");
});

tier2Suite.test("B2.6: Induction expiring tomorrow permits entry", async () => {
  const code = `BVA_IND_TOM_${Date.now()}`;
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.employees.create({
    data: {
      emp_code: code,
      first_name: "Natasha",
      surname: "Romanoff",
      status: "Active",
      medical_expiry: tomorrow,
      induction_expiry: tomorrow,
      rfid_tag: `TAG_${code}`,
    },
  });
  const res = await processScan({ rfidTag: `TAG_${code}` });
  assertEqual(res.accessGranted, true);
});

// B3: Tag & Code Normalization Boundaries
tier2Suite.test("B3.1: QR URL path normalization '/scan/HASH_123' -> 'HASH_123'", () => {
  const norm = normalizeQrHash("/scan/SECURE_HASH_999");
  assertEqual(norm, "SECURE_HASH_999");
});

tier2Suite.test("B3.2: Full URL normalization 'https://site.com/s/TOKEN?gate=1' -> 'TOKEN'", () => {
  const norm = normalizeQrHash("https://site.com/s/TOKEN_888?gate=1");
  assertEqual(norm, "TOKEN_888");
});

tier2Suite.test("B3.3: RFID candidate codes generation strips prefixes and generates uppercase", () => {
  const candidates = extractCandidateCodes("RFID_emp_007");
  assert(candidates.includes("RFID_EMP_007"), "Uppercase RFID included");
  assert(candidates.includes("EMP_007"), "Stripped prefix included");
  assert(candidates.includes("EMP007"), "No underscore included");
});

tier2Suite.test("B3.4: Case-insensitive resolution of employee badge", async () => {
  const code = `CASE_TEST_${Date.now()}`;
  await prisma.employees.create({
    data: {
      emp_code: code,
      first_name: "Wanda",
      surname: "Maximoff",
      status: "Active",
      rfid_tag: `TAG_${code.toUpperCase()}`,
    },
  });
  const resolved = await resolveEntityFromDatabase(`tag_${code.toLowerCase()}`);
  assert(resolved !== null, "Resolved despite case difference");
});

// B4: Key Custody State Machine Boundaries
tier2Suite.test("B4.1: Key session expiration triggers denial when verifying after TTL", async () => {
  const keyTag = `KEY_EXPIRE_${Date.now()}`;
  const session = await initiateKeyCheckout(keyTag, "Gate", "C66", 0);
  await new Promise((r) => setTimeout(r, 25));

  const emp = await prisma.employees.findFirst({ where: { status: "Active" } });
  const result = await verifyOperatorForKey(session.sessionId, emp!.rfid_tag || emp!.emp_code);
  assertEqual(result.status, "DENIED");
  assert(
    result.denialReason?.toLowerCase().includes("timeout") ||
    result.denialReason?.toLowerCase().includes("expired") || false,
    "Denial reason indicates timeout or expired session"
  );
});

tier2Suite.test("B4.2: Multiple key checkout initiations from same device overwrites previous active session", async () => {
  const devId = `C66_OVERWRITE_${Date.now()}`;
  await initiateKeyCheckout(`KEY_A_${Date.now()}`, "Gate", devId, 30);
  const sess2 = await initiateKeyCheckout(`KEY_B_${Date.now()}`, "Gate", devId, 30);

  const active = getActiveKeySession(devId);
  assertEqual(active?.sessionId, sess2.sessionId, "Active session is the latest one");
});

tier2Suite.test("B4.3: Non-existent key tag automatically registers key in database and initiates session", async () => {
  const newTag = `KEY_BRAND_NEW_${Date.now()}`;
  const session = await initiateKeyCheckout(newTag, "Gate", "C66", 30);
  assertEqual(session.keyId, newTag);

  const dbRecord = await prisma.keys.findUnique({ where: { key_tag: newTag } });
  assert(dbRecord !== null, "Key persisted in DB");
});

tier2Suite.test("B4.4: Key return with unassigned operator completes gracefully", async () => {
  const keyTag = `KEY_UNASSIGNED_RET_${Date.now()}`;
  await prisma.keys.create({
    data: {
      key_tag: keyTag,
      machine_id: "UNASSIGNED_MACHINE",
      status: "CHECKED_OUT",
    },
  });
  const res = await returnKey(keyTag);
  assertEqual(res.status, "IN_KEY_BOX");
});

// B5: Perimeter Lockdown and Emergency Override
tier2Suite.test("B5.1: Perimeter lockdown immediately rejects even active compliant personnel", async () => {
  await prisma.site_settings.upsert({
    where: { key: "system_lockdown" },
    create: { key: "system_lockdown", value: "true" },
    update: { value: "true" },
  });

  const emp = await prisma.employees.findFirst({ where: { status: "Active" } });
  const result = await processScan({ rfidTag: emp!.rfid_tag || emp!.emp_code });
  assertEqual(result.accessGranted, false);
  assertEqual(result.denialReason, "PERIMETER LOCKDOWN IN EFFECT");

  // Restore lockdown to false
  await prisma.site_settings.update({
    where: { key: "system_lockdown" },
    data: { value: "false" },
  });
});

tier2Suite.test("B5.2: Unregistered RFID tag creates pending approval record", async () => {
  const unregTag = `UNREG_TAG_${Date.now()}`;
  const scan = await processScan({ rfidTag: unregTag, gateLocation: "Perimeter 4" });
  assertEqual(scan.accessGranted, false);

  const approval = await prisma.approvals.findFirst({
    where: { scanned_data: { contains: unregTag } },
  });
  assert(approval !== null, "Pending approval auto-created for unregistered RFID");
});
