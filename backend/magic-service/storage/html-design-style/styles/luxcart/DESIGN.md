# LuxCart

Refined, minimal, white-glove shopping experience.

## Overview

LuxCart is a design system for high-end luxury goods and designer fashion retail. It treats whitespace as a luxury material, letting products breathe in an atmosphere of restrained elegance. The very spacious density communicates exclusivity — every pixel earns its place. The warm white foundation paired with charcoal typography and gold accents evokes the quiet confidence of a flagship boutique.

## Colors

- **Primary** (#1C1917): Charcoal — CTAs, primary text, key actions
- **Secondary** (#FFFBEB): Cream — background surfaces, breathing space
- **Tertiary** (#B8860B): Gold — accent highlights, premium indicators
- **Neutral** (#D4D4D8): Cool Gray — dividers, muted UI elements
- **Background** (#FFFBEB): Warm white base
- **Surface** (#FFFFFF): Cards, modals, overlays
- **Success** (#166534)
- **Warning** (#CA8A04)
- **Error** (#991B1B)
- **Info** (#1E40AF)

## Typography

- **Headline Font**: Cormorant Garamond
- **Body Font**: Raleway
- **Mono Font**: JetBrains Mono

- **Display**: Cormorant Garamond 48px light, 1.1 line height, 0.02em tracking. Hero banners, brand statements.
- **Headline**: Cormorant Garamond 36px regular, 1.2 line height, 0.01em tracking. Page titles, collection names.
- **Subhead**: Cormorant Garamond 24px medium, 1.3 line height, 0.01em tracking. Section headers, product names.
- **Body Large**: Raleway 18px light, 1.7 line height, 0.02em tracking. Product descriptions, editorials.
- **Body**: Raleway 16px regular, 1.7 line height, 0.02em tracking. Default paragraph text.
- **Body Small**: Raleway 14px regular, 1.6 line height, 0.02em tracking. Details, specifications.
- **Caption**: Raleway 12px medium, 1.4 line height, 0.04em tracking. Material labels, sizing info.
- **Overline**: Raleway 11px semibold, 1.5 line height, 0.12em tracking. Category labels, "NEW ARRIVAL".
- **Code**: JetBrains Mono 14px regular, 1.6 line height. Order numbers, tracking IDs.

## Spacing

- **Base unit:** 12px
- **Scale:** 4 / 8 / 12 / 24 / 36 / 48 / 72 / 96 / 144
- **Component padding (small):** 12px 16px
- **Component padding (medium):** 16px 24px
- **Component padding (large):** 24px 36px
- **Section spacing (mobile):** 72px
- **Section spacing (tablet):** 96px
- **Section spacing (desktop):** 144px

## Border Radius

- **None** (0px): Full-bleed imagery, hero sections
- **Small** (2px): Buttons, inputs, chips
- **Medium** (4px): Cards, modals, dropdown menus
- **Large** (6px): Feature panels, promotional areas
- **XL** (8px): Dialogs, large containers
- **Full** (9999px): Avatars, status indicators

## Elevation

**Philosophy:** Subtle shadows only — understated elegance. Shadows should barely be perceptible, lending depth without weight.
- **Subtle**: 1px offset, 2px blur, #1C1917 at 4%
- **Medium**: 2px offset, 8px blur, #1C1917 at 6%
- **Large**: 4px offset, 16px blur, #1C1917 at 8%
- **Overlay**: 8px offset, 32px blur, #1C1917 at 12%
**Special:** Product image hover uses 8px offset, 24px blur, #1C1917 at 10% for a floating gallery effect.

## Components

### Buttons
- **Primary**: #1C1917 fill, #FFFBEB text, no border, 2px corners. Raleway 500 tracking 0.08em uppercase. Hover: #292524. Active: #0C0A09.
- **Secondary**: transparent, #1C1917 text, 1px #1C1917 border, 2px corners. #1C1917, text #FFFBEB hover background.
- **Ghost**: transparent, #1C1917 text, no border. Hover: underline, text-underline-offset 4px.
- **Destructive**: #991B1B fill, #FFFFFF text, no border. Hover: #7F1D1D.
- **Sizes**: Small 36px / Medium 44px / Large 52px height
- **Disabled**: 40% opacity, disabled cursor

### Cards
- **Default**: #FFFFFF fill, 1px #F5F5F4 border, 4px corners, 1px offset, 2px blur, #1C1917 at 4% shadow. 24px padding. Hover: shadow 0 2px 8px #1C1917 at 6%.
- **Elevated**: #FFFFFF fill, no border, 4px corners, 2px offset, 8px blur, #1C1917 at 6% shadow. 36px padding. Hover: shadow 0 4px 16px #1C1917 at 8%.

### Inputs
- **Text Input**: #FFFFFF fill, 1px #E7E5E4 border, #1C1917 text, 2px corners. #A8A29E placeholder, 14px/16px padding, 48px tall. Focus: border-color #1C1917, outline none. Error: border-color #991B1B. Disabled: background #FAFAF9, 50% opacity.
- **Label**: Raleway 500, 12px, tracking 0.06em, uppercase, color #57534E, bottom margin 8px
- **Helper text**: Raleway 400, 12px, color #A8A29E

### Chips
- **Filter Chip**: transparent, #57534E text, 1px #E7E5E4 border, 2px corners. Raleway 500 12px tracking 0.04em. 8px/16px padding. Selected: background #1C1917, text #FFFBEB, border-color #1C1917. Hover: border-color #D4D4D8.
- **Status Chip**: background transparent, text #166534, border 1px #166534 available, background #FFFBEB, text #B8860B, border 1px #B8860B limited edition, background transparent, text #1E40AF, border 1px #1E40AF pre-order, background transparent, text #991B1B, border 1px #991B1B sold out.

### Lists
- **Default List Item**: Raleway 400 16px. 56px tall, 16px/24px padding, 1px #F5F5F4 divider, 20px icon, 16px gap before text icon variant. Hover: background #FAFAF9. Selected: background #FAFAF9, left border 2px #1C1917.

### Checkboxes
18px, 1px #D4D4D8 border, 2px corners. Checked: background #1C1917, border-color #1C1917, checkmark #FFFBEB. Indeterminate: background #1C1917, dash #FFFBEB. Disabled: 40% opacity. Labels in Raleway 400 14px 12px gap.

### Radio Buttons
18px, 1px #D4D4D8 border. Selected: border-color #1C1917, inner dot #1C1917 (8px). Disabled: 40% opacity. Labels in Raleway 400 14px 12px gap.

### Tooltips
#1C1917 fill, #FFFBEB text, 2px corners. Raleway 400 12px. 10px/16px padding, 220px max width, 5px arrow, 400ms delay, top (default) position.

## Do's and Don'ts

1. **Do** use generous whitespace — luxury is communicated by what you leave out, not what you put in.
2. **Don't** use Gold #B8860B for large surfaces; reserve it for fine accents like dividers, icons, and small highlights.
3. **Do** use light-weight font weights (300) for display text — Cormorant Garamond shines when it breathes.
4. **Don't** use more than two colors in a single view — restraint is elegance.
5. **Do** keep product imagery large, high-resolution, and on neutral backgrounds.
6. **Don't** use rounded corners above 8px — the system demands clean, precise geometry.
7. **Do** uppercase overline and button text with wide tracking for a couture label feel.
8. **Don't** crowd product grids — use 2-3 columns maximum on desktop to maintain exclusivity.
9. **Do** use subtle hover transitions (200-300ms ease) — abrupt changes feel cheap.
10. **Don't** add badges, banners, or "SALE" stickers that clutter the minimal aesthetic.
