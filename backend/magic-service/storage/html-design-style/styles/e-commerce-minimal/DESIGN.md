---
version: alpha
name: E-Commerce Minimal
description: A product-first e-commerce design system for storefronts, PDPs, and checkout flows with sharp geometry, restrained color, and conversion-focused clarity.
colors:
  primary: "#1A1A1A"
  primary-hover: "#333333"
  background: "#FFFFFF"
  background-warm: "#F8F7F4"
  surface: "#FFFFFF"
  border: "#E8E8E8"
  border-light: "#F0F0F0"
  text-primary: "#1A1A1A"
  text-secondary: "#666666"
  text-muted: "#999999"
  success: "#2E7D32"
  error: "#C62828"
  sale: "#C62828"
  warning: "#E65100"
typography:
  display:
    fontFamily: Satoshi, DM Sans, -apple-system, sans-serif
    fontSize: 40px
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: -0.5px
  h1:
    fontFamily: Satoshi, DM Sans, -apple-system, sans-serif
    fontSize: 28px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: -0.3px
  h2:
    fontFamily: Satoshi, DM Sans, -apple-system, sans-serif
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: -0.2px
  h3:
    fontFamily: Satoshi, DM Sans, -apple-system, sans-serif
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: 0px
  price-lg:
    fontFamily: Satoshi, DM Sans, -apple-system, sans-serif
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0px
  price-md:
    fontFamily: Satoshi, DM Sans, -apple-system, sans-serif
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0px
  body:
    fontFamily: Satoshi, DM Sans, -apple-system, sans-serif
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 0px
  small:
    fontFamily: Satoshi, DM Sans, -apple-system, sans-serif
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
  caption:
    fontFamily: Satoshi, DM Sans, -apple-system, sans-serif
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 1px
  mono:
    fontFamily: JetBrains Mono, monospace
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0px
rounded:
  none: 0px
  full: 9999px
spacing:
  base: 4px
  space-1: 4px
  space-2: 8px
  space-3: 12px
  space-4: 16px
  space-6: 24px
  space-8: 32px
  space-10: 40px
  space-12: 48px
  space-16: 64px
  space-20: 80px
  gutter: 24px
  page-margin-desktop: 48px
  page-margin-tablet: 24px
  page-margin-mobile: 16px
  max-content-width: 1440px
  max-product-grid-width: 1200px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    typography: "{typography.caption}"
    rounded: "{rounded.none}"
    padding: 16px 32px
    height: 52px
    width: 100%
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-active:
    backgroundColor: "#000000"
  button-primary-disabled:
    backgroundColor: "{colors.border}"
    textColor: "{colors.text-muted}"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.text-primary}"
    rounded: "{rounded.none}"
    borderColor: "{colors.border}"
    height: 52px
  button-link:
    backgroundColor: transparent
    textColor: "{colors.text-primary}"
    typography: "{typography.small}"
  product-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.none}"
    padding: 0px
  product-image-frame:
    backgroundColor: "{colors.background-warm}"
    rounded: "{rounded.none}"
  size-pill:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.none}"
    borderColor: "{colors.border}"
    height: 40px
    padding: 0 16px
  size-pill-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
  cart-flyout:
    backgroundColor: "{colors.surface}"
    width: 420px
  cart-divider:
    backgroundColor: "{colors.border-light}"
---

## Brand & Style

The product is the hero and the interface is the stage. This system is built for direct-to-consumer storefronts, product detail pages, and checkout flows where clarity and trust drive conversion better than urgency patterns.

The visual personality is clean, premium, and product-forward. Product photography carries the emotional tone while UI chrome stays restrained: sharp corners, minimal decoration, near-monochrome palette, and direct microcopy.

## Colors

The palette is intentionally narrow: black, white, warm off-white, and restrained grays.

- Primary black (`#1A1A1A`) drives critical actions, key text, and high-priority emphasis.
- Warm neutral (`#F8F7F4`) supports product image framing and alternating section backgrounds.
- Sale red (`#C62828`) is the single high-attention accent and should be reserved for discount pricing and sale badges.
- Semantic success (`#2E7D32`), warning (`#E65100`), and error (`#C62828`) communicate status without introducing extra decorative color systems.

