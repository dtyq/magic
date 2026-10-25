# ShopVibe

Trendy, energetic, conversion-focused.

## Overview

ShopVibe is a design system crafted for fashion and lifestyle e-commerce storefronts that demand visual punch and effortless conversion. The spacious layout philosophy ensures products have the breathing room to shine, with generous whitespace framing hero imagery. A bold fuchsia primary drives urgency on CTAs, while cyan and yellow accents inject youthful energy. Every element is tuned to move shoppers from browse to checkout with minimal friction.

## Colors

- **Primary** (#D946EF): Primary CTAs, add-to-cart buttons, active navigation
- **Secondary** (#22D3EE): Sale badges, promotional banners, link hovers
- **Tertiary** (#FACC15): Star ratings, loyalty rewards, highlight accents
- **Background** (#FAFAFA): Global page background, clean and airy
- **Surface** (#FFFFFF): Product cards, modals, cart drawer
- **Success** (#22C55E)
- **Warning** (#F59E0B)
- **Error** (#EF4444)
- **Info** (#3B82F6)

## Typography

- **Headline Font**: Poppins
- **Body Font**: Nunito
- **Mono Font**: Space Mono

- **Display**: Poppins 56px extra-bold, 1.1 line height, 0.02em tracking. Hero banners, sale headlines.
- **Headline**: Poppins 40px bold, 1.2 line height, 0.01em tracking. Collection titles, category headers.
- **Subhead**: Poppins 26px semibold, 1.3 line height, 0.005em tracking. Section titles, promo headings.
- **Body Large**: Nunito 18px regular, 1.6 line height. Product descriptions lead.
- **Body**: Nunito 16px regular, 1.6 line height. Default body text.
- **Body Small**: Nunito 14px regular, 1.5 line height. Reviews, secondary details.
- **Caption**: Nunito 12px medium, 1.4 line height, 0.02em tracking. Size labels, stock status.
- **Overline**: Nunito 11px bold, 1.2 line height, 0.1em tracking. Category tags, new arrivals badge (uppercase).
- **Code**: Space Mono 14px regular, 1.5 line height. Promo codes, order IDs.

## Spacing

- **Base unit:** 8px
- **Scale:** 4, 8, 12, 16, 24, 32, 48, 64, 96, 128
- **Component padding:** 8px (small), 16px (medium), 24px (large)
- **Section spacing:** 56px (mobile), 80px (tablet), 112px (desktop)

## Border Radius

- **None:** 0px — Product image overlays, full-bleed banners
- **Small:** 4px — Badges, inline tags
- **Medium:** 12px — Cards, inputs, dropdowns
- **Large:** 16px — Product cards, image containers, modals
- **XL:** 24px — Promotional banners, feature sections
- **Full:** 9999px — CTA pill buttons, avatars, quantity selectors

## Elevation

ShopVibe uses Material-style layered shadows to create a tactile, shoppable card interface.
- **Subtle:** 1px offset, 3px blur, #000000 at 6%; 1px offset, 2px blur, #000000 at 4%
- **Medium:** 4px offset, 6px blur, #000000 at 7%; 2px offset, 4px blur, #000000 at 5%
- **Large:** 10px offset, 25px blur, #000000 at 10%; 6px offset, 10px blur, #000000 at 6%
- **Overlay:** 25px offset, 50px blur, #000000 at 15%; 12px offset, 24px blur, #000000 at 8%
- **Product Hover:** 14px offset, 32px blur, #D946EF at 12%; 6px offset, 12px blur, #000000 at 6% — Fuchsia-tinted lift on product cards

## Components

### Buttons
**Primary (Filled)** — `bg: #D946EF`, `text: #FFFFFF`, `font: Nunito 15px/700`, `padding: 12px 28px`, `radius: 9999px`, `hover: #C026D3`, `active: #A21CAF`
**Secondary (Outline)** — `bg: transparent`, `text: #D946EF`, `border: 2px #D946EF`, `radius: 9999px`, `hover: bg #FDF4FF`
**Ghost** — `bg: transparent`, `text: #525252`, `hover: bg #F5F5F5`
**Destructive** — `bg: #EF4444`, `text: #FFFFFF`, `radius: 9999px`, `hover: #DC2626`
- **Sizes**: Small `34px h / 12px 18px`, Medium `42px h / 12px 28px`, Large `50px h / 14px 36px`
- **Disabled**: 40% opacity, disabled cursor

### Cards
**Default** — `bg: #FFFFFF`, `border: 1px #E5E5E5`, `radius: 16px`, `padding: 0 (image flush) / 16px (content)`, `hover: border #D4D4D4`
**Elevated** — `shadow: Medium`, `hover: shadow Large with translateY(-3px) transition 200ms`

### Inputs
**Text Input** — `bg: #FFFFFF`, `border: 1.5px #D4D4D4`, `text: #171717`, `placeholder: #A3A3A3`, `radius: 12px`, `padding: 0 16px`, `height: 44px`, `font: Nunito 16px/400`, `focus: border #D946EF, ring 3px ring #D946EF at 15%, `error: border #EF4444, ring #EF4444 at 15%, `disabled: bg #F5F5F5, 50% opacity`
- **Label**: top, Nunito, 13px, 600, #171717
- **Helper text**: 12px, #525252

### Chips
**Filter Chip** — `height: 34px`, `padding: 0 14px`, `radius: 9999px`, `border: 1.5px #D4D4D4`, `selected: bg #D946EF, text #FFFFFF, border #D946EF`, `hover: bg #F5F5F5`
**Status Chip** — Success: `bg #DCFCE7, text #166534` / Warning: `bg #FEF9C3, text #854D0E` / Error: `bg #FEE2E2, text #991B1B`

### Lists
**Default List Item** — `height: 48px`, `padding: 0 16px`, `font: Nunito 16px/400`, `divider: 1px #E5E5E5`, `hover: bg #FAFAFA`, `selected: bg #FDF4FF, text #D946EF`, `icon variant: 22px icon, 14px gap`

### Checkboxes
20px, border: 2px #D4D4D4, radius: 6px, checked: bg #D946EF border #D946EF with white checkmark, indeterminate: bg #D946EF with white dash, disabled: 40% opacity, label: Nunito 14px/400 with 10px gap.

### Radio Buttons
20px, border: 2px #D4D4D4, selected: border #D946EF with 6px inner dot #D946EF, disabled: 40% opacity, label: Nunito 14px/400 with 10px gap.

### Tooltips
#171717, text: #FFFFFF, font: Nunito 12px/500, padding: 8px 12px, radius: 8px, max-width: 200px, arrow: 6px, delay: 200ms, position: top preferred fill.

## Do's and Don'ts
- **Do** use high-quality product photography with consistent aspect ratios across grids.
- **Do** make the primary CTA ("Add to Bag") the most visually prominent element on every product card.
- **Do** show urgency cues (low stock, limited time) near the CTA, not buried in descriptions.
- **Do** keep the cart drawer accessible from every page; never force a full page redirect.
- **Do** use the secondary cyan for sale/promo pricing and strikethrough the original in Text Tertiary.
- **Don't** use more than one animated element per viewport; competing motion distracts from products.
- **Don't** auto-open newsletter popups before a user has scrolled at least 50% of the page.
- **Don't** place product descriptions in font sizes below Body Small (14px); readability drives trust.
- **Don't** hide the price or shipping estimate behind a click; transparency reduces cart abandonment.
- **Don't** use fuchsia for non-interactive decorative elements; reserve it strictly for actionable targets.
