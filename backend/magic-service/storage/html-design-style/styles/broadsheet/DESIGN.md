# Broadsheet Design System

## Overview

Broadsheet is a newspaper-inspired design system built for online newspapers and journalism platforms. It channels the authoritative presence of traditional print broadsheets through a column-grid layout, serif typography, and a restrained palette of black, red, and gray. The design is deliberately flat and sharp-edged, treating digital screens like printed pages.

---

## Colors

- **Color Primary** (#0A0A0A): Headlines, primary actions
- **Color Secondary** (#DC2626): Breaking news, urgent indicators
- **Color Tertiary** (#4B5563): Bylines, metadata, captions
- **Surface Base** (#FFFFFF): Page background
- **Color Success** (#16A34A): Published, live
- **Color Warning** (#D97706): Developing story
- **Color Error** (#DC2626): Breaking, retractions
- **Color Info** (#2563EB): Updates, links

## Typography

- **Headline Font**: Libre Baskerville
- **Body Font**: Source Serif Pro
- **Mono Font**: IBM Plex Mono

- **h1**: 48px bold, 1.15 line height. Banner headlines.
- **h2**: 36px bold, 1.2 line height. Section leads.
- **h3**: 28px bold, 1.25 line height. Article titles.
- **h4**: 22px bold, 1.3 line height. Sidebar heads.
- **body**: 18px regular, 1.7 line height. Article body.
- **small**: 14px regular, 1.5 line height. Bylines, captions.
- **xs**: 12px semibold, 1.4 line height. Labels, categories.

---

## Spacing

Base unit: **8px**.
- **xs**: 4px — Inline icon gaps
- **sm**: 8px — Tight padding
- **md**: 16px — Standard card padding
- **lg**: 24px — Column gaps
- **xl**: 32px — Section breaks
- **2xl**: 48px — Major separators
- **3xl**: 64px — Top-of-page margins

## Border Radius

- **radius-none** (0px): All elements (default)
All elements use sharp corners (0px) to maintain the print newspaper aesthetic. No rounded corners anywhere in the system.

## Elevation

No shadows are used. The Broadsheet system relies entirely on borders, rules, and whitespace for visual hierarchy, following the flat newspaper aesthetic.
- **shadow-none**: none. Default for all.
Use border-strong (1-2px #0A0A0A) rules and border-default (1px #E5E7EB) dividers to create separation instead.

## Components

### Buttons
#### Variants
- **Primary**: #0A0A0A fill, #FFFFFF text, no border, #1F2937 fill.
- **Secondary**: transparent fill, #0A0A0A text, 2px #0A0A0A border, #F3F4F6 fill.
- **Ghost**: transparent fill, #0A0A0A text, no border, #F3F4F6 fill.
- **Destructive**: #DC2626 fill, #FFFFFF text, no border, #B91C1C fill.
#### Sizes
Sizes: Small (6px 16px, 14px, 32px), Medium (8px 24px, 16px, 40px), Large (12px 32px, 18px, 48px).
#### Disabled State
0.4 opacity.
- disabled cursor
- No hover or focus effects applied

### Cards
- **Default**: #FFFFFF fill, 1px #E5E7EB border, no shadow. Hover: border-color #0A0A0A.
- **Elevated**: #FFFFFF fill, 2px #0A0A0A (top only) border, no shadow. Hover: background #F9FAFB.
0px border radius. 16px padding.

### Inputs
- **Default**: 1px #D1D5DB border, #FFFFFF fill.
- **Hover**: 1px #9CA3AF border, #FFFFFF fill.
- **Focus**: 2px #0A0A0A border, #FFFFFF fill.
- **Error**: 2px #DC2626 border, #FEF2F2 fill.
- **Disabled**: 1px #E5E7EB border, #F9FAFB fill, none; 50% opacity shadow.
12px, Source Serif Pro 600, content-primary, uppercase, tracking 0.5px, 4px bottom margin **label**, 12px, Source Serif Pro 400, content-tertiary, 4px top margin; error helper uses color-error **helper text**, 10px/12px;/border/radius:/0px padding.

### Chips
- **Filter**: #0A0A0A fill, #FFFFFF text, no border.
- **Status**: varies by severity fill, varies text, no border.
success #DCFCE7/#166534, warning #FEF3C7/#92400E, error #FEE2E2/#991B1B status colors, 4px/12px;/font-size:/11px;/uppercase;/letter-spacing:/0.5px;/border-radius:/0px padding.

### Lists
16px Source Serif Pro content-primary. 44px; padding: 0 16px row height, 1px #E5E7EB divider. Hover: background #F9FAFB. Active: font-weight 700, border-left 3px #0A0A0A.

### Checkboxes
18px square; border-radius: 0px. 8px; label font: 16px Source Serif Pro label gap. Unchecked: 2px #D1D5DB, background #FFFFFF. Checked: background #0A0A0A, white checkmark icon. Focus: 2px dashed #0A0A0A offset 2px.

### Radio Buttons
18px circle; border-radius: 50%. 8px; label font: 16px Source Serif Pro label gap. Unchecked: 2px #D1D5DB, background #FFFFFF. Selected: 2px #0A0A0A, inner dot 8px #0A0A0A. Focus: 2px dashed #0A0A0A offset 2px.

### Tooltips
#0A0A0A; text: #FFFFFF; font: 12px Source Serif Pro fill. 6px/12px;/border-radius:/0px padding, 6px; max-width: 280px arrow, 300ms show, 0ms hide delay.
---

## Do's and Don'ts

1. **Do** use horizontal rules (1-2px black) to separate sections, mimicking newspaper column dividers.
2. **Do** rely on serif typography at generous line heights for comfortable long-form reading.
3. **Do** reserve the secondary red exclusively for breaking news, urgent alerts, and destructive actions.
4. **Don't** add border-radius to any element; the system demands sharp, print-style corners throughout.
5. **Don't** use drop shadows or glows; hierarchy comes from borders, weight, and whitespace only.
6. **Do** use uppercase 12px labels with tracking for category tags and metadata.
7. **Don't** use bright accent colors beyond the defined red; the palette is intentionally restrained.
8. **Do** maintain a strong vertical rhythm using the 8px spacing grid across all column layouts.
9. **Don't** center-align body text; always left-align for readability, as in traditional newspapers.
10. **Do** use the tertiary gray for all secondary information like dates, bylines, and read-time estimates.