## Typography

Typography uses a single sans-serif family for most UI (`Satoshi` with `DM Sans` and system fallbacks) to keep rhythm consistent and visual noise low. `JetBrains Mono` is reserved for technical identifiers such as order numbers and SKUs.

- Medium weight (`500`) is the dominant display weight.
- Body remains regular (`400`) with generous line-height for readability.
- Prices use stronger emphasis (`600`) without relying on oversized treatment everywhere.
- Product names remain sentence case, and labels use subtle uppercase styling only where needed (for example badges and nav labels).

## Layout & Spacing

The layout model is a fixed max-width commerce grid with responsive column behavior:

- Product grid: 4 columns desktop, 3 tablet, 2 mobile.
- Product detail page: 2-column desktop split (55/45), stacked on mobile.
- Cart: right flyout on desktop, full-screen panel on mobile.

Spacing follows a strict 4px-derived scale to maintain consistency across product cards, selectors, navigation, and checkout surfaces. Page margins are `48px` desktop, `24px` tablet, and `16px` mobile.

## Elevation & Depth

Depth is intentionally restrained. Most surfaces are flat, and hierarchy is created through spacing, typography, and tonal contrast rather than heavy shadow stacks.

- None: default for cards, product tiles, and primary page surfaces.
- SM (`0 2px 8px rgba(0,0,0,0.06)`): dropdowns and lightweight overlays.
- MD (`0 4px 24px rgba(0,0,0,0.08)`): cart flyout and lightbox contexts.

Product images should create perceived depth through photography itself, not interface ornamentation.

## Shapes

The shape language is sharp and architectural:

- Buttons, cards, image frames, selectors, and inputs use `0px` corner radius.
- Circular affordances (for example color swatches and counters) can use fully rounded treatment where the object itself is semantically circular.

This all-sharp rule is a core brand signature and should remain consistent across states and breakpoints.

## Components

### Buttons

Primary actions (especially "Add to Bag" and cart checkout) are full-width, high-contrast, and fixed-height (`52px`) with uppercase caption styling. Secondary actions use transparent backgrounds with subtle borders. Disabled states must reduce contrast clearly and never masquerade as available actions.

### Product Cards and Grid

Cards are structurally simple: image first, details second. No card shadow, border, or decorative framing. Product imagery sits on warm neutral backgrounds with consistent `3:4` ratio and internal breathing room. Entire cards are clickable to support fast browse-to-detail flow.

### Product Detail Patterns

PDP structure prioritizes decision readiness above the fold: category label, name, price, variant selectors, and primary CTA remain visible without unnecessary scrolling. Supporting details (materials, care, shipping, sizing) belong in lightweight accordion sections.

### Variant Selectors

Size uses horizontal sharp pills (`40px` height) with high-contrast selected state. Color selectors use circular swatches with a clear selected ring and explicit text/tooltips for accessible color naming.

### Cart Flyout

Cart flyout uses a right-aligned panel (`420px` desktop) with clear line-item hierarchy: image, product metadata, quantity controls, remove action, subtotal, and sticky full-width checkout button. Use subtle separators and avoid promotional clutter.

### Navigation

Navigation is centered-logo with split left/right groups, uppercase utility labels, and restrained interaction states. On mobile, simplify to hamburger-left, logo-center, bag-right. Sticky state may introduce a bottom border for scannability.

## Do's and Don'ts

### Do

- Let product photography dominate pages.
- Keep pricing transparent and immediately visible.
- Maintain consistent product image ratio (`3:4`) and warm-neutral framing.
- Preserve sharp-corner geometry across core UI elements.
- Support robust keyboard focus, descriptive alt text, and WCAG AA contrast.

### Don't

- Don't use urgency dark patterns (fake timers, manipulative counters).
- Don't introduce decorative badges or loud promotional chrome.
- Don't round buttons/cards/images in this system.
- Don't hide price or total cost until late checkout steps.
- Don't use carousel-heavy browsing patterns in place of scannable product grids.
