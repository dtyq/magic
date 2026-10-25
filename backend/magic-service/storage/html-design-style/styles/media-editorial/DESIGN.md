---
version: alpha
name: Media & Editorial
description: Content-first editorial design system optimized for long-form reading and minimal interface distraction.
colors:
  primary: "#1A1A1A"
  accent: "#D64045"
  accent-hover: "#B83438"
  bg: "#FFFFFF"
  bg-warm: "#FAF9F7"
  bg-code: "#F5F5F5"
  surface: "#FFFFFF"
  border: "#E8E8E8"
  text-primary: "#1A1A1A"
  text-secondary: "#555555"
  text-muted: "#999999"
  text-caption: "#777777"
  sepia-bg: "#F4EDDF"
  sepia-text: "#3D3229"
  dark-bg: "#1A1A1A"
  dark-text: "#D4D4D4"
  dark-accent: "#E8696D"
typography:
  display:
    fontFamily: Lora
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -1px
  h1:
    fontFamily: Lora
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.5px
  h2:
    fontFamily: Lora
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.3px
  h3:
    fontFamily: Lora
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0px
  h4-kicker:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.5px
  body:
    fontFamily: Source Serif 4
    fontSize: 19px
    fontWeight: 400
    lineHeight: 1.8
    letterSpacing: 0px
  body-sm:
    fontFamily: Source Serif 4
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: 0px
  caption:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
  meta:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.3px
  code:
    fontFamily: JetBrains Mono
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0px
rounded:
  none: 0px
  sm: 3px
  md: 6px
  lg: 24px
  full: 9999px
spacing:
  space-2: 16px
  space-3: 24px
  space-4: 32px
  space-6: 48px
  space-8: 64px
  space-10: 80px
  space-12: 96px
  body-max-width: 680px
  image-max-width: 960px
  page-max-width: 1200px
  page-margin-desktop: 24px
  page-margin-mobile: 16px
components:
  article-body:
    typography: "{typography.body}"
    textColor: "{colors.text-primary}"
    width: "{spacing.body-max-width}"
  article-link:
    textColor: "{colors.text-primary}"
    textColorHover: "{colors.accent}"
  article-card-list:
    backgroundColor: "{colors.surface}"
    dividerColor: "{colors.border}"
    dividerSpacing: "{spacing.space-4}"
  article-card-grid:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    cardGap: "{spacing.space-2}"
  pull-quote:
    borderColor: "{colors.accent}"
    textColor: "{colors.text-primary}"
    typography: "{typography.h2}"
    padding: "{spacing.space-3}"
  code-block:
    backgroundColor: "{colors.bg-code}"
    typography: "{typography.code}"
    rounded: "{rounded.md}"
    padding: "{spacing.space-3}"
  inline-code:
    backgroundColor: "{colors.bg-code}"
    typography: "{typography.code}"
    rounded: "{rounded.sm}"
  nav-minimal:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text-primary}"
    height: 56px
  newsletter-inline:
    backgroundColor: "{colors.bg-warm}"
    headlineTypography: "{typography.h3}"
    buttonBackground: "{colors.accent}"
    buttonTextColor: "#FFFFFF"
---

## Brand & Style

Content is sovereign. The interface exists to present words and images at their best and then disappear.

This system is built for blogs, magazines, newsletters, and other content-heavy products where sustained reading is the primary job-to-be-done. The tone is readable, elegant, editorial, and unhurried. Navigation and platform voice stay quiet so the writer's voice leads.

## Colors

The palette is intentionally restrained: near-black text on white reading surfaces with one editorial accent.

- Reading surfaces stay white in default mode to maximize readability.
- The accent red is used sparingly (active nav, pull quotes, hover states, selected highlights).
- Metadata and supporting text move down a neutral scale without reducing contrast below accessible thresholds.
- Reading modes (light, sepia, dark) shift only background/text/accent relationships, not layout or typographic structure.

## Typography

Typography is optimized for long-form reading, not density.

- Serif is mandatory for article content and major headlines.
- Sans-serif is reserved for navigation, controls, labels, and metadata.
- Body copy is set to `19px` with `1.8` line height and a fixed reading measure of `680px`.
- Text is always left-aligned; justified body text is disallowed.

## Layout & Spacing

Layout enforces editorial rhythm through narrow reading measure, image breakout, and generous vertical spacing.

- Article text column max width is `680px`.
- Images can break out to `960px` to create pacing contrast.
- Overall page content caps at `1200px`.
- Base spacing uses the editorial scale (`16px` to `96px`) with larger vertical gaps than typical app UIs.
- No sidebar is shown while reading article content.

Breakpoints:
- Mobile (`<640px`): single column, full-width images, reduced headline sizes.
- Tablet (`640px - 1024px`): body column preserved, two-column grids for listings.
- Desktop (`>1024px`): full editorial layout with breakout images and three-column grids where applicable.

## Elevation & Depth

Reading surfaces stay visually flat. Hierarchy comes from typography, spacing, and dividers rather than layered cards.

- `none`: default article and listing surfaces.
- `sm`: sticky navigation and lightweight floating controls.
- `md`: transient overlays such as share panels and optional newsletter popups.

Shadows remain subtle and rare, so content never feels boxed-in.

## Shapes

Shape language is mostly square and structural, with selective rounding for utility elements.

- Article cards and imagery default to no corner radius.
- Code blocks and inline code use small rounding for scanability (`6px` and `3px`).
- Avatars are circular.
- Pull quotes use a vertical accent rule rather than rounded containers.

## Components

### Article Cards

List view uses media-left layout on desktop and stacked layout on mobile. Dividers separate entries with generous vertical rhythm. Grid cards prioritize headline clarity and metadata legibility, with no ornamental borders.

### Article Page

Article pages center the reading column, allow controlled image breakout, and apply consistent text styles for paragraphs, headings, lists, block quotes, and code. Progress indication is recommended for long reads.

### Pull Quote

Pull quotes are editorial accents: italic serif, accent left rule, and measured spacing. Attribution is muted and secondary.

### Navigation

Navigation is minimal and compact (`56px` height), with very few items. Active state is indicated by an accent underline, and mobile uses a simple left drawer.

### Newsletter Inline Block

Newsletter signup appears between list items or at article end, using warm background contrast, clear heading hierarchy, and concise privacy copy.

## Do's and Don'ts

- Do keep reading comfort as the top priority in every component decision.
- Do maintain the `680px` reading measure and generous body line height.
- Do use serif content typography and preserve clear heading hierarchy.
- Do include read-time metadata and progress indicators for long articles.
- Don't introduce sidebars, modal interruptions, or autoplay media while reading.
- Don't use justified text, undersized body copy, or decorative depth effects in article flow.
