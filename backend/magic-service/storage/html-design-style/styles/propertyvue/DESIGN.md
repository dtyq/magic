# PropertyVue Design System

## Overview

PropertyVue is a map-heavy, listing-card, search-driven design system built for real estate listing and property search platforms. It uses a clean blue primary palette alongside functional greens and grays to prioritize data density without sacrificing clarity. The system is engineered for rapid filtering, comparison, and at-a-glance property evaluation.

---

## Colors

- **Primary Blue** (#2563EB): Primary actions, map pins
- **Secondary Green** (#16A34A): Price tags, availability
- **Tertiary Gray** (#6B7280): Metadata, secondary content
- **Background** (#F9FAFB): Page background
- **Surface Default** (#FFFFFF): Card backgrounds
- **Success** (#16A34A): Available, new listing
- **Warning** (#D97706): Price reduced, pending
- **Error** (#DC2626): Sold, off-market, errors
- **Info** (#2563EB): Featured, open house

## Typography

- **Headline Font**: Red Hat Display
- **Body Font**: DM Sans
- **Mono Font**: Fira Code

- **Display**: Red Hat Display 36px black, 1.2 line height
- **H1**: Red Hat Display 30px bold, 1.25 line height
- **H2**: Red Hat Display 24px bold, 1.3 line height
- **H3**: Red Hat Display 20px semibold, 1.35 line height
- **H4**: Red Hat Display 16px semibold, 1.4 line height
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

- **sm** (4px): Chips, badges
- **DEFAULT** (8px): Buttons, cards, inputs
- **md** (12px): Modals, large containers
- **lg** (16px): Map panels
- **full** (9999px): Avatars, status dots

## Elevation

Material-inspired shadows with neutral gray base.
- **sm**: 1px offset, 2px blur, #000000 at 6%; 1px offset, 3px blur, #000000 at 10%. Buttons, chips.
- **DEFAULT**: 2px offset, 4px blur, #000000 at 6%; 4px offset, 6px blur, #000000 at 10%. Cards.
- **md**: 4px offset, 8px blur, #000000 at 7%; 10px offset, 20px blur, #000000 at 10%. Elevated cards.
- **lg**: 10px offset, 20px blur, #000000 at 10%; 20px offset, 48px blur, #000000 at 12%. Modals, map panels.

## Components

### Buttons
#### Variants
- **Primary**: #2563EB fill, #FFFFFF text, no border, #1D4ED8 fill.
- **Secondary**: transparent fill, #2563EB text, 1px #2563EB border, #2563EB10 fill.
- **Ghost**: transparent fill, #111827 text, no border, #F3F4F6 fill.
- **Destructive**: #DC2626 fill, #FFFFFF text, no border, #B91C1C fill.
#### Sizes
Sizes: sm (6px 12px, 14px, 32px), md (8px 20px, 16px, 40px), lg (12px 28px, 18px, 48px).
#### Disabled State
0.5 opacity.
- disabled cursor
- No hover or focus effects applied
---

### Cards
- **Default**: #FFFFFF fill, 1px #E5E7EB border, sm shadow, 8px radius.
- **Elevated**: #FFFFFF fill, no border, md shadow, 8px radius.
** 16px **padding, ** top slot with border-radius 8px 8px 0 0, aspect ratio 16:10 **image area, ** absolute top-right, background #16A34A, text white, padding 4px 10px, radius 0 8px 0 4px **price badge.
---

### Inputs
- **Default**: 1px #E5E7EB border, #FFFFFF fill, no shadow.
- **Hover**: 1px #2563EB border, #FFFFFF fill, no shadow.
- **Focus**: 2px #2563EB border, #FFFFFF fill, 3px ring #2563EB25 shadow.
- **Error**: 2px #DC2626 border, #FFFFFF fill, 3px ring #DC262625 shadow.
- **Disabled**: 1px #E5E7EB border, #F3F4F6 fill, no shadow.
** 40px | **Padding:** 8px 12px | **Radius:** 8px **height, ** DM Sans 14px/500, color #111827, bottom margin 6px **label, ** DM Sans 12px/400, color #6B7280, top margin 4px **helper text, ** DM Sans 12px/400, color #DC2626, top margin 4px **error text.
---

### Chips
- **Filter**: #FFFFFF fill, #111827 text, 1px #E5E7EB border.
- **Filter Active**: #2563EB fill, #FFFFFF text, no border.
- **Status Success**: #16A34A18 fill, #16A34A text, no border.
- **Status Warning**: #D9770618 fill, #D97706 text, no border.
- **Status Error**: #DC262618 fill, #DC2626 text, no border.
** 4px 12px | **Radius:** 4px | **Font:** 12px/500 **padding.
---

### Lists
** 48px **row height, ** 8px 16px **padding, ** 1px #F3F4F6 **divider, ** #F9FAFB **hover background, ** #2563EB08 **active background, ** DM Sans 16px/400 for label, 14px/400 #6B7280 for description **font, ** 40px x 40px, radius 4px, 12px right margin **leading thumbnail.
---

### Checkboxes
** 18px x 18px | **Radius:** 4px **size, ** border 2px #D1D5DB, background #FFFFFF **unchecked, ** background #2563EB, border none, checkmark #FFFFFF **checked, ** background #2563EB, dash #FFFFFF **indeterminate, ** 50% opacity, disabled cursor **disabled, ** 8px left of label text **label spacing.
---

### Radio Buttons
** 18px x 18px | **Radius:** full (circle) **size, ** border 2px #D1D5DB, background #FFFFFF **unchecked, ** border 2px #2563EB, inner dot 8px #2563EB **selected, ** 50% opacity, disabled cursor **disabled, ** 8px left of label text **label spacing.
---

### Tooltips
** #111827 **background, ** #FFFFFF, DM Sans 12px/400 **text, ** 6px 12px | **Radius:** 8px **padding, ** 6px triangle matching background **arrow, ** 220px **max width, ** 200ms show, 0ms hide **delay.
---

## Do's and Don'ts

1. **Do** always pair the map view with a list/card view -- users switch between both frequently.
2. **Do** use Blue (#2563EB) for all primary interactive elements to maintain a single action color.
3. **Do** show price, beds, baths, and sqft on the card surface -- these are the top-four scanning criteria.
4. **Don't** hide search filters behind a toggle; keep the most common filters persistently visible.
5. **Don't** use green for anything other than price/availability signals to avoid semantic confusion.
6. **Do** provide skeleton loaders for listing cards, especially during map-driven searches.
7. **Don't** load full-resolution images in listing grids; use optimized thumbnails with lazy loading.
8. **Do** use consistent card sizes in grid layouts for clean visual alignment.
9. **Don't** stack more than three filter rows without collapsing into an expandable panel.
10. **Do** ensure map pins use the Blue primary with a white center dot for maximum visibility.
