# Open Source Triangle Orange (gotc-open-orange) Visual Spec v2.0

## 1. Core Design Concept

- **Open-source energy**: Orange #FF9933 communicates openness, energy, and community spirit, forming the visual language of open-source culture.
- **Clean white background**: White and light gray backgrounds keep content clear, with restrained orange accents and information-first layouts.
- **Triangle identity**: The left-side orange triangle accent bar is the template's signature identifying element, derived from the GOTC brand.
- **Dual conference logos**: The upper-right GOTC logo and lower-left Global Open Source Technology Conference logo stay in fixed positions.
- **Technical depth**: Code block and terminal components give the template the professional feel of an open-source technology conference, suitable for code demos and architecture explanations.

---

## 2. Color Spec

```css
:root {
  /* Background colors */
  --bg-primary:   #ffffff;
  --bg-secondary: #f7f7f7;
  --bg-card:      #fffaf5;
  --bg-card-alt:  #fff8f0;
  --bg-dark:      #1a1a1a;

  /* Brand colors */
  --color-primary:        #FF9933;
  --color-primary-light:  rgba(255, 153, 51, 0.12);
  --color-primary-mid:    rgba(255, 153, 51, 0.25);
  --color-primary-border: rgba(255, 153, 51, 0.35);
  --color-secondary:      #E67700;
  --color-accent:         #FFB84D;
  --color-accent-light:   #FDDBA0;
  --color-deep:           #CC5500;

  /* Text colors */
  --text-primary:   #1a1a1a;
  --text-secondary: #2c3e50;
  --text-muted:     #5a6c7d;
  --text-light:     #8fa3b8;
  --text-on-dark:   #ffffff;

  /* Gradients */
  --gradient-primary: linear-gradient(135deg, #FF9933 0%, #E67700 100%);
  --gradient-warm:    linear-gradient(135deg, #FFB84D 0%, #FF9933 100%);
  --gradient-hero:    linear-gradient(135deg, #1a1a1a 0%, #2c1a00 100%);
}
```

---

## 3. Typography Spec

| Level | Size | Weight | Color | Usage |
|------|------|------|------|------|
| Hero title | 96px | 900 | --text-primary | Cover main title |
| Page title | 64px | 700 | --text-primary, letter-spacing:2px | Header on each page |
| Subtitle | 48px | 700 | --text-secondary | Section subtitle |
| Section heading | 36px | 700 | --text-secondary, with orange divider | Title inside cards |
| Body text | 28px | 400 | --text-muted, line-height:1.6 | Explanatory text |
| Small text | 22px | 400 | --text-muted | Supplementary notes |
| Caption/source | 18px | 400 | --text-light | Footer notes and citations |
| KPI number | 80px | 900 | --color-primary | Large data value |
| Code | 22px | 400 | #cdd6f4 | Code block content |

Font family: `'Noto Sans SC', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif`
Code font: `'JetBrains Mono', 'Fira Code', 'Courier New', monospace`

**Font Import: **
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap" rel="stylesheet"/>
```

---

## 4. Decorative Element Spec

### A. Left Triangle Accent Bar (GOTC Signature Mark)
```html
<div class="triangle-bar"></div>
<div class="triangle-accent"></div>
```
- Regular pages use `triangle-bar` (12px wide) + `triangle-accent` (60px tall triangle).
- Cover and section pages use `triangle-bar-wide` (20px wide) + `triangle-accent-lg` (90px tall triangle).

### B. Background Glow
```html
<div class="bg-glow bg-glow-tr"></div>     <!-- upper-right orange glow -->
<div class="bg-glow bg-glow-bl"></div>     <!-- lower-left orange glow -->
<div class="bg-glow bg-glow-center"></div> <!-- centered large glow for the closing page -->
```

### C. Background Grid Texture (Technical Pages)
```html
<div class="bg-grid"></div>
```
A fine orange grid adds a technical feel to presentation pages.

### D. Orange Divider Variants
```html
<!-- short divider below a title -->
<hr class="section-divider"/>
<!-- gradient divider -->
<hr class="section-divider-gradient"/>
<!-- full-width thin divider for content separation -->
<hr class="section-divider-full"/>
```

### E. Conference Logos (Fixed Positions)
```html
<img src="images/GOTC-LOGO.png"          class="conf-logo-top-right"/>
<img src="images/全球开源技术峰会LOGO.png" class="conf-logo-bottom-left"/>
```

### F. Timeline Components (Horizontal / Vertical)
Horizontal timeline for timeline pages:
```html
<div class="timeline">
  <div class="timeline-item">
    <div class="timeline-dot-lg"></div>
    <div class="timeline-year">2022</div>
    <div class="timeline-title">ChatGPT Release</div>
    <div class="timeline-desc">LLMs enter public awareness</div>
  </div>
