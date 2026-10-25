---
name: designmd.ai Design System
colors:
  surface: '#0F2522'
  surface-dim: '#13140f'
  surface-bright: '#393a33'
  surface-container-lowest: '#0d0f0a'
  surface-container-low: '#1b1c17'
  surface-container: '#1f201b'
  surface-container-high: '#292a25'
  surface-container-highest: '#34352f'
  on-surface: '#e4e3da'
  on-surface-variant: '#c6c8b7'
  inverse-surface: '#e4e3da'
  inverse-on-surface: '#30312b'
  outline: '#909283'
  outline-variant: '#45483b'
  surface-tint: '#b9cf81'
  primary: '#c2d98a'
  on-primary: '#273500'
  primary-container: '#a7bd71'
  on-primary-container: '#3b4c0c'
  inverse-primary: '#526524'
  secondary: '#cccc5c'
  on-secondary: '#323200'
  secondary-container: '#717100'
  on-secondary-container: '#f7f681'
  tertiary: '#bcd5d4'
  on-tertiary: '#1e3434'
  tertiary-container: '#a1b9b8'
  on-tertiary-container: '#344a4a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d5ec9b'
  primary-fixed-dim: '#b9cf81'
  on-primary-fixed: '#151f00'
  on-primary-fixed-variant: '#3b4d0d'
  secondary-fixed: '#e9e875'
  secondary-fixed-dim: '#cccc5c'
  on-secondary-fixed: '#1d1d00'
  on-secondary-fixed-variant: '#494900'
  tertiary-fixed: '#cfe7e7'
  tertiary-fixed-dim: '#b3cbca'
  on-tertiary-fixed: '#081f1f'
  on-tertiary-fixed-variant: '#344b4a'
  background: '#13140f'
  on-background: '#e4e3da'
  surface-variant: '#34352f'
  bg: '#041B1B'
  border: '#3A453E'
  text-primary: '#fdE4C9'
  text-muted: '#9C9684'
  accent: '#A7BD71'
  accent-alt: '#FFFE88'
  code-bg: '#063430'
  danger: '#1C1616'
  status-draft-bg: '#2A2010'
  status-draft-text: '#E8A020'
  status-review-bg: '#10202A'
  status-review-text: '#20A0E8'
  status-final-bg: '#102010'
  status-final-text: '#20C020'
typography:
  display-hero:
    fontFamily: Playfair Display
    fontSize: 80px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-hero-mobile:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
  headline-section:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
  body-reading:
    fontFamily: Lora
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.7'
  body-reading-bold:
    fontFamily: Lora
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.7'
  ui-label:
    fontFamily: DM Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1'
    letterSpacing: 0.04em
  code-snippet:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.7'
  status-tag:
    fontFamily: DM Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: '1'
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  huge: 96px
  gutter: 24px
  max-width: 1200px
---

# designmd.ai — Design Document

---

## Concept & Vision

**designmd.ai** is a minimalist, developer-first platform for writing, sharing, and publishing design documents entirely in Markdown. Inspired by the philosophy of tools like Hermes Agent — open-source, persistent, autonomous — designmd.ai treats design documentation as living code: version-controlled, collaborative, and always evolving.

> *"The best design document is the one that actually gets written."*

---

## Brand Identity

### Name
**designmd.ai**

### Tagline
*Design docs that live where your code does.*

### Voice & Tone
- Direct and confident — no fluff
- Technical but human
- Slightly opinionated (like a good senior designer who has strong taste)
- Open-source ethos: transparent, community-driven, honest

### Personality Keywords
`minimal` · `precise` · `open` · `opinionated` · `fast` · `sharp`

---

## Visual Design

### Aesthetic Direction
**Refined Brutalism** — not harsh or ugly, but raw in the right places. Clean grid. Mono type for code blocks. Serif for long-form reading. Everything is intentional; nothing decorates unless it communicates.

Think: a well-maintained engineering wiki crossed with a high-end editorial magazine.

### Color Palette

| Role            | Token            | Value       | Usage                            |
|-----------------|------------------|-------------|----------------------------------|
| Background      | `--bg`           | `#041B1B`   | Full-page dark canvas            |
| Surface         | `--surface`      | `#0F2522`   | Cards, panels, inputs            |
| Border          | `--border`       | `#3A453E`   | Dividers, outlines               |
| Text Primary    | `--text-primary` | `#fdE4C9`   | Headings, body                   |
| Text Muted      | `--text-muted`   | `#9C9684`   | Captions, labels, metadata       |
| Accent          | `--accent`       | `#A7BD71`   | CTAs, highlights, active states  |
| Accent Alt      | `--accent-alt`   | `#FFFE88`   | Hover states, secondary emphasis |
| Code Surface    | `--code-bg`      | `#063430`   | Inline code, code blocks         |
| Danger          | `--danger`       | `#1C1616`   | Errors, destructive actions      |

