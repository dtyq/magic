# Lime Commerce

## Overview
Lime Commerce is a merchant-focused design system inspired by the world's leading e-commerce platform builder. It combines trustworthy green tones with clean, professional layouts designed to help entrepreneurs manage their online stores with confidence. The aesthetic is polished yet approachable — balancing the complexity of commerce management (inventory, orders, analytics) with an interface that never feels overwhelming. Every element is designed to guide action and build merchant confidence.

## Colors
- **Primary** (#008060): Primary buttons, active states, key CTAs, success feedback — Shopify Green
- **Primary Hover** (#006E52): Hovered primary buttons and interactive elements
- **Secondary** (#5C6AC4): Secondary buttons, links, data visualization accent — Indigo
- **Neutral** (#6D7175): Body text descriptions, metadata, helper text, secondary labels
- **Background** (#F6F6F7): Page background, the subtle warm gray foundation
- **Surface** (#FFFFFF): Cards, panels, modal backgrounds, input backgrounds
- **Text Primary** (#202223): Headings, primary labels, critical information — near black
- **Text Secondary** (#6D7175): Descriptions, timestamps, secondary metadata
- **Border** (#E1E3E5): Card borders, input outlines, table rules, dividers
- **Success** (#008060): Order fulfilled, payment received, inventory in stock
- **Warning** (#B98900): Low inventory, pending orders, review needed states
- **Error** (#D72C0D): Failed payments, out of stock, validation errors, destructive actions

## Typography
- **Display Font**: Inter — loaded from Google Fonts
- **Body Font**: Inter — loaded from Google Fonts
- **Code Font**: Fira Code — loaded from Google Fonts

Inter is used at weights 400, 500, 600, and 700 throughout the interface. Page titles use 600 weight at 20px for clear hierarchy without being loud. Section headings within cards use 600 weight at 14px for compact labeling. Body text uses 400 weight at 14px with 1.43 line height for comfortable reading of order details, product descriptions, and settings explanations. Table headers use 500 weight at 12px uppercase with 0.05em letter-spacing. Fira Code with ligatures is used for order IDs, SKU codes, discount formulas, and Liquid template code. The type scale: 12px (labels/table headers), 13px (small body), 14px (body default), 16px (card titles), 20px (page titles), 28px (dashboard headlines).

## Elevation
Cards float above the #F6F6F7 background using subtle box-shadow: 0 0 0 1px rgba(63, 63, 68, 0.05), 0 1px 3px rgba(63, 63, 68, 0.15). This is the signature "Polaris card shadow" — a combination of a near-invisible border shadow and a soft drop shadow. Popovers use 0 0 0 1px rgba(63, 63, 68, 0.05), 0 3px 8px rgba(63, 63, 68, 0.15). Modals use the same shadow as popovers with a rgba(0, 0, 0, 0.5) backdrop overlay. The top bar uses a 1px bottom border (#E1E3E5) with no shadow. The approach is restrained — just enough depth to clarify layering without visual noise.

## Components
- **Buttons**: Primary uses #008060 background with #FFFFFF text, 4px radius, 12px 16px padding, 500 weight, 36px height. Outline variant uses #FFFFFF background, 1px solid #BABEC3 border, #202223 text. Destructive uses #D72C0D background with white text. Plain variant uses no background or border, #006E52 text with underline on hover. Disabled buttons use 60% opacity. Loading state shows spinner replacing text.
- **Cards**: #FFFFFF background, signature Polaris shadow (0 0 0 1px rgba(63, 63, 68, 0.05), 0 1px 3px rgba(63, 63, 68, 0.15)), 8px radius, 20px padding. Cards are the primary content container — every settings section, data table, and form group lives in a card. Card headers use 16px 600 weight with optional actions aligned right.
- **Inputs**: #FFFFFF background, 1px solid #BABEC3 border, 4px radius, 8px 12px padding, 14px font, 36px height. Focus state applies 2px solid #005BD3 outline (blue focus ring, not green — accessibility convention). Error state uses #D72C0D border with error text below. Labels above inputs at 14px 500 weight.
- **Chips**: Badge/tag components use 24px height, 8px horizontal padding, 8px radius, 12px font, 500 weight. Status badges — "Fulfilled" uses #AEE9D1 background with #005E46 text, "Pending" uses #FFD79D background with #6A4400 text, "Unfulfilled" uses #FED3D1 background with #D72C0D text. Removable tags use #E4E5E7 background with an X button.
- **Lists**: Resource lists (orders, products, customers) use full-width rows in a table-like layout within cards. 52px row height, 16px horizontal padding, 1px solid #F1F2F3 bottom border. Hover highlights to #F6F6F7. Checkbox column on the left for bulk actions. Sortable column headers with arrow indicators.
- **Checkboxes**: 18x18px, #FFFFFF background, 1px solid #8C9196 border, 3px radius. Checked state fills #008060 with white checkmark. Indeterminate state shows horizontal dash. Used heavily for bulk action selection in resource tables.
- **Tooltips**: #202223 background, #FFFFFF text, 4px radius, 4px 8px padding, 13px font. Positioned above with arrow. Max-width 200px. 100ms delay on hover. Used for truncated text and icon-button labels.
- **Navigation**: Left sidebar (240px) on #FFFFFF background with #F6F6F7 active item highlight and 4px radius on nav items. Top bar (56px height) with breadcrumbs, page title, and primary action buttons. Sidebar nav items are 32px height with icon (20px) + label. Active item has #008060 icon and 600 weight text.
- **Search**: Top bar includes a global search that triggers a command palette overlay (centered modal). #FFFFFF background, 8px radius, 48px input height. Results grouped by type (orders, products, customers, pages) with keyboard navigation. Also searchable with Cmd+K / Ctrl+K shortcut.

## Spacing
- Base unit: 4px
- Scale: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 64px
- Component padding: Buttons 12px 16px, cards 20px, inputs 8px 12px, table cells 12px 16px
- Section spacing: 16px between cards in a settings page, 20px between form sections within a card
- Container max width: 998px for most admin pages, full-width for tables/resource lists
- Card grid gap: 16px between stacked cards, 20px between dashboard metric cards (horizontal)

## Border Radius
- 3px: Checkboxes, small badges, inline tags
- 4px: Buttons, inputs, tooltips, dropdowns
- 8px: Cards, modals, popovers, status badges, removable tags
- 12px: Banner images, onboarding cards, large callout components
- 9999px: Avatar images, notification count dots, toggle switch tracks

## Do's and Don'ts
- Do use cards as the primary content container — every section of a page should live inside a card
- Do use the green (#008060) only for primary actions and success states — not for decoration
- Do use the blue focus ring (#005BD3) for keyboard navigation, not green, for accessibility
- Do use status badges with semantic background colors (green/yellow/red tints) for order and inventory states
- Do keep form layouts single-column within cards for simplicity — merchants are not power users by default
- Don't use more than one primary (green) button per card — guide merchants to the single most important action
- Don't use custom colors for status badges — stick to the semantic success/warning/error palette
- Don't add shadows to elements inside cards — only cards themselves cast shadows
- Don't exceed 998px content width — wide layouts make admin forms harder to scan
