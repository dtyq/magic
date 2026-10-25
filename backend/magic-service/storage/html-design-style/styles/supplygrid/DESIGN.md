# SupplyGrid Design System

## Overview

SupplyGrid is an operational, logistics-focused design system tailored for supply chain management and logistics dashboards. It prioritizes data density and scannability over decorative elements. The compact spacing and flat aesthetic keep complex shipment tables, route maps, and inventory grids readable under pressure.

---

## Colors

- **Primary** (#475569): Nav, headers, primary actions
- **Secondary** (#2563EB): Links, selected routes
- **Tertiary** (#D97706): Warnings, delayed shipments
- **Background** (#F8FAFC): Page background
- **Surface** (#FFFFFF): Cards, panels
- **Success** (#16A34A): Delivered, in stock
- **Warning** (#D97706): Delayed, low stock
- **Error** (#DC2626): Lost, critical failure
- **Info** (#2563EB): In transit, informational

## Typography

- **Headline Font**: Roboto Slab
- **Body Font**: Roboto
- **Mono Font**: IBM Plex Mono

- **h1**: 28px bold, 36px line height. Page titles.
- **h2**: 22px semibold, 28px line height. Section headings.
- **h3**: 18px semibold, 24px line height. Card headings.
- **h4**: 15px semibold, 20px line height. Table group headings.
- **body**: 13px regular, 20px line height. General content.
- **small**: 11px regular, 16px line height. Table cells, metadata.
- **mono**: 12px regular, 18px line height. Tracking codes, IDs.

---

## Spacing

Base unit: **4px** (compact)
- **xs**: 4px — Table cell padding
- **sm**: 8px — Inline spacing, icon gaps
- **md**: 12px — Component internal padding
- **lg**: 16px — Card padding
- **xl**: 24px — Section gaps
- **2xl**: 32px — Panel spacing
- **3xl**: 48px — Layout margins

## Border Radius

- **None** (0px): Tables, data grids
- **sm** (2px): Tags, small elements
- **md** (4px): Buttons, cards, inputs
- **lg** (8px): Modals, panels
- **full** (9999px): Status dots, pills

## Elevation

Flat with borders is the primary elevation method. Shadows are used sparingly.
- **sm**: 1px offset, 2px blur, #000000 at 4%. Subtle lift.
- **md**: 2px offset, 4px blur, #000000 at 6%. Dropdowns.
- **lg**: 4px offset, 12px blur, #000000 at 8%. Modals.
- **focus**: 2px ring #2563EB at 30%. Focus ring.

## Components

### Buttons
#### Variants
- ****Primary****: #475569 fill, #FFFFFF text, no border, #334155 fill.
- ****Secondary****: Transparent fill, #2563EB text, 1px #2563EB border, #EFF6FF fill.
- ****Ghost****: Transparent fill, #64748B text, no border, #F1F5F9 fill.
- ****Destructive****: #DC2626 fill, #FFFFFF text, no border, #B91C1C fill.
#### Sizes
Sizes: sm (4px 8px, 11px, 28px), md (6px 12px, 13px, 36px), lg (8px 16px, 14px, 44px).
#### Disabled State
0.45 opacity, disabled cursor.
- No hover or focus transitions

### Cards
- ****Default****: #FFFFFF fill, 1px #E2E8F0 border, no shadow, 4px radius.
- ****Elevated****: #FFFFFF fill, 1px #E2E8F0 border, sm shadow, 4px radius.
16px padding, Roboto Slab 600, border-bottom 1px #E2E8F0 header.

### Inputs
- **Default**: #E2E8F0 border, #FFFFFF fill, no shadow.
- **Hover**: #94A3B8 border, #FFFFFF fill, no shadow.
- **Focus**: #2563EB border, #FFFFFF fill, focus` ring shadow.
- **Error**: #EF4444 border, #FEF2F2 fill, no shadow.
- **Disabled**: #E2E8F0 border, #F8FAFC fill, no shadow.
36px, padding: 6px 10px, radius: 4px tall, Roboto 500, 12px, `text-secondary`, uppercase, tracking 0.5px, 4px bottom margin **label**, Roboto 400, 11px, `text-tertiary`, 2px margin-top; errors use `error` color **helper text**.

### Chips
- ****Filter****: #F1F5F9 fill, #475569 text, 1px #E2E8F0 border, 4px radius.
- ****Status****: varies fill, varies text, no border, pill shape.
Status chip semantic mapping:
bg #DCFCE7, text #16A34A delivered, bg #DBEAFE, text #2563EB in transit, bg #FEF3C7, text #D97706 delayed, bg #FEE2E2, text #DC2626 lost.

### Lists
Roboto 400 13px. 40px row height, 8px/12px padding, 1px #E2E8F0 divider. Hover: background #F1F5F9. Selected: background #EFF6FF, left border 2px #2563EB.

### Checkboxes
16px square, radius: 2px. Unchecked: border 1.5px #CBD5E1, background white. Checked: background #475569, border #475569, white checkmark. Indeterminate: background #475569, white dash. Disabled: 45% opacity. Labels in 6px gap Roboto 400 13px.

### Radio Buttons
16px circle. Unchecked: border 1.5px #CBD5E1, background white. Selected: border 2px #475569, inner dot 8px #475569. Disabled: 45% opacity. Labels in 6px gap Roboto 400 13px.

### Tooltips
#0F172A fill, #FFFFFF, Roboto 400, 11px text, 2px corners, `sm` shadow. 4px/8px padding, 4px arrow, 200px max width.
---

## Do's and Don'ts

1. **Do** use monospace font for all tracking numbers, SKUs, and shipment IDs.
2. **Do** keep tables compact — favor `small` and `body` type sizes for data rows.
3. **Don't** add unnecessary shadows — use borders as the primary elevation method.
4. **Do** color-code shipment statuses consistently using the semantic palette.
5. **Don't** use large border-radius values — the 4px subtle radius maintains a professional, operational tone.
6. **Do** design for data density; operators scan dozens of rows at a time.
7. **Don't** hide critical route or inventory information behind hover tooltips alone.
8. **Do** provide inline filters and sort controls above every data table.
9. **Don't** use tertiary amber as a background fill — reserve it for warning badges only.
10. **Do** always show timestamps in UTC or with explicit timezone labels.
