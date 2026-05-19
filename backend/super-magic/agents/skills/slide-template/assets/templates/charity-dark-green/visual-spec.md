# Deep Sea Green Light (charity-dark-green) Visual Spec v2.0

## 1. Core Design Principles

- **Abyss ink base:** The main background is upgraded from `#020617` to `#010b14` (abyss ink blue), paired with radial gradient glow backgrounds for deeper layers and stronger spatial depth.
- **Jade green x dark jade cyan:** The primary color shifts from fluorescent green `#4ade80` to calmer jade green `#2dd4a0`, while the secondary color shifts from bright cyan `#22d3ee` to dark jade cyan `#0ea5c9`, making the palette more restrained and premium overall.
- **Gold accent:** Introduce low-saturation gold `#d4af6a` as a third accent for high-value numbers, medals, and similar elements to add a sense of luxury.
- **Deeper glassmorphism:** Card backgrounds evolve from a single translucent layer into a multi-level glass system (base, green highlight, dark solid, and elevated), with glowing borders that strengthen hierarchy.
- **Micro-textured background:** Optional grid texture `.bg-grid` adds refined detail to dark backgrounds.

---

## 2. Color Specifications

```css
:root {
  /* Background colors */
  --bg-primary:      #010b14;
  --bg-secondary:    #071520;
  --bg-tertiary:     #0c1f30;
  --bg-card:         rgba(255, 255, 255, 0.05);
  --bg-card-hover:   rgba(255, 255, 255, 0.08);
  --bg-card-dark:    rgba(0, 0, 0, 0.45);
  --bg-overlay:      rgba(1, 11, 20, 0.88);
  --bg-glass:        rgba(12, 31, 48, 0.6);

  /* Brand colors (jade green + dark jade cyan) */
  --color-primary:        #2dd4a0;   /* Jade green */
  --color-primary-deep:   #1aaf80;   /* Deep jade */
  --color-primary-light:  rgba(45, 212, 160, 0.18);
  --color-primary-border: rgba(45, 212, 160, 0.35);
  --color-secondary:      #0ea5c9;   /* Dark jade cyan */
  --color-accent:         #5eead4;   /* Light aqua */
  --color-gold:           #d4af6a;   /* Gold accent */

  /* Text colors */
  --text-primary:   #f0f7f4;   /* White with a slight green tint */
  --text-secondary: #b8d4cc;
  --text-muted:     #6b9e8f;
  --text-light:     #3d6b5e;

  /* Gradient presets */
  --gradient-primary:   linear-gradient(135deg, #2dd4a0 0%, #0ea5c9 100%);
  --gradient-text:      linear-gradient(135deg, #2dd4a0 0%, #0ea5c9 100%);
  --gradient-accent:    linear-gradient(135deg, #5eead4 0%, #2dd4a0 60%, #0ea5c9 100%);
  --gradient-gold:      linear-gradient(135deg, #d4af6a 0%, #f0d090 100%);
  --gradient-overlay:   linear-gradient(90deg, rgba(1,11,20,0.92) 0%, rgba(1,11,20,0.72) 45%, rgba(1,11,20,0) 100%);
  --gradient-bg:        radial-gradient(ellipse at 70% 20%, rgba(45,212,160,0.06) 0%, transparent 60%),
                        radial-gradient(ellipse at 20% 80%, rgba(14,165,201,0.05) 0%, transparent 50%),
                        #010b14;

  /* Shadows */
  --shadow-card:   0 4px 24px rgba(0, 0, 0, 0.4);
  --shadow-strong: 0 8px 48px rgba(0, 0, 0, 0.55);
  --shadow-glow:   0 0 48px rgba(45, 212, 160, 0.12);
  --shadow-inset:  inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
```

### Color Usage Principles

| Purpose | Color |
|------|------|
| Gradient hero titles, KPI numbers | `--gradient-text`(jade green to dark jade cyan) |
| High-value numbers, medals | `--gradient-gold`(gold) |
| Card border highlight | `--border-green`(low-opacity green) |
| Secondary emphasis | `--color-secondary`(dark jade cyan) |
| Muted text and descriptions | `--text-muted`(dark gray-green) |
| Background glow decoration | green 7% + cyan 6%, kept restrained |

