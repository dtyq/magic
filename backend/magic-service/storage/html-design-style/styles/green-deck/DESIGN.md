# Green Deck

## Overview
A bold, dark-first design system built for immersive audio experiences. Green Deck uses a high-energy green accent against deep black and charcoal surfaces to create an atmosphere that feels like a late-night concert venue — electric, focused, and alive. The aesthetic is minimal yet punchy, designed to keep content front and center while the UI recedes into darkness.

## Colors
- **Primary** (#1DB954): Interactive highlights, play buttons, active states — Spotify Green
- **Primary Hover** (#1ED760): Hover state for green elements, slightly brighter
- **Secondary** (#535353): Secondary controls, inactive elements — Muted Gray
- **Neutral** (#B3B3B3): Body text, secondary labels on dark backgrounds
- **Background** (#121212): Primary app background, near-black — Void Black
- **Surface** (#181818): Card surfaces, sidebar, elevated containers
- **Text Primary** (#FFFFFF): Headlines, track titles, primary content — Pure White
- **Text Secondary** (#A7A7A7): Artist names, metadata, supporting text
- **Border** (#282828): Subtle dividers, card edges on dark surfaces
- **Success** (#1DB954): Reuses green — saved to library, successful actions
- **Warning** (#F59B23): Offline mode indicator, storage warnings
- **Error** (#E22134): Playback errors, account issues, failed downloads

## Typography
- **Display Font**: DM Sans — loaded from Google Fonts
- **Body Font**: DM Sans — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

DM Sans is used throughout as a geometric sans-serif that provides the clean, modern feel of a circular typeface. Headlines use weights 700 and 800 with tight tracking for bold, punchy statements. Body text uses weight 400 and 500 for comfortable reading on dark backgrounds. Slightly increased line-height (1.5x) improves legibility against dark surfaces. All text is pure white or light gray — no dark text colors exist in this system.

- **Hero**: DM Sans 64px/72px, weight 800, tracking -0.03em
- **Page Title**: DM Sans 32px/40px, weight 700, tracking -0.02em
- **Section Title**: DM Sans 24px/32px, weight 700, tracking -0.01em
- **Card Title**: DM Sans 16px/22px, weight 700
- **Body**: DM Sans 14px/22px, weight 400
- **Body Small**: DM Sans 12px/18px, weight 400
- **Label**: DM Sans 11px/16px, weight 700, tracking 0.1em, uppercase
- **Caption**: DM Sans 11px/16px, weight 400
- **Code**: JetBrains Mono 13px/20px, weight 400

## Elevation
On dark interfaces, traditional shadows are invisible. Elevation is instead communicated through surface brightness — darker surfaces (#121212) are lower, lighter surfaces (#181818, #282828) are higher. Level 0 uses #121212 (background). Level 1 uses #181818 (cards, sidebar). Level 2 uses #282828 (dropdown menus, context menus). Level 3 uses #333333 (modals, now-playing bar). Hover states lighten the surface by one level. The now-playing bar uses a subtle top border of 1px #282828 plus a gradient shadow: 0 -8px 24px rgba(0,0,0,0.5).

## Components
- **Buttons**: Primary is #1DB954 fill, white text (#FFFFFF), 32px height, 32px horizontal padding, 9999px border-radius (pill), DM Sans 14px weight 700, tracking 0.05em uppercase. Hover scales to 1.04 with #1ED760 fill. Secondary has 1px #727272 border, transparent fill, white text. Ghost button is text-only in #B3B3B3, hover turns white. Play button is circular, 48px, #1DB954, white triangle icon.
- **Cards**: #181818 background, 8px border-radius, no border. Artwork fills top with 8px top radius. Content area has 16px padding. Title in white 16px weight 700, subtitle in #A7A7A7 14px. Hover state lightens background to #282828 with 200ms ease. Play button appears on hover, absolute positioned over artwork bottom-right with Level 2 shadow.
- **Inputs**: 40px height, #282828 background, 4px border-radius, 12px horizontal padding, #B3B3B3 placeholder, white text. No visible border. Focused state adds 1px #FFFFFF border. Search input is 48px with magnifying glass icon in #B3B3B3.
- **Chips**: Pill-shaped (9999px radius), #282828 background, white text, DM Sans 14px weight 400, 4px/12px padding. Selected state: #FFFFFF background, #000000 text. Filter row scrolls horizontally.
- **Lists**: Track rows are 56px height with 16px padding. Artwork thumbnail 40px, 4px radius. Track number/title/artist in columns. Duration right-aligned in #A7A7A7. Hover shows #282828 background row. Active/playing track shows title in #1DB954. Explicit badge is #A7A7A7 9px uppercase label.
- **Checkboxes**: 16px square, 2px border-radius. Unchecked: 1px #727272 border. Checked: #1DB954 fill with white checkmark. Heart icon toggle uses outline for unsaved, filled #1DB954 for saved.
- **Tooltips**: #282828 background, white text, 4px border-radius, 8px/12px padding, DM Sans 12px. Subtle 0 4px 12px rgba(0,0,0,0.4) shadow.
- **Navigation**: Left sidebar 240px wide, #000000 background. Logo top, nav links in #B3B3B3 14px weight 700, active link in #FFFFFF. Playlist section scrollable below. Bottom now-playing bar 90px, #181818, full-width with track info left, controls center, volume right.
- **Search**: Top bar search, 48px height, #282828 background, 9999px border-radius, magnifying glass icon, DM Sans 14px placeholder in #A7A7A7. Results appear in dropdown overlay with #282828 background.

## Spacing
- Base unit: 8px
- Scale: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px
- Component padding: 16px standard, 24px for section headers
- Section spacing: 40px between major content sections, 16px between related groups
- Container max width: 1600px with 32px side margins, accounting for 240px sidebar
- Card grid gap: 24px (grid auto-fills with 180px min column width)

## Border Radius
- 2px: Track list items, small badges
- 4px: Inputs, artwork thumbnails, context menus
- 8px: Cards, modals, dropdown panels
- 12px: Large album art, playlist headers
- 9999px: Buttons, pills, chips, search bar, avatars, play button

## Do's and Don'ts
- Do design dark-first — light mode is secondary, never the default
- Do use pure white (#FFFFFF) for primary text on dark surfaces for maximum contrast
- Don't use the green for large surface fills — reserve it for interactive accents and the play button
- Do scale elements on hover (1.04x) for playful, responsive feedback
- Don't use borders to define containers — use surface color differences instead
- Do make the now-playing context persistent and always visible
- Don't use long text blocks — keep copy short, scannable, and label-like
- Do use uppercase tracking (0.1em) sparingly for section labels and overlines only
- Don't use light or white backgrounds anywhere in the primary interface
