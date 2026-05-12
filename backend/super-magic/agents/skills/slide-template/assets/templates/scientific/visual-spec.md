# Scientific Diagram Visual Spec

## 1. Core Design Concept

- **Textbook-level precision**: Off-white backgrounds and dark slate text emulate academic journal figure quality, aiming for clean, precise, professional scientific communication.
- **Pathways as narrative**: Use color to distinguish different paths or systems (teal primary pathway, blue secondary pathway, purple tertiary pathway), while arrows make direction explicit so complex flows are easy to read.
- **Annotation-driven understanding**: Every component must be clearly labeled. Chemical symbols, molecule names, and step numbers are always explicit, never left for readers to infer.
- **Authoritative serif tone**: Titles use serif type to create an academic journal feel, while annotations use sans-serif type for readability at small sizes.

---

## 2. Color Specification

```css
:root {
  /* Backgrounds */
  --bg-primary:    #FAFAFA;   /* Off-white primary background */
  --bg-secondary:  #F0F4F8;   /* Light blue-gray secondary background */
  --bg-card:       #FFFFFF;   /* White card background */
  --bg-dark:       #1E293B;   /* Dark cover / section background */
  --bg-panel:      #F8FAFC;   /* Panel background */

  /* Scientific pathway colors */
  --pathway-1:     #0D9488;   /* Teal - primary path */
  --pathway-2:     #3B82F6;   /* Blue - secondary path */
  --pathway-3:     #8B5CF6;   /* Purple - tertiary path */
  --membrane:      #F59E0B;   /* Amber - membrane structures */
  --alert:         #EF4444;   /* Red - key molecules / alerts */
  --product:       #22C55E;   /* Green - products / output */

  /* Text */
  --text-primary:   #1E293B;  /* Dark slate - primary text */
  --text-secondary: #475569;  /* Mid gray - labels / descriptions */
  --text-muted:     #94A3B8;  /* Light gray - captions */
  --text-on-dark:   #F8FAFC;  /* Text on dark backgrounds */

  /* Borders and lines */
  --border-light:   #E2E8F0;  /* Light border */
  --border-mid:     #CBD5E1;  /* Medium border */
  --border-dark:    #94A3B8;  /* Dark border */
  --arrow-color:    #475569;  /* Arrow color */

  /* Shadows */
  --shadow-sm:  0 1px 3px rgba(0,0,0,0.06);
  --shadow-md:  0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg:  0 8px 24px rgba(0,0,0,0.10);
}
```

---

## 3. Typography Specification

| Level | Size | Weight | Color | Notes |
|------|------|------|------|------|
| Cover title | 60-68px | 700 | --text-on-dark | Serif, academic authority |
| Page title | 40-48px | 700 | --text-primary | Serif |
| Section title | 32-38px | 600 | --text-primary | With teal left rule |
| Subtitle | 24-28px | 500 | --text-secondary | Sans-serif |
| Body | 18-22px | 400 | --text-secondary | `line-height: 1.75` |
| Annotation text | 14-16px | 400 | --text-secondary | Sans-serif, clear at small sizes |
| Step number | 20-24px | 700 | --pathway-1 | Circular number frame |
| Caption / source | 13-15px | 400 | --text-muted | `font-style: italic` |

**Font family:** `'Lora', 'Noto Serif SC', 'Noto Sans SC', serif` (Lora serif for titles, Noto Sans SC for body text and annotations)

