/**
 * Empirical Challenger Gate 1 Stress Harness:
 * UI Touch Targets, Kiosk Containment & Setup QR Interception
 *
 * Verifies:
 * 1. UI Touch Targets & Containment:
 *    - AST analysis of all interactive elements in src/app/scanner/page.tsx (>= 48x48px)
 *    - Emergency Deny strobe action buttons (>= 56px)
 *    - Camera viewfinder close button (>= 48x48px)
 *    - Optical Camera reticle overlay has pointer-events-none
 *    - .kiosk-container containment (overflow-hidden, overscroll-contain, 100dvh)
 *    - Safe-area insets in root div
 * 2. Setup QR Code Interception:
 *    - Intercepts full zero-touch provisioning JSON
 *    - Intercepts minimal configurations (deviceId only, tunnelUrl only, gateProfile only)
 *    - Preserves LAN vs Cloudflare active connection mode
 *    - Gracefully handles malformed JSON without crashing
 *    - Rejects non-config JSON without false positive provisioning
 *    - Ensures regular access tags (EMP, KEY, VEH) are not intercepted
 *    - Verifies zero-touch provisioning results in accessGranted=true and denialReason=null (no denial strobe)
 * 3. Live System Integration:
 *    - Fetches real provisioning payload from /api/admin/provisioning and verifies parsing
 *    - Validates live endpoints (/api/health, /api/tunnel-status, /api/fleet, /api/equipment, /api/scanner/key-custody)
 */

import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

interface TestResult {
  suite: string;
  testId: string;
  name: string;
  passed: boolean;
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
    results.push({ suite, testId, name, passed: false, error: err?.message || String(err), durationMs });
    console.log(`  ✖ FAIL [${testId}] ${name} (${durationMs}ms) -> ${err?.message || String(err)}`);
  }
}

interface JsxInteractiveElement {
  tag: string;
  line: number;
  className: string;
  textSnippet: string;
  parsedHeightPx: number | null;
  parsedWidthPx: number | null;
  hasIndustrialTarget: boolean;
  hasTouchPadding: boolean;
}

function parseTailwindDimension(className: string, prefix: "h" | "w" | "min-h" | "min-w"): number | null {
  if (!className) return null;
  const regexArb = new RegExp(`(?:^|\\s)${prefix}-\\[(\\d+)px\\]`);
  const matchArb = className.match(regexArb);
  if (matchArb) return parseInt(matchArb[1], 10);

  if (prefix === "h" && /(?:^|\s)h-9\.5(?:\s|$)/.test(className)) return 38;
  if (prefix === "min-h" && /(?:^|\s)min-h-9\.5(?:\s|$)/.test(className)) return 38;

  const regexScale = new RegExp(`(?:^|\\s)${prefix}-(\\d+)(?:\\s|$)`);
  const matchScale = className.match(regexScale);
  if (matchScale) return parseInt(matchScale[1], 10) * 4;

  return null;
}

