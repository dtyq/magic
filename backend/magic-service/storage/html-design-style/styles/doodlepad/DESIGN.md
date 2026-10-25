# DoodlePad Design System

## Overview

DoodlePad is a crayon-textured, hand-drawn design system crafted for children's creative and drawing apps. It embraces the imaginative spirit of childhood art with a warm ivory background, sky blues, grass greens, and sunny yellows. The handwritten headline font and generous rounded corners create an interface that feels like a living sketchbook.

---

## Colors

- **Color Primary** (#60A5FA): Primary tools, selected items
- **Color Secondary** (#4ADE80): Success, drawing tools
- **Color Tertiary** (#FBBF24): Stars, highlights, undo
- **Surface Base** (#FFFFF0): Page background (ivory)
- **Color Success** (#4ADE80): Saved, exported
- **Color Warning** (#FBBF24): Unsaved changes
- **Color Error** (#F87171): Oops, gentle errors
- **Color Info** (#60A5FA): Tips, new tools

## Typography

- **Headline Font**: Patrick Hand
- **Body Font**: Nunito
- **Mono Font**: Fira Code

- **h1**: 40px regular, 1.2 line height. Page titles.
- **h2**: 32px regular, 1.25 line height. Section headings.
- **h3**: 24px regular, 1.3 line height. Tool group labels.
- **h4**: 20px regular, 1.35 line height. Card titles.
- **body**: 18px regular, 1.5 line height. Instructions.
- **small**: 16px regular, 1.5 line height. Labels, captions.
- **xs**: 14px semibold, 1.4 line height. Badges, counters.

---

## Spacing

Base unit: **8px**.
- **xs**: 4px — Inline icon gaps
- **sm**: 8px — Tight internal padding
- **md**: 16px — Standard padding
- **lg**: 24px — Card padding, gaps
- **xl**: 32px — Layout margins
- **2xl**: 48px — Section breaks
- **3xl**: 64px — Major layout breaks

## Border Radius

- **radius-sm** (8px): Chips, small tags
- **radius-md** (16px): Buttons, inputs, panels
- **radius-lg** (24px): Cards, modals
- **radius-full** (9999px): Avatars, color swatches, pills

## Elevation

Subtle shadow system mimicking paper-like layering for a sketchbook feel.
- **shadow-sm**: Gentle 1px vertical, 3px blur, black at 6% opacity. Resting cards.
- **shadow-md**: Light 3px vertical, 8px blur, black at 8% opacity. Hovered elements.
- **shadow-lg**: Moderate 6px vertical, 16px blur, black at 10% opacity. Modals, overlays.
- **shadow-blue**: Sky-blue 3px spread, 10px blur, (#60A5FA) glow at 30% opacity. Selected tool glow.
- **shadow-green**: Green 3px spread, 10px blur, (#4ADE80) glow at 30% opacity. Success glow.

## Components

### Buttons

All buttons use 16px rounded corners (radius-md). Ghost buttons use a dashed border to reinforce the hand-drawn aesthetic.

- **Primary**: Sky blue (#60A5FA) fill, white (#FFFFFF) text, no border. Hover darkens to #3B82F6. Available in small (16px text, 36px tall, 8px 18px padding), medium (18px text, 44px tall, 10px 24px padding), and large (20px text, 52px tall, 14px 32px padding).
- **Secondary**: Green (#4ADE80) fill, white (#FFFFFF) text, no border. Hover darkens to #22C55E.
- **Ghost**: Transparent fill, sky blue (#60A5FA) text, 2px dashed sky blue (#60A5FA) border. Hover tints the background to faint blue (#60A5FA at 10% opacity).
- **Destructive**: Soft red (#F87171) fill, white (#FFFFFF) text, no border. Hover darkens to #EF4444.

Disabled buttons drop to 0.4 opacity with a disabled cursor and no hover or focus effects.

### Cards

- **Default**: White (#FFFFFF) background with a 2px dashed #E5E7EB border, shadow-sm at rest, 24px rounded corners. On hover the border color shifts to sky blue (#60A5FA). Padding is 20px. The dashed border gives a hand-drawn look.
- **Elevated**: White (#FFFFFF) background with no border, shadow-md at rest, 24px rounded corners. On hover the shadow deepens to shadow-lg. Padding is 20px.

### Inputs

Inputs sit on a white (#FFFFFF) background with 16px rounded corners, 12px 16px padding, and 18px text in Nunito.

In the default state the border is 2px #E5E7EB with no shadow. On hover the border strengthens to 2px #A1A1AA. On focus the border becomes 2px sky blue (#60A5FA) with a 3px blue ring at 25% opacity. In the error state the border turns 2px soft red (#F87171) over a light red (#FFF5F5) background with a 3px red ring at 20% opacity. When disabled the border stays 2px #E5E7EB, the background shifts to warm ivory (#FEFCE8), and opacity drops to 0.5.

Labels are set in Nunito 16px semibold (600) in content-primary with 6px bottom margin. Helper text is Nunito 14px regular (400) in content-secondary with 6px top margin; error helper text uses color-error.

### Chips

- **Filter**: Light blue (#60A5FA at 20% opacity) fill, sky blue (#60A5FA) text, 1px border at #60A5FA 40% opacity, pill-shaped, 14px text, 6px 14px padding.
- **Status**: Pill-shaped with no border, 14px text, 6px 14px padding. Background and text vary by severity: success is #DCFCE7 with #166534 text, warning is #FEF9C3 with #854D0E text, error is #FEE2E2 with #991B1B text.

### Lists

Each row is 52px tall with 0 16px padding, separated by a 1px dashed #E5E7EB divider. Text is Nunito 18px in content-primary. On hover the background tints to ivory (#FFFFF0). The active row fills with faint blue (#60A5FA at 15% opacity) and text turns #3B82F6.

### Checkboxes

24px square with 8px rounded corners. Unchecked state shows a 2px #D1D5DB border on a white (#FFFFFF) background. When checked the box fills green (#4ADE80) with a thick crayon-weight white checkmark. Focus adds a 3px green ring at 25% opacity. Labels sit 10px away in Nunito 18px.

### Radio Buttons

24px circular. Unchecked state shows a 2px #D1D5DB border on a white (#FFFFFF) background. When selected the border becomes 2px sky blue (#60A5FA) and a 12px blue inner dot appears. Focus adds a 3px blue ring at 25% opacity. Labels sit 10px away in Nunito 18px.

### Tooltips

Dark (#1E1E1E) background with white (#FFFFFF) text in Nunito 14px. Padded 8px 14px with 8px rounded corners and an 8px arrow. Maximum width is 220px. Shows after a 400ms delay and hides instantly.

---

## Do's and Don'ts

1. **Do** use dashed borders on cards and ghost buttons to reinforce the hand-drawn, sketchbook vibe.
2. **Do** use Patrick Hand for all headings; it establishes the entire creative personality of the system.
3. **Do** maintain the ivory background throughout; it creates the warm paper-like canvas feel.
4. **Don't** use text smaller than 14px; young users need large, clear type for readability.
5. **Don't** use sharp corners; every element should feel soft and rounded with 16-24px radius minimum.
6. **Do** use the sky blue primary for tool selection states and active drawing tools.
7. **Don't** use scary or harsh error messaging; keep feedback gentle with soft reds and friendly language.
8. **Do** make color swatches and tool icons at least 44px for easy tapping by children.
9. **Don't** overcomplicate layouts; keep tool palettes simple with no more than 6-8 options visible.
10. **Do** use the sunny yellow for reward moments, star ratings, and positive reinforcement animations.
