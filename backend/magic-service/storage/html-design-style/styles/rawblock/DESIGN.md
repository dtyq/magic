# RawBlock Design System

## Overview

RawBlock is an unapologetic, anti-design system that strips interfaces down to their structural bones. Built for experimental portfolios and avant-garde art sites, it embraces thick borders, system-level aesthetics, and the raw power of black-on-white. There are no rounded corners, no shadows, no polish. Every element looks like it was assembled from HTML primitives -- because that is the point. This is brutalism as a design language.

---

## Colors

- **Black** (#000000): Text, borders, fills
- **White** (#FFFFFF): Background, inverse text
- **Blue** (#0000FF): Links only (hyperlink blue)
- **Surface Base** (#FFFFFF): App background
- **Surface Inverted** (#000000): Inverted sections
- **Success** (#008000): Success (pure green)
- **Warning** (#FFA500): Warning (pure orange)
- **Error** (#FF0000): Error (pure red)
- **Info** (#0000FF): Info (same as link blue)

## Typography

- **Headline Font**: Archivo Black
- **Body Font**: Work Sans
- **Mono Font**: Space Mono

- **h1**: Archivo Black 64px regular, 1.0 line height
- **h2**: Archivo Black 48px regular, 1.05 line height
- **h3**: Archivo Black 32px regular, 1.1 line height
- **h4**: Work Sans 22px semibold, 1.2 line height
- **body**: Work Sans 16px regular, 1.6 line height
- **small**: Work Sans 14px regular, 1.5 line height
- **tiny**: Work Sans 12px regular, 1.4 line height
- **mono**: Space Mono 15px regular, 1.5 line height

---

## Spacing

Base unit: 8px (intentionally irregular usage)
Spacing is deliberately inconsistent to create visual tension. Use the scale below as a starting point, then break it when the design demands it.
- **sp-1**: 4px
- **sp-2**: 8px
- **sp-3**: 16px
- **sp-4**: 24px
- **sp-5**: 40px
- **sp-6**: 64px
- **sp-7**: 80px
- **sp-8**: 120px

## Border Radius

- **radius-none** (0px): All elements -- no rounding
Every single element uses 0px border radius. No exceptions.

## Elevation

RawBlock uses **no shadows**. Visual hierarchy is achieved exclusively through border weight and scale contrast.
- **shadow-none**: None. All elements.
Use border-thin (1px), border-thick (3px), or border-heavy (5px) to define element boundaries.

## Components

### Buttons
#### Primary
black (#000000) fill, white (#FFFFFF) text, 3px black border, square. 2px tracking. uppercase text-transform. Hover: background white, text black (full inversion). Active: background black, text white, border 5px.
#### Secondary
white fill, black text, 3px black border, square. Hover: background black, text white.
#### Ghost
transparent, black text, no border. underline text-decoration. Hover: text blue.
#### Destructive
error (#FF0000) fill, white text, 3px black border, square. Hover: background black, text error.
#### Sizes
Sizes: Small (6px 16px, 12px, 32px), Medium (10px 24px, 14px, 44px), Large (16px 40px, 18px, 56px).
#### Disabled State
surface-sunken fill, content-tertiary text, 3px #CCCCCC border.
- disabled cursor
---

### Cards
#### Default
white fill, 3px black border, square, no shadow. sp-4/(24px) padding.
#### Elevated
white fill, 5px black border, square, none (heavier border = more importance) shadow. sp-4 padding.
---

### Inputs
surface-sunken (#F0F0F0) fill, content-primary text, 3px black border, square. Space Mono 15px. 10px/12px padding.
- **Default**: 3px black border.
- **Hover**: 3px black border, background #E8E8E8 other.
- **Focus**: 5px black border, outline none other.
- **Error**: 3px error border.
- **Disabled**: 3px #CCCCCC border, background #F5F5F5 other.
#### Label
content-primary text. Archivo Black 14px regular uppercase. 4px margin-bottom.
#### Helper Text
content-secondary (default) | error (error state) text. Work Sans 12px regular. 4px margin-top.
---

### Chips
#### Filter Chip
white fill, black text, 2px black border, square. 4px/12px padding, uppercase, 10px, tracking 1px text-transform. Active: background black, text white.
#### Status Chip
square, 2px respective color border. 11px semibold uppercase tracking 1px. 2px/10px padding.
- **Active**: #FFFFFF fill, #008000 text, #008000 border.
- **Warning**: #FFFFFF fill, #FFA500 text, #FFA500 border.
- **Error**: #FFFFFF fill, #FF0000 text, #FF0000 border.
- **Default**: #FFFFFF fill, #000000 text, #000000 border.
---

### Lists
transparent, Work Sans, 16px text. 3px black divider, 12px 0px item padding. Hover: text-decoration underline. Active: background black, text white, full-width.
- No trailing icons; text only
---

### Checkboxes
20px x 20px, 3px black border, square. white unchecked background, black checked background, white, 3px stroke checkmark. Focus: 5px border. Disabled: border #CCCCCC, background #F5F5F5.
---

### Radio Buttons
20px x 20px, 3px black border. circle (the one exception to 0px radius) shape. Unchecked: white fill. Selected: black border, inner dot 10px black. Focus: 5px border. Disabled: border #CCCCCC.
---

### Tooltips
black fill, white, 13px, Space Mono text, square, none (inverted block) border, no shadow. 8px/12px padding, none (positioned directly adjacent) arrow, 260px max width.
---

## Do's and Don'ts

1. **Do** use thick borders (3-5px) as the primary visual organizer; they replace shadows entirely.
2. **Don't** round any corners -- ever. Sharp edges are non-negotiable in this system.
3. **Do** use full color inversions (black to white, white to black) for hover and active states.
4. **Don't** use opacity for disabled states; use lighter border colors and grey fills instead.
5. **Do** use Archivo Black at large sizes (48-64px) for maximum visual impact.
6. **Don't** use the blue (#0000FF) for anything other than hyperlinks; it is reserved.
7. **Do** embrace intentional spacing irregularity -- asymmetric layouts are encouraged.
8. **Do** use uppercase + tracking for buttons and labels to amplify the raw aesthetic.
9. **Don't** add decorative images, icons, or illustrations; content and typography do the work.
10. **Don't** polish or refine; if something looks too "designed," strip it back further.
