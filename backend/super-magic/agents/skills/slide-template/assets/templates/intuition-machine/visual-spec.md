# Cream Infographic (Intuition-Machine) Visual Specification

## 1. Core Design Concept

- **Retro technical print aesthetic**:An aged cream paper base (#F5F0E6) plus subtle paper texture blends retro blueprint aesthetics with modern information clarity, simulating a high-quality technical journal print.
- **Bilingual labeling system**:All key elements must use a bilingual label format of "English term + Chinese translation", providing both an international feel and localized comprehension.
- **Split-screen information density**:Each page contains 3-5 substantive text boxes, using a split layout with visuals on the left/center and text on the right/bottom; information-dense but clearly layered.
- **Consistent black outlines**:All elements use deep charcoal (#2D2D2D) outlines, keeping diagrams visually unified and precise like technical illustrations.

---

## 2. Color Specification

> **v2 adjustment notes**:improves text/background contrast(`--text-primary` changed to `#1A0F0F`, `--text-secondary` changed to `#3A3A3A`, `--text-muted` changed to `#6A5A4A`), `--bg-dark` deepened to `#1E1E1E`, `--maroon` fine-tuned to `#7A2F37`, for better overall readability.

```css
:root {
 /* Background */
 --bg-primary:  #F5F0E6;  /* Aged cream main background */
 --bg-secondary: #EDE7D5;  /* Slightly deeper cream secondary background */
 --bg-card:    #FDFAF4;  /* Light cream card background */
 --bg-dark:    #1E1E1E;  /* Deep charcoal cover (darkened for better contrast) */
 --bg-panel:   rgba(47,115,115,0.07); /* Teal panel background */

 /* Brand colors */
 --teal:     #2F7373;  /* Primary teal - illustration/emphasis */
 --teal-light:  #4A9494;  /* Light teal - secondary emphasis */
 --warm-brown:  #8B7355;  /* Warm brown - secondary decoration */
 --maroon:    #7A2F37;  /* Maroon - Warning/quote */
 --outline:    #2D2D2D;  /* Deep charcoal - all outlines */
 --gold:     #B8860B;  /* Gold - highlight emphasis */

 /* Text (improved contrast) */
 --text-primary:  #1A0F0F; /* Near black - main titles (WCAG AA+) */
 --text-body:   #1A1A1A; /* Near Black - Body text */
 --text-secondary: #3A3A3A; /* Dark gray - secondary text (improved readability) */
 --text-muted:   #6A5A4A; /* Warm brown gray - notes/metadata */
 --text-on-dark:  #F5F0E6; /* Text on dark backgrounds */
 --text-teal:   #2F7373; /* Teal emphasis text */
 --text-maroon:  #7A2F37; /* Maroon emphasis text */

 /* Borders */
 --border-outline: 1.5px solid #2D2D2D;
 --border-light:  rgba(45,45,45,0.12);
 --border-mid:   rgba(45,45,45,0.25);
 --border-teal:  rgba(47,115,115,0.5);
 --border-maroon: rgba(122,47,55,0.5);

 /* Shadows */
 --shadow-sm: 0 1px 6px rgba(45,45,45,0.10);
 --shadow-md: 0 6px 18px rgba(45,45,45,0.12);
 --shadow-lg: 0 12px 36px rgba(45,45,45,0.15);
}
```

---

## 3. Typography Specification

| Level | Size | Weight | Color | Notes |
|------|------|------|------|------|
| Cover title | 60–68px | 700 | --text-primary | All caps, with main title in parentheses |
| Page title | 44–52px | 700 | --text-primary | Retro technical authority |
| Primary bilingual label | 16px | 700 | --text-body | English term |
| Secondary bilingual label | 13px | 400 | --text-muted | Chinese translation in parentheses |
| Body text | 17–20px | 400 | --text-body | Text box content, readable small text |
| KEY QUOTE | 22–26px | 600 | --maroon | Dedicated to bottom quote box |
| Caption/annotation | 13–15px | 400 | --text-muted | font-style: italic |

**Font families:** `'IBM Plex Sans', 'Noto Sans SC', sans-serif`(technical-feel sans serif)

**Font import:**
```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,600;0,700;1,400&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet"/>
```

---

## 4. Decorative Element Specification

**A. Aged cream paper-texture background**:
```css
.slide-container {
 background-color: var(--bg-primary);
 background-image:
  url("data:image/svg+xml,..."), /* Subtle paper texture */
  radial-gradient(ellipse at 30% 40%, rgba(139,115,85,0.06) 0%, transparent 60%);
}
```

**B. Bilingual label**:
```html
<div class="bilingual-label">
 <span class="label-en">CONTEXT WINDOW</span>
 <span class="label-zh">上下文窗口</span>
</div>
```
```css
.bilingual-label {
 display: flex; flex-direction: column; gap: 2px;
 border: var(--border-outline);
 padding: 6px 12px;
 background: var(--bg-card);
}
.label-en { font-size: 14px; font-weight: 700; color: var(--text-body); letter-spacing: 0.05em; }
.label-zh { font-size: 11px; color: var(--text-muted); }
```

**C. KEY QUOTE bottom quote box**:
```html
<div class="key-quote-box">
 <span class="key-quote-label">KEY QUOTE</span>
 <p class="key-quote-text">核心观点引用文字</p>
</div>
```
```css
.key-quote-box {
 border: var(--border-outline);
 border-left: 4px solid var(--maroon);
 padding: 12px 16px;
 background: var(--bg-card);
}
```

**D. Faded background patterns (circuits/gears)**:
```css
.bg-circuit {
 background-image: url("circuit-pattern.svg");
 background-size: 200px;
 opacity: 0.04;
 position: absolute; inset: 0;
}
```

---

## 5. Dedicated Layout Page Types

### Layout 1: Cover(Cover page)
- Deep charcoal background with a centered all-caps main title (parenthetical format)
- Subtitle uses small teal text, with a bilingual information row at the bottom
- Right-side isometric technical illustration (flat 2D style)
- No corner decorations, maintaining a minimal technical feel

### Layout 2: Explainer(concept breakdown page)
- Left 40%: large centered isometric illustration/process diagram
- Right 60%: 3-4 text boxes, each with a title and explanation
- All elements have black outlines
- Bottom KEY QUOTE box

### Layout 3: Bilingual(bilingual labeling page)
- Centered technical diagram (architecture/process diagram)
- Use bilingual labels around the diagram to point to key parts
- Use thin solid connector lines with clear arrow directions
- Bottom legend (English + Chinese)

### Layout 4: Compare(comparison brief page)
- Two columns, distinguished by teal/maroon labels at the top
- Each column has 3-4 dense text boxes
- Thin center divider
- Bottom conclusion KEY QUOTE

### Layout 5: Data(data brief page)
- Top title row + data source note
- Body chart (line/bar, retro palette)
- Three data annotation boxes beside the chart
- Bottom time-range note

### Layout 6: Process(process diagram page)
- Horizontal or vertical process, with teal circular nodes
- Each node has bilingual labels
- Nodes are connected by solid lines with arrows
- Right-side summary text box

### Layout 7: Section(section page)
- Deep charcoal background with centered white section title
- Large section number on the left (semi-transparent watermark)
- Bottom thin teal line + section subtitle

### Layout 8: Closing(closing page)
- Cream background with centered closing text
- Bottom reference list (small text)
- Bottom-right contact information in bilingual format

---

## 6. Corner Radius and Shadow Specification

| Element | Radii | Shadows/outline |
|------|------|-----------|
| All cards | 0px | border: var(--border-outline) |
| Text box | 0px | border: 1px solid var(--border-mid) |
| Bilingual labels | 0px | border: var(--border-outline) |
| Diagram nodes | 50% (circle) or 0px | border: var(--border-outline) |
| KEY QUOTE | 0px | border-left: 4px solid var(--maroon) |
| Chart container | 0px | border: var(--border-outline) |

---

## 7. ECharts Chart Specification

**Palette(retro technical colors)**:
```js
color: ['#2F7373', '#722F37', '#8B7355', '#5D3A3A', '#4A7A7A', '#9A6A4A']
```

**Global configuration**:
```js
const chartDefaults = {
 backgroundColor: 'transparent',
 textStyle: { color: '#4A4A4A', fontFamily: 'IBM Plex Sans, Noto Sans SC, sans-serif', fontSize: 12 },
 grid: { top: 40, right: 20, bottom: 40, left: 56, containLabel: true }
};
```

**Line chart (technical trends) example**:
```js
option = {
 ...chartDefaults,
 xAxis: { type: 'category', data: ['2020','2021','2022','2023','2024'],
  axisLine: { lineStyle: { color: '#2D2D2D', width: 1.5 } },
  axisLabel: { color: '#4A4A4A', fontSize: 11 } },
 yAxis: { type: 'value',
  splitLine: { lineStyle: { color: 'rgba(45,45,45,0.12)', type: 'dashed' } },
  axisLabel: { color: '#4A4A4A' } },
 series: [
  { name: 'METRIC A', type: 'line', data: [12,28,45,68,95],
   lineStyle: { color: '#2F7373', width: 2.5 },
   itemStyle: { color: '#2F7373', borderColor: '#2D2D2D', borderWidth: 1.5 },
   symbol: 'circle', symbolSize: 7 },
  { name: 'METRIC B', type: 'line', data: [8,15,28,42,65],
   lineStyle: { color: '#722F37', width: 2, type: 'dashed' },
   itemStyle: { color: '#722F37' }, symbol: 'rect', symbolSize: 6 }
 ]
};
```

**Bar chart example**:
```js
series: [{ type: 'bar', barWidth: '50%', data: [42,68,55,80,72],
 itemStyle: { color: '#2F7373', borderColor: '#2D2D2D', borderWidth: 1.5, borderRadius: 0 },
 label: { show: true, position: 'top', color: '#4A4A4A', fontSize: 11, fontWeight: 600 } }]
```

---

## 9. Extended Component Specification (new in v2)

### A. Badge `.im-badge`
```html
<span class="im-badge teal">PRODUCTION</span>
<span class="im-badge maroon">DEPRECATED</span>
<span class="im-badge gold">RECOMMENDED</span>
<span class="im-badge outline">OPTIONAL</span>
```
Color variants:`teal` / `maroon` / `brown` / `gold` / `dark` / `outline`

### B. Callout `.im-callout`
```html
<div class="im-callout teal">
 <div class="im-callout-icon">💡</div>
 <div class="im-callout-body">
  <div class="im-callout-title">INSIGHT · Insight</div>
  <div class="im-callout-text">Body text content</div>
 </div>
</div>
```
Color variants:`teal`(Insight)/ `maroon`(Warning)/ `gold`(Highlight)/ None(default)

### C. Timeline `.im-timeline`
```html
<div class="im-timeline">
 <div class="im-timeline-item">
  <div class="im-timeline-line">
   <div class="im-timeline-dot"></div>
   <div class="im-timeline-connector"></div>
  </div>
  <div class="im-timeline-content">
   <div class="im-timeline-date">2024 · MILESTONE</div>
   <div class="im-timeline-title">Event title</div>
   <div class="im-timeline-desc">Event description</div>
  </div>
 </div>
 <!-- Omit on the final item .im-timeline-connector -->
</div>
```

### D. Comparison matrix `.im-matrix`
```html
<table class="im-matrix">
 <thead><tr>
  <th>FEATURE</th><th>Option A</th><th>Option B</th>
 </tr></thead>
 <tbody><tr>
  <td>Feature Name</td>
  <td><span class="check">✓</span></td>
  <td><span class="cross">✗</span></td>
 </tr></tbody>
</table>
```
Status symbols: `.check` (supported, teal) / `.cross` (not supported, maroon) / `.partial` (partial, warm brown)

### E. Stat card `.im-stat-card`
```html
<div class="im-stat-card">
 <div class="im-stat-header">
  <div class="im-stat-label">METRIC NAME</div>
  <div class="im-stat-badge up">↑ +18%</div>
 </div>
 <div class="im-stat-value">2.4K</div>
 <div class="im-stat-sub">Unit description</div>
</div>
```
Trend badges:`.up`(teal positive)/ `.down`(maroon negative)

### F. Accordion `.im-accordion-item`
```html
<div class="im-accordion-item" id="acc1">
 <div class="im-accordion-header" onclick="toggleAccordion('acc1')">
  <span>SECTION TITLE</span>
  <span class="im-accordion-arrow">▼</span>
 </div>
 <div class="im-accordion-body">Content text</div>
</div>
```
JS:`function toggleAccordion(id){ document.getElementById(id).classList.toggle('open'); }`

### G. Tabs `.im-tabs`
```html
<div class="im-tabs">
 <div class="im-tab active" data-tab="panel-a">TAB A</div>
 <div class="im-tab" data-tab="panel-b">TAB B</div>
</div>
<div class="im-tab-panel active" id="panel-a">内容A</div>
<div class="im-tab-panel" id="panel-b">内容B</div>
```

### H. Connector flow `.im-connector`
```html
<div class="im-connector">
 <div class="im-connector-node dark">INPUT</div>
 <div class="im-connector-arrow" style="position:relative">
  <span class="im-connector-label">process</span>
 </div>
 <div class="im-connector-node teal">OUTPUT</div>
</div>
```

### I. Tooltip `.im-tooltip-wrap`
```html
<span class="im-tooltip-wrap">
 <span style="border-bottom:1.5px dashed var(--teal);cursor:help">术语</span>
 <span class="im-tooltip">Explanation text</span>
</span>
```

---

## 10. Legend Specification

```html
<div class="im-legend">
 <div class="im-legend-item">
  <div class="im-legend-dot" style="background:var(--teal)"></div>
  Primary · Primary metric
 </div>
 <div class="im-legend-item">
  <div class="im-legend-dot" style="background:var(--maroon)"></div>
  Warning · Warning line
 </div>
</div>
```

**Style Keywords**:
`technical infographic, isometric 2D illustration, clean line art, aged paper background, teal and brown palette, bilingual labels, blueprint aesthetic, retro technical print`

**image_search Strategy**:
- Add these search terms:`technical infographic illustration`, `isometric diagram`, `blueprint style diagram`
- Prefer flat 2D technical diagrams with leader lines and labels
- Avoid 3D rendering and photorealistic styles

**generate_images Example Prompt**:
```
clean 2D technical infographic illustration of [具体主题], isometric or flat style, teal #2F7373 and warm brown palette, aged cream paper background #F5F0E6, dark outline on all elements, bilingual label style, retro technical print aesthetic, no gradients, precise line art, educational diagram quality
```
