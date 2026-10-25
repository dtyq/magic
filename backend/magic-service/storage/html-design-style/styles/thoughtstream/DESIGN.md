# ThoughtStream

Minimal, zen, distraction-free.

## Overview

ThoughtStream is a contemplative design system built for minimalist personal blogs and newsletters. It embraces generous white space as a design element, letting words breathe and ideas settle. The warm, neutral palette recedes behind content, creating a reading experience that feels like a well-set page in a quiet room. Every decision prioritizes reading flow and typographic clarity over ornament.

## Colors

### Brand Palette

| Token     | Hex       | Role                                      |
|-----------|-----------|--------------------------------------------|
| Primary   | `#78716C` | Stone — anchors UI elements, links, icons  |
| Secondary | `#A8A29E` | Sage — supporting accents, dividers        |
| Tertiary  | `#1C1917` | Warm Black — emphasis, strong headings     |

### Surface Palette

| Token          | Hex       | Role                                   |
|----------------|-----------|----------------------------------------|
| Background     | `#FAFAF9` | Warm white page background             |
| Surface        | `#F5F5F4` | Card and section backgrounds           |
| Surface Raised | `#EFEDEB` | Hover states, subtle callout blocks    |

### Content Palette

| Token          | Hex       | Role                                  |
|----------------|-----------|---------------------------------------|
| Text Primary   | `#1C1917` | Body copy, headings                   |
| Text Secondary | `#57534E` | Bylines, metadata, captions           |
| Text Tertiary  | `#A8A29E` | Placeholders, disabled labels         |

### Border Palette

| Token         | Hex       |
|---------------|-----------|
| Border Subtle | `#E7E5E4` |
| Border Medium | `#D6D3D1` |
| Border Strong | `#A8A29E` |

### Semantic Colors

| Token   | Hex       |
|---------|-----------|
| Success | `#65A30D` |
| Warning | `#CA8A04` |
| Error   | `#DC2626` |
| Info    | `#78716C` |

## Typography

### Font Stack

| Role             | Font                                              |
|------------------|---------------------------------------------------|
| Display/Headings | Libre Baskerville, Georgia, 'Times New Roman', serif |
| UI/Body          | Inter, -apple-system, 'Segoe UI', Helvetica, sans-serif |
| Mono/Code        | Source Code Pro, 'Fira Code', Consolas, monospace |

### Type Scale

| Level        | Font              | Size   | Weight | Line Height | Letter Spacing | Usage                        |
|--------------|-------------------|--------|--------|-------------|----------------|------------------------------|
| Display      | Libre Baskerville | 40px   | 700    | 1.2         | -0.02em        | Hero article titles          |
| Headline     | Libre Baskerville | 30px   | 700    | 1.3         | -0.015em       | Post titles                  |
| Subhead      | Libre Baskerville | 22px   | 400    | 1.4         | -0.01em        | Section headings             |
| Body Large   | Inter             | 20px   | 400    | 1.75        | 0              | Featured paragraph, lede     |
| Body         | Inter             | 17px   | 400    | 1.8         | 0              | Default reading text         |
| Body Small   | Inter             | 15px   | 400    | 1.7         | 0              | Sidebar text, footnotes      |
| Caption      | Inter             | 13px   | 400    | 1.5         | 0.01em         | Image captions, dates        |
| Overline     | Inter             | 11px   | 600    | 1.4         | 0.08em         | Category labels              |
| Code         | Source Code Pro   | 15px   | 400    | 1.7         | 0              | Inline code, code blocks     |

## Spacing

| Property                    | Value   |
|-----------------------------|---------|
| Base unit                   | 12px    |
| Scale                       | 12, 24, 36, 48, 60, 72, 96, 120 |
| Component padding — small   | 12px    |
| Component padding — medium  | 24px    |
| Component padding — large   | 48px    |
| Section spacing — mobile    | 60px    |
| Section spacing — tablet    | 84px    |
| Section spacing — desktop   | 120px   |

## Border Radius

| Token  | Value  | Usage                            |
|--------|--------|----------------------------------|
| None   | 0px    | All elements — default           |
| Small  | 0px    | Not used                         |
| Medium | 0px    | Not used                         |
| Large  | 0px    | Not used                         |
| XL     | 0px    | Not used                         |
| Full   | 9999px | Avatars only                     |

All interactive and container elements use sharp, geometric edges (0px radius). Only avatars use full rounding.

## Shadows

**Philosophy:** ThoughtStream is completely flat. No shadows are used. Separation is achieved exclusively through borders and white space.

| Level   | CSS Value | Usage                           |
|---------|-----------|---------------------------------|
| Subtle  | `none`    | —                               |
| Medium  | `none`    | —                               |
| Large   | `none`    | —                               |
| Overlay | `none`    | —                               |

**Special — Focus Ring:** `0 0 0 2px #FAFAF9, 0 0 0 4px #78716C` — used for keyboard focus indicators.

## Components

### Buttons

**Primary**
- Background: `#78716C`
- Text: `#FAFAF9`
- Border: `1px solid #78716C`
- Padding: 12px 24px
- Font: Inter, 15px, weight 600
- Radius: 0px
- Hover: Background `#57534E`
- Active: Background `#44403C`