---

## 3. Typography Specifications

| Level | Size | Weight | Color |
|------|------|------|------|
| Hero title | 136px | 900 | `--gradient-text` gradient |
| Display number | 100px | 900 | `--gradient-text` or `--gradient-gold` |
| Page title | 68px | 700 | `--text-primary`(white) |
| Subtitle | 52px | 300 | `--text-secondary` |
| Section heading | 36px | 700 | `--text-primary` |
| Subheading | 30px | 600 | `--text-primary` |
| Body | 26px | 400 | `--text-secondary`，line-height: 1.75 |
| Small text | 22px | 400 | `--text-muted` |
| Tags/badges | 18px | 600 | follows component color |
| Micro text | 15px | 500 | `--text-light` |

**Gradient text pattern:**
```css
.text-gradient {
  background: var(--gradient-text);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

**Font family:** `'Noto Sans SC', 'PingFang SC', sans-serif`
**Monospace font:** `'JetBrains Mono', 'Fira Code', monospace`

**Font import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700;900&display=swap" rel="stylesheet"/>
```

---

## 4. Decorative Element Specifications

### A. Gradient Background (default slide-container background)
```css
background: radial-gradient(ellipse at 70% 20%, rgba(45,212,160,0.06) 0%, transparent 60%),
            radial-gradient(ellipse at 20% 80%, rgba(14,165,201,0.05) 0%, transparent 50%),
            #010b14;
```

### B. Background Glow (multi-layered)
```html
<div class="bg-shape shape-green"></div>   <!-- large upper-right glow -->
<div class="bg-shape shape-cyan"></div>    <!-- medium lower-left glow -->
<div class="bg-shape shape-gold"></div>    <!-- subtle lower-right gold glow -->
```

### C. Grid Texture (refined details)
```html
<div class="bg-grid"></div>
```
Opacity is extremely low (3%); it is only visible on dark backgrounds, adding refinement without overwhelming the design.

### D. Top Navigation Bar
```html
<div class="slide-header">
  <div class="slide-header-title">Section title</div>
  <div class="tag-pill">Tag</div>
</div>
```

### E. Bottom Footer
```html
<div class="slide-footer">
  <span class="slide-footer-text">Organization name</span>
  <span class="slide-footer-text">12 / 30</span>
</div>
```

### F. Left Gradient Overlay (cover/image-text pages)
```html
<div class="gradient-overlay"></div>
```
Width is 62%, fading from `rgba(1,11,20,0.92)` to transparent.

### G. Section Label (section-label)
```html
<div class="section-label">Core value</div>
```
Includes a short gradient line decoration on the left and uppercase letter spacing.

### H. Gradient Dividers
```html
<div class="divider-gradient"></div>  <!-- full-width gradient line -->
<div class="divider-short"></div>     <!-- short thick gradient line below heading -->
```

### I. Glass Logo Area
```html
<div class="logo-glass">
  <span style="color:#2dd4a0;font-size:28px;">🌿</span>
  <span style="color:#fff;font-size:28px;font-weight:700;letter-spacing:0.1em;">Charity Brand</span>
</div>
```

---

## 5. Dedicated Layout Types (8 Types)

### 1. Cover
- Full-screen background image (charity/nature/people)
- Left 62% gradient overlay (abyss ink to transparent)
- Upper-right: glassmorphism logo area
- Left content area: green pill tag + gradient hero title (136px) + white subtitle + 2-3 feature cards
- Background: green/cyan/gold glow + optional grid texture

### 2. Core Value
- Dark background + layered glow
- Top: slide-header (gradient title)
- Left (45%): section-label + gradient main title + key point list (green dots + explanatory text)
- Right (55%): large image or data visualization inside a glass-card-green container
- Bottom: slide-footer

### 3. Case Study
- Top: slide-header
- Main body: 3-column glass-card layout (each with image placeholder + title + description + badge tag)
- Cards highlight their border in green on hover
- Bottom: slide-footer

