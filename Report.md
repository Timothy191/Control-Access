# Control-Access: File Change Review & Action Log

> **Report Created**: 2026-09-14 08:28:15 (Local Time)  
> **Status**: **MONITORING IN PROGRESS** — Quiescence window active (holding fixes until changes stop for 60s)  
> **Policy**: Zero automated source code modifications until file change quiet period finishes and explicit user approval is granted.

---

## 1. Monitored File Changes Summary

| File Path | Change Type | Source / Trigger | Current State |
| :--- | :---: | :---: | :--- |
| [`src/app/api/agent/route.ts`](file:///home/server/Projects/Control-Access/src/app/api/agent/route.ts) | Modified | User Direct Edit | Replaced `execFileAsync` with `execAsync` + single-quote escape |
| [`tests/stress-css-touch-m2.ts`](file:///home/server/Projects/Control-Access/tests/stress-css-touch-m2.ts) | New File | Test Harness / Challenger M2 | 36 assertions testing 48px touch targets & 100dvh kiosk constraints (14 Pass / 22 Fail) |
| [`src/components/approvals/ApprovalCard.tsx`](file:///home/server/Projects/Control-Access/src/components/approvals/ApprovalCard.tsx) | Modified | Active Workspace | Min-height updated to 38px (`min-h-[38px]`, `h-9.5`) |
| [`src/app/(app)/employees/page.tsx`](file:///home/server/Projects/Control-Access/src/app/(app)/employees/page.tsx) | Modified | Active Workspace | Added Workforce KPI metric cards |

---

## 2. Technical Review & Vulnerability / Risk Analysis

### A. [`src/app/api/agent/route.ts`](file:///home/server/Projects/Control-Access/src/app/api/agent/route.ts)

#### 1. Diff Observed
```diff
-import { execFile } from "child_process";
+import { exec } from "child_process";
...
-    if (!prompt || typeof prompt !== "string") {
-      return NextResponse.json({ error: "Prompt is required and must be a string" }, { status: 400 });
-    }
-
-    // Execute Antigravity CLI natively without shell interpolation
-    const { stdout, stderr } = await execFileAsync("agy", ["--print", prompt]);
+    if (!prompt) {
+      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
+    }
+
+    // Escape single quotes to prevent shell injection, then wrap in single quotes
+    const safePrompt = prompt.replace(/'/g, "'\\''");
+    
+    // Execute Antigravity CLI natively on the server
+    const { stdout, stderr } = await execAsync(`agy --print '${safePrompt}'`);
```

#### 2. Risk & Impact Assessment
- **Type Safety Hazard (High)**:
  `if (!prompt)` passes if `prompt` is a number, boolean, object (`{}`), or array (`[]`). Calling `prompt.replace(/'/g, "'\\''")` on any non-string type immediately triggers an unhandled `TypeError: prompt.replace is not a function`, terminating the request with a 500 error.
- **Shell Injection & Subshell Vulnerability (Medium)**:
  `exec` invokes `/bin/sh -c` subshell. While single-quote escaping `'\''` handles standard quote breakout, subshells interpret newline bytes, carriage returns, and control characters differently across environments. `execFile` (`execFileAsync("agy", ["--print", prompt])`) executes via OS `execve` kernel call directly with an arguments array, bypassing `/bin/sh` entirely and completely eliminating shell expansion risks.
- **Buffer & Hanging Process Risk (Medium)**:
  `execAsync` does not specify `maxBuffer` or `timeout`. If `agy` outputs extensive token streams or hangs awaiting stdin, the Next.js worker may run out of buffer memory or hang indefinitely.

---

### B. [`tests/stress-css-touch-m2.ts`](file:///home/server/Projects/Control-Access/tests/stress-css-touch-m2.ts)

#### 1. Diff Observed
New test harness evaluating:
- Kiosk container layout tokens (`height: 100dvh`, `overflow: hidden`, `overscroll-behavior: contain`).
- Industrial touch target sizes (minimum 48x48px for general controls, 56px for emergency strobe buttons, 38px for dense table/card actions).
- Spacing constraints (minimum 8px between adjacent interactive touch targets).

#### 2. Risk & Impact Assessment
- **Compilation Failure (`TS1501`)**:
  `tests/stress-css-touch-m2.ts` uses the dotAll regex flag `/pattern/s`, which requires ES2018 or later in `tsconfig.json`. This causes `npx tsc --noEmit` to fail with 12 errors.
- **22 Failed Ergonomic Checks**:
  Interactive buttons, inputs, and selects across `src/app/scanner/page.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/employees/EmployeeTable.tsx`, `src/components/fleet/FleetExplorer.tsx`, and `src/components/equipment/EquipmentExplorer.tsx` fail the strict 48px/38px touch target requirements.

---

## 3. Required Actions Log (Pending User Approval)

### Action Set 1: Hardening [`src/app/api/agent/route.ts`](file:///home/server/Projects/Control-Access/src/app/api/agent/route.ts)
- [ ] **Type Guard**: Restore strict `typeof prompt !== "string"` validation to prevent runtime crash on malformed payloads.
- [ ] **Process Execution Architecture**:
  - Prefer `execFileAsync("agy", ["--print", prompt], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 })` to guarantee immune argument handling without shell interpolation.
  - If subshell execution is explicitly required, ensure `typeof prompt === "string"`, sanitize control characters/null bytes, and enforce execution timeout and buffer ceilings.
- [ ] **Error Handling**: Return clean structured errors for timeout vs binary execution failures.

### Action Set 2: Resolving TypeScript & CSS Touch Targets in M2
- [ ] **Fix Regex Compatibility (`TS1501`)**: Replace dotAll `/.../s` in `tests/stress-css-touch-m2.ts` with `[\s\S]*` (compatible across all TS compiler targets).
- [ ] **Kiosk & Glove Bounds in [`src/app/scanner/page.tsx`](file:///home/server/Projects/Control-Access/src/app/scanner/page.tsx)**:
  - Add `min-h-[48px]` and `touch-target-industrial` to toolbar buttons, test bench credential buttons, inputs, selects, and dialog modals.
  - Set emergency denial strobe action buttons to `min-h-[56px]`.
- [ ] **Ergonomic Restraints in [`src/components/layout/Sidebar.tsx`](file:///home/server/Projects/Control-Access/src/components/layout/Sidebar.tsx)**:
  - Ensure hamburger toggle, close button, and navigation links satisfy `min-h-[48px]` with `gap-2` (>= 8px spacing).
- [ ] **Management Registers**:
  - Ensure segmented control tabs, search inputs, and action buttons across `EmployeeTable`, `FleetExplorer`, and `EquipmentExplorer` meet industrial 48px bounds.

---

## 4. Quiescence Monitoring Status

- **Monitoring Start**: 08:27:37
- **Inactivity Timer**: 60 seconds
- **Current State**: **Awaiting confirmation of 60s file change inactivity**.
- **Action upon timer completion**: Finalize this report, output comprehensive findings, and pause for user approval before modifying any code.
