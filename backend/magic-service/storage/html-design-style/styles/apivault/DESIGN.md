# APIVault Design System

## Overview

APIVault is a structured, endpoint-organized design system built for API management and testing platforms. It emphasizes clarity through monospaced headings, logical grouping of request/response data, and a color palette that distinguishes HTTP methods at a glance. The system prioritizes scannable hierarchies and dense but readable information architecture. Every element is designed to make complex API documentation approachable and navigable.

---

## Colors

- **Primary** (#4F46E5): Indigo -- main actions, active endpoints
- **Secondary** (#059669): Green -- success states, GET methods
- **Tertiary** (#EA580C): Orange -- warnings, PUT/PATCH methods
- **Background** (#F8FAFC): Page background
- **Surface** (#FFFFFF): Cards, panels, modals
- **Success** (#059669): 2xx responses, valid schemas
- **Warning** (#EA580C): Deprecation notices, rate limits
- **Error** (#DC2626): 4xx/5xx responses, failures
- **Info** (#4F46E5): Informational badges, tips

## Typography

- **Headline Font**: IBM Plex Mono
- **Body Font**: Inter
- **Mono Font**: IBM Plex Mono

- **Display**: IBM Plex Mono 32px semibold, 40px line height
- **Headline**: IBM Plex Mono 24px semibold, 32px line height
- **Subhead**: IBM Plex Mono 18px semibold, 28px line height
- **Body Large**: Inter 16px regular, 26px line height
- **Body**: Inter 14px regular, 22px line height
- **Body Small**: Inter 13px regular, 20px line height
- **Caption**: Inter 12px medium, 18px line height
- **Overline**: IBM Plex Mono 11px semibold, 16px line height
- **Code**: IBM Plex Mono 13px regular, 20px line height

---

## Spacing

- **Base unit:** 4px
- **Scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96
- **Component padding:** 8px (compact) | 12px (default) | 16px (relaxed)
- **Section spacing:** 32px between major sections, 16px between related groups
- **Endpoint cards:** 12px internal padding, 8px between method badge and path

## Border Radius

- **None** (0px): Code blocks, full-width dividers
- **Small** (3px): Method badges, status indicators
- **Medium** (6px): Cards, inputs, buttons
- **Large** (10px): Modals, expanded panels
- **XL** (14px): Popovers, floating menus
- **Full** (9999px): Pill tags, avatar circles

## Elevation

- **Subtle**: 1px offset, 2px blur, #0F172A at 5%. Cards, resting state.
- **Medium**: 2px offset, 8px blur, #0F172A at 8%. Dropdowns, hover cards.
- **Large**: 8px offset, 24px blur, #0F172A at 12%. Modals, expanded views.
- **Overlay**: 16px offset, 48px blur, #0F172A at 16%. Full-screen overlays.

## Components

### Buttons
- **Primary**: #4F46E5 fill, #FFFFFF text, no border, #4338CA fill.
- **Secondary**: #FFFFFF fill, #4F46E5 text, 1px #4F46E5 border, #EEF2FF fill.
- **Ghost**: transparent fill, #475569 text, no border, #F1F5F9 fill.
- **Destructive**: #DC2626 fill, #FFFFFF text, no border, #B91C1C fill.
- **Sizes**: Small (28px height, 12px pad) | Medium (36px, 16px) | Large (44px, 20px)
- **Disabled**: 50% opacity, disabled cursor, no hover state changes

### Cards
** Background #FFFFFF, border 1px #E2E8F0, radius 6px, padding 16px, shadow Subtle **default, ** Background #FFFFFF, no border, radius 6px, padding 16px, shadow Medium **elevated.
- Endpoint cards display method badge (GET/POST/PUT/DELETE) left-aligned with path in monospace

### Inputs
- **Default**: #CBD5E1 border, #FFFFFF fill, no shadow.
- **Hover**: #94A3B8 border, #FFFFFF fill, no shadow.
- **Focus**: #4F46E5 border, #FFFFFF fill, 3px ring #4F46E5 at 15% shadow.
- **Error**: #DC2626 border, #FEF2F2 fill, 3px ring #DC2626 at 10% shadow.
- **Disabled**: #E2E8F0 border, #F8FAFC fill, no shadow.
** 13px, weight 500, color Text Primary, 4px below label **label, ** 12px, color Text Secondary; error helper uses Error color **helper text.

### Chips
** Background #EEF2FF, text #4F46E5, radius Full, padding 4px 10px, toggleable **filter chip, ** Semantic background at 10% opacity, semantic text color, radius Full, padding 4px 10px **status chip, GET=green, POST=indigo, PUT=orange, DELETE=red http method chips.

### Lists
40px, padding 8px 12px row height, 1px #E2E8F0 between rows divider, background #EEF2FF, left border 2px #4F46E5 active/selected. Hover: background #F8FAFC.
- Endpoint lists show method badge, path, and description in a three-column layout

### Checkboxes
16px square, radius 3px. Unchecked: border 2px #CBD5E1, background transparent. Checked: background #4F46E5, white checkmark icon. Focus: ring 3px ring #4F46E5 at 20%. Disabled: 40% opacity.

### Radio Buttons
16px circle. border 2px #CBD5E1, background transparent unselected. Selected: border 2px #4F46E5, inner dot 8px #4F46E5. Focus: ring 3px ring #4F46E5 at 20%. Disabled: 40% opacity.

### Tooltips
#0F172A, text: #FFFFFF, radius 6px, padding 6px 10px fill. 12px Inter regular. 6px, matching background arrow, 240px max width, 300ms show, 100ms hide delay.
---

## Do's and Don'ts

1. **Do** use monospaced type for all endpoint paths, parameters, and code references.
2. **Do** color-code HTTP methods consistently (GET=green, POST=indigo, PUT=orange, DELETE=red).
3. **Do** group endpoints by resource with clear section headers.
4. **Don't** use decorative elements that distract from the structured data hierarchy.
5. **Don't** mix endpoint card styles within the same view or panel.
6. **Do** show request/response examples in syntax-highlighted code blocks.
7. **Don't** hide critical status codes or error information behind extra clicks.
8. **Do** maintain consistent vertical rhythm using the 4px spacing grid.
9. **Don't** use color as the sole indicator of HTTP method or status -- always include text labels.
10. **Do** provide visual separation between request parameters, headers, and body sections.
