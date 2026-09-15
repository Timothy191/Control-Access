# Project: Control-Access Platform

## Architecture
Control-Access is an industrial mine site access and gate management platform.
- **Framework & Runtime**: Next.js 16 (App Router) with React 19, TypeScript, Tailwind CSS v4, Node.js 26.
- **Database & Persistence**: SQLite WAL database (`mine_management.db`) managed via Prisma ORM 6.
- **Real-Time Communication**: Server-Sent Events (SSE) `/api/scanner/notifications` and Cloudflare Tunnel (`trycloudflare.com` / `public_url.txt`) for remote ingress.
- **Client Surfaces**:
  - Handheld PWA Scanner (`/scanner`): Offline-tolerant, Web Audio chimes, red strobe alarms, hardware broadcast intent listeners, camera barcode fallback.
  - Native Kotlin Android Bridge (`android-scanner-bridge`): Chainway C66 broadcast receiver, UHF RFID / 2D barcode scanner integration.
  - Admin Web Dashboard (`/`): Registers, approvals, audit logs, zero-touch QR onboarding generator.
- **Key Custody & Access Control Engine**:
  - Gate scan verification engine enforcing medical fitness and safety induction expiration checks.
  - Sequential dual-scan interlocking state machine for heavy machine keys (Key Tag -> 30s Timeout -> Operator Badge -> Authorizations & Compliance -> Push Alerts).
- **Service Deployment**: Managed via systemd service `/etc/systemd/system/control-access.service` listening on port 8080.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Workforce & Contractor Schema | Prisma models for employees and contractors with induction expiry, medical fitness expiry, contractor company, and access levels | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Personal Vehicles & Heavy Fleet Schema | Vehicles model with distinction between personal vehicles (roadworthy/disc expiry) and heavy fleet (machine ID, hours, required operator certification) | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Equipment & Radio Schema | Equipment model supporting two-way radios, gas monitors, calibration expiry dates, barcode IDs, and RFID EPC-96 tags | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Audit & Telemetry Schema Alignment | Declare `audit_logs`, `gate_logs` 13 telemetry columns, and indexes in Prisma schema | M1 | Survey Report (Exp 1) |
| 5 | Fleet & Equipment Backend APIs | Complete REST API routes `/api/fleet` and `/api/equipment` for CRUD and status updates | M1 | ORIGINAL_REQUEST §R1 |
| 6 | Gate Scan Expiry Validation | Enforce strict rejection in `scan-service.ts` if medical certificate or safety induction is expired | M1 | ORIGINAL_REQUEST §R1, AC |
| 7 | Workforce & Contractor UI Register | Responsive UI view for employees and contractors with induction/medical expiration countdowns and status tags | M2 | ORIGINAL_REQUEST §R1 |
| 8 | Vehicles & Heavy Fleet UI Register | Responsive UI view for personal vehicles (license disc) and heavy fleet (operational hours, required certs) | M2 | ORIGINAL_REQUEST §R1 |
| 9 | Equipment & Radio UI Register | Responsive UI view for radios, gas monitors (calibration status), and RFID/barcode equipment | M2 | ORIGINAL_REQUEST §R1 |
| 10 | Navigation Sidebar Integration | Add direct navigation links to Employees, Fleet, and Equipment registers in `Sidebar.tsx` | M2 | Survey Report (Exp 2) |
| 11 | Industrial CSS & Glove Touch Compliance | Fix touch target sizing to min 48x48px (scan dispatch button, sidebar buttons, approval cards) per `CSS_LAYOUT_CONSTRAINTS.md` | M2 | ORIGINAL_REQUEST §R4 |
| 12 | Zero-Touch Onboarding QR Generator | Generate setup QR on `/admin` with base URL, tunnel endpoint, device auth token, and gate profile | M3 | ORIGINAL_REQUEST §R2 |
| 13 | PWA Camera Barcode Fallback | Integrate camera scanner (`getUserMedia` / `BarcodeDetector` / modal) in `/scanner` when hardware scanner is unavailable | M3 | ORIGINAL_REQUEST §R2 |
| 14 | PWA Service Worker & Offline Indicators | Register `sw.js` for asset caching and display responsive offline-tolerant connection state indicators | M3 | ORIGINAL_REQUEST §R2, AC |
| 15 | Android Scanner Bridge Enhancement | Fix `AndroidManifest.xml` (remove broken receiver or add class), persist zero-touch QR config, implement `successFeedback()` | M3 | ORIGINAL_REQUEST §R2 |
| 16 | Key Control Data Models | Prisma schema models for `keys` and `key_custody_logs` with checkout state, machine binding, operator ID, timestamps | M4 | ORIGINAL_REQUEST §R3 |
| 17 | Sequential Dual-Scan State Machine | Interlocking state machine: Key tag scan -> "Awaiting Operator Verification" state with 30s timeout window | M4 | ORIGINAL_REQUEST §R3 |
| 18 | Dual-Scan Compliance Check | Automated validation: operator equipment license, unexpired medical certificate, active safety induction | M4 | ORIGINAL_REQUEST §R3 |
| 19 | Dual-Scan Push Alerts & Visual Strobe | Instant real-time SSE push alerts: Green Access Granted + key checkout audit log; Prominent red strobe notification with exact refusal reason | M4 | ORIGINAL_REQUEST §R3 |
| 20 | Scanner Key Custody UI Mode | UI in `/scanner` showing active key verification state, countdown timer, and prominent denial strobe | M4 | ORIGINAL_REQUEST §R3 |
| 21 | Automated Integration Test Suite | Automated test suite validating dual-scan state machine, compliance rejection (medical/induction expiry), zero-touch payload | M5 | ORIGINAL_REQUEST §R4 |
| 22 | Package.json Test Runner Script | Add `pnpm test` script executing the integration test suite with 100% pass rate | M5 | ORIGINAL_REQUEST §R4, AC |
| 23 | TypeScript & ESLint Zero-Error Fixes | Eliminate all 19 `any` errors and 9 unused variable warnings to pass `pnpm lint` and `pnpm build` with 0 errors | M5 | ORIGINAL_REQUEST §R4 |
| 24 | Service Sync & Zero-Downtime Deployment | Update `docs/control-access.service` to match production and restart `control-access.service` with clean active status | M5 | ORIGINAL_REQUEST §R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Unified Registers & Gate Compliance Backend | Features 1, 2, 3, 4, 5, 6 | None | DONE |
| M2 | UI Management Registers & CSS Glove Restraints | Features 7, 8, 9, 10, 11 | M1 | PLANNED |
| M3 | Zero-Touch Scanner Onboarding & Remote Link | Features 12, 13, 14, 15 | None | PLANNED |
| M4 | Key Control & Sequential Dual-Scan Verification | Features 16, 17, 18, 19, 20 | M1 | PLANNED |
| M5 | Automated Verification Suite, Lint Fixes & Deployment | Features 21, 22, 23, 24 | M1, M2, M3, M4 | PLANNED |

