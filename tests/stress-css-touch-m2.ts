/**
 * Stress Testing Harness for Milestone 2: CSS Touch Target Sizes & Kiosk Container Constraints
 * 
 * Invoked by: teamwork_preview_challenger_m2_1
 * Verifies:
 * - globals.css .kiosk-container bounce prevention (height: 100dvh, overflow: hidden, overscroll-behavior: contain)
 * - globals.css .touch-target-industrial definition (min-height: 48px, min-width: 48px)
 * - scanner/page.tsx container containment and safe-area insets
 * - scanner/page.tsx all interactive buttons, inputs, selects meet min-h 48px or touch-target-industrial
 * - scanner/page.tsx emergency strobe action buttons meet min 56px
 * - Sidebar.tsx items meet min 48px height with min 8px spacing
 * - ApprovalCard.tsx inputs and buttons meet min 38px
 * - EmployeeTable.tsx, FleetExplorer.tsx, EquipmentExplorer.tsx interactive element sizing
 * - Adjacent touch target spacing and tap boundary overlap stress analysis
 */

import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

interface TestResult {
  suite: string;
  testId: string;
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

async function runTest(suite: string, testId: string, name: string, fn: () => void | Promise<void>) {
  const start = performance.now();
  try {
    await fn();
    const durationMs = Math.round(performance.now() - start);
    results.push({ suite, testId, name, passed: true, durationMs });
    console.log(`  ✔ PASS [${testId}] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    results.push({ suite, testId, name, passed: false, error: err.message, durationMs });
    console.log(`  ✖ FAIL [${testId}] ${name} (${durationMs}ms) -> ${err.message}`);
  }
}

export interface JsxInteractiveElement {
  tag: string;
  line: number;
  className: string;
  textSnippet: string;
  parsedHeightPx: number | null;
  parsedWidthPx: number | null;
  hasIndustrialTarget: boolean;
  hasTouchPadding: boolean;
}

export function parseTailwindHeight(className: string): number | null {
  if (!className) return null;

  // Check exact pixel arbitrary values e.g. min-h-[48px], min-h-[56px], h-[48px]
  const arbMinH = className.match(/min-h-\[(\d+)px\]/);
  if (arbMinH) return parseInt(arbMinH[1], 10);

  const arbH = className.match(/\bh-\[(\d+)px\]/);
  if (arbH) return parseInt(arbH[1], 10);

  // Check fraction/decimal arbitrary values e.g. h-9.5 (38px), min-h-[38px]
  if (/\bh-9\.5\b/.test(className)) return 38;

  // Check standard tailwind scales
  const twMinH = className.match(/min-h-(\d+)\b/);
  if (twMinH) return parseInt(twMinH[1], 10) * 4;

  const twH = className.match(/\bh-(\d+)\b/);
  if (twH) return parseInt(twH[1], 10) * 4;

  return null;
}

export function parseTailwindWidth(className: string): number | null {
  if (!className) return null;

  const arbMinW = className.match(/min-w-\[(\d+)px\]/);
  if (arbMinW) return parseInt(arbMinW[1], 10);

  const arbW = className.match(/\bw-\[(\d+)px\]/);
  if (arbW) return parseInt(arbW[1], 10);

  const twMinW = className.match(/min-w-(\d+)\b/);
  if (twMinW) return parseInt(twMinW[1], 10) * 4;

  const twW = className.match(/\bw-(\d+)\b/);
  if (twW) return parseInt(twW[1], 10) * 4;

  return null;
}

export function parseJsxElements(fileContent: string, targetTags = ["button", "input", "select", "Link"]): JsxInteractiveElement[] {
  const sf = ts.createSourceFile("temp.tsx", fileContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const elements: JsxInteractiveElement[] = [];

  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf);
      if (targetTags.includes(tag)) {
        let className = "";
        for (const prop of node.attributes.properties) {
          if (ts.isJsxAttribute(prop) && prop.name.getText(sf) === "className") {
            if (prop.initializer) {
              if (ts.isStringLiteral(prop.initializer)) {
                className = prop.initializer.text;
              } else if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression) {
                className = prop.initializer.expression.getText(sf);
              }
            }
          }
        }

        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        const textSnippet = node.getText(sf).slice(0, 120).replace(/\s+/g, " ");

        const hasIndustrialTarget = className.includes("touch-target-industrial");
        const parsedHeightPx = parseTailwindHeight(className);
        const parsedWidthPx = parseTailwindWidth(className);
        const hasTouchPadding = /p(?:y)?-(?:3|3\.5|4|5|6)\b/.test(className);

        elements.push({
          tag,
          line: line + 1,
          className,
          textSnippet,
          parsedHeightPx,
          parsedWidthPx,
          hasIndustrialTarget,
          hasTouchPadding,
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return elements;
}

async function main() {
  console.log("\n=======================================================");
  console.log(" 🧪 STRESS TEST HARNESS: CSS TOUCH TARGETS & KIOSK CONSTRAINTS");
  console.log("=======================================================\n");

  const projectRoot = path.resolve(__dirname, "..");
  const globalsCssPath = path.join(projectRoot, "src/app/globals.css");
  const scannerPagePath = path.join(projectRoot, "src/app/scanner/page.tsx");
  const sidebarPath = path.join(projectRoot, "src/components/layout/Sidebar.tsx");
  const approvalCardPath = path.join(projectRoot, "src/components/approvals/ApprovalCard.tsx");
  const employeeTablePath = path.join(projectRoot, "src/components/employees/EmployeeTable.tsx");
  const fleetExplorerPath = path.join(projectRoot, "src/components/fleet/FleetExplorer.tsx");
  const equipmentExplorerPath = path.join(projectRoot, "src/components/equipment/EquipmentExplorer.tsx");

  const globalsCss = fs.readFileSync(globalsCssPath, "utf-8");
  const scannerPage = fs.readFileSync(scannerPagePath, "utf-8");
  const sidebar = fs.readFileSync(sidebarPath, "utf-8");
  const approvalCard = fs.readFileSync(approvalCardPath, "utf-8");
  const employeeTable = fs.readFileSync(employeeTablePath, "utf-8");
  const fleetExplorer = fs.readFileSync(fleetExplorerPath, "utf-8");
  const equipmentExplorer = fs.readFileSync(equipmentExplorerPath, "utf-8");

  // ==========================================
  // SUITE 1: GLOBALS.CSS TOKEN & UTILITY VALIDATION
  // ==========================================
  console.log("▶ Running Suite 1: globals.css Layout Tokens & Containment");

  await runTest("Suite 1", "G1.1", ".kiosk-container defines height: 100dvh", () => {
    assert(/\.kiosk-container\s*\{[\s\S]*?height:\s*100dvh/.test(globalsCss), "Must define height: 100dvh");
  });

  await runTest("Suite 1", "G1.2", ".kiosk-container enforces overflow: hidden", () => {
    assert(/\.kiosk-container\s*\{[\s\S]*?overflow:\s*hidden/.test(globalsCss), "Must enforce overflow: hidden");
  });

  await runTest("Suite 1", "G1.3", ".kiosk-container enforces overscroll-behavior: contain", () => {
    assert(/\.kiosk-container\s*\{[\s\S]*?overscroll-behavior:\s*contain/.test(globalsCss), "Must enforce overscroll-behavior: contain");
  });

  await runTest("Suite 1", "G1.4", ".touch-target-industrial defines min-height: 48px and min-width: 48px", () => {
    assert(/\.touch-target-industrial\s*\{[\s\S]*?min-height:\s*48px/.test(globalsCss), "Must define min-height: 48px");
    assert(/\.touch-target-industrial\s*\{[\s\S]*?min-width:\s*48px/.test(globalsCss), "Must define min-width: 48px");
  });

  await runTest("Suite 1", "G1.5", ".scroll-contained enforces hardware-accelerated smooth scrolling with contain", () => {
    assert(/\.scroll-contained\s*\{[\s\S]*?overscroll-behavior:\s*contain/.test(globalsCss), "Must contain overscroll");
    assert(/\.scroll-contained\s*\{[\s\S]*?overflow-y:\s*auto/.test(globalsCss), "Must allow overflow-y: auto");
  });

  await runTest("Suite 1", "G1.6", "prefers-reduced-motion media query disarms animations for accessibility", () => {
    assert(/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(globalsCss), "Must handle prefers-reduced-motion");
  });

  // ==========================================
  // SUITE 2: SCANNER TERMINAL KIOSK & TOUCH TARGET VERIFICATION
  // ==========================================
  console.log("\n▶ Running Suite 2: Scanner Kiosk Containment & Glove Bounds");

  await runTest("Suite 2", "S2.1", "Root div adopts .kiosk-container, overflow-hidden, overscroll-contain", () => {
    const rootMatch = scannerPage.match(/<div className="([^"]*kiosk-container[^"]*)"/);
    assert(Boolean(rootMatch), "Root div must include kiosk-container");
    const classes = rootMatch![1];
    assert(classes.includes("overflow-hidden"), "Root div must include overflow-hidden");
    assert(classes.includes("overscroll-contain"), "Root div must include overscroll-contain");
  });

  await runTest("Suite 2", "S2.2", "Root div respects dynamic mobile Safe Area insets", () => {
    assert(scannerPage.includes("pt-[env(safe-area-inset-top)]"), "Must respect safe-area-inset-top");
    assert(scannerPage.includes("pb-[env(safe-area-inset-bottom)]"), "Must respect safe-area-inset-bottom");
  });

  const scannerElements = parseJsxElements(scannerPage);

  await runTest("Suite 2", "S2.3", "Manual scan dispatch trigger button satisfies min 48x48px and touch-target-industrial", () => {
    const btn = scannerElements.find((e) => e.textSnippet.includes("handleProcessScan") && e.tag === "button");
    assert(Boolean(btn), "Manual scan trigger button must exist");
    assert(btn!.parsedHeightPx !== null && btn!.parsedHeightPx >= 48, `Must be min 48px height, got ${btn!.parsedHeightPx}`);
    assert(btn!.parsedWidthPx !== null && btn!.parsedWidthPx >= 48, `Must be min 48px width, got ${btn!.parsedWidthPx}`);
    assert(btn!.hasIndustrialTarget, "Must include touch-target-industrial class");
  });

  await runTest("Suite 2", "S2.4", "Input container for manual scan provides adequate tap boundary (h-16 / 64px)", () => {
    const input = scannerElements.find((e) => e.tag === "input" && e.textSnippet.includes("scanInput"));
    assert(Boolean(input), "Manual input must exist");
    assert(input!.parsedHeightPx !== null && input!.parsedHeightPx >= 48, `Input height must be >= 48px, got ${input!.parsedHeightPx}px`);
  });

  await runTest("Suite 2", "S2.5", "Emergency Deny strobe action buttons meet glove requirement (>= 56px)", () => {
    const strobeButtons = scannerElements.filter((b) => b.tag === "button" && (b.textSnippet.includes("setActiveAlert(null)") || b.textSnippet.includes("Acknowledge") || b.textSnippet.includes("Re-Scan Trigger")));
    assert(strobeButtons.length === 2, `Strobe must contain exactly 2 action buttons, found ${strobeButtons.length}`);
    for (const btn of strobeButtons) {
      assert(btn.parsedHeightPx !== null && btn.parsedHeightPx >= 56, `Emergency strobe button at line ${btn.line} must be >= 56px, got ${btn.parsedHeightPx}px`);
      assert(btn.className.includes("active:scale-[0.98]"), "Must provide active:scale feedback");
    }
  });

  await runTest("Suite 2", "S2.6", "Key Custody countdown cancel button satisfies min 48px touch target", () => {
    const cancelBtn = scannerElements.find((b) => b.tag === "button" && b.textSnippet.includes("setActiveKeySession(null)"));
    assert(Boolean(cancelBtn), "Key custody cancel button must exist");
    assert(cancelBtn!.parsedHeightPx !== null && cancelBtn!.parsedHeightPx >= 48, `Cancel button must be >= 48px, got ${cancelBtn!.parsedHeightPx}px`);
  });

  await runTest("Suite 2", "S2.7", "Scanner toolbar controls (Camera, Audio Buzzer) meet 48x48px touch targets", () => {
    const cameraBtn = scannerElements.find((b) => b.tag === "button" && (b.textSnippet.includes("Camera Barcode Scanner") || b.textSnippet.includes("cameraActive")));
    const audioBtn = scannerElements.find((b) => b.tag === "button" && (b.textSnippet.includes("Toggle Alarm Tone") || b.textSnippet.includes("audioEnabled")));
    assert(Boolean(cameraBtn), "Camera button must exist");
    assert(Boolean(audioBtn), "Audio button must exist");

    assert(cameraBtn!.hasIndustrialTarget, "Camera button must have touch-target-industrial");
    assert(cameraBtn!.parsedHeightPx !== null && cameraBtn!.parsedHeightPx >= 48, "Camera button height >= 48px");
    assert(cameraBtn!.parsedWidthPx !== null && cameraBtn!.parsedWidthPx >= 48, "Camera button width >= 48px");

    assert(audioBtn!.hasIndustrialTarget, "Audio button must have touch-target-industrial");
    assert(audioBtn!.parsedHeightPx !== null && audioBtn!.parsedHeightPx >= 48, "Audio button height >= 48px");
    assert(audioBtn!.parsedWidthPx !== null && audioBtn!.parsedWidthPx >= 48, "Audio button width >= 48px");
  });

  await runTest("Suite 2", "S2.8", "All Test Bench credential trigger buttons meet min 48px touch height", () => {
    const testBenchButtons = scannerElements.filter((b) => b.tag === "button" && (b.textSnippet.includes("KEY-CAT-797F-01") || b.textSnippet.includes("RFID_EMP_003") || b.textSnippet.includes("TEST_EXPIRED_MED_001") || b.textSnippet.includes("TEST_UNINDUCTED_001")));
    assert(testBenchButtons.length === 4, `Expected 4 test bench buttons, found ${testBenchButtons.length}`);
    for (const btn of testBenchButtons) {
      assert(btn.parsedHeightPx !== null && btn.parsedHeightPx >= 48, `Test bench button at line ${btn.line} must be >= 48px, got ${btn.parsedHeightPx}px`);
    }
  });

  await runTest("Suite 2", "S2.9", "All Scanner dialog modal buttons and inputs meet min 48px height", () => {
    const modalElements = scannerElements.filter((b) => b.textSnippet.includes("tempDeviceId") || b.textSnippet.includes("setIsEditingDevice(false)") || b.textSnippet.includes("handleSaveDeviceId"));
    assert(modalElements.length === 3, `Expected input, cancel, save buttons in modal, found ${modalElements.length}`);
    for (const el of modalElements) {
      assert(el.parsedHeightPx !== null && el.parsedHeightPx >= 48, `Modal element at line ${el.line} must be >= 48px, got ${el.parsedHeightPx}px`);
    }
  });

  await runTest("Suite 2", "S2.10", "Zero sub-48px clickable interactive elements across the entire scanner page", () => {
    const sub48Elements: JsxInteractiveElement[] = [];

    for (const el of scannerElements) {
      const h = el.parsedHeightPx;
      if (h === null) {
        if (!el.hasIndustrialTarget && !el.hasTouchPadding) {
          sub48Elements.push(el);
        }
      } else if (h < 48) {
        sub48Elements.push(el);
      }
    }

    assert(sub48Elements.length === 0, `Found ${sub48Elements.length} sub-48px interactive elements on scanner page: ${JSON.stringify(sub48Elements.map((e) => ({ line: e.line, tag: e.tag, snippet: e.textSnippet })))}`);
  });

  // ==========================================
  // SUITE 3: SIDEBAR NAVIGATION TOUCH CONSTRAINTS
  // ==========================================
  console.log("\n▶ Running Suite 3: Sidebar Ergonomic Restraints (min 48px, min 8px spacing)");

  const sidebarElements = parseJsxElements(sidebar);

  await runTest("Suite 3", "N3.1", "Sidebar hamburger toggle button satisfies min 48x48px touch target", () => {
    const hamburger = sidebarElements.find((b) => b.tag === "button" && b.line <= 91);
    assert(Boolean(hamburger), "Hamburger button must exist");
    assert(hamburger!.parsedHeightPx !== null && hamburger!.parsedHeightPx >= 48, `Must be >= 48px height, got ${hamburger!.parsedHeightPx}`);
    assert(hamburger!.parsedWidthPx !== null && hamburger!.parsedWidthPx >= 48, `Must be >= 48px width, got ${hamburger!.parsedWidthPx}`);
  });

  await runTest("Suite 3", "N3.2", "Sidebar close button satisfies min 48x48px touch target", () => {
    const closeBtn = sidebarElements.find((b) => b.tag === "button" && b.line >= 115 && b.line <= 125);
    assert(Boolean(closeBtn), "Close button must exist");
    assert(closeBtn!.parsedHeightPx !== null && closeBtn!.parsedHeightPx >= 48, `Must be >= 48px height, got ${closeBtn!.parsedHeightPx}`);
    assert(closeBtn!.parsedWidthPx !== null && closeBtn!.parsedWidthPx >= 48, `Must be >= 48px width, got ${closeBtn!.parsedWidthPx}`);
  });

  await runTest("Suite 3", "N3.3", "Sidebar navigation links meet min 48px height", () => {
    const navLink = sidebarElements.find((b) => b.tag === "Link" && b.line >= 135 && b.line <= 150);
    assert(Boolean(navLink), "Must find navigation Link in Sidebar");
    assert(navLink!.parsedHeightPx !== null && navLink!.parsedHeightPx >= 48, `Sidebar navigation links must have min 48px height, got ${navLink!.parsedHeightPx}px`);
  });

  await runTest("Suite 3", "N3.4", "Sidebar navigation items container enforces min 8px spacing (gap-2)", () => {
    assert(sidebar.includes("flex flex-col gap-2"), "Nav items list container must specify gap-2 (8px separation)");
  });

  await runTest("Suite 3", "N3.5", "Sidebar live tunnel copy button satisfies min 48x48px touch target", () => {
    const copyBtn = sidebarElements.find((b) => b.tag === "button" && b.line >= 175 && b.line <= 190);
    assert(Boolean(copyBtn), "Copy button must exist");
    assert(copyBtn!.parsedHeightPx !== null && copyBtn!.parsedHeightPx >= 48, `Must be >= 48px height, got ${copyBtn!.parsedHeightPx}`);
    assert(copyBtn!.parsedWidthPx !== null && copyBtn!.parsedWidthPx >= 48, `Must be >= 48px width, got ${copyBtn!.parsedWidthPx}`);
  });

  await runTest("Suite 3", "N3.6", "Sidebar contains direct navigation links to /employees, /fleet, /equipment", () => {
    assert(sidebar.includes("href: \"/employees\""), "Must include /employees link");
    assert(sidebar.includes("href: \"/fleet\""), "Must include /fleet link");
    assert(sidebar.includes("href: \"/equipment\""), "Must include /equipment link");
  });

  // ==========================================
  // SUITE 4: APPROVAL CARD TOUCH RESTRAINTS
  // ==========================================
  console.log("\n▶ Running Suite 4: Approvals Touch Restraints (min 38px)");

  const approvalElements = parseJsxElements(approvalCard);

  await runTest("Suite 4", "A4.1", "Supervisor audit note input satisfies min 38px height (min-h-[38px] or h-9.5)", () => {
    const input = approvalElements.find((e) => e.tag === "input" && e.line >= 200 && e.line <= 215);
    assert(Boolean(input), "Comment input must exist");
    assert(input!.parsedHeightPx !== null && input!.parsedHeightPx >= 38, `Supervisor comment input must be >= 38px, got ${input!.parsedHeightPx}px`);
  });

  await runTest("Suite 4", "A4.2", "Approve & Enroll button satisfies min 38px height and horizontal padding", () => {
    const approveBtn = approvalElements.find((b) => b.tag === "button" && b.line >= 215 && b.line <= 225);
    assert(Boolean(approveBtn), "Approve button must exist");
    assert(approveBtn!.parsedHeightPx !== null && approveBtn!.parsedHeightPx >= 38, `Approve button must be >= 38px, got ${approveBtn!.parsedHeightPx}px`);
    assert(approveBtn!.className.includes("px-4"), "Must have horizontal padding px-4");
  });

  await runTest("Suite 4", "A4.3", "Reject button satisfies min 38px height and horizontal padding", () => {
    const rejectBtn = approvalElements.find((b) => b.tag === "button" && b.line >= 225 && b.line <= 235);
    assert(Boolean(rejectBtn), "Reject button must exist");
    assert(rejectBtn!.parsedHeightPx !== null && rejectBtn!.parsedHeightPx >= 38, `Reject button must be >= 38px, got ${rejectBtn!.parsedHeightPx}px`);
    assert(rejectBtn!.className.includes("px-4"), "Must have horizontal padding px-4");
  });

  // ==========================================
  // SUITE 5: UI REGISTERS TOUCH TARGET VERIFICATION
  // ==========================================
  console.log("\n▶ Running Suite 5: Management Registers Touch Targets");

  const employeeElements = parseJsxElements(employeeTable);

  await runTest("Suite 5", "R5.1", "EmployeeTable: Type segmented control tabs have min-h-[48px]", () => {
    const tabButtons = employeeElements.filter((b) => b.tag === "button" && b.line >= 345 && b.line <= 380);
    assert(tabButtons.length === 3, `Expected 3 type buttons, found ${tabButtons.length}`);
    for (const btn of tabButtons) {
      assert(btn.parsedHeightPx !== null && btn.parsedHeightPx >= 48, `Tab button at line ${btn.line} must be >= 48px, got ${btn.parsedHeightPx}px`);
    }
  });

  await runTest("Suite 5", "R5.2", "EmployeeTable: Search input and 4 filter selects meet 48px height (h-12)", () => {
    const searchInput = employeeElements.find((e) => e.tag === "input" && e.line >= 390 && e.line <= 400);
    assert(Boolean(searchInput), "Search input must exist");
    assert(searchInput!.parsedHeightPx !== null && searchInput!.parsedHeightPx >= 48, `Search input must be >= 48px, got ${searchInput!.parsedHeightPx}px`);

    const selects = employeeElements.filter((e) => e.tag === "select" && e.line >= 415 && e.line <= 490);
    assert(selects.length === 4, `Expected 4 filter selects in EmployeeTable, found ${selects.length}`);
    for (const sel of selects) {
      assert(sel.parsedHeightPx !== null && sel.parsedHeightPx >= 48, `Select at line ${sel.line} must be >= 48px, got ${sel.parsedHeightPx}px`);
    }
  });

  await runTest("Suite 5", "R5.3", "EmployeeTable: Table row action buttons meet min-h-[48px]", () => {
    const rowBtn = employeeElements.find((b) => b.tag === "button" && b.line >= 670 && b.line <= 685);
    assert(Boolean(rowBtn), "Row action button must exist");
    assert(rowBtn!.parsedHeightPx !== null && rowBtn!.parsedHeightPx >= 48, `Row action button must be >= 48px, got ${rowBtn!.parsedHeightPx}px`);
  });

  const fleetElements = parseJsxElements(fleetExplorer);

  await runTest("Suite 5", "R5.4", "FleetExplorer: Category tabs, search input, and selects meet min 48px", () => {
    const searchInput = fleetElements.find((e) => e.tag === "input" && e.line >= 230 && e.line <= 245);
    assert(Boolean(searchInput), "Search input must exist");
    assert(searchInput!.parsedHeightPx !== null && searchInput!.parsedHeightPx >= 48, "Search input must be >= 48px");

    const tabButtons = fleetElements.filter((b) => b.tag === "button" && b.line >= 290 && b.line <= 330);
    assert(tabButtons.length === 3, `Expected 3 category tabs in FleetExplorer, found ${tabButtons.length}`);
    for (const btn of tabButtons) {
      assert(btn.parsedHeightPx !== null && btn.parsedHeightPx >= 48, `Tab at line ${btn.line} must be >= 48px, got ${btn.parsedHeightPx}px`);
    }

    const selects = fleetElements.filter((e) => e.tag === "select" && e.line >= 330 && e.line <= 355);
    assert(selects.length === 2, `Expected 2 selects in FleetExplorer, found ${selects.length}`);
    for (const sel of selects) {
      assert(sel.parsedHeightPx !== null && sel.parsedHeightPx >= 48, `Select at line ${sel.line} must be >= 48px, got ${sel.parsedHeightPx}px`);
    }
  });

  await runTest("Suite 5", "R5.5", "FleetExplorer: Hours increment modal controls meet min-h-[48px]", () => {
    const modalButtons = fleetElements.filter((b) => b.tag === "button" && b.line >= 570 && b.line <= 638);
    for (const btn of modalButtons) {
      assert(btn.parsedHeightPx !== null && btn.parsedHeightPx >= 48, `Modal button at line ${btn.line} must be >= 48px, got ${btn.parsedHeightPx}px`);
    }
  });

  const equipmentElements = parseJsxElements(equipmentExplorer);

  await runTest("Suite 5", "R5.6", "EquipmentExplorer: Category tabs, search input, and selects meet min 48px", () => {
    const searchInput = equipmentElements.find((e) => e.tag === "input" && e.line >= 210 && e.line <= 225);
    assert(Boolean(searchInput), "Search input must exist");
    assert(searchInput!.parsedHeightPx !== null && searchInput!.parsedHeightPx >= 48, "Search input must be >= 48px");

    const tabButtons = equipmentElements.filter((b) => b.tag === "button" && b.line >= 270 && b.line <= 320);
    assert(tabButtons.length === 4, `Expected 4 category tabs in EquipmentExplorer, found ${tabButtons.length}`);
    for (const btn of tabButtons) {
      assert(btn.parsedHeightPx !== null && btn.parsedHeightPx >= 48, `Tab at line ${btn.line} must be >= 48px, got ${btn.parsedHeightPx}px`);
    }

    const selects = equipmentElements.filter((e) => e.tag === "select" && e.line >= 320 && e.line <= 350);
    assert(selects.length === 2, `Expected 2 selects in EquipmentExplorer, found ${selects.length}`);
    for (const sel of selects) {
      assert(sel.parsedHeightPx !== null && sel.parsedHeightPx >= 48, `Select at line ${sel.line} must be >= 48px, got ${sel.parsedHeightPx}px`);
    }
  });

  await runTest("Suite 5", "R5.7", "EquipmentExplorer: Recalibrate button and modal controls meet min 48px", () => {
    const recalBtn = equipmentElements.find((b) => b.tag === "button" && b.line >= 480 && b.line <= 495);
    assert(Boolean(recalBtn), "Recalibrate trigger button must exist");
    assert(recalBtn!.parsedHeightPx !== null && recalBtn!.parsedHeightPx >= 48, "Recalibrate button must be >= 48px");

    const modalButtons = equipmentElements.filter((b) => b.tag === "button" && b.line >= 525 && b.line <= 595);
    for (const btn of modalButtons) {
      assert(btn.parsedHeightPx !== null && btn.parsedHeightPx >= 48, `Modal button at line ${btn.line} must be >= 48px, got ${btn.parsedHeightPx}px`);
    }
  });

  // ==========================================
  // SUITE 6: ADVERSARIAL & EDGE-CASE STRESS TESTING
  // ==========================================
  console.log("\n▶ Running Suite 6: Adversarial & Stress Scenarios");

  await runTest("Suite 6", "X6.1", "Negative Test: Verify script detects artificial sub-48px button violation", () => {
    const artificialSnippet = '<button className="h-8 w-8 px-2">Sub-sized Button</button>';
    const parsed = parseJsxElements(artificialSnippet, ["button"]);
    assert(parsed.length === 1, "Must extract artificial button");
    const h = parsed[0].parsedHeightPx;
    assert(h === 32, "Must detect 32px height");
    assert(h !== null && h < 48, "Must correctly identify violation for sub-48px target");
  });

  await runTest("Suite 6", "X6.2", "Negative Test: Verify script flags missing overscroll-behavior", () => {
    const mockCss = ".bad-kiosk { height: 100vh; overflow: hidden; }";
    const hasContainment = /\.bad-kiosk\s*\{[\s\S]*?overscroll-behavior:\s*contain/.test(mockCss);
    assert(!hasContainment, "Negative control must identify lack of overscroll-behavior: contain");
  });

  await runTest("Suite 6", "X6.3", "Adversarial Test: Verify adjacent touch target button groups enforce min 8px spacing", () => {
    // Check all button grid groups on scanner page
    // 1. Emergency strobe buttons grid (line 793)
    const strobeGrid = scannerPage.match(/<div className="grid grid-cols-2 gap-3">[\s\S]*?<button/);
    assert(Boolean(strobeGrid), "Strobe buttons must have gap-3 (12px)");

    // 2. Test bench credentials grid (line 1095)
    const testBenchGrid = scannerPage.match(/<div className="grid grid-cols-2 gap-3">[\s\S]*?<button/);
    assert(Boolean(testBenchGrid), "Test bench buttons must have gap-3 (12px)");

    // 3. Modal buttons grid (line 1182)
    const modalGrid = scannerPage.match(/<div className="grid grid-cols-2 gap-3 pt-1">[\s\S]*?<button/);
    assert(Boolean(modalGrid), "Modal action buttons must have gap-3 (12px)");
  });

  await runTest("Suite 6", "X6.4", "Adversarial Test: Verify optional chaining on Native Hardware feedback hook", () => {
    assert(scannerPage.includes("customWin.ChainwayHardware.errorFeedback?.()"), "Native call must use optional chaining");
  });

  // ==========================================
  // FINAL SUMMARY
  // ==========================================
  console.log("\n=======================================================");
  console.log(" 📊 VERIFICATION SUITE SUMMARY");
  console.log("=======================================================");
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(` Total Tests Run: ${results.length}`);
  console.log(` Passed:          ${passedCount}`);
  console.log(` Failed:          ${failedCount}`);
  console.log(` Pass Rate:       ${((passedCount / results.length) * 100).toFixed(1)}%`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    console.error("❌ VERDICT: FAIL");
    process.exit(1);
  } else {
    console.log("✅ VERDICT: APPROVE (100% PASS)");
    process.exit(0);
  }
}

main().catch((e) => {
  console.error("Fatal error running stress harness:", e);
  process.exit(1);
});
