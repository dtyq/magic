# Swoosh Bold

## Overview
Swoosh Bold is a high-energy athletic design system inspired by the world's most iconic sports brand. It is unapologetically bold — dominated by stark black-and-white contrast with explosive accent colors that ignite like a sprinter off the blocks. The aesthetic channels aspiration and motion: oversized typography, full-bleed imagery of athletes in action, and an interface that feels like it is always leaning forward. This is design that doesn't whisper — it commands.

## Colors
- **Primary** (#111111): Hero backgrounds, primary buttons, dominant fill — Nike Black
- **Primary Hover** (#292929): Hovered black buttons and interactive elements
- **Secondary** (#FA5400): Sale badges, urgency callouts, seasonal campaign accent — Blaze Orange
- **Neutral** (#707072): Body text descriptions, product specs, metadata
- **Background** (#FFFFFF): Page background, the stark white canvas that amplifies contrast
- **Surface** (#F5F5F5): Card backgrounds, input fills, footer area, secondary sections
- **Text Primary** (#111111): Headlines, product names, navigation, CTAs — full black
- **Text Secondary** (#707072): Product descriptions, size guides, filter counts
- **Border** (#E5E5E5): Product card outlines, input borders, section dividers
- **Success** (#128A09): In stock indicators, order confirmed, delivery on track
- **Warning** (#FFC107): Low stock warnings, size running out, price drop notifications
- **Error** (#D43F21): Out of stock, payment failed, address validation errors

## Typography
- **Display Font**: Jost — loaded from Google Fonts
- **Body Font**: Inter — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Jost is the display workhorse — a geometric sans-serif that channels Futura's bold authority. It is used at weights 700 and 900 for all headlines, hero text, product names, and campaign slogans. Display headlines use 900 weight, uppercase, with -0.02em letter-spacing and tight 0.95 line height for maximum compression and impact. Campaign hero text can reach 72px-120px on desktop. Product card titles use Jost 700 at 16px. Inter handles body text at weights 400 and 500 — product descriptions at 15px, navigation at 500 weight 16px, and filter labels at 14px. The type scale is dramatic: 12px (labels/meta), 14px (filters/small body), 15px (body), 16px (product titles/nav), 24px (section headings), 36px (category titles), 48px (featured headlines), 72-120px (campaign hero).

## Elevation
Minimal shadows — the design relies on contrast and scale rather than depth effects. Product cards have no shadow at rest, using #FFFFFF background on #F5F5F5 sections or borderless on white. Hover lifts product image with transform: translateY(-4px) and a 0 4px 12px rgba(0, 0, 0, 0.08) shadow. Sticky navigation uses a 0 2px 4px rgba(0, 0, 0, 0.05) shadow only when scrolled. Modals use 0 8px 32px rgba(0, 0, 0, 0.12) with a rgba(0, 0, 0, 0.5) backdrop. Quick-view overlays slide in from the right with no shadow — they occupy their own panel. The philosophy is physical: objects don't float, they press against surfaces.

## Components
- **Buttons**: Primary uses #111111 background with #FFFFFF text, 30px radius (rounded rectangle), 16px 28px padding, 500 weight (Inter), 48px height, uppercase text with 0.02em letter-spacing. Secondary uses #FFFFFF background, 1px solid #111111 border, #111111 text. "Add to Bag" is the signature CTA — full-width within product cards. Disabled uses #CACACB background with #8D8D8F text. Hover on primary lightens to #292929.
- **Cards**: Product cards are borderless — product image on top (1:1 or 4:5 aspect ratio), product info below. No background color, no border, no shadow at rest. Info section shows: label tag (e.g., "Just In", "Best Seller" in #111111 600 weight 12px), product name (Jost 700, 16px), category (#707072, 15px), color count (#707072, 15px), and price (#111111, 500 weight, 15px). Sale price in #FA5400 with original price struck through. Carousel dots below for alternate colorways.
- **Inputs**: #F5F5F5 background, no visible border, 8px radius, 14px 16px padding, 16px font (Inter). Focus state applies 2px solid #111111 border. Size selector buttons are 48px height outlines — #FFFFFF background, 1px solid #E5E5E5, 4px radius. Selected size uses #111111 border. Out-of-stock sizes show diagonal strikethrough and reduced opacity.
- **Chips**: Filter chips use #FFFFFF background, 1px solid #E5E5E5 border, 8px radius, 8px 16px padding, 14px font, 500 weight. Active filter uses #111111 background with #FFFFFF text. Category chips (Men, Women, Kids) use the same active/inactive pattern. "Sale" chip uses #FA5400 background with #FFFFFF text. Removable filter pills show an X icon.
- **Lists**: Product grids are the primary pattern, not lists. When used (order history, address book), lists have 72px rows, full-width, 1px solid #E5E5E5 bottom border, 16px padding. Product rows in cart show thumbnail (80x80), name, size, quantity stepper, and price. Swipe-to-delete on mobile.
- **Checkboxes**: 20x20px, #FFFFFF background, 2px solid #111111 border, 2px radius (nearly square). Checked state fills #111111 with white checkmark. Used in filter panels, checkout forms, and preferences. The sharp square feel matches the athletic geometric aesthetic.
- **Tooltips**: #111111 background, #FFFFFF text, 4px radius, 8px 12px padding, 13px font. Used for size chart references and icon-button labels. Positioned above with a small arrow. 100ms delay on hover.
- **Navigation**: Top nav is #FFFFFF background, 64px height, with logo left, category mega-menu center (New & Featured, Men, Women, Kids, Sale), and icons right (search, favorites, bag). Mega-menu dropdown is a full-width panel (100vw) with columns of links, featured imagery, and campaign callouts. On scroll, nav becomes sticky with a 1px bottom shadow. Secondary nav below for subcategories.
- **Search**: Expanding search — icon click reveals a full-width search bar that slides down from the top nav. #F5F5F5 background input, 8px radius, 48px height. Typeahead shows trending searches, popular products (with thumbnails), and suggested categories. Keyboard navigation supported. Search results page uses a grid layout matching the browse experience.

## Spacing
- Base unit: 4px
- Scale: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px, 96px, 120px
- Component padding: Buttons 16px 28px, product cards 0px (image) + 12px (info), inputs 14px 16px
- Section spacing: 48px between product grid sections, 96px between homepage hero blocks
- Container max width: 1440px for product grids, 960px for checkout/forms, full-bleed for hero banners
- Card grid gap: 4px between product cards on desktop (tight grid), 16px on mobile

## Border Radius
- 0px: Product images (square crop), hero sections, mega-menu dropdowns, campaign banners
- 2px: Checkboxes, size selector buttons, code blocks
- 4px: Tooltips, small badges, inline tags
- 8px: Inputs, filter chips, dropdowns, modals, notification cards
- 30px: Primary buttons, "Add to Bag" CTA (signature rounded rectangle)
- 9999px: Avatar images, color swatch selectors (circles), notification count badges

## Do's and Don'ts
- Do use Jost at 900 weight uppercase for all campaign headlines — boldness is the brand DNA
- Do use stark black-on-white contrast as the default — this brand does not do subtle
- Do use full-bleed hero imagery with overlaid text — athletes in motion define the brand story
- Do keep product grids tight (4px gap on desktop) — density conveys abundance and energy
- Do use #FA5400 orange exclusively for sale and urgency moments — it signals "act now"
- Don't use rounded corners on product imagery — square crops keep the grid sharp and athletic
- Don't use light font weights for headlines — nothing below 700 for Jost display type
- Don't animate with ease-in-out — use ease-out with 200ms duration for snappy, athletic motion
- Don't use the volt/neon green (#CDFC41) as a primary color — it is a limited seasonal accent only
- Don't clutter product cards with badges — one label maximum ("Just In" or "Best Seller", never both)
