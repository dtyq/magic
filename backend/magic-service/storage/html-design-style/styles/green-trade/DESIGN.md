# Green Trade

## Overview
Green Trade is a minimalist, consumer-finance design system where dark backgrounds meet vivid green accents. It blends the simplicity of consumer apps with the precision of trading platforms, creating an approachable yet data-rich experience. Charts and numbers take center stage, with green signaling gains and a warm orange-red marking losses.

## Colors
- **Primary** (#00C805): Primary actions, positive values, gains, brand accent — Robinhood Green
- **Primary Hover** (#00A804): Hovered green buttons, active positive states
- **Secondary** (#5AC53A): Secondary green for lighter accents, progress bars
- **Neutral** (#9DA3A6): Secondary text, icons, muted labels
- **Background** (#FFFFFF): Light mode page background
- **Surface** (#F4F4F5): Cards, chart containers, data panels
- **Text Primary** (#1E2124): Headings, body copy, primary data — Near Black
- **Text Secondary** (#6F7378): Descriptions, labels, secondary information
- **Border** (#E3E5E8): Card borders, input outlines, dividers
- **Success** (#00C805): Positive returns, successful transactions, upward charts
- **Warning** (#FFBF00): Pending orders, caution alerts
- **Error** (#FF5000): Negative returns, failed orders, downward charts — Chart Red

## Typography
- **Display Font**: DM Sans — loaded from Google Fonts
- **Body Font**: DM Sans — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

DM Sans provides the clean, geometric personality that bridges consumer and finance aesthetics. Use weights 400 (body), 500 (data labels), and 700 (headings, amounts). Letter-spacing -0.02em for large portfolio values, 0em for body. Line height 1.5 for body, 1.15 for large display numbers. Portfolio values use DM Sans 700 at large sizes for impact.

Type scale:
- Portfolio Value: 48px / 700, letter-spacing -0.03em
- H1: 28px / 700
- H2: 22px / 700
- H3: 18px / 500
- Body: 15px / 400
- Body Small: 13px / 400
- Caption: 11px / 500
- Data: 15px / 500 (JetBrains Mono for precise figures)

## Elevation
Minimal elevation in the spirit of flat consumer design. Level 0 (flat) for most content; separation comes from background color shifts. Level 1 (`0 1px 2px rgba(30,33,36,0.06)`) for cards that need subtle lift. Level 2 (`0 4px 12px rgba(30,33,36,0.08)`) for dropdowns and order panels. Level 3 (`0 8px 24px rgba(30,33,36,0.12)`) for modals. Charts and graphs are always flat (Level 0).

## Components
- **Buttons**: 44px height, 20px horizontal padding, 9999px border-radius (fully rounded), DM Sans 700 at 15px. Primary: #00C805 bg, white text. Secondary: transparent bg, #1E2124 text, 1px #E3E5E8 border. Sell/Danger: #FF5000 bg, white text. Ghost: transparent, #00C805 text.
- **Cards**: White or #F4F4F5 background, no border (color separation), 12px border-radius, 20px padding. Stock cards: ticker (18px/700), company name (13px/#6F7378), price right-aligned, sparkline mini-chart 60x24px.
- **Inputs**: 48px height, 16px horizontal padding, 12px border-radius, 1px #E3E5E8 border. Focus: 2px #00C805 border. Amount inputs centered, large (24px/700). Dollar sign prefix in #9DA3A6.
- **Chips**: 28px height, 12px horizontal padding, 9999px border-radius. Gain: #E6F9E6 bg, #00C805 text. Loss: #FFF0E6 bg, #FF5000 text. Neutral: #F4F4F5 bg, #6F7378 text. With arrow-up/down icon 12px.
- **Lists**: Watchlist rows 56px height, 16px horizontal padding, hover #F4F4F5 bg. Ticker bold left, sparkline center, price + change chip right. No visible dividers; spacing creates separation.
- **Checkboxes**: 20px square, 9999px border-radius (circular toggles preferred), #E3E5E8 bg. Active: #00C805 bg, white checkmark. Focus ring: 2px offset, #00C805 at 20% opacity.
- **Tooltips**: #1E2124 bg, white text at 12px, 8px border-radius, 8px 12px padding. Used for stock details and price breakdowns on hover.
- **Navigation**: Bottom tab bar (mobile-first) 56px height, white bg, top 1px #E3E5E8 border. 5 icons: Home, Search, Trade (center, #00C805 circle 48px), Notifications, Account. Active: #00C805 fill.
- **Search**: 44px height, full-width, 12px radius, #F4F4F5 bg, magnifying glass icon. Focus: white bg, 1px #E3E5E8 border. Results: stock ticker bold, company name secondary, price right.

## Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
- Component padding: Buttons 10px 20px, Cards 20px, Inputs 12px 16px
- Section spacing: 40px between major sections, 16px between related items
- Container max width: 480px (mobile-first), 1024px (desktop)
- Card grid gap: 12px (watchlist), 16px (portfolio grid)

## Border Radius
- 4px: Inline tags, small badges
- 8px: Input fields, small cards
- 12px: Cards, panels, chart containers
- 16px: Modals, bottom sheets
- 9999px: Buttons, chips, avatars, circular toggles

## Do's and Don'ts
- Do use green (#00C805) exclusively for positive/gain indicators and primary CTAs
- Do use the orange-red (#FF5000) only for negative/loss indicators and sell actions
- Don't clutter chart areas; let the data visualization be the hero
- Do keep the interface minimal; hide complexity behind progressive disclosure
- Don't use borders when background color changes can create separation
- Do design mobile-first; the core experience is a phone in one hand
- Don't display more than one primary CTA per screen
- Do use sparkline mini-charts for quick trend visualization in list views
- Don't use heavy shadows; the aesthetic is flat and clean
