# Green Chat

## Overview
Green Chat is a messaging-first design system inspired by the world's most widely used chat application. It prioritizes simplicity, instant familiarity, and effortless conversation flow. The aesthetic is warm and approachable — built around green and teal tones with a distinctive chat-wallpaper background pattern. Every design choice serves the singular goal of making messaging feel as natural as talking face to face.

## Colors
- **Primary** (#25D366): Send button, status indicators, new chat FAB — WhatsApp Green
- **Primary Hover** (#20BD5A): Hovered send button and primary action elements
- **Secondary** (#075E54): Header backgrounds, active states, app chrome — Dark Teal
- **Neutral** (#667781): Timestamps, metadata, secondary icons, read receipts placeholder
- **Background** (#ECE5DD): Chat wallpaper background, the warm linen canvas — Chat Beige
- **Surface** (#FFFFFF): Chat bubbles (received), sidebar, contact list, modals
- **Text Primary** (#111B21): Message body text, contact names, headings
- **Text Secondary** (#667781): Last seen, typing indicator, message preview in chat list
- **Border** (#E9EDEF): Dividers in contact list, search bar outline, section separators
- **Success** (#25D366): Delivered/read status, online presence, call connected
- **Warning** (#FFC107): Starred messages, business account badges, pending states
- **Error** (#EA0038): Missed calls, delete confirmations, error notifications

## Typography
- **Display Font**: Inter — loaded from Google Fonts
- **Body Font**: Inter — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Inter is used at weights 400, 500, and 600 throughout the interface. Contact names in the chat list use 500 weight at 16px. Message body text uses 400 weight at 14.2px — a deliberate fractional size for optimal line rendering in dense chat bubbles. Timestamps within bubbles use 11px at 400 weight in #667781. Section headers (e.g., "Chats", "Status", "Calls") use 600 weight at 20px with -0.01em letter-spacing. The type scale is minimal and message-focused: 11px (timestamps/meta), 12px (labels/badges), 14.2px (message body), 16px (contact names), 20px (section headers), 24px (profile names).

## Elevation
Chat bubbles use no shadow — they rely on background color contrast against the #ECE5DD wallpaper. The sidebar uses a 1px right border (#E9EDEF) rather than shadow. Dropdowns and context menus use 0 2px 8px rgba(0, 0, 0, 0.15) for clear pop-over separation. The forwarding/sharing modal uses 0 4px 16px rgba(0, 0, 0, 0.12) with a rgba(0, 0, 0, 0.4) backdrop. The design philosophy is flat and borderline skeuomorphic — shadows are nearly absent, replaced by color boundaries and subtle borders.

## Components
- **Buttons**: The primary action is the circular send button — 48px diameter, #25D366 background, white arrow icon, no border radius needed (circular). Text buttons use #075E54 color, no background, 500 weight. Modal confirm buttons use #075E54 background with white text, 8px radius, 12px 24px padding.
- **Cards**: Not heavily used — the main UI pattern is list rows. Media message cards use #FFFFFF background with 8px radius, overflow hidden for image/video previews. Contact cards in profile view use #FFFFFF background, full-width, no border, separated by 8px vertical spacing.
- **Inputs**: Message input uses #FFFFFF background, 8px radius (pill-like for single-line, expanding for multiline), 10px 12px padding, 15px font. The search bar in the sidebar uses #F0F2F5 background, 8px radius, 36px height, with a magnifying glass icon. Focus state on search does not change border — it swaps the icon to a back arrow.
- **Chips**: Used for quick reply suggestions and labels. 32px height, 16px horizontal padding, 9999px radius (pill), #E7F8E9 background with #075E54 text for quick replies. Unread count badges are 20px min-width circles, #25D366 background, white text, 600 weight.
- **Lists**: Contact/chat list uses full-width rows, 72px height, 12px 16px padding. Each row shows avatar (48px circle), name, last message preview, timestamp, and unread badge. Divider is 1px #E9EDEF, inset from the left (starting after the avatar). Active chat row highlights with #F0F2F5 background.
- **Checkboxes**: Used in multi-select mode (forward, delete multiple). 22x22px, circular shape (not square), #FFFFFF background, 2px solid #667781 border. Checked state fills #25D366 with white checkmark. The circular checkbox is distinctive to this system.
- **Tooltips**: #323739 background, #E9EDEF text, 6px radius, 4px 8px padding, 12px font. Used sparingly for icon-only buttons in the chat header. Positioned below trigger element.
- **Navigation**: No traditional nav bar. The sidebar header contains the app logo, user avatar, and icon buttons (Status, New Chat, Menu) in a #075E54 bar at the top (or #FFFFFF on newer versions). Tab navigation between Chats/Status/Calls uses a bottom tab bar on mobile or top tabs with an underline indicator in #25D366 on desktop.
- **Search**: Sidebar search bar — #F0F2F5 background, 8px radius, 36px height, positioned below the header. In-chat search (Ctrl+F) uses a sliding panel from the top with #FFFFFF background and navigation arrows for next/previous match. Matches highlighted in #FFF3C4 within the chat.

## Spacing
- Base unit: 4px
- Scale: 4px, 8px, 12px, 16px, 24px, 32px, 48px
- Component padding: Chat bubbles 6px 8px, message input 10px 12px, list rows 12px 16px
- Section spacing: 0px between chat list items (border-separated), 8px between media cards
- Container max width: None on chat view (fills available width), sidebar fixed at 340px on desktop
- Card grid gap: Not applicable — list-based layout with no grid

## Border Radius
- 0px: Sidebar container, header bars, full-bleed sections
- 8px: Chat bubbles, message input, search bar, media previews, modals
- 12px: Shared media thumbnails, document attachment cards
- 16px: Profile photo viewer, status viewer containers
- 9999px: Send button (circle), quick reply pills, unread count badges, avatar images

## Do's and Don'ts
- Do use #DCF8C6 (light green) for sent message bubbles and #FFFFFF for received — this distinction is core to the UX
- Do keep the chat wallpaper (#ECE5DD) visible — it provides warmth and spatial orientation
- Do use circular checkboxes for multi-select — this is a signature interaction pattern
- Do group messages from the same sender with tighter spacing (2px) versus different senders (8px)
- Do show timestamps inside each bubble at the bottom-right, not between messages
- Don't use heavy typography — messages should feel casual and lightweight, never corporate
- Don't add shadows to chat bubbles — they should sit flat against the wallpaper
- Don't use the primary green (#25D366) for backgrounds of large areas — reserve it for small interactive elements
