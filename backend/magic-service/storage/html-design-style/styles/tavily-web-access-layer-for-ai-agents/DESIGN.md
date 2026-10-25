# DESIGN.md — Tavily

> Extracted from [tavily.com](https://www.tavily.com/). The web-access layer for AI agents — a developer-tool brand styled as a warm, editorial paper magazine. Cream backgrounds (`#fefcf5`) carry warm dark prose (`#3c3a39`) while a vibrant pastel-bright accent palette (electric pink, primary red, lavender, turquoise) sparks selectively. The signature voice: `Suisse Int'l` for prose and `Suisse Int'l Mono` for `/slash-prefix` eyebrows that read like CLI paths.

---

## Design Tokens

### Color — Brand Surfaces

| Token                | Hex       | Usage                                  |
| -------------------- | --------- | -------------------------------------- |
| `--color-background` | `#fefcf5` | **Primary canvas — warm cream paper**  |
| `--color-white`      | `#fffcf6` | Warm white — cards, nav, footer        |
| `--color-white-tint` | `#eaeae2` | Subtle dividers / chip background      |
| `--color-light-gray` | `#f7f7f5` | Section tint background                |
| `--color-black`      | `#3c3a39` | Default text — warm near-black         |

### Color — Black Alpha Scale

```css
--color-black-rgb: 11, 9, 7;          /* base black token */
--color-black-80:  #0b0907cc;         /* 80% */
--color-black-60:  #0b090799;         /* 60% — secondary body text */
--color-black-40:  #0b090766;         /* 40% — tertiary */
--color-black-20:  #0b090733;         /* 20% — disabled */
--color-black-10:  #0b09071a;         /* 10% — subtle borders */
--color-black-5:   #0b09070d;         /* 5%  — faintest surface */
```

### Color — White Alpha Scale

```css
--color-white-50:  #fffcf680;         /* 50% — overlay text */
--color-white-10:  #fffcf61a;         /* 10% — overlay border */
```

### Color — Accent Palette

| Token                   | Hex       | Usage                            |
| ----------------------- | --------- | -------------------------------- |
| `--color-primary-red`   | `#ff272d` | Signature voltage red            |
| `--color-orange`        | `#ff7300` | Warm orange accent               |
| `--color-yellow`        | `#ffc753` | Soft yellow                      |
| `--color-primary-yellow`| `#fdc211` | Bright primary yellow            |
| `--color-pink`          | `#f49eff` | Electric pastel pink             |
| `--color-lav` (lavender)| `#817fff` | Lavender purple                  |
| `--color-primary-blue`  | `#2677ff` | Primary blue (links / data)      |
| `--color-light-blue`    | `#aaf2fc` | Aqua highlight                   |
| `--color-turquoise`     | `#79deeb` | Turquoise accent                 |

These accent colors appear mostly in:
- Endpoint API badges (color-coded per route)
- Benchmark chart bars
- Decorative spotlight highlights
- Logo / hero gradients

---

## Typography

### Font Families

```css
--font-suisse: "Suisse Int'l", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono:   "Suisse Int'l Mono", monospace;
```

- **Suisse Int'l** — body, headings, UI
- **Suisse Int'l Mono** — eyebrow labels, code, `/path-style` section prefixes (signature voice)

### Type Scale — Fluid (clamp-based)

The entire scale is fluid via `clamp()` — every heading and body level scales smoothly between mobile and desktop.

| Token                | Min      | Preferred         | Max      | Px Range     |
| -------------------- | -------- | ----------------- | -------- | ------------ |
| `--font-h0-size`     | 4.375rem | `4vw + 2rem`      | 6.25rem  | 70 → 100px   |
| `--font-h1-size`     | 3.4375rem| `3vw + 1.5rem`    | 4.6875rem| 55 → 75px    |
| `--font-h2-size`     | 2.5rem   | `2.5vw + 1rem`    | 4rem     | 40 → 64px    |
| `--font-h3-size`     | 2rem     | `1.5vw + 1rem`    | 2.625rem | 32 → 42px    |
| `--font-h4-size`     | 1.5rem   | `1vw + 0.75rem`   | 2rem     | 24 → 32px    |
| `--font-p1-size`     | 1.0625rem| `0.5vw + 0.75rem` | 1.375rem | 17 → 22px    |
| `--font-p2-size`     | 0.875rem | `0.5vw + 0.5rem`  | 1.125rem | 14 → 18px    |
| `--font-p3-size`     | 0.75rem  | `0.35vw + 0.5rem` | 0.9375rem| 12 → 15px    |
| `--font-eyebrow-size`| `15px`   | (fixed)           | `15px`   | 15px         |

### Weights & Line Heights

```css
--font-heading-weight:        500;     /* medium */
--font-heading-line-height:   1;       /* tight, type-design grade */
--font-paragraph-weight:      400;
--font-paragraph-line-height: 1.1;
```

### Heading Letter Spacing

Observed values:
- H1 hero (75px): `letter-spacing: -1.5px`
- H2 (59px): `letter-spacing: -1.28px`
- H3 / body: `letter-spacing: normal`

Tight tracking on display headings gives the editorial, type-designer feel.

### Eyebrow / Mono Labels (signature)

Tavily's most recognizable typographic move — **mono labels prefixed with `/`** acting as CLI path breadcrumbs above each section:

```css
font-family:   "Suisse Int'l Mono", monospace;
font-size:     15px;
font-weight:   400;
color:         rgba(11, 9, 7, 0.6);    /* --color-black-60 */
text-transform: none;
```

Examples: `/the web access layer for agents`, `/benchmarks`, `/endpoints`

---

## Layout

### Page Tokens

```css
--page-padding-x:        100px;     /* horizontal page padding (desktop) */
--page-padding-x-half:    50px;     /* half-padding for inset rails */
--max-content-width:    1440px;     /* content container ceiling */
--module-vertical-spacing: 0;       /* sections handle their own padding */
```

### Body

```css
body {
  background-color: #fefcf5;        /* warm cream */
  color:            #3c3a39;        /* warm near-black */
  font-family:      "Suisse Int'l", -apple-system, sans-serif;
  font-size:        16px;
}
```

### Section Pattern

Sections own their internal padding:

```css
.page-module      { padding: 50px 0; }            /* default vertical rhythm */
.hero             { padding: 0 50px; height: ~769px; }
.users            { padding: 0 100px; background: #fffcf6; }
.benchmarks       { background: #fffcf6; height: ~764px; }
.large-block      { padding: 80px 100px; }
```

The site is essentially a **single warm canvas** with subtle white surface lifts (`#fffcf6`) marking premium feature bands (Users, Benchmarks). No dark band breaks at all — the entire experience stays in the cream-paper register.

### Responsive

Fluid type (`clamp`) does most of the responsive work — there are no abrupt breakpoint jumps in the type scale. Page horizontal padding collapses from `100px` to `50px` on tablet via `--page-padding-x-half`.

---

## Components

### Navigation

```css
background-color: #fffcf6;            /* warm white */
color:            #3c3a39;
position:         sticky;
height:           89px;
top:              0;
```

- Logo wordmark left-aligned
- Center nav items: Suisse Int'l 500/15px
- Right rail: **Login** (ghost text button) + **Sign Up** (dark pill)
- Resources dropdown trigger as plain ghost button (no chevron embellishment)

### Buttons

#### Primary — Dark Pill

The signature CTA — warm-black pill on cream canvas:

```css
background-color: #3c3a39;            /* --color-black */
color:            #fefefe;            /* near-white */
border:           none;
border-radius:    40px;               /* full pill */
padding:          10px 18px;
font-family:      "Suisse Int'l", sans-serif;
font-weight:      400;
font-size:        13.33px;
text-decoration:  none;
```

#### Ghost Pill — "Login"

```css
background-color: transparent;
color:            #000000;
border:           none;
border-radius:    45px;
padding:          8px 12px;
font-weight:      400;
font-size:        13.33px;
```

#### Hero Link CTA — "Try it out"

```css
background-color: transparent;
color:            rgba(11, 9, 7, 0.6);   /* --color-black-60 */
padding:          0;
font-weight:      400;
font-size:        14px;
/* No border or background — a quiet text link inside the hero */
```

#### Outlined Inverse Pill (on dark callouts)

```css
background-color: transparent;
color:            #fffcf6;
border:           1px solid #ffffff;
border-radius:    100px;
padding:          12px 24px;
font-weight:      500;
font-size:        15px;
```

### Cards & Containers

Tavily uses **outlined rectangular cards** with thin borders rather than shadows:

```css
background-color: #fffcf6;
border:           1px solid rgba(11, 9, 7, 0.1);
border-radius:    14px;
padding:          24px;
```

Endpoint / benchmark cards use color-coded thin left accents using the `--endpoint-accent` token.

### Footer

```css
background-color: #fffcf6;
color:            #3c3a39;
padding:          0 100px 50px;
```

- Multi-column link groups with mono `/` prefix headers
- Logo wordmark + small copyright line
- Same warm white as nav — the design language is continuous top-to-bottom

### Endpoint Accent System

Tavily defines a generic accent token used per API endpoint badge:

```css
--endpoint-accent:     /* per-endpoint color from accent palette */
--endpoint-accent-rgb: /* same as RGB triplet for transparencies */
```

Each documented endpoint gets a unique color drawn from the accent palette (red, pink, lavender, blue, turquoise) so developers can visually scan by route.

### Certification / Trust Badge

```css
--cert-accent:       /* trust badge accent color */
--cert-accent-soft:  /* softer surface variant */
--cert-accent-soft-2: /* even softer */
```

Used on enterprise badges (SOC2, etc.) to vary intensity.

### Spotlight Effect

```css
--spotlight-x: /* mouse-tracked horizontal */
--spotlight-y: /* mouse-tracked vertical */
```

These tokens power a cursor-following radial highlight on hero / feature cards — a subtle interactive flourish.

### Text & Icon Shift

```css
--text-shift: /* hover translate */
--icon-shift: /* hover translate */
```

Used on link-with-arrow patterns — text shifts left while icon shifts right on hover (classic editorial micro-interaction).

---

## Borders & Radii

| Value      | Usage                                  |
| ---------- | -------------------------------------- |
| `1px`      | Inline icon outlines, sparkline dots   |
| `2px`      | Small chip / tag corners               |
| `3px`      | Very small UI elements                 |
| `8px`      | Default block corners                  |
| `10px`     | Section sub-cards                      |
| `12px`     | Standard cards                         |
| `14px`     | Larger feature cards                   |
| `18px`     | Modal corners                          |
| `20px`     | Premium feature cards                  |
| `40px`     | Sign-Up pill button                    |
| `45px`     | Login ghost pill                       |
| `50px`     | Large feature pills                    |
| `50%`      | Avatars / circular dots                |
| `100px`    | Large outlined CTAs                    |
| `9999px`   | True full-pill                         |

---

## Borders

Default borders are hairline, low-contrast — favoring quiet definition over emphasis:

```css
1px solid rgb(32, 32, 32);            /* strong text-color border */
1px solid rgb(31, 30, 30);            /* near-black border */
1px solid rgb(247, 247, 245);         /* surface-tone border (invisible-ish) */
1px solid rgb(221, 221, 221);         /* light divider */
1px solid rgba(60, 58, 57, 0.1);      /* 10% body-color border */
1px solid rgba(11, 9, 7, 0.1);        /* 10% black border */
1px solid rgba(129, 176, 154, 0.3);   /* sage accent border */
1px solid rgb(50, 174, 136);          /* success green */
```

---

## Shadows

Tavily uses shadows **sparingly** — most lift is achieved through subtle borders. When shadows appear:

```css
box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.08),
            0 1px 2px 0 rgba(0, 0, 0, 0.06);     /* subtle card lift */

box-shadow: 0 4px 24px 0 rgba(0, 0, 0, 0.06);    /* floating panel */

box-shadow: 0 2px 10px 0 rgba(0, 0, 0, 0.2);     /* tooltip / popover */

box-shadow: 0 0 3px 0 rgba(0, 0, 0, 0.3);        /* halo */

/* Neumorphic-style on a few featured cards */
box-shadow: rgb(199, 197, 199) -3px -3px 5px -2px,
            rgb(199, 197, 199)  0px  0px 12px 2px;
```

---

## Iconography

- **Style**: Custom thin-line monoline icons, ~1.5px stroke
- **Sizes**: `16px`, `20px`, `24px`, occasionally `32px` for feature illustrations
- **Color**: Inherits from `currentColor` (default `#3c3a39`)
- **Endpoint glyphs**: API endpoint blocks pair an accent dot with the route name
- **Logo collage**: Customer logos rendered in flat monochrome over the cream canvas

---

## Motion

```css
/* Mouse-tracked spotlight on feature cards */
background: radial-gradient(at var(--spotlight-x) var(--spotlight-y), accent, transparent);

/* Hover micro-shift on link+arrow patterns */
.link        { transform: translateX(var(--text-shift, 0px)); }
.link .arrow { transform: translateX(var(--icon-shift, 0px)); }
```

- Hover micro-shifts: 2–4px translate on text + arrow icons
- Smooth fluid type — no breakpoint jumps
- Card hover: borders darken from `rgba(11,9,7,0.1)` to `rgba(11,9,7,0.4)`
- Sign-Up pill: hover opacity / subtle scale only — no heavy state changes

---

## Imagery & Charts

- **Benchmark charts**: Bar charts using `--color-primary-blue`, `--color-primary-red`, `--color-lav` to compare Tavily vs competitors
- **Hero illustration**: Abstract web-of-nodes representing agent → web connections
- **Customer logos**: Rendered in `--color-black` (warm dark) on cream, monochrome
- **No photography**: The site is illustration- and type-driven; there are no people or product screenshots in the hero band

---

## Visual Tone

**Warm. Editorial. Type-designer.**

Tavily's design language is the rarest thing in dev tools — a brand that actually feels designed:

1. **Cream paper canvas** (`#fefcf5`) is the entire identity. There is no dark mode, no harsh white, no flat gray — just a warm, magazine-paper background top to bottom.
2. **Warm-black text** (`#3c3a39`) instead of pure black. A small choice, but it makes every paragraph feel printed rather than rendered.
3. **Suisse Int'l everywhere.** A swiss-modernist sans with a wide weight range — Tavily uses it confidently across sizes from 15px eyebrows to 100px H0 hero displays with `clamp()` fluid scaling.
4. **`/path-style` mono eyebrows.** The single most distinctive visual gesture — section prefixes like `/benchmarks` and `/the web access layer for agents` use Suisse Int'l Mono to evoke CLI paths and signal "we are a developer tool" without ever shouting it.
5. **Pastel-bright accent palette.** Electric pink, lavender, turquoise, primary blue — vivid but used sparingly as endpoint badges, chart series, and decorative spotlights. The accents punch precisely because the canvas stays so calm.
6. **Outlined cards, no shadows.** Trust comes from hairline 1px borders, not box-shadow lift. The whole UI feels printed.
7. **Fluid type via `clamp()`.** Every heading scales smoothly from mobile to desktop — there is no "mobile breakpoint jump" anywhere on the site.
8. **Tight heading line-height (`1`).** Display headings sit tight, with negative letter-spacing on H1/H2 — the type designer's craft showing through.
9. **Quiet micro-interactions.** Hover shifts text 2–4px left while the arrow moves right; the spotlight follows the cursor on feature cards. No bouncy animations, no parallax — just the right amount of life.

The result is a developer-tool homepage that reads like a literary magazine cover — confident, beautifully typeset, and unmistakably crafted by someone who cares about how the word "/benchmarks" sits next to a number.