</div>
```

Vertical timeline for the side of mixed image/text pages:
```html
<div class="timeline-v">
  <div class="timeline-v-item">
    <div class="timeline-v-dot"></div>
    <div class="point-title">Phase One</div>
    <div class="point-text">Description content</div>
  </div>
</div>
```

### G. Orange Top Border on KPI Cards
```html
<div class="kpi-card">
  <div class="kpi-label">Open-source contributors</div>
  <div class="kpi-number">100M+</div>
  <div class="kpi-sublabel">Global developer community</div>
  <div class="kpi-trend-up">YoY +32%</div>
</div>
```

### H. Code Block (Specific to Open-Source Tech Conferences)
```html
<div class="code-block">
  <div class="code-block-header">
    <span class="code-dot code-dot-red"></span>
    <span class="code-dot code-dot-yellow"></span>
    <span class="code-dot code-dot-green"></span>
    <span class="code-filename">agent.py</span>
  </div>
  <div class="code-body">
    <span class="code-keyword">from</span> supermagic <span class="code-keyword">import</span> Agent<br>
    <span class="code-comment"># Initialize the AI Agent</span><br>
    agent = <span class="code-function">Agent</span>(<span class="code-string">"open-source"</span>)
  </div>
</div>
```

### I. Terminal Command Row
```html
<div class="terminal">
  <div class="terminal-header">
    <span class="code-dot code-dot-red"></span>
    <span class="code-dot code-dot-yellow"></span>
    <span class="code-dot code-dot-green"></span>
    <span class="terminal-title">bash</span>
  </div>
  <div class="terminal-body">
    <span class="terminal-prompt">$ </span><span class="terminal-cmd">git clone https://github.com/example/repo</span><br>
    <span class="terminal-output">Cloning into 'repo'...</span><br>
    <span class="terminal-success">✓ Done in 1.2s</span>
  </div>
</div>
```

### J. Quote block
```html
<div class="quote-block">
  <div class="quote-text">Open source is not only a software development method, but also a spirit of collaboration.</div>
  <div class="quote-author">— Linus Torvalds</div>
</div>
```

### K. Step progress indicator
```html
<div class="step-indicator">
  <div class="step-dot done">1</div>
  <div class="step-line done"></div>
  <div class="step-dot active">2</div>
  <div class="step-line"></div>
  <div class="step-dot">3</div>
</div>
```

### L. Large section-number background
```html
<!-- Place inside .slide-container with absolute positioning -->
<div class="section-number">02</div>
```
Creates an oversized pale-orange numeric background decoration.

---

## 5. Dedicated Layout Types (8 Types)

### 1. Cover Page (Dark)
- Background: `slide-container-dark`, dark gradient `#1a1a1a -> #2c1a00`.
- Left side adds a wide triangle bar `triangle-bar-wide` + large triangle `triangle-accent-lg`.
- Upper-right GOTC logo (white version).
- Center: conference event tag (orange pill) + main title `cover-title` + subtitle `cover-subtitle`.
- Lower right: speaker name and company in small white text.
- Background: `bg-glow-tr` orange glow.

