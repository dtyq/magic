# VoiceBox

Bold, opinionated, magazine-style.

## Overview

VoiceBox is a high-contrast editorial design system for opinion blogs and cultural commentary sites. It channels the energy of print magazines — massive headlines, stark black-and-white foundations, and a single aggressive red accent that punctuates like an exclamation mark. The density is intentionally mixed: bold, oversized headers create dramatic entries while compact body text maintains readability for long-form argument. Every element is flat and sharp, with borders doing all the structural work.

## Colors

### Brand Palette

| Token     | Hex       | Role                                         |
|-----------|-----------|-----------------------------------------------|
| Primary   | `#0A0A0A` | Black — headings, primary UI, dominant tone    |
| Secondary | `#EF4444` | Red — accent, emphasis, editorial highlights   |
| Tertiary  | `#FAFAFA` | White — backgrounds, inverse text              |

### Surface Palette

| Token          | Hex       | Role                                    |
|----------------|-----------|------------------------------------------|
| Background     | `#FAFAFA` | Pure white page background               |
| Surface        | `#F5F5F5` | Card backgrounds, aside blocks           |
| Surface Raised | `#E5E5E5` | Hover backgrounds, pull-quote blocks     |

### Content Palette

| Token          | Hex       | Role                                  |
|----------------|-----------|---------------------------------------|
| Text Primary   | `#0A0A0A` | Headlines, body copy                  |
| Text Secondary | `#525252` | Bylines, datelines, secondary prose   |
| Text Tertiary  | `#A3A3A3` | Placeholders, disabled text           |

### Border Palette

| Token         | Hex       |
|---------------|-----------|
| Border Subtle | `#E5E5E5` |
| Border Medium | `#D4D4D4` |
| Border Strong | `#0A0A0A` |

### Semantic Colors

| Token   | Hex       |
|---------|-----------|
| Success | `#16A34A` |
| Warning | `#CA8A04` |
| Error   | `#EF4444` |
| Info    | `#0A0A0A` |

## Typography

### Font Stack

| Role             | Font                                                        |
|------------------|-------------------------------------------------------------|
| Display/Headings | Archivo Black, Impact, 'Arial Black', sans-serif            |
| UI/Body          | Work Sans, -apple-system, 'Segoe UI', Helvetica, sans-serif |
| Mono/Code        | Space Mono, 'Courier New', Consolas, monospace              |

### Type Scale

| Level        | Font          | Size   | Weight | Line Height | Letter Spacing | Usage                         |
|--------------|---------------|--------|--------|-------------|----------------|-------------------------------|
| Display      | Archivo Black | 56px   | 400    | 1.05        | -0.03em        | Hero opinion headlines        |
| Headline     | Archivo Black | 38px   | 400    | 1.1         | -0.02em        | Article titles                |
| Subhead      | Archivo Black | 24px   | 400    | 1.2         | -0.01em        | Section breaks                |
| Body Large   | Work Sans     | 20px   | 400    | 1.65        | 0              | Lede paragraphs, pull quotes  |
| Body         | Work Sans     | 16px   | 400    | 1.7         | 0              | Default article text          |
| Body Small   | Work Sans     | 14px   | 400    | 1.6         | 0              | Sidebar, related links        |
| Caption      | Work Sans     | 12px   | 500    | 1.5         | 0.01em         | Photo credits, timestamps     |
| Overline     | Work Sans     | 11px   | 700    | 1.4         | 0.12em         | Section labels, rubrics       |
| Code         | Space Mono    | 14px   | 400    | 1.6         | 0              | Inline code, embeds           |

## Spacing

| Property                    | Value   |
|-----------------------------|---------|
| Base unit                   | 8px     |
| Scale                       | 4, 8, 16, 24, 32, 48, 64, 96 |
| Component padding — small   | 8px     |
| Component padding — medium  | 16px    |
| Component padding — large   | 32px    |
| Section spacing — mobile    | 48px    |
| Section spacing — tablet    | 64px    |
| Section spacing — desktop   | 96px    |