> Dark-first. No light mode in v1. It signals seriousness.

### Typography

| Role         | Font                   | Weight   | Notes                                |
|--------------|------------------------|----------|--------------------------------------|
| Display      | `Playfair Display`     | 700      | Hero headlines, section titles       |
| Body         | `Lora`                 | 400/500  | Long-form reading, paragraphs        |
| Mono / Code  | `JetBrains Mono`       | 400      | Code blocks, CLI commands, snippets  |
| UI Labels    | `DM Mono`              | 400      | Buttons, nav, metadata tags          |

Import from Google Fonts:
```
Playfair+Display:wght@700
Lora:wght@400;500
JetBrains+Mono:wght@400
DM+Mono:wght@400
```

### Spacing Scale
Based on `8px` base unit:
`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128px`

### Border Radius
- Default: `4px` (sharp, intentional)
- Cards: `6px`
- Buttons: `3px`
- Pill tags: `100px`

---

## Layout

### Grid
- Max content width: `1200px`
- Column grid: 12-column, `24px` gutters
- Section padding: `96px` vertical on desktop, `48px` on mobile

### Page Sections (in order)

```
1. Nav
2. Hero
3. How It Works
4. Features
5. Example / Preview
6. Pricing
7. Footer
```

---

## Page Sections — Detail

### 1. Navigation

- Left: `designmd.ai` wordmark in `Playfair Display` italic
- Right: `Docs` · `GitHub` · `Sign In` · `[Get Started →]` (accent button)
- Sticky, glass blur on scroll: `backdrop-filter: blur(12px)`
- Border-bottom: `1px solid var(--border)` on scroll

---

### 2. Hero

**Layout:** Centered, full-viewport height. Large headline, subline, two CTAs, and a terminal-style code snippet below.

**Headline:**
```
Design docs that live
where your code does.
```
Font: `Playfair Display` 700, ~80px desktop / 48px mobile
Color: `var(--text-primary)`

**Subline:**
```
Write in Markdown. Publish anywhere.
Version-controlled design documentation for teams who ship.
```
Font: `Lora` 400, 18px, color `var(--text-muted)`

**CTAs:**
- Primary: `Start Writing →` — filled button, `var(--accent)` bg, dark text
- Secondary: `View on GitHub ↗` — ghost button, `var(--border)` outline

**Terminal Snippet (below CTAs):**
```bash
npx designmd init my-design-doc
```
Style: dark code surface, `JetBrains Mono`, with a blinking cursor animation.

**Background:**
- Subtle noise texture overlay at 3% opacity
- Faint diagonal grid lines at `var(--border)` color, `1px` at 10% opacity
- No hero image — the typography IS the visual

---

### 3. How It Works

**Layout:** 3-column horizontal steps on desktop, stacked on mobile.

**Headline:** `Three steps. No ceremony.`

**Steps:**

| # | Title        | Body                                                                 |
|---|--------------|----------------------------------------------------------------------|
| 1 | **Write**    | Draft your design doc in Markdown with our opinionated template system. Use frontmatter for metadata. |
| 2 | **Connect**  | Push to GitHub, GitLab, or paste a raw URL. designmd.ai syncs automatically. |
| 3 | **Publish**  | Share a clean, readable URL. Stakeholders see a beautiful doc. Engineers see the source. |

Each step has a `DM Mono` step number in `var(--accent)`, large and faint in the background.

---

### 4. Features

**Layout:** Alternating left/right rows (feature text + visual artifact). On mobile: stacked.

**Feature List:**

#### ✦ Markdown-Native
Write exactly as you do in README files. No proprietary syntax. No lock-in. Your docs are just `.md` files you already own.

#### ✦ Frontmatter Metadata
Use YAML frontmatter for title, status, owner, last-updated, and custom fields. Power your own dashboards.

#### ✦ Version History
Every change is a git commit. Diff your design docs like you diff your code. No surprises about what changed.

#### ✦ Multi-Channel Publishing
One doc → shareable URL, embeddable widget, PDF export, or Slack/Notion integration. Meet stakeholders where they are.

#### ✦ Persistent & Auto-Synced
Connect your repo once. designmd.ai watches for changes and republishes on every push. Set it and forget it.

#### ✦ Open Source Core
The renderer and CLI are MIT-licensed. Run it yourself, fork it, extend it. We make money on hosting, not on lock-in.

---

### 5. Live Preview / Example

**Layout:** Split panel — left is raw Markdown editor, right is rendered output.

Display a sample design doc (e.g., a button component spec) with:
- Status badge: `Draft`
- Author: `@jane`
- Last updated: timestamp
- Sections: Overview, Props, States, Accessibility, Open Questions

Tagline above: `What you write is what they see.`

Interactive toggle: `[ Raw MD ] [ Rendered ]`

---

### 6. Pricing

**Headline:** `Free for individuals. Simple for teams.`

