---
version: alpha
name: Creative Agency
description: Bold, editorial, refined, intentional, and confident design system inspired by Pentagram, Collins, and Base Design.
colors:
  primary: "#0A0A0A"
  primary-inverse: "#F5F5F0"
  bg: "#F5F5F0"
  bg-dark: "#0A0A0A"
  surface: "#FFFFFF"
  border: "#D4D4CD"
  text-primary: "#0A0A0A"
  text-secondary: "#52524E"
  text-muted: "#8A8A85"
  text-on-dark: "#F5F5F0"
  accent: "#E63B2E"
  accent-hover: "#CC2E22"
  image-placeholder: "#E8E8E3"
typography:
  display:
    fontFamily: Playfair Display
    fontSize: 72px
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -2px
  h1:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.10
    letterSpacing: -1px
  h2:
    fontFamily: Satoshi
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.5px
  h3:
    fontFamily: Satoshi
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.30
    letterSpacing: 0px
  h4:
    fontFamily: Satoshi
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.40
    letterSpacing: 2px
  body:
    fontFamily: Satoshi
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.70
    letterSpacing: 0px
  body-lg:
    fontFamily: Satoshi
    fontSize: 21px
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: -0.2px
  small:
    fontFamily: Satoshi
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0px
  caption:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.40
    letterSpacing: 0.5px
rounded:
  none: 0px
  full: 9999px
spacing:
  max-content-width: 1440px
  max-text-width: 640px
  page-margin-desktop: 80px
  page-margin-tablet: 48px
  page-margin-mobile: 24px
  gutter: 32px
  section-gap-desktop: 120px
  space-1: 8px
  space-2: 16px
  space-3: 24px
  space-4: 32px
  space-6: 48px
  space-8: 64px
  space-10: 80px
  space-15: 120px
  space-20: 160px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-inverse}"
    typography: "{typography.h4}"
    rounded: "{rounded.none}"
    padding: 14px 32px
    minHeight: 48px
  button-primary-hover:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
  button-primary-active:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    borderColor: "{colors.primary}"
    rounded: "{rounded.none}"
    padding: 14px 32px
  button-secondary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-inverse}"
  text-link:
    textColor: "{colors.text-primary}"
    underlineOffset: 4px
  text-link-hover:
    textColor: "{colors.accent}"
  nav-bar:
    backgroundColor: transparent
    textColor: "{colors.text-primary}"
    height: 72px
  nav-overlay:
    backgroundColor: "{colors.bg-dark}"
    textColor: "{colors.text-on-dark}"
  case-study-card:
    textColor: "{colors.text-primary}"
    rounded: "{rounded.none}"
    titleTypography: "{typography.h2}"
    metaTypography: "{typography.caption}"
  footer:
    backgroundColor: "{colors.bg-dark}"
    textColor: "{colors.text-on-dark}"
---

## Brand & Style

Inspired by Pentagram, Collins, and Base Design. Typography leads every decision. The grid exists to be broken — intentionally. Generous whitespace signals confidence. Photography and work samples are treated as art, not content blocks.
Personality keywords: Bold, editorial, refined, intentional, confident.
The work speaks — the interface listens.

### Brand Voice in UI
- **Headlines:** Provocative or declarative. Short. "We make things people care about." Not "Welcome to our agency."
- **Body text:** Thoughtful, measured. Third person. No exclamation marks. Period.
- **Microcopy:** Minimal. Navigation labels are one word where possible.
- **Case studies:** The work is the hero. Surrounding text is supporting, never competing.

## Colors

The palette is intentionally limited. Black, off-white, and one red. That's the entire chromatic budget.

