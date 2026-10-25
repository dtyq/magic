# Octo Code

## Overview
Octo Code is a developer-centric design system inspired by the world's largest code collaboration platform. It embraces a dark-mode-first philosophy with precise syntax-highlighting-friendly colors, clean typography, and an interface that puts code front and center. The aesthetic is functional, information-dense, and unapologetically built for people who live in terminals and pull requests.

## Colors
- **Primary** (#2F81F7): Interactive elements, links, buttons, selected states — Mona Blue
- **Primary Hover** (#388BFD): Hovered links and buttons, slightly brighter for affordance
- **Secondary** (#238636): Merge buttons, success states, additions in diffs — Growth Green
- **Neutral** (#8B949E): Secondary text, icons, timestamps, subtle labels
- **Background** (#0D1117): Page background, the foundation dark canvas — Void Black
- **Surface** (#161B22): Cards, panels, sidebar backgrounds, elevated containers
- **Text Primary** (#E6EDF3): Primary text, headings, code content — high contrast on dark
- **Text Secondary** (#8B949E): Descriptions, meta information, secondary labels
- **Border** (#30363D): Dividers, card borders, input outlines, table rules
- **Success** (#3FB950): Successful checks, merged PRs, online indicators
- **Warning** (#D29922): Pending reviews, draft states, caution alerts
- **Error** (#F85149): Failed checks, merge conflicts, destructive actions

## Typography
- **Display Font**: Inter — loaded from Google Fonts
- **Body Font**: Inter — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Inter is used at weights 400, 500, and 600 across all non-code UI. Display headings use 600 weight with -0.02em letter-spacing for a tight, engineered feel. Body text sits at 400 weight with default letter-spacing for comfortable reading of issues, comments, and documentation. JetBrains Mono renders all code blocks, inline code, diffs, commit SHAs, and terminal output at 400 weight with ligatures enabled. The type scale is compact to maximize information density: 12px (meta/labels), 14px (body/default), 16px (section titles), 20px (page titles), 24px (repo names), 32px (marketing headings).

## Elevation
Elevation is expressed through background color layering rather than shadows. The base layer is #0D1117, cards and panels lift to #161B22, popovers and dropdowns to #1C2128, and modals to #21262D with a semi-transparent backdrop overlay at rgba(1, 4, 9, 0.8). Subtle box-shadows of 0 1px 0 rgba(27, 31, 36, 0.04) are used sparingly on sticky headers and floating action bars. The philosophy is flat and layered — depth comes from color differentiation, not shadow theatrics.

## Components
- **Buttons**: Primary uses #238636 background with #FFFFFF text, 6px radius, 12px 20px padding, 500 weight. Danger variant uses transparent background with #F85149 text, bordered. Outline variant uses transparent background, #30363D border, #C9D1D9 text. All buttons are 32px default height with a 28px small variant. Hover states brighten background by ~10%.
- **Cards**: #161B22 background, 1px solid #30363D border, 6px radius, 16px padding. Repository cards show name in #58A6FF link color, description in #8B949E, and language dot + star count in the footer. Hover adds a subtle border color shift to #484F58.
- **Inputs**: #0D1117 background, 1px solid #30363D border, 6px radius, 8px 12px padding, 14px font size. Focus state applies 2px solid #2F81F7 outline with 2px offset. Placeholder text in #484F58. Search inputs have a / keyboard shortcut hint badge.
- **Chips**: Used for labels and topics. 24px height, 12px horizontal padding, 9999px radius (pill), 12px font, 500 weight. Label chips use their assigned color as background at 30% opacity with full-color text. Topic chips use #1C2128 background with #58A6FF text.
- **Lists**: Repository and file lists use full-width rows with 8px 16px padding, #30363D bottom border (1px). Hover highlights row to #161B22. Selected/active rows get a 2px left border in #F78166 (orange accent).
- **Checkboxes**: 16x16px, #0D1117 background, 1px solid #30363D border, 3px radius. Checked state fills #2F81F7 with white checkmark SVG. Used prominently in task lists within issues and PRs.
- **Tooltips**: #21262D background, #C9D1D9 text, 6px radius, 6px 10px padding, 12px font. Arrow-tipped, positioned above by default. 200ms delay on hover. Max-width 250px.
- **Navigation**: Top nav is #161B22 with 1px bottom border #21262D, 64px height. Tab navigation uses underline-style active indicator — 2px bottom border in #F78166 (orange) for active tab, #8B949E text for inactive. Sidebar nav uses #0D1117 background with hover highlight rows.
- **Search**: Prominent top-bar search with #0D1117 background, #30363D border, 6px radius. Activated state expands to full-width overlay with typeahead suggestions on #161B22 dropdown. Search shortcut / displayed as a muted kbd badge.

## Spacing
- Base unit: 4px
- Scale: 4px, 8px, 12px, 16px, 24px, 32px, 40px, 48px, 64px
- Component padding: Buttons 12px 20px, inputs 8px 12px, cards 16px, chips 4px 12px
- Section spacing: 24px between content sections, 48px between major page sections
- Container max width: 1280px (wide layout), 1012px (readable content), 768px (narrow/settings)
- Card grid gap: 16px between repository cards, 0px for list views (border-separated)

## Border Radius
- 3px: Checkboxes, small badges, inline code snippets
- 6px: Buttons, inputs, cards, dropdowns, modals, most components
- 12px: Avatar images, large promotional cards
- 20px: Marketing page hero elements, onboarding cards
- 9999px: Pills, label chips, topic tags, notification counters

## Do's and Don'ts
- Do use the dark palette as the default — light mode is secondary
- Do use JetBrains Mono for anything code-related: diffs, SHAs, file names, terminal output
- Do rely on color layering (#0D1117 > #161B22 > #1C2128) for visual hierarchy instead of shadows
- Do keep information density high — developers prefer seeing more data with less scrolling
- Don't use more than 600 weight for any text — the interface should feel precise, not loud
- Don't use rounded corners larger than 6px on functional UI elements
- Don't animate transitions longer than 150ms — the interface should feel instant
- Don't use the primary blue (#2F81F7) for large background fills — reserve it for interactive elements and links