### 2. Speaker Intro Page
- Left triangle accent bar `triangle-bar` + `triangle-accent`.
- Header bar `page-header`.
- Left side (45%): `avatar-lg` circular avatar with orange border + name/title/company + `section-divider-gradient`.
- Right side (55%): `numbered-list` highlight list + `social-link` social link + `qr-wrap` QR code.
- Bottom: `page-footer` with logos on both sides.

### 3. Two-Column Key Points Page
- Left triangle accent bar.
- Header bar.
- Main body: `grid-2col`, with each column containing `section-divider-gradient` + a `point-item` list with numbered `badge-number` badges.
- Bottom info bar.

### 4. Three-Step Page
- Header bar.
- Main body: `grid-3col`, with each `card-step` containing a floating `card-step-number`.
- Inside each card: `badge-icon-lg` + title + description + `tag` label.
- Between cards: connecting arrows (`→`, orange).
- Suitable for: three steps for open-source contribution / three stages of technology evolution / product launch process.

### 5. Timeline page Timeline
- Header bar.
- Main body: horizontal `.timeline` with an orange track and `timeline-dot-lg` nodes.
- Each node: `timeline-year` (large orange text) + `timeline-title` + `timeline-desc`.
- Current node uses `card-highlight` for background emphasis.
- Bottom info bar.
- Suitable for: open-source project history / version evolution / AI development stages.

### 6. Big-number KPI page KPI
- Top: title + core argument (`tag-solid` label).
- Main body: 3-4 `kpi-card` items arranged horizontally with `grid-3col` or `grid-4col`.
- Number: `kpi-number-lg` (80-120px, bold orange) + `kpi-trend-up` trend indicator.
- Bottom: data source in small text.

### 7. Code Demo Page (Open-Source Specific)
- Header bar.
- Main body: left side (55%) uses a `code-block` or `terminal`.
- Right side (45%): key-point explanation card (`card-left-border`) + `bullet-list`.
- Code blocks use a dark background to contrast with the white page.
- Suitable for: API usage display / core code from an open-source project / architecture command demo.

### 8. Closing page Closing
- Centered layout with `bg-glow-center` large glow.
- Left triangle accent bar.
- Large title (`hero-text-gradient` orange gradient text) + secondary text.
- `qr-wrap` QR code + `social-link` community link.
- `tag` label group for topic tags.
- Bottom: logos on both sides.

---

## 6. Radius and Shadow Spec

| Element | Radius | Shadow |
|------|------|------|
| Regular card | 12px | `0 4px 20px rgba(255,153,51,0.08)` |
| Primary card | 12px | `0 8px 36px rgba(255,153,51,0.18)` |
| Bordered card | 12px | None, 3px orange border |
| KPI card | 12px | Same as regular card, with 4px orange top border |
| Code block | 12px | None, 1px translucent orange border |
| Tags/pills | 100px | None |
| Avatar | 50% (circle) | `0 0 0 6px rgba(255,153,51,0.12)` |
| Step card hover | 12px | `0 12px 48px rgba(255,153,51,0.28)` |
| Avoid | >20px | colored shadow |

---

## 7. ECharts Chart Spec

### Palette
```javascript
color: ['#FF9933', '#FFB84D', '#E67700', '#FDD8A0', '#F97316', '#FB923C']
```

### Global Config Template
```javascript
const gotcTheme = {
  backgroundColor: 'transparent',
  textStyle: { fontFamily: 'Noto Sans SC', color: '#2c3e50' },
  title: {
    textStyle: { color: '#1a1a1a', fontSize: 24, fontWeight: 'bold' },
    subtextStyle: { color: '#5a6c7d', fontSize: 16 }
  },
  legend: { textStyle: { color: '#5a6c7d', fontSize: 16 } },
  tooltip: {
    backgroundColor: '#2c3e50',
    borderColor: '#FF9933',
    textStyle: { color: '#ffffff', fontSize: 15 }
  }
};
```

