---
version: alpha
name: Fintech Dashboard — Clean
description: A precision-focused financial dashboard design system optimized for trust, clarity, and high-density numeric interfaces. Clean, institutional design with a focus on readability and structured financial workflows.
colors:
  primary: "#0052CC"
  primary-hover: "#003D99"
  primary-light: "#E6F0FF"
  primary-dark: "#002966"
  bg: "#F7F8FA"
  surface: "#FFFFFF"
  surface-secondary: "#F0F2F5"
  border: "#E1E4E8"
  border-strong: "#C8CCD2"
  text-primary: "#0D1117"
  text-secondary: "#424A53"
  text-muted: "#8B949E"
  positive: "#1A7F37"
  positive-light: "#DAFBE1"
  negative: "#CF222E"
  negative-light: "#FFEBE9"
  warning: "#BF8700"
  warning-light: "#FFF8C5"
  info: "#0052CC"
  bg-dark: "#0D1117"
  surface-dark: "#161B22"
  surface-secondary-dark: "#1C2128"
  border-dark: "#30363D"
  text-primary-dark: "#F0F6FC"
  text-secondary-dark: "#8B949E"
  positive-dark: "#3FB950"
  negative-dark: "#F85149"
typography:
  display:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.5px
  h1:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.3px
  h2:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.2px
  h3:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0px
  h4:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.4px
  body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0px
  small:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
  mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0px
  mono-md:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0px
  mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
rounded:
  sm: 6px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  base: 4px
  space-1: 4px
  space-2: 8px
  space-3: 12px
  space-4: 16px
  space-5: 20px
  space-6: 24px
  space-8: 32px
  space-12: 48px
  grid-columns: "12"
  gutter: 24px
  page-margin-desktop: 32px
  page-margin-mobile: 16px
  sidebar-width: 240px
  max-content-width: 1200px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    typography: "{typography.body}"
    padding: 8px 16px
    height: 36px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-active:
    backgroundColor: "{colors.primary-dark}"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    borderColor: "{colors.border-strong}"
  button-destructive:
    backgroundColor: "{colors.negative}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    borderColor: "{colors.border-strong}"
    typography: "{typography.body}"
    height: 36px
    padding: 8px 12px
  card-balance:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    borderColor: "{colors.border}"
    padding: "{spacing.space-6}"
  table-transaction-header:
    backgroundColor: "{colors.surface-secondary}"
    textColor: "{colors.text-muted}"
    typography: "{typography.h4}"
  badge-status-completed:
    backgroundColor: "{colors.positive-light}"
    textColor: "{colors.positive}"
    rounded: "{rounded.full}"
    typography: "{typography.small}"
    padding: 2px 8px
  badge-status-pending:
    backgroundColor: "{colors.warning-light}"
    textColor: "{colors.warning}"
    rounded: "{rounded.full}"
    typography: "{typography.small}"
    padding: 2px 8px
  badge-status-failed:
    backgroundColor: "{colors.negative-light}"
    textColor: "{colors.negative}"
    rounded: "{rounded.full}"
    typography: "{typography.small}"
    padding: 2px 8px
---

## Brand & Style

This design system serves financial dashboards for banking, payments, trading, and investment contexts. It targets both expert operators and everyday account holders, with a visual language tuned for trust, precision, and interpretability.

The style is institutional and confidence-led: numbers are the primary content, while chrome remains quiet and structural. Interface writing is factual, formatting is explicit, and all high-impact actions emphasize clarity of consequence.

## Colors

The palette combines cool neutral surfaces with strict semantic accents:

- `primary` blue is reserved for action and focus signaling.
- `positive` and `negative` encode monetary direction and are never reused decoratively.
- Neutral layers (`bg`, `surface`, `surface-secondary`) keep data views calm, dense, and scannable.

Dark mode preserves the same semantic mapping with dedicated dark-surface tokens.

## Typography

Typography is optimized for legibility and numeric confidence. Inter carries UI prose and hierarchy, while JetBrains Mono is used for monetary values, balances, and references requiring strict visual alignment.

Rules:

- Use tabular numerals for all currency and numeric columns.
- Keep monetary formatting explicit with currency symbols/codes and sign indicators.
- Use monospace tiers for high-value and tabular number presentation.

## Layout & Spacing

Layout follows a 12-column system with a fixed desktop sidebar and dense content region for transaction-heavy workflows. The top layer prioritizes balances and summaries before deeper details.

Spacing uses a 4px base scale with strong consistency across cards, tables, and forms. Tables and account history are treated as primary content surfaces and receive maximum horizontal space.

Responsive behavior:

- Mobile: single-column, hidden sidebar, action sheets.
- Tablet: collapsed sidebar and reduced columns.
- Desktop: full sidebar and wide data grids.

## Elevation & Depth

Depth remains subtle and utilitarian:

- Base surfaces stay mostly flat with borders doing most of the separation work.
- Light shadows are used only where layering clarity is needed (dropdowns, modals, toasts).
- Confirmation dialogs use stronger overlay and elevation treatment to reinforce risk awareness for financial actions.

## Shapes

Shape language is clean and controlled:

- Standard interactive corners use 6px.
- Cards step up to 8px for container softness.
- Modals use 12px for elevated context.
- Status pills use full rounding to maintain quick semantic recognition.

## Components

### Buttons

Primary actions use `button-primary` and always retain explicit action labels with amounts when money moves (for example, "Confirm Transfer - $500.00"). Destructive actions use `button-destructive` and require confirmation safeguards.

### Inputs

`input-field` is compact and high-contrast, with strong focus/error differentiation. Currency entry should be right-aligned, tabular, and paired with visible currency context.

### Cards and Tables

`card-balance` presents financial summary data with high emphasis on value, directional delta, and timestamp context. Transaction tables prioritize right-aligned numeric columns, sticky headers, and stable row rhythm.

### Status Badges

Status badges are semantic pills (`badge-status-completed`, `badge-status-pending`, `badge-status-failed`) and should accompany text labels rather than relying on color alone.

## Do's and Don'ts

- Do right-align monetary values and use tabular numerals.
- Do show currency, fees, and timestamps explicitly.
- Do pair gain/loss colors with signs or directional iconography.
- Don't truncate or approximate monetary amounts unless explicitly labeled.
- Don't use warm decorative backgrounds or playful copy in transactional flows.
- Don't skip confirmations for money-moving actions.
