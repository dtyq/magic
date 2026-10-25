# Verdana Health Design System

## Overview

Verdana Health is a calm, trustworthy design system built for digital health platforms, telehealth dashboards, and patient-facing wellness applications. Its foundation of deep navy and soft sage greens evokes clinical precision tempered by warmth. The system prioritizes readability, accessibility, and a sense of reassurance across every touchpoint.

---

## Colors

- **Primary Navy** (#0F172A): Primary actions, strong headers
- **Secondary Slate** (#64748B): Secondary text, borders
- **Tertiary Sage** (#059669): Links, CTAs, highlights
- **Background** (#F8FAFC): Page background
- **Surface Default** (#FFFFFF): Card backgrounds
- **Success** (#22C55E): Confirmed, healthy range
- **Warning** (#EAB308): Pending results, caution
- **Error** (#EF4444): Critical, out of range
- **Info** (#0EA5E9): Informational, new feature

## Typography

- **Headline Font**: Plus Jakarta Sans
- **Body Font**: DM Sans
- **Mono Font**: Fira Code

- **Display**: Plus Jakarta Sans 40px bold, 1.15 line height
- **H1**: Plus Jakarta Sans 32px bold, 1.2 line height
- **H2**: Plus Jakarta Sans 24px semibold, 1.25 line height
- **H3**: Plus Jakarta Sans 20px semibold, 1.3 line height
- **H4**: Plus Jakarta Sans 16px medium, 1.35 line height
- **Body LG**: DM Sans 18px regular, 1.6 line height
- **Body**: DM Sans 16px regular, 1.6 line height
- **Body SM**: DM Sans 14px regular, 1.5 line height
- **Caption**: DM Sans 12px medium, 1.4 line height
- **Code**: Fira Code 14px regular, 1.6 line height

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

- **sm** (4px): Badges, small tags
- **DEFAULT** (8px): Buttons, cards, inputs
- **md** (12px): Modals, dropdown panels
- **lg** (16px): Large containers, hero sections
- **full** (9999px): Avatars, status indicators

## Elevation

Gentle, diffused shadows — clinical yet approachable.
- **sm**: 1px offset, 3px blur, #0F172A at 3%. Buttons, chips.
- **DEFAULT**: 2px offset, 6px blur, #0F172A at 5%. Cards, dropdowns.
- **md**: 4px offset, 16px blur, #0F172A at 7%. Elevated cards.
- **lg**: 8px offset, 32px blur, #0F172A at 10%. Modals, panels.

## Components

### Buttons
#### Variants
- **Primary**: #0F172A fill, #FFFFFF text, no border, #020617 hover fill.
- **Secondary**: transparent fill, #0F172A text, 1px #0F172A border, #0F172A0A hover fill.
- **Ghost**: transparent fill, #475569 text, no border, #F1F5F9 hover fill.
- **Destructive**: #EF4444 fill, #FFFFFF text, no border, #DC2626 hover fill.
#### Sizes
Sizes: sm (6px 14px, 14px, 32px), md (10px 22px, 14px, 42px), lg (12px 28px, 16px, 48px).
#### Disabled State
0.4 opacity.
- disabled cursor
- All hover and focus states suppressed
---

### Cards
- **Default**: #FFFFFF fill, 1px #E2E8F0 border, no shadow, 8px radius.
- **Elevated**: #FFFFFF fill, no border, md shadow, 8px radius.
** 24px **padding, ** top slot, border-radius 8px 8px 0 0 **image area, ** optional tinted header strip (#0F172A) with white text for category labels **header bar.
---

### Inputs
- **Default**: 1px #E2E8F0 border, #FFFFFF fill, no shadow.
- **Hover**: 1px #0F172A border, #FFFFFF fill, no shadow.
- **Focus**: 2px #0F172A border, #FFFFFF fill, 3px ring #0F172A18 shadow.
- **Error**: 2px #EF4444 border, #FFFFFF fill, 3px ring #EF444418 shadow.
- **Disabled**: 1px #E2E8F0 border, #F1F5F9 fill, no shadow.
** 42px | **Padding:** 10px 14px | **Radius:** 8px **height, ** DM Sans 14px/500, color #0F172A, bottom margin 6px **label, ** DM Sans 12px/400, color #475569, top margin 4px **helper text, ** DM Sans 12px/400, color #EF4444, top margin 4px **error text.
---

### Chips
- **Filter**: #F8FAFC fill, #0F172A text, 1px #E2E8F0 border.
- **Filter Active**: #0F172A fill, #FFFFFF text, no border.
- **Status Success**: #22C55E15 fill, #16A34A text, no border.
- **Status Warning**: #EAB30815 fill, #CA8A04 text, no border.
- **Status Error**: #EF444415 fill, #DC2626 text, no border.
** 4px 12px | **Radius:** 4px | **Font:** 12px/500, uppercase, tracking 0.5px **padding.
---

### Lists
** 48px **row height, ** 8px 16px **padding, ** 1px #F1F5F9 **divider, ** #F8FAFC **hover background, ** #0F172A06 **active background, ** DM Sans 16px/400 for label, 14px/400 #475569 for description **font.
---

### Checkboxes
** 18px x 18px | **Radius:** 4px **size, ** border 1.5px #CBD5E1, background #FFFFFF **unchecked, ** background #0F172A, border none, checkmark #FFFFFF **checked, ** background #0F172A, dash #FFFFFF **indeterminate, ** 40% opacity, disabled cursor **disabled, ** 8px left of label text **label spacing.
---

### Radio Buttons
** 18px x 18px | **Radius:** full (circle) **size, ** border 1.5px #CBD5E1, background #FFFFFF **unchecked, ** border 2px #0F172A, inner dot 8px #0F172A **selected, ** 40% opacity, disabled cursor **disabled, ** 8px left of label text **label spacing.
---

### Tooltips
** #0F172A **background, ** #F8FAFC, DM Sans 12px/400 **text, ** 6px 12px | **Radius:** 8px **padding, ** 6px triangle matching background **arrow, ** 240px **max width, ** 150ms show, 0ms hide **delay.
---

## Do's and Don'ts

1. **Do** use the Navy + White contrast as the primary visual rhythm; Sage green is reserved for interactive elements and positive states only.
2. **Do** lean on generous whitespace and breathing room — health interfaces should never feel cramped.
3. **Do** use softer radius (8px) consistently; rounded corners convey approachability and calm.
4. **Don't** introduce harsh neons or saturated accent colors — Verdana Health is calming and clinical.
5. **Don't** use condensed or decorative fonts; Plus Jakarta Sans and DM Sans are chosen for legibility at all sizes.
6. **Do** use uppercase chip labels with tracking for a polished, medical-grade feel.
7. **Don't** overload dashboards with dense data; use progressive disclosure, collapsible sections, and guided flows.
8. **Do** include clear iconography alongside text labels for accessibility.
9. **Don't** use heavy drop shadows; the diffused elevation system maintains the clean, clinical aesthetic.
10. **Do** ensure lab results and vitals use Fira Code for clear tabular numeral alignment.
