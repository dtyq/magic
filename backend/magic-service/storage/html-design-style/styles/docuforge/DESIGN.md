# DocuForge Design System

## Overview

DocuForge is a clean, readable, and navigation-rich design system tailored for API documentation and developer docs sites. It pairs generous whitespace with a structured sidebar navigation, optimized for scanning long reference pages and code examples. The blue-purple-gray palette keeps the interface professional while highlighting interactive elements and syntax. Every component supports both light reading and deep-focus code study.

---

## Colors

- **Primary** (#2563EB): Blue — links, active nav items, primary CTAs
- **Secondary** (#7C3AED): Purple — syntax accents, version badges, API methods
- **Tertiary** (#6B7280): Gray — body text, secondary info, metadata
- **Background** (#FAFAFA): Page background
- **Surface** (#FFFFFF): Content area, cards, panels
- **Success** (#16A34A): GET method badge, 2xx responses
- **Warning** (#CA8A04): Deprecated endpoints, rate limits
- **Error** (#DC2626): DELETE method badge, error responses
- **Info** (#2563EB): Info callouts, note blocks

## Typography

- **Headline Font**: Plus Jakarta Sans
- **Body Font**: Inter
- **Mono Font**: Fira Code

- **Display**: Plus Jakarta Sans 40px extra-bold, 1.15 line height, 0.02em tracking
- **Headline**: Plus Jakarta Sans 30px bold, 1.2 line height, 0.01em tracking
- **Subhead**: Plus Jakarta Sans 22px semibold, 1.3 line height
- **Body Large**: Inter 18px regular, 1.7 line height
- **Body**: Inter 16px regular, 1.7 line height
- **Body Small**: Inter 14px regular, 1.6 line height, 0.01em tracking
- **Caption**: Inter 12px medium, 1.4 line height, 0.02em tracking
- **Overline**: Inter 11px semibold, 1.4 line height, 0.08em tracking
- **Code**: Fira Code 14px regular, 1.7 line height

---

## Spacing

- **Base unit:** 8px
- **Scale:** `4px / 8px / 16px / 24px / 32px / 48px / 64px / 96px`
- **Component padding:** Buttons `10px 20px`, Cards 24px, Inputs `10px 14px`
- **Section spacing:** 48px between docs sections, 64px for page-level breaks
- **Sidebar width:** 280px fixed, 16px internal padding
- **Content max-width:** 768px for prose, 100% for code blocks

## Border Radius

- **None** (0px): Dividers, full-width banners
- **Small** (4px): Inline code, small badges
- **Medium** (8px): Cards, buttons, inputs, panels
- **Large** (12px): Code blocks, callout boxes
- **XL** (16px): Feature cards, hero sections
- **Full** (9999px): Pills, version badges, avatars

## Elevation

- **Subtle**: 1px offset, 2px blur, #000000 at 4%. Cards at rest, table rows.
- **Medium**: 4px offset, 12px blur, #000000 at 6%. Hovered cards, dropdowns.
- **Large**: 12px offset, 32px blur, #000000 at 10%. Modals, expanded panels.
- **Overlay**: 9999px ring #000000 at 35%. Backdrop behind modals.
- **Code**: inset 1px ring #E4E4E7. Code block inset border.

## Components

### Buttons
- **Primary**: #2563EB fill, #FFFFFF text, no border. Hover: #1D4ED8 bg.
- **Secondary**: #FFFFFF fill, #2563EB text, 1px #2563EB border. Hover: #EFF6FF bg.
- **Ghost**: Transparent fill, #52525B text, no border. Hover: #F4F4F5 bg.
- **Destructive**: #DC2626 fill, #FFFFFF text, no border. Hover: #B91C1C bg.
- **Sizes**: Small `32px h / 8px 14px pad`, Medium `38px h / 10px 20px pad`, Large `46px h / 14px 28px pad`
- **Disabled**: 40% opacity, disabled cursor, no hover transition
- **Copy button**: Ghost style with clipboard icon, 8px radius, appears on code block hover

### Cards
- **Default**: #FFFFFF fill, 1px #F4F4F5 border, 1px offset, 2px blur, #000000 at 4% shadow. Hover: shadow transitions to Medium.
- **Elevated**: #FFFFFF fill, no border, 4px offset, 12px blur, #000000 at 6% shadow. Hover: shadow transitions to Large.
Padding: 24px. Border radius: 8px.

### Inputs
- **Default**: 1px #E4E4E7 border, #FFFFFF fill, #52525B label color.
- **Hover**: 1px #D4D4D8 border, #FFFFFF fill, #52525B label color.
- **Focus**: 2px #2563EB border, #FFFFFF fill, #2563EB label color.
- **Error**: 2px #DC2626 border, #FFFFFF fill, #DC2626 label color.
- **Disabled**: 1px #F4F4F5 border, #FAFAFA fill, #A1A1AA label color.
** Inter 14px/500, positioned above with 6px gap **label, ** Inter 12px/400 in #71717A, error helper in #DC2626 **helper text, ** 8px radius, magnifying glass icon prefix, #F4F4F5 background, full-width in sidebar **search input.

### Chips
- **Filter**: #F4F4F5 fill, #52525B text, no border, 4px radius.
- **Status**: varies fill, varies text, no border, 4px radius.
- **Method badges**: GET #F0FDF4 bg / #16A34A text, POST #EFF6FF bg / #2563EB text, PUT #FFF7ED bg / #CA8A04 text, DELETE #FEF2F2 bg / #DC2626 text. All use Fira Code 12px/500.

### Lists
Inter 14px/400 for nav, 16px/400 for content lists text. 40px (sidebar nav), 48px (parameter lists) row height, 1px #F4F4F5 divider, #F4F4F5 hover background, #EFF6FF background, #2563EB text, 2px #2563EB left border active/selected, indent 16px per level, max 3 levels sidebar nav depth.

### Checkboxes
16px square, 4px radius, 1.5px #D4D4D8 border. 8px label gap. Checked: #2563EB fill, white checkmark. Indeterminate: #2563EB fill, white dash. Disabled: #F4F4F5 fill, #E4E4E7 border.

### Radio Buttons
16px circle, 1.5px #D4D4D8 border. 8px label gap. Selected: #2563EB outer ring, #2563EB inner dot (6px). Disabled: #F4F4F5 fill, #E4E4E7 border.

### Tooltips
#18181B fill, #FFFFFF, Inter 12px/400 text, 6px border radius, 4px offset, 12px blur, #000000 at 15% shadow. `4px/10px` padding, 5px CSS triangle arrow, 280px max width.
---

## Do's and Don'ts

1. **Do** use Fira Code for all code examples, inline code, and method badges.
2. **Do** maintain a 768px max-width for prose content to ensure optimal reading comfort.
3. **Do** use the method badge color system consistently across all API endpoint references.
4. **Don't** mix purple and blue in the same interactive context; blue is for navigation, purple for syntax.
5. **Don't** hide the sidebar on desktop; persistent navigation is critical for docs usability.
6. **Don't** use shadows on code blocks; use the inset border style instead.
7. **Do** provide a search input at the top of the sidebar with keyboard shortcut hints.
8. **Don't** use overline or caption sizes for code; 14px is the minimum for code readability.
9. **Do** use generous line height (1.7) for both prose and code to support scanning.
10. **Don't** place interactive buttons inside code blocks beyond the copy action.
