# Mountain View Bright

## Overview
A clean, colorful, and universally accessible design system rooted in material design principles. Mountain View Bright uses a signature four-color palette — blue, red, yellow, and green — against crisp white surfaces with clear elevation hierarchy. The aesthetic is optimistic, organized, and information-rich, designed to make complex tools feel simple and approachable for billions of users worldwide.

## Colors
- **Primary** (#4285F4): Primary actions, links, selected states, active tabs — Google Blue
- **Primary Hover** (#3367D6): Hover and pressed state for blue interactive elements
- **Secondary** (#34A853): Positive confirmations, secondary accent — Google Green
- **Neutral** (#5F6368): Body text, icons, secondary content — Google Gray 700
- **Background** (#FFFFFF): Primary page background
- **Surface** (#F8F9FA): Card backgrounds, sidebar, search results surface — Google Gray 50
- **Text Primary** (#202124): Headlines, primary labels, navigation — Google Gray 900
- **Text Secondary** (#5F6368): Descriptions, metadata, helper text — Google Gray 700
- **Border** (#DADCE0): Dividers, card outlines, input borders — Google Gray 300
- **Success** (#34A853): Saved confirmations, connected status — Google Green
- **Warning** (#FBBC04): Attention-needed states, draft badges — Google Yellow
- **Error** (#EA4335): Error messages, destructive actions, alerts — Google Red

## Typography
- **Display Font**: Plus Jakarta Sans — loaded from Google Fonts
- **Body Font**: Roboto — loaded from Google Fonts
- **Code Font**: Roboto Mono — loaded from Google Fonts

Plus Jakarta Sans serves as the display typeface for marketing pages and large headlines, bringing a geometric warmth at weights 600 and 700. Roboto is the workhorse for all product UI — body text, labels, buttons, and navigation — at weights 400 and 500. Roboto Mono handles code blocks, data values, and technical strings. The type scale is modular and rational, following a mathematical progression. Letter-spacing is slightly positive for smaller sizes to aid readability.

- **Display Large**: Plus Jakarta Sans 57px/64px, weight 700, tracking -0.02em
- **Display Medium**: Plus Jakarta Sans 45px/52px, weight 700, tracking -0.01em
- **Headline Large**: Plus Jakarta Sans 32px/40px, weight 600
- **Headline Medium**: Plus Jakarta Sans 28px/36px, weight 600
- **Title Large**: Roboto 22px/28px, weight 500
- **Title Medium**: Roboto 16px/24px, weight 500, tracking 0.01em
- **Body Large**: Roboto 16px/24px, weight 400, tracking 0.03em
- **Body Medium**: Roboto 14px/20px, weight 400, tracking 0.02em
- **Body Small**: Roboto 12px/16px, weight 400, tracking 0.04em
- **Label Large**: Roboto 14px/20px, weight 500, tracking 0.01em
- **Label Small**: Roboto 11px/16px, weight 500, tracking 0.05em
- **Code**: Roboto Mono 14px/20px, weight 400

## Elevation
Follows a material-inspired layered shadow system that communicates interaction hierarchy. Level 0: no shadow (flat elements, default state). Level 1: 0 1px 2px rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15) — for cards, raised buttons. Level 2: 0 1px 2px rgba(60,64,67,0.3), 0 2px 6px 2px rgba(60,64,67,0.15) — for dropdown menus, search suggestions. Level 3: 0 1px 3px rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15) — for navigation drawers, side sheets. Level 4: 0 2px 3px rgba(60,64,67,0.3), 0 6px 10px 4px rgba(60,64,67,0.15) — for modals, dialogs. Shadows use Google Gray 700 (rgba(60,64,67)) for a warmer feel than pure black.

## Components
- **Buttons**: Filled button uses #4285F4, white text, 36px height, 24px horizontal padding, 9999px border-radius, Roboto 14px weight 500, tracking 0.01em. Outlined button has 1px #DADCE0 border (hover: #4285F4 border and 4285F4 at 8% opacity background), #4285F4 text. Tonal button uses #D2E3FC background, #185ABC text. Text button is flat, #4285F4 text only. All have ripple effect on click (circular expanding opacity). Disabled at 38% opacity.
- **Cards**: White background, 8px border-radius, 1px #DADCE0 border (outlined variant) or Level 1 shadow (elevated variant). 16px internal padding. Title in Roboto 16px weight 500, description in 14px weight 400 #5F6368. Action area at bottom with text buttons. Hover for elevated cards increases to Level 2.
- **Inputs**: 56px height (with floating label) or 40px (dense), 1px #DADCE0 border, 4px border-radius, 16px horizontal padding. Floating label animates from center placeholder to top-left on focus, changing from #5F6368 to #4285F4 at 12px size. Focused state: 2px #4285F4 border. Error state: 2px #EA4335 border with helper text in #EA4335. Supporting text below in 12px #5F6368.
- **Chips**: Assist/filter/input/suggestion variants. 32px height, 8px border-radius, 1px #DADCE0 border, Roboto 14px weight 400. Selected filter: #D2E3FC background, #185ABC text, leading checkmark. Leading icon optional at 18px. Close icon trailing for input chips.
- **Lists**: Full-width rows, 56px single-line / 72px two-line / 88px three-line height. 16px horizontal padding. Leading element (avatar 40px, icon 24px, or thumbnail 56px). Primary text in Roboto 16px #202124, secondary in 14px #5F6368. Trailing element (icon, text, or checkbox). Dividers are 1px #DADCE0 inset from leading element.
- **Checkboxes**: 18px square, 2px border-radius. Unchecked: 2px #5F6368 border. Checked: #4285F4 fill with white checkmark. Indeterminate: #4285F4 fill with white dash. Ripple area extends to 40px for touch target. Label in Roboto 14px at 8px gap.
- **Tooltips**: #5F6368 background (plain) or white with Level 2 shadow (rich). Plain: white text, 4px border-radius, 4px/8px padding, Roboto 12px. Rich: #202124 text, 12px border-radius, 12px padding, can include title and action links.
- **Navigation**: Top app bar 64px, white, Level 0 (elevates to Level 2 on scroll). Navigation menu icon left, title center or left-aligned, action icons right. Navigation rail 80px wide for tablet, drawer 360px for desktop. Bottom navigation 80px for mobile with 3-5 destinations, active uses #4285F4 with indicator pill #D2E3FC.
- **Search**: 48px height, #F8F9FA background, 9999px border-radius, leading search icon, trailing avatar. On focus: white background, Level 2 shadow, suggestions dropdown. Suggestion rows with leading icon (history clock, trending arrow) and text.

## Spacing
- Base unit: 8px
- Scale: 4px, 8px, 12px, 16px, 24px, 32px, 40px, 48px, 64px, 96px
- Component padding: 16px standard, 24px for cards and dialogs
- Section spacing: 48px between major sections, 24px between subsections
- Container max width: 1200px centered with 24px margins (desktop), 16px (mobile)
- Card grid gap: 24px (desktop), 16px (mobile)

## Border Radius
- 4px: Inputs (filled variant), small components, chips (compact)
- 8px: Cards, chips, menus, dialogs
- 12px: Large cards, sheets, navigation drawers
- 16px: Bottom sheets, full-screen dialogs
- 9999px: Buttons, search bars, FABs, indicator pills, avatars

## Do's and Don'ts
- Do use the four brand colors (blue, red, yellow, green) purposefully — each has a semantic meaning
- Don't create new accent colors — work within the established four-color palette
- Do use Material-style ripple effects on interactive elements for tactile feedback
- Don't use heavy borders when elevation (shadow) can communicate hierarchy
- Do maintain 4.5:1 minimum contrast ratio for all text per WCAG AA
- Don't use Bebas Neue or decorative fonts — consistency with Roboto and Plus Jakarta Sans only
- Do use floating labels on inputs for space efficiency and clear affordance
- Don't make interactive areas smaller than 48px by 48px for touch accessibility
- Do apply motion with 200ms standard easing (cubic-bezier(0.4, 0, 0.2, 1)) for all transitions
- Don't use pure black (#000000) for text — always use #202124 for a softer, warmer appearance