### Bar Chart (Data Comparison)
```javascript
option = {
  color: ['#FF9933'],
  grid: { top:60, right:40, bottom:60, left:80, containLabel:true },
  xAxis: { type:'category', axisLabel:{ color:'#5a6c7d', fontSize:18 }, axisLine:{ lineStyle:{ color:'#e8e8e8' } } },
  yAxis: { type:'value', splitLine:{ lineStyle:{ color:'rgba(255,153,51,0.1)', type:'dashed' } }, axisLabel:{ color:'#5a6c7d', fontSize:18 } },
  series: [{ type:'bar', barMaxWidth:60, itemStyle:{ borderRadius:[6,6,0,0], color:{ type:'linear',x:0,y:0,x2:0,y2:1, colorStops:[{offset:0,color:'#FFB84D'},{offset:1,color:'#FF9933'}] } } }]
};
```

### Line Chart (Trend Analysis)
```javascript
option = {
  color: ['#FF9933','#FFB84D'],
  grid: { top:60, right:40, bottom:60, left:80, containLabel:true },
  xAxis: { type:'category', boundaryGap:false, axisLabel:{ color:'#5a6c7d', fontSize:18 } },
  yAxis: { type:'value', splitLine:{ lineStyle:{ color:'rgba(255,153,51,0.1)', type:'dashed' } } },
  series: [{ type:'line', smooth:true, lineStyle:{ width:4 }, areaStyle:{ color:{ type:'linear',x:0,y:0,x2:0,y2:1, colorStops:[{offset:0,color:'rgba(255,153,51,0.3)'},{offset:1,color:'rgba(255,153,51,0)'}] } } }]
};
```

### Pie Chart (Share Distribution)
```javascript
option = {
  color: ['#FF9933','#FFB84D','#E67700','#FDD8A0','#F97316'],
  series: [{
    type:'pie', radius:['40%','70%'], center:['50%','50%'],
    label:{ fontSize:18, color:'#2c3e50' },
    itemStyle:{ borderRadius:8, borderColor:'#fff', borderWidth:3 }
  }]
};
```

### Radar Chart (Capability Comparison )
```javascript
option = {
  color: ['#FF9933'],
  radar: {
    indicator: [], // dimension names and maximum values
    splitArea: { areaStyle: { color: ['rgba(255,153,51,0.02)', 'rgba(255,153,51,0.05)'] } },
    splitLine: { lineStyle: { color: 'rgba(255,153,51,0.2)' } },
    axisLine:  { lineStyle: { color: 'rgba(255,153,51,0.3)' } },
    name: { textStyle: { color: '#5a6c7d', fontSize: 18 } }
  },
  series: [{
    type: 'radar',
    areaStyle: { color: 'rgba(255,153,51,0.15)' },
    lineStyle: { color: '#FF9933', width: 3 },
    itemStyle: { color: '#FF9933' }
  }]
};
```

---

## 8. AI Illustration Generation Spec

### Style Keywords
```
open source tech conference, warm orange accent (#FF9933), clean white background,
developer community, collaborative, energetic, modern, professional, 16:9 ratio
```

### image_search Keyword Strategy

| Usage | Recommended keywords |
|------|-----------|
| Open-source community | `open source community collaboration`, `developer conference`, `GitHub contribution` |
| Technical architecture | `software architecture diagram`, `cloud native`, `container orchestration` |
| Developers | `developer hackathon`, `open source contributors`, `coding team` |
| Data trends | `technology growth chart`, `software adoption curve orange` |
| Conference scene | `tech conference stage`, `developer summit`, `GOTC conference` |
| Code/terminal | `terminal code screen dark`, `programming laptop developer` |

### Image Generation Prompt Example

**content illustration**
```
[topic description], open source tech conference style, clean white background, warm orange #FF9933 accent elements, developer community feel, modern and energetic, 16:9
```

### Notes
- Prefer white or light backgrounds that match the overall template style.
- Avoid images dominated by deep blue to distinguish this template from the AICon template.
- Open-source related screenshots such as GitHub or code interfaces can be used directly.
- Avoid cartoonish or overly playful illustrations; keep a professional tech-conference feel.