| Plan       | Price          | Features                                                      |
|------------|----------------|---------------------------------------------------------------|
| **Open**   | Free forever   | Unlimited public docs, GitHub sync, shareable URLs            |
| **Studio** | $12/mo/user    | Private docs, custom domains, PDF export, team access control |
| **Org**    | Contact us     | SSO, audit logs, SLA, on-prem deployment                      |

Style: clean 3-column card layout. Studio plan slightly elevated (shadow + accent border).

---

### 7. Footer

- Left: `designmd.ai` wordmark + `MIT License · 2026`
- Center: `Docs` · `GitHub` · `Changelog` · `Status`
- Right: `Built with Markdown. Deployed with care.` (in `Lora` italic)

---

## Motion & Interaction Design

### Philosophy
Motion should feel like gravity — present but unfelt. No spinning logos. No parallax overload.

### Key Animations

| Element              | Animation                                           | Duration |
|----------------------|-----------------------------------------------------|----------|
| Hero headline        | Fade up, staggered word-by-word                     | 600ms    |
| Terminal cursor      | Blink loop (CSS `@keyframes`)                       | 1s loop  |
| Step numbers         | Count up on scroll-into-view                        | 400ms    |
| Feature rows         | Slide in from side on scroll                        | 500ms    |
| CTA button hover     | Background fill sweep left→right                    | 200ms    |
| Nav on scroll        | Blur + border fade in                               | 150ms    |
| Code snippet         | Typewriter effect on first load                     | 800ms    |

All animations respect `prefers-reduced-motion`.

---

## Component Library

### Button

```css
/* Primary */
.btn-primary {
  background: var(--accent);
  color: #0C0C0C;
  font-family: 'DM Mono', monospace;
  font-size: 13px;
  letter-spacing: 0.04em;
  padding: 10px 20px;
  border-radius: 3px;
  border: none;
  cursor: pointer;
  transition: background 200ms ease;
}
.btn-primary:hover { background: var(--accent-alt); }

/* Ghost */
.btn-ghost {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
  font-family: 'DM Mono', monospace;
  font-size: 13px;
  padding: 10px 20px;
  border-radius: 3px;
  transition: border-color 200ms, color 200ms;
}
.btn-ghost:hover {
  border-color: var(--accent);
  color: var(--accent);
}
```

### Status Badge

```
[ Draft ]   bg: #2A2010  text: #E8A020  border: #4A3010
[ Review ]  bg: #10202A  text: #20A0E8  border: #103040
[ Final ]   bg: #102010  text: #20C020  border: #103010
```

Font: `DM Mono`, 11px, letter-spacing 0.08em, all-caps.

### Code Block

```css
.code-block {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 16px 20px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-primary);
  overflow-x: auto;
}
```

---

## Responsive Breakpoints

| Breakpoint | Width       | Notes                                  |
|------------|-------------|----------------------------------------|
| Mobile     | `< 640px`   | Single column, stacked sections        |
| Tablet     | `640–1024px`| 2-column features, condensed hero      |
| Desktop    | `> 1024px`  | Full grid, side-by-side layouts        |
| Wide       | `> 1440px`  | Max-width clamp, generous side margins |

---

## Accessibility

- All interactive elements keyboard-navigable
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text
- Focus indicators: `2px solid var(--accent)` with `2px offset`
- All images have `alt` attributes
- ARIA labels on icon-only buttons
- Skip-to-content link at top of DOM
- Reduced motion: all animations disabled via `@media (prefers-reduced-motion: reduce)`

---

## Tech Stack (Recommended)

| Layer       | Choice                  | Reason                                  |
|-------------|-------------------------|-----------------------------------------|
| Framework   | Next.js (App Router)    | SSG for docs, ISR for live preview      |
| Styling     | CSS Modules + Variables | No runtime overhead, full control       |
| MD Renderer | `@next/mdx` + `rehype`  | Ecosystem, plugin support               |
| Syntax HL   | Shiki                   | Accurate, theme-able, minimal           |
| Deployment  | Vercel                  | Zero-config, edge-ready                 |
| Auth        | Clerk                   | Fast, integrates with GitHub            |
| DB          | PlanetScale / Turso     | Edge-compatible, schema-simple          |
| Fonts       | Google Fonts (self-host)| Performance, no FOUT                    |

---

## Open Questions

- [ ] Should v1 support Notion-style block editing alongside raw MD?
- [ ] Dark-only or introduce light mode in v1.1?
- [ ] What's the sharing permission model — public by default or private by default?
- [ ] CLI-first or web-first onboarding?
- [ ] How deeply do we integrate with GitHub PR reviews?

---

## Out of Scope (v1)

- Real-time collaborative editing (v2)
- AI-assisted design doc generation (v2)
- Design token integration (v3)
- Figma embed sync (v3)

---

*Last updated: May 2026 · Status: Draft · Owner: @design-team*
