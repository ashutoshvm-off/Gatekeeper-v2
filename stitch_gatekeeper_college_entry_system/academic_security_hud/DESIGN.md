---
name: Academic Security HUD
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464e'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#75777f'
  outline-variant: '#c5c6cf'
  surface-tint: '#4f5e83'
  primary: '#000922'
  on-primary: '#ffffff'
  primary-container: '#0f2042'
  on-primary-container: '#7988b0'
  inverse-primary: '#b6c6f1'
  secondary: '#904d00'
  on-secondary: '#ffffff'
  secondary-container: '#fe932c'
  on-secondary-container: '#663500'
  tertiary: '#000b16'
  on-tertiary: '#ffffff'
  tertiary-container: '#00233a'
  on-tertiary-container: '#228fd3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#b6c6f1'
  on-primary-fixed: '#081a3c'
  on-primary-fixed-variant: '#37466a'
  secondary-fixed: '#ffdcc3'
  secondary-fixed-dim: '#ffb77d'
  on-secondary-fixed: '#2f1500'
  on-secondary-fixed-variant: '#6e3900'
  tertiary-fixed: '#cce5ff'
  tertiary-fixed-dim: '#93ccff'
  on-tertiary-fixed: '#001d31'
  on-tertiary-fixed-variant: '#004b73'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
  hud-metric:
    fontFamily: JetBrains Mono
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.03em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system establishes a high-assurance, authoritative, and frictionless campus surveillance and access-control interface. Designed for security personnel, gate marshals, administrative officers, and faculty heads, the UI prioritizes rapid optical scanning, high situational awareness, and zero-ambiguity status confirmation.

The design movement combines **Corporate Modern** with a refined, tactile **Security Desk HUD** (Heads-Up Display) aesthetic. It employs structured architectural divisions, precision micro-borders, functional high-contrast status signifiers, and clear hierarchy. Density is calibrated for both stationary multi-monitor desktop setups at perimeter booths and handheld ruggedized tablets at vehicular checkpoints. The visual tone projects absolute reliability, academic prestige, and vigilant institutional order.

## Colors

The palette is engineered around high legibility, strict access verification, and administrative gravity:

- **Primary (`#0f2042`)**: Deep collegiate navy blue serving as the core structural tone—used in top application bars, active navigation states, primary action triggers, and primary typographic weight.
- **Secondary (`#d97706`) / Accent Gold (`#f59e0b`)**: Institutional academic gold used strictly for security highlights, elevated access privileges, active search accents, and focused states.
- **Tertiary (`#0284c7`)**: Technical surveillance cyan-blue used for informational callouts, live camera telemetry streams, and passive network signals.
- **Neutral (`#64748b` with slate layers)**: Canvas background sits on `#f8fafc` (Slate 50), modular surface containers on `#ffffff`, nested panels on `#f1f5f9` (Slate 100), and crisp borders on `#e2e8f0` (Slate 200) to `#cbd5e1` (Slate 300).
- **Functional Verification Tokens**:
  - `status-verified` (`#059669` emerald / `#ecfdf5` surface): Active authorized entry, cleared badges, verified biometric scans.
  - `status-flagged` (`#e11d48` rose / `#fff1f2` surface): Blacklisted passes, denied entry, unregistered vehicles, tailgating alerts.
  - `status-pending` (`#d97706` amber / `#fffbeb` surface): Visitor checkout required, temporary pass expiring, uninspected cargo.

## Typography

Typography establishes an unambiguous separation between conversational narrative, administrative controls, and mechanical telemetry:

- **Headlines (`Plus Jakarta Sans`)**: Delivers an institutional, forward-leaning architectural authority without being stark or cold. Used for gate identity, zone headings, and operational modals.
- **Body & Controls (`Inter`)**: Applied across metadata fields, operational forms, logs, and personnel descriptions. Characterized by high x-height, open apertures, and exceptional readability on high-DPI displays.
- **Telemetry & Identity Codes (`JetBrains Mono`)**: Strict tabular numerals used across national ID credentials, campus roll numbers, license plates, RFID hex strings, Unix timestamps, and gate transit tallies to prevent visual vibration and alignment shift during live updates.

## Layout & Spacing

The layout is built upon a 12-column responsive fluid grid anchored by persistent situational sidebars and a compact top telemetry bar.

