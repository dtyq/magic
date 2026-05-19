# Macaron Doodle (Hand-Drawn-Edu) Visual Specification

## 1. Core Design Concept

- **Hand-drawn warmth**:All lines, borders, and shapes have a slight wobble, simulating marker or pen drawing; avoid perfect geometry and preserve a human touch.
- **Macaron color-block sections**:Use sky blue, mint, lavender, and peach macaron blocks as information section containers, one color per section, for clear and uncluttered visuals.
- **Warm cream background**:Use warm cream #F5F0E8 as the background to simulate high-quality drawing paper and avoid the cold stiffness of pure white.
- **Cartoon character accents**:Add simple stick figures, doodled arrows, and star decorations where appropriate to make educational explainers friendlier and more playful.

---

## 2. Color Specification

```css
:root {
 /* Background */
 --bg-primary:  #F5F0E8;  /* Warm cream main background */
 --bg-card:    #FFFFFF;  /* White card background */
 --bg-dark:    #2D2D2D;  /* Dark cover background */

 /* Macaron color blocks (information sections) */
 --macaron-blue:   #A8D8EA; /* Sky blue - information/cognition */
 --macaron-blue-bg: #D6EEF8; /* Light sky-blue background */
 --macaron-mint:   #B5E5CF; /* Mint green - growth/positive */
 --macaron-mint-bg: #D8F3E8; /* Light mint background */
 --macaron-lavender: #D5C6E0; /* Lavender - abstract/conceptual */
 --macaron-lavender-bg: #EAE0F5; /* Light lavender background */
 --macaron-peach:  #FFD5C2; /* Peach - warmth/action */
 --macaron-peach-bg: #FFE8DC; /* Light peach background */
 --macaron-yellow:  #FFF0A0; /* Lemon yellow - emphasis/warning */

 /* Brand colors */
 --coral:     #E8655A;  /* Coral red - core emphasis/data */
 --coral-dark:  #C0392B;  /* Deep coral */
 --ink:      #2D2D2D;  /* Hand-drawn ink black - lines/text */

 /* Text */
 --text-primary:  #2D2D2D; /* Ink black - main titles/lines */
 --text-secondary: #4A4A4A; /* Dark Gray - Body text */
 --text-muted:   #6B6B6B; /* Medium gray - notes/small text */
 --text-on-dark:  #F5F0E8; /* Text on dark backgrounds */

 /* Borders (thick hand-drawn feel) */
 --border-ink:  2.5px solid #2D2D2D;
 --border-dashed: 2px dashed #2D2D2D;
 --border-thin:  1.5px solid #2D2D2D;

 /* Shadows (hand-drawn offset feel) */
 --shadow-sketch: 3px 3px 0 rgba(45,45,45,0.15);
 --shadow-card:  4px 4px 0 rgba(45,45,45,0.12);
}
```

---

## 3. Typography Specification

| Level | Size | Weight | Color | Notes |
|------|------|------|------|------|
| Cover title | 64–72px | 800 | --ink | Handwritten style, letter-spacing: -0.01em |
| Page title | 44–52px | 700 | --ink | With underline decoration or color-block backing |
| Color-block section title | 28–34px | 700 | --ink | Titles inside each macaron color block |
| Subtitle | 22–26px | 600 | --text-secondary | |
| Body text | 18–22px | 400 | --text-secondary | line-height: 1.8, handwritten-feel font |
| Data emphasis | 48–60px | 800 | --coral | KPI/key numbers |
| Notes/annotations | 14–17px | 400 | --text-muted | Handwritten annotation style, italic |

**Font families:** `'Noto Sans SC', sans-serif` (body text); cover titles can layer handwritten-feel CSS effects

**Font import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&family=ZCOOL+KuaiLe&display=swap" rel="stylesheet"/>
```
> `ZCOOL KuaiLe` is used for titles with a relaxed handwritten feel; body text uses `Noto Sans SC`.

---

## 4. Decorative Element Specification

**A. Macaron color-block card (macaron-card)**:
```html
<div class="macaron-card blue">
 <div class="macaron-title">认知区标题</div>
 <div class="macaron-body">Content text</div>
