# UrbanLoft Design System

## Overview

UrbanLoft is a modern, urban, and architecturally inspired design system for commercial real estate and urban property platforms. Its monochromatic foundation of charcoal and concrete is punctuated by precise blue accents, reflecting the clean lines of contemporary architecture. The system emphasizes structure, data clarity, and professional presentation.

---

## Colors

- **Primary Charcoal** (#1C1917): Primary actions, strong headers
- **Secondary Concrete** (#9CA3AF): Secondary text, borders
- **Tertiary Accent Blue** (#2563EB): Links, CTAs, highlights
- **Background** (#FAFAFA): Page background
- **Surface Default** (#FFFFFF): Card backgrounds
- **Success** (#16A34A): Available, active lease
- **Warning** (#D97706): Pending, under review
- **Error** (#DC2626): Off-market, errors
- **Info** (#2563EB): Featured, new development

## Typography

- **Headline Font**: Space Grotesk
- **Body Font**: Inter
- **Mono Font**: JetBrains Mono

- **Display**: Space Grotesk 40px bold, 1.15 line height
- **H1**: Space Grotesk 32px bold, 1.2 line height
- **H2**: Space Grotesk 24px semibold, 1.25 line height
- **H3**: Space Grotesk 20px semibold, 1.3 line height
- **H4**: Space Grotesk 16px medium, 1.35 line height
- **Body LG**: Inter 18px regular, 1.6 line height
- **Body**: Inter 16px regular, 1.6 line height
- **Body SM**: Inter 14px regular, 1.5 line height
- **Caption**: Inter 12px medium, 1.4 line height
- **Code**: JetBrains Mono 14px regular, 1.6 line height

---

## Spacing

Base unit: **8px**
- **xs**: 4px — Inline icon gaps
- **sm**: 8px — Tight component padding
- **md**: 16px — Default padding
- **lg**: 24px — Card padding
- **xl**: 32px — Section gaps
- **2xl**: 48px — Layout sections
- **3xl**: 64px — Page-level spacing

## Border Radius

- **sm** (2px): Badges, small tags
- **DEFAULT** (4px): Buttons, cards, inputs
- **md** (6px): Modals, dropdown panels
- **lg** (8px): Large containers
- **full** (9999px): Avatars, status indicators

## Elevation

Subtle, architectural shadows -- clean and understated.
- **sm**: 1px offset, 2px blur, #1C1917 at 4%. Buttons, chips.
- **DEFAULT**: 1px offset, 4px blur, #1C1917 at 6%. Cards, dropdowns.
- **md**: 4px offset, 12px blur, #1C1917 at 8%. Elevated cards.
- **lg**: 8px offset, 24px blur, #1C1917 at 12%. Modals, panels.

## Components

### Buttons
#### Variants
- **Primary**: #1C1917 fill, #FFFFFF text, no border, #0C0A09 fill.
- **Secondary**: transparent fill, #1C1917 text, 1px #1C1917 border, #1C19170A fill.
- **Ghost**: transparent fill, #57534E text, no border, #F5F5F4 fill.
- **Destructive**: #DC2626 fill, #FFFFFF text, no border, #B91C1C fill.
#### Sizes
Sizes: sm (6px 12px, 14px, 32px), md (8px 20px, 14px, 40px), lg (12px 28px, 16px, 48px).
#### Disabled State
0.4 opacity.
- disabled cursor
- All hover and focus states suppressed
---

### Cards
- **Default**: #FFFFFF fill, 1px #E7E5E4 border, no shadow, 4px radius.
- **Elevated**: #FFFFFF fill, no border, md shadow, 4px radius.
** 24px **padding, ** top slot, border-radius 4px 4px 0 0 **image area, ** optional dark header strip (#1C1917) with white text for property type labels **header bar.
---

### Inputs
- **Default**: 1px #E7E5E4 border, #FFFFFF fill, no shadow.
- **Hover**: 1px #1C1917 border, #FFFFFF fill, no shadow.
- **Focus**: 2px #1C1917 border, #FFFFFF fill, 3px ring #1C191718 shadow.
- **Error**: 2px #DC2626 border, #FFFFFF fill, 3px ring #DC262618 shadow.
- **Disabled**: 1px #E7E5E4 border, #F5F5F4 fill, no shadow.
** 40px | **Padding:** 8px 12px | **Radius:** 4px **height, ** Inter 14px/500, color #1C1917, bottom margin 6px **label, ** Inter 12px/400, color #57534E, top margin 4px **helper text, ** Inter 12px/400, color #DC2626, top margin 4px **error text.
---

### Chips
- **Filter**: #FAFAFA fill, #1C1917 text, 1px #E7E5E4 border.
- **Filter Active**: #1C1917 fill, #FFFFFF text, no border.
- **Status Success**: #16A34A15 fill, #16A34A text, no border.
- **Status Warning**: #D9770615 fill, #D97706 text, no border.
- **Status Error**: #DC262615 fill, #DC2626 text, no border.
** 4px 12px | **Radius:** 2px | **Font:** 12px/500, uppercase, tracking 0.5px **padding.
---

### Lists
** 48px **row height, ** 8px 16px **padding, ** 1px #F5F5F4 **divider, ** #F4F4F5 **hover background, ** #1C191706 **active background, ** Inter 16px/400 for label, 14px/400 #57534E for description **font.
---

### Checkboxes
** 18px x 18px | **Radius:** 2px **size, ** border 1.5px #D6D3D1, background #FFFFFF **unchecked, ** background #1C1917, border none, checkmark #FFFFFF **checked, ** background #1C1917, dash #FFFFFF **indeterminate, ** 40% opacity, disabled cursor **disabled, ** 8px left of label text **label spacing.
---

### Radio Buttons
** 18px x 18px | **Radius:** full (circle) **size, ** border 1.5px #D6D3D1, background #FFFFFF **unchecked, ** border 2px #1C1917, inner dot 8px #1C1917 **selected, ** 40% opacity, disabled cursor **disabled, ** 8px left of label text **label spacing.
---

### Tooltips
** #1C1917 **background, ** #FAFAFA, Inter 12px/400 **text, ** 6px 10px | **Radius:** 4px **padding, ** 6px triangle matching background **arrow, ** 220px **max width, ** 150ms show, 0ms hide **delay.
---

## Do's and Don'ts

1. **Do** use the Charcoal + White contrast as the primary visual rhythm; Accent Blue is reserved for interactive elements only.
2. **Do** lean on clean grid layouts that echo architectural floor plans and structured data tables.
3. **Do** use subtle radius (4px) consistently; sharper corners reinforce the modern, urban identity.
4. **Don't** introduce warm or playful colors -- UrbanLoft is strictly professional and architectural.
5. **Don't** use decorative fonts or rounded display type; Space Grotesk's geometric precision is intentional.
6. **Do** use uppercase chip labels with tracking for a polished, institutional feel.
7. **Don't** clutter property detail pages; use progressive disclosure and tabbed sections.
8. **Do** include high-quality architectural photography with minimal filters.
9. **Don't** use heavy drop shadows; the subtle elevation system is deliberate.
10. **Do** ensure data tables for lease terms and financials use JetBrains Mono for tabular numerals.