- **Desktop & Multi-Monitor Console (1200px and up)**: 12 columns with 24px gutters and 32px canvas margins. Houses a dual-pane live telemetry view: left side reserved for immediate transit verification (biometric feed / license plate OCR stream), right side for real-time audit logs and campus capacity counters.
- **Tablet Checkpoint Mode (768px - 1199px)**: 8 columns with 16px gutters and 24px margins. Sidebar collapses to a rail; verification modals switch to slide-over drawers optimized for rapid thumb confirmation.
- **Mobile Handheld (320px - 767px)**: 4 columns with 16px gutters and 16px margins. Feeds stack vertically; primary manual override triggers anchor persistently to the bottom viewport boundary.

## Elevation & Depth

Visual hierarchy relies on structural, crisp boundaries paired with subtle ambient occlusion rather than heavy drop shadows:

- **Base Layer (Level 0)**: Canvas background `#f8fafc` with subtle 1px dot-grid overlay in `#e2e8f0` representing the institutional map coordinate space.
- **Surface Cards & Data Tables (Level 1)**: Pure white `#ffffff` surfaces bounded by crisp `1px solid #e2e8f0` borders. Ambient shadow: `0 1px 3px 0 rgba(15, 32, 66, 0.04), 0 1px 2px -1px rgba(15, 32, 66, 0.02)`.
- **Interactive Checkpoint Panels & Overlays (Level 2)**: Elevated card containers for active scan operations and dropdown rosters. Framed with `1px solid #cbd5e1`, casting an ambient shadow: `0 4px 6px -1px rgba(15, 32, 66, 0.08), 0 2px 4px -2px rgba(15, 32, 66, 0.04)`.
- **Emergency Overrides & Inspection Drawers (Level 3)**: Modals and panic panels framed with `1px solid #94a3b8`, backed by a 20% `#0f2042` frosted scrim (`backdrop-blur-sm`), casting `0 20px 25px -5px rgba(15, 32, 66, 0.16)`.

## Shapes

The system uses crisp, precision-machined geometry suited for institutional security infrastructure. Base elements carry a tight `0.25rem` (4px) corner radius, signaling stability, technical rigor, and industrial endurance.

- **Inputs, Buttons, and Data Cells**: `0.25rem` radius to preserve dense visual packing and crisp alignment.
- **Surface Panels & Modals (`rounded-lg`)**: `0.5rem` (8px) radius to soften external card containers without sacrificing structured alignment.
- **Status Badges & Live State Indicators**: Pill-shaped (`rounded-full`) exclusively to clearly differentiate dynamic classification statuses from operational action buttons.

## Components

### Buttons
- **Primary Action (Grant / Register)**: Solid Navy `#0f2042`, white text, 1px subtle inset border, crisp 4px corners. Hover: `#1e3a6d`. Active: scale 0.98. Focus: 2px ring in Gold `#f59e0b` offset by 2px.
- **Secondary (Clear / Log)**: Crisp white surface, 1px border in `#cbd5e1`, text `#0f2042`. Hover: `#f1f5f9`.
- **Critical / Flagged Action (Deny Entry / Quarantine)**: Solid `#e11d48`, white text. Dedicated to physical turnstile lockout or emergency lockdown sequences.
- **Accent Action (Override)**: Solid `#d97706` gold, white text, reserved for supervisor overrides.

### Badges & Verification Chips
- Constructed with high-contrast tinted fills and a mandatory 1px border.
- Include a 6px status dot: pulsing emerald for active verified status, solid red for access revocation, static amber for contractor/visitor passes.
- Text rendered in `JetBrains Mono` at `label-sm` with tabular width.

### Data Tables & Log Streamers
- Compact rows with 40px base height for dense monitoring or 56px for touch terminals.
- Alternating subtle row zebra striping using `#ffffff` and `#f8fafc`.
- Fixed-width numeric columns for timestamps, gate lane identifiers, and badge IDs in `JetBrains Mono`.
- Row border `1px solid #e2e8f0` with active hover illumination in `#f1f5f9`.

### Input Fields & Search Bars
- Background `#ffffff`, border `1px solid #cbd5e1`, font `Inter` body-md.
- Focus state: border turns `#0f2042` with an ambient glow ring of `0 0 0 3px rgba(15, 32, 66, 0.12)`.
- RFID/Barcode scanner input incorporates a gold beacon indicator on the right edge indicating live hardware listener readiness.

### Access Verification HUD Card (Domain-Specific)
- High-visibility candidate verification card containing:
  - High-resolution subject photo bordered by their clearance state color.
  - Large tabular ID number and academic affiliation (Department / Batch / Contractor).
  - Prominent dual-state decision button cluster: [Grant Entry (Spacebar)] vs [Deny / Flag (Esc)].