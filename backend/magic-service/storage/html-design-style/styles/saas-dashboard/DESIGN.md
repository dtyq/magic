---
version: alpha
name: Meridian Dashboard
colors:
  background: "#f4f4f2"
  surface: "#ffffff"
  surface-subtle: "#f9f9f7"
  border: "#e5e5e1"
  border-soft: "#ededea"
  border-focus: "#2460e0"
  text-primary: "#181816"
  text-secondary: "#64645e"
  text-tertiary: "#a0a09a"
  text-disabled: "#c5c5bf"
  primary: "#2460e0"
  primary-hover: "#1e52c2"
  primary-light: "#edf1fe"
  primary-dim: "#c7d6fc"
  green: "#166534"
  green-bg: "#f0fdf4"
  green-border: "#bbf7d0"
  red: "#b91c1c"
  red-bg: "#fef2f2"
  amber: "#9a3412"
  amber-bg: "#fffbeb"
  amber-border: "#fde68a"
typography:
  body:
    fontFamily: DM Sans
    fontSize: 15.5px
    fontWeight: 400
    lineHeight: 1.5
  page-title:
    fontFamily: DM Sans
    fontSize: 20.5px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.45px
  page-sub:
    fontFamily: DM Sans
    fontSize: 14.5px
    fontWeight: 400
  card-title:
    fontFamily: DM Sans
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.2px
  metric-value:
    fontFamily: DM Mono
    fontSize: 26.5px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: -0.5px
rounded:
  xs: 4px
  sm: 8px
  md: 12px
spacing:
  nav-width: 228px
  top-height: 60px
components:
  btn-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
  btn-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
  btn-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
  btn-secondary-hover:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
  card-subtle:
    backgroundColor: "{colors.surface-subtle}"
    rounded: "{rounded.md}"
  card-description:
    textColor: "{colors.text-tertiary}"
  metric-icon-blue:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary}"
  metric-icon-green:
    backgroundColor: "{colors.green-bg}"
    textColor: "{colors.green}"
  metric-icon-green-border:
    backgroundColor: "{colors.green-border}"
  metric-icon-amber:
    backgroundColor: "{colors.amber-bg}"
    textColor: "{colors.amber}"
  metric-icon-amber-border:
    backgroundColor: "{colors.amber-border}"
  metric-change-up:
    backgroundColor: "{colors.green-bg}"
    textColor: "{colors.green}"
  metric-change-down:
    backgroundColor: "{colors.red-bg}"
    textColor: "{colors.red}"
  metric-period:
    textColor: "{colors.text-tertiary}"
  nav-section-label:
    textColor: "{colors.text-disabled}"
  nav-item:
    textColor: "{colors.text-secondary}"
  nav-item-hover:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-primary}"
  nav-item-active:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary}"
  search-input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
  search-input-focus:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
  divider:
    backgroundColor: "{colors.border}"
    height: 1px
  divider-subtle:
    backgroundColor: "{colors.border-soft}"
    height: 1px
  focus-indicator:
    backgroundColor: "{colors.border-focus}"
    size: 2px
  progress-bar-track:
    backgroundColor: "{colors.primary-dim}"
    height: 4px
  text-disabled:
    textColor: "{colors.text-disabled}"
---

# SaaS Dashboard — Modular (Card-Based)

## Brand & Style

The Meridian Dashboard design system embodies a clean, professional, and data-dense aesthetic optimized for modern SaaS products. The brand identity focuses on modularity, high efficiency, and clarity, allowing users to scan key metrics and process analytics with minimal cognitive noise. 

The visual style is characterized by a sleek, modern, and minimalist look. It relies on subtle depth, precise lines, and airy margins to organize information into distinct structural containers without relying on heavy gradients or high-contrast shadows. Interactions are lightweight and responsive, utilizing subtle hover states and fast, smooth transitions to create an interface that feels fast and alive.

## Colors

The color system is rooted in light neutrals, grayscale text hierarchy, and a single vibrant primary accent color for critical actions and active states. 

- **Backgrounds:** A soft off-white canvas (`#f4f4f2`) is paired with pure white (`#ffffff`) surfaces for modular components, creating clear separation of visual blocks.
- **Accents:** A solid, vibrant blue (`#2460e0`) serves as the single driving accent color for actions, highlights, and navigation focus indicators.
- **Grayscale UI Text:** High-contrast neutral text colors (`#181816` for primary copy and headings, `#64645e` for labels and secondary information, `#a0a09a` for tertiary descriptions) guarantee standard-compliant reading contrast.
- **Semantic Indicators:** Balanced tones of green (`#166534`), red (`#b91c1c`), and amber (`#9a3412`) are paired with light background tints (`#f0fdf4`, `#fef2f2`, `#fffbeb`) to convey positive, negative, and warning states respectively, while maintaining a minimum WCAG AA contrast ratio of 4.5:1.

