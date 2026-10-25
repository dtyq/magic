# CreateSpace Design System

## Overview

CreateSpace is a colorful, expressive, and grid-heavy design system designed for multi-disciplinary creative agency websites. It combines bold color blocks with asymmetric layouts and glassmorphism-inspired panels to create a dynamic, portfolio-first experience. The system embraces contrast, layering, and confident typography to showcase creative work across disciplines -- from branding and illustration to motion and product design.

---

## Colors

- **Color Primary** (#E11D48): Primary actions, hero accents
- **Color Secondary** (#2563EB): Secondary actions, links
- **Color Tertiary** (#FACC15): Highlights, badges, callouts
- **Surface Base** (#FFFFFF): Page background
- **Surface Glass** (#FFFFFF at 65%): Frosted glass panels
- **Color Success** (#16A34A): Form success
- **Color Warning** (#D97706): Deadline warnings
- **Color Error** (#DC2626): Validation errors
- **Color Info** (#2563EB): Informational callouts

## Typography

- **Headline Font**: Poppins
- **Body Font**: DM Sans
- **Mono Font**: Fira Code

- **text-hero**: Poppins 72px extra-bold, 1.05 line height
- **text-h1**: Poppins 48px bold, 1.1 line height
- **text-h2**: Poppins 32px semibold, 1.2 line height
- **text-h3**: Poppins 24px semibold, 1.3 line height
- **text-body-lg**: DM Sans 18px regular, 1.6 line height
- **text-body**: DM Sans 16px regular, 1.6 line height
- **text-caption**: DM Sans 13px medium, 1.5 line height
- **text-mono**: Fira Code 14px regular, 1.5 line height

---

## Spacing

Base unit: **8px**.
- **space-1**: 4px — Tight inline gaps
- **space-2**: 8px — Icon/label spacing
- **space-3**: 16px — Within component groups
- **space-4**: 24px — Card inner padding
- **space-5**: 32px — Between components
- **space-6**: 48px — Section internal padding
- **space-8**: 64px — Between sections
- **space-10**: 80px — Hero-level vertical rhythm

## Border Radius

- **radius-sm** (4px): Small elements, tags
- **radius-md** (8px): Buttons, inputs, chips
- **radius-lg** (16px): Feature cards, panels
- **radius-xl** (24px): Hero cards, modals
- **radius-pill** (9999px): Pills, toggles

## Elevation (Glassmorphism-Inspired)

- **shadow-glass**: 8px offset, 32px blur, #000000 at 8%. Frosted panels.
- **shadow-md**: 4px offset, 16px blur, #000000 at 10%. Raised cards.
- **shadow-lg**: 12px offset, 40px blur, #000000 at 15%. Modals, popovers.
- **shadow-color**: 8px offset, 24px blur, #E11D48 at 25%. Primary accent glow.
- **shadow-focus**: 3px ring #2563EB at 35%. Focus ring.
Glass panels also apply backdrop-filter: blur(16px)` and a `1px #FFFFFF at 30% border.

## Components

### Buttons
Buttons use `border-radius: 8px` with bold color fills and smooth 150ms transitions.
#### Variants
| Variant     | Background  | Text Color  | Border             |
| ----------- | ----------- | ----------- | ------------------ |
| Primary     | #E11D48   | #FFFFFF   | none               |
| Secondary   | #2563EB   | #FFFFFF   | none               |
| Ghost       | transparent | #E11D48   | 1.5px #E11D48    |
| Destructive | #DC2626   | #FFFFFF   | none               |
#### Sizes
| Size   | Height | Padding (h)  | Font Size | Min Width |
| ------ | ------ | ------------ | --------- | --------- |
| Small  | 32px   | 14px         | 13px      | 72px      |
| Medium | 40px   | 20px         | 14px      | 100px     |
| Large  | 48px   | 28px         | 16px      | 140px     |
#### Disabled State
0.4 opacity, `not-allowed` cursor.
- No hover elevation or color shift

### Cards
| Property        | Value                                   |
| --------------- | --------------------------------------- |
| Background      | surface-raised or surface-glass |
| Border          | 1px border-default            |
| Border Radius   | 16px                                    |
| Padding         | 24px                                    |
| Shadow          | shadow-glass                        |
| Hover           | Scale 1.02, shadow-md              |
Glass variant applies `backdrop-filter: blur(16px)` with translucent background.

### Inputs
| State    | Border Color  | Background  | Shadow              |
| -------- | ------------- | ----------- | -------------------- |
| Default  | #D1D5DB     | #FFFFFF   | none                 |
| Hover    | #9CA3AF     | #FFFFFF   | none                 |
| Focus    | #2563EB     | #FFFFFF   | shadow-focus     |
| Error    | #DC2626     | #FEF2F2   | 3px ring #DC2626 at 20% |
| Disabled | #E5E7EB     | #F3F4F6   | none                 |
1.5px - Border radius: 8px border. 40px tall, 14px DM Sans font size.

### Chips
#### Filter Chips
| State    | Background  | Text Color | Border             |
| -------- | ----------- | ---------- | ------------------ |
| Default  | #F3F4F6   | #1F2937  | 1px #E5E7EB     |
| Selected | #E11D48   | #FFFFFF  | 1px #E11D48     |
| Hover    | #E5E7EB   | #1F2937  | 1px #D1D5DB     |
#### Status Chips
| Type       | Background  | Text Color | Icon     |
| ---------- | ----------- | ---------- | -------- |
| Active     | #DBEAFE   | #1E40AF  | Pulse    |
| Complete   | #DCFCE7   | #166534  | Check    |
| In Review  | #FEF3C7   | #92400E  | Clock    |
| Archived   | #F3F4F6   | #6B7280  | Archive  |
9999px border radius. 13px DM Sans 500. 30px tall.

### Lists
| Property          | Value                          |
| ----------------- | ------------------------------ |
| Row height        | 48px                           |
| Padding           | 16px horizontal                |
| Divider           | 1px #E5E7EB           |
| Hover background  | #F3F4F6                      |
| Active background | #FFF1F2                      |
| Border radius     | 8px (container)                |
| Icon size         | 20px, 12px gap from label      |

### Checkboxes
| State     | Fill        | Border          | Check Color |
| --------- | ----------- | --------------- | ----------- |
| Unchecked | #FFFFFF   | 1.5px #D1D5DB | --          |
| Checked   | #E11D48   | 1.5px #E11D48 | #FFFFFF   |
| Disabled  | #F3F4F6   | 1.5px #E5E7EB | #9CA3AF   |
20px, 4px border radius. 150ms ease transition.

### Radio Buttons
| State      | Fill        | Border            | Dot Color   |
| ---------- | ----------- | ----------------- | ----------- |
| Unselected | #FFFFFF   | 1.5px #D1D5DB   | --          |
| Selected   | #FFFFFF   | 1.5px #2563EB   | #2563EB   |
| Disabled   | #F3F4F6   | 1.5px #E5E7EB   | #9CA3AF   |
20px. 10px dot diameter, shadow-focus focus ring.

### Tooltips
| Property     | Value                            |
| ------------ | -------------------------------- |
| Background   | #1F2937                        |
| Text color   | #FFFFFF                        |
| Font size    | 13px DM Sans                     |
| Padding      | 8px 14px                         |
| Border radius| 8px                              |
| Max width    | 240px                            |
| Arrow        | 6px triangle                     |
| Delay        | 200ms show, 50ms hide            |
| Shadow       | shadow-md                    |
---

## Do's and Don'ts

1. **Do** use bold, full-bleed color blocks to create energy and visual rhythm across sections.
2. **Don't** use more than two brand colors in a single component -- reserve tertiary yellow for accents only.
3. **Do** embrace asymmetric grid layouts to showcase creative work in unexpected, dynamic ways.
4. **Do** use expressive, large-scale typography for section headers and project titles.
5. **Don't** let glassmorphism panels obscure important content -- ensure sufficient contrast behind frosted layers.
6. **Do** adopt a portfolio-first layout where project imagery dominates above-the-fold content.
7. **Don't** over-animate. Transitions should be smooth (150-300ms) but not theatrical.
8. **Do** maintain consistent gutter widths (16px or 24px) even in asymmetric layouts for underlying structural coherence.
9. **Don't** default to safe, symmetrical layouts -- the system's identity is rooted in confident visual tension.
10. **Do** test glassmorphism panels across browsers; provide an opaque fallback for unsupported environments.
