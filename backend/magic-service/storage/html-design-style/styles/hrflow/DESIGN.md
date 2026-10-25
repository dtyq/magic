# HRFlow Design System

## Overview

HRFlow is a people-focused, warm-professional design system built for HR platforms and employee management systems. It balances approachability with the professionalism required for sensitive workplace data. The warm purple palette and rounded forms convey trust and care, while clean layouts keep complex org structures and workflows easy to navigate.

---

## Colors

- **Primary** (#7C3AED): Primary actions, nav accents
- **Secondary** (#0D9488): Tags, progress indicators
- **Tertiary** (#F97316): Alerts, badges, warmth
- **Background** (#FAFAFA): Page background
- **Surface** (#FFFFFF): Cards, modals
- **Success** (#059669): Approved, completed
- **Warning** (#D97706): Pending review
- **Error** (#EF4444): Rejected, failed
- **Info** (#2563EB): Informational banners

## Typography

- **Headline Font**: Lexend
- **Body Font**: DM Sans
- **Mono Font**: Roboto Mono

- **h1**: 32px bold, 40px line height. Page titles.
- **h2**: 24px semibold, 32px line height. Section headings.
- **h3**: 20px semibold, 28px line height. Card headings.
- **h4**: 16px semibold, 24px line height. Subsection headings.
- **body**: 14px regular, 22px line height. General content.
- **small**: 12px regular, 18px line height. Captions, metadata.
- **mono**: 13px regular, 20px line height. Employee IDs, codes.

---

## Spacing

Base unit: **8px**
- **xs**: 4px — Tight gaps, icon padding
- **sm**: 8px — Inline spacing
- **md**: 16px — Component internal padding
- **lg**: 24px — Section gaps
- **xl**: 32px — Card padding
- **2xl**: 48px — Page section spacing
- **3xl**: 64px — Layout margins

## Border Radius

- **None** (0px): —
- **sm** (4px): Chips, small elements
- **md** (8px): Buttons, cards, inputs
- **lg** (12px): Modals, panels
- **full** (9999px): Avatars, pills

## Elevation

Subtle shadows to maintain a warm, approachable feel.
- **sm**: 1px offset, 2px blur, #000000 at 5%. Inputs, chips.
- **md**: 2px offset, 8px blur, #000000 at 8%. Cards, dropdowns.
- **lg**: 4px offset, 16px blur, #000000 at 10%. Modals, elevated.
- **focus**: 3px ring #7C3AED at 25%. Focus ring.

## Components

### Buttons
#### Variants
- ****Primary****: #7C3AED fill, #FFFFFF text, no border, #5B21B6 fill.
- ****Secondary****: Transparent fill, #7C3AED text, 1px #7C3AED border, #F5F3FF fill.
- ****Ghost****: Transparent fill, #6B7280 text, no border, #F3F4F6 fill.
- ****Destructive****: #EF4444 fill, #FFFFFF text, no border, #DC2626 fill.
#### Sizes
Sizes: sm (6px 12px, 12px, 32px), md (8px 16px, 14px, 40px), lg (10px 24px, 16px, 48px).
#### Disabled State
0.5 opacity, disabled cursor.
- No hover or focus effects

### Cards
- ****Default****: #FFFFFF fill, 1px #E5E7EB border, sm shadow, 8px radius.
- ****Elevated****: #FFFFFF fill, no border, md shadow, 8px radius.
24px padding.
- Cards use `surface-raised` background on hover

### Inputs
- **Default**: #E5E7EB border, #FFFFFF fill, no shadow.
- **Hover**: #A78BFA border, #FFFFFF fill, no shadow.
- **Focus**: #7C3AED border, #FFFFFF fill, focus` ring shadow.
- **Error**: #EF4444 border, #FEF2F2 fill, no shadow.
- **Disabled**: #E5E7EB border, #F9FAFB fill, no shadow.
40px, padding: 8px 12px, radius: 8px tall, DM Sans 500, 14px, `text-primary`, 4px bottom margin **label**, DM Sans 400, 12px, `text-tertiary`, 4px margin-top; error uses `error` color **helper text**.

### Chips
- ****Filter****: #F5F3FF fill, #7C3AED text, 1px #7C3AED border, pill shape.
- ****Status****: varies fill, varies text, no border, pill shape.
Status chip semantic mapping:
bg #FFFBEB, text #D97706 pending, bg #FEF2F2, text #EF4444 inactive. Active: bg #ECFDF5, text #059669.

### Lists
DM Sans 400 14px. 48px row height, 12px/16px padding, 1px #E5E7EB divider. Hover: background #F5F3FF. Selected: background #EDE9FE, left border 3px #7C3AED.

### Checkboxes
18px square, radius: 4px. Unchecked: border 2px #D1D5DB, background white. Checked: background #7C3AED, border #7C3AED, white checkmark. Indeterminate: background #7C3AED, white dash. Disabled: 50% opacity. Labels in 8px gap DM Sans 400 14px.

### Radio Buttons
18px circle. Unchecked: border 2px #D1D5DB, background white. Selected: border 2px #7C3AED, inner dot 10px #7C3AED. Disabled: 50% opacity. Labels in 8px gap DM Sans 400 14px.

### Tooltips
#1E1B4B fill, #FFFFFF, DM Sans 400, 12px text, 4px corners, `md` shadow. 6px/10px padding, 6px arrow, 240px max width.
---

## Do's and Don'ts

1. **Do** use warm, people-centric language in labels (e.g., "Team Members" not "Users").
2. **Do** pair purple primary with teal for status and progress to keep the palette balanced.
3. **Do** use avatars and initials in list rows to humanize data.
4. **Don't** use destructive red for non-critical actions — reserve it for irreversible operations.
5. **Don't** place more than two primary buttons in a single view.
6. **Do** maintain generous whitespace around employee profile cards.
7. **Don't** use bright tertiary orange for large surfaces — limit it to badges and small accents.
8. **Do** provide clear loading and empty states for org charts and team lists.
9. **Don't** display sensitive employee data (salary, SSN) without explicit reveal interactions.
10. **Do** ensure all form flows have progress indicators for multi-step processes.
