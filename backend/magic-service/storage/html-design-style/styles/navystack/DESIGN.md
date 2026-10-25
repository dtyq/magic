# NavyStack

## Overview
NavyStack is a deep-navy industrial dashboard design system built for equipment lifecycle management platforms. Rooted in the aesthetic of command consoles and SCADA systems, it pairs a dark naval background (`#0a0e27`) with a single electric-cyan primary (`#00d4ff`) that drives all interactive emphasis. The mood is technical, dense, and quietly authoritative — designed for operators and engineers who live in tables, charts, and alert feeds for hours at a time.

The system uses an app-shell layout: a fixed dark sidebar (220px) for navigation, a compact top bar (60px) for breadcrumbs and global actions, and a scrollable content area that packs KPI cards, charts, tables, and forms at high density without feeling cluttered.

## Colors
- **Background** (`#0A0E27`): Deep navy page canvas. Never pure black — the blue undertone keeps the interface cooler and more technical than neutral dark themes.
- **Sidebar / Header** (`#0D1333`): Slightly lifted navy for chrome surfaces, creating a subtle two-tone depth against the page background.
- **Card Surface** (`#111638`): Card and panel background. Noticeably lighter than the page background so content areas read as elevated surfaces.
- **Card Hover** (`#161D48`): Elevated hover state for cards and interactive rows.
- **Primary Cyan** (`#00D4FF`): The system's single dominant accent. Used for active navigation, links, focus rings, chart data lines, primary buttons, and key interactive states. Must be used sparingly — its impact comes from contrast against the dark navy.
- **Purple** (`#7C3AED`): Secondary accent for variety in charts, version badges, and tertiary status indicators.
- **Green** (`#10B981`): Success, running status, completed states, positive trends.
- **Yellow** (`#F59E0B`): Warning, pending, maintenance-due, medium-severity alerts.
- **Red** (`#EF4444`): Danger, fault, stopped, urgent alerts, destructive actions.
- **Text Primary** (`#E2E8F0`): High-contrast body text — never pure white, the slight blue tint reduces eye strain.
- **Text Secondary** (`#94A3B8`): Muted slate for labels, metadata, placeholders, and secondary information.
- **Border** (`#1E2756`): Subtle navy border for cards, tables, inputs, and dividers. Dark enough to recede, visible enough to define edges.

## Typography
- **Primary typeface:** System sans-serif stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`. No webfont dependency — the system loads instantly and renders natively on every OS.
- **KPI values:** 26px bold with 14px/400 unit labels in secondary color. Numbers use system font at bold weight — no monospace requirement.
- **Page headings:** 14–18px semibold (600 weight) for panel titles and section headers.
- **Body text:** 12–13px for tables and content, 11px for labels and metadata.

## Spacing
- Base unit: loosely 4px-derived but not strict. Common values: 4, 6, 8, 10, 12, 14, 16, 18, 20, 24px.
- **Content padding:** 20px vertical, 24px horizontal inside the scrollable area.
- **Card padding:** 16px (standard), 14px (compact), 18px (KPI cards with extra horizontal space).
- **Grid gaps:** 16px for major layout grids (KPI row, chart row), 12–14px for tighter component grids.

## Border Radius
- **8px** — Default for cards, panels, modals, and large containers. This is the system's signature radius — soft enough to feel modern, sharp enough to feel industrial.
- **6px** — Buttons, inputs, dropdowns, calendar cells.
- **4px** — Tags, badges, small interactive chips.
- **20px** — Header search bar only (pill-shaped).
- **50%** — Avatars, status dots.

## Layout
The system uses a classic app-shell layout designed for desktop (1200px+ recommended).

- **Sidebar:** 220px fixed width, `#0D1333` background, right border `1px solid #1E2756`. Contains logo area (with gradient icon), collapsible navigation tree, and scrolls independently.
- **Header:** 60px height, `#0D1333` background, bottom border. Contains breadcrumb navigation (left), global search + notifications + user avatar (right).
- **Content:** Flex-1 scrollable area with `20px 24px` padding.

### Content Grids
- **KPI row:** `grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))` with `16px` gap.
- **Chart row:** Two equal columns (`1fr 1fr`) with `16px` gap.
- **Info grid:** `repeat(auto-fit, minmax(240px, 1fr))` with `12px` gap.
- **Video grid:** Two equal columns with `12px` gap and `16/10` aspect ratio.

