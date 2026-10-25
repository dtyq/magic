# HealHub
*Friendly, colorful, community-health — care that connects everyone.*

## Overview

HealHub is a vibrant design system for community health platforms and telehealth applications. It embraces color and warmth to make healthcare feel less intimidating and more inclusive. The system balances professional medical credibility with the approachability of consumer-grade apps, creating interfaces that diverse communities can navigate with confidence. Material-style shadows provide familiar, grounded depth across all surfaces.

---

## Colors

- **Primary Teal** (#0D9488): Primary actions, headers, key indicators
- **Secondary Orange** (#FB923C): Secondary actions, highlights, warmth
- **Tertiary Purple** (#A855F7): Accents, category tags, special features
- **Neutral Gray** (#6B7280): Muted text, borders, inactive elements
- **Background** (#FFFFFF): Page background
- **Surface** (#FFFFFF): Cards, modals, drawers
- **Success** (#059669): Completed appointments, confirmations
- **Warning** (#D97706): Reminders, schedule conflicts
- **Error** (#DC2626): Errors, cancellations, failures
- **Info** (#2563EB): Tips, informational banners

## Typography

- **Headline Font**: Lexend
- **Body Font**: DM Sans
- **Mono Font**: Fira Code

- **Display**: Lexend 40px bold, 1.2 line height, 0.02em tracking
- **Headline**: Lexend 30px bold, 1.25 line height, 0.01em tracking
- **Subhead**: Lexend 22px semibold, 1.3 line height
- **Body Large**: DM Sans 18px regular, 1.6 line height
- **Body**: DM Sans 16px regular, 1.6 line height, 0.01em tracking
- **Body Small**: DM Sans 14px regular, 1.5 line height, 0.01em tracking
- **Caption**: DM Sans 12px medium, 1.4 line height, 0.02em tracking
- **Overline**: DM Sans 11px bold, 1.4 line height, 0.08em tracking
- **Code**: Fira Code 14px regular, 1.6 line height

---

## Spacing

- **Base unit:** 8px
- **Scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96
- **Component padding:** 16px horizontal, 12px vertical (buttons/inputs)
- **Section spacing:** 48px between major sections, 24px between related groups

## Border Radius

- **None** (0px): Full-bleed images, dividers
- **Small** (6px): Badges, small indicators
- **Medium** (12px): Cards, inputs, buttons
- **Large** (16px): Modals, large panels
- **XL** (24px): Hero sections, feature cards
- **Full** (9999px): Category pills, avatars, toggles

## Elevation

**Philosophy:** Material-style layered shadows that establish clear visual hierarchy. Each elevation level represents a distinct interaction plane.
- **Subtle**: 1px offset, 2px blur, #000000 at 5%
- **Medium**: 4px offset, 6px blur, -1px spread, #000000 at 10%; 2px offset, 4px blur, -2px spread, #000000 at 10%
- **Large**: 10px offset, 15px blur, -3px spread, #000000 at 10%; 4px offset, 6px blur, -4px spread, #000000 at 10%
- **Overlay**: 20px offset, 25px blur, -5px spread, #000000 at 10%; 8px offset, 10px blur, -6px spread, #000000 at 10%
- **Colored**: 4px offset, 14px blur, #0D9488 at 25%

## Components

### Buttons
#### Variants
- **Primary**: #0D9488 fill, #FFFFFF text, no border, #0F766E fill, 12px radius, Colored shadow. Hover: #FFFFFF.
- **Secondary**: #FFF7ED fill, #FB923C text, 1px #FB923C border, #FFEDD5 fill, 12px radius, no shadow. Hover: #EA8030.
- **Ghost**: transparent fill, #0D9488 text, no border, #F0FDFA fill, 12px radius, no shadow. Hover: #0F766E.
- **Destructive**: #DC2626 fill, #FFFFFF text, no border, #B91C1C fill, 12px radius, Subtle shadow. Hover: #FFFFFF.
#### Sizes
Sizes: Small (34px, 14px, 14px, 600), Medium (42px, 20px, 15px, 600), Large (50px, 28px, 16px, 600).
#### Disabled State
0.4 opacity.
- disabled cursor
- No shadow, no hover change

### Cards
- **Default**: #FFFFFF fill, 1px #E5E7EB border, 12px radius, Subtle shadow, 20px padding.
- **Elevated**: #FFFFFF fill, no border, 12px radius, Medium shadow, 20px padding.
2px outline #0D9488 offset 2px focus-visible. Hover: transition to Large shadow (200ms ease).

### Inputs
#### Text Input
- **Default**: #FFFFFF fill, 1px #E5E7EB border, #111827 text, no shadow.
- **Hover**: #FFFFFF fill, 1px #9CA3AF border, #111827 text, no shadow.
- **Focus**: #FFFFFF fill, 2px #0D9488 border, #111827 text, Colored shadow.
- **Error**: #FFFFFF fill, 2px #DC2626 border, #111827 text, no shadow.
- **Disabled**: #F9FAFB fill, 1px #F3F4F6 border, #9CA3AF text, no shadow.
12px corners. 44px tall, 12px/16px padding, ** 14px / 600 weight / #111827 / 6px bottom margin **label, ** 12px / 400 weight / #6B7280 / 4px top margin **helper text.

### Chips
#### Filter Chip
#F9FAFB fill, #4B5563 / 13px / 500 weight text, 1px #E5E7EB border, pill shape. 6px/14px padding. Active: Background #0D9488, Text #FFFFFF, Border none.
#### Status Chip
pill shape. 12px / 600 weight. Background #ECFDF5, Text #059669 success, Background #FFFBEB, Text #D97706 warning, Background #EFF6FF, Text #2563EB info, 4px/12px padding. Error: Background #FEF2F2, Text #DC2626.
#### Category Pill (special variant)
#F3E8FF fill, #A855F7 / 12px / 600 weight text, pill shape. 4px/14px padding.

### Lists
#### Default Item
16px / 400 / #111827 text. 56px tall, 12px/16px padding, 1px #F3F4F6 (inset 16px left) divider, 14px / 400 / #6B7280 secondary text. Hover: Background #F9FAFB. Selected: Background #F0FDFA, left border 3px #0D9488.

### Checkboxes
20px x 20px, 2px #D1D5DB border, 4px corners. Checked: Background #0D9488, border #0D9488, checkmark #FFFFFF. Indeterminate: Background #0D9488, dash #FFFFFF. Disabled: Background #F9FAFB, border #E5E7EB, 50% opacity. Labels in 16px / 400 / #111827 8px left gap.

### Radio Buttons
20px x 20px, 2px #D1D5DB border. Selected: Border #0D9488, inner dot 10px #0D9488. Disabled: Border #E5E7EB, 50% opacity. Labels in 16px / 400 / #111827 8px left gap.

### Tooltips
#1F2937 fill, #FFFFFF / 13px / 400 weight text, 8px corners. 8px/12px padding, 260px max width, 6px triangle, matching background arrow, 350ms show, 100ms hide delay, fade + 4px translateY, 150ms ease animation.
---

## Do's and Don'ts

1. **Do** use inclusive imagery and illustrations that represent diverse communities, ages, and abilities.
2. **Do** design clear, step-by-step scheduling flows that minimize the number of taps to book an appointment.
3. **Don't** bury appointment reminder settings; surface them prominently in user profiles and booking confirmations.
4. **Do** build layouts with multilingual support in mind; allow 30-40% text expansion for translations.
5. **Do** use the teal primary for positive health actions and the orange secondary for engagement and warmth.
6. **Don't** overload screens with medical jargon; use plain language with optional "learn more" expansions.
7. **Do** provide clear visual feedback for telehealth connection states (connecting, live, poor connection, disconnected).
8. **Don't** use purple (#A855F7) for status indicators; reserve it for categories and feature accents only.
9. **Do** ensure tap targets are at least 44x44px for accessibility, especially for elderly users.
10. **Don't** auto-dismiss important health notifications; require explicit user acknowledgment.
