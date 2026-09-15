# Control-Access: Enterprise CSS Layout Constraints & Design Standards

## 1. Spatial Grid & Layout Hierarchy

Adheres to modern enterprise design systems (Vercel Geist, Apple Human Interface Guidelines, and industrial SCADA/kiosk UX):

- **Baseline Grid:** 4px atomic increment / 8px component rhythm (`space-1` = 4px, `space-2` = 8px, `space-4` = 16px, `space-6` = 24px).
- **Viewport Constraints:**
  - Standard Desktop/Control Room: `max-w-7xl` (1280px) to `max-w-screen-2xl` (1536px) centered with `mx-auto px-4 sm:px-6 lg:px-8`.
  - Gate Kiosk / RFID Terminal: `w-full h-dvh` (Dynamic Viewport Height) with strict `overflow-hidden` containment on body/wrapper to prevent accidental mobile browser address bar jumps and rubber-band bouncing.
  - Safe Area Insets: `pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]` for handheld Android RFID mobile scanners.

## 2. Touch & Ergonomic Restraints (Industrial RFID / Gate Operations)

- **Target Size (WCAG 2.2 SC 2.5.8 & Industrial Standards):**
  - Desktop buttons: Minimum 36px height (`h-9 px-4`).
  - Kiosk / Gate touchscreen controls: **Minimum 48x48px** (`min-h-[48px] min-w-[48px] p-3`), with at least 8px spacing between adjacent touch targets.
  - Glove-Operated Emergency Actions (e.g., Gate Override, Emergency Lock): **Minimum 56px to 64px** height with prominent active/pressed visual feedback (`active:scale-[0.98] active:brightness-90`).

## 3. Z-Index Layering Scale

A strictly bounded, non-arbitrary z-index ladder:

| Level | Range | Elements |
| :--- | :--- | :--- |
| **Canvas** | `z-0` | Cyber grid, dot matrix, aurora canvas backgrounds |
| **Surface** | `z-1` to `z-9` | Standard cards, data tables, metrics panels |
| **Sticky Header / Navigation** | `z-10` to `z-19` | Topbar, sidebar, sticky table column headers |
| **Floating / Popovers** | `z-20` to `z-29` | Dropdown menus, tooltips, autocomplete selectors |
| **Modals & Overlays** | `z-30` to `z-39` | Backdrop blur shields, modal dialogs, drawers |
| **Scanner Feed & Alarms** | `z-40` to `z-49` | Live camera HUD, gate grant/deny full-screen flash |
| **Notifications & System Alerts** | `z-50` to `z-100` | Toast notifications, AI floating console, connection status banner |

## 4. Glassmorphism & Depth Tokens

- **Frosted Vibrancy (`.mac-window` / `.glass-card`):**
  - Background: `rgba(20, 20, 24, 0.82)` with `backdrop-filter: blur(32px) saturate(190%)`.
  - Border: `1px solid rgba(255, 255, 255, 0.12)` with subtle inner glow `inset 0 1px 0 0 rgba(255, 255, 255, 0.15)`.
  - Shadows: Multi-tiered ambient shadow `0 20px 50px rgba(0, 0, 0, 0.6)` combined with 1px dark perimeter ring `0 0 0 1px rgba(0, 0, 0, 0.6)`.

## 5. Typography & Contrast Tokens (WCAG 2.2 AAA Compliance)

- **Display & Headings:** `font-sans` (-apple-system, SF Pro Display, Geist Sans) with tight tracking `tracking-tight` and bold weights (`font-semibold` / `font-bold`).
- **Telemetry & Identity Data:** `font-mono` (SF Mono, Geist Mono, JetBrains Mono) for:
  - RFID Badge IDs (`HEX` / `EPC-96`)
  - Timestamp ISO strings and countdown timers
  - Vehicle license plate strings
  - Direction status (`GATE IN` / `GATE OUT`)
- **Color Contrast:**
  - Critical Access Granted: `#30d158` (iOS/macOS green) on dark background (> 7:1 ratio).
  - Critical Access Denied / Breach: `#ff453a` (iOS/macOS red) on dark background (> 7:1 ratio).
  - Warning / Expiry: `#ffd60a` on dark background.

## 6. Motion & Performance Guidelines

- **Reduced Motion:** All custom keyframes (`animate-aurora-slow`, `animate-radar-sweep`, `animate-scan-line`) must respect `@media (prefers-reduced-motion: reduce) { animation: none !important; }`.
- **Hardware Acceleration:** Animated overlays leverage `transform: translate3d(...)` and `opacity` to avoid triggering layout reflows during high-frequency gate scanning.