## Components

### Sidebar Navigation
Logo area at top: 32px gradient icon square (cyan→purple), title text with subtitle. Navigation items are 13px with 10px vertical / 20px horizontal padding. Active item gets cyan text, subtle cyan background (`rgba(0,212,255,0.08)`), and a `3px solid` cyan right border. Sub-items indent to 48px and appear on parent expand.

### Cards (`.stat-card`)
Background `#111638`, border `1px solid #1E2756`, radius `8px`, padding `16px 18px`. On hover: translate up 2px + cyan glow shadow. Label is 12px secondary text; value is 26px bold primary text. Change indicator is 11px with green (up) or red (down).

### Buttons
- **Primary:** Cyan fill (`#00D4FF`) with dark text (`#000`), bold weight, 6px radius. Hover brightens to `#33DDFF` and adds cyan glow.
- **Outline:** Transparent with `1px solid #1E2756` border, secondary text. Hover changes border to cyan and text to cyan.
- **Danger:** Red fill, white text.
- **Success:** Green fill, white text.
- **Small:** `4px 10px` padding, 11px font.

### Tables
Full-width with collapsed borders, 13px font. Header cells: 12px secondary text, `border-bottom: 1px solid #1E2756`. Body cells: `padding: 10px 12px`, `border-bottom: 1px solid rgba(30,39,86,0.5)`. Rows transition background on hover to `rgba(0,212,255,0.03)`. ID columns use cyan text color.

### Tags / Badges (`.tag`)
Inline-block, `2px 8px` padding, `4px` radius, 11px medium weight. Each variant uses a 15%-opacity background of its semantic color with full-opacity text.

### Status Dots (`.status-dot`)
Inline 8px circles with colored glow shadows. Used inline before status text in tables and monitor cards.

### Forms & Inputs
Inputs use `#0A0E27` background, `1px solid #1E2756` border, `6px` radius, `8px 12px` padding, 13px text. Focus: border turns cyan. Two-column form rows use `1fr 1fr` grid with `12px` gap.

### Modal
Fixed overlay (`rgba(0,0,0,0.6)`) with centered flex. Box: `#111638` bg, `1px solid #1E2756` border, `12px` radius, `24px` padding, `560px` max width. Click overlay to close.

### Tabs
Horizontal flex with `border-bottom: 1px solid #1E2756`. Active: cyan text + `2px solid` cyan bottom border.

### Timeline
Left-bordered list with `2px solid #1E2756` vertical line. Items have 10px cyan-bordered circle markers. Date 12px secondary, title 13px medium.

### Calendar
7-column grid (`repeat(7, 1fr)`) with `2px` gap. Today: cyan text bold. Event days: 4px cyan dot. Hover: `rgba(0,212,255,0.08)`.

### Charts (Canvas 2D)
- **Ring/Donut:** Center total + label. 20px line width, round lineCap.
- **Line:** Grid `rgba(30,39,86,0.6)`, data line cyan 2px, semi-transparent area fill.
- **Bar:** Rounded-top bars with vertical gradient (solid → 20% opacity).

## Do's and Don'ts
- ✅ **Do** use the deep navy three-tone hierarchy (`#0A0E27` → `#111638` → `#0D1333`) to create depth without shadows.
- ✅ **Do** let cyan (`#00D4FF`) drive all interactive emphasis — links, active states, focus rings, chart data, primary buttons.
- ✅ **Do** use the system font stack — the design prioritizes instant load and native rendering.
- ✅ **Do** pack data at high density — this is an operator's tool, not a marketing page.
- ✅ **Do** use the status dot + tag combination for equipment states.
- ✅ **Do** maintain `8px` card radius as the system's signature.

- ❌ **Don't** introduce additional saturated brand colors beyond cyan, purple, green, yellow, red.
- ❌ **Don't** use pure white (`#FFFFFF`) for text. `#E2E8F0` is the maximum brightness.
- ❌ **Don't** add heavy box-shadows. Depth comes from color hierarchy and subtle glow.
- ❌ **Don't** increase card radius beyond `12px` — bubbly shapes undermine the industrial atmosphere.
- ❌ **Don't** use pastel or light backgrounds — this is dark-mode-first for prolonged monitoring.
- ❌ **Don't** use decorative fonts or letter-spacing tricks.
- ❌ **Don't** place multiple filled cyan buttons adjacent — one primary action per view section.
