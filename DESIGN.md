# Control-Access — Design Specification

## 1. Objective

Define the visual and interaction design system for the Control-Access mine access control web application. The spec covers the dashboard, scanning interfaces, management pages, and monitoring views — all built on a dark industrial-control-panel aesthetic with safety-critical alerting.

## 2. Product Context

- **Domain:** Mine/construction site access control — employees, vehicles, visitors, equipment, gate scans.
- **Tech stack:** Flask (Python) + Jinja2 templates + SQLite + Flask-SocketIO for real-time telemetry.
- **User roles:** admin, manager, security, user — each with different page visibility and action availability.
- **Key user workflows:**
  1. Security officer scans QR/RFID at a gate (real-time, high-frequency, 90% of interactions).
  2. Manager views dashboard occupancy and fleet status.
  3. Admin manages users, gate mappings, and audit logs.
  4. Visitor requests self-service QR entry via PIN.
- **Primary viewport:** Desktop browser (Kiosk or wall-mounted monitor for gate scanners, laptop for office users).

## 3. Visual Foundations

### Color System

| Token | Value | Usage |
|---|---|---|
| `--red-primary` | `#ff6b00` | Accent — active nav, CTA buttons, scan borders, alert icons |
| `--red-dark` | `#d95800` | Hover state for red-primary elements |
| `--steel` | `#d4af37` | Borders, card accents, secondary highlights, scrollbar thumb |
| `--dark-bg` | `transparent` / `#0a0a0a` | Page background (video or gradient behind glass cards) |
| `--dark-card` | `rgba(15,15,20,0.65)` | Card backgrounds with backdrop blur |
| `--text-primary` | `#ffffff` | Headings, body text on dark surfaces |
| `--text-secondary` | `#cccccc` | Labels, metadata, secondary text |
| `--success` | `#10b981` | Granted access, healthy status |
| `--warning` | `#f59e0b` | Expiring certifications, warnings |
| `--danger` | `#ef4444` | Denied access, critical alerts |

### Typography

- **Display / headings:** Inter, weights 600–700, `clamp(1.25rem, 4vw, 2rem)` scale
- **Body:** Inter, weight 400, 1rem base, `line-height: 1.6`
- **Data / mono:** JetBrains Mono, weight 400–500, used for timestamps, counters, scan IDs
- **Font loading:** Google Fonts CDN, `font-display: swap` via preconnect

### Spacing & Layout

- **Base unit:** 0.25rem (4px)
- **Card border-radius:** 12px
- **Card padding:** 1rem–1.25rem
- **Sidebar width:** 260px (collapsed on mobile)
- **Content max-width:** 1400px (footer banner constraint)
- **Touch target minimum:** 44×44px

### Card / Surface Design

- Cards use `rgba(10,10,10,0.85)` background with `backdrop-filter: blur(4px)`
- 1px `--steel` border, 12px border-radius
- Subtle red ambient glow on hover (`rgba(255,107,0,0.2)` box-shadow)
- Glass-morphism overlay on stat cards with radial gradient accent at 20% 30%

### Icons

- **Icon set:** Tabler Icons (6000+ SVG, MIT) for UI chrome; Heroicons 16px for inline/decorative
- **Nav icons:** Custom SVG per page, rendered at 20×20 with `ti` class prefix
- **Color override:** `var(--red-primary)` for active/emphasis icons

### Background

- **Default:** MP4 video background (`global-bg.mp4`) with `brightness(0.65) contrast(1.1)` filter and radial gradient overlay
- **Fallback:** CSS radial-gradient starfield + red ambient glows (animated) when video unavailable
- **Auth pages (login):** Same video background, centered auth container

## 4. Accessibility

