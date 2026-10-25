# Auction Quad

## Overview
Auction Quad is a vibrant, multi-color marketplace design system built for commerce at scale. Its signature four-color palette of blue, red, yellow, and green creates instant brand recognition while supporting a dense, grid-heavy product listing interface. The aesthetic is energetic, trustworthy, and optimized for browsing large catalogs.

## Colors
- **Primary** (#0064D2): Primary actions, links, selected states — eBay Blue
- **Primary Hover** (#004FB3): Hovered buttons, active links
- **Secondary** (#E53238): Urgency indicators, sale badges, watching — eBay Red
- **Accent Yellow** (#F5AF02): Stars, ratings, featured highlights — eBay Yellow
- **Accent Green** (#86B817): Deals, savings, positive outcomes — eBay Green
- **Background** (#F7F7F7): Page canvas, listing grid background
- **Surface** (#FFFFFF): Product cards, detail panels, modals
- **Text Primary** (#191919): Headings, product titles, prices
- **Text Secondary** (#707070): Descriptions, seller info, metadata
- **Border** (#E5E5E5): Card borders, dividers, input outlines
- **Success** (#86B817): Bid won, item shipped, delivery confirmed
- **Warning** (#F5AF02): Bidding closing soon, high demand, price alert
- **Error** (#E53238): Bid failed, item unavailable, payment error

## Typography
- **Display Font**: DM Sans — loaded from Google Fonts
- **Body Font**: DM Sans — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

DM Sans delivers a modern, clean foundation for a marketplace that handles everything from electronics to collectibles. Use weights 400 (body, descriptions), 500 (labels, metadata), and 700 (headings, prices). Letter-spacing -0.01em for headings, 0em for body. Line height 1.4 for product titles (compact), 1.5 for descriptions. Prices use 700 weight and slightly larger size for quick scanning.

Type scale:
- Display: 36px / 700
- H1: 28px / 700
- H2: 22px / 700
- H3: 18px / 500
- Body: 14px / 400
- Body Small: 13px / 400
- Caption: 11px / 500
- Price Large: 24px / 700
- Price Small: 16px / 700
- Strikethrough Price: 14px / 400, #707070, line-through

## Elevation
Clean, commerce-friendly elevation. Level 0 (flat) for listing grid items at rest. Level 1 (`0 1px 3px rgba(25,25,25,0.08)`) for cards on hover, creating a "pick up" effect. Level 2 (`0 4px 12px rgba(25,25,25,0.1)`) for dropdowns, filter panels, and image zoom overlays. Level 3 (`0 8px 24px rgba(25,25,25,0.14)`) for modals, cart drawer, and checkout overlays.

## Components
- **Buttons**: 40px height, 20px horizontal padding, 9999px border-radius (pill shape), DM Sans 700 at 14px. Primary: #0064D2 bg, white text. Secondary: white bg, #0064D2 text, 1px #0064D2 border. Bid: #191919 bg, white text. Urgent: #E53238 bg, white text. Disabled: #E5E5E5 bg, #707070 text.
- **Cards**: White background, 1px #E5E5E5 border, 8px border-radius, 0 padding (image flush top). Image: aspect-ratio 1:1, object-fit cover. Content: 12px padding. Title: 14px/500, 2-line clamp. Price: 16px/700. Seller: 12px/400 #707070. Hover: Level 1 shadow, border-color #0064D2.
- **Inputs**: 40px height, 12px horizontal padding, 8px border-radius, 1px #E5E5E5 border. Focus: 2px #0064D2 border. Error: 1px #E53238 border. Bid input: price prefix "$" in #707070, JetBrains Mono for amount.
- **Chips**: 28px height, 12px horizontal padding, 9999px border-radius. Filter active: #0064D2 bg, white text. Filter inactive: white bg, #191919 text, 1px #E5E5E5 border. Condition: #F7F7F7 bg, #191919 text. Sale: #E53238 bg, white text.
- **Lists**: Listing rows (list view) 120px height, image 96x96 left, title/details center, price/bid right. Hover #F7F7F7 bg. Divider: 1px #E5E5E5. Auction items: countdown timer in #E53238.
- **Checkboxes**: 18px square, 4px border-radius, 1.5px #E5E5E5 border. Checked: #0064D2 bg, white checkmark. Used in filter panels and bulk selection.
- **Tooltips**: #191919 bg, white text at 12px, 6px border-radius, 6px 10px padding. Used for seller ratings and item condition details.
- **Navigation**: Top bar 48px, white bg, bottom 1px #E5E5E5 border. Logo left (multicolor wordmark), category nav (14px/500, hover #0064D2 underline), search center (flex-1), cart/user icons right. Category mega-menu: Level 2 shadow, 3-column grid.
- **Search**: 44px height, flex-1, 9999px border-radius, #F7F7F7 bg, 1px #E5E5E5 border, magnifying glass right. Focus: white bg, 2px #0064D2 border. Category dropdown left (select within search bar). Results: product image thumbnail 40px, title, price.

## Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
- Component padding: Buttons 10px 20px, Cards 0/12px, Inputs 10px 12px
- Section spacing: 40px between major sections, 16px between related groups
- Container max width: 1280px, centered with 16px side padding
- Card grid gap: 16px (4-column desktop), 12px (2-column mobile)

## Border Radius
- 4px: Checkboxes, small inline badges
- 8px: Cards, inputs, dropdowns, image containers
- 12px: Panels, modals, filter drawers
- 16px: Hero banners, promotional cards
- 9999px: Buttons, chips, search bar, avatars, rating pills

## Do's and Don'ts
- Do use the four brand colors (blue, red, yellow, green) in distinct functional roles
- Do keep product images at 1:1 aspect ratio for consistent grid alignment
- Don't use red (#E53238) for general actions; reserve it for urgency and sales
- Do show prices prominently at 700 weight; they are the most scanned element
- Don't mix the four brand colors in a single UI element; each has its role
- Do use pill-shaped (9999px) buttons for all CTAs; it is the signature shape
- Don't overload product cards with information; title, price, and seller rating suffice
- Do provide visual countdown timers for auction items using the red accent
- Don't forget strikethrough pricing for sale items; it drives urgency