## Border Radius

| Token  | Value | Usage                               |
|--------|-------|-------------------------------------|
| None   | 0px   | All elements — default              |
| Small  | 0px   | Not used                            |
| Medium | 0px   | Not used                            |
| Large  | 0px   | Not used                            |
| XL     | 0px   | Not used                            |
| Full   | 9999px| Author avatar thumbnails only       |

Sharp, square edges are mandatory across every component. The magazine aesthetic demands geometric precision.

## Shadows

**Philosophy:** VoiceBox is completely flat with borders. Hierarchy comes from weight, scale, and black-white contrast — never from elevation.

| Level   | CSS Value | Usage                            |
|---------|-----------|----------------------------------|
| Subtle  | `none`    | —                                |
| Medium  | `none`    | —                                |
| Large   | `none`    | —                                |
| Overlay | `none`    | —                                |

**Special — Focus Ring:** `0 0 0 2px #FAFAFA, 0 0 0 4px #0A0A0A` — stark black focus indicator.

**Special — Red Underline:** A 3px bottom border in `#EF4444` used as a highlight accent on featured articles and active nav items.

## Components

### Buttons

**Primary**
- Background: `#0A0A0A`
- Text: `#FAFAFA`
- Border: `2px solid #0A0A0A`
- Padding: 10px 24px
- Font: Work Sans, 14px, weight 700, uppercase
- Letter spacing: 0.06em
- Radius: 0px
- Hover: Background `#EF4444`, border `#EF4444`
- Active: Background `#DC2626`, border `#DC2626`

**Secondary**
- Background: transparent
- Text: `#0A0A0A`
- Border: `2px solid #0A0A0A`
- Padding: 10px 24px
- Font: Work Sans, 14px, weight 700, uppercase
- Letter spacing: 0.06em
- Radius: 0px
- Hover: Background `#0A0A0A`, text `#FAFAFA`
- Active: Background `#262626`

**Ghost**
- Background: transparent
- Text: `#0A0A0A`
- Border: none
- Padding: 10px 24px
- Font: Work Sans, 14px, weight 700, uppercase
- Letter spacing: 0.06em
- Radius: 0px
- Hover: text `#EF4444`
- Active: text `#DC2626`

**Destructive**
- Background: `#EF4444`
- Text: `#FAFAFA`
- Border: `2px solid #EF4444`
- Padding: 10px 24px
- Font: Work Sans, 14px, weight 700, uppercase
- Letter spacing: 0.06em
- Radius: 0px
- Hover: Background `#DC2626`, border `#DC2626`
- Active: Background `#B91C1C`, border `#B91C1C`

**Sizes:** Small 6px 16px / 12px, Medium 10px 24px / 14px, Large 14px 32px / 16px

**Disabled:** Opacity 0.35, cursor not-allowed, no hover transition.

### Cards

**Default**
- Background: `#FAFAFA`
- Border: `2px solid #E5E5E5`
- Radius: 0px
- Padding: 24px
- Shadow: none
- Hover: Border `#0A0A0A`

**Elevated**
- Background: `#FAFAFA`
- Border-top: `4px solid #EF4444`
- Border-left/right/bottom: `2px solid #E5E5E5`
- Radius: 0px
- Padding: 24px
- Shadow: none

### Inputs

**Text Input**
- Height: 44px
- Background: `#FAFAFA`
- Border: `2px solid #D4D4D4`
- Radius: 0px
- Padding: 8px 14px
- Font: Work Sans, 14px, weight 400
- Text color: `#0A0A0A`
- Placeholder color: `#A3A3A3`
- Focus: Border `#0A0A0A`, ring `0 0 0 2px #FAFAFA, 0 0 0 4px #0A0A0A`
- Error: Border `#EF4444`
- Disabled: Background `#F5F5F5`, opacity 0.5

