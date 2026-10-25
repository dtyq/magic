# Pink Shot

## Overview
Pink Shot is a design-showcase design system inspired by the creative community where designers share their best work in bite-sized visual "shots." It leads with a distinctive pink accent that pops against clean whites and soft grays, creating a gallery-like experience that puts visual work front and center. The aesthetic is playful yet polished — a portfolio platform that feels like walking through a curated exhibition where every pixel celebrates the craft of design.

## Colors
- **Primary** (#EA4C89): Like buttons, CTAs, brand accents, featured badges, hover states — Dribbble Pink
- **Primary Hover** (#E2386F): Hovered primary buttons and interactive pink elements
- **Secondary** (#0D0C22): Headlines, strong labels, user names, navigation text — Deep Ink
- **Neutral** (#9E9EA7): Secondary text, shot descriptions, metadata, timestamps
- **Background** (#FFFFFF): Page background, the clean gallery canvas
- **Surface** (#F3F3F4): Card hover states, input backgrounds, sidebar sections, tag chips
- **Text Primary** (#0D0C22): Headings, shot titles, usernames, navigation labels — deep ink
- **Text Secondary** (#9E9EA7): Descriptions, follower counts, timestamps, helper text
- **Border** (#E7E7E9): Card outlines on hover, input borders, dividers, table rules
- **Success** (#2ECC71): Upload successful, profile verified, payment confirmed
- **Warning** (#F5A623): Pro badge, hiring badge, boosted shots indicator
- **Error** (#E04F5F): Failed upload, validation errors, account suspension notices

## Typography
- **Display Font**: DM Sans — loaded from Google Fonts
- **Body Font**: DM Sans — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

DM Sans is used at weights 400, 500, and 700 throughout the interface. It has a geometric, friendly quality with subtly rounded terminals that complement the playful pink brand energy. Shot titles and headings use 700 weight with -0.01em letter-spacing for a confident, clean presentation. Designer names use 500 weight at 14px. Body text and descriptions use 400 weight at 14px with 1.5 line height. Navigation labels use 500 weight at 14px. The "Hire Me" and "Pro" badges use 700 weight at 11px uppercase with 0.04em letter-spacing. The type scale: 11px (badges/labels), 13px (meta/small text), 14px (body/descriptions), 16px (card titles), 20px (section headings), 24px (page titles), 32px (profile names), 48px (hero headlines).

## Elevation
The design uses a hover-reveal shadow pattern. Shot cards at rest have no visible shadow or border — they are borderless images in a masonry grid. On hover, cards lift with 0 2px 12px rgba(0, 0, 0, 0.08) shadow and reveal an overlay with designer info and action buttons. Profile cards use 0 1px 4px rgba(0, 0, 0, 0.04) as a subtle resting shadow. Modals use 0 16px 48px rgba(0, 0, 0, 0.16) with a rgba(0, 0, 0, 0.6) backdrop. Dropdowns use 0 4px 16px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04). The philosophy is gallery-minimal — let the design work speak, and only reveal UI chrome on interaction.

## Components
- **Buttons**: Primary uses #EA4C89 background with #FFFFFF text, 8px radius, 14px 20px padding, 500 weight, 40px height. Secondary uses #0D0C22 background with #FFFFFF text. Outline variant uses #FFFFFF background, 1px solid #E7E7E9 border, #0D0C22 text. The like button is a heart icon that fills #EA4C89 on click with a bounce animation. "Get in touch" uses the primary pink. Icon-only buttons are 40x40px circles.
- **Cards**: Shot cards are the core element — pure image with 8px radius, overflow hidden. Standard aspect ratio is 4:3 (800x600 or 400x300). Hover reveals a dark gradient overlay (bottom-up) showing shot title, designer name + avatar, and like/save icons in white. Below the card: designer avatar (24px circle) + name + like count. No border or shadow at rest.
- **Inputs**: #F3F3F4 background, no visible border, 8px radius, 12px 16px padding, 14px font. Focus state applies 2px solid #EA4C89 outline. Search inputs have a magnifying glass icon left-aligned. Textarea for shot descriptions uses #FFFFFF background with 1px solid #E7E7E9 border. Labels use 500 weight at 14px above inputs.
- **Chips**: Tag chips use #F3F3F4 background, #0D0C22 text, 8px radius, 8px 16px padding, 13px font, 500 weight. Hover brightens to #EAEAEC. Filter chips (Popular, New, Following) use the same base style with active state: #0D0C22 background, #FFFFFF text. "Pro" badge uses #F5A623 background with #FFFFFF text, small pill shape. "Hiring" badge uses #2ECC71 with white text.
- **Lists**: Designer lists use 64px rows with avatar (48px circle), name (500 weight), tagline, location, and follow button aligned right. Shot lists in search results switch to a compact grid of thumbnails. Notification lists show activity (liked, commented, followed) with 56px rows, action icon, actor info, and timestamp.
- **Checkboxes**: 20x20px, #FFFFFF background, 2px solid #E7E7E9 border, 4px radius. Checked state fills #EA4C89 with white checkmark. Used in upload settings, notification preferences, and collection management. Toggle switches use 40x24px, #E7E7E9 track off, #EA4C89 track on.
- **Tooltips**: #0D0C22 background, #FFFFFF text, 8px radius, 8px 12px padding, 13px font. Rounded with no arrow — a soft floating pill. Used for action icon labels (like, save, share) and truncated text. 150ms hover delay.
- **Navigation**: Top nav is #FFFFFF background, 68px height, with logo left, category links center (Shots, Designers, Teams, Community, Jobs), and user actions right (search icon, upload button, avatar). Active category uses 700 weight with a 2px bottom border in #0D0C22. Mobile nav collapses to a hamburger menu. No sidebar — all navigation is horizontal.
- **Search**: Top-right search icon expands into a full-width overlay search bar. #FFFFFF background, 12px radius, 56px height, centered on page with #F3F3F4 backdrop overlay. Typeahead shows shots (with thumbnails), designers (with avatars), and tags. Filter dropdowns for color, timeframe, and shot type appear below the search input.

## Spacing
- Base unit: 4px
- Scale: 4px, 8px, 12px, 16px, 24px, 32px, 40px, 48px, 64px, 80px
- Component padding: Buttons 14px 20px, cards 0px (image-flush), tag chips 8px 16px, inputs 12px 16px
- Section spacing: 24px between grid rows, 48px between page sections, 64px hero section padding
- Container max width: 1400px for shot grids, 680px for article/about content, 1200px for designer lists
- Card grid gap: 24px horizontal and vertical in the shot masonry grid

## Border Radius
- 4px: Checkboxes, small badges, code blocks
- 8px: Shot cards, buttons, inputs, tag chips, dropdowns, modals, tooltips
- 12px: Profile header cards, collection covers, search overlay
- 16px: Large promotional banners, onboarding cards
- 9999px: Avatar images, "Pro" and "Hiring" badges, like count pills, notification dots

## Do's and Don'ts
- Do use #EA4C89 pink as the signature accent for likes, CTAs, and brand moments — it defines the platform identity
- Do maintain the 4:3 aspect ratio for shot thumbnails — consistency in the grid is crucial for the gallery feel
- Do use the hover-reveal pattern on shot cards — hiding UI until interaction keeps the focus on the visual work
- Do keep backgrounds white — the design work provides all the color the page needs
- Do use generous spacing (24px+) between grid items — shots need breathing room to be appreciated
- Don't use borders on shot cards at rest — they should feel like photographs floating on a gallery wall
- Don't apply the pink color to body text or large background areas — it's an accent, not a fill
- Don't use heavy type weights for body text — 400 weight keeps descriptions subordinate to the visual work
- Don't compress the grid gap below 16px — crowded shots diminish each other's impact
