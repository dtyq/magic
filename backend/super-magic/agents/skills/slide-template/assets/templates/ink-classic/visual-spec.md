# Ink-on-Paper Style (Ink Classic) Visual Specification

## 1. Core Design Concept

- **The timeless dialogue between ink and paper**:Use ink black (#0a0a0b) and paper white (#f1efea) as the two poles to build a restrained, elegant visual system with strong academic authority.
- **Typography as decoration**:The combination of serif headline type and monospaced labels makes the text itself the page's finest decorative element.
- **Structured whitespace**:Generous whitespace creates breathing room, with balanced information density and equal emphasis on charts and text.
- **Poetic light and shadow**:Use WebGL noise textures on dark pages and subtle gradients on light pages to give static slides a cinematic quality.

---

## 2. Color Specification

```css
:root {
  --ink: #0a0a0b; /* Ink black: cover/dark page background */
  --ink-rgb: 10, 10, 11;
  --ink-tint: #18181a; /* Deep ink secondary background */

  --paper: #f1efea; /* Paper white: main content page background */
  --paper-rgb: 241, 239, 234;
  --paper-tint: #e8e5de; /* Dark paper tint: cards/callout backgrounds */

  --sepia: #8b7d6b; /* Ink-bleed tone: supporting text */
  --sepia-light: #a89f91; /* Light ink: subdued labels */
  --sepia-muted: #c4bdb0; /* Very light ink: decorative lines */
}
```

---

## 3. Typography Specification

| Level                 | Font families    | Size                      | Weight | Color                       |
| --------------------- | ---------------- | ------------------------- | ------ | --------------------------- |
| English chapter title | Playfair Display | clamp(3rem,8.5vw,8.5vw)   | 800    | currentColor                |
| Chinese chapter title | Noto Serif SC    | clamp(2.5rem,6.5vw,6.5vw) | 700    | currentColor                |
| Large content title   | Noto Serif SC    | clamp(1.6rem,3.6vw,3.6vw) | 700    | currentColor                |
| Small content title   | Noto Serif SC    | clamp(1rem,1.9vw,1.9vw)   | 700    | currentColor                |
| Lead text             | Noto Sans SC     | max(14px,1.2vw)           | 400    | currentColor, opacity:.68   |
| Body copy             | Noto Sans SC     | max(13px,1.05vw)          | 400    | currentColor, opacity:.65   |
| Labels/metadata       | IBM Plex Mono    | 10-11px                   | 400    | currentColor, opacity:.4-.5 |
| Data highlight        | Playfair Display | clamp(1.8rem,4vw,4vw)     | 800    | currentColor                |

**Font import:**

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link
  href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=IBM+Plex+Mono:wght@400;500&family=Noto+Serif+SC:wght@600;700&family=Noto+Sans+SC:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

---

## 4. Decorative Element Specification

**A. Page navigation bar (chrome)**:

```css
position: relative;
z-index: 2;
display: flex;
justify-content: space-between;
align-items: center;
padding: 2.4vh 3.5vw;
font-family: var(--mono);
font-size: 11px;
letter-spacing: 0.08em;
text-transform: uppercase;
opacity: 0.5;
border-bottom: 1px solid rgba(var(--ink-rgb), 0.12);
```

**B. Ghost oversized text decoration (ghost)**:

```html
<div class="ghost" style="right:-5vw;bottom:-8vh">绿</div>
```

```css
position: absolute;
z-index: 1;
font-family: var(--serif-en);
font-weight: 800;
font-size: 34vw;
line-height: 1;
opacity: 0.035;
pointer-events: none;
letter-spacing: -0.04em;
color: currentColor;
```

**C. Callout (callout)**:

```css
padding: 2.5vh 2vw;
border-left: 3px solid currentColor;
background: rgba(var(--ink-rgb), 0.05);
font-family: var(--serif-zh);
font-size: max(14px, 1.15vw);
line-height: 1.7;
```

Dark pages:background: rgba(var(--paper-rgb), .06);

**D. Stat card (stat-card)**:

```css
padding: 2.5vh 1.8vw;
border: 1px solid rgba(var(--ink-rgb), 0.15);
```

Dark pages:border-color: rgba(var(--paper-rgb), .18);

**E. Row list (rowline)**:

```css
display: grid;
grid-template-columns: 3fr 5fr 2fr;
gap: 2vw;
padding: 1.8vh 0;
border-bottom: 1px solid rgba(var(--ink-rgb), 0.1);
```

Add border-top to the first row.

**F. WebGL noise background (only for .slide.dark/.hero.dark/.hero.light)**:
Dark pagesuse the FS_DARK shader (dark-toned FBM noise), Light pageuse the FS_LIGHT shader (paper-toned FBM noise). On the **first cover slide**, prefer the photo + scrim stack (§4.G) instead of noise-only.

**G. Cover photo + scrim (first slide only)** — required markup pattern:

```html
<div
  class="slide-container dark cover-photo"
  style="--cover-bg-image: url('…');"
>
  <!-- optional: --cover-scrim to tune opacity, e.g. rgba(10,10,11,.58) -->
  …
</div>
```

```css
/* Full rules live in theme.css (image layer + scrim). Content uses z-index: 2. */
```

---

## 5. Dedicated Layout Page Types (8)

### 1. Cover page Hero Dark

- **Mandatory full-bleed photographic (or illustration) background on the first slide**, `background-size: cover`, `background-position: center`, with a **semi-transparent ink scrim** on top (`rgba(var(--ink-rgb), 0.5–0.65)`) so titles and metadata stay readable. Implement via `.slide-container.dark.cover-photo` and `--cover-bg-image` (see §4.G). Do not use a flat ink-only cover for slide 1; WebGL noise on the cover is optional and must sit **under** the photo or be omitted when the photo stack is used.
- Top chrome: institution/conference name + date
- Body: kicker label + oversized Chinese/English chapter title + subtitle + author metadata
- Bottom foot: discipline + year

### 2. Background Page

- Light background
- Left (55%): kicker + h-xl title + lead text + callout
- Right (45%): image container (16:9 or 4:3) + footnote

### 3. Methodology Page

- Light background, three-column grid
- Each column: large number (semi-transparent decoration) + h-md title + body-text description + metadata label
- Bottom: callout with supplemental notes

### 4. Key Findings Page Key Findings

- Light background, grid-6 (3 columns x 2 rows) stat cards
- Top: kicker + h-xl + lead text
- Inside cards: stat-label + stat-nb + stat-note

### 5. Comparison Page

- Light background, rowline Row list
- Top: kicker + h-xl
- Rows: row-k (city/name) + row-v (description) + row-m (value)
- Bottom: callout with key finding

### 6. Visualization Page Visualization

- Light background, grid-2 two-column layout
- Each column: kicker + h-md + image container + footnote
- Additional callout on the right

### 7. Core Conclusion Page Core Conclusion

- hero light + WebGL noise texture
- Centered: kicker + large blockquote + English translation + meta-row source

### 8. Policy & Acknowledgements Page

- Full-screen dark background + WebGL texture + ghost oversized text
- Left (50%): kicker + h-xl + three recommendations (with left vertical rules)
- Right (50%): acknowledgements + contact information + data link
- Bottom foot: topic name + Thank You

---

## 6. Corner Radius and Shadow Specification

| Element         | Radii                                           | Shadows                                 |
| --------------- | ----------------------------------------------- | --------------------------------------- |
| Stat card       | 0(straight edges)                               | None                                    |
| Callout         | 0                                               | None                                    |
| Image container | 0                                               | None                                    |
| Row list        | 0                                               | None                                    |
| **Principle**   | **No rounded corners anywhere in the template** | **No shadows anywhere in the template** |

This template deliberately rejects rounded corners and shadows, using straight lines, solid borders, and flat fills to create an extremely restrained academic feel.

---

## 7. ECharts Chart Specification

### Palette

```javascript
color: ["#0a0a0b", "#8b7d6b", "#a89f91", "#5c4a3a", "#c4bdb0", "#e8e5de"];
```

### Global Configuration Template

```javascript
const inkClassicTheme = {
  backgroundColor: "#f1efea",
  textStyle: { color: "#3a3835", fontFamily: "Noto Sans SC, sans-serif" },
  title: {
    textStyle: {
      color: "#0a0a0b",
      fontSize: 26,
      fontWeight: "bold",
      fontFamily: "Noto Serif SC",
    },
    subtextStyle: { color: "#8b7d6b", fontSize: 16 },
  },
  legend: { textStyle: { color: "#5c4a3a", fontSize: 15 } },
  categoryAxis: {
    axisLine: { lineStyle: { color: "#c4bdb0" } },
    axisTick: { lineStyle: { color: "#c4bdb0" } },
    axisLabel: { color: "#5c4a3a", fontSize: 15 },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: "#8b7d6b", fontSize: 14 },
    splitLine: { lineStyle: { color: "#e8e5de" } },
  },
  tooltip: {
    backgroundColor: "#0a0a0b",
    borderColor: "#8b7d6b",
    textStyle: { color: "#f1efea", fontSize: 14 },
  },
};
```

### Line chart

```javascript
option = {
  backgroundColor: "#f1efea",
  color: ["#0a0a0b", "#8b7d6b", "#5c4a3a"],
  grid: { top: 80, bottom: 70, left: 80, right: 60, containLabel: true },
  xAxis: {
    type: "category",
    axisLabel: { color: "#5c4a3a", fontSize: 15 },
    axisLine: { lineStyle: { color: "#c4bdb0" } },
    axisTick: { lineStyle: { color: "#c4bdb0" } },
  },
  yAxis: {
    type: "value",
    nameTextStyle: { color: "#8b7d6b", fontSize: 14 },
    axisLabel: { color: "#8b7d6b", fontSize: 14 },
    splitLine: { lineStyle: { color: "#e8e5de" } },
    axisLine: { show: false },
  },
  series: [
    {
      type: "line",
      smooth: false,
      lineStyle: { width: 2.5 },
      symbolSize: 6,
      symbol: "circle",
    },
  ],
};
```

### Bar chart

```javascript
option = {
  backgroundColor: "#f1efea",
  color: ["#0a0a0b", "#8b7d6b"],
  grid: { top: 80, bottom: 70, left: 80, right: 40, containLabel: true },
  xAxis: {
    type: "category",
    axisLabel: { color: "#5c4a3a", fontSize: 15 },
    axisLine: { lineStyle: { color: "#c4bdb0" } },
  },
  yAxis: {
    type: "value",
    axisLabel: { color: "#8b7d6b", fontSize: 14 },
    splitLine: { lineStyle: { color: "#e8e5de" } },
    axisLine: { show: false },
  },
  series: [
    {
      type: "bar",
      barWidth: "30%",
      itemStyle: { borderRadius: 0 },
      label: { show: true, position: "top", color: "#0a0a0b", fontSize: 14 },
    },
    {
      type: "bar",
      barWidth: "30%",
      itemStyle: { borderRadius: 0 },
      label: { show: true, position: "top", color: "#8b7d6b", fontSize: 14 },
    },
  ],
};
```

---

## 8. AI Illustration Generation Specification

### Style Keywords

```
minimalist academic style, monochromatic ink palette, clean composition,
no decorative elements, editorial illustration, subtle texture,
forest green and warm paper tones when needed
```

### image_search Keyword Strategy

| Purpose           | Recommended Keywords                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Cover/Background  | `dense forest aerial view`, `ancient forest mist`, `nature research field`               |
| Research scenes   | `scientific fieldwork forest`, `researcher collecting data nature`, `laboratory ecology` |
| Data/charts       | `scientific data visualization minimal`, `ecology diagram infographic`                   |
| Discipline topics | `[主题] ecosystem illustration`, `[主题] scientific concept art`                         |

### Image Generation Prompt Examples

**Cover Background**

```
dense forest canopy aerial view, morning mist, cinematic lighting, muted earth tones, no text, academic research style, 16:9 wide format
```

**Concept Illustration**

```
scientific diagram of [具体主题], minimal ink drawing style, clean lines, warm paper background, academic illustration
```

### Notes

- The Ink Classic style **prioritizes real data charts (ECharts)** over images
- The **first cover slide must** use a full-bleed background image plus semi-transparent ink overlay (§4.G); other section covers may still use photography to enhance atmosphere
- Generated images are suitable for conceptual diagrams and scenes that cannot be photographed
- **Avoid**:cartoon illustrations, bright palettes, and decorative patterns