**Font import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet"/>
```

---

## 4. Decorative Element Specification

**A. Subtle Paper Texture Background:**
```css
body {
  background-color: var(--bg-primary);
  background-image: url("data:image/svg+xml,..."); /* Very fine paper texture */
}
```

**B. Pathway Color Annotation Box:**
```html
<div class="pathway-box pathway-1">主要通路</div>
```
```css
.pathway-box {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 14px; font-weight: 600;
}
.pathway-1 { background: rgba(13,148,136,0.1); color: #0D9488; border: 1.5px solid #0D9488; }
.pathway-2 { background: rgba(59,130,246,0.1); color: #3B82F6; border: 1.5px solid #3B82F6; }
.pathway-3 { background: rgba(139,92,246,0.1); color: #8B5CF6; border: 1.5px solid #8B5CF6; }
```

**C. Step Number Circle:**
```html
<div class="sci-step-num">1</div>
```
```css
.sci-step-num {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: var(--pathway-1);
  color: white;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 700;
  flex-shrink: 0;
}
```

**D. Scientific Figure Divider with Label:**
```html
<div class="sci-section-label">STEP 01 — 信号传导</div>
```
```css
.sci-section-label {
  font-size: 12px; font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  border-bottom: 2px solid var(--border-light);
  padding-bottom: 8px;
  margin-bottom: 16px;
}
```

---

## 5. Dedicated Layout Types

### Layout 1: Cover
- Dark background (`--bg-dark`) with a thin top divider
- Main title in serif type, subtitle in sans-serif type
- Scientific illustration on the right, such as a pathway diagram or molecular structure
- Author / institution information row at the bottom

### Layout 2: Pathway
- Horizontal flow with colored circular nodes (teal / blue / purple distinguish paths)
- Arrowed connector lines between nodes
- Each node has a name and brief description underneath
- Right-side info box summarizes key elements

### Layout 3: Process
- Vertical step sequence with numbered circles on the left (1 -> N)
- Each step contains a title, description, and optional chemical symbol
- Illustration or molecular structure diagram on the right

### Layout 4: Compare
- Two-column layout with pathway-color tags at the top for distinction
- Table or bullet list with precisely labeled differences
- Bottom conclusion summary row with bordered emphasis

### Layout 5: Data
- Top title + data source annotation
- Main ECharts chart (line / bar / scatter)
- Key data annotation boxes beside the chart

### Layout 6: Diagram
- Large central schematic, built with SVG or HTML/CSS
- Annotation lines around it pointing to key structures
- Bottom legend explaining color-to-name mapping

### Layout 7: Section
- Dark background with large translucent section number on the left
- Section title and core question on the right
- Bottom thin line + page number

### Layout 8: Closing
- Clean white background with centered conclusion / acknowledgements
- References list in small text using `--text-muted`
- Institution logo area at the bottom

---

## 6. Radius and Shadow Specification

| Element | Radius | Shadow |
|------|------|------|
| Content cards | 6px | --shadow-sm |
| Pathway nodes | 50% | --shadow-sm |
| Step numbers | 50% | none |
| Info boxes | 4px | --shadow-md |
| Chart containers | 4px | --shadow-sm |
| Annotation labels | 4px | none |

---

## 7. ECharts Chart Specification

**Palette (scientific pathway colors):**
```js
color: ['#0D9488', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#22C55E']
```

**Global Configuration:**
```js
const chartDefaults = {
  backgroundColor: 'transparent',
  textStyle: { color: '#475569', fontFamily: 'Noto Sans SC, sans-serif', fontSize: 13 },
  grid: { top: 48, right: 24, bottom: 48, left: 56, containLabel: true }
};
```

**Line Chart Example (Pathway Change):**
```js
option = {
  ...chartDefaults,
  xAxis: { type: 'category', data: ['0min','5min','10min','20min','30min'],
    axisLine: { lineStyle: { color: '#CBD5E1' } },
    axisLabel: { color: '#475569', fontSize: 12 } },
  yAxis: { type: 'value', name: 'Concentration (μM)',
    nameTextStyle: { color: '#94A3B8', fontSize: 11 },
    splitLine: { lineStyle: { color: '#E2E8F0' } },
    axisLabel: { color: '#475569' } },
  series: [
    { name: 'Pathway A', type: 'line', smooth: true, data: [0,45,72,88,95],
      lineStyle: { color: '#0D9488', width: 2.5 },
      itemStyle: { color: '#0D9488' }, symbol: 'circle', symbolSize: 7 },
    { name: 'Pathway B', type: 'line', smooth: true, data: [0,20,38,55,60],
      lineStyle: { color: '#3B82F6', width: 2.5 },
      itemStyle: { color: '#3B82F6' }, symbol: 'circle', symbolSize: 7 }
  ]
};
```

**Bar Chart Example:**
```js
series: [{ type: 'bar', barWidth: '45%', data: [65,82,74,91,58],
  itemStyle: { color: '#0D9488', borderRadius: [3,3,0,0] } }]
```

**Scatter Plot Example:**
```js
series: [{ type: 'scatter', symbolSize: 10, data: [[2.3,4.5],[3.1,6.2],[4.8,5.9],[5.2,8.1]],
  itemStyle: { color: '#8B5CF6', opacity: 0.8 } }]
```

---

## 8. AI Illustration Generation Specification

**Style Keywords:**
`scientific illustration, textbook diagram, academic figure, clean 2D biology pathway, labeled diagram, educational infographic, white background, precise line art`

**image_search Strategy:**
- Add these search terms: `scientific diagram`, `biology pathway illustration`, `academic textbook figure`
- Prefer scientific illustrations with white backgrounds, clean lines, and labels
- Avoid photorealistic styles; prefer textbook-level illustrations

**generate_images Example Prompt:**
```
clean scientific illustration of [具体主题], textbook diagram style, white background, labeled components, precise line art, academic figure quality, teal and blue color scheme, arrows showing flow direction, educational infographic aesthetic, no gradients, vector style
```
