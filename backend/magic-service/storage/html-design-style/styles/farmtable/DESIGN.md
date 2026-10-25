# FarmTable Design System

## Overview

FarmTable is a rustic, farm-to-table design system built for local food sourcing and farm-to-table platforms. It embraces authenticity and honesty through earthy tones, sturdy slab-serif typography, and a flat-with-borders elevation model. Every element reflects the transparency and groundedness of knowing where your food comes from.

---

## Colors

- **Primary** (#92400E): Primary actions, headings
- **Secondary** (#4D7C0F): Farm tags, organic badges
- **Tertiary** (#0284C7): Links, informational accents
- **Background** (#FAFAF5): Page background
- **Surface** (#FFFFFF): Cards, panels
- **Success** (#059669): In season, available
- **Warning** (#D97706): Limited supply
- **Error** (#DC2626): Out of season, unavailable
- **Info** (#0284C7): Farm origin, certifications

## Typography

- **Headline Font**: Arvo
- **Body Font**: Open Sans
- **Mono Font**: Fira Code

- **h1**: 30px bold, 38px line height. Page titles.
- **h2**: 24px bold, 32px line height. Section headings.
- **h3**: 20px bold, 28px line height. Card headings.
- **h4**: 16px bold, 24px line height. Subsection labels.
- **body**: 15px regular, 24px line height. General content.
- **small**: 13px regular, 20px line height. Meta, distances, dates.
- **mono**: 13px regular, 20px line height. Weights, lot numbers.

---

## Spacing

Base unit: **8px**
- **xs**: 4px — Tight gaps, inline
- **sm**: 8px — Between elements
- **md**: 16px — Component padding
- **lg**: 24px — Card padding
- **xl**: 32px — Section gaps
- **2xl**: 48px — Page section spacing
- **3xl**: 64px — Layout margins

## Border Radius

- **None** (0px): —
- **sm** (4px): Tags, small elements
- **md** (8px): Buttons, cards, inputs
- **lg** (12px): Modals, image containers
- **full** (9999px): Badges, pills

## Elevation

Flat with borders is the primary elevation model. Shadows used only for overlays.
- **sm**: 1px offset, 2px blur, #000000 at 4%. Dropdowns.
- **md**: 2px offset, 6px blur, #000000 at 6%. Popovers.
- **lg**: 4px offset, 16px blur, #000000 at 10%. Modals.
- **focus**: 3px ring #92400E at 20%. Focus ring.

## Components

### Buttons
#### Variants
- ****Primary****: #92400E fill, #FFFFFF text, no border, #78350F fill.
- ****Secondary****: Transparent fill, #92400E text, 1.5px #92400E border, #FEF3C7 fill.
- ****Ghost****: Transparent fill, #57534E text, no border, #F5F5F0 fill.
- ****Destructive****: #DC2626 fill, #FFFFFF text, no border, #B91C1C fill.
#### Sizes
Sizes: sm (6px 12px, 13px, 32px), md (8px 16px, 15px, 40px), lg (10px 24px, 16px, 48px).
#### Disabled State
0.45 opacity, disabled cursor.
- No hover or focus transitions

### Cards
- ****Default****: #FFFFFF fill, 1.5px #D6D3D1 border, no shadow, 8px radius.
- ****Elevated****: #FFFFFF fill, 1.5px #D6D3D1 border, sm shadow, 8px radius.
24px padding, image top with `8px 8px 0 0` radius, location badge overlay farm card variant, Arvo 700, bottom border 1px #D6D3D1 header.

### Inputs
- **Default**: #D6D3D1 border, #FFFFFF fill, no shadow.
- **Hover**: #A8A29E border, #FFFFFF fill, no shadow.
- **Focus**: #92400E border, #FFFFFF fill, focus` ring shadow.
- **Error**: #EF4444 border, #FEF2F2 fill, no shadow.
- **Disabled**: #E7E5E4 border, #FAFAF9 fill, no shadow.
40px, padding: 8px 12px, radius: 8px tall, Open Sans 600, 14px, `text-primary`, 4px bottom margin **label**, Open Sans 400, 13px, `text-tertiary`, 4px margin-top; errors use `error` color **helper text**.

### Chips
- ****Filter****: #F5F5E8 fill, #92400E text, 1px #D6D3D1 border, pill shape.
- ****Status****: varies fill, varies text, no border, pill shape.
Status chip semantic mapping:
bg #DCFCE7, text #059669 in season, bg #FEF3C7, text #D97706 limited, bg #FEE2E2, text #DC2626 out of season, bg #DBEAFE, text #0284C7 certified.

### Lists
Open Sans 400 15px. 48px row height, 10px/16px padding, 1px #D6D3D1 divider. Hover: background #F5F5E8. Selected: background #FEF3C7, left border 3px #92400E.

### Checkboxes
18px square, radius: 4px. Unchecked: border 2px #D6D3D1, background white. Checked: background #92400E, border #92400E, white checkmark. Indeterminate: background #92400E, white dash. Disabled: 45% opacity. Labels in 8px gap Open Sans 400 15px.

### Radio Buttons
18px circle. Unchecked: border 2px #D6D3D1, background white. Selected: border 2px #92400E, inner dot 10px #92400E. Disabled: 45% opacity. Labels in 8px gap Open Sans 400 15px.

### Tooltips
#1C1917 fill, #FFFFFF, Open Sans 400, 13px text, 4px corners, `sm` shadow. 6px/10px padding, 6px arrow, 240px max width.
---

## Do's and Don'ts

1. **Do** use Arvo slab-serif for all headings to convey the sturdy, honest character of the brand.
2. **Do** rely on borders rather than shadows for card elevation — flat design reinforces authenticity.
3. **Don't** introduce glossy gradients or high-contrast neon colors; they contradict the earthy palette.
4. **Do** display farm origin, distance, and certifications prominently on every product card.
5. **Don't** hide seasonal availability information — it should be visible as a status chip at all times.
6. **Do** use the tertiary sky blue exclusively for links and informational badges, never as decoration.
7. **Don't** overcrowd product listings; each item should have space for farm name, location, and description.
8. **Do** include map or distance indicators when displaying farm/source information.
9. **Don't** auto-crop farm photography — show the authentic context of the product origin.
10. **Do** use monospace for weights, lot numbers, and pricing to ensure legibility and alignment.
