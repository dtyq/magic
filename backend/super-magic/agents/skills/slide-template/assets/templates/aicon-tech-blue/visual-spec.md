# Rotating Halo Blue (aicon-tech-blue) Visual Specification

## 1. Core Design Concept

- **Professional and restrained**: use a white background with a light gray gradient, avoid visual clutter, and keep the focus on the content itself for a serious tech conference setting.
- **Blue-led system**: use #2F80ED as the only emphasis color across number badges, dividers, tags, and KPI numbers.
- **Dynamic tech feel**: use rotating dashed rings as background decoration to add a technical feel without overpowering the content.
- **Conference identity**: reserve logo areas on both sides of the bottom edge for AICon and similar tech conference contexts.

---

## 2. Color Specification

```css
:root {
  --bg-primary:   #ffffff;
  --bg-secondary: linear-gradient(135deg, #fef9f3 0%, #ffffff 100%);
  --bg-subtle:    linear-gradient(135deg, #ffffff 0%, #efefef 100%);
  --bg-card:      #f8faff;
  --bg-dark:      #0f172a;

  --color-primary:        #2F80ED;
  --color-primary-light:  rgba(47, 128, 237, 0.12);
  --color-primary-border: rgba(47, 128, 237, 0.3);
  --color-secondary:      #1E40AF;
  --color-accent:         #60A5FA;

  --text-primary:   #1a1a1a;
  --text-secondary: #333333;
  --text-muted:     #5a6c7d;
  --text-light:     #8fa3b8;
  --text-on-dark:   #ffffff;

  --border-color:  rgba(47, 128, 237, 0.2);
  --border-strong: #2F80ED;
  --border-subtle: #e5eaf0;
}
```

---

## 3. Typography and Layout Specification

| Level | Size | Weight | Color |
|------|------|------|------|
| Hero title | 96px | 900 | --text-primary |
| Page title | 64px | 700 | --text-secondary, letter-spacing:2px |
| Subtitle | 48px | 700 | --text-secondary |
| Section heading | 36px | 700 | --text-secondary, with blue divider |
| Body text | 28px | 400 | --text-muted, line-height:1.6 |
| Small text | 22px | 400 | --text-muted |
| Note/source | 18px | 400 | --text-light |
| KPI number | 80px | 900 | --color-primary |

Font family: `'Noto Sans SC', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif`

**Font import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap" rel="stylesheet"/>
```

---

## 4. Decorative Element Specification

**A. Rotating dashed ring background** (centered, z-index=1, does not cover content):
```html
<div class="bg-rings">
  <div class="bg-ring bg-ring-1"></div>
  <div class="bg-ring bg-ring-2"></div>
