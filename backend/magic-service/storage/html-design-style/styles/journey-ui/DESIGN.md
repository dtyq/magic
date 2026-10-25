# QuestUI Design System

## Overview

QuestUI is a fantasy-inspired, ornate, RPG-styled design system built for RPG game interfaces and fantasy gaming platforms. Rich golds, deep reds, and royal purples evoke the grandeur of medieval kingdoms and enchanted realms. Every element carries a sense of weight and craftsmanship, from the decorative serif headlines to the warm golden glows that frame interactive components.

---

## Colors

- **Primary Gold** (#CA8A04): Primary actions, highlights
- **Secondary Deep Red** (#991B1B): Secondary accents, warnings
- **Tertiary Royal Purple** (#581C87): Rare items, special elements
- **Background** (#1A0F0A): Page background
- **Surface Default** (#2C1A10): Card backgrounds
- **Success** (#22C55E): Quest complete, health
- **Warning** (#CA8A04): Low resources, caution
- **Error** (#991B1B): Damage, failed, danger
- **Info** (#581C87): Lore, magic, special info

## Typography

- **Headline Font**: Cinzel
- **Body Font**: Spectral
- **Mono Font**: Fira Code

- **Display**: Cinzel 40px bold, 1.15 line height
- **H1**: Cinzel 32px bold, 1.2 line height
- **H2**: Cinzel 24px semibold, 1.25 line height
- **H3**: Cinzel 20px semibold, 1.3 line height
- **H4**: Cinzel 16px regular, 1.35 line height
- **Body LG**: Spectral 18px regular, 1.7 line height
- **Body**: Spectral 16px regular, 1.7 line height
- **Body SM**: Spectral 14px regular, 1.6 line height
- **Caption**: Spectral 12px medium, 1.4 line height
- **Code**: Fira Code 14px regular, 1.6 line height

---

## Spacing

Base unit: **8px**
- **xs**: 4px — Inline icon gaps
- **sm**: 8px — Tight component padding
- **md**: 16px — Default padding
- **lg**: 24px — Card padding
- **xl**: 32px — Panel gaps
- **2xl**: 48px — Layout sections
- **3xl**: 64px — Page-level spacing

## Border Radius

Subtle radius for a medieval, angular feel.
- **sm** (2px): Badges, inline tags
- **DEFAULT** (4px): Buttons, cards, inputs
- **md** (6px): Modals, dropdown panels
- **lg** (8px): Inventory panels
- **full** (9999px): Health orbs, status circles

## Elevation

Colored gold-glow shadows for an enchanted, ornate feel.
- **sm**: 1px offset, 3px blur, #CA8A04 at 15%. Buttons, small items.
- **DEFAULT**: 2px offset, 8px blur, #CA8A04 at 20%. Cards, panels.
- **md**: 4px offset, 16px blur, #CA8A04 at 25%. Elevated panels.
- **lg**: 8px offset, 32px blur, #CA8A04 at 30%. Modals, treasure UI.
- **glow**: 20px glow #CA8A04 at 40%. Active/selected items.

## Components

### Buttons
#### Variants
- **Primary**: #CA8A04 fill, #1A0F0A text, 1px #DAA520 border, #B8780A fill.
- **Secondary**: transparent fill, #CA8A04 text, 1px #CA8A04 border, #CA8A0415 fill.
- **Ghost**: transparent fill, #BFA98A text, no border, #3D2517 fill.
- **Destructive**: #991B1B fill, #F5E6D3 text, 1px #B91C1C border, #7F1D1D fill.
#### Sizes
Sizes: sm (6px 14px, 13px, 32px, 1px), md (8px 22px, 14px, 40px, 1px), lg (12px 30px, 16px, 48px, 1.5px).
#### Disabled State
0.35 opacity.
- disabled cursor
- Gold glow removed; border dims to #5C3D2E
---

### Cards
- **Default**: #2C1A10 fill, 1px #5C3D2E border, sm shadow, 4px radius.
- **Elevated**: #3D2517 fill, 1px #CA8A0440 border, md shadow, 4px radius.
** 24px **padding, ** optional 2px top border in #CA8A04 for quest/item headers **header accent, ** glow shadow fades in over 300ms **hover (elevated).
---

### Inputs
- **Default**: 1px #5C3D2E border, #2C1A10 fill, no shadow.
- **Hover**: 1px #CA8A04 border, #2C1A10 fill, no shadow.
- **Focus**: 2px #CA8A04 border, #2C1A10 fill, 3px ring #CA8A04 at 25% shadow.
- **Error**: 2px #991B1B border, #2C1A10 fill, 3px ring #991B1B at 25% shadow.
- **Disabled**: 1px #3D2517 border, #1A0F0A fill, no shadow.
** 40px | **Padding:** 8px 12px | **Radius:** 4px **height, ** Spectral 14px/500, color #F5E6D3, bottom margin 6px **label, ** Spectral 12px/400, color #BFA98A, top margin 4px **helper text, ** Spectral 12px/400, color #991B1B, top margin 4px **error text.
---

### Chips
- **Filter**: #2C1A10 fill, #BFA98A text, 1px #5C3D2E border.
- **Filter Active**: #CA8A04 fill, #1A0F0A text, no border.
- **Status Success**: #22C55E20 fill, #22C55E text, no border.
- **Status Warning**: #CA8A0420 fill, #CA8A04 text, no border.
- **Status Error**: #991B1B20 fill, #F87171 text, no border.
** 4px 12px | **Radius:** 2px | **Font:** Cinzel 11px/400, tracking 1px, uppercase **padding.
---

### Lists
** 48px **row height, ** 8px 16px **padding, ** 1px #3D2517 **divider, ** #3D2517 **hover background, ** #CA8A040D **active background, ** Spectral 16px/400 #F5E6D3 for label, 14px/400 #BFA98A for description **font, ** 28px with 12px right margin (item/quest icons) **leading icon area.
---

### Checkboxes
** 20px x 20px | **Radius:** 2px **size, ** border 2px #5C3D2E, background #2C1A10 **unchecked, ** background #CA8A04, border none, checkmark #1A0F0A **checked, ** background #CA8A04, dash #1A0F0A **indeterminate, ** 35% opacity, disabled cursor **disabled, ** 8px left of label text **label spacing.
---

### Radio Buttons
** 20px x 20px | **Radius:** full (circle) **size, ** border 2px #5C3D2E, background #2C1A10 **unchecked, ** border 2px #CA8A04, inner dot 10px #CA8A04 **selected, ** 35% opacity, disabled cursor **disabled, ** 8px left of label text **label spacing.
---

### Tooltips
** #3D2517 **background, ** #F5E6D3, Spectral 12px/400 **text, ** 1px #CA8A0440 **border, ** 8px 14px | **Radius:** 4px **padding, ** 6px triangle matching background **arrow, ** 260px **max width, ** 300ms show, 0ms hide **delay.
---

## Do's and Don'ts

1. **Do** use Cinzel for all headings and UI labels to maintain the medieval, ornate character.
2. **Do** apply the gold glow shadow to interactive elements in their active/selected state for a magical feel.
3. **Do** use the dark brown palette (#1A0F0A, #2C1A10, #3D2517) for layered depth -- never pure black.
4. **Don't** use modern, flat design patterns; QuestUI thrives on texture, borders, and layered surfaces.
5. **Don't** mix in sans-serif fonts; the dual-serif stack (Cinzel + Spectral) is essential to the fantasy tone.
6. **Do** leverage Royal Purple (#581C87) sparingly for rare, legendary, or magical elements.
7. **Don't** use bright white (#FFFFFF) for text; #F5E6D3 parchment color ensures thematic consistency.
8. **Do** add top-border accents in gold to signify important cards or quest headers.
9. **Don't** over-animate UI transitions; subtle fades (300ms) are preferred to maintain gravitas.
10. **Do** use uppercase letter-spaced text on chips and small labels for an inscribed, carved quality.
