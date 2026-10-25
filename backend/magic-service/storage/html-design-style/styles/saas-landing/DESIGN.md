---
version: alpha
name: Forma
description: A SaaS landing page design system with a clean, professional, and slightly technical aesthetic.
colors:
  primary: "#2d6a4f"
  primary-hover: "#245f47"
  primary-light: "#e5f1eb"
  primary-mid: "#c4dece"
  primary-text: "#163d2c"
  bg: "#f8f7f5"
  surface: "#ffffff"
  border: "#e4e1db"
  border-subtle: "#edeae4"
  border-strong: "#d2cfc8"
  text-primary: "#18170f"
  text-secondary: "#64625c"
  text-tertiary: "#9c9a96"
typography:
  h1:
    fontFamily: "DM Sans"
    fontSize: 4.62rem
    fontWeight: 300
    lineHeight: 1.07
  h2:
    fontFamily: "DM Sans"
    fontSize: 2.75rem
    fontWeight: 300
    lineHeight: 1.1
  body-lg:
    fontFamily: "DM Sans"
    fontSize: 18.5px
    fontWeight: 300
    lineHeight: 1.7
    letterSpacing: -0.01em
  body-md:
    fontFamily: "DM Sans"
    fontSize: 17.5px
    fontWeight: 400
    lineHeight: 1.6
  label-md:
    fontFamily: "DM Mono"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0.01em
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  xl: 14px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: 8px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
---

# Overview

Forma is a SaaS landing page design system designed to feel clean, professional, and slightly technical. It leverages a soft off-white background with crisp white surface cards to create a subtle hierarchy, while a deep, refined green serves as the primary accent color. The aesthetic balances approachability with engineered precision, using rounded borders alongside monospaced labels and geometric details.

## Colors

The color palette is rooted in soft, low-contrast neutrals and a single, strong accent color.

- **Primary:** A deep, rich green (#2d6a4f) used for primary actions, checkmarks, and key highlights. It is accompanied by lighter tints for backgrounds and borders of badges or tags.
- **Backgrounds:** A warm off-white (#f8f7f5) serves as the base layer, creating a softer reading experience than pure white. Pure white (#ffffff) is reserved for elevated surface cards.
- **Text:** High-contrast, but not pure black. Primary text uses a deep charcoal (#18170f) for readability, while secondary and tertiary text step down into lighter grays to establish hierarchy.
- **Borders:** Subtle gray borders (#e4e1db, #edeae4) are used extensively to define structure and contain elements without adding visual noise.

## Typography

The typography strategy leverages two contrasting typefaces: a clean, geometric sans-serif for reading and a monospace font for technical details.

- **Headlines & Body:** Set in **DM Sans** to provide a clean, modern, and highly legible reading experience. Headlines use a lighter font weight (300) at larger sizes to feel refined and elegant.
- **Labels & Badges:** **DM Mono** is used for structural labels, badges, and small technical text. Its fixed-width characters introduce an engineered, precise feel that contrasts nicely with the approachable sans-serif.

## Layout

The layout uses a centered, max-width container approach with generous padding. Elements are grouped using containment principles, housing content within bordered cards or clear horizontal sections. The spacing strategy relies on comfortable margins to let the content breathe.

## Elevation & Depth

Elevation is primarily achieved through subtle shadows and border definitions.

- **Flat Design Base:** Most of the interface relies on borders and background color changes (e.g., #f8f7f5 vs #ffffff) rather than shadows.
- **Subtle Shadows:** When shadows are used (e.g., on application frames or primary buttons), they are soft and diffused, creating a realistic but understated sense of depth. Buttons also feature a subtle colored glow (e.g., a green-tinted shadow for the primary button).

## Shapes

Shapes balance softness and structure.

- **Interactive Elements:** Buttons and small tags use moderate rounding (6px - 8px) to feel clickable and friendly.
- **Containers:** Larger cards and application frames use a more pronounced border radius (12px - 14px) to contain content elegantly.
- **Pills/Badges:** Small status badges often use fully rounded borders to stand out from rectangular structural elements.

## Components

- **Buttons:** Primary buttons are solid green with a subtle colored shadow. Ghost buttons are transparent with a delicate border, gaining a slightly stronger border and a soft shadow on hover.
- **Cards/Frames:** Used to house application UI previews or features. They always have a pure white background and a subtle 1px border to separate them from the off-white page background.
- **Badges:** Small, pill-shaped or slightly rounded rectangles used for tags or sprint labels. They often combine a light background tint with a darker text color of the same hue (e.g., light green background with dark green text).

## Do's and Don'ts

- **Do** use the primary green sparingly to draw attention to the most important actions.
- **Don't** use pure black for text; stick to the defined charcoal/gray scale to maintain a softer contrast.
- **Do** use the monospace font for small labels, eyebrows, and technical metadata.
- **Don't** mix heavy drop shadows with the subtle border-based elevation system. Keep depth effects light and diffused.
