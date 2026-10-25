---
# Design Tokens
colors:
  brand:
    primary: "#080331"
    secondary: "#f2f6ff"
  accent:
    blue: "#1267dd"
    blue-light: "#eff4fb"
    green: "#07a49a"
    green-light: "#ecf7f7"
    purple: "#7327f0"
    purple-light: "#f6f2fd"
  neutral:
    white: "#ffffff"
    light-white: "#f7f7f7"
    black: "#000000"
    element-black: "#1a1a1a"
    light-black: "#0f0f0f"
    neutral-black: "#080808"
    gray-base: "#666666"
    gray-light: "#999999"
  border:
    light: "#e5e5e5"
    regular: "#d9d9d9"
    dark: "#333333"

typography:
  family:
    main: "'Season Sans', Arial, sans-serif"
  size:
    h1: "3.5rem"
    h2: "3rem"
    h3: "2.5rem"
    h4: "2rem"
    h5: "1.625rem"
    h6: "1.5rem"
    large: "1.25rem"
    medium: "1.125rem"
    regular: "1rem"
    small: "0.875rem"
    tiny: "0.75rem"
  weight:
    regular: 400
    medium: 500
    bold: 700

spacing:
  xsmall: "0.75rem"
  small: "1.25rem"
  medium: "1.5rem"
  large: "2.5rem"
  xlarge: "3.5rem"
  xxlarge: "4.5rem"
  huge: "5rem"
  xhuge: "6rem"
  xxhuge: "7.5rem"

radii:
  small: "0.25rem"
  large: "0.75rem"
  medium: "1rem"
  full: "100vw"

borders:
  width: "0.06rem"

elevation:
  soft: "0 24px 40px rgba(0, 0, 0, 0.04)"
  deep: "0 40px 80px rgba(0, 0, 0, 0.08)"
  button: "0 1px 3px rgba(0, 0, 0, 0.15), 0 5px 5px rgba(0, 0, 0, 0.12), 0 12px 7px rgba(0, 0, 0, 0.08)"

motion:
  standard: "300ms ease"
  fast: "150ms ease"

---

# Hyperline Design System

## Overview
Hyperline's visual identity is rooted in clarity, professionalism, and modern SaaS aesthetics. The design system prioritizes high contrast, generous whitespace, and a sophisticated color palette to communicate trust and efficiency in revenue management.

## Visual Identity
The brand balances a deep, authoritative navy (`primary`) with a soft, airy lavender (`secondary`). This pairing creates a professional yet accessible atmosphere. Vibrant accents in blue, green, and purple are used sparingly to guide attention and highlight key features or data points.

### Typography
"Season Sans" is the cornerstone of the typographic system, providing a clean and geometric look that ensures readability across all screen sizes. The type hierarchy is pronounced, with large, bold headings that establish a clear information architecture.

### Layout & Spacing
The layout follows a modular grid with significant breathing room. Spacing tokens are used consistently to create rhythm and separate distinct content areas. Section paddings are particularly generous, reinforcing the premium and uncluttered feel of the product.

### Components & Elements
- **Borders & Radii**: Elements use thin, subtle borders and a range of rounded corners. Small radii are used for compact components, while medium and large radii are applied to cards and larger containers to create a soft, modern appearance.
- **Contrast Sections**: The design frequently uses alternating light and dark sections to break up long pages and maintain engagement. Dark sections typically use `element-black` or `primary` backgrounds with white text.
- **Interactions**: Subtle hover states and smooth transitions (via Swiper and other scripts) provide a polished, "alive" user experience.
