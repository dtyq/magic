# Serif Journal

## Overview
Serif Journal is an editorial design system inspired by the internet's premier long-form reading platform. It reveres the written word above all else — serif typography dominates, color is used with extreme restraint, and every design decision optimizes for immersive, distraction-free reading. The aesthetic channels a literary magazine: elegant, opinionated, and confidently minimal. Content is not decorated; it is presented with the respect it deserves.

## Colors
- **Primary** (#1A8917): Follow buttons, clap interactions, highlight accents, writer CTAs — Medium Green
- **Primary Hover** (#156D12): Hovered follow buttons and interactive green elements
- **Secondary** (#FFC017): Membership badge, premium content indicator, star ratings — Gold
- **Neutral** (#757575): Meta information, read time, date published, secondary actions
- **Background** (#FFFFFF): Page background, the clean white reading canvas
- **Surface** (#F2F2F2): Code blocks, blockquote backgrounds, tag chips, footer area
- **Text Primary** (#242424): Article body text, headings, bylines — a warm near-black
- **Text Secondary** (#757575): Publication names, timestamps, read time, category labels
- **Border** (#E6E6E6): Subtle dividers between articles, section breaks, card outlines
- **Success** (#1A8917): Published confirmation, membership activated, follow successful
- **Warning** (#E6A817): Draft status, content warnings, age-restricted notices
- **Error** (#C94A4A): Unpublish confirmations, report actions, validation errors

## Typography
- **Display Font**: Playfair Display — loaded from Google Fonts
- **Body Font**: Source Serif 4 — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Playfair Display is used exclusively for article headlines and publication mastheads at weights 700 and 900. Headlines use 900 weight with -0.01em letter-spacing and 1.15 line height — the dramatic serifs command attention and signal editorial authority. Source Serif 4 handles all body text at 400 weight with 1.58 line height and 21px font size — this generous leading and optical sizing creates the signature reading comfort that keeps eyes on the page for 8+ minute articles. Subtitle text uses Source Serif 4 at 400 weight, 20px, in #757575. Navigation and UI chrome (buttons, tabs, metadata) use Source Serif 4 at 400 weight, 14px, to maintain serif consistency even outside articles. JetBrains Mono is used for code blocks at 16px with 1.5 line height on a #F2F2F2 background. The type scale: 14px (meta/navigation), 16px (code), 18px (subheadings), 21px (body), 24px (article subtitle), 32px (article title mobile), 48px (article title desktop).

## Elevation
Elevation is almost entirely absent. The design is intentionally flat — articles sit directly on the white background with no card treatment. The reading surface is a single continuous plane. The top navigation uses a subtle 1px bottom border (#E6E6E6) that only appears on scroll. Dialog modals (sign-in prompts, membership upsells) use 0 4px 24px rgba(0, 0, 0, 0.1) with a white (#FFFFFF) background. The membership upgrade banner uses a 1px top border with no shadow. The philosophy is that shadows distract from reading — if an element needs to separate from the background, a hair-thin border is sufficient.

## Components
- **Buttons**: Primary uses #1A8917 background with #FFFFFF text, 9999px radius (fully rounded), 12px 16px padding, 400 weight, 36px height. Follow button is the signature element — green pill with "Follow" text. Outline variant uses #FFFFFF background, 1px solid #242424 border, #242424 text, 9999px radius. "Get started" uses filled black (#242424) with white text. All buttons use Source Serif 4, not a sans-serif.
- **Cards**: Article cards in the feed are borderless — they consist of thumbnail (right-aligned, 112x112px on desktop), headline (Playfair Display 700, 20px), description excerpt (Source Serif 4 400, 16px, #757575, max 2 lines), and meta row (author avatar + name + publication + date + read time). Cards are separated by 1px #E6E6E6 bottom border with 32px vertical padding between them. No background, no shadow, no border radius.
- **Inputs**: #FFFFFF background, 1px solid #E6E6E6 border, 4px radius, 12px 16px padding, 16px font (Source Serif 4). Focus state applies 1px solid #242424 border. The write/compose area is a full-page contenteditable surface with no visible input chrome — just a blinking cursor on white space with placeholder text "Tell your story..."
- **Chips**: Tag chips use #F2F2F2 background, #242424 text, 9999px radius (pill), 8px 16px padding, 14px font, 400 weight. Topic recommendation chips in the sidebar use the same style. Selected/active topic uses #242424 background with #FFFFFF text. No colored variants — tags are monochromatic.
- **Lists**: The article feed is a vertical list with no grid option — every article card is full-width. Recommended lists show 1-4 articles stacked vertically with title-only display (no thumbnails) in sidebar modules. "Reading list" items show title, author, and a bookmark icon. List items separated by 1px #E6E6E6 border.
- **Checkboxes**: Minimal usage — primarily in settings. 18x18px, #FFFFFF background, 1.5px solid #757575 border, 2px radius. Checked state fills #242424 with white checkmark. The platform prefers toggle switches over checkboxes in most settings interfaces.
- **Tooltips**: Rarely used. When present: #242424 background, #FFFFFF text, 4px radius, 6px 12px padding, 14px font (Source Serif 4). Used for the clap count breakdown and share action descriptions. Appear below trigger element.
- **Navigation**: Top nav is minimal — #FFFFFF background, 65px height, 1px bottom border #E6E6E6 (appears on scroll). Logo wordmark left, write/publish button center-right, avatar and notification bell right. No dropdown mega-menus. Signed-out homepage replaces nav with a large hero banner (#FFC017 gold background). Tab navigation uses bottom underline indicator in #242424 (1px).
- **Search**: Accessible via icon in the top nav. Opens a full-width overlay search bar that pushes content down. #F2F2F2 background on the search container, #FFFFFF input, no border radius on the overlay (full-bleed). Results show as article cards with highlighted matching text. Search input uses Source Serif 4 at 20px for an editorial search feel.

## Spacing
- Base unit: 4px
- Scale: 4px, 8px, 16px, 24px, 32px, 48px, 64px, 96px
- Component padding: Buttons 12px 16px, article body paragraphs 0px (margin-based), tag chips 8px 16px
- Section spacing: 32px between article feed cards, 48px between sections on the homepage, 24px paragraph margin in articles
- Container max width: 680px for article body (the golden reading width), 1192px for the feed layout (with sidebar)
- Card grid gap: Not applicable — single-column feed with border separators

## Border Radius
- 0px: Article cards (no card treatment), navigation bar, search overlay, full-bleed images
- 2px: Checkboxes, code blocks, blockquote left-border accent
- 4px: Inputs, tooltips, modals, dropdown menus
- 8px: Membership promotion cards, onboarding dialogs
- 9999px: All buttons (signature pill shape), tag chips, avatar images, notification badges

## Do's and Don'ts
- Do use Playfair Display exclusively for headlines — its dramatic serifs are the visual signature
- Do set article body text at 21px with 1.58 line height — this ratio is sacred for long-form readability
- Do keep the color palette monochromatic — #242424, #757575, #E6E6E6, #FFFFFF are the workhorses
- Do limit article body width to 680px — wider text columns reduce reading comprehension
- Do use the green (#1A8917) only for follow buttons and clap interactions — never for decoration
- Don't use sans-serif fonts anywhere in the interface — even UI chrome uses Source Serif 4
- Don't add shadows or card treatments to article feed items — they should breathe on the white canvas
- Don't use color to convey information hierarchy — rely on font size, weight, and the serif/display distinction
- Don't place more than one CTA per article card — the headline itself is the primary click target
