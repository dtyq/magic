---
version: alpha
name: African Mobile-First
description: A mobile-first design system for African SMEs built for low bandwidth, bright sunlight readability, and first-time SaaS users.
colors:
  primary: "#005F8E"
  primary-hover: "#004D73"
  primary-light: "#E8F4F8"
  primary-dark: "#003D5C"
  accent: "#FFB703"
  accent-dark: "#CC9200"
  accent-light: "#FFF8E1"
  background: "#FAFAFA"
  surface: "#FFFFFF"
  surface-warm: "#F8F7F4"
  border: "#E5E5E5"
  text-primary: "#1A1A1A"
  text-secondary: "#555555"
  text-muted: "#888888"
  success: "#16A34A"
  success-light: "#F0FDF4"
  warning: "#CA8A04"
  warning-light: "#FEFCE8"
  error: "#DC2626"
  error-light: "#FEF2F2"
  whatsapp: "#25D366"
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.3px
  h1:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.2px
  h2:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0px
  h3:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0px
  body:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0px
  small:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
  tiny:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.3px
  mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.5px
rounded:
  sm: 6px
  md: 10px
  lg: 12px
  xl: 16px
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
  page-margin-mobile: 16px
  page-margin-tablet: 24px
  max-content-width-mobile: 480px
  max-content-width-desktop: 960px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 14px 24px
    height: 48px
    width: 100%
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-active:
    backgroundColor: "{colors.primary-dark}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    borderColor: "{colors.border}"
    height: 48px
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    height: 48px
  button-whatsapp:
    backgroundColor: "{colors.whatsapp}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: 48px
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    borderColor: "{colors.border}"
    padding: 14px 16px
    height: 48px
  card-order:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    borderColor: "{colors.border}"
    padding: 16px
  card-metric:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    borderColor: "{colors.border}"
    padding: 16px
  badge-status:
    rounded: "{rounded.sm}"
    padding: 4px 10px
    typography: "{typography.tiny}"
  sheet-bottom:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: 24px 16px
  nav-tab-bar:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    height: 64px
---

## Brand & Style

Built for the 90%. This system targets SME owners and their customers across Africa who are smartphone-first, data-conscious, and often first-time SaaS users. The interface should feel approachable, trustworthy, fast, clear, and empowering.

Design decisions prioritize worst-case conditions: 5-inch Android screens, bright outdoor sunlight, and unstable 3G connections. The voice is warm and direct, with simple language and reassuring microcopy that confirms actions clearly.

## Colors

The palette combines a confidence-driving primary blue with a high-visibility accent yellow, supported by warm neutral surfaces and explicit semantic states.

- Primary blue drives actions and active navigation.
- Accent yellow is used for highlights and badges, never for text.
- Semantic colors must always include text labels; color-only status is not acceptable.
- Backgrounds stay white or near-white to preserve contrast in daylight.

## Typography

Typography uses **Plus Jakarta Sans** for UI text and **JetBrains Mono** for IDs and tracking-like data. Body text minimum is `15px` to improve readability on lower-quality screens and in sunlight.

- Headlines are clear and compact; monetary values should use `display` or `h1` weight.
- Long labels should be rewritten for brevity (prefer 2-3 words).
- All caps are reserved for tiny badges and overline labels.

## Layout & Spacing

This is a strict mobile-first system. Layouts are single-column on phone screens, with progressive enhancement at larger breakpoints.

- Max content width is `480px` on mobile and `960px` on desktop.
- Horizontal margins are `16px` on mobile and `24px` on tablet+.
- The spacing system follows a `4px` base scale.
- Primary actions are often sticky near the bottom to optimize thumb reach.

## Elevation & Depth

Depth is intentionally minimal. Hierarchy is communicated primarily through borders and tonal separation, with shadows used sparingly.

- Resting cards typically use borders with no shadow.
- Bottom sheets and anchored bottom navigation use upward-biased shadows.
- Overlays remain light enough to preserve context behind mobile sheets.

## Shapes

The shape language is rounded and practical to support touch-heavy interaction patterns.

- Inputs and buttons use medium rounding.
- Cards use larger rounding for grouping and scanability.
- Pills and badges use full rounding only when semantically appropriate.

## Components

### Buttons

Primary, secondary, accent, and WhatsApp CTA variants all maintain a minimum `48px` height and mobile-first full-width behavior. Primary actions use brand blue, promotional actions use accent yellow with dark text, and WhatsApp actions use the dedicated green token.

### Inputs

Inputs use high-contrast borders, visible labels, and clear error treatment. Numeric-heavy fields should use numeric keyboard input modes, while validation appears on blur with human-readable messages.

### Cards and Status

Order and metric cards use surface backgrounds, border-led hierarchy, and concise metadata structure. Status badges use tiny uppercase text with explicit labels and semantic backgrounds.

### Mobile Surfaces and Navigation

Bottom sheets replace modal dialogs on phones and use sticky action placement. Bottom tab navigation supports up to five labeled items with clear active/inactive contrast.

## Do's and Don'ts

### Do

- Do design for thumb reach with key actions in the lower screen region.
- Do keep all tap targets at least `48px`.
- Do confirm important actions (save, send, pay) with reassuring feedback.
- Do format currency and dates in locale-aware forms.
- Do support poor connectivity with retry and offline-aware states.

### Don't

- Don't assume stable internet or high-end devices.
- Don't rely on hover-only interactions or hidden swipe-only actions.
- Don't use pagination-heavy mobile patterns for long operational lists.
- Don't use modal-first patterns on mobile where bottom sheets are expected.
- Don't depend on subtle color differences for critical state communication.
