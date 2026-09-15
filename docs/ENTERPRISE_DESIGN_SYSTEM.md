# PLANTCOR CONTROL™ — Enterprise Design System & Corporate Theme Specification
**Document ID:** `PCS-SPEC-DS-2026-V1`  
**Classification:** Tier-1 Heavy Industrial Security & SCADA Telemetry Standard  
**Target Platform:** `/home/server/Projects/Control-Access` (Next.js 16 + React 19 + Tailwind CSS v4)  
**Conformance:** WCAG 2.2 AAA, Palantir Foundry / Linear Enterprise / Apple Corporate Dark UI Standards  

---

## 1. Executive Branding & Identity

### 1.1 Corporate Naming & Entity Architecture
- **Official Enterprise Name:** Plantcor Industrial Access & Gate Telemetry System
- **Commercial & Executive Brand:** **PLANTCOR CONTROL™** (Operational shorthand: `Control-Access Enterprise`)
- **System Authority Identifier:** `PCA-GOV-SCADA-01`
- **Core Domain:** High-throughput mining access control, automated UHF RFID / 2D barcode gate scanning, heavy equipment interlocking, and real-time personnel muster tracking.

### 1.2 Enterprise Tagline & Positioning
- **Primary Tagline:** *"Deterministic Industrial Security at the Physical-Digital Frontier."*
- **Operational Motto:** *"Zero-Trust Perimeter Telemetry & Key Custody Interlocking for Heavy Industry."*
- **System Voice:** Machine-readable, deterministic, safety-critical, authoritative, devoid of consumer fluff.

### 1.3 Brandmark Crest Geometry & SVG Specification
The brandmark crest combines an interlocking hexagon (representing mineral crystallography and fortress perimeters) with a precision gear tooth and central sapphire laser aperture emitting dual concentric scanning sweeps.

```tsx
/**
 * PlantcorControlCrest.tsx
 * Precision-machined hexagonal corporate brandmark with metallic specular bevels
 */
export function PlantcorControlCrest({ className = "w-9 h-9", size = 36 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Plantcor Control Enterprise Crest"
    >
      <defs>
        {/* Outer Hexagon Specular Titanium Gradient */}
        <linearGradient id="crestTitanium" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
          <stop offset="30%" stopColor="#8E8E93" stopOpacity="0.15" />
          <stop offset="70%" stopColor="#1C1C1E" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.95" />
        </linearGradient>

        {/* Sapphire Core Glow Gradient */}
        <linearGradient id="crestSapphire" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0A84FF" />
          <stop offset="100%" stopColor="#0052CC" />
        </linearGradient>

        {/* Outer Laser Pulse Radial */}
        <radialGradient id="sapphirePulse" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0066FF" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#0066FF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient Glow */}
      <circle cx="24" cy="24" r="20" fill="url(#sapphirePulse)" />

      {/* Outer Interlocking Hexagonal Fortress Ring */}
      <path
        d="M24 4L41.32 14V34L24 44L6.68 34V14L24 4Z"
        fill="#0D0E12"
        stroke="url(#crestTitanium)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Inner Precision Geometry: Interlocking Core */}
      <path
        d="M24 10L36 17V31L24 38L12 31V17L24 10Z"
        fill="#13151B"
        stroke="rgba(255, 255, 255, 0.12)"
        strokeWidth="1"
      />

      {/* Dual Telemetry Scanning Crosshairs & Shield Spine */}
      <line x1="24" y1="12" x2="24" y2="36" stroke="url(#crestSapphire)" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="24" x2="34" y2="24" stroke="url(#crestSapphire)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 3" />

      {/* Central Diamond Optical Aperture */}
      <rect
        x="20.5"
        y="20.5"
        width="7"
        height="7"
        transform="rotate(45 24 24)"
        fill="#0066FF"
        stroke="#FFFFFF"
        strokeWidth="1"
        className="drop-shadow-[0_0_8px_rgba(0,102,255,0.8)]"
      />

      {/* Verification Dot */}
      <circle cx="24" cy="24" r="1.5" fill="#FFFFFF" />
    </svg>
  );
}
```

