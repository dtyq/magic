# Neon Geometric (Creative Flat) Visual Spec

## 1. Core Design Principles

- **Bold color clashes:** Flame orange (#FF4D1C) x creative purple (#6C27D9), with high-saturation contrast that conveys energy and an avant-garde feel.
- **Geometric composition:** Large color blocks, diagonal cuts, and circular decorations use pure geometric shapes to build layout rhythm.
- **Hard-edged flatness:** Strictly no shadows, or only offset shadows; no gradients; hierarchy is built with solid color blocks.
- **Visual impact first:** Every page must include one "visual bomb": oversized type, a full color background block, or a geometric decoration.

---

## 2. Color Specifications

```css
:root {
  --orange:       #FF4D1C;
  --orange-mid:   #FF7043;
  --orange-light: #FFF0EB;
  --purple:       #6C27D9;
  --purple-mid:   #9B59E8;
  --purple-light: #F2EAFF;
  --yellow:       #FFD000;
  --teal:         #00C9A7;
  --bg-dark:      #1A1025;
  --text-primary: #1A1025;
  --text-secondary:#5C5470;
  --border-color: #E2DDF0;
}
```

---

## 3. Typography Specifications

| Level | Size | Weight | Color |
|------|------|------|------|
| Main title | 72–96px | 900 | --orange or --purple(use white on dark backgrounds)|
| Content title | 44–56px | 800 | --text-primary，6px color-block vertical line on the left |
| subtitle | 28–36px | 600 | --text-secondary |
| Body | 22–26px | 400 | --text-secondary，line-height:1.7 |
| Data highlight | 72–96px | 900 | --orange or --purple |
| Auxiliary tag | 16–20px | 700 | uppercase, white text on colored background |

Font family:`'Noto Sans SC', sans-serif`

**Font import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap" rel="stylesheet"/>
```

---

## 4. Decorative Element Specifications

**A. Large circular background decoration** (position:absolute, pointer-events:none):
```html
<div style="position:absolute;top:-120px;right:-80px;width:480px;height:480px;
  border-radius:50%;background:var(--orange);opacity:0.08;pointer-events:none;"></div>
```

**B. Diagonal color-block sections:**
```css
/* Left diagonal cut */
clip-path: polygon(0 0, 100% 0, 92% 100%, 0 100%);
/* Right diagonal cut */
clip-path: polygon(8% 0, 100% 0, 100% 100%, 0 100%);
```

**C. Geometric dot-matrix texture** (background decoration):
```css
background-image: radial-gradient(var(--orange) 1.5px, transparent 1.5px);
background-size: 28px 28px; opacity: 0.08;
```

**D. Offset-shadow card** (strong design feel):
```css
border: 3px solid var(--text-primary);
box-shadow: 6px 6px 0 var(--orange);
/* Purple version */
box-shadow: 6px 6px 0 var(--purple);
```

**E. Large quote mark:**
```html
<div style="font-size:200px;font-weight:900;line-height:0.8;
  color:var(--orange);opacity:0.15;font-family:Georgia,serif;">"</div>
```

---

## 5. Dedicated Layout Types (8 Types)

### 1. Cover
- Left (40%): large orange diagonal color block containing the white brand/project name in bold
- Right (60%): dark background, oversized white main title (96px), subtitle, and yellow accent line at the bottom
- Lower-right: purple circular decoration (translucent)

### 2. Large Image Mood Board
- Full-screen: 3x2 image grid with no gaps; each cell overlays a translucent color mask
- Upper-left: orange rectangular label ("MOOD BOARD", white uppercase text)
- Bottom: dark horizontal bar with white explanatory text

### 3. Full-screen Quote
- Background: dark (bg-dark) + dot matrix texture (orange dots, opacity:0.06)
- Center: large quote mark (orange, 200px) + quote body (white, 52px, centered)
- Bottom: speaker/source separated by a thin orange line

### 4. Brand Colors Showcase
- Top: title (brand/visual guidelines)
- Main body: large horizontal color blocks (each about 1/5 width), with color value + name + purpose below
- Bottom: font showcase area (main font name + weight samples)

### 5. Split Compare
- Left half (orange background): Option A, white title + points
- Right half (purple background): Option B, white title + points
- Center: white vertical line + white square "VS" label

### 6. Card Grid
- 3x2 card grid with no gaps, alternating orange/purple/dark/white backgrounds
- Each card: large number (96px) + explanatory text (22px)

### 7. Section
- Full-screen deep purple background (bg-dark) + dot matrix texture
- Center: oversized translucent white section number (320px, opacity:0.06)
- Foreground: orange rectangular label (section number) + white section name (72px)

### 8. Ending
- Left (45%): large orange color block (diagonal cut) containing brand name/slogan in white
- Right (55%): dark background, contact information, yellow accent line at bottom

---

## 6. Radius Specifications

| Element | Radius |
|------|------|
| Cards/color blocks | 0 (hard-edged square, core style)|
| Special containers | 4px (occasional use)|
| Tags/badges | 0 |
| Forbidden | >6px |

---

## 7. ECharts Chart Specifications

### Palette
```javascript
color: ['#FF5C35', '#7C3AED', '#FFD600', '#00BFA5', '#1A1A2E', '#6B7280']
```

### Global Config Template
```javascript
const flatTheme = {
    backgroundColor: '#FAFAFA',
    textStyle: { color: '#1A1A2E', fontFamily: 'Noto Sans SC, sans-serif' },
    title: {
        textStyle: { color: '#1A1A2E', fontSize: 28, fontWeight: 'bold' },
        subtextStyle: { color: '#6B7280', fontSize: 18 }
    },
    legend: { textStyle: { color: '#6B7280', fontSize: 18 } },
    categoryAxis: {
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisTick: { show: false },
        axisLabel: { color: '#6B7280', fontSize: 16 },
        splitLine: { show: false }
    },
    valueAxis: {
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#9CA3AF', fontSize: 16 },
        splitLine: { lineStyle: { color: '#F3F4F6' } }
    },
    tooltip: {
        backgroundColor: '#1A1A2E',
        borderColor: '#FF5C35',
        borderWidth: 2,
        textStyle: { color: '#FFFFFF', fontSize: 16 }
    }
};
```

### Bar chart (flat solid-color style)
```javascript
option = {
    backgroundColor: '#FAFAFA',
    color: ['#FF5C35', '#7C3AED', '#FFD600'],
    grid: { top: 80, bottom: 60, left: 80, right: 40, containLabel: true },
    xAxis: {
        type: 'category',
        axisLabel: { color: '#6B7280', fontSize: 18 },
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisTick: { show: false }
    },
    yAxis: {
        type: 'value',
        axisLabel: { color: '#9CA3AF', fontSize: 16 },
        splitLine: { lineStyle: { color: '#F3F4F6' } },
        axisLine: { show: false }
    },
    series: [{
        type: 'bar',
        barWidth: '45%',
        itemStyle: { borderRadius: [0, 0, 0, 0] },  /* flat, no radius */
        label: { show: true, position: 'top', color: '#1A1A2E', fontSize: 18, fontWeight: 'bold' }
    }]
};
```

### Pie chart (flat color-clash style)
```javascript
option = {
    backgroundColor: '#FAFAFA',
    color: ['#FF5C35', '#7C3AED', '#FFD600', '#00BFA5', '#1A1A2E'],
    series: [{
        type: 'pie',
        radius: ['0%', '65%'],  /* solid pie chart, flatter */
        center: ['50%', '55%'],
        label: {
            fontSize: 18,
            color: '#1A1A2E',
            formatter: '{b}\n{d}%',
            fontWeight: 'bold'
        },
        labelLine: { lineStyle: { color: '#E5E7EB', width: 2 } },
        itemStyle: { borderWidth: 3, borderColor: '#FAFAFA' }
    }]
};
```

### Horizontal bar chart (comparison display)
```javascript
option = {
    backgroundColor: '#FAFAFA',
    color: ['#FF5C35'],
    grid: { top: 40, bottom: 40, left: 40, right: 80, containLabel: true },
    xAxis: {
        type: 'value',
        axisLabel: { color: '#9CA3AF', fontSize: 16 },
        splitLine: { lineStyle: { color: '#F3F4F6' } },
        axisLine: { show: false }
    },
    yAxis: {
        type: 'category',
        axisLabel: { color: '#1A1A2E', fontSize: 18, fontWeight: 'bold' },
        axisLine: { show: false },
        axisTick: { show: false }
    },
    series: [{
        type: 'bar',
        barWidth: '55%',
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', color: '#1A1A2E', fontSize: 16, fontWeight: 'bold' }
    }]
};
```

---

## 8. AI Illustration Generation Specifications

### Style Keywords
When using `generate_images`, add the following style modifiers to the prompt:
```
flat design illustration, bold geometric shapes, vibrant orange and purple color palette,
no shadows no gradients, clean vector art style, modern graphic design,
high contrast colors, playful creative aesthetic
```

### image_search Keyword Strategy

| Use Case | Recommended Keywords |
|------|-----------|
| Cover/background | `bold geometric abstract art`, `flat design colorful background`, `modern graphic poster design` |
| People/illustration | `flat illustration people working`, `vector character design colorful`, `isometric people office` |
| Brand/product | `bold product photography colorful background`, `creative brand identity design`, `packaging design vibrant` |
| Icon/decoration | `flat icon set colorful`, `geometric pattern bold colors`, `abstract shape composition` |

### Image Generation Prompt Examples

**Cover background (geometric composition)**
```
bold flat design background, large geometric shapes, vibrant orange #FF5C35 and purple #7C3AED color blocks, no gradients no shadows, clean graphic design composition, 16:9 wide format, no text
```

**Illustration (flat people/scene)**
```
flat vector illustration of [具体场景], bold colors orange and purple palette, no shadows, geometric simplified style, white background, modern graphic design
```

**Icon/decorative elements**
```
flat icon [具体图标主题], bold orange and purple, minimal geometric shape, white background, vector style, no gradients
```

### Notes
- The creative flat style should **avoid** photorealistic photography, complex textures, soft gradients, and shadow effects
- If using real photos (`image_search`), add `filter: saturate(1.3) contrast(1.1)` in CSS to increase saturation and match the style
- Prefer pure CSS/HTML for geometric decorations (div + clip-path); images do not need to be generated every time
