# MagSpread Design System

## Overview

MagSpread is an editorial design system inspired by print magazine layouts, built for digital magazines and longform storytelling. It combines warm cream surfaces with deep teal and rose accents to create a luxurious, full-bleed reading experience. The system rejects shadows and rounded corners in favor of generous whitespace, bold serif headlines, and sharp geometric precision.

---

## Colors

- **Color Primary** (#134E4A): Headlines, primary actions
- **Color Secondary** (#E11D48): Pull quotes, accent elements
- **Color Tertiary** (#FDF2E9): Background, warm surface
- **Surface Base** (#FDF2E9): Page background
- **Color Success** (#16A34A): Published status
- **Color Warning** (#D97706): Draft, review needed
- **Color Error** (#DC2626): Errors, corrections
- **Color Info** (#2563EB): Updates, related

## Typography

- **Headline Font**: Playfair Display
- **Body Font**: Manrope
- **Mono Font**: Source Code Pro

- **h1**: 56px black, 1.1 line height. Cover headlines.
- **h2**: 40px bold, 1.15 line height. Section titles.
- **h3**: 28px bold, 1.25 line height. Article titles.
- **h4**: 22px bold, 1.3 line height. Sub-headings.
- **body**: 18px regular, 1.75 line height. Article body.
- **small**: 14px medium, 1.5 line height. Captions, credits.
- **xs**: 12px bold, 1.4 line height. Labels, categories.

---

## Spacing

Base unit: **12px** (spacious editorial rhythm).
- **xs**: 6px — Inline icon gaps
- **sm**: 12px — Tight padding
- **md**: 24px — Standard content padding
- **lg**: 36px — Section gaps
- **xl**: 48px — Column margins
- **2xl**: 72px — Major section breaks
- **3xl**: 96px — Full-bleed hero spacing

## Border Radius

- **radius-none** (0px): All elements (default)
All elements use sharp corners (0px) to maintain the print-magazine aesthetic. No rounded corners anywhere in the system.

## Elevation

No shadows are used. The MagSpread system relies on whitespace, color blocks, and typographic scale to create hierarchy, true to its print-inspired aesthetic.
- **shadow-none**: none. Default for all.
Use full-bleed color blocks, generous margins, and border-strong rules to create visual separation.

## Components

### Buttons
#### Variants
- **Primary**: #134E4A fill, #FFFFFF text, no border, #0F3D3A fill.
- **Secondary**: transparent fill, #134E4A text, 2px #134E4A border, #134E4A10 fill.
- **Ghost**: transparent fill, #134E4A text, no border, #134E4A08 fill.
- **Destructive**: #DC2626 fill, #FFFFFF text, no border, #B91C1C fill.
#### Sizes
Sizes: Small (8px 20px, 14px, 36px), Medium (10px 28px, 16px, 44px), Large (14px 36px, 18px, 52px).
#### Disabled State
0.4 opacity.
- disabled cursor
- No hover or focus effects applied

### Cards
- **Default**: #FFFFFF fill, 1px #E7E5E4 border, no shadow. Hover: border-color #134E4A.
- **Elevated**: #FFFFFF fill, 2px #134E4A (left only) border, no shadow. Hover: background #FDF2E9.
0px border radius. 24px padding.

### Inputs
- **Default**: 1px #D6D3D1 border, #FFFFFF fill.
- **Hover**: 1px #A8A29E border, #FFFFFF fill.
- **Focus**: 2px #134E4A border, #FFFFFF fill.
- **Error**: 2px #DC2626 border, #FEF2F2 fill.
- **Disabled**: 1px #E7E5E4 border, #F5F5F4 fill, none; 50% opacity shadow.
12px, Manrope 700, content-primary, uppercase, tracking 1px, 6px bottom margin **label**, 13px, Manrope 400, content-secondary, 6px top margin; error helper uses color-error **helper text**, 12px/16px;/border/radius:/0px padding.

### Chips
- **Filter**: #134E4A fill, #FFFFFF text, no border.
- **Status**: varies by severity fill, varies text, no border.
success #DCFCE7/#166534, warning #FEF3C7/#92400E, error #FEE2E2/#991B1B status colors, 4px/14px;/font-size:/11px;/uppercase;/letter-spacing:/1px;/border-radius:/0px padding.

### Lists
16px Manrope content-primary. 52px; padding: 0 24px row height, 1px #E7E5E4 divider. Hover: background #FDF2E9. Active: border-left 3px #134E4A, font-weight 700.

### Checkboxes
20px square; border-radius: 0px. 10px; label font: 16px Manrope label gap. Unchecked: 2px #D6D3D1, background #FFFFFF. Checked: background #134E4A, white checkmark icon. Focus: 2px dashed #134E4A offset 2px.

### Radio Buttons
20px circle; border-radius: 50%. 10px; label font: 16px Manrope label gap. Unchecked: 2px #D6D3D1, background #FFFFFF. Selected: 2px #134E4A, inner dot 10px #134E4A. Focus: 2px dashed #134E4A offset 2px.

### Tooltips
#134E4A; text: #FFFFFF; font: 13px Manrope fill. 8px/14px;/border-radius:/0px padding, 6px; max-width: 260px arrow, 300ms show, 0ms hide delay.
---

## Do's and Don'ts

1. **Do** use Playfair Display at bold or black weights for dramatic, editorial headlines.
2. **Do** leverage full-bleed images and color blocks for magazine-style section breaks.
3. **Do** maintain generous line height (1.75) on body text for comfortable long-form reading.
4. **Don't** add border-radius to any element; the sharp, geometric print aesthetic is core.
5. **Don't** use drop shadows or glows; hierarchy comes from scale, color, and whitespace.
6. **Do** use the secondary rose (#E11D48) for pull quotes, drop caps, and accent highlights.
7. **Don't** use more than two columns for body text; readability declines past ~70 characters per line.
8. **Do** apply the 12px spacing base consistently for an airy, editorial feel.
9. **Don't** use the warm cream background for text-on-cream combinations below AA contrast ratio.
10. **Do** use uppercase letter-spaced labels for category tags and section identifiers.
