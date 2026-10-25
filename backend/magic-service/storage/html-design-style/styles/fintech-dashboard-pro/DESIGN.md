---
version: alpha
name: Meridian Capital Portfolio
colors:
  background: "#0b0c0f"
  surface: "#101318"
  panel: "#161920"
  panel-hover: "#1b1f28"
  border: "#1f2330"
  border-subtle: "#272d3c"
  text-muted: "#424858"
  text-dim: "#5e6677"
  text-sub: "#8891a0"
  text-primary: "#c8cdd6"
  text-bright: "#edf0f4"
  primary: "#3d82ff"
  success: "#20c05c"
  error: "#f04040"
  warning: "#f0a020"
typography:
  metric-value:
    fontFamily: IBM Plex Mono
    fontSize: 15px
    fontWeight: 600
  metric-sub:
    fontFamily: IBM Plex Mono
    fontSize: 13px
    fontWeight: 600
  body-base:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: 400
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 11px
    fontWeight: 400
  label-base:
    fontFamily: IBM Plex Sans
    fontSize: 10px
    fontWeight: 400
  label-sm:
    fontFamily: IBM Plex Sans
    fontSize: 9px
    fontWeight: 500
  mono-base:
    fontFamily: IBM Plex Mono
    fontSize: 11px
    fontWeight: 600
  mono-sm:
    fontFamily: IBM Plex Mono
    fontSize: 9px
    fontWeight: 500
rounded:
  sm: 2px
  md: 3px
spacing:
  xs: 4px
  sm: 6px
  md: 10px
  lg: 14px
components:
  button-xs:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: 8px
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
---

## Brand & Style

The Meridian Capital Portfolio dashboard is designed for high-density financial data. It leverages a dark, terminal-inspired aesthetic to minimize eye strain during long trading sessions. The interface relies heavily on deep, cool tones and stark, high-contrast semantic colors to immediately surface critical changes in portfolio performance. The overall feel is highly technical, precise, and utilitarian, echoing the efficiency of a Bloomberg terminal but modernized for the web.

## Colors

The color palette is strictly functional, optimizing for legibility against near-black backgrounds.

- **Backgrounds:** Deep charcoal (`#0b0c0f`) and almost-black surfaces (`#101318`) create infinite depth without harshness. Panels sit just slightly lighter at `#161920`.
- **Borders:** Very subtle slate (`#1f2330` and `#272d3c`) separates data without introducing visual clutter.
- **Text:** A hierarchy of grays and off-whites (`#424858` to `#edf0f4`) establish reading order, with only the most crucial data appearing in pure bright white/off-white.
- **Semantic:** Standard financial traffic-light colors: Vivid Blue for primary actions/links, Green (`#20c05c`) for positive P&L/buys, Red (`#f04040`) for negative P&L/sells, and Amber (`#f0a020`) for warnings or pending statuses.

## Typography

The typographic system is built entirely on the **IBM Plex** superfamily, blending its grotesque and monospaced variants for optimal data display.

- **Narrative/UI Elements:** Set in **IBM Plex Sans** to provide clear, readable labels, navigation items, and descriptions. Sizes are kept extremely small (9px - 12px) to maximize data density.
- **Tabular Data & Metrics:** Set in **IBM Plex Mono**. Monospaced digits are critical for vertical alignment in tables, order books, and risk grids. The rigid, engineered structure of the mono font reinforces the application's technical nature.
- **Hierarchy:** Size differences are minimal; hierarchy is established through font weight (Regular vs Semi-Bold), color contrast (muted vs bright), and capitalization (uppercase for table headers and labels).

## Layout & Spacing

The layout is characterized by an ultra-dense, grid-based structure designed to fit as much actionable data on a single screen as possible.

- **Compactness:** A 12px base padding and micro-margins (3px - 10px) eliminate unnecessary white space.
- **Structure:** A fixed top bar and sidebar provide consistent navigation, while the main content area utilizes strict CSS grids (`grid-2`, `grid-3`) to align panels perfectly.
- **Containment:** Data is housed in clearly defined panels with 1px borders, providing a structured, compartmentalized view of different portfolio aspects.

## Elevation & Depth

Depth is virtually non-existent in the traditional sense (no heavy drop shadows).

- **Flat Aesthetic:** The UI is inherently flat, relying on 1px borders and subtle background color shifts (e.g., from `#101318` to `#161920`) to differentiate overlapping elements or interactive states.
- **Highlights:** Occasional glow effects or semi-transparent background tints (`rgba` variations of semantic colors) are used to highlight rows or active buttons without lifting them off the canvas.

## Shapes

Shapes are uncompromisingly sharp and boxy.

- **Micro-Radii:** A global border radius of just `3px` (`--r`) softens the absolute edges of buttons and panels slightly, preventing them from feeling completely harsh while maintaining a highly engineered, grid-aligned look. Badges use an even smaller `2px` radius.

## Components

### Buttons
Action buttons (`btn-xs`) are incredibly compact, acting more like selectable tabs. They have a subtle border and background, turning to a primary accent color on hover or active states.

### Badges & Tags
Status indicators and P&L deltas use pill-shaped badges with highly saturated text colors on top of low-opacity backgrounds (e.g., green text on a 8% opacity green background). This draws the eye immediately without overwhelming the interface.

### Tables
Tables are the core component. They feature sticky headers (uppercase, mono, 9px), monospaced numeric columns right-aligned for easy scanning, and subtle hover states on rows. Row borders are extremely faint to maintain a clean look.

## Do's and Don'ts

- Do use monospaced fonts for any numeric data that needs to be compared vertically.
- Don't use large font sizes or generous padding; prioritize data density above all else.
- Do rely on color (green/red) to convey status instantly without requiring the user to read the text.
- Don't use heavy shadows or gradients; keep the interface flat and bordered.
