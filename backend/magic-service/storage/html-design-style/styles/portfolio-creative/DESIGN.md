---
name: Portfolio Creative
colors:
  primary: "#0c0b09"
  on-primary: "#f4efe6"
  ink: "#0c0b09"
  ink-soft: "#1b1a16"
  cream: "#f4efe6"
  cream-dim: "#ece6da"
  warm: "#d9d2c4"
  accent-r: "#d4412a"
  accent-y: "#efc440"
  accent-b: "#2750d6"
  muted: "#7e7668"
  muted-lt: "#afa89a"
typography:
  display-xl:
    fontFamily: Instrument Serif
    fontSize: 8.5rem
    fontWeight: 400
    lineHeight: 0.91
    letterSpacing: -0.025em
  display-lg:
    fontFamily: Instrument Serif
    fontSize: 3.75rem
    fontWeight: 400
    lineHeight: 1.0
    letterSpacing: -0.015em
  display-md:
    fontFamily: Instrument Serif
    fontSize: 1.59rem
    fontWeight: 400
    lineHeight: 1.2
  display-sm:
    fontFamily: Instrument Serif
    fontSize: 3.16rem
    fontWeight: 400
    lineHeight: 1.0
  body-lg:
    fontFamily: Syne
    fontSize: 1.03rem
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: Syne
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  label-lg:
    fontFamily: Syne
    fontSize: 0.75rem
    fontWeight: 800
    letterSpacing: 0.3em
    textTransform: uppercase
  label-md:
    fontFamily: Syne
    fontSize: 0.75rem
    fontWeight: 600
    letterSpacing: 0.15em
    textTransform: uppercase
  label-sm:
    fontFamily: Syne
    fontSize: 0.72rem
    fontWeight: 700
    letterSpacing: 0.24em
    textTransform: uppercase
  label-xs:
    fontFamily: Syne
    fontSize: 0.68rem
    fontWeight: 700
    letterSpacing: 0.15em
    textTransform: uppercase
rounded:
  none: 0px
  xs: 1px
spacing:
  base: 8px
  container-padding-desktop: 3.5rem
  container-padding-mobile: 2rem
  section-margin-desktop: 9rem
  section-margin-mobile: 6.5rem
components:
  nav:
    textColor: "{colors.primary}"
    padding: 1.875rem 3.5rem
  nav-scrolled:
    backgroundColor: rgba(244, 239, 230, 0.86)
    textColor: "{colors.primary}"
    padding: 1.1rem 3.5rem
  nav-link:
    textColor: "{colors.muted}"
    typography: "{typography.label-xs}"
  nav-link-hover:
    textColor: "{colors.ink}"
  hero-sub:
    textColor: "{colors.muted}"
    typography: "{typography.body-lg}"
  cursor:
    backgroundColor: "{colors.accent-r}"
    size: 10px
  cursor-hover:
    backgroundColor: "{colors.accent-y}"
    size: 52px
  button-outline:
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.none}"
    padding: 0.85rem 1.65rem
  button-outline-hover:
    textColor: "{colors.cream}"
    backgroundColor: "{colors.ink}"
  button-fill:
    textColor: "{colors.on-primary}"
    backgroundColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.none}"
    padding: 1.05rem 2.25rem
  button-fill-hover:
    backgroundColor: "{colors.accent-r}"
  project-card:
    backgroundColor: "{colors.cream-dim}"
    textColor: "{colors.ink}"
  project-meta:
    textColor: "{colors.muted-lt}"
    typography: "{typography.label-sm}"
  project-pill:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.ink}"
    typography: "{typography.label-xs}"
  tag-r:
    textColor: "{colors.accent-r}"
    typography: "{typography.label-xs}"
  tag-b:
    textColor: "{colors.accent-b}"
    typography: "{typography.label-xs}"
  tag-y:
    backgroundColor: "{colors.accent-y}"
    textColor: "{colors.primary}"
    typography: "{typography.label-xs}"
  about-section:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.on-primary}"
  input-field:
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
  input-placeholder:
    textColor: "{colors.muted-lt}"
  field-label:
    textColor: "{colors.muted}"
    typography: "{typography.label-xs}"
  divider:
    backgroundColor: "{colors.warm}"
---

## Overview

Mara Voss's design portfolio features a sophisticated, modern, and highly creative aesthetic tailored for an art director and designer. The brand personality is bold, high-contrast, yet deeply tactile and organic, marrying the raw elegance of classical editorial design with clean, interactive digital elements. The user experience is enhanced by smooth transitions, subtle micro-animations (like a custom cursor that expands on hover), and dynamic layouts that give every content block enough negative space to stand out.