### 4. Dashboard
- Top: slide-header
- Main body: left (60%) large image/chart area (img-frame-glow) + right 3-4 vertically stacked kpi-card elements
- KPI numbers: jade green gradient; important numbers may use the gold gradient
- Bottom: slide-footer

### 5. Comparison
- Top: slide-header
- Main body: two columns (compare-card-before / compare-card-after)
- Optional vertical gradient divider in the middle
- Right side uses green highlighted border + subtle green background glow
- Bottom: slide-footer

### 6. Features
- Top: slide-header
- Main body: left (38%) main title + description + tag-pill + gradient divider
- Right (62%): 2x3 feature-card grid (rounded icon + title + description)
- Bottom: slide-footer

### 7. Timeline / Process
- Top: slide-header (gradient title)
- Main body: left timeline component (vertical timeline + 4-5 nodes)
- Right: quote-block (key quote) or glass-card (summary)
- Bottom: slide-footer

### 8. Closing
- Dark background + three-color glow (green/cyan/gold)
- Centered: large gradient title (100px) + white subtitle + divider-gradient
- QR code (glass-card container, 14px radius) + official website link
- Bottom: copyright information

---

## 6. Radius and Shadow Specifications

| Element | Radius | Shadow |
|------|------|------|
| Glass card / feature card | 14px | `0 4px 24px rgba(0,0,0,0.4)` |
| KPI card | 14px | `0 4px 24px rgba(0,0,0,0.4)` + top 2px gradient line |
| Pill tag | 9999px (full) | none |
| Square badge | 4px | none |
| Logo area | 9999px | `0 4px 24px rgba(0,0,0,0.3)` |
| Image container | 14px | `0 8px 48px rgba(0,0,0,0.55)` |
| Code block | 8px | none |
| Feature icon | 12px (square) | Green:`0 0 16px rgba(45,212,160,0.1)` |
| Progress track | 9999px | none |
| Step flow card | 14px at both ends, 0 in the middle | none |

---

## 7. ECharts Chart Specifications

### Palette
```javascript
color: ['#2dd4a0', '#0ea5c9', '#5eead4', '#67c8e0', '#a7f3d0', '#d4af6a']
```

### Global Config Template
```javascript
const charityTheme = {
  backgroundColor: 'transparent',
  textStyle: { fontFamily: 'Noto Sans SC', color: '#b8d4cc' },
  title: {
    textStyle: { color: '#f0f7f4', fontSize: 26, fontWeight: 'bold' },
    subtextStyle: { color: '#6b9e8f', fontSize: 17 }
  },
  legend: { textStyle: { color: '#6b9e8f', fontSize: 17 } },
  tooltip: {
    backgroundColor: 'rgba(1,11,20,0.92)',
    borderColor: 'rgba(45,212,160,0.4)',
    borderWidth: 1,
    textStyle: { color: '#f0f7f4', fontSize: 16 },
    extraCssText: 'backdrop-filter:blur(8px);'
  }
};
```

### Bar chart (charity data comparison)
```javascript
option = {
  color: ['#2dd4a0'],
  grid: { top:70, right:50, bottom:70, left:90, containLabel:true },
  xAxis: {
    type:'category',
    axisLabel:{ color:'#6b9e8f', fontSize:18 },
    axisLine:{ lineStyle:{ color:'rgba(255,255,255,0.08)' } },
    axisTick:{ show:false }
  },
  yAxis: {
    type:'value',
    splitLine:{ lineStyle:{ color:'rgba(255,255,255,0.04)', type:'dashed' } },
    axisLabel:{ color:'#6b9e8f', fontSize:18 }
  },
  series: [{
    type:'bar', barMaxWidth:56,
    itemStyle:{
      borderRadius:[6,6,0,0],
      color:{ type:'linear',x:0,y:0,x2:0,y2:1,
        colorStops:[{offset:0,color:'#5eead4'},{offset:1,color:'#1aaf80'}] }
    }
  }]
};
```

