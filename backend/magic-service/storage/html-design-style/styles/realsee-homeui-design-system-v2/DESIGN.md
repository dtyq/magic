---
name: HomeUI Design System
version: 1.0.0
source: realsee.ai
updated: 2026-05-22
format: DESIGN.md
---

# HomeUI Design System

This file describes the visual system extracted from the current React/Vite project. It is intended for AI coding agents and designmd.ai style workflows. Use it as the single source of truth when adding, editing, or regenerating UI for this project.

## Visual Theme

HomeUI uses a polished B2B landing and product-presentation style: bright white documentation sections, dark immersive product sections, blue brand accents, rounded cards, soft glass borders, and large editorial typography.

The interface should feel clean, technical, premium, and structured. Favor spacious layouts, clear hierarchy, precise spacing, and restrained use of gradients. The design language comes from a Pixso-exported "建站设计规范" page and includes application banners, sections, cards, tabs, tags, forms, collapses, quantity steppers, carousel indicators, and arrow buttons.

## Design Principles

- Use white or near-white backgrounds for documentation, settings, and design-system pages.
- Use near-black backgrounds for immersive product, hero, media, and feature showcase areas.
- Use blue only as the primary action and emphasis color.
- Keep cards compact and structured. Avoid stacking cards inside larger decorative cards.
- Use subtle opacity layers, 1px borders, and soft blue glow only for interactive or elevated dark surfaces.
- Keep text capitalization consistent with source strings. The current CSS often uses `text-transform: capitalize` for body labels.
- Prefer explicit responsive typography over fluid viewport-scaled type.

## Color Palette

### Brand

| Token | Value | Usage |
| --- | --- | --- |
| `brand.primary` | `#3F75FF` | Primary CTA, active states, brand emphasis |
| `brand.primary-strong` | `#3366FF` | Glow centers, button gradients, strong accents |
| `brand.primary-10` | `rgba(63, 117, 255, 0.10)` | Pale blue backgrounds and selected states |
| `brand.primary-soft` | `#ECF2FF` | Light brand panels and subtle fills |
| `brand.info-glow` | `rgba(87, 174, 255, 0.10)` | Dark card glow and layered elevation |

### Neutral Light

| Token | Value | Usage |
| --- | --- | --- |
| `surface.white` | `#FFFFFF` | Main light sections and card surfaces |
| `surface.page` | `#F9FAFB` | Page background and soft bands |
| `surface.grey` | `#F7F8FA` | Background color shown in the source design guide |
| `border.light` | `rgba(0, 0, 0, 0.10)` | Light-mode dividers and outlines |
| `border.light-strong` | `rgba(0, 0, 0, 0.30)` | Stronger logo/sample borders |

### Neutral Dark

| Token | Value | Usage |
| --- | --- | --- |
| `surface.dark` | `#06040D` | Primary dark section background |
| `surface.dark-deep` | `#05050A` | Deep product panels |
| `surface.dark-blue` | `#050A20` | Blue-black product surface |
| `surface.dark-panel` | `#0E111B` | Dark panels and nested feature areas |
| `surface.dark-card` | `rgba(78, 78, 78, 0.10)` | Dark translucent card background |
| `border.dark` | `rgba(255, 255, 255, 0.10)` | Dark card border |
| `border.dark-strong` | `rgba(255, 255, 255, 0.20)` | Buttons and stronger dark separators |

### Text

| Token | Value | Usage |
| --- | --- | --- |
| `text.primary` | `#1A1A1A` | Light-mode headings and body text |
| `text.primary-80` | `rgba(26, 26, 26, 0.80)` | Secondary light-mode text |
| `text.primary-60` | `rgba(0, 0, 0, 0.60)` | Muted light-mode copy |
| `text.black` | `#000000` | High emphasis text and icons |
| `text.dark-muted` | `#454748` | Muted dark icon strokes |
| `text.white` | `#FFFFFF` | Dark-mode headings and labels |
| `text.white-90` | `rgba(255, 255, 255, 0.90)` | Dark-mode button text |
| `text.white-80` | `rgba(255, 255, 255, 0.80)` | Dark-mode supporting text |
| `text.white-60` | `rgba(255, 255, 255, 0.60)` | Captions and metadata on dark backgrounds |

### Status And Accent

| Token | Value | Usage |
| --- | --- | --- |
| `accent.coral` | `#FF775C` | Promotional badges and highlights |
| `accent.red` | `#F40005` | Error or urgent states |
| `accent.blue-dark` | `#26408C` | Product illustration support color |

