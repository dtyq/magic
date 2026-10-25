# WellPath
*Warm, approachable, wellness-oriented — design that feels like a deep breath.*

## Overview

WellPath is a design system built for mental health and wellness applications. It prioritizes emotional safety, calm visual rhythms, and approachable interactions that reduce anxiety rather than amplify it. Every color, radius, and shadow is chosen to create a sense of comfort and trust. The system uses neumorphism-inspired elevation to produce soft, pillowy surfaces that feel gentle to engage with.

---

## Colors

- **Primary Sage** (#7C9A6E): Primary actions, wellness indicators, CTAs
- **Secondary Lavender** (#B4A7D6): Secondary actions, calming accents
- **Tertiary Peach** (#FFCBA4): Highlights, warm emphasis, illustrations
- **Neutral Warm Gray** (#A8A29E): Muted text, borders, inactive states
- **Background** (#FAF8FF): Page background (warm lavender tint)
- **Surface** (#FFFFFF): Cards, modals, drawers
- **Success** (#7C9A6E): Positive feedback, completed steps
- **Warning** (#E0A849): Gentle caution, reminders
- **Error** (#C97A7A): Soft error (not alarming red)
- **Info** (#B4A7D6): Informational messages, tips

## Typography

- **Headline Font**: Nunito
- **Body Font**: Poppins
- **Mono Font**: Source Code Pro

- **Display**: Nunito 40px extra-bold, 1.2 line height, 0.02em tracking
- **Headline**: Nunito 32px bold, 1.25 line height, 0.01em tracking
- **Subhead**: Nunito 22px semibold, 1.35 line height
- **Body Large**: Poppins 18px regular, 1.6 line height, 0.01em tracking
- **Body**: Poppins 16px regular, 1.6 line height, 0.01em tracking
- **Body Small**: Poppins 14px regular, 1.5 line height, 0.01em tracking
- **Caption**: Poppins 12px medium, 1.4 line height, 0.02em tracking
- **Overline**: Poppins 11px semibold, 1.4 line height, 0.08em tracking
- **Code**: Source Code Pro 14px regular, 1.6 line height

---

## Spacing

- **Base unit:** 8px
- **Scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96
- **Component padding:** 16px horizontal, 12px vertical (buttons/inputs)
- **Section spacing:** 48px between major sections, 24px between related groups

## Border Radius

- **None** (0px): Rarely used
- **Small** (8px): Chips, small badges
- **Medium** (12px): Inputs, smaller cards
- **Large** (16px): Cards, modals, primary containers
- **XL** (24px): Hero cards, feature panels
- **Full** (9999px): Pills, avatars, toggle tracks

## Elevation

**Philosophy:** Neumorphism-inspired soft shadows that create gentle, comforting depth. Surfaces appear to push softly out of the background rather than float above it.
- **Subtle**: 4px 4px 8px #AEA8BA at 15%, -4px -4px 8px #FFFFFF at 70%
- **Medium**: 6px 6px 14px #AEA8BA at 20%, -6px -6px 14px #FFFFFF at 80%
- **Large**: 10px 10px 24px #AEA8BA at 25%, -10px -10px 24px #FFFFFF at 90%
- **Overlay**: 16px offset, 48px blur, #2D2B32 at 12%
- **Inner**: inset 3px 3px 6px #AEA8BA at 20%, inset -3px -3px 6px #FFFFFF at 70%

## Components

### Buttons
#### Variants
- **Primary**: #7C9A6E fill, #FFFFFF text, no border, #6B8A5D fill, 16px radius, Subtle shadow. Hover: #FFFFFF.
- **Secondary**: #F5F0FB fill, #7C9A6E text, 1px #B4A7D6 border, #EDE6F7 fill, 16px radius, no shadow. Hover: #6B8A5D.
- **Ghost**: transparent fill, #7C9A6E text, no border, #F5F0FB fill, 16px radius, no shadow. Hover: #6B8A5D.
- **Destructive**: #C97A7A fill, #FFFFFF text, no border, #B56B6B fill, 16px radius, Subtle shadow. Hover: #FFFFFF.
#### Sizes
Sizes: Small (36px, 16px, 14px, 600), Medium (44px, 24px, 16px, 600), Large (52px, 32px, 18px, 600).
#### Disabled State
0.45 opacity.
- disabled cursor
- No shadow, no hover change

### Cards
- **Default**: #FFFFFF fill, 1px #E8E4EE border, 16px radius, Subtle shadow, 24px padding.
- **Elevated**: #FFFFFF fill, no border, 16px radius, Medium shadow, 24px padding.
2px outline #B4A7D6 offset 2px focus-visible. Hover: transition to next shadow level (200ms ease).

### Inputs
#### Text Input
- **Default**: #FFFFFF fill, 1px #D1CBD9 border, #2D2B32 text, Inner shadow.
- **Hover**: #FFFFFF fill, 1px #B4A7D6 border, #2D2B32 text, Inner shadow.
- **Focus**: #FFFFFF fill, 2px #7C9A6E border, #2D2B32 text, Inner shadow.
- **Error**: #FFF5F5 fill, 2px #C97A7A border, #2D2B32 text, Inner shadow.
- **Disabled**: #F5F0FB fill, 1px #E8E4EE border, #A8A29E text, no shadow.
12px corners. 44px tall, 12px/16px padding, ** 14px / 600 weight / #2D2B32 / 4px bottom margin **label, ** 12px / 400 weight / #6B6772 / 4px top margin **helper text.

### Chips
#### Filter Chip
#F5F0FB fill, #6B6772 / 13px / 500 weight text, 1px #E8E4EE border, pill shape. 6px/14px padding. Active: Background #7C9A6E, Text #FFFFFF, Border none.
#### Status Chip
pill shape. 12px / 600 weight. Background #EDF5EB, Text #5A7A4E success, Background #FFF6E8, Text #B08930 warning, Background #F0ECF8, Text #7A6FA0 info, 4px/12px padding. Error: Background #FFF0F0, Text #A05A5A.

### Lists
#### Default Item
16px / 400 / #2D2B32 text. 52px tall, 12px/16px padding, 1px #E8E4EE (inset 16px left) divider, 13px / 400 / #6B6772 secondary text. Hover: Background #F5F0FB. Selected: Background #EDF5EB, left border 3px #7C9A6E.

### Checkboxes
20px x 20px, 2px #D1CBD9 border, 6px corners. Checked: Background #7C9A6E, border #7C9A6E, checkmark #FFFFFF. Indeterminate: Background #7C9A6E, dash #FFFFFF. Disabled: Background #F5F0FB, border #E8E4EE, 50% opacity. Labels in 16px / 400 / #2D2B32 8px left gap.

### Radio Buttons
20px x 20px, 2px #D1CBD9 border. Selected: Border #7C9A6E, inner dot 10px #7C9A6E. Disabled: Border #E8E4EE, 50% opacity. Labels in 16px / 400 / #2D2B32 8px left gap.

### Tooltips
#2D2B32 fill, #FFFFFF / 13px / 400 weight text, 8px corners. 8px/12px padding, 240px max width, 6px triangle, matching background arrow, 400ms show, 100ms hide delay, fade + 4px translateY, 150ms ease animation.
---

## Do's and Don'ts

1. **Do** use calming, supportive language (e.g., "Take your time" not "Hurry, complete now").
2. **Do** ensure all color combinations meet WCAG AA contrast (4.5:1 for body text).
3. **Do** use gentle animations (200-400ms ease) to create a soothing experience.
4. **Don't** use alarming red (#E53E3E or similar) for non-critical states; use the soft error tone #C97A7A instead.
5. **Do** provide ample white space between sections to reduce cognitive load.
6. **Don't** use sharp, sudden transitions or jarring micro-interactions.
7. **Do** include optional breathing/pause animations where appropriate for mindfulness features.
8. **Don't** display overwhelming data dumps; progressively disclose information.
9. **Do** design empty states that feel warm and encouraging, not hollow.
10. **Don't** rely solely on color to convey meaning; always pair with icons or text labels.
