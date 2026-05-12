# Neo-Brutalism Bold Visual Spec

## 1. Core Design Concept

- **Hard-border architecture**: All cards and containers use consistent 4-8px solid black borders plus offset solid black shadows (`box-shadow: 8-16px 8-16px 0 #000`) to create a print-like, forceful material quality.
- **High-contrast palette**: Gray-white base (`#F4F4F0`) + pure black (`#000`) + flame red (`#D92D20`) + gold (`#FFD700`) for maximum contrast, with no soft gradients.
- **Ultra-heavy typography**: Titles use `font-weight: 900` throughout, 64-140px sizing, and tight `letter-spacing` (`-2px`) for strong visual impact.
- **Handmade-feel decoration**: Slightly rotated cards (`rotate: ±1-2deg`), yellow `highlight-text` marks, and black data blocks with white text simulate a clipped editorial collage style.

---

## 2. Color Specification

```css
:root {
  /* Backgrounds */
  --bg-primary:    #F4F4F0;   /* Gray-white primary background */
  --bg-card:       #FFFFFF;   /* White card background */
  --bg-dark:       #000000;   /* Dark cards / data blocks */
  --bg-yellow:     #FFD700;   /* Yellow emphasis blocks */
  --bg-gray:       #F0F0F0;   /* Secondary gray blocks */

  /* Brand colors */
  --color-primary:   #D92D20; /* Flame red - core accent */
  --color-black:     #000000; /* Pure black - borders / shadows / titles */
  --color-yellow:    #FFD700; /* Gold - highlights / data */

  /* Text */
  --text-primary:    #000000;
  --text-secondary:  #333333;
  --text-muted:      #666666;
  --text-on-dark:    #FFFFFF;
  --text-on-yellow:  #000000;

  /* Borders */
  --border-thin:   4px solid #000000;
  --border-normal: 5px solid #000000;
  --border-thick:  8px solid #000000;
  --border-red:    4px solid #D92D20;

  /* Shadows (offset solid) */
  --shadow-sm:   6px 6px 0 #000000;
  --shadow-md:   10px 10px 0 #000000;
  --shadow-lg:   16px 16px 0 #000000;
  --shadow-red:  10px 10px 0 #D92D20;

  /* Radius */
  --radius-none: 0px;  /* No radius globally */
}
```

---

## 3. Typography Specification

| Level | Size | Weight | Color | Notes |
|------|------|------|------|------|
| Hero title | 120-140px | 900 | #000 | `letter-spacing: -2px`, cover only |
| Page title | 64px | 900 | #000 | `letter-spacing: -2px` |
| Subtitle | 32px | 700 | #444 | With 6px red left border |
| Card title | 40-52px | 900 | #000 or accent color |  |
| Body | 22-26px | 500 | #333 | `line-height: 1.5` |
| Small notes | 18-20px | 400 | #666 |  |
| Large data text | 32-48px | 900 | #FFD700 on black or #000 on white | KPI only |

Font stack: `'Noto Sans SC', sans-serif`

**Font import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap" rel="stylesheet"/>
```

---

## 4. Decorative Element Specification

### Black Section Tag (section-tag)
```html
<div class="section-tag">章节名称</div>
```
```css
.section-tag {
  display: inline-block;
  background-color: #000;
  color: #fff;
  padding: 6px 20px;
  font-size: 24px;
  font-weight: 700;
  border: 4px solid #000;
  align-self: flex-start;
}
```

### Yellow Highlight Text (highlight-text)
```html
<span class="highlight-text">关键词</span>
```
```css
.highlight-text {
  background-color: #FFD700;
  padding: 0 8px;
  font-weight: 700;
}
```

### Subtitle with Red Left Border (subtitle-bar)
```html
<div class="subtitle-bar">副标题文字</div>
```
```css
.subtitle-bar {
  font-size: 32px;
  font-weight: 700;
  color: #444;
  border-left: 6px solid #D92D20;
  padding-left: 20px;
  line-height: 1.4;
}
```

### Offset Solid Shadow Card (neo-card)
```html
<div class="neo-card">内容</div>
```
```css
.neo-card {
  background: #fff;
  border: 5px solid #000;
  box-shadow: 10px 10px 0 #000;
  padding: 32px;
}
```

### Black Data Block (data-item)
```html
<div class="data-item">
  <div class="data-value">99%</div>
  <div class="data-label">指标说明</div>
