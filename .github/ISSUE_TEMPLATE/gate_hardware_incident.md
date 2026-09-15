---
name: "🚨 Gate Hardware Incident & Malfunction Report"
about: Report a turnstile, UHF RFID reader, optical scanner, or key box hardware incident on site.
title: "[INCIDENT] Gate Hardware: "
labels: ["incident", "hardware", "p1-urgent"]
assignees: ""
---

### 🚨 Incident Severity
- [ ] **P1 - Critical**: Gate turnstile / access point completely blocked or stuck open; security compromised
- [ ] **P2 - Major**: Scanner hardware degraded (e.g. RFID failing, falling back to camera QR)
- [ ] **P3 - Minor**: Occasional delay or cosmetic indicator fault
- [ ] **P4 - Low**: General hardware maintenance required

### 📍 Hardware Location & Identifier
- **Gate Identifier**: <!-- e.g., North Ingress Gate 1, Heavy Fleet Haul Road Boom Gate -->
- **Hardware Component**: <!-- UHF RFID Antenna / Chainway C66 Handheld / Optical Camera / Physical Key Box / Turnstile Relay -->
- **Device ID / IP**: <!-- e.g., DEV-GATE-01 / 192.168.1.120 -->

### ⏱️ Incident Timeline
- **Time Detected**: `YYYY-MM-DD HH:MM:SS`
- **Duration**: <!-- e.g., Ongoing / 25 minutes -->
- **Discovered By**: <!-- Security Officer / Gate Operator / System Telemetry -->

### 🔍 Incident Description & Symptoms
<!-- What physical or software failure was observed? (e.g., Turnstile relay failed to trigger after green check; RFID scanner stopped broadcasting intents). -->

### 🛠️ Containment & Mitigation Actions Taken
- [ ] Switched to fallback optical camera scanner
- [ ] Activated manual security override
- [ ] Triggered perimeter lockdown
- [ ] Handheld scanner re-provisioned via Zero-Touch QR code

### 📊 System Log & Hardware Telemetry
```
// Paste relevant logs from security.log, next.log, or tunnel.log
```
