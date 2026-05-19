# Gradient Fashion (Gradient Fashion) Visual Spec v3

> **v3 Core upgrades**: elevated palette · two-color shadows · deeper darks · matte gold accents · top-edge highlight · more interactive components

---

## 1. Core Design Concept

- **Gradient-first identity**: deep purple → mid purple → pink-purple → matte gold; gradients use a depth anchor instead of a flat wash.
- **Rounded and soft**: large radii (16–24px) and circular decorations create a friendly, approachable experience.
- **Glassmorphism**: glass cards with `backdrop-filter` are layered over gradient backgrounds to build visual depth.
- **Rich layering**: background gradient glows, card gradients, and gradient text create three stacked gradient layers.
- **Top-edge highlight**: dark cards add a 1px semi-transparent white outline on the top edge to simulate light reflection and enhance material quality.

---

## 2. Color Spec v3

```css
:root {
  /* Main gradient system (v3: adds deep purple anchor #4A00E0 and changes endpoint to matte gold #E8C96A) */
  --grad-main: linear-gradient(
    135deg,
    #4a00e0 0%,
    #8b5cf6 30%,
    #c850c0 65%,
    #e8c96a 100%
  );
  --grad-purple: linear-gradient(135deg, #4a00e0 0%, #8b5cf6 50%, #c850c0 100%);
  --grad-warm: linear-gradient(135deg, #f472b6 0%, #e8c96a 100%);
  --grad-cool: linear-gradient(135deg, #38bdf8 0%, #6c63ff 100%);
  --grad-mint: linear-gradient(135deg, #34d399 0%, #22d3ee 100%);
  --grad-sunset: linear-gradient(135deg, #f472b6 0%, #fbbf24 100%);
  --grad-indigo: linear-gradient(135deg, #312e81 0%, #4a00e0 100%);
  --grad-text: linear-gradient(135deg, #7c3aed, #c850c0, #e8c96a);

  /* Fixed colors */
  --purple: #6d28d9; /* Deep saturated purple, upgraded in v3 and more stable than #6C63FF */
  --violet: #8b5cf6; /* Mid purple, used as the middle tone in gradients */
  --pink: #c850c0; /* Brand pink-purple */
  --coral: #f472b6; /* Soft coral, replacing #FF6B9D in v3 for a softer tone */
  --gold: #e8c96a; /* Matte gold, new in v3 and replacing the harsh #FFBD59 */
  --amber: #fbbf24; /* Amber for emphasized highlights */
  --mint: #34d399; /* Emerald green, replacing #43E97B in v3 for a fresher tone */
  --sky: #38bdf8; /* Sky blue, replacing #4FACFE in v3 for a clearer tone */
  --indigo: #4a00e0; /* Deep purple anchor, new in v3 */

  /* Background */
  --bg-white: #ffffff;
  --bg-soft: #fdfcff; /* Creamy white-purple, refined in v3 to feel warmer than #FAF8FF */
  --bg-card: #f8f5ff; /* Card background color, new in v3 */
  --bg-dark: #0d0825; /* Nebula purple, upgraded in v3 to be deeper than #12082A */
  --bg-dark-2: #160d35;
  --bg-dark-3: #1e1448;

  /* Text */
  --text-primary: #0d0825;
  --text-secondary: #4c3d7a;
  --text-muted: #8b7ec8;
  --text-hint: #c4b8e8;
  --text-on-dark: #f0eaff; /* Text on dark backgrounds, purple-tinted white */
}
```

### v3 Key Upgrade Notes

| element          | v2 Old value | v3 New value | Reason for upgrade                            |
| ---------------- | ------------ | ------------ | --------------------------------------------- |
| primary purple   | `#6C63FF`    | `#6D28D9`    | higher saturation, more stable and premium    |
| yellow endpoint  | `#FFBD59`    | `#E8C96A`    | Matte gold, low saturation, less harsh        |
| dark background  | `#12082A`    | `#0D0825`    | Deeper, with a stronger nebula feel           |
| light background | `#FAF8FF`    | `#FDFCFF`    | Slightly warmer and gentler                   |
| gradient start   | `#6C63FF`    | `#4A00E0`    | Deep purple anchor gives gradients more depth |
| coral            | `#FF6B9D`    | `#F472B6`    | Softer and less fluorescent                   |
| mint green       | `#43E97B`    | `#34D399`    | Fresher and more emerald                      |
| sky blue         | `#4FACFE`    | `#38BDF8`    | clearer, more sky blue                        |

---

## 3. Typography Spec

| Level          | Size    | Weight | Style                                                     |
| -------------- | ------- | ------ | --------------------------------------------------------- |
| main title     | 68–80px | 800    | Gradient text (--grad-text), letter-spacing:-0.02em       |
| content title  | 40–52px | 700    | color:--purple or gradient text                           |
| subtitle       | 28–36px | 500    | color:--text-secondary                                    |
| Body text      | 22–26px | 400    | color:--text-secondary, line-height:1.75                  |
| data highlight | 64–80px | 900    | Gradient text + two-color drop shadow                     |
| pill label     | 14–18px | 700    | Gradient background with white text, border-radius:9999px |

