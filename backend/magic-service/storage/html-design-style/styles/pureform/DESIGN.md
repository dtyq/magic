# PureForm Design System

## Overview

PureForm is an exercise in extreme reduction -- whitespace-dominant, typographically restrained, and anchored by a single blue accent. Designed for minimalist SaaS landing pages and single-purpose tools, it strips away every unnecessary element. There are no shadows, no gradients, no decorative flourishes. The design speaks through hierarchy, spacing, and the disciplined use of a single accent color against monochrome surfaces.

---

## Colors

- **Black** (#0A0A0A): Primary text, headings
- **White** (#FAFAFA): Background, surfaces
- **Accent Blue** (#2563EB): Links, CTA, single accent
- **Surface Base** (#FAFAFA): App background
- **Success** (#16A34A): Success state
- **Warning** (#CA8A04): Warning state
- **Error** (#DC2626): Error state
- **Info** (#2563EB): Info (same as accent)

## Typography

- **Headline Font**: Inter
- **Body Font**: Inter
- **Mono Font**: JetBrains Mono

- **h1**: Inter 48px extra-bold, 1.1 line height
- **h2**: Inter 36px bold, 1.15 line height
- **h3**: Inter 28px bold, 1.2 line height
- **h4**: Inter 22px semibold, 1.3 line height
- **body**: Inter 16px regular, 1.6 line height
- **small**: Inter 14px regular, 1.5 line height
- **tiny**: Inter 12px medium, 1.4 line height
- **mono**: JetBrains Mono 14px regular, 1.6 line height

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

- **radius-sm** (4px): Badges, small elements
- **radius-md** (8px): Cards, inputs, buttons
- **radius-lg** (12px): Modals, large panels
- **radius-pill** (9999px): Tags (rare use)

## Elevation

PureForm uses **no shadows**. Elevation is communicated entirely through borders, spacing, and background color differentiation.
- **shadow-none**: None. All elements -- completely flat.
Use border-default to delineate card edges. Use surface-sunken vs surface-raised to indicate depth.

## Components

### Buttons

All buttons use 8px rounded corners (radius-md).

- **Primary (Accent Blue)**: Blue (#2563EB) fill, white (#FFFFFF) text, no border. Hover darkens to #1D4ED8; active deepens to #1E40AF. Available in small (13px text, 36px tall, 8px 16px padding), medium (15px text, 44px tall, 10px 24px padding), and large (16px text, 52px tall, 14px 32px padding).
- **Secondary**: Transparent fill, content-primary text, 1px default border. Hover fills with surface-sunken background.
- **Ghost**: Transparent fill, content-secondary text, no border. Hover shifts text to content-primary.
- **Destructive**: Red (#DC2626) fill, white (#FFFFFF) text, no border. Hover darkens to #B91C1C.

Disabled buttons drop to 0.4 opacity with a disabled cursor.

### Cards

- **Default**: White (#FFFFFF) raised surface with a 1px default border, 8px rounded corners, 32px padding, and no shadow.
- **Elevated**: White (#FFFFFF) raised surface with a 1px strong border, 8px rounded corners, 48px padding, and no shadow. Differentiated by the thicker border.

### Inputs

Inputs sit on a sunken surface (#F4F4F5) with 8px rounded corners, 12px 16px padding, and Inter 16px regular (400) text in content-primary. The border is 1px in the default border color.

In the default state there is no shadow. On hover the border strengthens to border-strong. On focus the border turns accent-blue. In the error state the border turns red (error). No shadows appear in any state. When disabled the border returns to default and opacity drops to 0.4.

Labels are Inter 14px medium (500) in content-primary with 6px bottom margin. Helper text is Inter 13px regular (400) in content-tertiary with 4px top margin; error helper text uses the error color.

### Chips

- **Filter**: Transparent fill, content-secondary text, 1px default border, 8px rounded corners, 4px 14px padding. When active the fill becomes accent-blue, text turns white (#FFFFFF), and the border becomes transparent.
- **Status**: 8px rounded corners, 12px medium (500) text, 4px 12px padding. Active shows #16A34A at 8% opacity fill with #16A34A text. Warning shows #CA8A04 at 8% opacity fill with #CA8A04 text. Error shows #DC2626 at 8% opacity fill with #DC2626 text. Info shows #2563EB at 8% opacity fill with #2563EB text.

### Lists

Transparent background with 1px default-color dividers. Each item has 12px 16px padding and 16px content-secondary text. On hover the background shifts to surface-sunken. The active row fills with faint blue (#2563EB at 4% opacity). Trailing elements include text values and chevrons.

### Checkboxes

18px square with 4px rounded corners and a 1px strong border. Unchecked background is surface-raised. When checked the box fills accent-blue with a white (#FFFFFF) 2px-stroke checkmark. Focus shows a 2px accent-blue outline offset by 2px. Disabled drops to 0.4 opacity.

### Radio Buttons

18px circular with a 1px strong border. Unchecked fill is surface-raised. When selected the border turns accent-blue and an 8px accent-blue inner dot appears. Focus shows a 2px accent-blue outline offset by 2px. Disabled drops to 0.4 opacity.

### Tooltips

Black (#0A0A0A) background with white (#FFFFFF) text at 13px, 4px rounded corners, 6px 12px padding, and no shadow. A 5px arrow matches the background. Maximum width is 240px.

---

## Do's and Don'ts

1. **Do** use only the single accent blue for interactive elements; no additional colors.
2. **Don't** add shadows, gradients, or decorative elements -- flatness is the entire point.
3. **Do** rely on weight contrast (400 vs 700 vs 800) within Inter to create hierarchy.
4. **Don't** use more than three visual elements in any component; reduce until it hurts.
5. **Do** use generous whitespace (48-128px) between major sections.
6. **Don't** add borders where spacing alone can separate content.
7. **Do** ensure every screen can be understood in under 3 seconds by stripping distractions.
8. **Don't** introduce colored backgrounds; only use surface-sunken for subtle differentiation.
9. **Do** use the monochrome palette for 95% of the interface; blue is the 5% exception.
10. **Don't** center-align body text; left-align everything for clean scan lines.