- **Primary (#0A0A0A):** Near-black is the brand color, used for backgrounds and text.
- **Primary Inverse (#F5F5F0):** Text on dark, cream-tinted white.
- **Background (#F5F5F0):** Page background — warm off-white, not sterile. Alternate with `--color-bg-dark` for section rhythm.
- **Accent (#E63B2E):** One accent — a confident red. Links, hover states, active indicators. Accent red is for interactive elements and editorial emphasis only — never backgrounds, never decorative.
- **Photography:** Photography and project imagery provide all the vibrancy the site needs. No gradients. No colored backgrounds.

## Typography

Typography leads every decision. Playfair Display is used for moments of impact only (hero, case study titles, pull quotes), while Satoshi is the workhorse for everything else.

- **Display:** "Playfair Display", Georgia, serif — for hero headlines and impact moments. Can break onto multiple lines with tight line-height to create density.
- **Body:** "Satoshi", "DM Sans", -apple-system, sans-serif — clean geometric sans for everything else. Body text at 17px is larger than standard SaaS, with generous line-height for editorial readability.
- **Monospace:** "JetBrains Mono", ui-monospace, monospace — captions, dates, technical details.
- **Uppercase:** Reserved for H4 overlines and navigation. Never for headings or body.
- **Emphasis:** No bold within body text. Use italic for emphasis, or restructure the sentence.

## Layout & Spacing

Whitespace is a design element, not wasted space. Sections breathe with 120px+ gaps.
The grid system is designed to be broken intentionally.

- **Grid System:** 12-column, but often used as 2, 3, or asymmetric splits. Max content width is 1440px, but text blocks never exceed 640px width.
- **Page margin:** Generous margins, 80px on desktop. Content feels curated, not crammed.
- **Images:** Images are never contained in rounded cards — they sit directly in the layout. One image per page can bleed to the edge.
- **Desktop Grid:** 2-column grid, asymmetric (60/40 or equal). Alternate between rows for visual rhythm.

## Elevation & Depth

Depth comes from content, contrast, and scale, not from shadows.

- **Shadows:** Almost nonexistent. Depth comes from dark/light section alternation and scale contrast.
- **Images:** Create depth through content — the photography provides all visual dimension.
- **Cards:** No cards with shadows. Cards are defined by their content grouping and spacing, not borders or shadows.
- **Overlay:** The only elevation that exists is the mobile navigation overlay (`0 16px 48px rgba(0,0,0,0.12)`).

## Shapes

The grid is sharp. This system uses sharp corners exclusively.

- **Buttons & Cards:** 0px border-radius (sharp corners — this is a design statement).
- **Exceptions:** Avatars (if team section exists) can use a full border-radius.

## Components

### Buttons
Buttons are uppercase with letter-spacing. This is an editorial design decision. Maximum 1 button per section. Let the work draw clicks, not the UI. On dark backgrounds, invert: white outline/fill, dark text. 

### Navigation
Minimal top bar, full-width, 72px height. Logo is left-aligned, wordmark only. Nav items right-aligned, uppercase. Active items have a 2px solid underline. Becomes sticky after scroll, adding a 1px bottom border.

### Project/Case Study Card
Structure is stacked, not side-by-side. Image is full-width, 16:10 aspect ratio, no border-radius. Hover scale (1.03) over 500ms. 

### Footer
Background is dark, text is light. Structure: large CTA headline, contact info in 3 columns, bottom copyright links.

## Do's and Don'ts

- Do let images breathe — generous spacing above and below.
- Do use typographic contrast (serif vs sans, large vs small) for hierarchy.
- Do alternate dark and light sections for pacing.
- Don't use border-radius on anything except avatars.
- Don't use shadows — depth comes from contrast and scale.
- Don't add decorative elements (lines, dots, abstract shapes) — let content be the decoration.
- Don't center-align body text. Left-aligned always.
- Don't crop project images into thumbnails — show them large.

## Animation & Motion

- **Hover:** 200ms ease-out for link color and button backgrounds.
- **Image hover:** 500ms ease-out thumbnail zoom is the signature interaction.
- **Scroll reveal:** 600ms cubic-bezier(0.16, 1, 0.3, 1), staggered when needed.
- **Page transitions:** Crossfade between pages, no slide.
- **Reduced motion:** Disable scroll reveals and image zoom when `prefers-reduced-motion` is enabled.
- **Loading:** No loading spinners. Content appears complete or not at all.

## Accessibility Standards

Compliance Level: WCAG 2.1 AA.
Tab order follows visual reading order. Focus-visible: 2px solid accent red, 2px offset.
Project images must have descriptive alt text.

## Edge Cases & Error Patterns

- **Empty States:** Not typically applicable — portfolio sites are curated, not user-generated.
- **404 page:** Full-screen, Display headline "Page not found." + "Back to work" link.
- **Loading States:** Image placeholders: solid #E8E8E3 blocks matching aspect ratio. Fade to image on load. No skeleton screens — the editorial aesthetic requires complete content or nothing. Page loads: entire page fades in once content is ready. No partial loading.
- **Overflow:** Headlines: allow wrapping, never truncate. Adjust font-size responsively. Project descriptions: 2-line clamp in grid view, full text in detail view.