Font family: `'Noto Sans SC', sans-serif`

**Font Import: **

```html
<link
  href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap"
  rel="stylesheet"
/>
```

---

## 4. Background Decoration Spec v3

**Blurred gradient glow (cover/section page, v3 adds a fourth accent glow layer):**

```html
<!-- Top-left main glow (v3: opacity lowered to 0.22 and blur increased to 90px for a softer look) -->
<div
  style="position:absolute;top:-200px;left:-150px;width:700px;height:700px;
  border-radius:50%;background:var(--grad-purple);opacity:0.22;
  filter:blur(90px);pointer-events:none;"
></div>
<!-- Bottom-right warm secondary glow -->
<div
  style="position:absolute;bottom:-150px;right:-100px;width:500px;height:500px;
  border-radius:50%;background:var(--grad-warm);opacity:0.18;
  filter:blur(70px);pointer-events:none;"
></div>
<!-- Center cool-color accent -->
<div
  style="position:absolute;top:40%;left:45%;width:300px;height:300px;
  border-radius:50%;background:var(--grad-cool);opacity:0.12;
  filter:blur(50px);pointer-events:none;"
></div>
<!-- Top-right indigo accent, new in v3 -->
<div
  style="position:absolute;top:-60px;right:200px;width:200px;height:200px;
  border-radius:50%;background:var(--grad-indigo);opacity:0.15;
  filter:blur(40px);pointer-events:none;"
></div>
```

**Soft content-page base, upgraded in v3 to dual ellipses:**

```css
background:
  radial-gradient(
    ellipse at 15% 15%,
    rgba(109, 40, 217, 0.05) 0%,
    transparent 55%
  ),
  radial-gradient(
    ellipse at 85% 85%,
    rgba(200, 80, 192, 0.04) 0%,
    transparent 50%
  );
```

**Gradient grid (v3: finer lines, wider spacing):**

```css
background-image:
  linear-gradient(rgba(109, 40, 217, 0.03) 1px, transparent 1px),
  linear-gradient(90deg, rgba(109, 40, 217, 0.03) 1px, transparent 1px);
background-size: 48px 48px;
```

---

## 5. Dedicated Layout Types (8 Types)

### 1. Cover page Cover

- Full-screen nebula purple (`bg-dark` = `#0D0825`) plus **4 layers** of blurred gradient glow
- Center: large gradient title (80px), subtitle, and pill label with glow shadow
- Bottom: glassmorphism info bar with **top-edge highlight**: `border-top-color: rgba(255,255,255,0.14)`

### 2. Product features page Features

- Background: `bg-soft` (`#FDFCFF`) plus soft dual-ellipse decorations
- Top: gradient-text title plus subtitle
- Main body: three-column feature-card layout with **4px top gradient line** and top-edge glow fade-in

### 3. Data story page Data Story

- Left side (45%): deep purple gradient background (`grad-purple`) with embedded glow
- Right side (55%): `bg-soft` background, ECharts chart, and interpretation text

### 4. Reviews page Reviews

- Background: `bg-soft`
- Star color: `--gold`, matte gold replacing harsh yellow
- Main body: three-column review-card layout; avatars add colored shadows

### 5. Comparison page Comparison

- Own-product column: deep purple gradient header (`grad-purple`) with glow shadow

### 6. Dashboard page Dashboard

- Four KPI cards: each adds a **top-edge highlight line** using a `::before` pseudo-element
- Cards use different gradients: purple / warm / cool / mint

### 7. Section page Section

- Full-screen gradient background (`grad-main`) with deep purple anchor
- Center: `glass-card-dark` with dark glass and top-edge highlight

### 8. Ending page Ending

- Full-screen nebula purple (`#0D0825`) plus 4 glow layers
- CTA buttons: `pill-gold` with matte gold and `box-shadow: var(--shadow-gold)`

---

## 6. Shadow System v3 (Core Upgrades)

One of the most important v3 upgrades is the **two-color shadow**, replacing the single purple shadow.

