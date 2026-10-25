# Blurple Guild

## Overview
Blurple Guild is a dark-mode community design system inspired by the platform where gamers, creators, and communities gather in servers and voice channels. It blends a distinctive blue-purple ("blurple") accent with deeply dark backgrounds, rounded shapes, and a friendly personality that makes real-time communication feel like hanging out with friends. The aesthetic is approachable yet dense, balancing playful visual touches with the functional demands of managing dozens of active conversations simultaneously.

## Colors
- **Primary** (#5865F2): Interactive elements, mentions, links, selected states, CTAs — Blurple
- **Primary Hover** (#4752C4): Hovered buttons and links, slightly deeper for affordance
- **Secondary** (#EB459E): Nitro branding, boosts, special badges, urgent notifications — Fuchsia
- **Neutral** (#B5BAC1): Secondary text, channel descriptions, timestamps, muted content
- **Background** (#313338): Main content area background, message panel — Dark Charcoal
- **Surface** (#2B2D31): Sidebar, user panel, modals, secondary panels — Darker Charcoal
- **Text Primary** (#F2F3F5): Message text, channel names, usernames, headings — near white
- **Text Secondary** (#B5BAC1): Timestamps, descriptions, inactive channel names
- **Border** (#3F4147): Channel category dividers, embed borders, subtle separators
- **Success** (#57F287): Online status, successful actions, bot verified badges — Green
- **Warning** (#FEE75C): Idle status, slow mode indicators, caution notices — Yellow
- **Error** (#ED4245): DND status, failed messages, kick/ban actions, destructive buttons — Red

## Typography
- **Display Font**: Plus Jakarta Sans — loaded from Google Fonts
- **Body Font**: Plus Jakarta Sans — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Plus Jakarta Sans is used at weights 400, 500, 600, and 700 throughout the interface. Server names and channel categories use 700 weight at 12px uppercase with 0.02em letter-spacing for a compact, label-like appearance. Channel names use 500 weight at 16px. Message body text uses 400 weight at 16px with 1.375 line height for comfortable reading in long conversation threads. Usernames in message headers use 500 weight in role-assigned colors. JetBrains Mono renders code blocks with a distinctive #2B2D31 background and 1px #3F4147 border. The type scale: 12px (category labels/timestamps), 14px (small text/meta), 16px (body/channels), 20px (section titles), 24px (server headers/modals), 28px (settings page titles).

## Elevation
The dark interface uses layered backgrounds for depth. The server list sidebar sits at #1E1F22 (darkest), the channel sidebar at #2B2D31, the main message area at #313338, and the member list at #2B2D31. Popovers and context menus use #111214 background with 4px border radius and 0 8px 16px rgba(0, 0, 0, 0.24) shadow. Modals use #313338 background with 0 0 0 1px rgba(0, 0, 0, 0.08), 0 16px 32px rgba(0, 0, 0, 0.24) shadow and a rgba(0, 0, 0, 0.7) backdrop overlay. User profile popouts float with 0 8px 16px rgba(0, 0, 0, 0.2) shadow. The philosophy is color-layer-first with shadows reserved for floating elements.

## Components
- **Buttons**: Primary uses #5865F2 background with #FFFFFF text, 3px radius, 16px horizontal padding, 500 weight, 38px height. Destructive uses #ED4245 background. Success uses #57F287 background with black text. Secondary uses #4E5058 background. Link variant uses no background, #FFFFFF text with underline on hover. Hover transitions are 170ms ease. Small buttons are 32px height, large are 44px height.
- **Cards**: Embed cards use 4px left border in link/role color, #2B2D31 background, 4px radius, 16px padding. Server discovery cards use #2B2D31 background, 8px radius, with a banner image at top (160px height), server icon overlapping the boundary, and server info below. Hover lifts with shadow and brightens background to #35373C.
- **Inputs**: #1E1F22 background, no visible border, 3px radius, 10px 12px padding, 16px font, #F2F3F5 text. Focus state adds no visible border — the background lightens slightly to #232428. The main message input is a multi-line textarea at the bottom of the chat with an integrated toolbar for attachments, emoji, GIFs, and stickers.
- **Chips**: Role badges use the role's assigned color as background at 15% opacity with full-color text, 3px radius, 4px 6px padding, 12px font, 500 weight. Status tags (Online, Idle, DND, Offline) use their respective status colors. Mention chips use #5865F2 at 30% opacity with #DEE0FC text, 3px radius.
- **Lists**: Channel lists use 32px row height, 8px left padding, 4px 8px right padding, 2px radius on hover highlight (#35373C). Active channel has #3F4147 background with #F2F3F5 text. Muted channels use #6D6F78 text. Member lists show users grouped by role with 44px rows, avatar (32px circle), username, and custom status.
- **Checkboxes**: 24x24px, #1E1F22 background, 1px solid #4E5058 border, 3px radius. Checked state fills #5865F2 with white checkmark. Used in role permissions, notification settings, and privacy toggles. Toggle switches are 40x24px, #72767D track off, #57F287 track on.
- **Tooltips**: #111214 background, #F2F3F5 text, 4px radius, 8px 12px padding, 14px font, 500 weight. Arrow-tipped, positioned above by default. Appear instantly on hover (no delay). Used extensively for icon-only buttons in toolbars.
- **Navigation**: Three-column layout — server list (72px, #1E1F22, vertical icon strip), channel sidebar (240px, #2B2D31), and main content (fluid, #313338). Server icons are 48px squares with 16px radius (morphing to circle on hover via CSS transition). Active server has a 40px white pill indicator on the left edge. Unread channels show a white dot indicator.
- **Search**: Top-right search button opens a search panel overlay. #1E1F22 background, 3px radius, full-width within the header. Advanced filters for from:, mentions:, has:, before:, during:, in: using pills. Results appear in a popout panel with message previews and jump-to functionality.

## Spacing
- Base unit: 4px
- Scale: 2px, 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px
- Component padding: Buttons 2px 16px, messages 2px 16px (cozy) / 2px 16px (compact), channel rows 1px 8px, inputs 10px 12px
- Section spacing: 16px between message groups (different authors), 2px between sequential messages (same author), 24px between channel categories
- Container max width: Fluid — fills available width minus sidebars. Modals are 440px (narrow) or 580px (wide).
- Card grid gap: 16px in server discovery grid

## Border Radius
- 3px: Buttons, inputs, code blocks, mention chips, role badges, channel hover highlights
- 4px: Embed cards, popovers, context menus, tooltips
- 8px: Server discovery cards, modals, image attachments, settings panels
- 16px: Server icons (resting state), large imagery
- 9999px: Avatar images (circle), server icons (hover/active state), notification badges, pill indicators

## Do's and Don'ts
- Do use blurple (#5865F2) as the signature interaction color — it's the brand heartbeat
- Do use role colors for usernames — the colorful message feed is a signature visual element
- Do support "cozy" and "compact" message display modes with different spacing
- Do use the three-column layout pattern — server list, channel sidebar, main content + optional member list
- Do round server icons from 16px to full circle on hover — this micro-interaction is iconic
- Don't use light backgrounds in the main interface — the entire experience is dark mode
- Don't override role colors with arbitrary styling — role hierarchy and color assignment are community identity
- Don't space messages too far apart — conversation flow requires density, especially in active channels
- Don't use borders on text inputs — the background color difference (#1E1F22 on #313338) provides sufficient contrast
