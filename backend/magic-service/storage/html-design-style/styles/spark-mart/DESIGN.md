# Spark Mart

## Overview
Spark Mart is a mass-retail design system built for accessibility, value, and scale. It pairs a confident corporate blue with an energetic spark yellow on clean white surfaces. The aesthetic is approachable and efficient, designed to serve millions of customers across web, mobile, and in-store digital touchpoints. Every element communicates value, trust, and ease.

## Colors
- **Primary** (#0071CE): Primary actions, navigation, links, brand identity — Walmart Blue
- **Primary Hover** (#005BA1): Hovered buttons, active states
- **Secondary** (#FFC220): Highlights, savings badges, spark accents — Spark Yellow
- **Neutral** (#74767C): Secondary text, icons, placeholders
- **Background** (#F2F2F2): Page background, category sections
- **Surface** (#FFFFFF): Product cards, panels, checkout containers
- **Text Primary** (#041E42): Headings, prices, primary content — Dark Navy
- **Text Secondary** (#74767C): Descriptions, metadata, fine print
- **Border** (#D6D6D6): Card borders, input outlines, dividers
- **Success** (#2E7D32): In stock, delivery confirmed, savings callout
- **Warning** (#F57C00): Limited stock, price drop alert
- **Error** (#C62828): Out of stock, payment error, invalid input

## Typography
- **Display Font**: Nunito Sans — loaded from Google Fonts
- **Body Font**: Nunito Sans — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Nunito Sans provides a friendly, highly readable typeface that works at every size from mobile product tiles to large store signage. Use weights 400 (body), 600 (labels, subheadings), and 700 (headings, prices). Letter-spacing 0em throughout. Line height 1.5 for body, 1.25 for headings. Prices always use 700 weight. Savings and rollback amounts use #2E7D32 green at 600 weight.

Type scale:
- Display: 36px / 700
- H1: 28px / 700
- H2: 22px / 700
- H3: 18px / 600
- Body: 16px / 400
- Body Small: 14px / 400
- Caption: 12px / 400
- Price Large: 28px / 700
- Price Small: 18px / 700
- Was Price: 14px / 400, #74767C, line-through
- Savings: 14px / 600, #2E7D32

## Elevation
Practical, functional elevation for large-scale retail. Level 0 (flat) for most content. Level 1 (`0 1px 3px rgba(4,30,66,0.06)`) for product cards and panels. Level 2 (`0 4px 12px rgba(4,30,66,0.1)`) for dropdown menus, cart flyout, and store selector. Level 3 (`0 8px 24px rgba(4,30,66,0.14)`) for modals and checkout overlay. Use borders alongside shadows for clarity.

## Components
- **Buttons**: 44px height, 20px horizontal padding, 9999px border-radius, Nunito Sans 700 at 15px. Primary: #0071CE bg, white text. Secondary: white bg, #0071CE text, 2px #0071CE border. Add to Cart: #0071CE bg, white text, cart icon 16px left. Yellow CTA: #FFC220 bg, #041E42 text (used sparingly for hero actions). Disabled: #D6D6D6 bg, #74767C text.
- **Cards**: White bg, 1px #D6D6D6 border, 8px border-radius, 16px padding. Product image: centered, 200x200px max. Title: 14px/600, 2-line clamp. Price: 18px/700 #041E42. Rating: 5-star row, yellow fill #FFC220, 13px count. Add button: full-width at bottom, 36px.
- **Inputs**: 44px height, 14px horizontal padding, 8px border-radius, 1px #D6D6D6 border. Focus: 2px #0071CE border. Error: 1px #C62828 border with message below. Quantity input: compact 64px width, +/- buttons flanking, center-aligned number.
- **Chips**: 30px height, 12px horizontal padding, 9999px border-radius. Category: white bg, #041E42 text, 1px #D6D6D6 border. Active: #0071CE bg, white text. Savings: #FFC220 bg, #041E42 text. Clearance: #C62828 bg, white text.
- **Lists**: Product list rows 80px height, image 64px left, title/brand center, price right. Hover #F2F2F2 bg. Divider: 1px #D6D6D6. Department list: 48px rows, 16px padding, chevron right icon.
- **Checkboxes**: 20px square, 4px border-radius, 2px #D6D6D6 border. Checked: #0071CE bg, white checkmark. Focus ring: 2px offset, #0071CE at 30% opacity. Used in filter panels and shopping list.
- **Tooltips**: #041E42 bg, white text at 13px, 6px border-radius, 8px 12px padding. Used for delivery estimates and price breakdowns.
- **Navigation**: Top bar 64px, #0071CE bg, white text/icons. Logo left, department menu, search center (flex-1, white bg, 9999px radius), location/cart right. Secondary nav: 44px, white bg, category links horizontal scroll. Mobile: hamburger menu, blue header.
- **Search**: 44px height, flex-1, 9999px border-radius, white bg, magnifying glass icon right. Placeholder: "Search everything at Walmart". Focus: 2px #FFC220 border. Results: product thumbnail 48px, title, price, "Add to cart" text button.

## Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80
- Component padding: Buttons 10px 20px, Cards 16px, Inputs 10px 14px
- Section spacing: 48px between departments, 24px between product groups
- Container max width: 1320px, centered with 16px side padding
- Card grid gap: 16px (desktop 5-column), 8px (mobile 2-column)

## Border Radius
- 4px: Checkboxes, small badges, table cells
- 8px: Cards, inputs, dropdowns, product images
- 12px: Panels, modals, promotional banners
- 16px: Hero sections, full-width callouts
- 9999px: Buttons, chips, search bar, avatars, spark badge

## Do's and Don'ts
- Do use blue (#0071CE) as the dominant color for navigation and actions
- Do use yellow (#FFC220) sparingly for emphasis: hero CTAs, savings callouts, star ratings
- Don't use yellow for body text or on white backgrounds; it fails contrast
- Do show savings prominently: was-price strikethrough + green savings amount
- Don't clutter product cards; image, title, price, rating, and add button are sufficient
- Do design for accessibility first: 44px minimum touch targets, AA contrast everywhere
- Don't use the dark navy (#041E42) for large background areas; reserve it for text and small accents
- Do maintain consistent product image sizes across the grid for clean alignment
- Don't mix pill-shaped and rectangular buttons in the same view
