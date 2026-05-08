# Retro Picture-Book Style (Vector-Illustration) Visual Spec

## 1. Core Design Concept

- **Unified black outlines**: Every graphic element (people, buildings, objects, icons) uses a consistent 2-3px black stroke, creating a "coloring book" visual unity.
- **Soft retro palette**: Avoid pure colors and gradients; use soft retro colors such as coral red, mint green, mustard yellow, and slate blue to create a warm period feel.
- **Geometrically simplified style**: Complex objects are reduced to basic geometric forms: trees become lollipops or triangles, buildings become rectangular blocks, and people become simplified geometric figures.
- **Narrative horizontal composition**: Best for panoramic horizontal scenes, with foreground/midground/background layers stacked to create spatial depth through occlusion.

---

## 2. Color Spec

```css
:root {
  /* Background */
  --bg-primary:    #F5F0E6;   /* Cream beige primary background */
  --bg-secondary:  #EDE8DA;   /* Secondary beige */
  --bg-card:       #FFF9F0;   /* Warm white card */
  --bg-dark:       #2D2D2D;   /* Dark background */
  --bg-sky:        #D6EEF8;   /* Sky-blue background */

  /* Retro illustration palette */
  --coral:         #E07A5F;   /* Coral red - primary accent */
  --coral-dark:    #C4614A;   /* Dark coral */
  --coral-light:   #F2B5A0;   /* Light coral */
  --mint:          #81B29A;   /* Mint green - nature/growth */
  --mint-light:    #B5D5C5;   /* Light mint */
  --mustard:       #F2CC8F;   /* Mustard yellow - warmth/energy */
  --mustard-dark:  #D4A843;   /* Dark mustard */
  --slate:         #577590;   /* Slate blue - calm/technology */
  --slate-light:   #8AAFC4;   /* Light slate blue */
  --burnt:         #D4764A;   /* Burnt orange - tertiary accent */
  --cream:         #F5F0E6;   /* Cream */
  --sand:          #D4C5A9;   /* Sand */
  --lavender:      #C9B8D8;   /* Lavender purple - soft support color */
  --lavender-light:#E8DDEF;   /* Light lavender */

  /* Text */
  --text-primary:   #1A1A1A;  /* Deep black - hero headings */
  --text-secondary: #3D3D3D;  /* Dark gray - body copy */
  --text-muted:     #6B6B6B;  /* Medium gray - annotations */
  --text-on-dark:   #F5F0E6;  /* Text on dark backgrounds */

  /* Outlines (unified spec) */
  --outline:       #1A1A1A;   /* Unified stroke color */
  --outline-width: 2.5px;     /* Unified stroke width */
  --outline-light: rgba(26,26,26,0.25); /* Light stroke */

  /* Shadows (with outlined feel) */
  --shadow-retro: 3px 3px 0 rgba(26,26,26,0.15);
  --shadow-card:  4px 4px 0 rgba(26,26,26,0.10);
  --shadow-lg:    6px 6px 0 rgba(26,26,26,0.12);
  --shadow-xl:    8px 8px 0 rgba(26,26,26,0.12);

  /* Decorative element colors */
  --sunburst:      #F2CC8F;   /* Rays/sunburst */
  --dot-pattern:   rgba(26,26,26,0.08); /* Dot texture */
}
```

---

## 3. Typography Spec

| Level | Size | Weight | Color | Notes |
|------|------|------|------|------|
| Cover hero title | 64-76px | 700 | --text-primary | Retro serif, letter-spacing: -0.01em |
| Subtitle label | 14-16px | 700 | --text-on-dark | Uppercase, placed inside a color-block rectangle |
| Page main title | 44-52px | 700 | --text-primary | Serif with an authoritative feel |
| Section subtitle | 22-28px | 600 | --text-secondary | |
| Body | 18-22px | 400 | --text-secondary | line-height: 1.75, geometric sans-serif |
| Data highlight | 52-68px | 700 | --coral or --slate | |
| Caption/annotation | 14-16px | 400 | --text-muted | Lowercase, lightweight |

**Font families:** Use `'Playfair Display', Georgia, serif` for headings; use `'DM Sans', 'Noto Sans SC', sans-serif` for body copy

