# PharmFlow
*Systematic, organized, safety-first — precision that protects patients.*

## Overview

PharmFlow is a compact, safety-oriented design system built for pharmacy management and prescription tracking systems. Every design decision prioritizes error prevention: high-contrast drug interaction warnings, prominent dosage displays, and color-coded safety tiers. The system uses a tight 4px grid to accommodate dense pharmaceutical data without sacrificing scannability. Subtle shadows and medium radii create a clean, systematic interface that pharmacists can trust under pressure.

---

## Colors

- **Primary Blue** (#2563EB): Primary actions, links, navigation
- **Secondary Green** (#059669): Confirmations, verified prescriptions
- **Tertiary Amber** (#D97706): Warnings, interactions, expiring medications
- **Neutral Slate** (#64748B): Muted text, borders, inactive elements
- **Background** (#F8FAFC): Page background
- **Surface** (#FFFFFF): Cards, modals, panels
- **Success** (#059669): Verified Rx, dispensed confirmations
- **Warning** (#D97706): Drug interactions, expiry warnings
- **Error** (#DC2626): Contraindications, critical alerts
- **Info** (#2563EB): Informational labels, system messages

## Typography

- **Headline Font**: Work Sans
- **Body Font**: Inter
- **Mono Font**: Roboto Mono

- **Display**: Work Sans 32px bold, 1.2 line height, 0.02em tracking
- **Headline**: Work Sans 24px bold, 1.25 line height, 0.01em tracking
- **Subhead**: Work Sans 18px semibold, 1.3 line height
- **Body Large**: Inter 16px regular, 1.5 line height
- **Body**: Inter 14px regular, 1.5 line height, 0.01em tracking
- **Body Small**: Inter 13px regular, 1.45 line height, 0.01em tracking
- **Caption**: Inter 11px medium, 1.35 line height, 0.02em tracking
- **Overline**: Inter 10px bold, 1.3 line height, 0.1em tracking
- **Code**: Roboto Mono 13px regular, 1.5 line height

---

## Spacing

- **Base unit:** 4px (compact layouts for pharmaceutical data)
- **Scale:** 2 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48
- **Component padding:** 12px horizontal, 8px vertical (buttons/inputs)
- **Section spacing:** 24px between major sections, 12px between related groups

## Border Radius

- **None** (0px): Data tables, full-width banners
- **Small** (2px): Table cells, inline badges
- **Medium** (6px): Cards, inputs, buttons, modals
- **Large** (8px): Panels, dialogs
- **XL** (12px): Feature containers
- **Full** (9999px): Status pills, avatar circles

## Elevation

**Philosophy:** Subtle, restrained shadows that create clean separation without visual noise. The interface should feel flat and organized, with shadow used only to establish layering.
- **Subtle**: 1px offset, 2px blur, #0F172A at 4%
- **Medium**: 2px offset, 8px blur, #0F172A at 8%
- **Large**: 4px offset, 16px blur, #0F172A at 10%
- **Overlay**: 8px offset, 32px blur, #0F172A at 12%
- **Warning**: 3px ring #D97706 at 20%

## Components

### Buttons
#### Variants
- **Primary**: #2563EB fill, #FFFFFF text, no border, #1D4ED8 fill, 6px radius, Subtle shadow. Hover: #FFFFFF.
- **Secondary**: #FFFFFF fill, #2563EB text, 1px #2563EB border, #EFF6FF fill, 6px radius, no shadow. Hover: #1D4ED8.
- **Ghost**: transparent fill, #475569 text, no border, #F1F5F9 fill, 6px radius, no shadow. Hover: #0F172A.
- **Destructive**: #DC2626 fill, #FFFFFF text, no border, #B91C1C fill, 6px radius, Subtle shadow. Hover: #FFFFFF.
#### Sizes
Sizes: Small (28px, 10px, 12px, 600), Medium (34px, 14px, 13px, 600), Large (40px, 20px, 14px, 600).
#### Disabled State
0.4 opacity.
- disabled cursor
- No shadow, no hover change

### Cards
- **Default**: #FFFFFF fill, 1px #E2E8F0 border, 6px radius, Subtle shadow, 16px padding.
- **Elevated**: #FFFFFF fill, no border, 6px radius, Medium shadow, 16px padding.
2px outline #2563EB offset 2px focus-visible. Hover: border shifts to #94A3B8 (150ms ease).

### Inputs
#### Text Input
- **Default**: #FFFFFF fill, 1px #E2E8F0 border, #0F172A text, no shadow.
- **Hover**: #FFFFFF fill, 1px #94A3B8 border, #0F172A text, no shadow.
- **Focus**: #FFFFFF fill, 2px #2563EB border, #0F172A text, Subtle shadow.
- **Error**: #FFFFFF fill, 2px #DC2626 border, #0F172A text, no shadow.
- **Warning**: #FFFBEB fill, 2px #D97706 border, #0F172A text, Warning shadow.
- **Disabled**: #F8FAFC fill, 1px #F1F5F9 border, #94A3B8 text, no shadow.
6px corners. 34px tall, 8px/12px padding, ** 12px / 600 weight / #0F172A / 4px bottom margin **label, ** 11px / 400 weight / #64748B / 4px top margin **helper text.

### Chips
#### Filter Chip
#F1F5F9 fill, #475569 / 12px / 500 weight text, 1px #E2E8F0 border, 6px corners. 4px/10px padding. Active: Background #2563EB, Text #FFFFFF, Border none.
#### Status Chip
6px corners. 11px / 600 weight / uppercase. Background #ECFDF5, Text #059669, left dot #059669 verified, Background #FFFBEB, Text #D97706, left dot #D97706 interaction, Background #FEF2F2, Text #DC2626, left dot #DC2626 contraindicated, Background #EFF6FF, Text #2563EB, left dot #2563EB pending, 4px/10px padding.

### Lists
#### Default Item
14px / 400 / #0F172A text. 40px tall, 8px/12px padding, 1px #F1F5F9 divider, 12px / 400 / #64748B secondary text. Hover: Background #F8FAFC. Selected: Background #EFF6FF, left border 2px #2563EB.

### Checkboxes
16px x 16px, 2px #CBD5E1 border, 3px corners. Checked: Background #2563EB, border #2563EB, checkmark #FFFFFF. Indeterminate: Background #2563EB, dash #FFFFFF. Disabled: Background #F8FAFC, border #E2E8F0, 45% opacity. Labels in 14px / 400 / #0F172A 6px left gap.

### Radio Buttons
16px x 16px, 2px #CBD5E1 border. Selected: Border #2563EB, inner dot 8px #2563EB. Disabled: Border #E2E8F0, 45% opacity. Labels in 14px / 400 / #0F172A 6px left gap.

### Tooltips
#0F172A fill, #F1F5F9 / 12px / 400 weight text, 4px corners. 6px/10px padding, 240px max width, 5px triangle, matching background arrow, 200ms show, 0ms hide delay, fade + 2px translateY, 100ms ease animation.
---

## Do's and Don'ts

1. **Do** display drug interaction warnings with amber background (#FFFBEB) and prominent iconography immediately adjacent to medication names.
2. **Do** present dosage information in large, high-contrast monospaced text (Roboto Mono`, 18px+, #0F172A) to minimize misreading.
3. **Don't** use red (#DC2626) for anything other than contraindications and critical safety alerts; it must never lose its urgency.
4. **Do** provide clear, dedicated barcode/scan target areas with generous padding and high-contrast borders for handheld scanner workflows.
5. **Do** implement safety-critical color coding consistently: green = verified, amber = warning/interaction, red = contraindicated/critical.
6. **Don't** allow destructive actions (dispensing, deleting prescriptions) without a confirmation dialog that restates the action.
7. **Do** use compact layouts with the 4px grid, but maintain at least 8px padding around interactive elements for reliable touch targets.
8. **Don't** truncate drug names or dosage instructions; use wrapping or expandable rows instead.
9. **Do** surface expiration dates with progressive urgency: 90 days = info, 30 days = amber, 7 days = red.
10. **Don't** auto-complete drug names without explicit user selection from a verified list to prevent prescription errors.
