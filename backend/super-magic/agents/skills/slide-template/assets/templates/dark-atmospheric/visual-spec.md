# Dark Neon Glow (Dark-Atmospheric) Visual Spec v2.0

## 1. Core Design Principles

- **Cinematic dark aesthetic:** Void black base (#060610 to #0A0A18 deepening layers) plus rich shadow hierarchy creates strong visual contrast and mystery, producing an immersive feel like an IMAX screen.
- **Restrained deep neon:** Reduce neon saturation (deep purple #9D6FFF replaces the original vivid purple; ice cyan #22D3EE replaces the original bright cyan), follow the "less is more" principle, and use three glow intensities to emphasize key hierarchy rather than applying glow everywhere.
- **Spatial depth construction:** Five background depths (void black -> main background -> secondary background -> card -> elevated layer), vignette gradients (dark edges to slightly brighter center), and particle effects create cinematic spatial depth.
- **Dramatic focal design:** Each page has a clear visual focal point, using spotlight-style gradients (spotlight-bg) and glow effects to guide the eye, while backlit outlines and silhouettes add mystery.

---

## 2. Color Specifications

```css
:root {
  /* Background layers (5 depths)*/
  --bg-void:       #060610;   /* Void black - deepest layer */
  --bg-primary:    #0A0A18;   /* Deep purple-black main background */
  --bg-secondary:  #0F0F22;   /* Secondary background */
  --bg-card:       #13132A;   /* Card background */
  --bg-card-2:     #1A1A35;   /* Secondary card/panel */
  --bg-elevated:   #1E1E3E;   /* Elevated layer/highlight card */

  /* Neon colors (lower saturation, premium feel)*/
  --neon-purple:   #9D6FFF;   /* Deep purple - primary glow */
  --neon-cyan:     #22D3EE;   /* Ice cyan - secondary glow */
  --neon-rose:     #F472B6;   /* Rose pink - tertiary accent */
  --neon-amber:    #FBBF24;   /* Amber gold - warm highlight */
  --neon-green:    #34D399;   /* Emerald green - success/data */
  --neon-indigo:   #818CF8;   /* Indigo - auxiliary color */

  /* Text */
  --text-primary:   #EEF2FF;  /* Near-white (with slight blue tint)*/
  --text-secondary: #8892B0;  /* Cool gray */
  --text-muted:     #3D4A6B;  /* Dark blue gray */
  --text-purple:    #C4AFFF;  /* Light purple */
  --text-cyan:      #6EE7F5;  /* Light ice cyan */
  --text-amber:     #FDE68A;  /* Light amber */
}
```

**Color usage principles:**
- Strictly follow the 5-layer background rule; do not use arbitrary intermediate values
- Use at most 3 neon colors per page: primary + secondary + accent
- Text colors: headings use `--text-primary`, body uses `--text-secondary`, notes use `--text-muted`

---

## 3. Typography Specifications

| Level | Size | Weight | Color | Notes |
|------|------|------|------|------|
| Cover title | 118px | 700 | --text-primary | letter-spacing: -0.025em |
| Page title | 80px | 700 | --text-primary | letter-spacing: -0.015em |
| Section title | 56px | 600 | --text-primary | |
| Subtitle | 40px | 500 | --text-secondary | |
| Body | 26px | 400 | --text-secondary | line-height: 1.75 |
| Small text | 20px | 400 | --text-secondary | line-height: 1.65 |
| KPI data | 100px | 700 | neon color | matching color glow effect |
| Tag | 17px | 600 | neon color | letter-spacing: 0.04em |
| Section label | 16px | 700 | --neon-purple | uppercase, letter-spacing: 0.18em |
| Caption | 16px | 400 | --text-muted | |

**Font family:** `'Space Grotesk', 'Noto Sans SC', sans-serif`(modern geometric sans-serif with a strong tech feel)

**Font import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet"/>
```

---

## 4. Decorative Element Specifications

**A. Vignette gradient background (global, 3 glow anchors):**
```css
.slide-container {
  background-color: var(--bg-primary);
  background-image:
    radial-gradient(ellipse at 15% 55%, rgba(157,111,255,0.10) 0%, transparent 55%),
    radial-gradient(ellipse at 85% 15%, rgba(34,211,238,0.07) 0%, transparent 50%),
    radial-gradient(ellipse at 65% 85%, rgba(244,114,182,0.05) 0%, transparent 45%);
}
```

**B. Neon glow-border card (top-line variants):**
```html
<div class="neon-card">default purple top line</div>
<div class="neon-card cyan">cyan top line</div>
<div class="neon-card gradient">gradient top line</div>
<div class="neon-card side-line">left vertical line</div>
<div class="glow-card">full glow border</div>
<div class="glass-card">glassmorphism</div>
```

**C. Floating particle decoration (supports pulse animation):**
```html
<div class="particle" style="top:15%;left:8%"></div>
<div class="particle cyan sm pulse" style="top:75%;right:12%"></div>
<div class="particle amber lg" style="top:40%;right:6%"></div>
```

**D. Neon title glow (3 intensities):**
```html
<h1 class="neon-title">main glow title</h1>
<h1 class="neon-title lg">strong glow cover title</h1>
<h1 class="da-gradient-title">Light purple to main purple to deep purple gradient title (recommended for cover highlight words)</h1>
<h1 class="da-gradient-title rose">purple to rose gradient</h1>
```

**E. Audio waveform decoration (supports animation):**
```html
<!-- static waveform -->
<div class="wave-deco">
  <div class="wave-bar" style="height:20px"></div>
  <div class="wave-bar" style="height:36px"></div>
  <div class="wave-bar" style="height:48px"></div>
  <div class="wave-bar" style="height:32px"></div>
  <div class="wave-bar" style="height:44px"></div>
  <div class="wave-bar" style="height:24px"></div>
  <div class="wave-bar" style="height:40px"></div>
  <div class="wave-bar" style="height:16px"></div>
</div>

<!-- animated waveform -->
<div class="wave-animated">
  <div class="wave-bar" style="height:24px"></div>
  <div class="wave-bar" style="height:36px"></div>
  <div class="wave-bar" style="height:44px"></div>
  <div class="wave-bar" style="height:36px"></div>
  <div class="wave-bar" style="height:24px"></div>
  <div class="wave-bar" style="height:32px"></div>
  <div class="wave-bar" style="height:40px"></div>
  <div class="wave-bar" style="height:20px"></div>
</div>
```

**F. Film strip decoration:**
```html
<div class="film-strip">
  <div class="film-hole">
    <div class="film-hole-dot"></div>
    <div class="film-hole-dot"></div>
    <div class="film-hole-dot"></div>
  </div>
  <div class="film-frame"></div>
  <!-- repeat multiple film-hole and film-frame elements -->
</div>
```

**G. Spotlight background variants:**
```html
<div class="slide-container spotlight-bg">...</div>
<div class="slide-container dual-glow">...</div>
<div class="slide-container cinematic">...</div>
<div class="slide-container void">...</div>
```

**H. Interaction effects:**
```html
<!-- hover glow (glows on mouse hover)-->
<div class="neon-card hover-glow">...</div>

<!-- fade-in animation (delayed loading)-->
<div class="da-animate delay-1">first element</div>
<div class="da-animate delay-2">second element</div>
<div class="da-animate delay-3">third element</div>

<!-- scan-light effect -->
<div class="neon-card scan-effect">...</div>

<!-- glow pulse -->
<div class="particle glow-pulse"></div>
```

---

## 5. Dedicated Layout Types (8 Types)

### Layout 1: Cover
- Full deep purple-black background (`.slide-container` or `.cinematic` variant)
- Centered radial purple glow with large white title text（`.da-cover-title`）
- Top eyebrow（`.da-cover-eyebrow`）with extension lines on both sides
- Bottom meta information（`.da-cover-meta`）+ particle decoration
- Optional: cinematic top and bottom black bars（`.cinematic`）

### Layout 2: Spotlight
- Dark background + spotlight gradient（`.spotlight-bg`）
- Center focus: large data or core idea (`.da-kpi-number` or `.da-gradient-title`)
- Edges darken, creating strong visual concentration
- Bottom light-gray explanatory text + waveform decoration

### Layout 3: Feature
- Top section label（`.da-section-label`）
- Left: core text + neon cards（`.neon-card`）
- Right: data visualization（ECharts）or image（`.da-img-frame`）
- Glow-border separated area

### Layout 4: Dashboard
- Dark background, 2x2 or 3x2 grid（`.grid-2x2` / `.grid-3x2`）
- Each cell: KPI card（`.da-kpi`）+ data (colored glow)
- Bottom progress bar（`.da-progress`）or waveform decoration

### Layout 5: Timeline
- Horizontal timeline（`.da-timeline-h`），nodes use neon dots
- node connector uses gradient (purple to cyan)
- Node cards: dark background + neon border
- background particle accents

### Layout 6: Cinematic
- Full dark background with cinematic letterbox bars（`.slide-container.cinematic`）
- Large centered quote or title（`.da-quote-center`）
- Radial background glow + film strip decoration（`.film-strip`）
- Suitable for quotes, section transitions, and emotional rendering

### Layout 7: Section
- **Layout structure: image left, text right, all absolutely positioned**（Does not rely on flex height chains, avoiding image height collapse in iframe scaling scenarios）
- **Left image area**：`position:absolute; left:0; width:1200px; height:1080px; overflow:hidden`
  - Image uses `position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; object-position:center top`
  - Overlay a multi-stop gradient mask on the right (12 stops), naturally blending from the right edge toward the left:
    ```css
    background: linear-gradient(90deg,
      rgba(10,10,24,0.15) 0%, rgba(10,10,24,0.0) 15%,
      rgba(10,10,24,0.0) 50%, rgba(10,10,24,0.4) 65%,
      rgba(10,10,24,0.75) 78%, rgba(10,10,24,0.95) 90%,
      rgba(10,10,24,1.0) 100%);
    ```
  - Overlay subtle top/bottom gradient masks (35% opacity each)
  - Bottom-left image caption text（`color: rgba(238,242,255,0.35)`）
- **Right content area**：`position:absolute; right:0; width:820px; height:1080px; z-index:1`
  - Padding：`padding: 64px 80px 64px 48px`
  - Section info box（`.da-section-box`，`padding: 32px 36px`）+ top gradient line
  - Keyword tag row（`.da-tag` variant）
  - Divider（`.da-divider`）
  - Discussion list（`.glass-card` list item，`padding: 14px 18px`）
  - Quote box（`.da-quote side-line`，`padding: 14px 18px`）
- **Large background number**（`.da-section-num-bg`）kept as upper-right decoration
- Section theme colors: purple (default) / amber gold (Hollywood) / ice cyan (New Wave) / emerald green (digital era)
- Floating particle effect

### Layout 8: Closing
- Dark background, centered thank-you text (with purple glow)
- Contact information shown with neon tags (`.da-tag`)
- Bottom audio waveform（`.wave-animated`）+ particle decoration
- Optional: cinematic subtitle style

---

## 6. Radius and Shadow Specifications

| Element | Radius | Shadow/Glow |
|------|------|-----------|
| Neon card | 14px (--radius-md) | --shadow-sm + top-line glow |
| Glow card | 14px | --shadow-md + full color glow |
| KPI data block | 14px | --shadow-sm + bottom-line glow |
| Tags/badges | 9999px/4px | matching color glow-sm |
| Section info box | 20px (--radius-lg) | --shadow-md |
| Chart container | 14px | --shadow-md |
| Spotlight circle | 50% | radial-gradient |
| Timeline node | 50% | color glow |
| Code block | 8px | --shadow-sm |

---

## 7. ECharts Chart Specifications

**Palette (deep neon colors)**：
```js
color: ['#9D6FFF', '#22D3EE', '#F472B6', '#FBBF24', '#34D399', '#818CF8']
```

**Global config**：
```js
const chartDefaults = {
  backgroundColor: 'transparent',
  textStyle: { color: '#8892B0', fontFamily: 'Space Grotesk, Noto Sans SC, sans-serif', fontSize: 13 },
  grid: { top: 40, right: 20, bottom: 40, left: 56, containLabel: true }
};
```

**Line chart (neon style with area fill)**：
```js
option = {
  ...chartDefaults,
  xAxis: { type: 'category', data: ['Q1','Q2','Q3','Q4'],
    axisLine: { lineStyle: { color: 'rgba(238,242,255,0.12)', width: 1 } },
    axisLabel: { color: '#8892B0' } },
  yAxis: { type: 'value',
    splitLine: { lineStyle: { color: 'rgba(238,242,255,0.05)' } },
    axisLabel: { color: '#8892B0' } },
  series: [
    { name: 'Metric A', type: 'line', smooth: true, data: [42,68,55,88],
      lineStyle: { color: '#9D6FFF', width: 2.5 },
      areaStyle: { color: { type: 'linear', x:0,y:0,x2:0,y2:1,
        colorStops: [{ offset:0, color:'rgba(157,111,255,0.28)' },{ offset:1, color:'rgba(157,111,255,0.02)' }] } },
      itemStyle: { color: '#9D6FFF', borderColor: '#C4AFFF', borderWidth: 2 },
      symbol: 'circle', symbolSize: 7 },
    { name: 'Metric B', type: 'line', smooth: true, data: [28,45,72,65],
      lineStyle: { color: '#22D3EE', width: 2.5 },
      areaStyle: { color: { type: 'linear', x:0,y:0,x2:0,y2:1,
        colorStops: [{ offset:0, color:'rgba(34,211,238,0.22)' },{ offset:1, color:'rgba(34,211,238,0.02)' }] } },
      itemStyle: { color: '#22D3EE', borderColor: '#6EE7F5', borderWidth: 2 },
      symbol: 'circle', symbolSize: 7 }
  ]
};
```

**Bar chart (gradient bars)**：
```js
series: [{ type: 'bar', barWidth: '48%', data: [42,68,55,80,72],
  itemStyle: { color: { type: 'linear', x:0,y:0,x2:0,y2:1,
    colorStops: [{ offset:0, color:'#9D6FFF' },{ offset:1, color:'rgba(157,111,255,0.25)' }] },
    borderRadius: [6,6,0,0] } }]
```

**Pie chart (neon donut)**：
```js
option = {
  ...chartDefaults,
  series: [{
    type: 'pie', radius: ['45%', '70%'], center: ['50%', '50%'],
    data: [
      { value: 35, name: 'Category A', itemStyle: { color: '#9D6FFF' } },
      { value: 28, name: 'Category B', itemStyle: { color: '#22D3EE' } },
      { value: 20, name: 'Category C', itemStyle: { color: '#F472B6' } },
      { value: 17, name: 'Category D', itemStyle: { color: '#FBBF24' } }
    ],
    label: { color: '#8892B0', fontSize: 13 },
    itemStyle: { borderColor: '#0A0A18', borderWidth: 3 }
  }]
};
```

**Radar chart**：
```js
option = {
  ...chartDefaults,
  radar: {
    indicator: [
      { name: 'Visuals', max: 100 }, { name: 'Narrative', max: 100 },
      { name: 'Pacing', max: 100 }, { name: 'Sound', max: 100 }, { name: 'Emotion', max: 100 }
    ],
    shape: 'polygon',
    splitLine: { lineStyle: { color: 'rgba(238,242,255,0.06)' } },
    splitArea: { areaStyle: { color: ['rgba(157,111,255,0.03)', 'rgba(157,111,255,0.06)'] } },
    axisLine: { lineStyle: { color: 'rgba(238,242,255,0.08)' } },
    axisName: { color: '#8892B0', fontSize: 14 }
  },
  series: [{
    type: 'radar',
    data: [{ value: [85,92,78,88,95], name: 'Rating',
      lineStyle: { color: '#9D6FFF', width: 2 },
      areaStyle: { color: 'rgba(157,111,255,0.18)' },
      itemStyle: { color: '#9D6FFF' } }]
  }]
};
```

---

## 8. AI Illustration Generation Specifications

**Style keywords**：
`dark atmospheric, deep purple-black background, neon glow effects, cinematic mood, mysterious and sophisticated, high contrast, glowing outlines, dark mode aesthetic, volumetric lighting`

**image_search strategy**：
- Add search terms：`dark atmospheric illustration`、`neon glow art`、`cinematic dark`、`deep space aesthetic`
- Prioritize illustrations with dark backgrounds, neon glow, and high contrast
- Avoid bright backgrounds and soft tones

**generate_images example prompt**：
```
dark atmospheric illustration of [具体主题], deep purple-black background #0A0A18, electric purple #9D6FFF and ice cyan #22D3EE neon glow effects, cinematic volumetric lighting, particle effects, mysterious and sophisticated atmosphere, high contrast, glowing outlines, dark mode aesthetic, no bright backgrounds, dramatic shadows, film noir mood
```
