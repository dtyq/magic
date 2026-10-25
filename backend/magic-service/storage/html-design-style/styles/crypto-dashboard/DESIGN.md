---
name: Nexus Crypto Terminal
colors:
  primary: "#00ffb3"
  primary-dim: "#003324"
  background: "#080b10"
  surface: "#0d1117"
  surface-variant: "#111820"
  surface-hover: "#162030"
  border: "#1d222b"
  border-active: "#00cc8f"
  up: "#00e676"
  up-dim: "#002d17"
  down: "#ff3d57"
  down-dim: "#330c11"
  text-primary: "#e8edf5"
  text-secondary: "#7a8a9e"
  text-tertiary: "#3d4f62"
  yellow: "#f7c94b"
  blue: "#4da6ff"
typography:
  display-lg:
    fontFamily: Space Mono
    fontSize: 26px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Syne
    fontSize: 18px
    fontWeight: 800
    lineHeight: 1.4
  body-md:
    fontFamily: Syne
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.4
  body-sm:
    fontFamily: Syne
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
  label-lg:
    fontFamily: Syne
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0.06em
  label-md:
    fontFamily: Syne
    fontSize: 14px
    fontWeight: 800
    lineHeight: 1.4
    letterSpacing: 0.08em
  mono-body:
    fontFamily: Space Mono
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.4
  mono-sm:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  mono-label:
    fontFamily: Space Mono
    fontSize: 10px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: 0.1em
  mono-caption:
    fontFamily: Space Mono
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: 0.05em
rounded:
  sm: 3px
  md: 4px
  full: 9999px
spacing:
  xs: 4px
  sm: 6px
  md: 10px
  lg: 12px
  xl: 14px
  xxl: 16px
  xxxl: 20px
  xxxxl: 24px
components:
  logo:
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
  nav-button:
    textColor: "{colors.text-secondary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
  nav-button-active:
    textColor: "{colors.primary}"
    backgroundColor: "{colors.primary-dim}"
    rounded: "{rounded.md}"
  panel:
    backgroundColor: "{colors.surface}"
  panel-border:
    backgroundColor: "{colors.border}"
  panel-header:
    backgroundColor: "{colors.surface-variant}"
  panel-title:
    textColor: "{colors.text-secondary}"
    typography: "{typography.mono-caption}"
  stat-label:
    textColor: "{colors.text-tertiary}"
    typography: "{typography.mono-label}"
  stat-value:
    textColor: "{colors.text-primary}"
    typography: "{typography.mono-body}"
  price-change-up:
    textColor: "{colors.up}"
    backgroundColor: "{colors.up-dim}"
    typography: "{typography.mono-sm}"
    rounded: "{rounded.sm}"
  price-change-down:
    textColor: "{colors.down}"
    backgroundColor: "{colors.down-dim}"
    typography: "{typography.mono-sm}"
    rounded: "{rounded.sm}"
  chart-button:
    textColor: "{colors.text-tertiary}"
    typography: "{typography.mono-caption}"
    rounded: "{rounded.sm}"
  chart-button-active:
    textColor: "{colors.primary}"
    backgroundColor: "{colors.primary-dim}"
    rounded: "{rounded.sm}"
  input-field:
    textColor: "{colors.text-primary}"
    backgroundColor: "{colors.background}"
    typography: "{typography.mono-body}"
    rounded: "{rounded.md}"
  input-field-focus:
    backgroundColor: "{colors.border-active}"
  pct-button:
    textColor: "{colors.text-secondary}"
    backgroundColor: "{colors.background}"
    typography: "{typography.mono-caption}"
    rounded: "{rounded.sm}"
  btn-execute-buy:
    textColor: "#060e07"
    backgroundColor: "{colors.up}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
  btn-execute-sell:
    textColor: "#150306"
    backgroundColor: "{colors.down}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
  divider:
    backgroundColor: "{colors.border}"
  coin-icon-btc:
    textColor: "{colors.yellow}"
  coin-icon-eth:
    textColor: "{colors.blue}"
  market-row-hover:
    backgroundColor: "{colors.surface-hover}"
---

## Overview

NEXUS is a high-density, real-time cryptocurrency trading terminal designed for professional traders. The brand personality is engineered, cyber-clinical, and hyper-focused, emphasizing maximum information density, data visibility, and rapid interaction.

The design relies on a dark, technical void background with low-opacity panel frames, neon green accents, and color-coded semantic signals for market directions (green for upward trends, coral-red for downward movements). It projects an aesthetic of surgical precision and terminal-like efficiency, evoking the feeling of a futuristic trading command center.

## Colors

