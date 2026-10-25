---
version: alpha
name: Enterprise SaaS
description: Data-dense enterprise interface system focused on trust, clarity, and efficient workflows.
colors:
  primary: "#2563EB"
  primary-hover: "#1D4ED8"
  primary-dark: "#1E40AF"
  primary-light: "#EFF6FF"
  bg: "#FAFAFA"
  surface: "#FFFFFF"
  surface-secondary: "#F5F5F5"
  border: "#E5E7EB"
  border-strong: "#D1D5DB"
  text-primary: "#111827"
  text-secondary: "#4B5563"
  text-muted: "#9CA3AF"
  success: "#059669"
  success-light: "#ECFDF5"
  warning: "#D97706"
  warning-light: "#FFFBEB"
  error: "#DC2626"
  error-light: "#FEF2F2"
  dark-bg: "#0F0F0F"
  dark-surface: "#1A1A1A"
  dark-border: "#2E2E2E"
  dark-text-primary: "#F9FAFB"
  dark-text-secondary: "#9CA3AF"
typography:
  display:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.2
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
  body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0px
  small:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
  tiny:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.2px
  mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  full: 9999px
spacing:
  space-1: 4px
  space-2: 8px
  space-3: 12px
  space-4: 16px
  space-5: 20px
  space-6: 24px
  space-8: 32px
  space-10: 40px
  space-12: 48px
  space-16: 64px
  gutter: 24px
  page-margin-desktop: 32px
  page-margin-mobile: 16px
  content-max: 1280px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: 36px
    padding: 8px 16px
  button-secondary:
    backgroundColor: transparent
    borderColor: "{colors.border-strong}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: 36px
    padding: 8px 16px
  input-field:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border-strong}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: 36px
    padding: 8px 12px
  card-default:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
    padding: "{spacing.space-6}"
  table-header:
    backgroundColor: "{colors.surface-secondary}"
    textColor: "{colors.text-muted}"
    typography: "{typography.tiny}"
  badge-status:
    rounded: "{rounded.sm}"
    typography: "{typography.tiny}"
    padding: 2px 8px
  modal-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "{spacing.space-6}"
---

## Brand & Style

This design system targets enterprise dashboards and workflow-heavy admin tools where users spend long sessions managing operations, analytics, and team processes.

The style is calm, precise, and high-trust: interfaces should feel reliable and professional rather than expressive. Information hierarchy is the primary design mechanism, and visual decoration is minimized so data remains the focal point.

## Colors

The palette uses neutral surfaces with a single blue interaction color and strict semantic states.

- Primary blue is reserved for actions, links, and active states.
- Neutral surfaces and border tones define structure and density without visual noise.
- Semantic colors are functional only: success, warning, and error must retain their meaning across all contexts.
- Badge and alert treatments pair `-light` backgrounds with their corresponding semantic foreground color.
- In dark mode, brand and semantic accents remain stable while backgrounds and text switch to dark-surface tokens.

## Typography

Typography is tuned for dense, scannable enterprise content.

- Base text is `14px` Inter with comfortable line height for long-form dashboard reading.
- Headings use tighter tracking and heavier weights to separate sections and key data points quickly.
- `12px` and `13px` sizes are reserved for metadata, badges, and helper labels.
- Monospace styling is used for IDs, codes, hashes, and other technical values in tables.
- Numeric interfaces should use tabular figures for aligned metrics.

## Layout & Spacing

Layout follows a 12-column desktop grid with a fixed sidebar pattern and strict spacing rhythm.

- Maximum content width is `1280px` with `24px` gutters.
- Page margins: `32px` on desktop and `16px` on mobile.
- Spacing tokens follow a 4px base scale; ad hoc spacing values are disallowed.
- Sections stack with larger scale tokens (`space-8` and above) to preserve scanability in data-heavy views.
- Responsive model: mobile single-column, tablet collapsed sidebar, desktop full sidebar with multi-column content.

## Elevation & Depth

This system is flat by default and uses elevation only when elements float above content.

- Cards and standard panels rely on borders, not shadows.
- Light shadows are used for hover states and floating layers such as dropdowns, toasts, and dialogs.
- Modal and overlay layers may use stronger depth, but shadow opacity remains restrained.
- In dark mode, elevation is communicated primarily through tonal contrast between surfaces rather than visible shadows.

## Shapes

Shape language is restrained and consistent.

- Buttons and form controls use `6px` radius.
- Cards and containers use `8px` radius.
- Modals use `12px` radius.
- Full rounding is limited to avatars and small pill-style badges.

## Components

### Buttons

Primary, secondary, ghost, destructive, and icon button variants are supported. Each view section should have only one primary call-to-action. Destructive actions require explicit confirmation.

### Inputs

Inputs use bordered, high-contrast fields with top-aligned labels, optional helper text, and replacement error messaging in the same slot. Focus and error states use distinct ring treatments tied to color tokens.

### Cards

Cards are structural containers for grouped information, not decorative wrappers. Nested cards are disallowed; use bordered internal sections when additional grouping is needed.

### Tables

Tables are core primitives with mandatory headers, sortable affordances, clear alignment rules (text left, numbers right), hover and selected states, and explicit empty/loading/error handling.

### Feedback Patterns

Badges, toasts, banners, modals, and empty states communicate status without ambiguity, pairing semantic color usage with clear textual labels and accessible interaction behavior.

## Do's and Don'ts

- Do maintain strict spacing token usage and consistent corner-radius mapping by component class.
- Do keep interactions accessible: clear focus states, keyboard support, and minimum touch targets.
- Do provide loading, empty, and error states for every data-driven surface.
- Do keep copy direct and instructional; favor concise, action-oriented labels.
- Don't use blue decoratively or overload views with multiple accent colors.
- Don't rely on color alone for status meaning; combine with labels or icons.
- Don't apply heavy shadows or decorative motion in core workflow surfaces.
- Don't hide labels in placeholders or center-align dense body/table content.
