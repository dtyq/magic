---
version: alpha
name: Health & Wellness
description: A calm, accessible health product design system focused on trust, readability, and low cognitive load.
colors:
  primary: "#0D7C66"
  primary-hover: "#0A6352"
  primary-light: "#E6F5F1"
  primary-dark: "#065445"
  background: "#FAFBFC"
  surface: "#FFFFFF"
  surface-warm: "#F7F5F2"
  border: "#E2E5E9"
  border-strong: "#CBD0D6"
  text-primary: "#1A202C"
  text-secondary: "#4A5568"
  text-muted: "#A0AEC0"
  success: "#2F855A"
  success-light: "#F0FFF4"
  warning: "#C05621"
  warning-light: "#FFFAF0"
  error: "#C53030"
  error-light: "#FFF5F5"
  info: "#2B6CB0"
  info-light: "#EBF8FF"
typography:
  h1:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.3px
  h2:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.2px
  h3:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0px
  h4:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: 0px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: 0px
  small:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0px
  caption:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0px
rounded:
  sm: 8px
  md: 12px
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
  space-10: 40px
  space-12: 48px
  gutter: 24px
  page-margin-desktop: 32px
  page-margin-mobile: 16px
  max-content-width: 960px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 48px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-active:
    backgroundColor: "{colors.primary-dark}"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    borderColor: "{colors.border-strong}"
    height: 48px
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    borderColor: "{colors.border-strong}"
    padding: 12px
    height: 48px
  card-appointment:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    borderColor: "{colors.border}"
    padding: 20px
  card-medication:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    borderColor: "{colors.border}"
    padding: 20px
  alert-info:
    backgroundColor: "{colors.info-light}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: 16px
  alert-warning:
    backgroundColor: "{colors.warning-light}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: 16px
  alert-error:
    backgroundColor: "{colors.error-light}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: 16px
  alert-success:
    backgroundColor: "{colors.success-light}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: 16px
---

## Brand & Style

Calm is the interface and trust is the outcome. This system targets telemedicine, patient portals, and wellness products where users may be stressed, unwell, or cognitively overloaded. The visual tone is clean, warm, and professional, inspired by products such as Headspace and One Medical.

Accessibility is foundational rather than additive. The experience should reduce anxiety through plain language, predictable interactions, and generous spacing. Copy is warm and direct, error states are non-blaming, and microcopy near sensitive fields should reassure users that their data is protected.

## Colors

The palette is built around a calming teal-green primary with soft clinical neutrals. Strong red is reserved for genuinely urgent issues, while most actionable reminders use warning orange to avoid unnecessary alarm.

- Primary (`#0D7C66`) communicates confidence and wellness for primary actions and active states.
- Neutrals keep long-form health content readable: cool-tinted page background, white surfaces, and low-noise borders.
- Semantic colors are explicit and functional: success for confirmation, warning for action needed, error for urgent issues, and info for guidance.
- No dark mode is defined in this system; readability in mixed environments is prioritized.

## Typography

Typography uses **Plus Jakarta Sans** for warmth and legibility, with **JetBrains Mono** reserved for IDs and medical record-like technical data in implementation.

- Body text minimum is `16px`, with `1.7` line-height for dense instructions and forms.
- Heading scale emphasizes clear hierarchy without high visual pressure.
- Copy must favor plain terms over jargon and always include units for dosage or measurements.
- Dates should be written in non-ambiguous long form (for example, "April 6, 2026").

## Layout & Spacing

The layout uses a 12-column grid with a constrained `960px` max content width so health information feels focused and not overwhelming.

- Page margins: `32px` desktop and `16px` mobile.
- Spacing uses a `4px` base scale with generous vertical rhythm.
- Prioritize one clear primary action per screen or section.
- Use progressive disclosure for secondary details to reduce cognitive load.
- Breakpoints: mobile `<640px`, tablet `640px-1024px`, desktop `>1024px`.

## Elevation & Depth

Depth is intentionally subtle to keep the interface calm.

- `XS`: `0 1px 3px rgba(0,0,0,0.04)` for resting cards.
- `SM`: `0 2px 8px rgba(0,0,0,0.06)` for hover surfaces and menus.
- `MD`: `0 4px 16px rgba(0,0,0,0.08)` for modals.

Use borders and tonal separation before stronger shadows; avoid dramatic layering that adds visual tension.

## Shapes

The shape language is soft and reassuring:

- Inputs and buttons use `8px` rounding.
- Cards use `12px` rounding.
- Fully pill-shaped badges use `9999px`.

Rounded corners should remain consistent across components to preserve familiarity and reduce cognitive friction.

## Components

### Buttons

Primary buttons use teal with white text, `48px` minimum height, and full-phrase labels such as "Book Appointment" or "Mark as Taken." Secondary buttons keep neutral text with outlined treatment. Icon-only buttons should be avoided for core health actions.

### Inputs

Inputs are white with strong but soft borders, visible labels above fields, and helper/error text beneath. Required fields should use explicit "(required)" text, and validation should trigger on blur with human-readable feedback.

### Cards

Appointment and medication cards use soft surfaces, subtle borders, and clear hierarchy for date/time, clinician or dosage context, and next action. Medication actions should remain obvious and full-width where appropriate.

### Alerts and Status

Alerts use left-accented semantic states (info, warning, error, success) with readable contrast and calm language. Error banners should communicate safety and next steps without exposing technical codes.

### Navigation and Accessibility Patterns

Top navigation is `64px` high with clear active state treatment. Across all components, enforce minimum `48px` targets, keyboard-visible focus rings, clear labels, and no hover-only interactions.

## Do's and Don'ts

### Do

- Use plain language around a 6th-grade reading level.
- Provide clear next steps after major actions.
- Include privacy reassurance near sensitive fields.
- Keep touch targets at least `48px` and support keyboard/screen reader flows.
- Use generous spacing and simple hierarchy in dense health contexts.

### Don't

- Don't use jargon without explanation.
- Don't use urgent red or flashing motion for non-emergency notifications.
- Don't use small text for important information.
- Don't time out long forms while users are completing them.
- Don't rely on icon-only controls for critical tasks.
