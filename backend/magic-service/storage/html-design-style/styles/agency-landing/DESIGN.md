---
name: Agency Landing
colors:
  primary: "#18160F"
  on-primary: "#F4F1EA"
  cream: "#F4F1EA"
  warm-white: "#F9F7F3"
  paper: "#FDFCF9"
  ink: "#18160F"
  ink-soft: "#38352E"
  ink-muted: "#78746C"
  ink-faint: "#B4B0A8"
  ink-ghost: "#D8D4CC"
  accent: "#B8935A"
  accent-warm: "#A07840"
  accent-pale: "#E8D9BE"
  rule: "#E2DED6"
  rule-dark: "#C8C4BC"
typography:
  display-lg:
    fontFamily: Cormorant Garamond
    fontSize: 138px
    fontWeight: "300"
    lineHeight: "1"
    letterSpacing: -0.026em
  display-md:
    fontFamily: Cormorant Garamond
    fontSize: 84px
    fontWeight: "300"
    lineHeight: "1.04"
    letterSpacing: -0.026em
  display-sm:
    fontFamily: Cormorant Garamond
    fontSize: 69px
    fontWeight: "300"
    lineHeight: "1.1"
    letterSpacing: -0.026em
  headline-lg:
    fontFamily: Cormorant Garamond
    fontSize: 58px
    fontWeight: "400"
    lineHeight: "1"
    letterSpacing: -0.017em
  headline-md:
    fontFamily: Cormorant Garamond
    fontSize: 33px
    fontWeight: "400"
    lineHeight: "1.14"
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Cormorant Garamond
    fontSize: 30px
    fontWeight: "400"
    lineHeight: "1.2"
    letterSpacing: -0.012em
  body-lg:
    fontFamily: Cormorant Garamond
    fontSize: 21px
    fontWeight: "300"
    lineHeight: "1.88"
  body-md:
    fontFamily: Cormorant Garamond
    fontSize: 19px
    fontWeight: "300"
    lineHeight: "1.82"
  label-sm:
    fontFamily: DM Mono
    fontSize: 11px
    fontWeight: "400"
    letterSpacing: 0.22em
    textTransform: uppercase
rounded:
  none: 0px
spacing:
  container-padding-desktop: 64px
  container-padding-mobile: 24px
  section-margin: 136px
components:
  nav:
    backgroundColor: rgba(244, 241, 234, 0.92)
    textColor: "{colors.ink}"
    padding: 0 64px
  hero:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.ink}"
    accentColor: "{colors.accent}"
  work-card:
    backgroundColor: "{colors.warm-white}"
    textColor: "{colors.ink-soft}"
    tagColor: "{colors.ink-muted}"
  case-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-soft}"
    borderColor: "{colors.rule}"
    padding: 52px 44px 48px
  statement:
    textColor: "{colors.ink}"
    accentColor: "{colors.accent-warm}"
  pullquote:
    backgroundColor: "{colors.ink-ghost}"
    textColor: "{colors.ink-faint}"
    ruleColor: "{colors.rule-dark}"
  number-item:
    accentColor: "{colors.accent-pale}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
---

## Brand & Style

Meridian is a creative agency that shapes ideas into culture. The brand identity is sophisticated, elegant, and timeless. It heavily leverages a minimalist layout with beautifully structured typography, large imagery, and considered white space to let the content breathe. The overall feel is premium, editorial, and confident.

## Colors

The color palette is built on warm, organic neutrals accented by a refined gold tone.

- **Backgrounds:** `cream`, `warm-white`, and `paper` are used in subtle succession to differentiate sections without strong visual borders.
- **Typography (Ink):** Black is softened to `ink` and `ink-soft` to reduce harsh contrast, creating a more print-like reading experience.
- **Accents:** `accent` (a muted gold) is used sparingly for interactive elements, hover states, and small structural rules, adding a touch of understated luxury.
- **Rules:** Very delicate borders (`rule`, `rule-dark`) are used to create structure and grid lines, echoing editorial layouts.

## Typography

The typographic system is rooted in classic editorial design, contrasting a highly legible, elegant serif with a functional, typewriter-esque monospace font.

- **Primary Display & Body:** `Cormorant Garamond`. It's used at extremely large, fluid sizes (`clamp()`) for headlines to create dramatic impact, and at lighter weights (300) for body copy to maintain elegance. Italics are used thoughtfully for emphasis within headlines.
- **Labels & Microcopy:** `DM Mono` is utilized for eyebrows, indices, tags, and small structural labels. It's always used in uppercase with wide letter-spacing (`0.22em`), providing a utilitarian contrast to the fluid curves of the Garamond.

## Layout & Spacing

The layout embraces strong grid structures and generous padding, drawing inspiration from high-end print design.

- **Grids:** The design employs varied grid structures—from expansive 55/45 splits in the hero to strict, bordered multi-column layouts in the "Cases" and "Numbers" sections.
- **Borders as Structure:** Unlike modern web design which often relies on shadows or distinct background colors for cards, Meridian uses 1px solid borders (`var(--rule)`) to construct its layout, creating a visible "framework" that feels architectural.
- **Whitespace:** Massive margins and padding (e.g., 136px padding on sections) give elements room to exist individually.

## Animation & Interaction

Interactions are deliberate, smooth, and refined, never distracting from the content.

- **Scroll Reveals:** Elements fade and slide up gently as they enter the viewport, establishing a slow, considered reading pace.
- **Hover States:** Hover effects on cards often involve a subtle background shift (e.g., to `warm-white`) or an animated accent line expanding from the bottom edge. Image hovers feature delicate scale and filter (saturation/contrast) transitions.
- **Link Highlights:** Navigation and inline links use expanding underlines rather than color shifts, maintaining the monochromatic primary palette.
