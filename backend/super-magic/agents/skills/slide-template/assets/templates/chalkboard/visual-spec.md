# Chalkboard Visual Spec

## 1. Core Design Principles

- **Blackboard texture as the soul:** Deep black and deep green-black backgrounds simulate a real chalkboard, paired with chalk-textured fonts and hand-drawn doodles to evoke classic classroom memories.
- **Layered chalk colors:** Chalk white carries primary text, while chalk yellow, pink, blue, and green serve as accents. Color separates information hierarchy without shadows or gradients.
- **Imperfection as an aesthetic:** Deliberately preserve hand-drawn irregularity: slanted lines, doodle arrows, and circled annotations that convey warmth and authenticity.
- **Teaching narrative structure:** Layouts mimic blackboard writing logic, with information flowing left to right and top to bottom, suitable for explaining knowledge and walking through processes.

---

## 2. Color Specifications

```css
:root {
  /* Backgrounds */
  --bg-primary:      #1A1A1A;   /* Blackboard black main background */
  --bg-green:        #1C2B1C;   /* Traditional green board background */
  --bg-card:         #252525;   /* Deep black card background */
  --bg-highlight:    #2A2A2A;   /* Highlight area background */

  /* Chalk colors */
  --chalk-white:     #F5F5F5;   /* Chalk white - primary text */
  --chalk-yellow:    #FFE566;   /* Chalk yellow - highlight/emphasis */
  --chalk-pink:      #FF9999;   /* Chalk pink - secondary highlight */
  --chalk-blue:      #66B3FF;   /* Chalk blue - charts/links */
  --chalk-green:     #90EE90;   /* Chalk green - success/nature */
  --chalk-orange:    #FFB366;   /* Chalk orange - warning/energy */

  /* Text */
  --text-primary:    #F5F5F5;   /* Chalk white primary text */
  --text-secondary:  #D4D4D4;   /* Light gray secondary text */
  --text-muted:      #888888;   /* Dark gray notes */
  --text-yellow:     #FFE566;   /* Yellow emphasis text */

  /* Borders and lines */
  --border-chalk:    rgba(245,245,245,0.25);  /* Chalk border */
  --border-bright:   rgba(245,245,245,0.5);   /* Bright chalk border */
  --line-dashed:     2px dashed rgba(245,245,245,0.4); /* Dashed line */

  /* Shadows (chalk glow) */
  --shadow-chalk:    0 0 8px rgba(255,229,102,0.3);
  --shadow-glow:     0 0 16px rgba(102,179,255,0.4);
}
```

---

## 3. Typography Specifications

| Level | Size | Weight | Color | Notes |
|------|------|------|------|------|
| Cover title | 64–72px | 700 | --chalk-white | letter-spacing: 0.02em |
| Page title | 44–52px | 700 | --chalk-yellow | with chalk underline decoration |
| Section title | 36–42px | 600 | --chalk-white | with hand-drawn circle/box |
| Subtitle | 26–30px | 500 | --chalk-blue | |
| Body | 20–24px | 400 | --text-secondary | line-height: 1.8 |
| Data highlight | 48–64px | 700 | --chalk-yellow | KPI only |
| Hand-drawn annotation | 16–18px | 400 | --chalk-pink | font-style: italic |
| Caption/source | 14–16px | 400 | --text-muted | |

**Font family:** `'Caveat', 'ZCOOL KuaiLe', 'Noto Sans SC', cursive`(use Caveat for handwritten headings and Noto Sans SC for body text)

**Font import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet"/>
```

---

## 4. Decorative Element Specifications

**A. Blackboard texture background (global):**
```css
body {
  background-color: var(--bg-primary);
  background-image:
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(255,255,255,0.015) 2px,
      rgba(255,255,255,0.015) 4px
    );
}
```

**B. Chalk underline:**
```html
<div class="chalk-underline">重要概念</div>
```
```css
.chalk-underline {
  display: inline-block;
  border-bottom: 3px solid var(--chalk-yellow);
  padding-bottom: 4px;
  filter: blur(0.3px);
}
```

**C. Hand-drawn circle annotation:**
```html
<span class="chalk-circle">核心</span>
```
```css
.chalk-circle {
  display: inline-block;
  border: 2.5px solid var(--chalk-pink);
  border-radius: 50%;
  padding: 4px 12px;
  filter: blur(0.2px);
  transform: rotate(-1deg);
}
```

**D. Doodle arrow (SVG):**
```html
<svg class="doodle-arrow" viewBox="0 0 60 30" width="60" height="30">
  <path d="M4,15 Q20,8 48,15 M40,8 L50,15 L40,22" 
        stroke="#FFE566" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</svg>
