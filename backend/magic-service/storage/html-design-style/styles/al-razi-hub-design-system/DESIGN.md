# Al-Razi Hub Design System

A warm-clinical design system for a tablet-first clinical information platform. Deep teal primary on warm off-white, IBM Plex type, balanced radii, spacious density. Light mode only (MVP). Stack: Next.js, Tailwind, shadcn. All text/background pairs meet WCAG AA; all interactive elements meet a 48px touch target. Layouts use logical CSS properties (`inline-start`/`inline-end`, `padding-inline`) so they flip cleanly for Phase 2 Arabic RTL.

## Colors

### Surface
- **Background** (#F7F5F1): App background — warm paper
- **Surface** (#FFFFFF): Cards, modals, popovers
- **Surface Alt** (#F1EEE8): Subtle fills, table headers, toolbars
- **Hover** (#EBE7DF): Row / item hover
- **Border** (#E2DED4): Default hairline
- **Border Strong** (#C9C3B6): Input borders, dividers, pressed states

### Text (ink)
- **Ink** (#1C1A16): Primary text — 16.8:1 on Surface
- **Ink Muted** (#55504A): Secondary text — 7.6:1
- **Ink Subtle** (#7A736B): Tertiary, meta, hints — 4.7:1
- **Inverse** (#FFFFFF): Text on filled fills

### Primary — deep teal
- **Primary** (#0E6F78): Buttons, links, focus accent
- **Primary Hover** (#0B5E66)
- **Primary Active** (#094B52)
- **Primary Soft** (#D9ECEE): Soft tint background
- **Primary Ink** (#083E44): Text on Primary Soft

### Semantic (filled / soft / ink-on-soft)
- **Danger** (#B42318 / #FDECEA / #7A1510); Danger Hover (#9A1C13)
- **Success** (#1F7A4C / #E3F2EA / #14532D)
- **Warning** (#B54708 / #FDF0E3 / #7C2D12)
- **Info** (#1E5AA8 / #E3ECF8 / #153E75)

### Accent — "your items"
Warm amber, distinct from Primary so "mine" markers never compete with CTAs.
- **Accent** (#A8620A)
- **Accent Soft** (#FBEFDB)
- **Accent Ink** (#6B3D05)
- **Accent Border** (#E5B472)

### Color rules
- One Primary CTA per surface; pair with Secondary for cancel — never two primaries.
- Soft is the default for badges, toasts, callouts. Reserve filled variants for single critical callouts.
- Color is never the only signal — out-of-range, status, and validation states always carry an icon, label, or shape too.
- Accent only marks items belonging to the current clinician. Do not promote it to a second brand color.

## Typography

- **Sans:** IBM Plex Sans (400, 500, 600, 700)
- **Mono:** IBM Plex Mono (400, 500, 600) — used for IDs, timestamps, dosages, vitals with `font-variant-numeric: tabular-nums`

Body never goes below 16px. 14px (`Meta`) is for chrome only — badges, breadcrumbs, table headers — never for the things a clinician is reading. 12px (`Eyebrow`) is uppercase labels only.

- **Display**: 32px / 40px, 600, -0.01em — page hero, marketing
- **H1**: 26px / 34px, 600, -0.005em — screen title
- **H2**: 22px / 30px, 600 — section title, patient banner name
- **H3**: 18px / 26px, 600 — card title
- **Body Large**: 18px / 28px, 400 — lede paragraphs
- **Body**: 16px / 24px, 400 — default
- **Body Strong**: 16px / 24px, 500 — labels, button text, emphasis
- **Meta**: 14px / 20px, 500, +0.01em — badges, table headers (chrome only)
- **Eyebrow**: 12px / 16px, 600, +0.08em, UPPERCASE — section labels, in `Ink Subtle`
- **Mono**: 15px / 22px, 500 — IDs, codes, timestamps
- **Mono Small**: 13px / 18px, 500 — compact IDs, request ids in audit

Don't combine 700 weight with primary tint as a substitute for hierarchy — use a heading token instead.

## Spacing

Base unit: **4px**. Default density: **spacious**.

- `0`: 0
- `1`: 4px — icon-text gap
- `2`: 8px — inline gap
- `3`: 12px — tight stack
- `4`: 16px — card inner padding
- `5`: 20px — default page/card padding
- `6`: 24px — section breathing room
- `8`: 32px — page padding (tablet)
- `10`: 40px — section gap
- `12`: 48px — minimum touch target
- `16`: 64px — hero / page bottom

### Touch targets
- **Spacious (default)**: 48px minimum
- **Comfortable**: 44px minimum

All interactive elements — buttons, list rows, table action cells, tab headers, menu items — meet the active density's minimum.

## Radii
- **Sharp** (4px): Inputs in dense tables
- **Medium** (6px): Inputs, small buttons (default)
- **Large** (10px): Cards, banners
- **XL** (14px): Modals, large surfaces
- **Pill** (999px): Pills, badges, switches

Alternative scales: `[data-radius="sharp"]` and `[data-radius="soft"]`.

## Elevation

Prefer `Border` over `Shadow Small` for resting surfaces. Reserve shadow for things that genuinely float (popovers, toasts, modals).

- **Shadow XS**: `0 1px 0 rgba(28,26,22,0.04), 0 1px 2px rgba(28,26,22,0.04)` — segmented active thumb
- **Shadow Small**: `0 1px 2px rgba(28,26,22,0.05), 0 1px 3px rgba(28,26,22,0.06)` — resting cards (rare)
- **Shadow Medium**: `0 4px 8px -2px rgba(28,26,22,0.06), 0 2px 4px -2px rgba(28,26,22,0.06)` — toasts, popovers
- **Shadow Large**: `0 12px 24px -8px rgba(28,26,22,0.12), 0 4px 8px -4px rgba(28,26,22,0.06)` — modals, slide-overs
- **Shadow Focus**: `0 0 0 3px rgba(14,111,120,0.28)` — universal focus ring (never suppressed)
- **Shadow Focus Danger**: `0 0 0 3px rgba(180,35,24,0.28)` — destructive controls

## Motion

All easing uses the same in/out curve `cubic-bezier(0.2, 0, 0.2, 1)`. Avoid spring physics — clinical UI must feel deterministic.

- **Fast** (120ms): Hover, press, state changes
- **Base** (180ms): Enter / exit, accordions
- **Slow** (240ms): Slide-over, modal

## Components

### Buttons
Variants: `primary`, `secondary`, `ghost`, `destructive`, `link`. Radius: 6px. All buttons are 1px-bordered (transparent on ghost/link).
- **Small**: 36px height, 12px padding-x, Body
- **Medium** (default): 48px height, 18px padding-x, Body Strong
- **Large**: 56px height, 22px padding-x, Body Strong
- Loading state shows a 14px spinner in the button's text color and disables the button.
- Icon-only buttons are square and must carry `aria-label`.

### Form inputs
- Default field: 48px height, 6px radius, 1px Border Strong, Surface bg
- Disabled: Surface Alt bg, Border Strong, Ink Muted text
- Error: Danger border; helper text in Danger Ink with leading warning icon
- Mono variant for fields containing IDs (MRN, request ids)
- Checkboxes / radios: 20×20px, `accent-color: Primary`
- Switches: 48×28px pill with 22×22 thumb; on = Primary, off = Border Strong
- Structure: label (Body Strong) → control → optional hint (Ink Subtle) or error (Danger Ink)

### Status badges
Six variants × three styles. Pick **one style system-wide** per screen — don't mix soft and filled for the same role.
- **Variants**: Scheduled (info), Completed (success), Pending (warning), Urgent (danger), Canceled (neutral), Mine (accent)
- **Soft** (default): Soft bg + Ink-on-soft. Calm, dense-list-friendly.
- **Filled**: Single callout in a sea of soft (e.g. one Urgent badge).
- **Outline**: Print/export views and very dense tables.

### Type badges
Non-status taxonomies. Same shell with a leading dot in role color.
- **Appointment**: Consultation, Operation, Other
- **Document**: Clinical note, Lab report, Imaging report, Discharge summary
- **Modality**: XR, CT, MRI, US, PET (always abbreviated, never spelled out)

### Tabs
- **Underline** (default): 48px tall, 2px Primary underline on active, optional pill counter
- **Segmented**: 40px pills inside a Surface Alt track with Shadow XS on the active thumb. Use for binary or three-way view modes (Day / Week / Month).

### Tables
- Header: Surface Alt bg, Eyebrow uppercase, 1px Border bottom
- Rows: 14px vertical padding, 16px horizontal, 1px Border bottom
- Numeric / mono cells: `font-variant-numeric: tabular-nums`
- "Mine" rows: 3px Accent left rule + Accent Soft mixed background
- Always render an explicit row action — never make the whole row clickable without affordance

### Modal
Width `min(480px, 92%)`, radius 14px, Shadow Large, backdrop `rgba(28,26,22,0.28)` + 1px blur. Footer is a Surface Alt band with right-aligned actions (secondary then primary/destructive). Use for confirmation flows ≤ ~3 fields; for anything longer use a slide-over.

### Slide-over
Right-side panel (logical end-side), `min(420px, 80%)`, Shadow Large. Three-row grid: header / scrollable body / footer. Animates in over 240ms. Use to fill in a form **without losing the underlying screen context** (new order, new note, edit appointment).

### Toasts
4px left rule in role color, Surface bg, Shadow Medium. Three-column grid: 32px circular icon (in role's soft+ink) · text stack · dismiss.
- Variants: success, info, warning, danger
- Auto-dismiss: 4s for success/info; sticky for warning/danger until dismissed.

### Empty states
Dashed Border Strong outline, Surface Alt bg, 10px radius. Icon → H3 headline → Body explanation (max 44ch) → primary action + optional ghost link. **Never spinner-only** — empty states must explain what's missing and offer the next step.

### Skeletons
Match the final layout — never a generic spinner. Single-line shimmer: `linear-gradient(90deg, Surface Alt, Hover, Surface Alt)` cycling left-to-right at 1.4s. List skeletons preserve avatar size, line count, and rough widths so the page doesn't reflow when data lands.

### Focus
Focus rings are **never suppressed**. A single global rule applies to every interactive element.
```css
:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
  border-color: var(--primary);
}
```
Destructive controls swap to `--shadow-focus-danger`.

## Layout

Tablet-first. The shell scales from a 64px collapsed rail to a 240px expanded rail at desktop widths.
- **Collapsed (icons only)**: 64px — tablet, narrow desktop
- **Expanded (labeled)**: 240px — desktop ≥ 1280px or user-pinned
- **Top bar**: 36–56px depending on density. Holds brand mark, breadcrumb / title, global search, user menu.
- **Active rail item**: Primary Soft fill, Primary Ink text, **3px Primary tab on the inline-start edge**. Never both background and underline.
- **Hovered rail item**: Hover background only.
- **User chip**: rail bottom (`margin-block-start: auto`). Initials in Accent Soft / Accent Ink to mirror "Mine".
- **Main content**: max-width 1440px, padding `--space-8` (32px) on tablet, `--space-10` on desktop.

### RTL readiness
All shell layouts use logical CSS — `inline-start`/`inline-end`, `padding-inline`, `margin-inline`, `border-inline-start` for the active-tab indicator. When `` is set, the rail flips to the right, the active indicator flips with it, and chevrons in row actions mirror via the `[dir="rtl"]` selector.

## Clinical patterns

### Patient banner
Sticks to the top of any patient detail screen.
- 56px circular avatar in Primary Soft / Primary Ink (initials)
- 3px Accent rule on inline-start edge if patient is "mine"
- Name in H2 with inline soft badges: `Mine`, allergy alerts (e.g. `Allergy: Penicillin` as Urgent soft)
- Meta row in Ink Muted: age · sex · MRN (mono) · DOB (mono) · ward / bed
- Trailing actions: `History` (secondary) + `New order` (primary)

### Lab results encoding
Out-of-range values must be unambiguous to color-blind users. **Color is one of three signals, never the only one.**
- **Normal**: Success dot · "Normal"
- **Low**: Info Soft chip · down-arrow glyph · "LOW"
- **High**: Danger Soft chip · up-arrow glyph · "HIGH"
- **Critical High**: Danger filled chip · up-arrow glyph · "CRIT ↑" + 3px Danger left row rule + soft danger row tint

In addition, the value cell adopts Info Ink (low) or Danger Ink (high) and bumps to weight 600.

### Audit log
Immutable list of system events.
- Columns: Time (mono) · Actor · Action (mono, snake_case) · Target · Request ID (mono, dim)
- Time uses Mono Small with `tabular-nums`
- Actions are kept in a fixed vocabulary: `signed_lab_order`, `viewed_patient`, `recorded_vitals`, `session_refreshed`, `updated_role`, …
- Request IDs render in Ink Subtle; clicking copies. Never truncate them in the UI — they are the support handoff.

### Cards
All share Surface bg, Border, 10px radius.
- **Stat card**: eyebrow label, 32/40 numeral with `tabular-nums`, soft success delta line
- **Appointment card**: 3px Accent start rule when "mine", mono time range, name in Body Strong, room/notes muted, type badge at foot
- **Patient card**: 40px avatar + name + MRN, meta line with status badge

### Network / session banners
A 36px sticky bar with a 3px left rule and a soft fill. Banners always include a mono "last sync" timestamp on the inline-end side when connectivity is degraded.
- **Connection lost** (warning): animated shimmer · sticky
- **Connection back** (success): auto-dismiss after 3s
- **Session expiring** (info): persistent · "Stay signed in" link

### Error states
- **Inline retry**: Danger Soft card with title, body, mono request id + timestamp, primary `Retry` + ghost `Copy request id`. Request id is always present and selectable.
- **Full-page error**: 48px circular icon over Danger Soft, H3 headline, body explaining next step, secondary "Go to dashboard" + primary "Try again". No stack traces.

## Guidelines

### Do
- Use Mono with `tabular-nums` for patient identifiers, dates of birth, dosages, vitals — they line up vertically across rows or they look untrustworthy.
- Give critical results redundant signaling (color + icon + label + row rule). One signal can fail; three cannot.
- Surface a request id and a timestamp in every error UI. Clinicians copy these to support; without them, every issue becomes a screenshot.
- Make every empty and error state offer at least one action. A clinician should never reach a dead end mid-shift.
- Use explicit destructive verbs in dialogs: `Cancel appointment`, `Discharge`, `Void order` — never just `OK`.
- Use logical CSS properties everywhere so layouts flip for Phase 2 Arabic RTL without rework.

### Don't
- Don't put two Primary buttons on the same surface.
- Don't use color alone to encode status, validation, or out-of-range values.
- Don't drop below 16px for body text or 48px for touch targets.
- Don't promote Accent (amber) to a second brand color — it only marks "mine".
- Don't suppress focus rings, even in custom controls.
- Don't use spring physics or playful easing — clinical UI must feel deterministic.

## CSS Tokens

```css
:root {
  /* surface */
  --bg: #F7F5F1;
  --surface: #FFFFFF;
  --surface-alt: #F1EEE8;
  --hover: #EBE7DF;
  --border: #E2DED4;
  --border-strong: #C9C3B6;

  /* ink */
  --ink: #1C1A16;
  --ink-muted: #55504A;
  --ink-subtle: #7A736B;
  --inverse: #FFFFFF;

  /* primary */
  --primary: #0E6F78;
  --primary-hover: #0B5E66;
  --primary-active: #094B52;
  --primary-soft: #D9ECEE;
  --primary-ink: #083E44;

  /* semantic */
  --danger: #B42318;       --danger-hover: #9A1C13;
  --danger-soft: #FDECEA;  --danger-ink: #7A1510;
  --success: #1F7A4C;      --success-soft: #E3F2EA;  --success-ink: #14532D;
  --warning: #B54708;      --warning-soft: #FDF0E3;  --warning-ink: #7C2D12;
  --info: #1E5AA8;         --info-soft: #E3ECF8;     --info-ink: #153E75;

  /* accent */
  --accent: #A8620A;
  --accent-soft: #FBEFDB;
  --accent-ink: #6B3D05;
  --accent-border: #E5B472;

  /* radius */
  --r-sm: 4px;  --r-md: 6px;  --r-lg: 10px;  --r-xl: 14px;  --r-pill: 999px;

  /* shadow */
  --shadow-xs: 0 1px 0 rgba(28,26,22,0.04), 0 1px 2px rgba(28,26,22,0.04);
  --shadow-sm: 0 1px 2px rgba(28,26,22,0.05), 0 1px 3px rgba(28,26,22,0.06);
  --shadow-md: 0 4px 8px -2px rgba(28,26,22,0.06), 0 2px 4px -2px rgba(28,26,22,0.06);
  --shadow-lg: 0 12px 24px -8px rgba(28,26,22,0.12), 0 4px 8px -4px rgba(28,26,22,0.06);
  --shadow-focus: 0 0 0 3px rgba(14,111,120,0.28);
  --shadow-focus-danger: 0 0 0 3px rgba(180,35,24,0.28);

  /* motion */
  --mo-fast: 120ms cubic-bezier(0.2, 0, 0.2, 1);
  --mo-base: 180ms cubic-bezier(0.2, 0, 0.2, 1);
  --mo-slow: 240ms cubic-bezier(0.2, 0, 0.2, 1);

  /* type */
  --font-sans: 'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;

  --tw-display:     600 32px/40px var(--font-sans);
  --tw-h1:          600 26px/34px var(--font-sans);
  --tw-h2:          600 22px/30px var(--font-sans);
  --tw-h3:          600 18px/26px var(--font-sans);
  --tw-body-lg:     400 18px/28px var(--font-sans);
  --tw-body:        400 16px/24px var(--font-sans);
  --tw-body-strong: 500 16px/24px var(--font-sans);
  --tw-meta:        500 14px/20px var(--font-sans);
  --tw-eyebrow:     600 12px/16px var(--font-sans);
  --tw-mono:        500 15px/22px var(--font-mono);
  --tw-mono-sm:     500 13px/18px var(--font-mono);

  /* spacing — 4px base */
  --space-0: 0;     --space-1: 4px;   --space-2: 8px;   --space-3: 12px;
  --space-4: 16px;  --space-5: 20px;  --space-6: 24px;  --space-8: 32px;
  --space-10: 40px; --space-12: 48px; --space-16: 64px;

  /* touch */
  --touch: 48px;        /* spacious (default) */
  --touch-comfy: 44px;  /* comfortable */
}

[data-radius="sharp"] { --r-md: 4px; --r-lg: 6px;  --r-xl: 8px;  }
[data-radius="soft"]  { --r-md: 8px; --r-lg: 14px; --r-xl: 18px; }
[data-density="comfortable"] { --touch: 44px; }
[data-density="spacious"]    { --touch: 48px; }
```
