# InsureShield
Protective, reassuring, clear -- coverage you can actually understand.

## Overview

InsureShield is a trustworthy, accessible design system built for insurance quote and claims management platforms. It uses a dependable blue paired with action-oriented orange and affirming green to guide users through complex policy decisions with confidence. The system prioritizes plain language, step-by-step guidance, and comparison-friendly layouts. Every component is designed to demystify insurance and make users feel protected, not confused.

## Colors

- **Primary** (#2563EB): Blue -- CTAs, navigation, trust anchors
- **Secondary** (#EA580C): Orange -- attention, important actions, quotes
- **Tertiary** (#059669): Green -- active coverage, approved claims
- **Neutral** (#64748B): Slate -- secondary text, borders, metadata
- **Background** (#F8FAFC): App background, page canvas
- **Surface** (#FFFFFF): Cards, form panels, modals
- **Success** (#059669): Approved claims, active policies
- **Warning** (#D97706): Pending review, expiring policies
- **Error** (#DC2626): Denied claims, lapsed coverage
- **Info** (#2563EB): Explanations, tips, help banners

## Typography

- **Headline Font**: Bitter
- **Body Font**: Open Sans
- **Mono Font**: Fira Code

- **Display**: Bitter 34px bold, 1.2 line height, 0.015em tracking
- **Headline**: Bitter 26px bold, 1.25 line height, 0.01em tracking
- **Subhead**: Open Sans 20px semibold, 1.35 line height
- **Body Large**: Open Sans 18px regular, 1.6 line height
- **Body**: Open Sans 16px regular, 1.6 line height, 0.005em tracking
- **Body Small**: Open Sans 14px regular, 1.55 line height, 0.005em tracking
- **Caption**: Open Sans 12px semibold, 1.4 line height, 0.02em tracking
- **Overline**: Open Sans 11px bold, 1.2 line height, 0.06em tracking
- **Code**: Fira Code 14px regular, 1.5 line height

## Spacing

- **Base unit:** 8px
- **Scale:** 8 / 16 / 24 / 32 / 40 / 48 / 64 / 80 / 96
- **Component padding:** 16px horizontal, 12px vertical
- **Section spacing:** 40px between wizard steps, 24px between form groups

## Border Radius

- **None** (0px): Dividers, comparison table cells
- **Small** (4px): Badges, chips, inline tags
- **Medium** (8px): Buttons, inputs, cards
- **Large** (12px): Modals, wizard panels
- **XL** (16px): Hero sections, quote summary cards
- **Full** (9999px): Avatars, step indicators, toggles

## Elevation

**Philosophy:** Subtle, trust-building shadows that gently lift important content. Shadows should never feel aggressive -- the design should evoke safety and stability.
- **Subtle**: 1px offset, 3px blur, #0F172A at 6%
- **Medium**: 4px offset, 12px blur, #0F172A at 8%
- **Large**: 8px offset, 24px blur, #0F172A at 10%
- **Overlay**: 16px offset, 40px blur, #0F172A at 15%

## Components

### Buttons
#### Variants
- **Primary**: #2563EB fill, #FFFFFF text, no border. Hover: #1D4ED8, shadow Subtle.
- **Secondary**: transparent fill, #2563EB text, 1.5px #2563EB border. Hover: bg #2563EB0F, border darker.
- **Ghost**: transparent fill, #475569 text, no border. Hover: bg #F1F5F9, text #0F172A.
- **Destructive**: #DC2626 fill, #FFFFFF text, no border. Hover: #B91C1C.
#### Sizes
Sizes: Small (32px, 8px 16px, 13px, 8px), Medium (40px, 10px 20px, 15px, 8px), Large (48px, 14px 28px, 17px, 8px).
#### Disabled State
0.5 opacity.
- disabled cursor
- No shadow on hover

### Cards
- **Background**: #FFFFFF default, #FFFFFF elevated.
- **Border**: 1px #E2E8F0 default.
- **Radius**: 8px default, 12px elevated.
- **Padding**: 20px default, 24px elevated.
- **Shadow**: 1px offset, 3px blur, #0F172A at 6% default, 0 4px 12px #0F172A at 8% elevated.
- **Hover**: border #CBD5E1 default, shadow upgrades to Large elevated.

### Inputs
#### Text Input
- **Default**: 1.5px #CBD5E1 border, #FFFFFF fill, #0F172A text, no shadow.
- **Hover**: 1.5px #94A3B8 border, #FFFFFF fill, #0F172A text, no shadow.
- **Focus**: 1.5px #2563EB border, #FFFFFF fill, #0F172A text, 3px ring #2563EB at 15% shadow.
- **Error**: 1.5px #DC2626 border, #FFFFFF fill, #0F172A text, 3px ring #DC2626 at 12% shadow.
- **Disabled**: 1.5px #E2E8F0 border, #F8FAFC fill, #94A3B8 text, no shadow.
** 44px **height, ** 12px 16px **padding, ** 8px **radius, ** 14px / 600 / #475569, 6px below **label, ** 13px / 400 / #64748B, 4px above **helper text.

### Chips
#### Filter Chip
** #F1F5F9 **background, ** #475569 / 13px / 500 **text, ** 1px #E2E8F0 **border, ** 4px **radius, ** 6px 12px **padding, ** bg #2563EB0F, border #2563EB, text #2563EB **active.
#### Status Chip
** bg #0596691A, text #059669, border #05966933 **active, ** bg #D977061A, text #D97706, border #D9770633 **pending, ** bg #DC26261A, text #DC2626, border #DC262633 **lapsed.

### Lists
#### Default Item
** 52px **height, ** 12px 16px **padding, ** 1px #E2E8F0 **divider, ** bg #F8FAFC **hover, ** bg #2563EB0A, left 3px #2563EB **selected, ** 16px / 400 / #0F172A **font.

### Checkboxes
** 20px **size, ** 1.5px #CBD5E1 **border, ** 4px **radius, ** bg #2563EB, border #2563EB, white checkmark **checked, ** bg #2563EB, white dash **indeterminate, ** 50% opacity, disabled cursor **disabled, ** 16px / 400 / #0F172A, 10px gap **label.

### Radio Buttons
** 20px **size, ** 1.5px #CBD5E1 **border, ** border #2563EB, inner dot #2563EB (10px) **selected, ** 50% opacity, disabled cursor **disabled, ** 16px / 400 / #0F172A, 10px gap **label.

### Tooltips
** #0F172A **background, ** #F1F5F9 / 13px / 400 **text, ** 8px 14px **padding, ** 6px **radius, ** 280px **max width, ** 6px, same background **arrow, ** 400ms show, 100ms hide **delay.

## Do's and Don'ts

1. **Do** use plain, jargon-free language -- "What you pay each month" instead of "premium."
2. **Do** structure complex processes as step-by-step wizards with a visible progress bar.
3. **Do** provide side-by-side coverage comparisons with clearly highlighted differences.
4. **Don't** bury critical policy details in footnotes or collapsed sections; surface key terms upfront.
5. **Do** include contextual help tooltips on insurance-specific terms the user might not understand.
6. **Don't** use urgency-driven dark patterns ("Only 2 left!") to pressure quote completion.
7. **Do** summarize policy coverage in clear, scannable bullet points rather than dense paragraphs.
8. **Don't** auto-select coverage add-ons; let users opt in deliberately to build trust.
9. **Do** use the Orange secondary color for important calls to action like "Get a Quote" and "File a Claim."
10. **Don't** require account creation before showing a quote; reduce friction to build confidence.