**Label:** Work Sans, 12px, weight 700, color `#0A0A0A`, uppercase, letter-spacing 0.06em, margin-bottom 6px.

**Helper Text:** Work Sans, 12px, weight 400, color `#525252`, margin-top 4px. Error helper color `#EF4444`.

### Chips

**Filter Chip**
- Background: transparent
- Border: `2px solid #D4D4D4`
- Radius: 0px
- Padding: 4px 14px
- Font: Work Sans, 12px, weight 700, uppercase
- Letter spacing: 0.04em
- Text: `#525252`
- Selected: Background `#0A0A0A`, text `#FAFAFA`, border `#0A0A0A`

**Status Chip**
- Padding: 4px 12px
- Font: Work Sans, 11px, weight 700, uppercase
- Letter spacing: 0.06em
- Radius: 0px
- Success: Background `#F0FDF4`, text `#16A34A`, border `2px solid #16A34A`
- Warning: Background `#FEFCE8`, text `#CA8A04`, border `2px solid #CA8A04`
- Error: Background `#FEF2F2`, text `#EF4444`, border `2px solid #EF4444`

### Lists

**Default List Item**
- Padding: 14px 0
- Border bottom: `1px solid #E5E5E5`
- Font: Work Sans, 16px, weight 400
- Text: `#0A0A0A`
- Secondary text: `#A3A3A3`, 12px
- Hover: Background `#F5F5F5`
- Active: Background `#E5E5E5`
- Leading element: 20px icon, color `#0A0A0A`

### Checkboxes

- Size: 18px
- Border: `2px solid #0A0A0A`
- Radius: 0px
- Background: `#FAFAFA`
- Checked: Background `#0A0A0A`, border `#0A0A0A`, checkmark `#FAFAFA`
- Indeterminate: Background `#0A0A0A`, dash `#FAFAFA`
- Hover: Background `#F5F5F5`
- Focus: Ring `0 0 0 2px #FAFAFA, 0 0 0 4px #0A0A0A`
- Disabled: Opacity 0.35
- Label: Work Sans, 14px, weight 400, margin-left 10px

### Radio Buttons

- Size: 18px
- Border: `2px solid #0A0A0A`
- Radius: 9999px
- Background: `#FAFAFA`
- Selected: Border `#0A0A0A`, inner dot `#0A0A0A` (8px)
- Hover: Background `#F5F5F5`
- Focus: Ring `0 0 0 2px #FAFAFA, 0 0 0 4px #0A0A0A`
- Disabled: Opacity 0.35
- Label: Work Sans, 14px, weight 400, margin-left 10px

### Tooltips

- Background: `#0A0A0A`
- Text: `#FAFAFA`
- Font: Work Sans, 12px, weight 600
- Padding: 8px 14px
- Radius: 0px
- Max width: 220px
- Arrow: 6px, same background
- Delay: 250ms enter, 0ms leave
- Shadow: none

## Do's and Don'ts

1. **Do** make headlines massive and unapologetic — Archivo Black at 38px+ demands attention.
2. **Don't** use red (`#EF4444`) for more than one element per viewport — it is a scalpel, not a paintbrush.
3. **Do** use thick 2px borders for interactive elements to maintain the editorial weight.
4. **Don't** introduce rounded corners or soft shadows — VoiceBox is angular and assertive.
5. **Do** use pull quotes styled with a left `4px solid #EF4444` border and Body Large italic.
6. **Don't** use more than three type sizes on a single page — headline, body, caption is the standard.
7. **Do** set overline category labels in uppercase Work Sans to establish section identity.
8. **Do** maintain stark black-on-white contrast — the palette is intentionally limited.
9. **Don't** add decorative imagery, gradients, or background textures that dilute the typographic focus.
10. **Do** use the red accent on hover states for primary buttons to create a visceral interaction cue.
