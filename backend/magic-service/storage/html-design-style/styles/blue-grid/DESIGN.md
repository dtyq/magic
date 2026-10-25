# Blue Grid

## Overview
Blue Grid is a clean, professional design system inspired by modern video conferencing platforms. It emphasizes clarity, accessibility, and grid-based layouts that feel productive and distraction-free. The palette centers on a vibrant blue against neutral whites and grays, creating a trustworthy and focused digital workspace.

## Colors
- **Primary** (#2D8CFF): Main actions, active states, meeting controls — Zoom Blue
- **Primary Hover** (#1A7AEE): Hovered buttons and interactive elements
- **Secondary** (#747487): Secondary actions, muted UI elements — Cool Gray
- **Neutral** (#53535F): Icons, secondary text, dividers
- **Background** (#F7F7FA): Page background, content areas
- **Surface** (#FFFFFF): Cards, modals, panels, meeting tiles
- **Text Primary** (#0E0E10): Headings, body copy, primary labels
- **Text Secondary** (#747487): Descriptions, timestamps, secondary labels
- **Border** (#D8D8E0): Card borders, input outlines, dividers
- **Success** (#2D8C2D): Connected status, successful joins, green indicators
- **Warning** (#E8A800): Connectivity warnings, waiting room alerts
- **Error** (#E02828): Disconnected status, error messages, leave/end actions

## Typography
- **Display Font**: Lato — loaded from Google Fonts
- **Body Font**: Lato — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Lato provides a warm yet professional tone ideal for productivity interfaces. Use weights 400 (body), 700 (headings), and 900 (hero text). Letter-spacing is -0.01em for headings and 0em for body. Line height is 1.5 for body text, 1.2 for display headings.

Type scale:
- Display: 36px / 700
- H1: 28px / 700
- H2: 22px / 700
- H3: 18px / 700
- Body: 15px / 400
- Caption: 13px / 400
- Overline: 11px / 700, uppercase, letter-spacing 0.08em

## Elevation
Use subtle box shadows to establish hierarchy in the grid layout. Level 0 (flat) for inline elements. Level 1 (`0 1px 3px rgba(14,14,16,0.08)`) for cards and tiles. Level 2 (`0 4px 12px rgba(14,14,16,0.12)`) for floating panels, dropdowns, and participant popovers. Level 3 (`0 8px 24px rgba(14,14,16,0.16)`) for modals and dialogs. Meeting tiles in gallery view use Level 1 at rest and Level 2 on hover.

## Components
- **Buttons**: 36px height, 16px horizontal padding, 6px border-radius, Lato 700 at 14px. Primary: #2D8CFF bg, white text. Secondary: transparent bg, #2D8CFF text, 1px #2D8CFF border. Danger: #E02828 bg, white text. Disabled: 40% opacity, no pointer events.
- **Cards**: White background, 1px #D8D8E0 border, 8px border-radius, 16px padding. Participant video tiles use 4px radius with 2px #2D8CFF border when speaking.
- **Inputs**: 40px height, 12px horizontal padding, 6px border-radius, 1px #D8D8E0 border. Focus: 2px #2D8CFF border. Placeholder: #747487. Error state: 1px #E02828 border with error message below.
- **Chips**: 28px height, 12px horizontal padding, 9999px border-radius, #F7F7FA bg, #53535F text at 13px. Active: #2D8CFF bg, white text.
- **Lists**: 40px row height, 12px left padding, hover bg #F7F7FA. Active item: #E8F1FF bg, #2D8CFF left border 3px.
- **Checkboxes**: 18px square, 4px border-radius, 1.5px #D8D8E0 border. Checked: #2D8CFF bg, white checkmark. Focus ring: 2px offset, #2D8CFF at 30% opacity.
- **Tooltips**: #0E0E10 bg, white text at 12px, 4px border-radius, 6px 10px padding, max-width 200px. Arrow centered on trigger.
- **Navigation**: Top bar 56px height, white bg, bottom 1px #D8D8E0 border. Meeting controls: centered bottom bar, 64px height, #1A1A2E bg, 12px radius top corners, icon buttons 44px with hover #2D8CFF.
- **Search**: 40px height input with magnifying glass icon left-aligned, 8px border-radius, #F7F7FA bg. Focus: white bg, 2px #2D8CFF border. Results dropdown with Level 2 shadow.

## Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80
- Component padding: Buttons 8px 16px, Cards 16px, Inputs 8px 12px
- Section spacing: 48px between major sections, 24px between related groups
- Container max width: 1280px, centered with 24px side padding
- Card grid gap: 16px (gallery view), 8px (compact grid)

## Border Radius
- 4px: Video tiles, small elements
- 6px: Buttons, inputs, chips inline
- 8px: Cards, panels, dropdowns
- 12px: Modals, control bars, floating UI
- 9999px: Avatars, status indicators, pill chips

## Do's and Don'ts
- Do use the blue (#2D8CFF) exclusively for primary actions and active states
- Do maintain generous whitespace in grid layouts for visual clarity
- Don't use more than two levels of elevation in a single view
- Do use 44px minimum touch targets for meeting controls
- Don't combine multiple bright colors; let blue be the sole accent
- Do provide clear visual feedback for connection states (green/yellow/red)
- Don't use decorative elements that distract from the core content grid
- Do keep typography sizes consistent; avoid mixing too many sizes on one screen
