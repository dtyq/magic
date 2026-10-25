---
name: Focus Utility
colors:
  primary: "#151412"
  secondary: "#68655F"
  tertiary: "#A39F98"
  bg: "#F5F4F0"
  bg-deep: "#ECEAE3"
  surface: "#FFFFFF"
  border: "#EAE8E2"
  border-mid: "#DFDDD7"
  border-strong: "#CFCDC7"
  text-ghost: "#C5C1BA"
  accent: "#2750D6"
  accent-hover: "#3460E8"
  accent-light: "#EBF0FD"
  accent-text: "#1A38A0"
  green: "#137E44"
  green-light: "#E3F4EC"
  green-text: "#0C5430"
  amber: "#905300"
  amber-light: "#FDF0DC"
  red: "#BA2B2B"
  red-light: "#FAEBEB"
  red-text: "#861E1E"
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 38px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: -1.4px
  headline-lg:
    fontFamily: Inter
    fontSize: 31px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -1.1px
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.3px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: -0.2px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  label-md:
    fontFamily: Inter
    fontSize: 12.5px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: -0.1px
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.85px
  code-lg:
    fontFamily: JetBrains Mono
    fontSize: 21px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: -0.4px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: -0.1px
rounded:
  sm: 7px
  md: 14px
  lg: 20px
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 14px
  lg: 24px
  xl: 32px
components:
  app-background:
    backgroundColor: "{colors.bg}"
  avatar:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
  header-greeting:
    textColor: "{colors.tertiary}"
    typography: "{typography.body-sm}"
  search-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: 11px
    height: 41px
    padding: 12px
  search-input-placeholder:
    textColor: "{colors.text-ghost}"
  search-icon-focus:
    textColor: "{colors.accent}"
  button-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.full}"
    height: 31px
    padding: 12px
  button-chip-hover:
    textColor: "{colors.primary}"
  button-chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
  progress-card:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 20px
  stat-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: 12px
  stat-icon-active:
    backgroundColor: "{colors.accent-light}"
    textColor: "{colors.accent-text}"
  stat-icon-urgent:
    backgroundColor: "{colors.red-light}"
    textColor: "{colors.red-text}"
  stat-icon-done:
    backgroundColor: "{colors.green-light}"
    textColor: "{colors.green-text}"
  divider:
    backgroundColor: "{colors.border}"
    height: 1px
  divider-mid:
    backgroundColor: "{colors.border-mid}"
    height: 1px
  checkbox-checked:
    backgroundColor: "{colors.green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
  task-item:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: 12px
  task-tag-work:
    backgroundColor: "{colors.accent-light}"
    textColor: "{colors.accent-text}"
  task-tag-personal:
    backgroundColor: "{colors.green-light}"
    textColor: "{colors.green-text}"
  task-tag-urgent:
    backgroundColor: "{colors.red-light}"
    textColor: "{colors.red-text}"
  task-tag-medium-priority:
    backgroundColor: "{colors.amber-light}"
    textColor: "{colors.amber}"
  task-tag-later:
    backgroundColor: "{colors.bg-deep}"
    textColor: "{colors.secondary}"
  task-due-overdue:
    textColor: "{colors.red}"
  input-field:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.primary}"
    rounded: 11px
    height: 46px
    padding: 14px
  input-field-focus:
    backgroundColor: "{colors.surface}"
  tag-btn-work:
    backgroundColor: "{colors.accent-light}"
    textColor: "{colors.accent-text}"
  tag-btn-personal:
    backgroundColor: "{colors.green-light}"
    textColor: "{colors.green-text}"
  tag-btn-urgent:
    backgroundColor: "{colors.red-light}"
    textColor: "{colors.red-text}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: 13px
    height: 49px
  button-primary-hover:
    backgroundColor: "#272420"
  fab:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.full}"
    size: 50px
  fab-hover:
    backgroundColor: "{colors.accent-hover}"
  bottom-nav:
    backgroundColor: "{colors.bg}"
    height: 88px
  bottom-nav-item-active:
    backgroundColor: "{colors.accent-light}"
    textColor: "{colors.accent}"
  panel-handle:
    backgroundColor: "{colors.border-strong}"
    height: 3px
    width: 30px
    rounded: "{rounded.full}"
---

# Focus Utility

Focus is a modern, high-contrast, distraction-free task management interface. The design system is built to convey extreme clarity, precision, and focus through a refined warm neutral canvas, stark black components, and single-point interactive accents.

## Brand & Style

The visual identity of Focus leans heavily into utility-first simplicity with a premium editorial feel. Its brand personality is calm, structured, and intentional. 