**Secondary**
- Background: transparent
- Text: `#78716C`
- Border: `1px solid #D6D3D1`
- Padding: 12px 24px
- Font: Inter, 15px, weight 600
- Radius: 0px
- Hover: Background `#F5F5F4`
- Active: Background `#E7E5E4`

**Ghost**
- Background: transparent
- Text: `#78716C`
- Border: none
- Padding: 12px 24px
- Font: Inter, 15px, weight 600
- Radius: 0px
- Hover: Background `#F5F5F4`
- Active: Background `#E7E5E4`

**Destructive**
- Background: `#DC2626`
- Text: `#FAFAF9`
- Border: `1px solid #DC2626`
- Padding: 12px 24px
- Font: Inter, 15px, weight 600
- Radius: 0px
- Hover: Background `#B91C1C`
- Active: Background `#991B1B`

**Sizes:** Small 8px 16px / 13px, Medium 12px 24px / 15px, Large 16px 36px / 17px

**Disabled:** Opacity 0.4, cursor not-allowed, no hover change.

### Cards

**Default**
- Background: `#FAFAF9`
- Border: `1px solid #E7E5E4`
- Radius: 0px
- Padding: 36px
- Shadow: none
- Hover: Border `#D6D3D1`

**Elevated**
- Background: `#F5F5F4`
- Border: `1px solid #D6D3D1`
- Radius: 0px
- Padding: 36px
- Shadow: none

### Inputs

**Text Input**
- Height: 48px
- Background: `#FAFAF9`
- Border: `1px solid #D6D3D1`
- Radius: 0px
- Padding: 12px 16px
- Font: Inter, 15px, weight 400
- Text color: `#1C1917`
- Placeholder color: `#A8A29E`
- Focus: Border `#78716C`, ring `0 0 0 2px #FAFAF9, 0 0 0 4px #78716C`
- Error: Border `#DC2626`
- Disabled: Background `#F5F5F4`, opacity 0.5

**Label:** Inter, 13px, weight 600, color `#57534E`, margin-bottom 8px.

**Helper Text:** Inter, 13px, weight 400, color `#A8A29E`, margin-top 6px. Error helper color `#DC2626`.

### Chips

**Filter Chip**
- Background: transparent
- Border: `1px solid #D6D3D1`
- Radius: 0px
- Padding: 6px 14px
- Font: Inter, 13px, weight 500
- Text: `#57534E`
- Selected: Background `#78716C`, text `#FAFAF9`, border `#78716C`

**Status Chip**
- Padding: 4px 12px
- Font: Inter, 11px, weight 600, uppercase
- Radius: 0px
- Success: Background `#F0FDF4`, text `#65A30D`, border `1px solid #BBF7D0`
- Warning: Background `#FEFCE8`, text `#CA8A04`, border `1px solid #FEF08A`
- Error: Background `#FEF2F2`, text `#DC2626`, border `1px solid #FECACA`

### Lists

**Default List Item**
- Padding: 16px 0
- Border bottom: `1px solid #E7E5E4`
- Font: Inter, 15px, weight 400
- Text: `#1C1917`
- Secondary text: `#A8A29E`, 13px
- Hover: Background `#F5F5F4`
- Active: Background `#EFEDEB`
- Leading element: 20px icon, color `#78716C`

### Checkboxes

- Size: 18px
- Border: `1.5px solid #D6D3D1`
- Radius: 0px
- Background: `#FAFAF9`
- Checked: Background `#78716C`, border `#78716C`, checkmark `#FAFAF9`
- Indeterminate: Background `#78716C`, dash `#FAFAF9`
- Hover: Border `#78716C`
- Focus: Ring `0 0 0 2px #FAFAF9, 0 0 0 4px #78716C`
- Disabled: Opacity 0.4
- Label: Inter, 15px, weight 400, margin-left 10px

### Radio Buttons

- Size: 18px
- Border: `1.5px solid #D6D3D1`
- Radius: 9999px
- Background: `#FAFAF9`
- Selected: Border `#78716C`, inner dot `#78716C` (8px)
- Hover: Border `#78716C`
- Focus: Ring `0 0 0 2px #FAFAF9, 0 0 0 4px #78716C`
- Disabled: Opacity 0.4
- Label: Inter, 15px, weight 400, margin-left 10px

### Tooltips

- Background: `#1C1917`
- Text: `#FAFAF9`
- Font: Inter, 13px, weight 500
- Padding: 8px 14px
- Radius: 0px
- Max width: 240px
- Arrow: 6px, same background
- Delay: 300ms enter, 0ms leave
- Shadow: none

## Do's and Don'ts

1. **Do** let white space dominate — margins and padding should feel generous and contemplative.
2. **Do** keep headlines in Libre Baskerville for literary warmth; never use it for UI labels.
3. **Do** use `#E7E5E4` hairline borders to separate sections instead of shadows or color blocks.
4. **Don't** add decorative elements, gradients, or illustrations that compete with the text.
5. **Don't** use more than two font weights on a single screen — restraint is the ethos.
6. **Do** set body text at 17px or above with 1.8 line height for comfortable long-form reading.
7. **Don't** use color to convey meaning alone — pair with text or icons for accessibility.
8. **Do** maintain a maximum content width of 680px for body text to preserve optimal reading measure.
9. **Don't** introduce rounded corners — sharp edges reinforce the clean geometric identity.
10. **Do** favor vertical rhythm aligned to the 12px base unit across all spacing decisions.
