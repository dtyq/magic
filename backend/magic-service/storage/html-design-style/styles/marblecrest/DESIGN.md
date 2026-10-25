# MarbleCrest Design System

## Overview

MarbleCrest is a light, marble-textured design system evoking old-money elegance and enduring sophistication. Built for high-end real estate, fine jewelry, and prestigious auction houses, it pairs classic serif typography with a restrained charcoal-and-gold palette. The generous spacing and barely-there border radii create an atmosphere of quiet confidence, where content speaks louder than ornamentation.

---

## Colors

- **Charcoal** (#27272A): Primary text, headings, buttons
- **Gold** (#B8860B): Accents, highlights, premium cues
- **Marble** (#F5F5F0): Background, surface base
- **Surface Base** (#F5F5F0): App background
- **Success** (#16A34A): Confirmed, sold
- **Warning** (#CA8A04): Reserve not met, pending
- **Error** (#DC2626): Failed, unavailable
- **Info** (#2563EB): Informational

## Typography

- **Headline Font**: Cormorant Garamond
- **Body Font**: Inter
- **Mono Font**: IBM Plex Mono

- **h1**: Cormorant Garamond 48px semibold, 1.15 line height
- **h2**: Cormorant Garamond 36px semibold, 1.2 line height
- **h3**: Cormorant Garamond 28px regular, 1.25 line height
- **h4**: Cormorant Garamond 22px regular, 1.3 line height
- **body**: Inter 16px light, 1.65 line height
- **small**: Inter 14px regular, 1.5 line height
- **tiny**: Inter 12px regular, 1.4 line height
- **mono**: IBM Plex Mono 14px regular, 1.6 line height

---

## Spacing

Base unit: 16px (very generous)
- **sp-1**: 8px
- **sp-2**: 16px
- **sp-3**: 24px
- **sp-4**: 32px
- **sp-5**: 48px
- **sp-6**: 64px
- **sp-7**: 96px
- **sp-8**: 128px

## Border Radius

- **radius-sm** (1px): Badges, inline elements
- **radius-md** (2px): Cards, inputs, buttons
- **radius-lg** (4px): Modals, large panels
- **radius-none** (0px): Images, hero sections

## Elevation

- **shadow-sm**: Delicate 1px vertical, 3px blur, charcoal (#27272A) at 6% opacity. Subtle lift.
- **shadow-md**: Light 2px vertical, 8px blur, charcoal (#27272A) at 8% opacity. Cards.
- **shadow-lg**: Moderate 4px vertical, 16px blur, charcoal (#27272A) at 10% opacity. Modals.
- **shadow-gold**: Warm 2px vertical, 12px blur, gold (#B8860B) at 8% opacity. Premium elements.

## Components

### Buttons

All buttons use 2px rounded corners (radius-md).

- **Primary (Charcoal)**: Charcoal (#27272A) fill, marble (#F5F5F0) text, no border, Inter medium (500) uppercase with 0.75px letter-spacing. Hover lightens to #3F3F46; active darkens to #18181B. Available in small (11px text, 36px tall, 8px 20px padding), medium (12px text, 44px tall, 12px 28px padding), and large (13px text, 52px tall, 16px 40px padding).
- **Secondary**: Transparent fill, charcoal text, 1px charcoal border. Hover tints the background to faint charcoal (#27272A at 4% opacity).
- **Ghost**: Transparent fill, content-secondary text, no border. Hover tints the background to faint charcoal (#27272A at 4% opacity) and adds an underline.
- **Destructive**: Red (#DC2626) fill, white (#FFFFFF) text, no border. Hover darkens to #B91C1C.

Disabled buttons drop to 0.4 opacity with a disabled cursor.

### Cards

- **Default**: White (#FFFFFF) raised surface with a 1px default border, 2px rounded corners, 32px padding, and shadow-sm.
- **Elevated**: White (#FFFFFF) raised surface with a 1px default border, 2px rounded corners, 48px padding, and shadow-md.

### Inputs

Inputs sit on a sunken surface (#EDEDE8) with 2px rounded corners, 12px 16px padding, and Inter 16px light (300) text in content-primary. The border is 1px in the default border color.

In the default state there is no shadow. On hover the border strengthens to border-strong. On focus the border turns charcoal with a 2px charcoal (#27272A) ring at 15% opacity. In the error state the border turns red (error) with a 2px red (#DC2626) ring at 10% opacity. When disabled the border returns to default and opacity drops to 0.4.

Labels are Inter 11px medium (500) uppercase with 1.5px letter-spacing in content-tertiary with 10px bottom margin. Helper text is Inter 13px light (300) in content-tertiary with 6px top margin; error helper text uses the error color.

### Chips

- **Filter**: Transparent fill, content-secondary text, 1px default border, 2px rounded corners, 6px 16px padding. When active the fill becomes charcoal and text turns marble.
- **Status**: 2px rounded corners, 11px medium (500) uppercase text with 0.75px letter-spacing, 4px 14px padding. Available shows #16A34A at 8% opacity fill with #16A34A text. Reserved shows #CA8A04 at 8% opacity fill with #CA8A04 text. Sold shows #DC2626 at 8% opacity fill with #DC2626 text. Featured shows #B8860B at 8% opacity fill with #B8860B text.

### Lists

Transparent background with 1px default-color dividers. Each item has 16px 24px padding and Inter 16px light (300) content-secondary text. On hover the background tints to faint charcoal (#27272A at 2% opacity). The active row deepens to #27272A at 4% opacity. Trailing elements include gold price labels and arrows.

### Checkboxes

18px square with 1px rounded corners and a 1px strong border. Unchecked background is surface-raised. When checked the box fills charcoal with a marble-colored 2px-stroke checkmark. Focus adds a 2px charcoal (#27272A) ring at 15% opacity. Disabled drops to 0.4 opacity.

### Radio Buttons

18px circular with a 1px strong border. Unchecked fill is surface-raised. When selected the border turns charcoal and an 8px charcoal inner dot appears. Focus adds a 2px charcoal (#27272A) ring at 15% opacity. Disabled drops to 0.4 opacity.

### Tooltips

Charcoal (#27272A) background with marble-colored text at 13px light (300), 2px rounded corners, 8px 14px padding, and shadow-md. A 5px arrow matches the background. Maximum width is 260px.

---

## Do's and Don'ts

1. **Do** use Cormorant Garamond exclusively for headings; pair with Inter for all body text.
2. **Don't** round corners beyond 4px -- sharp edges convey the precision of luxury.
3. **Do** use gold only for accent moments: a price, a badge, a featured indicator.
4. **Don't** use bold weights in body text; keep it at 300-400 for editorial grace.
5. **Do** maintain extremely generous spacing; let content breathe on every screen.
6. **Don't** apply colored backgrounds to large sections; the marble-white surface is the canvas.
7. **Do** use uppercase letter-spaced labels for navigation and form labels.
8. **Don't** introduce additional accent colors beyond the charcoal-gold-marble triad.
9. **Do** size images large and uncropped; this system values visual real estate.
10. **Don't** use shadows heavier than shadow-lg; subtlety defines MarbleCrest.