### 1.4 Typography Hierarchy
Follows Vercel Geist + Apple SF Pro + JetBrains Mono corporate engineering standards.

| Level | Font Family | Size | Weight | Tracking | Purpose |
|---|---|---|---|---|---|
| **Executive Heading 1** | `var(--font-sans)` (Geist Sans) | 28px / 1.75rem | 700 (Bold) | `-0.03em` | Main Register titles, Kiosk headers |
| **Section Heading 2** | `var(--font-sans)` | 20px / 1.25rem | 600 (Semibold) | `-0.02em` | Card headers, table section titles |
| **Card / Widget Title** | `var(--font-sans)` | 14px / 0.875rem | 600 (Semibold) | `-0.01em` | Stat titles, modal section labels |
| **Body Content** | `var(--font-sans)` | 13px–14px | 400 (Regular) | `0` | Descriptions, dialog body text, notes |
| **Form Labels** | `var(--font-mono)` (Geist/JetBrains) | 10px / 0.625rem | 600 (Semibold) | `+0.06em` | Uppercase field headers (`EMPLOYEE ID`) |
| **Telemetry & RFID** | `var(--font-mono)` | 12px / 0.75rem | 700 (Bold) | `+0.04em` | Hex badge codes (`EPC-96`), License Plates |
| **Timestamps & Timers** | `var(--font-mono)` | 11px / 0.6875rem | 500 (Medium) | `0` | ISO 8601 strings, countdown clocks |

---

## 2. Color Palette & Elevation System

### 2.1 Enterprise Color Scale

```css
/* Master Corporate Color Tokens */
:root {
  /* Corporate Obsidian (Deep True Dark Foundations) */
  --obsidian-canvas: #060709;      /* Pure system base void */
  --obsidian-surface: #0D0E12;     /* Default sheet / layout background */
  --obsidian-elevated: #13151B;    /* Card & panel surfaces */
  --obsidian-float: #1A1D26;       /* Dropdowns, tooltips, popovers */
  --obsidian-glass: rgba(13, 14, 18, 0.82);

  /* Titanium Slate (Industrial Metallic Accents & Borders) */
  --titanium-rim: rgba(255, 255, 255, 0.12);        /* Standard 1px perimeter border */
  --titanium-bevel: rgba(255, 255, 255, 0.18);      /* Top specular highlight */
  --titanium-subtle: rgba(255, 255, 255, 0.05);     /* Grid lines & zebra striping */
  --titanium-border-hover: rgba(255, 255, 255, 0.28);
  --titanium-text-muted: #94A3B8;
  --titanium-text-subtle: #64748B;
  --titanium-text-pure: #F8FAFC;

  /* Sapphire Blue (Command & Telemetry / Fortune 500 Blue) */
  --sapphire-600: #0052CC;        /* Pressed / Active buttons */
  --sapphire-500: #0066FF;        /* Primary brand action & active nav */
  --sapphire-400: #0A84FF;        /* Hover glow & telemetry beacon */
  --sapphire-surface: rgba(0, 102, 255, 0.12);
  --sapphire-border: rgba(10, 132, 255, 0.35);

  /* Compliance Emerald (Gate Clearance & Valid Certifications) */
  --emerald-500: #10B981;         /* Clearance Granted base */
  --emerald-400: #34D399;         /* High-contrast telemetry glow */
  --emerald-surface: rgba(16, 185, 129, 0.12);
  --emerald-border: rgba(16, 185, 129, 0.35);

  /* Warning Amber (Supervisory Approval / Impending Expiration <=30d) */
  --amber-500: #F59E0B;           /* Warning base */
  --amber-400: #FBBF24;           /* Expiry badge accent */
  --amber-surface: rgba(245, 158, 11, 0.12);
  --amber-border: rgba(245, 158, 11, 0.35);

  /* Breach Crimson (Refusal / Key Lockout / Safety Hazard) */
  --crimson-500: #EF4444;         /* Denial base */
  --crimson-400: #F87171;         /* Live strobe alarm */
  --crimson-surface: rgba(239, 68, 68, 0.14);
  --crimson-border: rgba(239, 68, 68, 0.45);
}
```

