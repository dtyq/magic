# Channel Palette

## Overview
Channel Palette is a colorful, workspace-oriented design system designed for persistent team communication. Its signature aubergine purple anchors a multi-color system of blues, greens, yellows, and reds — each color serving a distinct functional role. The aesthetic is friendly yet productive, balancing playful personality with the structured information density that teams need to stay organized across channels, threads, and direct messages.

## Colors
- **Primary** (#4A154B): Sidebar backgrounds, brand identity, premium surfaces — Aubergine
- **Primary Hover** (#3D1140): Hover states on sidebar items and aubergine surfaces — Deep Plum
- **Blue** (#36C5F0): Links, informational highlights, channel indicators — Sky Blue
- **Green** (#2EB67D): Online status, success confirmations, positive actions — Clover Green
- **Yellow** (#ECB22E): Stars, bookmarks, attention indicators, warning states — Marigold
- **Red** (#E01E5A): Mentions, notifications, urgent badges, error states — Signal Pink
- **Neutral** (#616061): Secondary text, timestamps, channel descriptions — Warm Gray
- **Background** (#FFFFFF): Main message canvas, thread panels — White
- **Surface** (#F8F8F8): Message hover states, code blocks, input areas — Off White
- **Surface Alt** (#1A1D21): Dark sidebar variant for workspaces — Charcoal
- **Text Primary** (#1D1C1D): Message text, channel names, primary content — Near Black
- **Text Secondary** (#616061): Timestamps, edited labels, meta information — Warm Gray
- **Border** (#DDDDDD): Channel dividers, section separators, input borders — Light Gray
- **Success** (#2EB67D): File uploaded, message sent, integration connected — Clover Green
- **Warning** (#ECB22E): Rate limits, storage warnings, trial ending — Marigold
- **Error** (#E01E5A): Failed sends, connection errors, required fields — Signal Pink

## Typography
- **Display Font**: Lato — loaded from Google Fonts
- **Body Font**: Lato — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Lato provides the warm, humanist tone that balances professionalism with friendliness. Message text uses weight 400 at 15px with 1.46 line-height for comfortable reading in long threads. Usernames in messages use weight 700 at 15px. Channel names use weight 700. Section headers use weight 700 at 13px in uppercase with 1px letter-spacing for sidebar sections. Code snippets use JetBrains Mono at 13px with #F8F8F8 background. Emoji are rendered at 1.2x the surrounding text size.

Type scale: 12px (timestamp/micro) / 13px (sidebar/code) / 15px (body/message) / 18px (title) / 22px (section heading) / 28px (page heading)

## Elevation
Elevation is minimal in the messaging context to maintain a document-like feel. The sidebar has no shadow — it's distinguished by background color (#4A154B or #1A1D21). Modals use `box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2)` with a backdrop at rgba(0, 0, 0, 0.4). Dropdown menus use `box-shadow: 0 0 0 1px rgba(29, 28, 29, 0.13), 0 4px 12px rgba(0, 0, 0, 0.12)` — the inset border-shadow is a signature pattern. Tooltips use `box-shadow: 0 0 0 1px rgba(29, 28, 29, 0.13), 0 1px 4px rgba(0, 0, 0, 0.12)`. Hover states on messages add a subtle #F8F8F8 background with action toolbar appearing.

## Components
- **Buttons**: Primary buttons have #007A5A (dark green) background, white text, 4px border-radius, height 36px, padding 0 16px, font-weight 700, font-size 15px. This green differs from the brand green for better contrast. Secondary buttons have #FFFFFF background, 1px solid #DDDDDD border, #1D1C1D text. Danger buttons use #E01E5A background. Disabled at 0.5 opacity. Icon-only buttons are 28px square with 4px radius.
- **Cards**: Message groups have no card container — they flow directly on the white canvas. Each message shows a 36px avatar, username at weight 700, timestamp at 12px #616061, and message body. File attachments appear as bordered cards (1px #DDDDDD, 4px border-radius) with file icon, name, and size. Shared links unfurl with thumbnail, title, and description in a bordered card.
- **Inputs**: Message composer has 1px solid #DDDDDD border, 8px border-radius, min-height 44px expanding to content, padding 12px, font-size 15px. Focus state changes border to #1D1C1D. Toolbar below with formatting icons (B, I, ~, link, list, code). Channel topic input is inline with #F8F8F8 background. Search input is 36px height, 6px border-radius, with filter scope indicator.
- **Chips**: User mention chips have #E8F5FA background, #1264A3 text, 3px border-radius, inline with text. Channel mention chips use #E8F5FA similarly. Emoji reaction chips sit below messages — pill-shaped with #F8F8F8 background, 1px #DDDDDD border, 16px height, showing emoji + count. Active (own) reactions use #DCF4FF background with #1264A3 border.
- **Lists**: Channel list in sidebar uses 28px row height, # prefix for channels, lock icon for private, 13px weight 400. Unread channels use weight 700. Active channel has a lighter background tint on aubergine sidebar. DM list shows 20px online indicator dot (green) next to 20px avatar. Section headers are 13px uppercase weight 700 with expand/collapse chevron.
- **Checkboxes**: Custom 16px square, 3px border-radius, 1.5px solid #868686 border. Checked fills #007A5A with white checkmark. Used in settings and workflow builder forms. Toggle switches for preferences: 36px wide, 20px tall, #868686 track unchecked, #007A5A checked.
- **Tooltips**: #1D1C1D background, white text, 6px border-radius with the signature inset shadow `box-shadow: 0 0 0 1px rgba(29, 28, 29, 0.13)`, padding 6px 10px, font-size 13px, max-width 260px. Arrow 5px. Delay 300ms. Used extensively for icon-only toolbar buttons.
- **Navigation**: Left sidebar is 260px, #4A154B background (or #1A1D21 dark variant). Workspace name at top, 48px height, weight 700, white text. Below: sections for Channels, Direct Messages, Apps. Each section is collapsible. Top bar above message area is 49px, #FFFFFF background, showing channel name, topic, and action icons (search, pins, members). No bottom navigation.
- **Search**: Top-bar search icon opens a full search overlay. 44px input height, white background, 8px border-radius. Filter pills below for "from:user", "in:channel", "has:link". Results show messages with highlighted matches, grouped by channel. Date range pickers in search filters.

## Spacing
- Base unit: 4px
- Scale: 4px / 8px / 12px / 16px / 20px / 24px / 32px / 48px
- Component padding: Messages 20px horizontal, sidebar items 0 16px, modals 24px
- Section spacing: 0px between messages (continuous thread), 16px between message groups (different authors)
- Container max width: No max — fills available width minus sidebar. Message content max-width varies
- Card grid gap: N/A (messages are a continuous list, not a grid)

## Border Radius
- 3px: Inline mention chips, emoji reactions, micro badges
- 4px: Buttons, file cards, checkboxes, dropdown items
- 6px: Search input, tooltips, menus
- 8px: Message composer, modals, dialog boxes
- 9999px: Avatars, status dots, notification badges, pill filters

## Do's and Don'ts
- Do use the aubergine (#4A154B) exclusively for the sidebar — it is the brand's spatial anchor
- Do differentiate unread content with bold weight, not color; weight is the unread signal
- Don't use all four brand colors simultaneously in a component; each color has its functional role
- Do keep message text at 15px — readability in long threads is critical
- Don't add borders between individual messages; use spacing and grouping by author instead
- Do show timestamps on hover for individual messages, but display them inline at group boundaries
- Don't use heavy elevation in the messaging area; it should feel like a continuous document
- Do use emoji reactions below messages for lightweight acknowledgment without cluttering the thread
- Do support keyboard-first interaction — Cmd+K for switching, arrow keys for navigation