</div>
```
```css
.bg-ring {
  border-radius: 50%;
  border: 2px dashed rgba(47, 128, 237, 0.15);
  animation: rotate-ring 40s linear infinite;
}
.bg-ring-2 { animation-duration: 50s; animation-direction: reverse; }
@keyframes rotate-ring { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
```

**B. Diagonal glow** (top right + bottom left):
```html
<div class="bg-glow bg-glow-tl"></div>
<div class="bg-glow bg-glow-bl"></div>
```
```css
.bg-glow { position:absolute; border-radius:50%; filter:blur(80px); pointer-events:none; }
.bg-glow-tl { width:600px; height:600px; background:radial-gradient(circle, rgba(30,64,175,0.06) 0%, transparent 70%); top:-200px; right:-200px; }
.bg-glow-bl { width:500px; height:500px; background:radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%); bottom:-150px; left:-150px; }
```

**C. Blue vertical title bar**:
```html
<span class="title-bar"></span>Page Title
```
```css
.title-bar { width:8px; height:60px; background:linear-gradient(135deg,#2F80ED,#1E40AF); border-radius:0 4px 4px 0; display:inline-block; margin-right:16px; vertical-align:middle; }
```

**D. Bottom conference logo**:
```html
<img src="images/conf-logo-bottom-right.png" class="conf-logo-bottom-right"/>
<img src="images/conf-logo-bottom-left.png"  class="conf-logo-bottom-left"/>
```
```css
.conf-logo-bottom-right { position:absolute; bottom:35px; right:70px; width:180px; z-index:20; opacity:0.9; }
.conf-logo-bottom-left  { position:absolute; bottom:23px; left:80px;  width:130px; z-index:20; opacity:0.9; }
```

**E. Oversized section-number background text**:
```html
<div style="position:absolute;top:60px;right:80px;font-size:200px;font-weight:900;
  color:rgba(47,128,237,0.05);line-height:1;user-select:none;">01</div>
```

---

## 5. Dedicated Layout Page Types (8)

### 1. Cover Page
- Full-screen cover image as the background (`object-fit:cover`).
- No additional text layer, because the cover image already contains text.
- Suitable for directly using a cover image provided by a designer.

### 2. Speaker Introduction Page
- Background: diagonal glow decoration.
- Left (45%): circular avatar crop plus name, role, and company.
- Right (55%): personal highlight list with blue icon badges plus QR code.
- Bottom: conference logos on both sides.

### 3. Two-Column Key Points Page
- Top: blue vertical title bar plus 64px page title.
- Main body: `grid-2col`; each column contains a blue divider and numbered badge list.
- Bottom: conference logos on both sides.

### 4. Three-Column Comparison Page
- Top: page title.
- Main body: `grid-3col` with three `card` components.
- Suitable for three-stage evolution, such as Chat Era -> Workflow Era -> Agentic Era.

### 5. Big Data KPI Page
- Top: title plus a one-sentence core takeaway.
- Main body: 3-4 `kpi-card` components arranged horizontally.
- Use 80px bold blue numbers with explanatory labels below.

### 6. Image-Text Page
- Left (45%): text content with title and key point list.
- Right (55%): large image/screenshot (`border-radius:12px`).
- Suitable for product feature showcases and case screenshot explanations.

### 7. Code/Architecture Page
- Top: page title.
- Left (55%): dark code block with `bg-dark` background and blue keyword highlighting.
- Right (45%): explanatory key point list.
- Suitable for technical principles, Prompt Caching implementation, and sandbox architecture.

### 8. Closing Page
- Centered layout.
- Large title plus blue gradient subtitle.
- QR code plus contact information.
- Background: rotating rings plus blue glow.
- Bottom: conference logos on both sides.

---

## 6. Corner Radius and Shadow Specification

| Element | Radius | Shadow |
|------|------|------|
| Standard card | 12px | `0 4px 24px rgba(47,128,237,0.1)` |
| Primary card | 20px | `0 8px 40px rgba(47,128,237,0.18)` |
| Number badge | 6px | None |
| Tag/pill | 100px | None |
| Code block | 12px | None |
| Do not use | >20px | Colored shadows |

---

## 7. ECharts Chart Specification

### Palette
```javascript
color: ['#2F80ED', '#60A5FA', '#1E40AF', '#93C5FD', '#BFDBFE', '#1D4ED8']
```

### Global Configuration Template
```javascript
const aiconTheme = {
  backgroundColor: 'transparent',
  textStyle: { fontFamily: 'Noto Sans SC', color: '#333333' },
  title: {
    textStyle: { color: '#1a1a1a', fontSize: 24, fontWeight: 'bold' },
    subtextStyle: { color: '#5a6c7d', fontSize: 16 }
  },
  legend: { textStyle: { color: '#5a6c7d', fontSize: 16 } },
  tooltip: {
    backgroundColor: '#0f172a',
    borderColor: '#2F80ED',
    textStyle: { color: '#ffffff', fontSize: 15 }
  }
};
```

### Bar Chart (Data Comparison)
```javascript
option = {
  color: ['#2F80ED'],
  grid: { top:60, right:40, bottom:60, left:80, containLabel:true },
  xAxis: { type:'category', axisLabel:{ color:'#5a6c7d', fontSize:18 }, axisLine:{ lineStyle:{ color:'#e5eaf0' } } },
  yAxis: { type:'value', splitLine:{ lineStyle:{ color:'rgba(47,128,237,0.1)', type:'dashed' } }, axisLabel:{ color:'#5a6c7d', fontSize:18 } },
  series: [{ type:'bar', barMaxWidth:60, itemStyle:{ borderRadius:[6,6,0,0], color:{ type:'linear',x:0,y:0,x2:0,y2:1, colorStops:[{offset:0,color:'#60A5FA'},{offset:1,color:'#2F80ED'}] } } }]
};
```

### Line Chart (Trend Analysis)
```javascript
option = {
  color: ['#2F80ED','#60A5FA'],
  grid: { top:60, right:40, bottom:60, left:80, containLabel:true },
  xAxis: { type:'category', boundaryGap:false, axisLabel:{ color:'#5a6c7d', fontSize:18 } },
  yAxis: { type:'value', splitLine:{ lineStyle:{ color:'rgba(47,128,237,0.1)', type:'dashed' } } },
  series: [{ type:'line', smooth:true, lineStyle:{ width:4 }, areaStyle:{ color:{ type:'linear',x:0,y:0,x2:0,y2:1, colorStops:[{offset:0,color:'rgba(47,128,237,0.3)'},{offset:1,color:'rgba(47,128,237,0)'}] } } }]
};
```

### Pie Chart (Share Distribution)
```javascript
option = {
  color: ['#2F80ED','#60A5FA','#1E40AF','#93C5FD','#BFDBFE'],
  series: [{
    type:'pie', radius:['40%','70%'], center:['50%','50%'],
    label:{ fontSize:18, color:'#333333' },
    itemStyle:{ borderRadius:8, borderColor:'#fff', borderWidth:3 }
  }]
};
```

---

## 8. AI Illustration Generation Specification

### Style Keywords
```
professional tech conference, clean white background, blue accent (#2F80ED),
AI technology visualization, minimalist corporate, sharp details, 16:9 ratio
```

### image_search Keyword Strategy

| Purpose | Recommended Keywords |
|------|-----------|
| AI technology | `AI technology abstract blue`, `machine learning visualization`, `neural network diagram` |
| Data analysis | `data analytics dashboard blue`, `business intelligence chart` |
| Architecture diagrams | `cloud architecture diagram`, `system design blueprint` |
| People | `tech speaker conference`, `developer coding laptop` |
| Conferences | `tech conference stage`, `developer summit presentation` |

### Image Generation Prompt Examples

**Content Illustration**
```
[主题描述], professional tech conference style, clean white background with subtle blue gradient, modern minimalist, blue #2F80ED accent, high contrast, 16:9
```

### Notes
- Prefer images with white or light gray backgrounds, and avoid dark backgrounds that disrupt the overall style.
- Product screenshots and interface images can be used directly without additional processing.
- Avoid images dominated by orange or green tones to keep this template distinct from others.