## Typography

### Font Families

| Token | CSS family | Weight | Usage |
| --- | --- | --- | --- |
| `font.heading` | `Roboto-SemiBold` | 600 | Main UI headings and section titles |
| `font.body` | `Roboto-Regular` | 400 | Body text, labels, descriptions |
| `font.body-medium` | `Roboto-Medium` | 500 | Medium-emphasis labels |
| `font.brand` | `OPPO Sans 4.0-Regular` | 400 | Large design-guide title and brand/date display |
| `font.alt` | `Montserrat-Regular` | 400 | Rare alternate use only |

If implementing new code, use standard numeric font weights even when the exported CSS says `SemiBold` or `Regular`.

### Heading Scale

| Token | Desktop | Laptop | Tablet | Mobile | Weight | Line height | Letter spacing |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| `heading.h0` | 80px | 80px | 64px | 48px | 600 | auto or 120% for hero | -0.01em for large brand title |
| `heading.h1` | 60px | 60px | 48px | 40px | 600 | auto | 0 |
| `heading.h2` | 48px | 44px | 40px | 32px | 600 | auto | 0 |
| `heading.h3` | 36px | 36px | 32px | 24px | 600 | 140% when in content | 0 |
| `heading.h4` | 32px | 32px | 26px | 22px | 600 | 140% when in content | 0 |
| `heading.h5` | 24px | 24px | 20px | 18px | 600 | 140% | 0 |
| `heading.h6` | 20px | 20px | 16px | 16px | 600 | 140% | 0 |

### Text Scale

| Token | Desktop | Laptop | Tablet | Mobile | Weight | Line height | Letter spacing |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| `text.large` | 18px | 18px | 18px | 16px | 400 | 140% | 0 |
| `text.large-semibold` | 18px | 18px | 18px | 16px | 600 | 140% | 0 |
| `text.base` | 16px | 16px | 16px | 14px | 400 | 140% to 160% | 0 to 0.01em |
| `text.base-semibold` | 16px | 16px | 16px | 14px | 600 | 140% | 0 |
| `text.small` | 14px | 14px | 14px | 12px | 400 | 150% | 0 |
| `text.small-semibold` | 14px | 14px | 14px | 12px | 600 | 150% | 0 |
| `text.xsmall` | 12px | 12px | 12px | 12px | 400 | 150% | 0 |
| `text.xsmall-semibold` | 12px | 12px | 12px | 12px | 600 | 150% | 0 |

## Spacing

Use a spacing scale that matches the most common exported values.

| Token | Value | Usage |
| --- | ---: | --- |
| `space.1` | 4px | Icon gaps, tiny controls |
| `space.2` | 8px | Compact gaps, small chips |
| `space.3` | 10px | Button icon gap, common control gap |
| `space.4` | 12px | Form rows, card subcontent |
| `space.5` | 16px | Default content padding and row gap |
| `space.6` | 20px | Medium panel padding |
| `space.7` | 24px | Default card padding and section gap |
| `space.8` | 28px | Testimonial/card padding |
| `space.9` | 32px | Large panel padding and section group gap |
| `space.10` | 40px | Large vertical rhythm |
| `space.11` | 48px | Hero and top-level page padding |
| `space.12` | 64px | Desktop page side padding |
| `space.13` | 80px | Major section vertical padding |

Default section padding is `80px 64px`. On narrower layouts use `80px 48px`, then `64px 24px`, then `48px 20px`.

## Radius

| Token | Value | Usage |
| --- | ---: | --- |
| `radius.xs` | 4px | Tiny fields and table cells |
| `radius.sm` | 6px | Small controls |
| `radius.md` | 8px | Media blocks and compact cards |
| `radius.lg` | 12px | Section samples and grouped panels |
| `radius.xl` | 16px | Default cards and elevated containers |
| `radius.2xl` | 24px | Large feature panels |
| `radius.pill` | 100px | Buttons, tabs, tags, badges |
| `radius.circle` | 999px | Avatars and circular buttons |

## Borders And Elevation

- Use `1px solid rgba(0,0,0,0.10)` on light surfaces.
- Use `1px solid rgba(255,255,255,0.10)` on dark cards.
- Buttons on dark backgrounds can use `rgba(255,255,255,0.20)` borders.
- Elevated dark cards use a translucent fill plus layered blue glows:
  - `rgba(87,174,255,0.10)` blur about `26px`
  - `rgba(87,174,255,0.05)` blur about `35px`
  - `rgba(87,174,255,0.01)` blur about `42px`
