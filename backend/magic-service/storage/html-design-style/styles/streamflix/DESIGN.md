# StreamFlix Design System

## Overview

StreamFlix is a dark, binge-worthy design system tailored for video streaming and media catalog platforms. It prioritizes large content thumbnails within dense grid layouts, accented with bold red on deep black surfaces. The system uses colored hover glows and sharp, cinematic typography to create an engaging content-browsing experience.

---

## Colors

- **Color Primary** (#E11D48): Primary actions, branding
- **Color Secondary** (#0F0F0F): Dark surfaces, backgrounds
- **Color Tertiary** (#F5F5F5): Light text, contrast elements
- **Surface Base** (#0F0F0F): Page background
- **Color Success** (#22C55E): Downloaded, available
- **Color Warning** (#F59E0B): Expiring soon
- **Color Error** (#EF4444): Errors, unavailable
- **Color Info** (#3B82F6): New, updated content

## Typography

- **Headline Font**: Oswald
- **Body Font**: Open Sans
- **Mono Font**: JetBrains Mono

- **h1**: 40px bold, 1.15 line height. Hero titles.
- **h2**: 32px bold, 1.2 line height. Row headings.
- **h3**: 24px medium, 1.25 line height. Detail page titles.
- **h4**: 18px medium, 1.3 line height. Card titles.
- **body**: 16px regular, 1.5 line height. Descriptions.
- **small**: 14px regular, 1.5 line height. Metadata, runtime.
- **xs**: 12px semibold, 1.4 line height. Badges, ratings.

---

## Spacing

Base unit: **8px**.
- **xs**: 4px — Inline icon gaps
- **sm**: 8px — Grid gutters, chip gaps
- **md**: 16px — Card padding
- **lg**: 24px — Row spacing
- **xl**: 32px — Section margins
- **2xl**: 48px — Hero spacing
- **3xl**: 64px — Top-level layout breaks

## Border Radius

- **radius-sm** (4px): Chips, badges
- **radius-md** (8px): Cards, buttons, inputs
- **radius-lg** (12px): Modals, large panels
- **radius-full** (9999px): Avatars, icon buttons

## Elevation

Colored shadow system with red glow on hover for cinematic depth.
- **shadow-sm**: 2px offset, 4px blur, #000000 at 50%. Resting cards.
- **shadow-md**: 4px offset, 12px blur, #000000 at 60%. Hovered elements.
- **shadow-lg**: 8px offset, 24px blur, #000000 at 70%. Modals, overlays.
- **shadow-red**: 4px offset, 20px blur, #E11D48 at 40%. Primary CTA glow.
- **shadow-hover**: 8px offset, 30px blur, #E11D48 at 30%. Thumbnail hover.

## Components

### Buttons
#### Variants
- **Primary**: #E11D48 fill, #FFFFFF text, no border, #BE123C fill.
- **Secondary**: #262626 fill, #F5F5F5 text, no border, #374151 fill.
- **Ghost**: transparent fill, #F5F5F5 text, 1px #525252 border, #262626 fill.
- **Destructive**: #EF4444 fill, #FFFFFF text, no border, #DC2626 fill.
#### Sizes
Sizes: Small (8px 16px, 14px, 32px), Medium (10px 24px, 16px, 40px), Large (12px 32px, 18px, 48px).
#### Disabled State
0.35 opacity.
- disabled cursor
- No hover, glow, or focus effects applied

### Cards
- **Default**: #1A1A1A fill, 1px #262626 border, shadow-sm shadow. Hover: shadow-hover.
- **Elevated**: #1A1A1A fill, no border, shadow-md shadow. Hover: scale(1.05), shadow-hover.
radius-md (8px) border radius. 0/(image/bleeds/to/edge),/12px/bottom/for/text padding.

### Inputs
- **Default**: 1px #262626 border, #1A1A1A fill.
- **Hover**: 1px #525252 border, #1A1A1A fill.
- **Focus**: 2px #E11D48 border, #1A1A1A fill, 3px ring #E11D48 at 25% shadow.
- **Error**: 2px #EF4444 border, #1A1A1A fill, 3px ring #EF4444 at 25% shadow.
- **Disabled**: 1px #262626 border, #0F0F0F fill, none; 40% opacity shadow.
14px, Open Sans 600, content-primary, 4px bottom margin **label**, 12px, Open Sans 400, content-tertiary, 4px top margin; error helper uses color-error **helper text**, 10px/14px;/border/radius:/radius-md padding.

### Chips
- **Filter**: #E11D4820 fill, #E11D48 text, 1px #E11D4840 border.
- **Status**: varies by severity fill, varies text, no border.
success #052E16/#22C55E, warning #451A03/#F59E0B, error #450A0A/#EF4444 status colors, 4px/10px;/font-size:/12px;/border-radius:/radius-sm padding.

### Lists
16px Open Sans content-primary. 56px; padding: 0 16px row height, 1px #262626 divider. Hover: background #1A1A1A. Active: background #E11D4815, text color #E11D48.

### Checkboxes
20px square; border-radius: 4px. 8px; label font: 16px Open Sans, content-primary label gap. Unchecked: 2px #525252, background #1A1A1A. Checked: background #E11D48, white checkmark icon. Focus: 3px ring #E11D48 at 25%.

### Radio Buttons
20px circle; border-radius: 50%. 8px; label font: 16px Open Sans, content-primary label gap. Unchecked: 2px #525252, background #1A1A1A. Selected: 2px #E11D48, inner dot 10px #E11D48. Focus: 3px ring #E11D48 at 25%.

### Tooltips
#262626; text: #F5F5F5; font: 12px Open Sans fill. 6px/12px;/border-radius:/radius-sm padding, 6px; max-width: 240px arrow, 200ms show, 0ms hide delay.
---

## Do's and Don'ts

1. **Do** use the red glow shadow on thumbnail hover to draw attention to browseable content.
2. **Do** let thumbnails dominate the layout; text is secondary to visual content.
3. **Do** use Oswald in uppercase for category row headings to create cinematic impact.
4. **Don't** use light backgrounds; the entire experience must remain dark for immersive viewing.
5. **Don't** overuse the primary red outside of CTAs and branding; most UI should be neutral grays.
6. **Do** apply scale transforms (1.03-1.05) on card hover for a lively browsing feel.
7. **Don't** use heavy borders on content cards; shadows and subtle dividers are preferred.
8. **Do** keep the navigation bar at surface-sunken to visually anchor the page.
9. **Don't** set body text below 14px on dark backgrounds to preserve readability at distance.
10. **Do** reserve the red primary exclusively for play buttons, subscribe CTAs, and the brand logo.