</div>
```
```css
.macaron-card {
 border: 2.5px solid #2D2D2D;
 border-radius: 16px;
 padding: 20px 24px;
 box-shadow: 4px 4px 0 rgba(45,45,45,0.12);
 position: relative;
}
.macaron-card.blue   { background: var(--macaron-blue-bg); }
.macaron-card.mint   { background: var(--macaron-mint-bg); }
.macaron-card.lavender { background: var(--macaron-lavender-bg); }
.macaron-card.peach  { background: var(--macaron-peach-bg); }
.macaron-card.yellow  { background: var(--macaron-yellow); }
.macaron-title {
 font-size: 22px; font-weight: 700; color: #2D2D2D;
 margin-bottom: 10px; font-family: 'ZCOOL KuaiLe', sans-serif;
}
.macaron-body {
 font-size: 17px; color: #4A4A4A; line-height: 1.75;
}
```

**B. Hand-drawn connector arrow (sketch-arrow)**:
```html
<div class="sketch-arrow">→</div>
```
```css
.sketch-arrow {
 font-size: 28px;
 color: #2D2D2D;
 font-family: 'ZCOOL KuaiLe', sans-serif;
 transform: rotate(-2deg);
 display: inline-block;
}
```

**C. Highlighted background text (highlight-text)**:
```html
<span class="hl-yellow">关键词</span>
<span class="hl-coral">Highlight</span>
```
```css
.hl-yellow { background: var(--macaron-yellow); padding: 0 6px; border-radius: 4px; font-weight: 700; }
.hl-coral { background: rgba(232,101,90,0.18); color: var(--coral-dark); padding: 0 6px; border-radius: 4px; font-weight: 700; }
```

**D. Secondary dashed-border block (dashed-box)**:
```html
<div class="dashed-box">次要信息</div>
```
```css
.dashed-box {
 border: 2px dashed #2D2D2D;
 border-radius: 12px;
 padding: 16px 20px;
 background: rgba(255,255,255,0.6);
}
```

**E. Number badge (num-badge)**:
```html
<div class="num-badge">01</div>
```
```css
.num-badge {
 width: 44px; height: 44px;
 border-radius: 50%;
 background: var(--ink);
 color: #F5F0E8;
 font-size: 18px; font-weight: 800;
 display: flex; align-items: center; justify-content: center;
 flex-shrink: 0;
 font-family: 'ZCOOL KuaiLe', sans-serif;
}
```

**F. Doodle decorative tag (doodle-tag)**:
```html
<span class="doodle-tag">⭐ Highlight</span>
```
```css
.doodle-tag {
 display: inline-block;
 background: var(--macaron-yellow);
 border: 2px solid #2D2D2D;
 border-radius: 20px;
 padding: 4px 14px;
 font-size: 14px; font-weight: 700;
 color: #2D2D2D;
 transform: rotate(-1.5deg);
 box-shadow: 2px 2px 0 rgba(45,45,45,0.15);
}
```

**G. Bottom quote bar (quote-bar)**:
```html
<div class="quote-bar">💡 核心结论：一句话总结要点</div>
```
```css
.quote-bar {
 background: var(--ink);
 color: #F5F0E8;
 border-radius: 12px;
 padding: 14px 24px;
 font-size: 18px; font-weight: 700;
 font-family: 'ZCOOL KuaiLe', sans-serif;
 text-align: center;
 letter-spacing: 0.02em;
}
```

---

## 5. Dedicated Layout Page Types (8)

### 1. Cover
- Background: warm cream (bg-primary) with small doodles scattered in the four corners (stars, wavy lines, dots)
- Center: large title (ZCOOL KuaiLe, 64px) + subtitle + author/date doodle-tag
- Right side or bottom: one large cartoon character illustration (simple line style)
- Bottom: quote-bar showing the core theme in one sentence

### 2. Concept
- Top: page title + hl-yellow highlighted keyword
- Body: 2-3 macaron-cards (different colors) arranged horizontally or in a grid
- Between cards: connected by sketch-arrow hand-drawn arrows
- Bottom: dashed-box supplemental note + doodle-tag annotation

### 3. Process
- Top: title
- Body: vertical or horizontal step list (num-badge + macaron-card, alternating colors)
- Between steps: hand-drawn curved arrows (implemented with CSS transform)
- Bottom: quote-bar summary

### 4. Comparison
- Top: title
- Body: two-column comparison (left: macaron-blue, right: macaron-peach)
- Middle: large VS text (rotated decoration)
- Bottom: conclusion dashed-box

### 5. Data
- Top: title + small data source text
- Body: 1-2 oversized numbers (coral, 60px) + macaron-yellow backing
- Around them: hand-drawn annotation arrows + explanatory text
- Bottom: quote-bar data insight

### 6. Mind Map
- Background: warm cream
- Center: core concept circle (ink background, white text)
- Radiating outward: 4-6 macaron-cards (different colors and sizes)
- Connector lines: hand-drawn curves (simulated with border + border-radius)

### 7. Section
- Background: dark ink (#2D2D2D)
- Center: large section number (warm cream, 80px, ZCOOL KuaiLe)
- Section name (white/warm cream, 52px)
- Four corners: small doodle decorations (white, low opacity)
- Bottom: three section keywords as doodle-tags

### 8. Closing/Summary
- Background: warm cream
- Body: 3-4 macaron-cards summarizing key points (different colors)
- Bottom center: quote-bar core quote
- Bottom right: thank-you/contact dashed-box + QR code

---

## 6. Corner Radius and Shadow Specification

| Element | Radii | Shadows |
|------|------|------|
| macaron-card | 16px | 4px 4px 0 rgba(45,45,45,0.12) |
| dashed-box | 12px | None |
| doodle-tag | 20px | 2px 2px 0 rgba(45,45,45,0.15) |
| num-badge | 50% (circle) | None |
| quote-bar | 12px | None |
| Image container | 16px | 4px 4px 0 rgba(45,45,45,0.15) |

---

## 7. ECharts Chart Specification

### Palette
```javascript
color: ['#A8D8EA', '#B5E5CF', '#D5C6E0', '#FFD5C2', '#E8655A', '#FFF0A0']
```

### Global Configuration Template
```javascript
const handDrawnTheme = {
 backgroundColor: 'transparent',
 textStyle: { color: '#4A4A4A', fontFamily: 'Noto Sans SC, sans-serif', fontSize: 15 },
 title: {
  textStyle: { color: '#2D2D2D', fontSize: 22, fontWeight: '700', fontFamily: 'ZCOOL KuaiLe, sans-serif' }
 },
 legend: { textStyle: { color: '#4A4A4A', fontSize: 14 } },
 categoryAxis: {
  axisLine: { lineStyle: { color: '#2D2D2D', width: 2 } },
  axisTick: { lineStyle: { color: '#2D2D2D' } },
  axisLabel: { color: '#4A4A4A', fontSize: 14 },
  splitLine: { show: false }
 },
 valueAxis: {
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: '#6B6B6B', fontSize: 13 },
  splitLine: { lineStyle: { color: '#E8E0D0', type: 'dashed' } }
 },
 tooltip: {
  backgroundColor: '#2D2D2D',
  borderColor: '#2D2D2D',
  textStyle: { color: '#F5F0E8', fontSize: 14 }
 }
};
```

### Bar chart (macaron palette)
```javascript
option = {
 backgroundColor: 'transparent',
 color: ['#A8D8EA', '#B5E5CF', '#D5C6E0', '#FFD5C2'],
 grid: { top: 50, bottom: 50, left: 60, right: 30, containLabel: true },
 xAxis: {
  type: 'category',
  axisLabel: { color: '#4A4A4A', fontSize: 14, fontFamily: 'Noto Sans SC' },
  axisLine: { lineStyle: { color: '#2D2D2D', width: 2 } },
  axisTick: { show: false }
 },
 yAxis: {
  type: 'value',
  axisLabel: { color: '#6B6B6B', fontSize: 13 },
  splitLine: { lineStyle: { color: '#E8E0D0', type: 'dashed' } },
  axisLine: { show: false }
 },
 series: [{
  type: 'bar', barWidth: '55%',
  itemStyle: {
   borderRadius: [8,8,0,0],
   borderColor: '#2D2D2D', borderWidth: 2
  },
  label: { show: true, position: 'top', color: '#2D2D2D', fontSize: 14, fontWeight: '700' }
 }]
};
```

### Pie chart (knowledge share)
```javascript
option = {
 backgroundColor: 'transparent',
 color: ['#A8D8EA', '#B5E5CF', '#D5C6E0', '#FFD5C2', '#FFF0A0'],
 series: [{
  type: 'pie', radius: ['35%', '65%'],
  itemStyle: {
   borderColor: '#2D2D2D', borderWidth: 2.5,
   borderRadius: 6
  },
  label: { color: '#2D2D2D', fontSize: 14, fontWeight: '700' },
  emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(45,45,45,0.2)' } }
 }]
};
```

### Line chart (learning progress)
```javascript
option = {
 backgroundColor: 'transparent',
 color: ['#E8655A'],
 grid: { top: 50, bottom: 50, left: 60, right: 30, containLabel: true },
 xAxis: {
  type: 'category',
  axisLine: { lineStyle: { color: '#2D2D2D', width: 2 } },
  axisTick: { show: false },
  axisLabel: { color: '#4A4A4A', fontSize: 14 }
 },
 yAxis: {
  type: 'value',
  axisLabel: { color: '#6B6B6B', fontSize: 13 },
  splitLine: { lineStyle: { color: '#E8E0D0', type: 'dashed' } },
  axisLine: { show: false }
 },
 series: [{
  type: 'line', smooth: true,
  lineStyle: { width: 3.5, color: '#E8655A' },
  symbolSize: 10, symbol: 'circle',
  itemStyle: { color: '#E8655A', borderColor: '#fff', borderWidth: 2.5 },
  areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
   colorStops: [{ offset: 0, color: 'rgba(232,101,90,0.2)' }, { offset: 1, color: 'rgba(232,101,90,0)' }] } }
 }]
};
```

---

## 8. AI Illustration Generation Specification

### Style Keywords
```
hand-drawn educational illustration, macaron pastel colors, warm cream background,
cartoon doodle style, simple stick figures, wobble line quality, marker pen texture,
cute and friendly, knowledge infographic style, no photorealism, flat 2D
```

### image_search Keyword Strategy

| Purpose | Recommended Keywords |
|------|-----------|
| Cover illustration | `cute educational illustration`, `hand drawn infographic character`, `doodle learning concept` |
| Concept diagram | `pastel color knowledge map`, `hand drawn mind map`, `educational diagram cute style` |
| Characters/scenes | `simple cartoon student illustration`, `doodle people learning`, `flat character education` |
| DecorationElement | `hand drawn stars arrows doodle`, `sketch decorative elements`, `cute doodle icons set` |

### Image Generation Prompt Examples

**Cover illustration**
```
hand-drawn educational illustration of [具体主题], macaron pastel colors (sky blue, mint green, lavender, peach), warm cream background #F5F0E8, cute simple cartoon style, slight wobble line quality like marker pen, friendly and approachable, flat 2D, no text, knowledge infographic aesthetic
```

**Concept/process illustration**
```
cute hand-drawn diagram showing [流程/概念], pastel color blocks (blue #A8D8EA, mint #B5E5CF, lavender #D5C6E0, peach #FFD5C2), black outline 2px, warm cream paper background, simple cartoon characters, doodle arrows connecting elements, educational infographic style
```

### Notes
- **Prefer**Implement macaron color-block layouts with HTML+CSS for more precise control than images
- Images are suitable for cover cartoon characters, conceptual scene illustrations, and decorative doodle elements
- **Avoid**:photorealistic photos, dark palettes, and complex 3D rendering; keep a light hand-drawn feel
- After generating images, check that they coordinate with the warm cream background