- Avoid heavy drop shadows on light surfaces. Use border, spacing, and background contrast first.

## Layout

### Page Structure

- Root app fills the viewport: `body`, `#root` use `100vw` and `100vh`.
- Main design-guide canvas is scrollable and full width.
- Sections are stacked vertically with full-width bands.
- Typical light section: white background, `80px 64px` padding, `32px` group gap.
- Hero/design intro section: near-white background `#F9FAFB`, large vertical rhythm, brand/date row at top.
- Dark product sections: near-black background, white text, blue accents, cards with glass borders.

### Grid And Composition

- Use flex and grid layouts with clear rows.
- Keep content widths stable. Cards should not stretch unpredictably.
- Use `gap: 24px` for card grids and feature rows.
- Use `gap: 32px` for section groups.
- Use `gap: 10px` for buttons and inline icon/text controls.
- Use image/media areas with fixed aspect or explicit height so layout does not jump.

## Components

### Button

Primary shape is a pill.

| Variant | Size | Style |
| --- | --- | --- |
| `button.dark-outline` | 160px x 48px | Transparent fill, `1px` white 20% border, white 90% text |
| `button.dark-primary` | 160px x 48px | Pill with subtle white gradient plus blue radial glow |
| `button.compact` | 110px x 36px | `12px 20px` padding, pill radius, white 90% text |

Button rules:

- Use `padding: 12px 24px` for standard buttons.
- Use `gap: 10px` between label and icon.
- Use `radius.pill`.
- Use `text.small-semibold` or `text.base-semibold`.
- Primary buttons on dark surfaces should feel luminous but not saturated. Combine a subtle white gradient with blue radial glow.

### Card

Default dark testimonial/card style:

- Width around `400px` when used in horizontal layouts.
- Padding `26px 28px`.
- Gap `28px`.
- Radius `16px`.
- Background `rgba(78,78,78,0.10)`.
- Border `1px solid rgba(255,255,255,0.10)`.
- Body text `16px`, `Roboto-Regular`, `160%`, white.
- Avatar `54px`, circular.

Feature/product cards:

- Use `24px` or `32px` padding.
- Use `16px` radius.
- Use dark gradient backgrounds for immersive areas.
- Include media surfaces with `8px` radius.
- Use subtle layered blue glow on hover or active variants.

### Badge And Tag

- Use pill radius.
- Use compact padding such as `4px 12px`, `8px 16px`, or `12px 20px`.
- Use small or xsmall semibold text.
- Primary badge background may use `rgba(63,117,255,0.10)` or `rgba(214,234,255,0.10)`.
- Promotional badges may use coral `#FF775C`.

### Tabs

- Use pill-style segmented controls.
- Active tab uses brand blue or blue-tinted translucent background.
- Inactive tab uses transparent fill with subtle border.
- Keep tab label text at `14px` or `16px`, semibold.

### Form

- Inputs should use light backgrounds on light sections and translucent dark surfaces on dark sections.
- Radius should be `8px` or `12px`.
- Use `16px` base text for input values and `14px` labels.
- Use `1px` borders, not heavy shadows.
- Error states should use red `#F40005` sparingly.

### Collapse

- Use a full-width row.
- Row padding should be `20px 0` or `24px 20px`.
- Use `1px` dividers.
- Label text should be `16px` or `18px` semibold.
- Arrow icon should rotate for expanded state.

### Quantity Stepper

- Use a compact horizontal control.
- Use pill or `8px` radius.
- Use `32px` to `40px` control height.
- Use icon-only minus and plus buttons.
- Keep numeric value centered with semibold body text.

### Carousel Indicator

- Use small dots or pills.
- Active indicator uses brand blue or white.
- Inactive indicator uses low opacity white or black depending on section background.
- Keep spacing at `8px` to `10px`.

### Arrow Button

- Circular or pill control.
- Typical icon button size: `40px`.
- Dark overlay style uses `rgba(0,0,0,0.40)` with white icon.
- Use for carousel and media navigation.

## Imagery

- Product or application screenshots should be real bitmap assets from `src/assets/images`.
- Use `background-size: cover` for media thumbnails.
- Use `background-size: 100% 100%` only for exported vector/symbol assets that need exact sizing.
- Prefer centered backgrounds.
- Keep media blocks with `8px` radius inside cards.

