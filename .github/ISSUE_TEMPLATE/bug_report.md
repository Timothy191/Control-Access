---
name: "🐛 Bug Report: Gate & Compliance Issue"
about: Report a defect in access verification, key custody state machine, UI touch targets, or API endpoints.
title: "[BUG] "
labels: ["bug", "triage"]
assignees: ""
---

### 📌 Summary of Bug
<!-- A clear and concise description of what the issue is. -->

### 🏭 Site & Environment Context
- **Mine Site / Location**: <!-- e.g., North Pit Gate 3, Haul Road Security, Main Gate -->
- **Device Type**: <!-- Handheld PWA Scanner / Chainway C66 / Fixed Turnstile Kiosk / Desktop Browser -->
- **Connection Mode**: <!-- LAN (Local IP) / Cloudflare Tunnel / Offline -->
- **App Version**: <!-- Next.js 16 / Commit SHA -->

### 🔄 Steps to Reproduce
1. Scan credential: <!-- e.g., RFID tag 'RFID_EMP_001' or Key 'KEY_CAT_797F' -->
2. Gate state / action: <!-- e.g., Operator badge scanned after 10 seconds -->
3. Observe reaction: <!-- e.g., Unexpected denial or strobe timeout -->

### 🎯 Expected Behavior
<!-- What should have happened according to industrial safety spec? (e.g., Access Granted with green chime) -->

### ❌ Actual Behavior
<!-- What actually happened? (e.g., Access Denied: Medical Expired even though medical date is valid until 2027) -->

### 📋 Relevant Telemetry & Log Snippet
```json
// Paste /api/logs or browser console output if available
```

### 📱 Industrial Ergonomics / Glove Touch Target Details (if UI bug)
- **Viewport**: <!-- e.g., 360x640 portrait mobile -->
- **Touch Target Size**: <!-- e.g., Measured 32px height instead of >= 48px standard -->
- **Containment Issue**: <!-- e.g., Unexpected vertical scroll bouncing / overscroll leak -->