</div>
```
```css
.data-item {
  border: 3px solid #000;
  padding: 10px 15px;
  background: #000;
  color: #fff;
}
.data-value { font-size: 32px; font-weight: 900; color: #FFD700; line-height: 1; }
.data-label { font-size: 14px; opacity: 0.8; margin-top: 4px; }
```

### Slightly Rotated Image Container (image-wrapper)
```css
.image-wrapper {
  border: 8px solid #000;
  box-shadow: 20px 20px 0 #000;
  background-color: #fff;
  padding: 10px;
  transform: rotate(1deg);
}
```

### Red Image Sticker Label (image-tag)
```css
.image-tag {
  position: absolute;
  top: -20px; right: 30px;
  background-color: #D92D20;
  color: #fff;
  padding: 8px 24px;
  font-size: 20px;
  font-weight: 900;
  border: 4px solid #000;
  transform: rotate(2deg);
}
```

---

## 5. Dedicated Layout Types

### Type 1: Cover (cover)
- Left side: oversized title (140px/900) + content area with thick red left border + black info box with white text (`neo-brutalism-box`)
- Right side: full-height background image or mascot image
- Top: black conference/brand banner tag
- Bottom: black info box with dashed divider

### Type 2: Section Cover (section-cover)
- Full-screen background image with optional translucent overlay
- Centered oversized section number (100px, black)
- Section name (80px, 900, white or black)
- Bottom black tag describing the section topic

### Type 3: Key Point (key-point)
- Top: black `section-tag` + 64px main title + subtitle with red left border
- Left column (45%): large white `neo-card` containing the key argument
- Right column (55%): two comparison boxes (`comparison-box`, alternating black/white) connected with an arrow

### Type 4: Grid Panorama (grid-panorama)
- 3x3 grid, each cell is a `scope-card`
- Card color variants: white default, red accent (`accent-red`), black (`accent-black`), gold (`accent-yellow`), and light gray (`accent-gray`)
- Each card contains a large title (52px), subtitle, body description, and low-opacity background icon

### Type 5: Image + Text (image-text)
- Left column (35%): `section-tag` + main title + insight card (`insight-card`) + data row (`data-row`) + quote box
- Right column (65%): slightly rotated large image (`image-wrapper`) + red sticker label (`image-tag`)

### Type 6: Data Dashboard (data-dashboard)
- Top: title area (`section-tag` + main title)
- Body: 2-4 column grid of data cards
- Data cards: black data value blocks with gold text (`data-item`) + white explanatory text blocks
- Bottom: horizontal progress bar or contrasting color blocks

### Type 7: Timeline / Flow (timeline-flow)
- Top: title area
- Body: horizontal timeline with thick black line and circular nodes
- Node cards: white `neo-card` with numbered badge, title, and description
- Key nodes use red or yellow emphasis

### Type 8: Closing (closing)
- Background: gray-white `#F4F4F0` or full black
- Large thank-you text (80-100px, 900)
- QR code/contact info: `neo-brutalism-box` with black border and white background
- Red decorative line or brand-color blocks as accents

---

## 6. Radius and Shadow Specification

| Element | Radius | Shadow |
|------|------|------|
| All cards | 0px, no rounding | 8-16px offset solid black |
| Tags / badges | 0px | None or 4px offset |
| Image containers | 0px | 20px offset solid black |
| Data blocks | 0px | None |
| Emphasis boxes | 0px | Offset red (`10px 10px 0 #D92D20`) |

---

## 7. ECharts Chart Specification

### Palette
```js
color: ['#D92D20', '#000000', '#FFD700', '#666666', '#F0F0F0', '#333333']
```

### Global Configuration
```js
{
  backgroundColor: 'transparent',
  textStyle: { fontFamily: 'Noto Sans SC', color: '#000', fontWeight: 700 },
  grid: { borderWidth: 2, borderColor: '#000', containLabel: true },
}
```

### Bar Chart Example
```js
{
  xAxis: { axisLine: { lineStyle: { color: '#000', width: 3 } }, axisTick: { show: false } },
  yAxis: { splitLine: { lineStyle: { color: '#ddd', type: 'dashed' } } },
  series: [{
    type: 'bar',
    barWidth: '60%',
    itemStyle: {
      color: '#D92D20',
      borderColor: '#000',
      borderWidth: 2,
    },
    label: { show: true, position: 'top', fontWeight: 900, color: '#000' }
  }]
}
```

### Line Chart Example
```js
series: [{
  type: 'line',
  lineStyle: { color: '#000', width: 4 },
  itemStyle: { color: '#FFD700', borderColor: '#000', borderWidth: 3 },
  symbol: 'rect', symbolSize: 12,
  areaStyle: { color: 'rgba(217,45,32,0.08)' }
}]
```

### Pie Chart Example
```js
series: [{
  type: 'pie',
  radius: ['35%', '65%'],
  itemStyle: { borderColor: '#000', borderWidth: 3 },
  label: { fontWeight: 900, color: '#000', fontSize: 20 }
}]
```

---

## 8. AI Illustration Generation Specification

### Style Keywords
`neo-brutalism, bold black border, offset shadow, flat color, editorial design, high contrast, black and white with red accent, poster style, no gradient, geometric`

### image_search Strategy
- Add these search terms: `neo brutalism design`, `bold editorial poster`, `flat graphic illustration`
- Avoid gradient backgrounds, 3D effects, and soft-toned images
- Prefer high-contrast, strongly geometric illustrations or object photos with black outlines

### generate_images Example Prompt
```
Neo-brutalism style flat illustration, bold black 4px outline on all elements, 
offset drop shadow in solid black, primary colors (red #D92D20, yellow #FFD700, black, white), 
no gradients, no rounded corners, editorial magazine poster aesthetic, 
subject: [具体主题], white background, high contrast
```
