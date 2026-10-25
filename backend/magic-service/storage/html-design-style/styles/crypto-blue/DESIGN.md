# Crypto Blue

## Overview
Crypto Blue is a fintech-grade design system built for the digital asset era. It pairs a bold, trustworthy blue with dark and light neutrals to convey security and modernity. The aesthetic is minimal, data-rich, and engineered for clarity in financial interfaces where every pixel of information matters.

## Colors
- **Primary** (#0052FF): Primary actions, brand accents, active states — Coinbase Blue
- **Primary Hover** (#003ECB): Hovered buttons, pressed interactive elements
- **Secondary** (#5B616E): Secondary actions, meta information — Cool Slate
- **Neutral** (#8A919E): Icons, tertiary text, disabled states
- **Background** (#F9FAFB): Page background, content wells
- **Surface** (#FFFFFF): Cards, modals, data panels
- **Text Primary** (#050F1A): Headings, body copy, asset names — Near Black
- **Text Secondary** (#5B616E): Descriptions, timestamps, secondary data
- **Border** (#D1D5DB): Card borders, input outlines, table dividers
- **Success** (#05B169): Price increase, successful transactions, positive PnL
- **Warning** (#F0AD4E): Pending states, warnings, moderate alerts
- **Error** (#DF2935): Price decrease, failed transactions, negative PnL

## Typography
- **Display Font**: DM Sans — loaded from Google Fonts
- **Body Font**: DM Sans — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

DM Sans delivers a geometric, modern feel appropriate for fintech. Use weights 400 (body), 500 (labels and data), and 700 (headings). Letter-spacing is -0.02em for display, 0em for body. Line height 1.5 for body, 1.2 for headings. All financial figures use JetBrains Mono with tabular numerals for perfect column alignment.

Type scale:
- Display: 40px / 700
- H1: 32px / 700
- H2: 24px / 700
- H3: 18px / 700
- Body: 16px / 400
- Body Small: 14px / 400
- Caption: 12px / 500
- Mono Data: 16px / 500 (JetBrains Mono)
- Mono Small: 13px / 400 (JetBrains Mono)

## Elevation
A flat, modern approach with minimal shadows. Level 0 (flat) for most content. Level 1 (`0 1px 3px rgba(5,15,26,0.06)`) for cards and asset tiles. Level 2 (`0 4px 12px rgba(5,15,26,0.08)`) for dropdowns, popovers, and floating action panels. Level 3 (`0 12px 24px rgba(5,15,26,0.12)`) for modals and onboarding overlays. Prefer border-based separation over shadows for data-dense views.

## Components
- **Buttons**: 44px height, 20px horizontal padding, 8px border-radius, DM Sans 700 at 15px. Primary: #0052FF bg, white text. Secondary: white bg, #050F1A text, 1px #D1D5DB border. Ghost: transparent bg, #0052FF text. Disabled: 40% opacity. Minimum width 100px.
- **Cards**: White background, 1px #D1D5DB border, 12px border-radius, 20px padding. Asset cards show a left-aligned icon (32px), name, ticker, and right-aligned price with 24h change chip. Hover: border-color #0052FF.
- **Inputs**: 44px height, 14px horizontal padding, 8px border-radius, 1px #D1D5DB border. Focus: 2px #0052FF border, 4px #0052FF/10% ring. Error: 1px #DF2935 border. Crypto amount inputs use JetBrains Mono.
- **Chips**: 28px height, 10px horizontal padding, 6px border-radius, 13px text. Positive: #E6F6EF bg, #05B169 text. Negative: #FDECEE bg, #DF2935 text. Neutral: #F3F4F6 bg, #5B616E text.
- **Lists**: Asset list rows 64px height, 16px padding, hover #F9FAFB bg. Columns: icon + name, ticker (mono), price (mono, right), change (chip, right). Header row: 12px uppercase, #8A919E, letter-spacing 0.06em.
- **Checkboxes**: 18px square, 4px border-radius, 1.5px #D1D5DB border. Checked: #0052FF bg, white checkmark. Focus ring: 2px offset, #0052FF at 25% opacity.
- **Tooltips**: #050F1A bg, white text at 13px, 6px border-radius, 8px 12px padding. Used for price details and asset info on hover.
- **Navigation**: Top bar 60px height, white bg, bottom 1px #D1D5DB border. Logo left, horizontal nav center (DM Sans 500, 15px), portfolio/trade CTA right. Active nav: #0052FF text, 2px bottom border.
- **Search**: 44px height, 14px padding, magnifying glass icon, 8px radius, #F3F4F6 bg. Focus: white bg, 2px #0052FF border. Results show asset icon, name, and ticker. Level 2 shadow on dropdown.

## Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80
- Component padding: Buttons 10px 20px, Cards 20px, Inputs 10px 14px
- Section spacing: 48px between sections, 24px between related groups
- Container max width: 1200px, centered with 24px side padding
- Card grid gap: 16px (asset grid), 1px (table rows using border)

## Border Radius
- 4px: Chips (small), checkboxes, inline elements
- 8px: Buttons, inputs, table containers
- 12px: Cards, panels, dropdowns
- 16px: Modals, onboarding cards, hero sections
- 9999px: Avatars, status dots, circular icon containers

## Do's and Don'ts
- Do use JetBrains Mono for all financial data, prices, and amounts
- Do use green (#05B169) for positive values and red (#DF2935) for negative values consistently
- Don't use decorative shadows in data tables; prefer 1px borders for clean alignment
- Do keep price data right-aligned with tabular numerals for scanning
- Don't mix DM Sans and JetBrains Mono within the same text block
- Do maintain at least 44px touch targets for trade actions on mobile
- Don't use the blue (#0052FF) for data visualization; reserve it for interactive elements
- Do provide skeleton loading states for price data that updates in real-time
