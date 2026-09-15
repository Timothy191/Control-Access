# Original User Request

## 2026-09-14T05:18:41Z

Spec-based autonomous development of the enterprise Control-Access industrial mine site access and gate management platform, delivering unified registers for Employees, Contractors, Personal Vehicles, Heavy Fleet, Equipment/Radios, zero-touch QR provisioning for Chainway Android RFID scanners with low-latency remote link, and a dual-scan Key Control custody workflow with real-time push denial/approval.

Working directory: `/home/server/Projects/Control-Access`
Integrity mode: development

## Requirements

### R1. Unified Workforce, Contractor, Vehicle & Equipment Registers
Implement complete data models, relational Prisma schemas, and responsive UI management views for:
- **Workforce & Contractors**: Employees and third-party contractors with mandatory safety induction dates, medical fitness expiration tracking, and role-based access levels.
- **Vehicles & Heavy Earth-Moving Fleet**: Personal vehicles (roadworthy/license disc tracking) and mine earth-moving machinery (fleet equipment ID, operational hours, operator certification prerequisites).
- **Equipment & Radios**: Two-way radios, gas monitors, and portable safety equipment tracked with RFID tags and barcode identifiers.

### R2. Zero-Touch Android Scanner Onboarding & Resilient Remote Link
Provide automated scanner provisioning and a low-latency communication bridge:
- **Zero-Touch Provisioning**: Generate a setup QR code on the admin dashboard that, when scanned by an Android device (e.g. Chainway C66), automatically configures the scanner client with server base URL, tunnel endpoints, device authentication tokens, and assigned gate profile.
- **Dual-Surface Client Architecture**: Deliver an enhanced Progressive Web App (PWA) scanner with hardware broadcast intent listeners and camera barcode fallback, alongside the native Kotlin Android bridge (`android-scanner-bridge`) for native RFID/UHF hardware events.
- **Resilient Remote Link**: Ensure low-latency, bidirectional real-time synchronization over the Cloudflare Tunnel via Server-Sent Events (SSE) / WebSockets, maintaining stable operation across mine site Wi-Fi and mobile data networks.

### R3. Key Control & Sequential Dual-Scan Verification Engine
Implement a high-security interlocking key custody state machine:
1. **Key Scan Trigger**: Operator scans an RFID or barcode key tag for a vehicle or heavy machine. The system acknowledges the key and enters the "Awaiting Operator Verification" state.
2. **Mandatory Badge Verification**: System requires an Employee or Contractor badge scan within a configurable timeout window (e.g., 30 seconds).
3. **Automated Compliance Check**: System checks if the operator has valid equipment authorizations, an unexpired Medical Certificate, and an active Site Safety Induction.
4. **Instant Push Alert**: Transmit instant real-time events to the Android scanner screen:
   - **Access Granted**: Green visual confirmation, equipment key checked out to operator with audit trail log.
   - **Access Denied**: Prominent red strobe notification specifying the exact refusal reason (e.g., "Access Denied: Medical Fitness Expired", "Access Denied: Uninducted Contractor").

### R4. Automated Verification Suite, CSS Restraints & Zero-Downtime Deployment
- Enforce enterprise CSS layout constraints (`docs/CSS_LAYOUT_CONSTRAINTS.md`) with minimum 48x48px touch targets for industrial gloves and `.kiosk-container` bounce prevention.
- Provide end-to-end automated integration tests validating the key-scan state machine, compliance check rejections, and zero-touch onboarding payload generation.
- Ensure `pnpm build` compiles with 0 TypeScript and lint errors, and restart the production service (`sudo systemctl restart control-access`).

## Acceptance Criteria

### Workforce & Asset Registers
- [ ] Database schemas and UI registers exist and function for Employees, Contractors, Personal Vehicles, Heavy Fleet, and Equipment.
- [ ] Gate scan evaluation rejects entry when an employee or contractor has an expired medical certificate or site safety induction.

### Scanner Provisioning & Connectivity
- [ ] Scanning the onboarding QR provisions device credentials and establishes an active SSE/WebSocket connection.
- [ ] Handheld scanner interface maintains responsive, offline-tolerant connection state indicators.

### Key Control & Push Alerts
- [ ] Scanning a Key tag locks the terminal into the operator verification state and sets an expiration timer.
- [ ] Badge scan against a key checkout validates operator equipment license, medical status, and safety induction.
- [ ] Non-compliant badge scans push an immediate, prominent red denial alert with the exact reason directly to the scanner display.
- [ ] Compliant badge scans record the key checkout transaction with operator ID, key ID, and timestamp in the audit log.

### Quality & Verification
- [ ] `pnpm test` (or automated test runner script) passes all dual-scan and validation test suites.
- [ ] `pnpm build` completes with 0 errors across all routes.
- [ ] `control-access.service` runs active without errors after restart.

## 2026-09-14T06:38:50Z

Steering Directive from Parent:
1. Sequential Thinking MCP Server (@modelcontextprotocol/server-sequential-thinking) is installed and available in ~/.gemini/config/mcp_config.json. Apply rigorous sequential thinking and hypothesis verification across remaining milestones.
2. Realign all workers and reviewers on driving full-stack completion (>98% quality standard) across Milestones 3 & 4: Zero-Touch Android Scanner Provisioning, Cloudflare Tunnel SSE/WebSocket remote link, and Interlocking Key Control Dual-Scan Verification HUD.
3. Maintain zero tolerance for regressions, ensure pnpm build completes with 0 errors, and keep all E2E test suites green.

## 2026-09-14T09:35:35Z

Server restart recovery directive from Parent:
1. All files, Prisma models, API routes (/api/events, /api/scanner/key-custody, /api/admin/provisioning, /api/fleet, /api/equipment), and UI registers are verified and compiling with 0 errors across 23 static/dynamic routes.
2. pnpm test verified passing 79/79 tests (100%).
3. Systemd service control-access.service restarted and active on port 8080.
4. Continue final milestone review, verification audits, and victory certification.