The color palette is built around deep dark void tones, neon highlights, and high-visibility data indicators.

- **Primary (#00ffb3):** A vivid neon green/cyan that highlights active navigation, interactive buttons, selected fields, and crucial interface markers.
- **Primary Dim (#003324):** A low-opacity dark green tone used for backgrounds of active states and controls.
- **Background Void (#080b10):** The primary backdrop, providing absolute separation and contrast for bright data indicators.
- **Surface (#0d1117):** Used for standard panel blocks, establishing the layout structure.
- **Surface Variant (#111820):** Used for elevated elements, headers, and container cells.
- **Surface Hover (#162030):** Background shade for hovered lists, rows, or interactive cells.
- **Border (#1d222b):** Dark gray structural outline color for grid dividing lines and container frames.
- **Border Active (#00cc8f):** Active cyan border color highlighting focused fields.
- **Up (#00e676):** A bright green representing positive market moves, buy actions, and positive percentage gains.
- **Up Dim (#002d17):** Background tone for positive price changes or buy signals.
- **Down (#ff3d57):** A sharp coral-red representing negative market moves, sell actions, and price drops.
- **Down Dim (#330c11):** Background tone for negative price changes or sell signals.
- **Text Primary (#e8edf5):** High-contrast off-white for main values, prices, and essential text.
- **Text Secondary (#7a8a9e):** Mid-tone slate for standard information, labels, and helper text.
- **Text Tertiary (#3d4f62):** Low-contrast steel gray for inactive labels, captions, and structural guidelines.
- **Yellow (#f7c94b):** Special highlight color for Bitcoin and indices.
- **Blue (#4da6ff):** Special highlight color for Ethereum and technical networks.

## Typography

NEXUS uses two distinct font families to balance branding personality with technical legibility:

- **Syne:** Used for structural, non-technical branding elements, navigation buttons, and headings. Its bold, wide geometric curves lend a modern, professional, and slightly futuristic edge to the terminal layout.
- **Space Mono:** Used for all quantitative data, timestamps, prices, statistics, order book items, and input text. The monospaced alignment ensures that numeric digits line up perfectly in tables, maintaining readability during rapid real-time updates.

## Layout & Spacing

The terminal layout uses a high-density grid system that splits the screen into multiple functional panes without wasted space.

- **Grid Layout:** A three-column grid divides the main interface: a flexible main chart column (`1fr`), a middle column for order book and trade history (`300px`), and a right-hand column for market listing and transaction inputs (`280px`).
- **Separation:** Panels are separated by a 1px border gap, allowing the background void to show through as thin grid lines.
- **Margins & Padding:** Outer margins are kept to a minimum (0px to 30px footer tape) to maximize screen real estate, while inner panel paddings range from `10px` to `16px` to keep elements tightly grouped yet legible.

## Elevation & Depth

Visual depth is achieved through flat, high-contrast borders and subtle background variations rather than drop shadows.

- **Flat Layering:** Elements do not use traditional box shadows, as depth is indicated by the transition from void background to panel surface color.
- **Borders:** Panels use a thin, 1px semi-transparent white border (`rgba(255, 255, 255, 0.06)` or `#1d222b`) to structure the space.
- **Interactive State Borders:** Focused text fields and active buttons highlight themselves using a bright border glow (`#00cc8f`) to focus attention.

## Shapes

The shapes in NEXUS are sharp and structural, matching the terminal aesthetic:

- **Rounded Corners:** A minimal `4px` or `3px` corner radius is used on inputs, buttons, and badges to soften the interface slightly while preserving the rigid, technical framework.
- **Circles:** Circular shapes are reserved for status markers, coin badges, and pulse animation dots.

## Components

### Buttons
Navigation and control buttons use transparent backgrounds and borders. Active selections and hover states are filled with a dim accent backdrop and glowing text. Action buttons (BUY/SELL) are solid, high-contrast blocks (green for BUY, red for SELL) with dark text to ensure immediate visibility.

### Input Fields
Inputs are styled with the dark background void, a subtle border, and monospaced typography, shifting to a glowing green border upon focus.

### Order Book & Trades
Order book items use horizontal progress indicators where low-opacity green and red fills reflect bid and ask depth. Monospaced typography ensures absolute alignment.

## Do's and Don'ts

- Do use monospaced fonts for all numbers and calculations to ensure alignment.
- Do keep panels and components tightly packed to prioritize information density.
- Don't use traditional blurred drop shadows, as they conflict with the flat cyber-terminal aesthetic.
- Don't mix font families within a single line or data cell; keep branding fonts separated from data presentation fonts.
