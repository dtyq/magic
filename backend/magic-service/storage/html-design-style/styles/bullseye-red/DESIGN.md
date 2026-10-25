# Bullseye Red

## Overview
Bullseye Red is a bold, modern retail design system anchored by a striking red on expansive white. It delivers a friendly yet elevated shopping experience that feels more design-forward than typical mass retail. Clean lines, ample whitespace, and warm neutral accents create a welcoming, curated atmosphere where products take center stage.

## Colors
- **Primary** (#CC0000): Primary actions, brand accent, hero elements — Target Red
- **Primary Hover** (#A30000): Hovered buttons, pressed interactive states
- **Secondary** (#333333): Secondary actions, supporting UI elements
- **Neutral** (#888888): Icons, placeholder text, disabled elements
- **Background** (#F7F7F7): Page background, section dividers
- **Surface** (#FFFFFF): Cards, panels, product tiles, overlays
- **Text Primary** (#212121): Headings, body copy, product names
- **Text Secondary** (#666666): Descriptions, metadata, secondary labels
- **Border** (#E0E0E0): Card borders, input outlines, dividers
- **Success** (#238636): In stock, order confirmed, deal available
- **Warning** (#E08600): Low stock, limited time offer
- **Error** (#CC0000): Out of stock, errors — intentionally same as primary for brand unity

## Typography
- **Display Font**: Inter — loaded from Google Fonts
- **Body Font**: Inter — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Inter's clean geometry and wide character set make it ideal for a retail system that spans web, app, and signage. Use weights 400 (body), 500 (labels), 600 (subheadings), and 700 (headings, prices, CTAs). Letter-spacing -0.02em for display, -0.01em for headings, 0em for body. Line height 1.5 for body, 1.25 for headings. Product prices use 700 at a larger size to anchor the card.

Type scale:
- Display: 40px / 700
- H1: 32px / 700
- H2: 24px / 600
- H3: 20px / 600
- Body: 16px / 400
- Body Small: 14px / 400
- Caption: 12px / 500
- Price Large: 28px / 700
- Price Small: 18px / 700
- Sale Price: 18px / 700, #CC0000
- Was Price: 14px / 400, #888888, line-through

## Elevation
Modern, subtle shadows that add depth without heaviness. Level 0 (flat) for inline content and product images. Level 1 (`0 1px 4px rgba(33,33,33,0.06)`) for product cards, tiles at rest. Level 2 (`0 4px 16px rgba(33,33,33,0.1)`) for hover lift, dropdowns, popovers. Level 3 (`0 12px 32px rgba(33,33,33,0.14)`) for modals, cart drawer, quick-view overlays. Cards transition from Level 1 to Level 2 on hover with a 200ms ease.

## Components
- **Buttons**: 44px height, 24px horizontal padding, 8px border-radius, Inter 700 at 15px. Primary: #CC0000 bg, white text. Secondary: white bg, #CC0000 text, 2px #CC0000 border. Tertiary: transparent bg, #CC0000 text, underline on hover. Dark: #212121 bg, white text. Disabled: #E0E0E0 bg, #888888 text. Min-width 120px.
- **Cards**: White background, no border (clean aesthetic), 8px border-radius, Level 1 shadow. Product image: aspect-ratio 4:5, object-fit cover, 8px top radius. Content: 16px padding. Brand: 12px/500 #666666 uppercase. Title: 14px/500, 2-line clamp. Price: 18px/700. Rating: 5-star yellow (#F5A623), 13px review count. Hover: Level 2 shadow.
- **Inputs**: 44px height, 14px horizontal padding, 8px border-radius, 1px #E0E0E0 border. Focus: 2px #CC0000 border. Error: 1px #CC0000 border with error text below in red. Labels: 14px/500 above. Placeholder: #888888.
- **Chips**: 32px height, 14px horizontal padding, 9999px border-radius. Filter active: #CC0000 bg, white text. Filter inactive: white bg, #212121 text, 1px #E0E0E0 border. Sale badge: #CC0000 bg, white text "SALE". New: #212121 bg, white text "NEW".
- **Lists**: Category list 48px rows, 16px left padding, hover #F7F7F7 bg, chevron icon right #888888. Product list view: 100px rows, image 80x80 left, details center, price + add-to-cart right.
- **Checkboxes**: 20px square, 4px border-radius, 1.5px #E0E0E0 border. Checked: #CC0000 bg, white checkmark. Focus ring: 2px offset, #CC0000 at 25% opacity. Used in filter panels and lists.
- **Tooltips**: #212121 bg, white text at 13px, 6px border-radius, 8px 12px padding. Max-width 220px. Used for delivery estimates and product details.
- **Navigation**: Top bar 56px, white bg, bottom 1px #E0E0E0 border. Red logo left, category nav center (Inter 500, 14px, #212121, hover #CC0000), search + cart right. Category bar: 44px, #F7F7F7 bg, horizontal scroll, active red underline 2px.
- **Search**: 40px height, 280px width, 9999px border-radius, #F7F7F7 bg. Focus: white bg, 1px #E0E0E0 border, expand to 400px. Results: product image 48px, title, category, price. Level 2 shadow on dropdown.

## Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96
- Component padding: Buttons 10px 24px, Cards 0/16px, Inputs 10px 14px
- Section spacing: 64px between major categories, 32px between product rows
- Container max width: 1280px, centered with 20px side padding
- Card grid gap: 20px (desktop 4-column), 12px (mobile 2-column)

## Border Radius
- 4px: Checkboxes, small badges, table cells
- 8px: Cards, inputs, buttons, product image containers
- 12px: Panels, dropdowns, filter drawers
- 16px: Modals, hero banners, promotional cards
- 9999px: Chips, search bar, avatars, circular icons

## Do's and Don'ts
- Do let red (#CC0000) be the single dominant accent; avoid introducing other bright colors
- Do use generous whitespace around product grids to feel curated, not cluttered
- Don't use red for informational or neutral text; it always implies action or emphasis
- Do pair sale prices in red with strikethrough original prices in gray for clarity
- Don't add borders to product cards; use shadow-only for a modern, borderless look
- Do ensure product images maintain consistent 4:5 aspect ratios across the grid
- Don't use more than two type weights on a single card (500 for titles, 700 for prices)
- Do keep the top navigation clean: logo, categories, search, and cart only
- Don't forget hover-to-lift transitions on cards; they make browsing feel responsive
- Do maintain AA contrast for all red text on white (#CC0000 on #FFFFFF passes AA for large text)
