# Metric Flow

Clean, data-dense, obsessively organized.

## Overview

Metric Flow is a design system built for analytics dashboards and KPI tracking platforms where every pixel serves a purpose. The philosophy is maximum data visibility with minimal chrome — dense layouts, tight spacing, and a restrained color palette that reserves vibrancy for meaningful data points. The mood is clinical precision: a surgeon's tray of perfectly aligned instruments. Designed for power users who live in dashboards eight hours a day.

## Colors

- **Primary** (#3B82F6): Interactive elements, active states, primary actions, chart accent
- **Secondary** (#10B981): Positive trends, success metrics, growth indicators
- **Tertiary** (#F59E0B): Warnings, thresholds, attention-worthy data points
- **Background** (#F9FAFB): App-level background canvas
- **Surface** (#FFFFFF): Cards, panels, data containers
- **Success** (#10B981)
- **Warning** (#F59E0B)
- **Error** (#EF4444)
- **Info** (#3B82F6)

## Typography

- **Headline Font**: Inter
- **Body Font**: Inter
- **Mono Font**: IBM Plex Mono

- **Display**: Inter 48px bold, 1.1 line height, 0.02em tracking. Dashboard hero metrics.
- **Headline**: Inter 36px bold, 1.2 line height, 0.01em tracking. Page-level headings.
- **Subhead**: Inter 24px semibold, 1.3 line height, 0.005em tracking. Section titles, card headings.
- **Body Large**: Inter 18px regular, 1.6 line height. Lead paragraphs, summaries.
- **Body**: Inter 15px regular, 1.6 line height. Default body text.
- **Body Small**: Inter 14px regular, 1.5 line height. Table cell text, secondary info.
- **Caption**: Inter 12px medium, 1.4 line height, 0.01em tracking. Axis labels, chart legends, metadata.
- **Overline**: Inter 11px bold, 1.2 line height, 0.08em tracking. Category tags, column headers (uppercase).
- **Code**: IBM Plex Mono 14px regular, 1.5 line height. Inline code, data values, query text.

## Spacing

- **Base unit:** 4px
- **Scale:** 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80
- **Component padding:** 8px (small), 12px (medium), 16px (large)
- **Section spacing:** 24px (mobile), 32px (tablet), 48px (desktop)

## Border Radius

- **None:** 0px — Data table cells, inline badges
- **Small:** 3px — Chips, small tags, mini buttons
- **Medium:** 6px — Cards, inputs, dropdowns, modals
- **Large:** 8px — Panels, prominent containers
- **XL:** 12px — Feature callouts, onboarding cards
- **Full:** 9999px — Avatars, status dots, pill badges

## Elevation

Metric Flow uses Material-style layered shadows to communicate elevation above the data canvas. Each level adds depth without distraction — shadows are always neutral gray, never colored.
- **Subtle:** 1px offset, 2px blur, #000000 at 5%
- **Medium:** 4px offset, 6px blur, -1px spread, #000000 at 8%; 2px offset, 4px blur, -2px spread, #000000 at 5%
- **Large:** 10px offset, 15px blur, -3px spread, #000000 at 8%; 4px offset, 6px blur, -4px spread, #000000 at 4%
- **Overlay:** 20px offset, 25px blur, -5px spread, #000000 at 10%; 8px offset, 10px blur, -6px spread, #000000 at 6%

## Components

### Buttons
- **Primary (Filled)**: #3B82F6 fill, #FFFFFF text, 6px corners. Inter 14px 600. 8px/16px padding. Hover: background shifts to #2563EB. Active: background shifts to #1D4ED8, scale 0.98.
- **Secondary (Outline)**: transparent, #3B82F6 text, 1px #3B82F6 border, 6px corners. 8px/16px padding. Hover: background fills #EFF6FF.
- **Ghost**: transparent, #6B7280 text. Hover: background fills #F3F4F6, text shifts to #111827.
- **Destructive**: #EF4444 fill, white text. Hover: background shifts to #DC2626.
- **Sizes**: Small (32px), Medium (36px), Large (44px)
- **Disabled**: 40% opacity, disabled cursor

### Cards
- **Default**: #FFFFFF fill, 1px #E5E7EB border, 6px corners. 16px padding. Hover: border color shifts to #D1D5DB.
- **Elevated**: Medium shadow. Hover: shadow transitions to Large.

### Inputs
- **Text Input**: #FFFFFF fill, 1px #E5E7EB border, #111827 text, 6px corners. Inter 14px. #9CA3AF placeholder, 8px/12px padding, 36px tall. Focus: border #3B82F6, ring 3px ring #3B82F6 at 15%. Error: border #EF4444, message #EF4444. Disabled: background #F9FAFB, text 50% opacity.
- **Label**: Above input, Inter, 13px, 500, #374151
- **Helper text**: 12px, #6B7280

### Chips
- **Filter Chip**: 3px corners, 1px #E5E7EB border. 12px 500. 28px tall, 8px/horizontal padding. Selected: background #3B82F6, text #FFFFFF, border transparent. Hover: background #F3F4F6.
- **Status Chip**: background #ECFDF5, text #059669, border #A7F3D0 success, background #FFFBEB, text #D97706, border #FDE68A warning. Error: background #FEF2F2, text #DC2626, border #FECACA.

### Lists
- **Default List Item**: Inter 14px. 40px tall, 8px/12px padding, 1px #F3F4F6 divider, 18px icon, 8px spacing from text with icon. Hover: background #F9FAFB. Selected: background #EFF6FF, text #3B82F6.

### Checkboxes
16px, 1.5px #D1D5DB border, 3px corners. Checked: background #3B82F6, white checkmark. Indeterminate: background #3B82F6, white dash. Disabled: 40% opacity. Labels in Inter 14px 8px spacing from box.

### Radio Buttons
16px outer circle, 1.5px #D1D5DB border. Selected: border #3B82F6, inner dot 8px #3B82F6. Disabled: 40% opacity. Labels in Inter 14px 8px spacing from circle.

### Tooltips
#111827 fill, #FFFFFF text, 4px corners. 12px 500. 6px/10px padding, 240px max width, 6px arrow, 300ms delay, top (default) position.

## Do's and Don'ts
- Do reserve saturated color for actionable or meaningful data — blue for links, green for positive, red for negative
- Do maintain strict vertical alignment across KPI cards, tables, and chart grids
- Do use the mono font for all numeric data values to ensure tabular alignment
- Don't use color as the sole differentiator — always pair with icons or labels for accessibility
- Don't exceed three chart accent colors per visualization without a legend
- Don't add decorative shadows to flat data tables — tables stay borderless with row dividers only
- Do keep dashboard cards at consistent heights within a row for visual rhythm
- Don't mix compact and standard spacing within the same view — choose one density per page
