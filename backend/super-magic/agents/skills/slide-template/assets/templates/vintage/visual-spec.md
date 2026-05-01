# Parchment Scroll (Vintage) Visual Spec

## 1. Core Design Concept

- **Aged paper foundation**: A parchment-yellow base (#F5E6D3) simulates the texture of historical documents, while crease textures and worn edges create a sense of accumulated time.
- **Explorer journal aesthetic**: Antique map elements, compass ornaments, handwritten annotations, and page-frame ornaments evoke a spirit of exploration and cultural heritage.
- **Unified warm brown system**: Deep brown primary text and medium brown secondary text, with forest green/navy blue/wine red/gold accents; cool tones are strictly excluded.
- **Authoritative serif narrative**: Headings use Playfair Display and body copy uses EB Garamond to convey historical authority and elegance. The preview uses a Silk Road narrative to demonstrate historical, museum, travel, and heritage storytelling.

---

## 2. Color Spec

```css
:root {
  /* Background */
  --bg-primary: #f5e6d3; /* Aged parchment primary background */
  --bg-secondary: #fff8dc; /* Tan cream secondary background */
  --bg-card: #fdf6ec; /* Light cream card base */
  --bg-dark: #2c1a0e; /* Dark brown cover background */
  --bg-dark-2: #3d2914; /* Secondary dark brown cover background */
  --bg-parchment: #f0d9be; /* Parchment texture tone */

  /* Accent colors */
  --forest-green: #2d5a3d; /* Forest green - northern routes/nature */
  --navy-blue: #1e3a5f; /* Navy blue - central routes/water */
  --wine-red: #722f37; /* Wine red - southern routes/emphasis */
  --gold: #c9a227; /* Gold - highlights/compass */
  --ink-dark: #3d3d3d; /* Brown-black ink - details */
  --rust: #8b4513; /* Rust brown - aged trade/heritage accents */

  /* Text */
  --text-primary: #3d2914; /* Deep brown - primary text */
  --text-secondary: #6b4423; /* Medium brown - secondary text */
  --text-muted: #9c7a5a; /* Light brown - annotations */
  --text-on-dark: #f5e6d3; /* Text on dark backgrounds */
  --text-gold: #c9a227; /* Gold emphasis text */
  --text-green: #2d5a3d; /* Green emphasis text */
  --text-navy: #1e3a5f; /* Navy emphasis text */
  --text-wine: #722f37; /* Wine emphasis text */

  /* Borders and lines */
  --border-light: rgba(61, 41, 20, 0.15); /* Light brown border */
  --border-mid: rgba(61, 41, 20, 0.3); /* Medium brown border */
  --border-dark: rgba(61, 41, 20, 0.5); /* Dark brown border */
  --border-gold: rgba(201, 162, 39, 0.6); /* Gold border */
  --border-gold-bright: rgba(201, 162, 39, 0.9);

  /* Shadows */
  --shadow-sm: 0 1px 6px rgba(61, 41, 20, 0.12);
  --shadow-md: 0 6px 24px rgba(61, 41, 20, 0.15);
  --shadow-lg: 0 12px 48px rgba(61, 41, 20, 0.2);

  /* Font sizes */
  --font-hero: 102px;
  --font-h1: 78px;
  --font-h2: 57px;
  --font-h3: 39px;
  --font-body: 28px;
  --font-small: 21px;
  --font-kpi: 84px;
  --font-tag: 20px;

  /* Fonts */
  --font-serif: "Playfair Display", "EB Garamond", "Noto Serif SC", serif;
  --font-body-f: "EB Garamond", "Noto Serif SC", serif;
  --font-sans: "Noto Sans SC", sans-serif;
}
```

---

## 3. Typography Spec

| Level | Size | Weight | Color | Notes |
| --- | --- | --- | --- | --- |
| Cover hero title | 64-72px | 700 | --text-on-dark | Playfair Display, elegant serif |
| Page main title | 44-52px | 700 | --text-primary | Playfair Display |
| Section heading | 34-40px | 600 | --text-primary | With gold decorative line |
| Subtitle | 24-28px | 400 | --text-secondary | EB Garamond italic |
| Body | 18-22px | 400 | --text-secondary | line-height: 1.8 |
| Handwritten annotation | 16-18px | 400 | --text-muted | font-style: italic |
| Map label | 13-15px | 600 | --navy-blue | letter-spacing: 0.08em |
| Caption/source | 13-15px | 400 | --text-muted | font-style: italic |

**Font family:** `'Playfair Display', 'EB Garamond', 'Noto Serif SC', serif`

**Font import:**

```html
<link
  href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Noto+Serif+SC:wght@400;600;700&display=swap"
  rel="stylesheet"
/>
```

---

## 4. Decorative Element Spec

**A. Parchment texture background**:

```css
.slide-container {
  background-color: var(--bg-primary);
  background-image:
    radial-gradient(
      ellipse at 20% 30%,
      rgba(180, 120, 60, 0.08) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse at 80% 70%,
      rgba(140, 90, 40, 0.06) 0%,
      transparent 50%
    );
}
```

**B. Vintage border decoration**:

```html
<div class="vintage-frame">Content</div>
```

```css
.vintage-frame {
  border: 2px solid var(--border-gold);
  padding: 20px 24px;
  position: relative;
}
.vintage-frame::before,
.vintage-frame::after {
  content: "◆";
  position: absolute;
  color: var(--gold);
  font-size: 14px;
}
.vintage-frame::before {
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
}
.vintage-frame::after {
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
}
```

**C. Gold title decoration line**:

```html
<div class="vintage-title-deco">Section Title</div>
```

```css
.vintage-title-deco {
  position: relative;
  padding-bottom: 12px;
  margin-bottom: 20px;
}
.vintage-title-deco::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  width: 60px;
  height: 2px;
  background: var(--gold);
}
```

**D. Handwritten annotation label**:

```html
<span class="annotation">Note: key discovery</span>
```

```css
.annotation {
  font-family: "EB Garamond", serif;
  font-style: italic;
  font-size: 15px;
  color: var(--wine-red);
  border-bottom: 1px solid var(--wine-red);
  padding-bottom: 2px;
}
```

---

## 5. Dedicated 10-Page Layout System

### P01 Cover

- Dark brown cover background with simulated background image and gradient overlay.
- Four L-shaped gold corner ornaments and a centered gold-framed title block.
- Silk Road title, italic historical subtitle, metadata line, and bottom multicolor hairline.

### P02 Chapter

- Dark brown section divider with radial texture, large Roman numeral, Latin chapter label, and gold title frame.
- Use for major chapter transitions such as "Opening the Western Regions."

### P03 Banner + Content

- Top cinematic banner with dark overlay and historical title block.
- Bottom three-column system: narrative, KPI/data cards, and historical significance list.
- Route strip uses small nodes and thin gold lines.

### P04 Map + Routes

- Light parchment page with shared page header.
- Left side uses an SVG or image map; right side lists route cards.
- Route colors should stay semantically consistent: green for northern steppe, navy for central oasis, wine red for southern mountain.

### P05 Specimen Grid

- Museum catalog layout with six equal trade-good cards.
- Each card contains an item number, icon/illustration, item name, Latin-style label, short description, and direction badge.
- Designed for products, artifacts, species, or historical objects.

### P06 Two-Column Compare

- Two-column cultural exchange layout with East-to-West and West-to-East flows.
- Uses a gold vertical divider and item rows with icons, titles, and short descriptions.
- Bottom image strip can show a mural, exhibit, or environmental texture.

### P07 Historical Timeline

- Horizontal timeline with alternating top/bottom nodes.
- Nodes use gold diamonds, year labels, and concise event names.
- Footer summarizes the time span with italic source-style text.

### P08 City Cards

- Three-column city or location card layout.
- Each card includes a large background numeral, location label, title, image placeholder, narrative description, and tags.
- Suitable for hubs, milestones, people, or institutions.

### P09 Chapter Variant

- Dark chapter divider variant with alternate radial texture and Chapter Two content.
- Use for second-level transitions or topic resets.

### P10 Back Cover

- Parchment closing page with compass ornament, framed closing quote, and bottom KPI row.
- Uses top and bottom multicolor hairlines plus large corner ornaments.

---

## 6. Border Radius and Shadow Spec

| Element          | Radius        | Shadow      |
| ---------------- | ------------- | ----------- |
| Content card     | 2px           | --shadow-sm |
| Vintage frame    | 0px           | --shadow-md |
| Specimen card    | 2px           | --shadow-md |
| Timeline node    | 0px (diamond) | none        |
| Annotation label | 0px           | none        |
| Chart container  | 2px           | --shadow-sm |

---

## 7. ECharts Chart Spec

**Palette (retro warm colors)**:

```js
color: ["#2D5A3D", "#1E3A5F", "#722F37", "#C9A227", "#6B4423", "#9C7A5A"];
```

**Global configuration**:

```js
const chartDefaults = {
  backgroundColor: "transparent",
  textStyle: {
    color: "#6B4423",
    fontFamily: "EB Garamond, Noto Serif SC, serif",
    fontSize: 13,
  },
  grid: { top: 40, right: 20, bottom: 40, left: 50, containLabel: true },
};
```

**Bar chart example**:

```js
option = {
  ...chartDefaults,
  xAxis: {
    type: "category",
    data: ["1850", "1900", "1950", "2000", "2024"],
    axisLine: { lineStyle: { color: "rgba(61,41,20,0.3)" } },
    axisLabel: { color: "#6B4423", fontFamily: "EB Garamond, serif" },
  },
  yAxis: {
    type: "value",
    splitLine: { lineStyle: { color: "rgba(61,41,20,0.1)" } },
    axisLabel: { color: "#6B4423" },
  },
  series: [
    {
      type: "bar",
      data: [12, 28, 45, 68, 85],
      barWidth: "50%",
      itemStyle: { color: "#2D5A3D", borderRadius: [2, 2, 0, 0] },
    },
  ],
};
```

**Line chart example**:

```js
series: [
  {
    type: "line",
    smooth: false,
    data: [10, 25, 38, 52, 70, 85],
    lineStyle: { color: "#1E3A5F", width: 2.5 },
    itemStyle: { color: "#1E3A5F" },
    symbol: "diamond",
    symbolSize: 8,
  },
];
```

**Pie chart example**:

```js
series: [
  {
    type: "pie",
    radius: ["30%", "60%"],
    center: ["50%", "55%"],
    itemStyle: { borderColor: "#F5E6D3", borderWidth: 3 },
    label: { color: "#3D2914", fontSize: 13, fontFamily: "EB Garamond, serif" },
    data: [
      { value: 35, name: "Europe", itemStyle: { color: "#2D5A3D" } },
      { value: 28, name: "Asia", itemStyle: { color: "#1E3A5F" } },
      { value: 22, name: "Americas", itemStyle: { color: "#722F37" } },
      { value: 15, name: "Other", itemStyle: { color: "#C9A227" } },
    ],
  },
];
```

---

## 8. AI Illustration Generation Spec

**Style keywords**: `vintage illustration, aged paper texture, antique map style, sepia tones, hand-drawn engraving, explorer journal, botanical specimen drawing, warm brown palette`

**image_search strategy**:

- Add these search terms: `vintage illustration`, `antique map`, `sepia botanical drawing`
- Prefer vintage illustrations with warm brown tones and hand-drawn engraving styles
- Avoid modern digital aesthetics; prefer historical document/explorer journal styles

**generate_image example prompt**:

```
vintage illustration of [specific subject], aged parchment paper background, sepia and warm brown tones, antique engraving style, hand-drawn details, explorer journal aesthetic, forest green and navy blue accents, gold highlights, no modern elements, historical document feel
```

---

## 9. Advanced Components Added in 2026 Redesign

- **Archive label (`archive-label`)**: catalogue-style metadata component for figures, events, artifacts, and historical places.
- **Wax seal (`archive-seal`)**: circular emphasis mark for authority, collection stamps, chapter seals, and document provenance.
- **Route map card (`route-map-card`)**: dotted historical route diagram for trade paths, travel routes, expedition timelines, and cultural exchange.
- **Ledger table (`ledger-table`)**: dark archival table for goods, origin, route, years, or source evidence.
- **Field note (`field-note`)**: italic observational note for recovered evidence, historian commentary, or travel journal excerpts.
- **Specimen plate (`specimen-strip`, `specimen-mini`)**: small artifact gallery for materials, coins, maps, textiles, and symbolic objects.