**Font import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet"/>
```

---

## 4. Decorative Element Spec

**A. Title color-block label (title-label)**:
```html
<div class="title-label coral">CHAPTER ONE</div>
```
```css
.title-label {
  display: inline-block;
  padding: 6px 18px;
  font-size: 13px; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: #fff;
  border: 2px solid var(--outline);
  border-radius: 0;  /* No radius for a retro feel */
}
.title-label.coral   { background: var(--coral); }
.title-label.mint    { background: var(--mint); }
.title-label.mustard { background: var(--mustard); color: var(--text-primary); }
.title-label.slate   { background: var(--slate); }
```

**B. Vector-style card (vector-card)**:
```html
<div class="vector-card">内容</div>
```
```css
.vector-card {
  background: var(--bg-card);
  border: 2.5px solid var(--outline);
  border-radius: 8px;
  padding: 24px 28px;
  box-shadow: var(--shadow-card);
}
.vector-card.coral   { background: var(--coral-light); }
.vector-card.mint    { background: var(--mint-light); }
.vector-card.mustard { background: var(--mustard); }
.vector-card.slate   { background: var(--slate-light); color: #fff; }
```

**C. Sunburst decoration (sunburst)**:
```css
.sunburst-bg {
  position: absolute;
  width: 300px; height: 300px;
  background: repeating-conic-gradient(
    var(--sunburst) 0deg 10deg,
    transparent 10deg 20deg
  );
  opacity: 0.25;
  border-radius: 50%;
}
```

**D. Dot texture background**:
```css
.dot-bg {
  background-image: radial-gradient(circle, var(--dot-pattern) 1.5px, transparent 1.5px);
  background-size: 20px 20px;
}
```

**E. Data display block (stat-block)**:
```html
<div class="stat-block">
  <div class="stat-num">2,400</div>
  <div class="stat-label">活跃用户</div>
</div>
```
```css
.stat-block {
  background: var(--bg-card);
  border: 2.5px solid var(--outline);
  border-radius: 8px;
  padding: 20px 24px;
  box-shadow: var(--shadow-retro);
  text-align: center;
}
.stat-num {
  font-size: 52px; font-weight: 700;
  color: var(--coral);
  font-family: 'Playfair Display', serif;
  line-height: 1; letter-spacing: -0.02em;
}
.stat-label {
  font-size: 14px; color: var(--text-muted);
  margin-top: 6px; letter-spacing: 0.04em;
}
```

**F. Icon card (icon-card)**:
```html
<div class="icon-card">
  <div class="icon-box coral">🌿</div>
  <div class="icon-title">可持续发展</div>
  <div class="icon-desc">说明文字</div>
</div>
```
```css
.icon-card {
  background: var(--bg-card);
  border: 2.5px solid var(--outline);
  border-radius: 8px;
  padding: 24px 20px;
  box-shadow: var(--shadow-card);
  display: flex; flex-direction: column; gap: 10px;
}
.icon-box {
  width: 52px; height: 52px;
  border: 2.5px solid var(--outline);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
}
.icon-box.coral   { background: var(--coral-light); }
.icon-box.mint    { background: var(--mint-light); }
.icon-box.mustard { background: var(--mustard); }
.icon-box.slate   { background: var(--slate-light); }
.icon-title { font-size: 18px; font-weight: 700; color: var(--text-primary); font-family: 'Playfair Display', serif; }
.icon-desc  { font-size: 15px; color: var(--text-secondary); line-height: 1.65; }
```

**G. Horizontal scene divider (scene-divider)**:
```css
.scene-divider {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 6px;
  background: var(--outline);
}
```

**H. Progress bar component (progress-item)**:
```html
<div class="progress-item">
  <div class="progress-label">
    <span>绿色出行覆盖率</span><span>74%</span>
  </div>
  <div class="progress-track">
    <div class="progress-fill coral" style="width:74%"></div>
  </div>
</div>
```
```css
.progress-track {
  height: 12px;
  background: var(--bg-secondary);
  border: 2px solid var(--outline);
  border-radius: 0;  /* No radius for a retro feel */
  overflow: hidden;
}
.progress-fill.coral   { background: var(--coral); }
.progress-fill.mint    { background: var(--mint); }
.progress-fill.mustard { background: var(--mustard-dark); }
.progress-fill.slate   { background: var(--slate); }
```

**I. Step flow component (step-flow)**:
```html
<div class="step-flow">
  <div class="step-item">
    <div class="step-num coral">1</div>
    <div class="step-content">
      <div class="step-title">审视出行</div>
      <div class="step-desc">记录本周通勤方式</div>
    </div>
  </div>
  <!-- More nodes... -->
</div>
```
```css
.step-flow { display: flex; align-items: flex-start; gap: 0; }
.step-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; position: relative; }
.step-item:not(:last-child)::after {
  content: '';
  position: absolute; top: 22px;
  left: calc(50% + 22px); right: calc(-50% + 22px);
  height: 3px; background: var(--outline);
}
.step-num {
  width: 44px; height: 44px; border-radius: 50%;
  border: 3px solid var(--outline);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 700;
  font-family: 'Playfair Display', serif;
}
.step-num.coral   { background: var(--coral);   color: #fff; }
.step-num.mint    { background: var(--mint);    color: #fff; }
.step-num.mustard { background: var(--mustard); color: var(--text-primary); }
```

**J. Call-to-action card (action-card)**:
```html
<div class="action-card">
  <div class="action-num" style="background:#F2B5A0;">1</div>
  <div class="action-content">
    <div class="action-title">绿色通勤挑战</div>
    <div class="action-desc">连续21天骑行或步行上班，养成零碳通勤习惯。</div>
  </div>
</div>
```

---

## 5. Dedicated Layout Page Types (8)

### 1. Cover
- Background: cream beige (bg-primary) + large full-scene illustration on the right (city/nature/people)
- Left (45%): vertical accent line + title-label (small label) + oversized hero title (Playfair Display, 72px) + subtitle + topic-tag row + author info card
- Right (55%): full-height vector illustration scene (built with CSS + SVG, or AI-generated image) + floating data badges + floating tag list
- Bottom: three-color accent strip (coral/mint/mustard)

### 2. Brand Story
- Full-width horizontal composition with foreground, midground, and background layers
- Main: large illustration scene (city street/natural landscape/work scene)
- Left text area: title-label + title + paragraph text
- Embed floating data stat-blocks inside the scene

### 3. Features
- Top: title + title-label
- Main: 3-4 column icon-card grid
- Each card: colored icon-box + title (Playfair Display) + description
- Bottom: horizontal decorative line

### 4. Data
- Top: title
- Upper main area: 3-4 stat-blocks in a row (large numbers, different accent colors)
- Lower main area: ECharts chart (retro palette) + explanatory text on the right
- Background: low-opacity sunburst or dot-bg decoration

### 5. Comparison Narrative
- Two columns (50% each): vector-card (different colors)
- Middle: vertical black divider + comparison title
- Each column: title-label + bullet list + small illustration icon

### 6. Timeline/Journey
- Horizontal timeline (thick black line) spanning the full page
- Nodes: circles (black outline + colored fill)
- Below each node: vector-card description card
- Background: low-opacity dot-bg

### 7. Section (two variants)
**Variant A — left dark panel**:
- Left (35%): dark background (bg-dark) + sunburst decoration + chapter-badge + large title (white) + subtitle + three-point list
- Right (65%): SVG panoramic illustration scene (buildings/farmland/gardens, etc.) + floating data cards

**Variant B — fullscreen centered**:
- Fullscreen cream background + low-opacity sunburst decoration
- Top text area: title-label + section name (Playfair Display, 96px) + subtitle + data card group
- Bottom: full-width SVG horizontal scene illustration (foreground/midground/background layers)
- Bottom: three-color accent strip

### 8. Closing
- Background: bg-primary + full-width bottom illustration scene
- Top: thank-you message (Playfair Display, 60px) + subtitle
- Middle: contact vector-card + QR code (black outlined frame)
- Bottom: three-color horizontal accent strip

---

## 6. Border Radius and Shadow Spec

| Element | Radius | Shadow |
|------|------|------|
| vector-card | 8px | 4px 4px 0 rgba(26,26,26,0.10) |
| icon-card | 8px | 4px 4px 0 rgba(26,26,26,0.10) |
| stat-block | 8px | 3px 3px 0 rgba(26,26,26,0.15) |
| icon-box | 8px | none |
| title-label | 0px (no radius) | none |
| Image container | 8px | 4px 4px 0 rgba(26,26,26,0.12) |

---

## 7. ECharts Chart Spec

### Palette
```javascript
color: ['#E07A5F', '#81B29A', '#F2CC8F', '#577590', '#D4764A', '#B5D5C5']
```

### Global Configuration Template
```javascript
const vectorTheme = {
  backgroundColor: 'transparent',
  textStyle: { color: '#3D3D3D', fontFamily: 'DM Sans, Noto Sans SC, sans-serif', fontSize: 14 },
  title: {
    textStyle: { color: '#1A1A1A', fontSize: 20, fontWeight: '700', fontFamily: 'Playfair Display, serif' }
  },
  legend: { textStyle: { color: '#3D3D3D', fontSize: 13 } },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#1A1A1A', width: 2 } },
    axisTick: { show: false },
    axisLabel: { color: '#3D3D3D', fontSize: 13 },
    splitLine: { show: false }
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#6B6B6B', fontSize: 12 },
    splitLine: { lineStyle: { color: '#E8E0D0', type: 'dashed' } }
  },
  tooltip: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
    textStyle: { color: '#F5F0E6', fontSize: 13 }
  }
};
```

### Bar Chart (Retro Style)
```javascript
option = {
  backgroundColor: 'transparent',
  color: ['#E07A5F', '#81B29A', '#F2CC8F', '#577590'],
  grid: { top: 50, bottom: 50, left: 60, right: 30, containLabel: true },
  xAxis: {
    type: 'category',
    axisLabel: { color: '#3D3D3D', fontSize: 13 },
    axisLine: { lineStyle: { color: '#1A1A1A', width: 2 } },
    axisTick: { show: false }
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#6B6B6B', fontSize: 12 },
    splitLine: { lineStyle: { color: '#E8E0D0', type: 'dashed' } },
    axisLine: { show: false }
  },
  series: [{
    type: 'bar', barWidth: '55%',
    itemStyle: {
      borderRadius: [4,4,0,0],
      borderColor: '#1A1A1A', borderWidth: 2
    },
    label: { show: true, position: 'top', color: '#1A1A1A', fontSize: 13, fontWeight: '700' }
  }]
};
```

### Line Chart (Narrative Trend)
```javascript
option = {
  backgroundColor: 'transparent',
  color: ['#E07A5F'],
  grid: { top: 50, bottom: 50, left: 60, right: 30, containLabel: true },
  xAxis: {
    type: 'category',
    axisLine: { lineStyle: { color: '#1A1A1A', width: 2 } },
    axisTick: { show: false },
    axisLabel: { color: '#3D3D3D', fontSize: 13 }
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#6B6B6B', fontSize: 12 },
    splitLine: { lineStyle: { color: '#E8E0D0', type: 'dashed' } },
    axisLine: { show: false }
  },
  series: [{
    type: 'line', smooth: false,
    lineStyle: { width: 3, color: '#E07A5F' },
    symbolSize: 10, symbol: 'circle',
    itemStyle: { color: '#E07A5F', borderColor: '#1A1A1A', borderWidth: 2 },
    areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
      colorStops: [{ offset: 0, color: 'rgba(224,122,95,0.2)' }, { offset: 1, color: 'rgba(224,122,95,0)' }] } }
  }]
};
```

### Donut Chart (Brand Share)
```javascript
option = {
  backgroundColor: 'transparent',
  color: ['#E07A5F', '#81B29A', '#F2CC8F', '#577590'],
  series: [{
    type: 'pie', radius: ['40%', '68%'],
    itemStyle: { borderColor: '#1A1A1A', borderWidth: 2.5, borderRadius: 4 },
    label: { color: '#1A1A1A', fontSize: 13, fontWeight: '700' },
    emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(26,26,26,0.15)' } }
  }]
};
```

---

## 8. AI Illustration Generation Spec

### Style Keywords
```
flat vector illustration, retro vintage style, uniform black outline 2-3px on all elements,
soft retro color palette (coral, mint green, mustard yellow, slate blue),
cream off-white background #F5F0E6, geometric simplified shapes,
coloring book aesthetic, toy model feel, no gradients, no photorealism,
panoramic horizontal composition, layered depth
```

### image_search Keyword Strategy

| Use | Recommended Keywords |
|------|-----------|
| Cover scene | `flat vector illustration city scene`, `retro illustration landscape`, `vintage vector art people` |
| Brand story | `flat design brand story illustration`, `vector illustration narrative scene`, `retro style business illustration` |
| Nature/environment | `flat vector nature illustration`, `geometric forest illustration`, `retro style outdoor scene` |
| People/team | `flat vector people illustration retro`, `geometric character design`, `vintage style team illustration` |

### Image Generation Prompt Examples

**Cover panoramic illustration**
```
flat vector illustration of [具体场景], retro vintage style, uniform black outline 2.5px on all elements, soft color palette: coral #E07A5F, mint green #81B29A, mustard yellow #F2CC8F, slate blue #577590, cream background #F5F0E6, geometric simplified shapes, coloring book aesthetic, panoramic horizontal composition with foreground/midground/background layers, no gradients, no text
```

**Feature icon illustration**
```
flat vector icon illustration of [主题], retro style, black outline 2px, coral and mint color palette, cream background, geometric simplified, toy model aesthetic, single centered subject, no text, square format
```

### Notes
- **Cover and scene pages** are best suited to AI-generated panoramic illustrations, which are this style's biggest highlight
- Prefer **ECharts charts with retro palettes** for data pages; they are more precise than images
- Prefer building feature pages with **CSS icon-card components** without relying on images
- **Avoid**: realistic photos, modern flat styles without outlines, gradients, and neon colors; stay with soft retro colors + black outlines