### 2.2 Elevation Ladder & Metallic Specular Borders
Every container implements a dual-layer border system simulating CNC-machined anodized titanium: an outer 1px ambient border plus an inner 1px specular bevel along the top edge.

```css
/* Elevation 1: Structural Surface Cards */
.corporate-card {
  background: var(--obsidian-elevated);
  border: 1px solid var(--titanium-rim);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 0 var(--titanium-bevel);
  border-radius: 14px;
}

/* Elevation 2: Frosted Vibrancy Panels & Data Tables */
.corporate-glass-card {
  background: var(--obsidian-glass);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid var(--titanium-rim);
  box-shadow:
    0 16px 40px -8px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(0, 0, 0, 0.75),
    inset 0 1px 0 0 var(--titanium-bevel);
  border-radius: 16px;
}

/* Elevation 3: Flyouts, Site Selector & Menus */
.corporate-popover {
  background: rgba(20, 23, 31, 0.96);
  backdrop-filter: blur(36px) saturate(190%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow:
    0 24px 64px -12px rgba(0, 0, 0, 0.9),
    0 0 0 1px rgba(0, 0, 0, 0.8),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.22);
  border-radius: 14px;
}
```

---

## 3. Corporate Layout System

### 3.1 Architectural Structure
Adhering to `docs/CSS_LAYOUT_CONSTRAINTS.md`:
- **Desktop Control Room:** Max width `max-w-7xl 2xl:max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8`.
- **Gate Kiosk / Mobile Scanner:** `w-full h-dvh overflow-hidden overscroll-contain`.
- **Atomic Grid:** 4px base increment (`space-1` = 4px, `space-2` = 8px, `space-4` = 16px, `space-6` = 24px).
- **Strict Z-Index Hierarchy:** Canvas `z-0`, Surfaces `z-1–9`, Navigation `z-10–19`, Popovers `z-20–29`, Modals `z-30–39`, Scanner Telemetry `z-40–49`, Alarms & Toasts `z-50–100`.

### 3.2 Executive Top Navigation Bar (`TopBar.tsx`)
The top bar unifies executive identity, route hierarchy, site partitioning, and operational telemetry in a compact 56px (`h-14`) bar.

```tsx
// Architectural Structure of Executive TopBar
<header className="w-full h-14 px-4 sm:px-6 flex items-center justify-between backdrop-blur-2xl bg-[#0D0E12]/85 border-b border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.06)] sticky top-0 z-20 font-sans">
  {/* Left: Brand Crest + Breadcrumbs + Site Selector */}
  <div className="flex items-center gap-3 sm:gap-4">
    <NavigationDrawerButton />
    <PlantcorControlCrest size={28} />
    <ExecutiveBreadcrumb trail={["Plantcor", "Workforce", "Mine Staff"]} />
    <div className="h-4 w-px bg-white/15 mx-1" />
    <FacilitySiteSelector />
  </div>

  {/* Center / Telemetry: Live System Heartbeat */}
  <div className="hidden xl:flex items-center gap-2.5 px-3 py-1 rounded-full bg-black/40 border border-white/10 text-xs font-mono">
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
    <span className="text-neutral-300">SCADA NODE ONLINE</span>
    <span className="text-neutral-500">•</span>
    <span className="text-neutral-400">SYNC: 14ms</span>
  </div>

  {/* Right: Action Strip & Operator Profile */}
  <div className="flex items-center gap-2.5 text-neutral-300">
    <NotificationBellCounter pendingCount={pendingApprovals} />
    <div className="h-4 w-px bg-white/15" />
    <OperatorProfileMenu />
  </div>
</header>
```

### 3.3 Standard Page Header Banner
Every register page (`/employees`, `/fleet`, `/equipment`, `/access-cards`, `/approvals`, `/database`) must employ the standard enterprise header banner:

```tsx
export function PageHeaderBanner({
  title,
  description,
  badgeText,
  stats,
}: {
  title: string;
  description: string;
  badgeText?: string;
  stats?: Array<{ label: string; value: string | number; color?: string }>;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-sans">
            {title}
          </h1>
          {badgeText && (
            <span className="px-2.5 py-0.5 rounded-full bg-[#0066FF]/15 text-[#0A84FF] border border-[#0066FF]/30 text-[10px] font-mono font-bold uppercase tracking-wider">
              {badgeText}
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-3xl leading-relaxed">
          {description}
        </p>
      </div>

      {stats && stats.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-md flex items-center gap-2.5"
            >
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                {stat.label}
              </span>
              <span className={`text-sm font-bold font-mono ${stat.color || "text-white"}`}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 3.4 Action Toolbar Standard (Export, Import, Mass Generate, Audit)
```tsx
<div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[#0D0E12]/90 border border-white/10 backdrop-blur-xl">
  {/* Left: Glove-Friendly Segmented View Switcher (min 48px height) */}
  <div className="flex items-center gap-1.5 p-1 bg-black/50 border border-white/10 rounded-xl">
    <button className="min-h-[48px] px-5 rounded-lg text-xs font-mono font-bold bg-[#0066FF] text-white shadow-md shadow-[#0066FF]/30 cursor-pointer">
      All Workforce (142)
    </button>
    <button className="min-h-[48px] px-5 rounded-lg text-xs font-mono font-medium text-neutral-400 hover:text-white hover:bg-white/5 cursor-pointer">
      Mine Staff
    </button>
    <button className="min-h-[48px] px-5 rounded-lg text-xs font-mono font-medium text-neutral-400 hover:text-white hover:bg-white/5 cursor-pointer">
      Contractors
    </button>
  </div>

  {/* Right: Industrial Pipeline Action Buttons (min 48px height) */}
  <div className="flex items-center gap-2.5">
    <button className="min-h-[48px] px-4 py-2.5 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono font-semibold text-neutral-200 flex items-center gap-2 cursor-pointer transition shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <IconDownload size={17} className="text-[#0066FF]" />
      <span>Export CSV</span>
    </button>

    <button className="min-h-[48px] px-4 py-2.5 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono font-semibold text-neutral-200 flex items-center gap-2 cursor-pointer transition shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <IconFileCode size={17} className="text-purple-400" />
      <span>Export JSON</span>
    </button>

    <button className="min-h-[48px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#0A84FF] hover:brightness-110 active:scale-[0.98] text-xs font-mono font-bold text-white flex items-center gap-2 cursor-pointer transition shadow-lg shadow-[#0066FF]/30 border border-white/20">
      <IconUpload size={17} />
      <span>Import / Mass Generate</span>
    </button>
  </div>
</div>
```

---

## 4. Component Elevation & Industrial Controls

### 4.1 Enterprise Data Table with Zebra Striping
```tsx
<div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0D0E12]/95 backdrop-blur-xl shadow-2xl">
  <table className="min-w-full text-left text-xs font-sans">
    <thead>
      <tr className="sticky top-0 z-10 border-b border-white/12 bg-[#13151B] text-[10px] uppercase font-mono tracking-wider text-slate-400">
        <th className="py-4 px-4 font-semibold">Personnel &amp; Role</th>
        <th className="py-4 px-4 font-semibold">Code / RFID</th>
        <th className="py-4 px-4 font-semibold">Affiliation</th>
        <th className="py-4 px-4 font-semibold">Medical Fitness</th>
        <th className="py-4 px-4 font-semibold">Induction Status</th>
        <th className="py-4 px-4 font-semibold">Gate Clearance</th>
        <th className="py-4 px-4 font-semibold text-right">Actions</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-white/[0.04]">
      {/* Zebra Rows: Alternate between pure void and subtle 1.5% white tint */}
      <tr className="even:bg-white/[0.015] odd:bg-transparent hover:bg-[#0066FF]/[0.08] hover:border-l-2 hover:border-l-[#0066FF] transition-colors group">
        <td className="py-3 px-4">...</td>
      </tr>
    </tbody>
  </table>
</div>
```

### 4.2 Status Pill Design Standard

```tsx
// Compliance Status Pills
export function ClearanceStatusPill({ status, reason }: { status: "granted" | "denied" | "warning"; reason?: string }) {
  if (status === "granted") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30 text-xs font-mono font-bold shadow-[0_0_12px_rgba(16,185,129,0.15)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
        <span>CLEARED</span>
      </span>
    );
  }

  if (status === "warning") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#F59E0B]/15 text-[#FBBF24] border border-[#F59E0B]/30 text-xs font-mono font-bold shadow-[0_0_12px_rgba(245,158,11,0.15)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
        <span>RENEWAL DUE</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#EF4444]/15 text-[#F87171] border border-[#EF4444]/40 text-xs font-mono font-bold shadow-[0_0_16px_rgba(239,68,68,0.25)]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-ping" />
      <span>DENIED ({reason || "HAZARD"})</span>
    </span>
  );
}
```

### 4.3 Glove Touch Restraints (WCAG 2.2 SC 2.5.8 & `stress-css-touch-m2.ts`)
- Standard interactive elements: **Minimum 48x48px bounding box** (`min-h-[48px] min-w-[48px]`).
- Adjacent targets: **Minimum 8px margin / gap** to eliminate double-tap triggers with thick industrial gloves.
- Emergency override controls: **Minimum 56px to 64px bounding box** (`min-h-[56px] px-6 text-sm font-bold active:scale-[0.97]`).

---

## 5. File Implementation Roadmap

| File Target | Current State | Required Enterprise Upgrade | Code Tokens / Implementation |
|---|---|---|---|
| **`src/app/globals.css`** | Mix of macOS tokens and custom orange/gold styling. | Standardize with Tailwind v4 `@theme` corporate scale (Obsidian, Titanium Slate, Sapphire Blue `#0066FF`, Compliance Emerald `#10B981`, Breach Crimson `#EF4444`). Add `.table-zebra`, `.corporate-card`, `.corporate-glass-card`. | Update `@theme` block and utilities as specified in §2.1. |
| **`src/components/layout/TopBar.tsx`** | Blue icon button menu, basic page title. | Add `PlantcorControlCrest`, hierarchical breadcrumb navigation, live SCADA heartbeat ticker, and facility pill. | Refactor header container to 56px with titanium border and breadcrumbs. |
| **`src/components/layout/Sidebar.tsx`** | ArchLinux icon and Plantcor Control text. | Replace header icon with `PlantcorControlCrest`, add enterprise system authority subtitle (`PCA-GOV-SCADA-01`), ensure all links adhere to `min-h-[48px]`. | Update sidebar branding and nav section styling. |
| **`src/components/dashboard/LiveDashboard.tsx`** | Standard 4-card grid and 3D globe. | Align `InteractiveStatCard` colors to Sapphire `#0066FF`, Emerald `#10B981`, Amber `#F59E0B`, Purple `#BF5AF2`. Add metallic top specular highlight. | Update stat card accents and telemetry banner. |
| **`src/components/employees/EmployeeTable.tsx`** | Functional table with custom filters. | Implement `.table-zebra` striping, sticky header, metallic border tokens, glove-friendly 48px controls, unified filter bar, and standardized status pills. | Re-theme table structure and filter controls. |
| **`src/components/fleet/FleetExplorer.tsx`** | Functional vehicle table. | Zebra striping, heavy fleet equipment pills, license disc countdown badges, and 48px action toolbars. | Apply corporate table tokens and metallic specular borders. |
| **`src/app/(auth)/login/page.tsx`** | Basic login with floating aurora. | Upgrade to executive dark security portal: `PlantcorControlCrest`, metallic obsidian card, 48px inputs with titanium borders, gateway active status indicator. | Restyle auth container, inputs, and submit button. |

---
**Approved by:** Architecture & Design Review Board  
**Target Milestone:** Full Production Swarm Execution