- **Focus visible:** `outline: 2px solid var(--red-primary); outline-offset: 2px` on all interactive elements
- **Color contrast:** `--text-primary` (#fff) on `--dark-card` passes WCAG AA for large text; `--text-secondary` (#ccc) passes for body text on transparent backgrounds over the dark video
- **ARIA:** `aria-label` on icon-only buttons (menu toggle), `aria-hidden="true"` on decorative SVGs
- **Keyboard:** All navigation links are `<a>` elements (native focusable); sidebar toggle is a `<button>`
- **Responsive:** Sidebar collapses on mobile (<768px); scanner grid switches to single column; footer wraps
- **Semantic HTML:** `<aside>` for sidebar, `<main>` for content, `<nav>` for sidebar nav, `<footer>` for banner

## 5. Voice & Tone

- **System voice:** Operational, precise, no-nonsense. This is an industrial control tool, not a consumer app.
- **UI text style:** Short labels, status indicators, data-forward. No marketing copy, no emoji decoration.
- **Notification copy:** Machine-readable facts first — "John Doe (Employee) scanned IN — Main Gate — Granted"
- **Error states:** Direct and actionable — "Gate access denied: expired certification" not "Something went wrong"
- **Live indicators:** "LIVE — Real-time telemetry" with pulsing dot; "Checking..." for async status

## 6. Implementation Practices

- **CSS architecture:** Single `style.css` with CSS custom properties in `:root`. No framework (Tailwind, Bootstrap). No CSS-in-JS.
- **Component pattern:** Card-based (`<div class="card">` with `.card-header`, `.card-body`). Stat cards (`.stat-card`) extend card with `.stat-icon`, `.stat-info`, `.stat-trend`, `.stat-sparkline`.
- **Responsive breakpoints:** 1200px (logo/footer adjustment), 768px (sidebar collapse, footer vertical), 480px (minimal padding)
- **Animation philosophy:** Purposeful only — hover on cards (translateY + glow), scan line animation (QR reader), notification slide-in, skeleton shimmer on load. No decorative loops on non-status elements.
- **Video background:** `<video autoplay loop muted playsinline>` with z-index:0; all content at z-index >50
- **Sidebar:** Fixed positioning, translateX transform for slide-in, edge-trigger zone (25px from left), localStorage-persisted section collapse state
- **Real-time updates:** Flask-SocketIO for gate scans, stats push; DOM diffing in `main.js` (no full page reloads for live data)

## 7. Anti-Patterns

- **No gradient hero backgrounds** — the dark video + subtle radial glows are intentional and functional; avoid adding purple-blue radial gradient overlays on content cards.
- **No rounded-16px-shadow-sm card grids** — cards are 12px radius with a 1px steel border and meaningful shadow; do not replace with flat cards.
- **No emoji as decoration** — icons from Tabler/heroicon sets only; no 🎉 or ✅ on headers or in lists.
- **No isometric 3D illustrations** — the project is industrial/operational; flat SVG icons are the visual vocabulary.
- **No filler KPI stats** — every number on the dashboard maps to a real database field; do not add decorative "47% YoY" stat cards without real data backing.
- **No "seamlessly unlock" copy** — all UI text is factual and operational; no marketing language.
- **No em-dash overuse** — use em-dashes sparingly in notification copy; prefer plain hyphens in UI labels.
- **No filled-primary-button-for-every-action** — distinguish primary (blue/red), secondary (steel outline), and danger (red) buttons by role; not every link should be a raised button.

## 8. Decision-Making

| Question | Rule |
|---|---|
| New color token needed? | Must map to a semantic role (success/warning/danger/steel/accent); no arbitrary hex values |
| New card variant? | Must extend `.card` base, not create a disconnected surface class |
| Animation added? | Must be tied to a state change (hover, scan event, notification) — not ambient/decorative |
| New page/layout? | Must follow the sidebar nav structure with a new section in one of the four grouping areas |
| Icon chosen? | Must be from Tabler or Heroicons set; custom SVGs only when no icon exists and approval is given |

## 9. Workflow

1. New UI changes start as a task in the task tracker
2. Design review against this DESIGN.md before implementation
3. Check anti-patterns in the review
4. Update DESIGN.md when a visual system change is deliberate and lasting (not one-off)
5. Version the CSS with `?v=` query param in the `<link>` tag