## Typography

The typography system pairs a clean, geometric sans-serif typeface for main interface elements with a highly readable monospace typeface for technical metrics and numerical values.

- **General UI:** **DM Sans** is used throughout the application to ensure legible, professional, and contemporary reading. Bold and semi-bold weights establish a clear structural hierarchy (e.g., page and card headers).
- **Tabular Data:** **DM Mono** is strictly reserved for large numerical metrics. Its tabular figures maintain perfect vertical alignment when scanning columns of values.
- **Hierarchy:** High visual contrast is established by scaling text from large metrics down to compact, medium-contrast metadata labels.

## Layout & Spacing

The layout is built upon a highly structured, modular grid model designed to organize widgets, charts, and utility elements into beautiful card blocks.

- **Layout Structure:**
  - **Top Navigation Bar:** Houses the brand logo, a centered flat search input, and the user profile menu.
  - **Sidebar Navigation:** A persistent left panel hosting functional navigation items, labels, and micro badges.
  - **Main Dashboard Area:** A fluid multi-column workspace structured with overview metric cards, central chart/activity sections, and secondary update cards.
- **Spacing & Rhythm:** An 8px base grid guides margins and alignment. Modules and grids leverage medium, consistent spacing, and cards utilize uniform internal padding (18px-20px) to balance data density with elegant breathing room.

## Elevation & Depth

Visual depth is conveyed through subtle structural layers rather than heavy decorations.

- **The Layer Stack:**
  - **Level 1 (Canvas):** The soft off-white background.
  - **Level 2 (Containers):** Pure white cards with a 1px solid border (`#e5e5e1`) and a soft, diffused drop shadow (`0 1px 3px rgba(0,0,0,0.05)`) floating over the canvas.
  - **Level 3 (Interactions):** Active cards and input fields subtly scale or lift on hover, increasing border contrast and drop shadow spread to provide high-quality tactile feedback.

## Shapes

Shapes follow a professional, modern, and structured geometry.

- **Cards & Containers:** Main dashboard cards and secondary panels use a consistent `12px` corner radius (`rounded.md`), establishing soft but structured blocks.
- **Action & Control Elements:** Buttons, search fields, navigation highlights, and smaller control elements use a standard `8px` corner radius (`rounded.sm`) to ensure tactile clickability.
- **Micro Badges:** Status tags and metric change highlights use a small `4px` corner radius (`rounded.xs`) for precise border containment.

## Components

### Cards

Cards serve as the primary building blocks of the dashboard. Every card has a solid white background, a light border, and soft drop shadows. They feature consistent internal padding to keep tabular figures and titles visually aligned.

### Simple Charts

Visual placeholders (line sparklines and vertical bar grids) are designed as flat, minimal graphic blocks. They avoid heavy gradients or distracting legends, keeping focus on metric trends.

### Buttons

Buttons exist in primary (vibrant blue fill with white text) and secondary (white surface with a thin border and secondary gray text) variants. They utilize an active transform scale on click.

### Navigation Items

Sidebar elements utilize compact icons and labels with medium spacing. They implement smooth hover transitions (ease-in-out) and soft blue background pills for active states.

### Inputs & Top Navigation

The top search field uses a flat light gray fill that expands into a focused white input with a strong blue focus ring, facilitating immediate system search actions.

## Do's and Don'ts

- **Do** maintain a strict grid alignment across all overview and activity cards to preserve modular layout structure.
- **Do** use the monospace font (`DM Mono`) exclusively for metric values and numerical figures.
- **Do** ensure all semantic status badges maintain a minimum 4.5:1 contrast ratio against their colored backgrounds.
- **Do** keep card padding consistent at 18px-20px to ensure the layout remains visually balanced.
- **Don't** create cluttered dashboard layouts; use white space and gutters to separate modules.
- **Don't** overuse the primary blue accent; reserve it for main actions, active states, and focus indicators.
- **Don't** use heavy, dark, high-contrast shadows or deep color gradients behind cards.
- **Don't** mix different corner radiuses on similar containers, ensuring all main cards maintain the consistent 12px rounding.