### Line chart (trend analysis)
```javascript
option = {
  color: ['#2dd4a0','#0ea5c9'],
  grid: { top:70, right:50, bottom:70, left:90, containLabel:true },
  xAxis: { type:'category', boundaryGap:false, axisLabel:{ color:'#6b9e8f', fontSize:18 } },
  yAxis: { type:'value', splitLine:{ lineStyle:{ color:'rgba(255,255,255,0.04)', type:'dashed' } } },
  series: [{
    type:'line', smooth:true, lineStyle:{ width:3 },
    symbol:'circle', symbolSize:8,
    areaStyle:{
      color:{ type:'linear',x:0,y:0,x2:0,y2:1,
        colorStops:[{offset:0,color:'rgba(45,212,160,0.3)'},{offset:1,color:'rgba(45,212,160,0)'}] }
    }
  }]
};
```

### Pie chart (fund/resource distribution)
```javascript
option = {
  color: ['#2dd4a0','#0ea5c9','#5eead4','#67c8e0','#d4af6a','#a7f3d0'],
  series: [{
    type:'pie', radius:['38%','68%'], center:['50%','50%'],
    label:{ fontSize:17, color:'#b8d4cc' },
    labelLine:{ lineStyle:{ color:'rgba(255,255,255,0.2)' } },
    itemStyle:{ borderRadius:6, borderColor:'rgba(1,11,20,0.8)', borderWidth:3 }
  }]
};
```

### Radar chart (capability assessment)
```javascript
option = {
  color: ['#2dd4a0'],
  radar: {
    indicator: [/* indicator array */],
    shape:'polygon',
    splitNumber:4,
    axisName:{ color:'#6b9e8f', fontSize:16 },
    splitLine:{ lineStyle:{ color:'rgba(255,255,255,0.06)' } },
    splitArea:{ areaStyle:{ color:['rgba(45,212,160,0.03)','transparent'] } },
    axisLine:{ lineStyle:{ color:'rgba(255,255,255,0.06)' } }
  },
  series:[{
    type:'radar',
    data:[{ value:[/*values*/], areaStyle:{ color:'rgba(45,212,160,0.15)' }, lineStyle:{ width:2 } }]
  }]
};
```

---

## 8. AI Illustration Generation Specifications

### Style Keywords
```
deep sea dark background, jade green and teal gradient,
glassmorphism UI, charity tech, public welfare,
sophisticated dark aesthetic, emerald glow, subtle gold accent,
modern dark interface, 16:9 ratio, no text overlay
```

### image_search Keyword Strategy

| Use Case | Recommended Keywords |
|------|-----------|
| Charity scenarios | `charity volunteer community dark`, `nonprofit organization impact` |
| Nature/life | `green nature dark background`, `forest light rays`, `ocean deep teal` |
| Tech for good | `AI for good technology dark`, `digital nonprofit data`, `tech charity green` |
| Data analysis | `dark dashboard analytics green`, `data visualization teal dark` |
| People | `volunteer helping community night`, `nonprofit team working dark` |
| Abstract backgrounds | `dark abstract background jade green`, `deep ocean emerald glow` |

### Image Generation Prompt Examples

**Cover background**
```
deep sea dark background with soft jade green and teal light rays emanating from center, public welfare charity tech atmosphere, glassmorphism elements, sophisticated dark UI style, hopeful and vibrant, subtle gold specks, no text, 16:9
```

**Content image**
```
[topic description], dark background #010b14, jade green #2dd4a0 and teal #0ea5c9 accent glow, glassmorphism style, sophisticated charity tech aesthetic, 16:9
```

### Notes
- The abyss ink base (`#010b14`) has more depth than pure black; images should avoid pure black backgrounds
- Jade green and dark jade cyan are calmer than fluorescent green; prefer deep, restrained green tones when selecting images
- Gold accents are only for high-value numbers and important emphasis; do not use them at large scale
- For charity-related images (volunteers, communities, nature), prefer real photos to increase credibility
- For data content, prefer ECharts charts rather than images
