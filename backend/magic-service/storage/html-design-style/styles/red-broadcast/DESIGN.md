# Red Broadcast

## Overview
A content-first design system engineered for video consumption at scale. Red Broadcast uses a signature red accent sparingly against clean white and dark surfaces, letting video thumbnails dominate the visual landscape. The aesthetic is efficient and grid-driven — designed for rapid scanning across thousands of videos while maintaining a consistent, recognizable framework that works from mobile to living room screens.

## Colors
- **Primary** (#FF0000): Subscribe button, live badges, progress bars — Broadcast Red
- **Primary Hover** (#CC0000): Hover state for red interactive elements
- **Secondary** (#065FD4): Text links, hashtags, channel mentions — Link Blue
- **Neutral** (#606060): Secondary text, metadata, icon buttons — Gray 600
- **Background** (#FFFFFF): Light mode primary background
- **Surface** (#F2F2F2): Chip bar background, sidebar hover, comment input — Gray 100
- **Text Primary** (#0F0F0F): Video titles, channel names, primary content — Near Black
- **Text Secondary** (#606060): View counts, timestamps, descriptions — Gray 600
- **Border** (#E5E5E5): Dividers, card outlines (rarely used) — Gray 200
- **Success** (#2BA640): Verified badges, successful uploads, monetization active
- **Warning** (#FB8C00): Age-restricted content, copyright claims, review pending
- **Error** (#FF0000): Reuses red — strikes, policy violations, upload failures

## Typography
- **Display Font**: Roboto — loaded from Google Fonts
- **Body Font**: Roboto — loaded from Google Fonts
- **Code Font**: Roboto Mono — loaded from Google Fonts

Roboto is used everywhere for its neutral versatility and extensive language support — critical for a global platform. Headlines use weight 500 and 700 for titles. Body text uses weight 400 for descriptions and metadata. The type system is compact, with most UI text at 12-14px to maximize space for video content. Video titles are the most prominent text element, using weight 500 at 14-16px with strict 2-line clamping for grid consistency.

- **Page Title**: Roboto 24px/32px, weight 700
- **Section Title**: Roboto 20px/28px, weight 500
- **Video Title (Grid)**: Roboto 14px/20px, weight 500, max 2 lines, text-overflow ellipsis
- **Video Title (Watch)**: Roboto 20px/28px, weight 700
- **Channel Name**: Roboto 14px/20px, weight 500
- **Body**: Roboto 14px/20px, weight 400
- **Body Small**: Roboto 12px/18px, weight 400
- **Metadata**: Roboto 12px/16px, weight 400
- **Label**: Roboto 12px/16px, weight 500, tracking 0.02em
- **Button Text**: Roboto 14px/20px, weight 500
- **Code**: Roboto Mono 14px/20px, weight 400

## Elevation
Elevation is minimal in the content browsing experience. Level 0: flat, no shadow — default for cards and most surfaces (borders are preferred over shadows). Level 1: 0 1px 2px rgba(0,0,0,0.1) — for sticky header on scroll and mini-player. Level 2: 0 4px 32px rgba(0,0,0,0.1) — for dropdown menus, share dialogs, comment option menus. Level 3: 0 8px 40px rgba(0,0,0,0.2) — for modals and full-screen overlays. The video player uses no elevation — it sits flush within the page. Dark mode shadows switch to rgba(255,255,255,0.05) on borders instead of box-shadows.

## Components
- **Buttons**: Subscribe uses #0F0F0F fill (dark), white text, 36px height, 16px horizontal padding, 9999px border-radius, Roboto 14px weight 500. Subscribed state: #F2F2F2 fill, #0F0F0F text, bell icon. Icon buttons are 40px circles, transparent, #606060 icon, hover #F2F2F2 background. Like/dislike pair uses segmented button with 1px #E5E5E5 border. Outlined button: 1px #E5E5E5 border, 9999px radius, #0F0F0F text.
- **Cards**: No visible card container — video grid items are raw thumbnail + text stack. Thumbnail is 16:9 aspect ratio, 12px border-radius, with duration badge bottom-right (Roboto 12px weight 500, #0F0F0F on rgba(0,0,0,0.6) backdrop, 4px/8px padding, 4px radius). Below: channel avatar (36px circle) left, title + channel name + metadata (views dot date) right. Hover on thumbnail shows preview on delay (2 seconds). Watch later icon appears on thumbnail hover top-right.
- **Inputs**: 40px height, #F2F2F2 background (or transparent with 1px #E5E5E5 bottom border for comment input), 0px border-radius (search) or 9999px (comment), 16px horizontal padding. Search input: flat bottom border style, focused state shows 1px #0F0F0F bottom border. Comment input: bottom border only, expands to textarea on focus with cancel/submit buttons.
- **Chips**: Pill-shaped (9999px radius), #F2F2F2 background, #0F0F0F text, Roboto 14px weight 500, 8px/12px padding. Selected: #0F0F0F background, #FFFFFF text. Horizontally scrolling chip bar below header for category filtering. First chip is always "All" (selected by default).
- **Lists**: Video list items (sidebar, search results) use horizontal layout: 168x94px thumbnail left, title + channel + metadata right. Up Next sidebar: stacked list, 8px gap. Comment list: avatar (40px) left, name + timestamp top, comment body below, like/reply actions at bottom. Threaded replies indented 56px.
- **Checkboxes**: 18px square, 2px border-radius. Unchecked: 2px #606060 border. Checked: #065FD4 fill with white checkmark. Used in playlist management and settings. Toggle switches for notification preferences.
- **Tooltips**: #606060 background, white text, 4px border-radius, 4px/8px padding, Roboto 12px. Simple and compact. Delay: 500ms on hover.
- **Navigation**: Top bar 56px, white, Level 1 shadow on scroll. Hamburger + logo left, search bar center (44px, 1px #E5E5E5 border, 0px radius left + 9999px radius on search button), voice search + create + notifications + avatar right. Left sidebar 240px, collapsible to 72px (icon-only rail). Active item uses #F2F2F2 background with weight 700 text.
- **Search**: Center of top bar, 44px height, white background, 1px #E5E5E5 border, square left corners, attached search button (magnifying glass icon, #F8F8F8 background, 1px #E5E5E5 border, 64px width). Suggestions dropdown with search history (clock icon) and trending (trending icon). Voice search button (microphone icon) adjacent to search.

## Spacing
- Base unit: 8px
- Scale: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px
- Component padding: 12px standard, 16px for sidebar items, 24px for page sections
- Section spacing: 24px between major sections, 8px between video metadata lines
- Container max width: 100% fluid with content area adapting to sidebar state. Max content width 2200px. Video grid auto-fills with 320px minimum column width.
- Card grid gap: 16px horizontal, 40px vertical (to accommodate title + metadata below thumbnails)

## Border Radius
- 2px: Badges, duration tags, timestamp links
- 4px: Dropdown menus, tooltips, duration overlays
- 8px: Mini-player, modals, settings panels
- 12px: Thumbnails, video player, large cards
- 9999px: Buttons, chips, search button, avatars, channel pills

## Do's and Don'ts
- Do make video thumbnails the dominant visual element — they drive clicks more than any UI
- Do use 16:9 aspect ratio consistently for all video thumbnails
- Don't overuse the red — reserve it for Subscribe buttons, live indicators, and progress bars only
- Do clamp video titles to exactly 2 lines with ellipsis for grid consistency
- Don't add borders or shadows to video cards — let thumbnails sit directly on the background
- Do show metadata compactly: "channel dot views dot time" format (e.g., "TechChannel 1.2M views 3 days ago")
- Don't auto-play video previews on hover immediately — use a 2-second delay to prevent flickering
- Do prioritize the comment section with clear threading and easy reply interactions
- Don't use custom scrollbars — rely on native scrolling for performance