By employing a warm alabaster background instead of a pure, clinical white, the interface feels organic and easy on the eyes for extended productivity sessions. Stark primary buttons and progress containers introduce high visual contrast, instantly signaling the main user focus. The single blue accent color is used sparingly to drive interactive focus and highlights.

## Colors

The color palette is built around three core layers: a soft alabaster background, crisp white surface cards, and deep ink typography/primary interactive components.

- **Primary Canvas:** Warm Alabaster (#F5F4F0) acts as the main viewport background, paired with Deep Alabaster (#ECEAE3) for sub-sections and secondary layers.
- **Surfaces:** Pure White (#FFFFFF) is used for cards, inputs, and chips to pop off the warm background.
- **Typography & Ink:** Deep Charcoal/Ink (#151412) is the primary text color and the fill color for primary buttons and high-contrast containers.
- **Accents:** Focus Blue (#2750D6) serves as the primary interactive driver, highlighting active navigation, status counts, badges, and primary interactive links.
- **Feedback & Tags:** Semantic categories utilize highly legible pastels paired with corresponding dark text:
  - Work: Blue-light background (#EBF0FD) with Indigo text (#1A38A0)
  - Personal: Green-light background (#E3F4EC) with Forest-green text (#0C5430)
  - Urgent/Error: Red-light background (#FAEBEB) with Deep-red text (#861E1E)

## Typography

Focus uses a dual-font strategy to balance clean readability with technical precision.

- **Primary UI & Copy:** **Inter** is the core typeface, establishing an elegant, readable, and highly legible visual hierarchy. Title elements use semi-bold weights with negative letter-spacing for a modern, compact editorial feel.
- **Technical & Utility Data:** **JetBrains Mono** is used for dates, time, task counts, percentages, and metrics. Its monospaced structure adds a sense of precision, alignment, and analytical tool-like clarity to the app's metadata.

## Layout & Spacing

Focus follows a mobile-first, single-column vertical layout designed for quick scanning and micro-interactions.

- **Rhythm:** Governed by an 8px grid system, ensuring consistent spacing between layout containers and interactive items.
- **Padding:** Outer sections use a generous 24px margin to preserve whitespace and breathing room inside the viewport frame.
- **Gaps:** List items and card groups maintain a tight 7px or 8px vertical rhythm to keep elements closely associated and scannable.

## Elevation & Depth

The design system prefers flat tonal layers over heavy elevation, creating depth through containment and subtle borders.

- **Containment:** Content sits on White (#FFFFFF) cards layered on top of the Alabaster background.
- **Borders:** Thin, translucent borders separate interactive boundaries. These are simulated with soft grays (#EAE8E2, #DFDDD7, #CFCDC7) mapping to 7%, 10%, and 15% black opacities.
- **Shadows:** Very soft ambient drop shadows are applied to cards to lift them slightly, while the FAB (Floating Action Button) uses a specialized glowing accent shadow (`0 4px 20px rgba(39, 80, 214, 0.34)`) to stand out as the primary screen action.

## Shapes

Shapes are structural and crisp, using medium and small rounded corners to maintain a friendly yet clean aesthetic.

- **Containers:** Task items, statistics cards, and general containers use a `14px` border radius (rounded.md).
- **Hero Containers:** The main progress dashboard uses a softer `20px` border radius (rounded.lg).
- **Interactive Elements:** Buttons use a `13px` radius, while search inputs and input fields use a `11px` radius.
- **Pills & Chips:** Filter chips, avatars, and the FAB use fully rounded pill shapes (rounded.full).

## Components

### Action & Input Elements

Primary actions like the FAB utilize the accent blue background to stand out. Main form buttons use the deep primary ink background (#151412) to frame action confirmation. Input fields use a subtle alabaster background with inset boundaries, shifting to white with a thin blue outline when focused.

### Filter Chips

Chips act as toggle buttons. Inactive chips feature a white background with a thin gray border, while the active chip shifts to a solid ink background with white text, providing clear feedback on the active view state.

### Task Items

Task containers use a white background with a thin, light gray border. They display priority visual indicators using a thin vertical color stripe (red for high, amber for medium) on the left edge.

## Do's and Don'ts

- Do use JetBrains Mono for all numeric indicators, metrics, timestamps, and dates.
- Do restrict the use of the Accent Blue (#2750D6) color to interactive icons, active navigation tabs, badge indicators, and the FAB.
- Don't use heavy or high-opacity dark shadows for cards; keep depth indicators subtle and translucent.
- Don't mix sharp corners with rounded corners; maintain the established scale of rounded values (7px, 11px, 13px, 14px, 20px, and full).