## Colors

The design system's palette balances high-contrast ink-like tones against warm, paper-inspired neutral backgrounds, highlighted by a triad of expressive accents.

- **Backgrounds:** The primary backdrop is a warm `cream` (#f4efe6), transitioning to a darker, deep charcoal `ink-soft` (#1b1a16) in the About section to create contrast. The `cream-dim` and `warm` tones provide soft boundaries and division.
- **Typography:** Text uses `ink` (#0c0b09) to provide optimal legibility. Neutral text in secondary contexts is softened using `muted` (#7e7668) or `muted-lt` (#afa89a) to establish visual hierarchy.
- **Accents:** A vibrant triad drives visual interest:
  - **Accent Red (#d4412a):** Used for primary buttons, highlights, hover effects, and the default custom cursor state.
  - **Accent Yellow (#efc440):** An energetic golden yellow used for floating image shadow accents, hovered state cursors, and select badges.
  - **Accent Blue (#2750d6):** A deep blue used for specific project tags and branding accents.

## Typography

The typography system creates high contrast by pairing an expressive, elegant serif with a structured, bold geometric sans-serif.

- **Primary Headings:** Set in `Instrument Serif`. Large headings use an extremely large, fluid scale (`display-xl` and `display-lg`) with light, italicized styling to deliver a strong editorial statement.
- **Body & Controls:** Set in `Syne`. Body text has a balanced weight and line height (`body-lg`, `body-md`) for high legibility, while buttons and navigation labels utilize uppercase, bold weights with generous letter-spacing to command structured utility.

## Layout & Spacing

The layout is built around asymmetric grids, large, immersive imagery, and breathing room.

- **Fluid Grid:** Desktop layouts use a twelve-column grid system with offsets (e.g., margins on columns and cards) that create an editorial layout rhythm, while mobile views stack elements vertically in a single column.
- **Spacing Scale:** Governed by a base spacing unit of 8px. Large sections use generous margins (9rem desktop) to separate content themes cleanly.
- **Whitespace:** Elements are surrounded by significant empty space, forcing viewers to focus on details.

## Elevation & Depth

Rather than relying on modern blurred drop shadows, depth is created using flat, hard-edged shadow shapes, stark color blocks, and light-bending overlays.

- **Shadows:** The floating hero image features a 16px flat offset highlight in `accent-y` (#efc440), combined with a large, soft multi-stage shadow to simulate physical layers of board.
- **Overlay States:** Hovered project cards reveal a dark gradient overlay (`rgba(12, 11, 9, 0.75)`) and a slide-up project pill to invite interaction.
- **Blend Modes:** The custom cursor utilizes a multiply blend mode (`mix-blend-mode: multiply`) to interact dynamically with the text and backgrounds it floats over.

## Shapes

The design system prefers strict architectural sharpness combined with perfect circles for micro-elements.

- **Corners:** Containers, buttons, cards, and input fields feature completely sharp corners (`rounded.none`), emphasizing an industrial, print-like editorial design.
- **Accents:** Perfect circles are used for status dots (e.g., section labels) and the interactive custom cursor.

## Components

### Navigation

The fixed top navigation uses a transparent background that shifts to a blurred, frosted cream backdrop (`rgba(244, 239, 230, 0.86)`) on scroll to maintain readability. Links use a red bottom border expand effect on hover.

### Custom Cursor

 A custom circle cursor follows the mouse coordinates. It defaults to a small red multiply dot and transitions to a larger golden circle when hovering over interactive elements.

### Buttons

- **Primary Action (Fill):** High-contrast button with a solid dark background and light text, utilizing a slide-in red color fill transition on hover.
- **Secondary Action (Outline):** A clean, bordered button with no background fill that reverses color scheme upon hover.

### Project Cards

Asymmetrical grid blocks containing project preview images. Hovering triggers a zoom effect on the image, a dark gradient overlay transition, and a slide-up indicator pill.

## Do's and Don'ts

- Do pair bold, uppercase sans-serif labels with elegant italicized serif headings for visual variety.
- Do use generous spacing (9rem+) between main content sections to preserve the editorial feel.
- Don't use rounded corners for buttons or containers, except for status dots or the custom cursor.
- Don't mix multiple highlight accents in a single element; assign a clear, consistent color role for tags and highlights.