```css
/* Card shadow: main purple shadow plus offset pink secondary shadow */
--shadow-card:
  0 4px 16px rgba(74, 0, 224, 0.12), 0 1px 4px rgba(200, 80, 192, 0.08),
  0 0 0 1px rgba(109, 40, 217, 0.04);

/* floating shadow */
--shadow-float:
  0 16px 48px rgba(74, 0, 224, 0.22), 0 6px 20px rgba(200, 80, 192, 0.15),
  0 2px 8px rgba(0, 0, 0, 0.1);

/* glow shadow: three-layer spread */
--shadow-glow:
  0 0 24px rgba(139, 92, 246, 0.45), 0 0 60px rgba(200, 80, 192, 0.25),
  0 0 100px rgba(74, 0, 224, 0.15);

/* Dark card shadow, including top-edge highlight inset */
--shadow-dark-card:
  0 8px 32px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(74, 0, 224, 0.2),
  inset 0 1px 0 rgba(255, 255, 255, 0.08);

/* Matte gold shadow, reserved for CTA elements */
--shadow-gold:
  0 8px 24px rgba(232, 201, 106, 0.35), 0 2px 8px rgba(232, 201, 106, 0.2);
```

---

## 7. Radius Spec

| element         | Radius                           |
| --------------- | -------------------------------- |
| small card      | 16px                             |
| large container | 24px                             |
| pill label      | 9999px                           |
| image           | 16px                             |
| avoid           | <12px to avoid a hard-edged feel |

---

## 8. Top-Edge Highlight Spec (New in v3)

Dark cards, glass cards, and KPI cards should all add top-edge highlights to simulate light reflection and material quality:

```css
/* Option 1: border-top set border-top separately */
.glass-card {
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-top-color: rgba(255, 255, 255, 0.38); /* Brighter top edge */
}

/* Option 2: ::before pseudo-element, gradient highlight line suitable for KPI cards */
.kpi-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.5),
    transparent
  );
}

/* Option 3: inset box-shadow (Dark card ) */
box-shadow:
  ...,
  inset 0 1px 0 rgba(255, 255, 255, 0.08);
```

---

## 9. Component library (complete version )

### Base components

- **Gradient KPI card** (`.kpi-card`): 4 gradient variants + top-edge highlight + two-color shadow
- **Glassmorphism card** (`.glass-card` / `.glass-card-tint` / `.glass-card-dark`)
- **white soft card** (`.soft-card` / `.soft-card-tinted`)
- **Feature card** (`.feature-card`): 4px top gradient line + top fade-in glow
- **review card** (`.review-card`)

### Tags / Badges

- **Pill label** (`.pill`): 8 variants (main / purple / warm / cool / gold / dark / light / outline)
- **Number badge** (`.badge-number`): circular gradient badge
- **Status dot** (`.badge-dot`): glowing status indicator

### Buttons

- `.btn-primary`: flowing gradient + top-edge highlight + two-color shadow
- `.btn-gold`: matte gold CTA with dark text
- `.btn-glass`: glassmorphism, suitable for dark backgrounds
- `.btn-outline`: outline, inverts on hover
- `.btn-outline-light`: outline dedicated to dark backgrounds

### Interactive components (v3 new )

- **Tab switcher** (`.tab-group` / `.tab-item`)
- **step indicator** (`.steps` / `.step-dot` / `.step-line`)
- **Toast notification** (`.toast`): 3 states (success / warn / info)
- **Tooltip** (`.tooltip-wrap` / `.tooltip`)

### Animation utilities

- `.anim-float`: 7s float (with subtle rotation, more natural )
- `.anim-pulse`: 2.4s pulse glow
- `.anim-grad`: 6s gradient flow, requiring `background-size: 300% 300%`
- `.anim-shimmer`: shimmer sweep (skeleton/button )
- `.anim-fade-up`: fade-up entrance animation
- `.anim-scale-in`: scale-in entrance animation

---

## 10. ECharts Chart Spec v3

### Palette (v3 Update)

```javascript
color: ["#6D28D9", "#C850C0", "#F472B6", "#E8C96A", "#34D399", "#38BDF8"];
```

### Global Config Template

```javascript
const gradientTheme = {
  backgroundColor: "#FFFFFF",
  textStyle: { color: "#4C3D7A", fontFamily: "Noto Sans SC, sans-serif" },
  title: {
    textStyle: { color: "#0D0825", fontSize: 28, fontWeight: "bold" },
    subtextStyle: { color: "#8B7EC8", fontSize: 18 },
  },
  legend: { textStyle: { color: "#8B7EC8", fontSize: 16 } },
  categoryAxis: {
    axisLine: { lineStyle: { color: "#EDE6FF" } },
    axisTick: { show: false },
    axisLabel: { color: "#8B7EC8", fontSize: 16 },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: "#8B7EC8", fontSize: 16 },
    splitLine: { lineStyle: { color: "#F8F5FF" } },
  },
  tooltip: {
    backgroundColor: "#0D0825",
    borderColor: "#4A00E0",
    borderWidth: 1,
    textStyle: { color: "#F0EAFF", fontSize: 16 },
  },
};
```

### Gradient Bar Chart

```javascript
// single-bar gradient fill
itemStyle: {
  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: '#8B5CF6' },
    { offset: 1, color: '#4A00E0' }
  ]),
  borderRadius: [6, 6, 0, 0]
}
```