```

**E. Chalk eraser smudge effect (decorative):**
```css
.chalk-smudge::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse, rgba(255,255,255,0.04) 0%, transparent 70%);
  pointer-events: none;
}
```

---

## 5. Dedicated Layout Types

### Layout 1: Cover
- Full dark chalkboard background, with a large centered title in the Caveat handwritten font
- Subtitle uses chalk blue; bottom signature uses small chalk-white text
- Chalk doodle stars and dots decorate the four corners
- Optional: yellow "TODAY'S TOPIC" annotation box in the upper-left corner

### Layout 2: Concept
- Large keyword on the left (chalk yellow, circled)
- 3-4 explanatory points on the right (chalk white, with hand-drawn bullets ✦ ✧ ★)
- Hand-drawn divider plus caption at the bottom

### Layout 3: Process
- Horizontal or vertical process; nodes use chalk circles, with different colors distinguishing steps
- Nodes are connected with hand-drawn arrows in an SVG doodle style
- Small explanatory text under each node

### Layout 4: Compare
- Blackboard split into left and right columns, separated by a dashed line
- Left-column heading uses chalk red/orange; right-column heading uses chalk blue/green
- Each side lists its points, with a summary row at the bottom

### Layout 5: Data
- Large KPI number at the top (chalk yellow, 64-72px)
- ECharts chart below, using the chalk palette
- Chart annotations use small hand-drawn-style text

### Layout 6: Quiz
- Large question-mark decoration at the top (chalk white, translucent)
- Central question text (chalk yellow, large)
- Bottom "ANSWER:" area is filled in chalk green

### Layout 7: Section
- Deep green chalkboard background (--bg-green)
- Centered section number (oversized, chalk orange, translucent watermark feel)
- Centered section title with a hand-drawn box

### Layout 8: Closing
- Full chalkboard background with large centered "THANK YOU" text (Caveat)
- Chalk-colored doodle decorations scattered around (stars, circles, arrows)
- Contact information uses small chalk-blue text

---

## 6. Radius and Shadow Specifications

| Element | Radius | Shadow/Effect |
|------|------|-----------|
| Content card | 4px | border: 1px solid rgba(245,245,245,0.2) |
| Emphasis box | 2px | border: 2px dashed var(--chalk-yellow) |
| KPI number block | 0px | text-shadow: 0 0 12px rgba(255,229,102,0.5) |
| Section number | 0px | opacity: 0.15, oversized watermark |
| Hand-drawn circle | 50% | filter: blur(0.2px) |
| Chart container | 4px | border: 1px solid var(--border-chalk) |

---

## 7. ECharts Chart Specifications

**Palette (chalk colors):**
```js
color: ['#FFE566', '#66B3FF', '#90EE90', '#FF9999', '#FFB366', '#D4A0FF']
```

**Global config:**
```js
const chartDefaults = {
  backgroundColor: 'transparent',
  textStyle: { color: '#D4D4D4', fontFamily: 'Noto Sans SC, sans-serif', fontSize: 13 },
  grid: { top: 40, right: 20, bottom: 40, left: 50, containLabel: true }
};
```

**Bar chart example:**
```js
option = {
  ...chartDefaults,
  xAxis: { type: 'category', data: ['Q1','Q2','Q3','Q4'],
    axisLine: { lineStyle: { color: 'rgba(245,245,245,0.3)' } },
    axisLabel: { color: '#D4D4D4' } },
  yAxis: { type: 'value',
    splitLine: { lineStyle: { color: 'rgba(245,245,245,0.1)', type: 'dashed' } },
    axisLabel: { color: '#D4D4D4' } },
  series: [{ type: 'bar', data: [42,68,55,80], barWidth: '50%',
    itemStyle: { color: '#FFE566', borderRadius: [2,2,0,0] } }]
};
```

**Line chart example:**
```js
series: [{ type: 'line', smooth: true, data: [30,55,45,70,60,85],
  lineStyle: { color: '#66B3FF', width: 3 },
  areaStyle: { color: 'rgba(102,179,255,0.15)' },
  symbol: 'circle', symbolSize: 8,
  itemStyle: { color: '#66B3FF', borderColor: '#1A1A1A', borderWidth: 2 } }]
```

**Pie chart example:**
```js
series: [{ type: 'pie', radius: ['35%','65%'], center: ['50%','55%'],
  itemStyle: { borderColor: '#1A1A1A', borderWidth: 2 },
  label: { color: '#F5F5F5', fontSize: 13 },
  data: [
    { value: 35, name: '模块A', itemStyle: { color: '#FFE566' } },
    { value: 28, name: '模块B', itemStyle: { color: '#66B3FF' } },
    { value: 22, name: '模块C', itemStyle: { color: '#90EE90' } },
    { value: 15, name: '模块D', itemStyle: { color: '#FF9999' } }
  ] }]
```

---

## 8. AI Illustration Generation Specifications

**Style keywords**：
`chalkboard illustration, chalk drawing style, white chalk on dark background, hand-drawn sketch, rough texture, educational doodle, blackboard art`

**image_search strategy**：
- Add these search terms: `chalkboard drawing`, `chalk art illustration`, `blackboard sketch`
- Prioritize illustrations with dark backgrounds and white or colored chalk styles
- Avoid photorealistic styles; prioritize a hand-drawn sketch feel

**generate_image example prompt**：
```
chalk drawing illustration of [具体主题] on dark blackboard background, white and yellow chalk lines, hand-drawn sketch style, rough imperfect strokes, educational doodle aesthetic, visible chalk texture, no gradients, flat chalk art
```