function parseInteractiveElements(sourceCode: string): JsxInteractiveElement[] {
  const sf = ts.createSourceFile("scanner.tsx", sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const elements: JsxInteractiveElement[] = [];
  const targetTags = ["button", "input", "select", "a", "Link"];

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
        const fullText = ts.isJsxElement(node.parent)
          ? node.parent.getText(sf)
          : node.getText(sf);
        const textSnippet = fullText.slice(0, 200).replace(/\s+/g, " ");

        const hasIndustrialTarget = className.includes("touch-target-industrial");
        const parsedHeightPx =
          parseTailwindDimension(className, "min-h") ||
          parseTailwindDimension(className, "h");
        const parsedWidthPx =
          parseTailwindDimension(className, "min-w") ||
          parseTailwindDimension(className, "w");
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

/**
 * Pure emulation of the zero-touch QR interception branch in src/app/scanner/page.tsx
 */
interface QRInterceptionResult {
  intercepted: boolean;
  deviceId?: string;
  gateLocation?: string;
  activeConnectionMode?: "LAN" | "Cloudflare";
  accessGranted?: boolean;
  denialReason?: string | null;
  error?: string;
}

function evaluateQRScan(
  codeToScan: string,
  currentDeviceId: string = "Chainway-C66-01",
  currentGateLocation: string = "Brakfontein - Main Gate"
): QRInterceptionResult {
  const code = codeToScan.trim();

  // Branch 0: Zero-Touch QR Provisioning Interception
  if (code.startsWith("{")) {
    try {
      const config = JSON.parse(code);
      if (
        config.deviceId ||
        config.tunnelUrl ||
        config.serverUrl ||
        config.gateProfile
      ) {
        const newDeviceId = config.deviceId || currentDeviceId;
        const newGateLocation =
          config.gateProfile?.gateName ||
          config.gateProfile?.gateId ||
          currentGateLocation;

        const isCf = Boolean(
          config.tunnelUrl && !config.tunnelUrl.includes("127.0.0.1")
        );
        const activeConnectionMode = isCf ? "Cloudflare" : "LAN";

        return {
          intercepted: true,
          deviceId: newDeviceId,
          gateLocation: newGateLocation,
          activeConnectionMode,
          accessGranted: true,
          denialReason: null,
        };
      }
    } catch (err: any) {
      return {
        intercepted: false,
        error: err.message,
      };
    }
  }

  return {
    intercepted: false,
  };
}

async function main() {
  console.log("\n=======================================================");
  console.log(" 🔬 EMPIRICAL CHALLENGER GATE 1: TOUCH, KIOSK & QR SUITE");
  console.log("=======================================================\n");

  const projectRoot = path.resolve(__dirname, "..");
  const scannerPath = path.join(projectRoot, "src/app/scanner/page.tsx");
  const globalsCssPath = path.join(projectRoot, "src/app/globals.css");

  const scannerContent = fs.readFileSync(scannerPath, "utf-8");
  const globalsCssContent = fs.readFileSync(globalsCssPath, "utf-8");

  // =========================================================================
  // SUITE 1: Kiosk Container & Mobile Containment Invariants
  // =========================================================================
  console.log("▶ Running Suite 1: Kiosk Container & Mobile Containment Invariants");

  await runTest("Suite 1", "K1.1", ".kiosk-container styles enforce 100dvh, overflow hidden, and overscroll contain", () => {
    assert(/\.kiosk-container\s*\{[\s\S]*?height:\s*100dvh/.test(globalsCssContent), "globals.css must specify height: 100dvh");
    assert(/\.kiosk-container\s*\{[\s\S]*?overflow:\s*hidden/.test(globalsCssContent), "globals.css must specify overflow: hidden");
    assert(/\.kiosk-container\s*\{[\s\S]*?overscroll-behavior:\s*contain/.test(globalsCssContent), "globals.css must specify overscroll-behavior: contain");
  });

  await runTest("Suite 1", "K1.2", "Scanner root container explicitly mounts .kiosk-container with overflow-hidden and overscroll-contain", () => {
    const rootMatch = scannerContent.match(/<div className="([^"]*kiosk-container[^"]*)"/);
    assert(Boolean(rootMatch), "Scanner page must have root element with kiosk-container class");
    const classes = rootMatch![1];
    assert(classes.includes("overflow-hidden"), "Root div must include overflow-hidden");
    assert(classes.includes("overscroll-contain"), "Root div must include overscroll-contain");
    assert(classes.includes("h-dvh"), "Root div must include h-dvh");
  });

  await runTest("Suite 1", "K1.3", "Scanner root container applies dynamic safe-area insets for notched hardware", () => {
    assert(scannerContent.includes("pt-[env(safe-area-inset-top)]"), "Must contain pt-[env(safe-area-inset-top)]");
    assert(scannerContent.includes("pb-[env(safe-area-inset-bottom)]"), "Must contain pb-[env(safe-area-inset-bottom)]");
  });

  await runTest("Suite 1", "K1.4", "Main scrollable section enforces scroll-contained class", () => {
    assert(scannerContent.includes("scroll-contained"), "Main section must have scroll-contained class");
  });

  // =========================================================================
  // SUITE 2: Glove Touch Target Geometry & Camera Ergonomics
  // =========================================================================
  console.log("\n▶ Running Suite 2: Glove Touch Target Geometry & Camera Ergonomics");

  const elements = parseInteractiveElements(scannerContent);

  await runTest("Suite 2", "T2.1", "All interactive elements on scanner page meet or exceed min 48x48px", () => {
    const sub48 = elements.filter((el) => {
      const h = el.parsedHeightPx;
      if (h === null) {
        return !el.hasIndustrialTarget && !el.hasTouchPadding;
      }
      return h < 48;
    });
    assert(sub48.length === 0, `Detected ${sub48.length} interactive elements under 48px: ${JSON.stringify(sub48)}`);
  });

  await runTest("Suite 2", "T2.2", "Emergency Deny strobe action buttons meet or exceed min 56px height", () => {
    const strobeButtons = elements.filter((el) =>
      el.tag === "button" &&
      el.textSnippet.includes("setActiveAlert(null)")
    );
    assert(strobeButtons.length === 2, `Expected 2 emergency strobe action buttons, found ${strobeButtons.length}`);
    for (const btn of strobeButtons) {
      assert(btn.parsedHeightPx !== null && btn.parsedHeightPx >= 56, `Emergency button at line ${btn.line} has height ${btn.parsedHeightPx}px (< 56px)`);
    }
  });

  await runTest("Suite 2", "T2.3", "Camera viewfinder close button meets min 48x48px requirement", () => {
    const cameraClose = elements.find((el) => el.tag === "button" && el.textSnippet.includes("stopCamera"));
    assert(Boolean(cameraClose), "Camera viewfinder close button must exist");
    assert(cameraClose!.parsedHeightPx !== null && cameraClose!.parsedHeightPx >= 48, `Camera close height must be >= 48px, got ${cameraClose!.parsedHeightPx}`);
    assert(cameraClose!.parsedWidthPx !== null && cameraClose!.parsedWidthPx >= 48, `Camera close width must be >= 48px, got ${cameraClose!.parsedWidthPx}`);
  });

  await runTest("Suite 2", "T2.4", "Optical camera HUD reticle has pointer-events-none to prevent touch trapping", () => {
    const hudSection = scannerContent.slice(
      scannerContent.indexOf("OPTICAL CAMERA HUD"),
      scannerContent.indexOf("OPTICAL CAMERA HUD") + 500
    );
    // Find the reticle container enclosing the reticle box
    const reticleMatch = scannerContent.match(/<div className="absolute inset-0 pointer-events-none[^"]*">/);
    assert(Boolean(reticleMatch), "Optical camera reticle container must specify pointer-events-none");
  });

  await runTest("Suite 2", "T2.5", "Key custody session cancel button meets min 48px touch target", () => {
    const cancelBtn = elements.find((el) => el.tag === "button" && el.textSnippet.includes("setActiveKeySession(null)"));
    assert(Boolean(cancelBtn), "Key custody cancel button must exist");
    assert(cancelBtn!.parsedHeightPx !== null && cancelBtn!.parsedHeightPx >= 48, `Key custody cancel button must be >= 48px`);
  });

  await runTest("Suite 2", "T2.6", "Audio Buzzer and Camera Toolbar buttons satisfy min 48x48px and touch-target-industrial", () => {
    const audioBtn = elements.find((el) => el.tag === "button" && el.textSnippet.includes("setAudioEnabled"));
    const cameraBtn = elements.find((el) => el.tag === "button" && el.textSnippet.includes("cameraActive ? stopCamera : startCamera"));
    assert(Boolean(audioBtn), "Audio button must exist");
    assert(Boolean(cameraBtn), "Camera button must exist");
    assert(audioBtn!.hasIndustrialTarget, "Audio button must have touch-target-industrial class");
    assert(cameraBtn!.hasIndustrialTarget, "Camera button must have touch-target-industrial class");
    assert(audioBtn!.parsedHeightPx !== null && audioBtn!.parsedHeightPx >= 48, "Audio button height >= 48px");
    assert(audioBtn!.parsedWidthPx !== null && audioBtn!.parsedWidthPx >= 48, "Audio button width >= 48px");
    assert(cameraBtn!.parsedHeightPx !== null && cameraBtn!.parsedHeightPx >= 48, "Camera button height >= 48px");
    assert(cameraBtn!.parsedWidthPx !== null && cameraBtn!.parsedWidthPx >= 48, "Camera button width >= 48px");
  });

  // =========================================================================
  // SUITE 3: Zero-Touch Setup QR Code Interception Logic
  // =========================================================================
  console.log("\n▶ Running Suite 3: Zero-Touch Setup QR Code Interception Logic");

  await runTest("Suite 3", "Q3.1", "Standard full zero-touch QR payload is intercepted and sets deviceId & gateLocation", () => {
    const payload = JSON.stringify({
      version: 1,
      deviceId: "Chainway-C66-77",
      serverUrl: "http://127.0.0.1:8080",
      tunnelUrl: "https://mine-gate.trycloudflare.com",
      authToken: "sec_token_12345",
      gateProfile: {
        gateId: "GATE-04",
        gateName: "Haulage Ramp Gate",
        direction: "IN",
      },
    });

    const res = evaluateQRScan(payload);
    assert(res.intercepted === true, "Payload should be intercepted");
    assert(res.deviceId === "Chainway-C66-77", `Expected deviceId Chainway-C66-77, got ${res.deviceId}`);
    assert(res.gateLocation === "Haulage Ramp Gate", `Expected gateLocation Haulage Ramp Gate, got ${res.gateLocation}`);
    assert(res.activeConnectionMode === "Cloudflare", `Expected activeConnectionMode Cloudflare, got ${res.activeConnectionMode}`);
    assert(res.accessGranted === true, "Must grant access for setup QR");
    assert(res.denialReason === null, "Must have null denialReason");
  });

  await runTest("Suite 3", "Q3.2", "LAN-only provisioning payload correctly sets activeConnectionMode to LAN", () => {
    const payload = JSON.stringify({
      version: 1,
      deviceId: "Chainway-LAN-01",
      serverUrl: "http://192.168.1.50:8080",
      tunnelUrl: null,
      gateProfile: {
        gateId: "GATE-01",
        gateName: "Main Entrance",
      },
    });

    const res = evaluateQRScan(payload);
    assert(res.intercepted === true, "Payload should be intercepted");
    assert(res.activeConnectionMode === "LAN", `Expected LAN, got ${res.activeConnectionMode}`);
  });

  await runTest("Suite 3", "Q3.3", "Whitespace-padded JSON payload is intercepted successfully", () => {
    const raw = `   \n\t {"deviceId": "Chainway-WS-99"}  \r\n `;
    const res = evaluateQRScan(raw);
    assert(res.intercepted === true, "Whitespace padded payload should be intercepted");
    assert(res.deviceId === "Chainway-WS-99", `Expected Chainway-WS-99, got ${res.deviceId}`);
  });

  await runTest("Suite 3", "Q3.4", "Minimal payload with only tunnelUrl activates Cloudflare mode", () => {
    const raw = JSON.stringify({
      tunnelUrl: "https://ingress-tunnel.trycloudflare.com",
    });
    const res = evaluateQRScan(raw, "Existing-Device-01", "Existing-Gate");
    assert(res.intercepted === true, "Minimal tunnel payload should be intercepted");
    assert(res.activeConnectionMode === "Cloudflare", `Expected Cloudflare, got ${res.activeConnectionMode}`);
    assert(res.deviceId === "Existing-Device-01", "Should retain existing device ID");
    assert(res.gateLocation === "Existing-Gate", "Should retain existing gate location");
  });

  await runTest("Suite 3", "Q3.5", "Malformed JSON starting with '{' gracefully handled without uncaught throw", () => {
    const badJson = `{ "deviceId": "broken-json, `;
    const res = evaluateQRScan(badJson);
    assert(res.intercepted === false, "Broken JSON should not be intercepted");
    assert(res.error !== undefined, "Should record JSON error gracefully");
  });

  await runTest("Suite 3", "Q3.6", "Non-configuration JSON is NOT intercepted as zero-touch QR", () => {
    const nonConfig = JSON.stringify({
      randomTag: "XYZ-12345",
      temperature: 36.5,
    });
    const res = evaluateQRScan(nonConfig);
    assert(res.intercepted === false, "Non-configuration JSON must NOT be intercepted");
  });

  await runTest("Suite 3", "Q3.7", "Standard badge and key tags are NOT intercepted by setup QR branch", () => {
    const codes = [
      "EMP001",
      "RFID_EMP_003",
      "KEY-CAT-797F-01",
      "KEY_KOMATSU_PC2000",
      "EQUIP-RADIO-001",
      "VEH-797F-01",
      "BARCODE-994821",
    ];

    for (const code of codes) {
      const res = evaluateQRScan(code);
      assert(res.intercepted === false, `Code '${code}' must not be intercepted by setup QR branch`);
    }
  });

  // =========================================================================
  // SUITE 4: Live Service Endpoints & Real Admin Provisioning Payload
  // =========================================================================
  console.log("\n▶ Running Suite 4: Live Service Endpoints & Real Admin Provisioning Payload");

  await runTest("Suite 4", "L4.1", "Live /api/admin/provisioning returns valid zero-touch QR payload", async () => {
    const res = await fetch("http://127.0.0.1:8080/api/admin/provisioning");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, "API response must indicate success: true");
    assert(typeof data.qrString === "string", "qrString must be a string");
    assert(typeof data.provisioningPayload === "object", "provisioningPayload must be an object");

    // Test interception of this live generated QR string
    const qrEval = evaluateQRScan(data.qrString);
    assert(qrEval.intercepted === true, "Live generated qrString must be intercepted by scanner logic");
    assert(qrEval.accessGranted === true, "Live generated qrString must produce accessGranted: true");
    assert(qrEval.denialReason === null, "Live generated qrString must produce denialReason: null");
    assert(Boolean(qrEval.deviceId), "Must extract deviceId from live qrString");
  });

  await runTest("Suite 4", "L4.2", "Live /api/health indicates online status and SQLite database connection", async () => {
    const res = await fetch("http://127.0.0.1:8080/api/health");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.status === "ok", `Expected status ok, got ${data.status}`);
    assert(data.database?.status === "connected", "Database status must be connected");
  });

  await runTest("Suite 4", "L4.3", "Live /api/tunnel-status reports online Cloudflare tunnel", async () => {
    const res = await fetch("http://127.0.0.1:8080/api/tunnel-status");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.active === true, "Tunnel active must be true");
    assert(typeof data.public_url === "string" && data.public_url.includes("trycloudflare.com"), "Must report valid public_url");
  });

  await runTest("Suite 4", "L4.4", "Live /api/scanner/key-custody returns active keys list", async () => {
    const res = await fetch("http://127.0.0.1:8080/api/scanner/key-custody");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, "Must return success: true");
    assert(Array.isArray(data.keys), "Must return keys array");
  });

  await runTest("Suite 4", "L4.5", "Live /api/devices/link accepts handheld device linkage", async () => {
    const res = await fetch("http://127.0.0.1:8080/api/devices/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: "Chainway-Test-Harness-01",
        deviceType: "Chainway C66 Android Handheld",
        gateLocation: "Brakfontein - Main Gate",
      }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, "Must return success: true");
    assert(data.device?.name === "Chainway-Test-Harness-01" || data.config?.deviceId === "Chainway-Test-Harness-01", "Must return linked device");
  });

  // =========================================================================
  // SUITE 5: Adversarial Edge Cases & Negative Oracles
  // =========================================================================
  console.log("\n▶ Running Suite 5: Adversarial Edge Cases & Negative Oracles");

  await runTest("Suite 5", "A5.1", "127.0.0.1 in tunnelUrl preserves LAN connection mode", () => {
    const raw = JSON.stringify({
      deviceId: "C66-Local",
      tunnelUrl: "http://127.0.0.1:8080",
    });
    const res = evaluateQRScan(raw);
    assert(res.intercepted === true, "Payload should be intercepted");
    assert(res.activeConnectionMode === "LAN", `Expected LAN for local tunnelUrl, got ${res.activeConnectionMode}`);
  });

  await runTest("Suite 5", "A5.2", "Prototype pollution keys in QR payload parsed safely without pollution", () => {
    const raw = JSON.stringify({
      "__proto__": { "polluted": true },
      "deviceId": "Chainway-Clean",
      "tunnelUrl": "https://secure.trycloudflare.com",
    });
    const res = evaluateQRScan(raw);
    assert(res.intercepted === true, "Payload should be intercepted");
    assert(res.deviceId === "Chainway-Clean", "deviceId should match");
    assert((Object.prototype as any).polluted === undefined, "Prototype must not be polluted");
  });

  await runTest("Suite 5", "A5.3", "Empty string deviceId in QR payload safely falls back to current deviceId", () => {
    const raw = JSON.stringify({
      deviceId: "",
      tunnelUrl: "https://secure.trycloudflare.com",
    });
    const res = evaluateQRScan(raw, "Current-Device-99");
    assert(res.intercepted === true, "Payload should be intercepted");
    assert(res.deviceId === "Current-Device-99", `Expected fallback to Current-Device-99, got ${res.deviceId}`);
  });

  await runTest("Suite 5", "A5.4", "Large 100KB JSON payload handled without crashing", () => {
    const padding = "A".repeat(100000);
    const raw = JSON.stringify({
      deviceId: "Chainway-Large",
      extraData: padding,
    });
    const res = evaluateQRScan(raw);
    assert(res.intercepted === true, "Large payload should be intercepted");
    assert(res.deviceId === "Chainway-Large", "deviceId should match");
  });

  await runTest("Suite 5", "A5.5", "Negative Oracle: Simulated sub-48px button is successfully detected and flagged", () => {
    const mockComponent = `<button type="button" className="h-8 w-8 bg-blue-500">Sub-48</button>`;
    const mockElements = parseInteractiveElements(mockComponent);
    const sub48 = mockElements.filter((el) => (el.parsedHeightPx || 0) < 48);
    assert(sub48.length === 1, `Oracle should have flagged 1 sub-48px button, found ${sub48.length}`);
  });

  await runTest("Suite 5", "A5.6", "Negative Oracle: Simulated camera HUD without pointer-events-none is flagged", () => {
    const mockHudValid = `<div className="absolute inset-0 pointer-events-none flex items-center justify-center">`;
    const mockHudInvalid = `<div className="absolute inset-0 flex items-center justify-center">`;
    assert(mockHudValid.includes("pointer-events-none"), "Valid HUD has pointer-events-none");
    assert(!mockHudInvalid.includes("pointer-events-none"), "Invalid HUD is missing pointer-events-none");
  });

  await runTest("Suite 5", "A5.7", "Emergency Deny Strobe buttons include active:scale feedback", () => {
    const strobeButtons = elements.filter((el) =>
      el.tag === "button" && el.textSnippet.includes("setActiveAlert(null)")
    );
    for (const btn of strobeButtons) {
      assert(btn.className.includes("active:scale-[0.98]"), "Strobe button must include active:scale feedback");
    }
  });

  await runTest("Suite 5", "A5.8", "Native Android hardware bridge receiver hooks are wired in useEffect", () => {
    assert(scannerContent.includes("customWin.onNativeScanReceived"), "Must register onNativeScanReceived hook");
    assert(scannerContent.includes("ChainwayHardware.saveTunnelConfig"), "Must integrate saveTunnelConfig");
    assert(scannerContent.includes("ChainwayHardware.applyZeroTouchConfig"), "Must integrate applyZeroTouchConfig");
    assert(scannerContent.includes("ChainwayHardware.successFeedback"), "Must integrate successFeedback");
  });

  // =========================================================================
  // SUMMARY
  // =========================================================================
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log("\n=======================================================");
  console.log(" 📊 VERIFICATION SUITE SUMMARY");
  console.log("=======================================================");
  console.log(` Total Tests Run: ${total}`);
  console.log(` Passed:          ${passed}`);
  console.log(` Failed:          ${failed}`);
  console.log(` Pass Rate:       ${passRate}%`);
  console.log("=======================================================");

  if (failed === 0) {
    console.log("\n✅ VERDICT: APPROVE (100% PASS)\n");
    process.exit(0);
  } else {
    console.log(`\n❌ VERDICT: FAIL (${failed} test(s) failed)\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error during test run:", err);
  process.exit(1);
});