## Interface Contracts

### M1 ↔ Gate Scan Engine (`src/lib/scan-service.ts`)
- Function `processScan(scanData: ScanPayload): Promise<ScanResult>`
- Return type:
  ```typescript
  interface ScanResult {
    accessGranted: boolean;
    denialReason: string | null; // e.g. "Access Denied: Medical Fitness Expired", "Access Denied: Uninducted Contractor"
    entity: ResolvedEntity | null;
    logId: number;
    timestamp: string;
  }
  ```
- Compliance rules:
  1. If `isLockdown` -> `accessGranted: false`, `denialReason: "PERIMETER LOCKDOWN IN EFFECT"`
  2. If `resolved.status !== "Active" && resolved.status !== "Checked In"` -> `accessGranted: false`, `denialReason: "Credential status: ..."`
  3. If `resolved.medical_expiry` and `new Date(resolved.medical_expiry) < new Date()` -> `accessGranted: false`, `denialReason: "Access Denied: Medical Fitness Expired"`
  4. If `resolved.induction_expiry` and `new Date(resolved.induction_expiry) < new Date()` -> `accessGranted: false`, `denialReason: "Access Denied: Safety Induction Expired"`
  5. If contractor without active induction -> `accessGranted: false`, `denialReason: "Access Denied: Uninducted Contractor"`

### M3 ↔ Zero-Touch Provisioning Payload (`/admin` -> Scanner)
```json
{
  "version": 1,
  "serverUrl": "http://127.0.0.1:8080",
  "tunnelUrl": "https://vocational-damages-calculated-are.trycloudflare.com",
  "authToken": "gate_sec_<hex_token>",
  "gateProfile": {
    "gateId": "GATE-MAIN-01",
    "gateName": "Main Ingress Gate 1",
    "direction": "IN",
    "allowedTypes": ["EMPLOYEE", "CONTRACTOR", "VEHICLE", "KEY"]
  },
  "timestamp": "2026-09-14T05:30:00Z"
}
```

### M4 ↔ Key Custody State Machine (`src/lib/key-custody-service.ts`)
- State machine states: `IDLE` -> `AWAITING_OPERATOR_VERIFICATION` (30s timeout) -> `COMPLIANCE_EVALUATION` -> `GRANTED` or `DENIED`
- Key Scan Input:
  `initiateKeyCheckout(keyTag: string, gateId: string, deviceId: string): Promise<KeySessionState>`
- Operator Scan Input:
  `verifyOperatorForKey(sessionId: string, badgeTag: string): Promise<KeyVerificationResult>`
- Push Notification Payload:
  ```json
  {
    "type": "KEY_CUSTODY_RESULT",
    "status": "GRANTED" | "DENIED",
    "keyId": "KEY-CAT-797F-01",
    "machineId": "CAT-797F-01",
    "operatorName": "John Doe",
    "operatorId": "EMP-001",
    "denialReason": null | "Access Denied: Machine Authorization Required" | "Access Denied: Medical Fitness Expired" | "Access Denied: Safety Induction Expired",
    "timestamp": "2026-09-14T05:30:00Z"
  }
  ```

## Code Layout
- `prisma/schema.prisma`: Authoritative database models
- `src/lib/scan-service.ts`: Core gate scan compliance logic
- `src/lib/scan-decoder.ts`: Entity resolution from barcodes and RFID tags
- `src/lib/key-custody-service.ts`: Key Control dual-scan state machine
- `src/lib/device-notifications.ts`: Real-time SSE dispatch
- `src/app/api/fleet/route.ts`: Heavy fleet & vehicle API
- `src/app/api/equipment/route.ts`: Equipment & gas monitor API
- `src/app/api/scanner/key-custody/route.ts`: Key custody checkout endpoint
- `src/app/api/admin/provisioning/route.ts`: Zero-touch QR payload endpoint
- `src/app/(app)/employees/page.tsx`: Workforce & contractor UI register
- `src/app/(app)/fleet/page.tsx`: Fleet & vehicle UI register
- `src/app/(app)/equipment/page.tsx`: Equipment & radio UI register
- `src/app/(app)/admin/page.tsx`: Admin dashboard with zero-touch QR generator
- `src/app/scanner/page.tsx`: Industrial glove-friendly kiosk scanner PWA
- `public/sw.js`: PWA service worker
- `android-scanner-bridge/`: Native Kotlin Android hardware bridge
- `tests/e2e/`: Automated TypeScript integration & verification tests
- `docs/control-access.service`: Production systemd service unit definition
