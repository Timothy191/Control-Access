## 📋 Description of Changes
<!-- Provide a concise summary of the changes made, relevant tickets, and architectural rationale. -->

## 🎯 Spec Milestone & Feature Mapping
- [ ] **M1**: Unified Workforce, Fleet, Equipment Registers & Gate Backend Compliance
- [ ] **M2**: UI Management Registers, Expiration Countdowns & CSS Glove Restraints
- [ ] **M3**: Zero-Touch Scanner Onboarding, Camera Barcode & Remote Cloudflare Ingress
- [ ] **M4**: Key Control, Sequential Dual-Scan State Machine & Real-Time Push Alerts
- [ ] **M5**: Automated Spec Verification Suites, Lint Zero-Error & Production Deployment

---

## 🛡️ Industrial Safety & Mine Compliance Checklist
- [ ] **Medical Fitness Expiry Validation**: Access is immediately blocked with exact refusal reason if medical certificate is expired.
- [ ] **Safety Induction Verification**: Permanent employees and contractors are validated against active safety induction dates.
- [ ] **Contractor Company Flagging**: Third-party contractors without current induction are rejected with `'Access Denied: Uninducted Contractor'`.
- [ ] **Perimeter Lockdown Override**: Emergency lockdown takes strict precedence (P1) over normal badge status.
- [ ] **Telemetry Logging**: Gate scan logs record all 13 telemetry attributes (timestamp, gate ID, direction, device ID, signal quality, etc.).

---

## 🔑 Key Custody & Heavy Fleet Interlocking Checklist
- [ ] **Dual-Scan Sequential Flow**: Key tag scan transitions state to `'AWAITING_OPERATOR_VERIFICATION'`.
- [ ] **30-Second TTL Timer**: Operator badge scan must occur within the 30-second window; expired sessions reject gracefully.
- [ ] **Operator Certification Enforcement**: Machine license is verified before granting key checkout for heavy mining fleet.
- [ ] **Audit Trail & Push Alerts**: Real-time SSE dispatch triggers instant green confirmation or red denial strobe alert.

---

## 📱 Industrial Ergonomics & Glove Touch Target Checklist
- [ ] **Minimum 48x48px Touch Targets**: All interactive elements (buttons, inputs, segmented tabs, selects) meet or exceed 48x48px (`.touch-target-industrial`).
- [ ] **Emergency Action Boundaries**: Emergency Deny strobe buttons and high-risk triggers meet or exceed 56px height.
- [ ] **100dvh Kiosk Containment**: Root viewport enforces `.kiosk-container` (`height: 100dvh`, `overflow: hidden`, `overscroll-behavior: contain`).
- [ ] **Hardware HUD Safe-Areas**: Camera viewfinder reticles enforce `pointer-events-none` to eliminate touch trapping.

---

## ⚡ Zero-Touch Scanner Provisioning & Hardware Bridge
- [ ] **Zero-Touch QR Schema**: Setup payload JSON conforms to contract (`deviceId`, `tunnelUrl`, `authToken`, `gateLocation`, `activeConnectionMode`).
- [ ] **LAN / Cloudflare Failover**: Handheld PWA scanner seamlessly handles both local LAN and remote Cloudflare Tunnel modes.
- [ ] **Android Scanner Bridge Compatibility**: Kotlin broadcast intent receivers (`com.scanner.broadcast`) function reliably on Chainway C66 / Zebra hardware.

---

## 🧪 Local Test Verification Matrix
Run all test suites locally before submitting PR:
```bash
# 1. Type check and linting
pnpm typecheck
pnpm lint

# 2. 4-Tier Spec Verification Suite
pnpm test

# 3. Challenger Stress Harnesses
pnpm test:stress

# 4. Production Build
pnpm build
```

- [ ] **Typecheck**: `pnpm typecheck` passed (0 errors)
- [ ] **ESLint**: `pnpm lint` passed (0 errors)
- [ ] **Tier 1-4 E2E Suites**: 79/79 tests passed (100% pass rate)
- [ ] **Stress Harnesses**: All challenger suites passed (100% pass rate)
- [ ] **Production Build**: `pnpm build` completed successfully