## Responsive Behavior

- Desktop target is spacious with `64px` side padding and large headings.
- Laptop keeps most desktop heading sizes except `h2` at `44px`.
- Tablet reduces major headings and section gutters.
- Mobile reduces headings to the mobile scale and stacks multi-column layouts.
- Do not use viewport-width font scaling. Use named breakpoints and explicit token changes.
- Maintain touch targets at least `40px` high for interactive controls.

### Responsive Layout Widths

Use the following breakpoint and container rules when building new pages or refactoring exported sections. Page margin is measured as a percentage of the current viewport width unless a fixed value is specified.

| Device | Screen width | Page margin | Content width |
| --- | --- | --- | --- |
| Desktop XL | `> 1920px` | `8%` each side | Max content width `1800px` |
| Desktop L | `1600px - 1920px` | `7%` each side | Responsive layout |
| Desktop M | `1440px - 1600px` | `7%` each side | Max content width `1366px` |
| Laptop | `1150px - 1440px` | `5%` each side | Max content width `1200px` |
| Tablet | `700px - 1150px` | `5%` each side | Responsive layout |
| Mobile | `< 700px` | Fixed `20px` each side | Responsive layout |

Container implementation guidance:

- Use a centered content wrapper for each full-width section.
- For `> 1920px`, compute side gutters as `8vw`, but clamp content to `1800px`.
- For `1440px - 1600px`, compute side gutters as `7vw`, but clamp content to `1366px`.
- For `1150px - 1440px`, compute side gutters as `5vw`, but clamp content to `1200px`.
- For responsive-layout rows, allow the content wrapper to fill the remaining width after margins.
- For mobile below `700px`, use fixed `20px` side padding instead of percentage gutters.
- Keep full-bleed background bands spanning `100%` width; apply these width rules only to inner content.

Suggested CSS pattern:

```css
.section-inner {
  width: min(100% - 14vw, 1366px);
  margin-inline: auto;
}

@media (min-width: 1921px) {
  .section-inner {
    width: min(100% - 16vw, 1800px);
  }
}

@media (min-width: 1600px) and (max-width: 1920px) {
  .section-inner {
    width: calc(100% - 14vw);
  }
}

@media (min-width: 1150px) and (max-width: 1439px) {
  .section-inner {
    width: min(100% - 10vw, 1200px);
  }
}

@media (min-width: 700px) and (max-width: 1149px) {
  .section-inner {
    width: calc(100% - 10vw);
  }
}

@media (max-width: 699px) {
  .section-inner {
    width: calc(100% - 48px);
  }
}
```

## Implementation Notes For Agents

- Read this file before generating UI.
- Prefer existing CSS variables and classes when editing the current Pixso export.
- When building new components, translate this design system into clean component CSS rather than reusing Pixso-generated numeric class names.
- Preserve `Roboto` as the default UI family.
- Use `font-weight: 600` for semibold and `font-weight: 400` for regular.
- Normalize noisy exported values: `139.9999976158142%` should become `140%`; `160.0000023841858%` should become `160%`.
- Normalize repeated radius values: `16px 16px 16px 16px` should become `16px`.
- Keep the page visually close to the current service at `http://localhost:5173/`.

## Do

- Use `#3F75FF` as the main brand action color.
- Use `#F9FAFB` and `#F7F8FA` for soft light backgrounds.
- Use `#06040D` or `#05050A` for immersive dark sections.
- Use `16px` radius for cards.
- Use `100px` radius for buttons, tabs, tags, and badges.
- Use `24px` as the default card padding.
- Use `80px 64px` for desktop section padding.
- Use subtle translucent borders and fills.

## Don't

- Do not introduce a new dominant brand color.
- Do not replace the blue accent system with purple gradients.
- Do not use heavy shadows on light sections.
- Do not create oversized marketing cards inside other cards.
- Do not use negative letter spacing on small text unless matching existing mobile text.
- Do not make typography fluid with viewport units.
- Do not use raw Pixso numeric class names for new hand-written components.

## Source Files

This design system was extracted from:

- `src/assets/styles/common.css`
- `src/assets/styles/variables.css`
- `src/assets/styles/global.css`
- `src/assets/styles/font.css`
- `src/index.css`
- `src/styles/Frame124599314.css`
- `src/styles/Button.css`
- `src/styles/Card.css`
- Component CSS files in `src/styles`
