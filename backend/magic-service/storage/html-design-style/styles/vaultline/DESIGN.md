# VaultLine
*Institutional, navy-and-gold, established — heritage you can bank on.*

## Overview

VaultLine is a design system for traditional banking and wealth management portals. It draws on the visual language of established financial institutions: deep navy foundations, restrained gold accents, and serif headlines that convey authority and permanence. The system prioritizes trust, clarity, and conservative elegance over trendy aesthetics. Subtle shadows and minimal radii reflect an institution that values substance over decoration.

---

## Colors

- **Primary Navy** (#1E3A5F): Primary actions, headers, navigation
- **Secondary Gold** (#C49A2A): Accents, highlights, premium indicators
- **Tertiary Ivory** (#FFFDF7): Backgrounds, surface tints, soft contrast
- **Neutral Cool Gray** (#9CA3AF): Muted text, borders, inactive elements
- **Background** (#FFFDF7): Page background (ivory tint)
- **Surface** (#FFFFFF): Cards, modals, panels
- **Success** (#16A34A): Successful transactions, positive
- **Warning** (#CA8A04): Pending actions, attention needed
- **Error** (#DC2626): Failed transactions, critical alerts
- **Info** (#2563EB): Informational messages, tips

## Typography

- **Headline Font**: DM Serif Display
- **Body Font**: Inter
- **Mono Font**: IBM Plex Mono

- **Display**: DM Serif Display 40px regular, 1.15 line height, 0.01em tracking
- **Headline**: DM Serif Display 30px regular, 1.2 line height, 0.005em tracking
- **Subhead**: DM Serif Display 22px regular, 1.3 line height
- **Body Large**: Inter 18px regular, 1.6 line height
- **Body**: Inter 16px regular, 1.6 line height, 0.01em tracking
- **Body Small**: Inter 14px regular, 1.5 line height, 0.01em tracking
- **Caption**: Inter 12px medium, 1.4 line height, 0.02em tracking
- **Overline**: Inter 11px semibold, 1.4 line height, 0.08em tracking
- **Code**: IBM Plex Mono 14px regular, 1.6 line height

---

## Spacing

- **Base unit:** 8px
- **Scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96
- **Component padding:** 16px horizontal, 12px vertical (buttons/inputs)
- **Section spacing:** 48px between major sections, 24px between related groups

## Border Radius

- **None** (0px): Data tables, hero banners
- **Small** (2px): Badges, inline tags
- **Medium** (4px): Cards, inputs, buttons, modals
- **Large** (6px): Dialogs, feature panels
- **XL** (8px): Hero containers, wide cards
- **Full** (9999px): Status dots, avatar circles

## Elevation

**Philosophy:** Conservative, subtle shadows that suggest depth without drawing attention. The design conveys stability; surfaces feel solid and grounded, not floating.
- **Subtle**: 1px offset, 3px blur, #1E293B at 4%; 1px offset, 2px blur, #1E293B at 2%
- **Medium**: 4px offset, 8px blur, #1E293B at 6%; 2px offset, 4px blur, #1E293B at 3%
- **Large**: 8px offset, 24px blur, #1E293B at 8%; 4px offset, 8px blur, #1E293B at 4%
- **Overlay**: 16px offset, 48px blur, #1E293B at 12%
- **Gold**: 2px offset, 8px blur, #C49A2A at 15%

## Components

### Buttons
#### Variants
- **Primary**: #1E3A5F fill, #FFFFFF text, no border, #162D4A fill, 4px radius, Subtle shadow. Hover: #FFFFFF.
- **Secondary**: #FFFFFF fill, #1E3A5F text, 1px #1E3A5F border, #F9F7F2 fill, 4px radius, no shadow. Hover: #162D4A.
- **Ghost**: transparent fill, #1E3A5F text, no border, #F9F7F2 fill, 4px radius, no shadow. Hover: #162D4A.
- **Destructive**: #DC2626 fill, #FFFFFF text, no border, #B91C1C fill, 4px radius, Subtle shadow. Hover: #FFFFFF.
#### Sizes
Sizes: Small (32px, 14px, 13px, 600), Medium (40px, 20px, 14px, 600), Large (48px, 28px, 16px, 600).
#### Disabled State
0.4 opacity.
- disabled cursor
- No shadow, no hover change

### Cards
- **Default**: #FFFFFF fill, 1px #E2DFD5 border, 4px radius, Subtle shadow, 24px padding.
- **Elevated**: #FFFFFF fill, no border, 4px radius, Medium shadow, 24px padding.
2px outline #1E3A5F offset 2px focus-visible. Hover: shadow transitions to next level (200ms ease).

### Inputs
#### Text Input
- **Default**: #FFFFFF fill, 1px #E2DFD5 border, #1E293B text, no shadow.
- **Hover**: #FFFFFF fill, 1px #9CA3AF border, #1E293B text, no shadow.
- **Focus**: #FFFFFF fill, 2px #1E3A5F border, #1E293B text, Subtle shadow.
- **Error**: #FFFFFF fill, 2px #DC2626 border, #1E293B text, no shadow.
- **Disabled**: #F9F7F2 fill, 1px #F1EFE7 border, #9CA3AF text, no shadow.
4px corners. 40px tall, 10px/14px padding, ** 13px / 600 weight / #1E293B / 4px bottom margin **label, ** 12px / 400 weight / #475569 / 4px top margin **helper text.

### Chips
#### Filter Chip
#F9F7F2 fill, #475569 / 13px / 500 weight text, 1px #E2DFD5 border, 4px corners. 6px/12px padding. Active: Background #1E3A5F, Text #FFFFFF, Border none.
#### Status Chip
4px corners. 11px / 600 weight / uppercase. Background #F0FDF4, Text #16A34A completed, Background #FEFCE8, Text #CA8A04 pending, Background #FEF2F2, Text #DC2626 failed, Background #EFF6FF, Text #2563EB processing, 4px/10px padding.

### Lists
#### Default Item
15px / 400 / #1E293B text. 48px tall, 12px/16px padding, 1px #F1EFE7 (inset 16px left) divider, 13px / 400 / #475569 secondary text. Hover: Background #F9F7F2. Selected: Background #EFF6FF, left border 3px #1E3A5F.

### Checkboxes
18px x 18px, 2px #CBD5E1 border, 2px corners. Checked: Background #1E3A5F, border #1E3A5F, checkmark #FFFFFF. Indeterminate: Background #1E3A5F, dash #FFFFFF. Disabled: Background #F9F7F2, border #E2DFD5, 45% opacity. Labels in 15px / 400 / #1E293B 8px left gap.

### Radio Buttons
18px x 18px, 2px #CBD5E1 border. Selected: Border #1E3A5F, inner dot 9px #1E3A5F. Disabled: Border #E2DFD5, 45% opacity. Labels in 15px / 400 / #1E293B 8px left gap.

### Tooltips
#1E293B fill, #F8FAFC / 13px / 400 weight text, 4px corners. 8px/12px padding, 240px max width, 6px triangle, matching background arrow, 350ms show, 100ms hide delay, fade + 4px translateY, 150ms ease animation.
---

## Do's and Don'ts

1. **Do** display trust signals prominently: security badges, FDIC notices, encryption indicators near sensitive actions.
2. **Do** show security indicators (lock icons, session timers, last-login timestamps) consistently in headers and forms.
3. **Don't** overuse the gold accent (#C49A2A); reserve it for premium features, key metrics, and selective emphasis.
4. **Do** format all monetary values with proper locale-aware formatting (e.g., `$1,234,567.89`) using `IBM Plex Mono` for tabular alignment.
5. **Do** use the serif headline font (`DM Serif Display`) only for Display, Headline, and Subhead levels to maintain institutional gravitas without competing with body text.
6. **Don't** use casual language or playful copy; maintain a professional, reassuring tone throughout all interfaces.
7. **Do** provide clear transaction status trails: initiated, processing, completed, or failed, with timestamps at every stage.
8. **Don't** auto-navigate away from transaction confirmation screens; let users review and explicitly dismiss.
9. **Do** use restrained animation (150-200ms ease) limited to state transitions; avoid decorative motion.
10. **Don't** place destructive actions (account closure, large transfers) near routine actions without spatial separation and distinct styling.
