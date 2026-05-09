# Coral Watercolor Wash (Watercolor) Visual Spec

## 1. Core Design Concept

- **Watercolor wash as the soul**: A warm white base with soft watercolor rendering, visible brush textures, and naturally bleeding edges conveys warmth, approachability, and refined artistry.
- **Organic shape language**: Avoid hard-edged geometry; all containers, dividers, and decorations use soft organic forms to simulate hand-painted watercolor effects.
- **Natural element accents**: Leaves, flowers, bubbles, water ripples, and other natural elements are scattered in page corners as decoration, adding a lifestyle-aesthetic atmosphere.
- **Handwritten warmth**: Headings use the Dancing Script handwritten font, while body copy uses rounded sans-serif typography, giving the whole design a personal handmade warmth.

---

## 2. Color Spec

```css
:root {
  /* Background */
  --bg-primary:    #FAF8F0;   /* Warm white primary background */
  --bg-secondary:  #FFF9E6;   /* Soft cream secondary background */
  --bg-card:       #FFFFFF;   /* White card base */
  --bg-wash:       #FFF3C4;   /* Pale yellow wash rendering */
  --bg-dark:       #3D3D3D;   /* Dark cover background */

  /* Watercolor palette */
  --coral:         #F4A261;   /* Soft coral - primary warm color */
  --dusty-pink:    #E8A0A0;   /* Dusty pink - secondary warm color */
  --sage-green:    #87A96B;   /* Sage green - nature */
  --sky-blue:      #7EC8E3;   /* Sky blue - water/calm */
  --lavender:      #C5B4E3;   /* Pale lavender - accent */

  /* Text */
  --text-primary:   #3D3D3D;  /* Warm charcoal - primary text */
  --text-secondary: #6B6B6B;  /* Medium gray - secondary text */
  --text-muted:     #9E9E9E;  /* Light gray - annotations */
  --text-on-dark:   #FAF8F0;  /* Text on dark backgrounds */
  --text-coral:     #E07A5F;  /* Coral emphasis text */

  /* Borders and lines */
  --border-light:   rgba(61,61,61,0.1);   /* Light border */
  --border-mid:     rgba(61,61,61,0.2);   /* Medium border */
  --border-coral:   rgba(244,162,97,0.5); /* Coral border */

  /* Shadows (soft) */
  --shadow-sm:  0 2px 8px rgba(61,61,61,0.06);
  --shadow-md:  0 4px 16px rgba(61,61,61,0.10);
  --shadow-lg:  0 8px 32px rgba(61,61,61,0.12);
}
```

---

## 3. Typography Spec

| Level | Size | Weight | Color | Notes |
|------|------|------|------|------|
| Cover hero title | 64-72px | 700 | --text-primary | Dancing Script handwritten style |
| Page main title | 44-52px | 700 | --text-primary | Dancing Script |
| Section heading | 34-40px | 600 | --text-coral | With watercolor underline decoration |
| Subtitle | 22-26px | 400 | --text-secondary | Nunito, rounded feel |
| Body | 18-22px | 400 | --text-secondary | line-height: 1.85 |
| Data highlight | 48-60px | 700 | --coral | Dedicated to KPI use |
| Hand-drawn annotation | 15-17px | 400 | --text-muted | font-style: italic |
| Caption/source | 13-15px | 400 | --text-muted | font-style: italic |

**Font family:** `'Dancing Script', 'Nunito', 'Noto Sans SC', sans-serif` (Dancing Script for headings, Nunito + Noto Sans SC for body copy)

**Font import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;600;700&family=Nunito:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet"/>
```

---

## 4. Decorative Element Spec

**A. Watercolor rendered background blobs**:
```css
.watercolor-blob {
  position: absolute;
  border-radius: 60% 40% 70% 30% / 50% 60% 40% 70%;
  filter: blur(40px);
  opacity: 0.25;
  pointer-events: none;
}
.blob-coral   { background: var(--coral);       width: 300px; height: 200px; }
.blob-blue    { background: var(--sky-blue);    width: 250px; height: 180px; }
.blob-green   { background: var(--sage-green);  width: 200px; height: 150px; }
.blob-lavender{ background: var(--lavender);    width: 220px; height: 160px; }
```

**B. Watercolor brush-stroke divider**:
```html
<div class="watercolor-divider"></div>
```
```css
.watercolor-divider {
  height: 3px;
  background: linear-gradient(to right, transparent, var(--coral), var(--dusty-pink), transparent);
  border-radius: 3px;
  filter: blur(0.5px);
  margin: 20px 0;
  opacity: 0.6;
}
```

**C. Watercolor tag**:
```html
<span class="wc-tag coral">生活美学</span>
```
```css
.wc-tag {
  display: inline-block;
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 14px; font-weight: 600;
  font-family: 'Nunito', sans-serif;
}
.wc-tag.coral   { background: rgba(244,162,97,0.2);  color: #E07A5F; }
.wc-tag.blue    { background: rgba(126,200,227,0.2); color: #5BA8C4; }
.wc-tag.green   { background: rgba(135,169,107,0.2); color: #5F8040; }
.wc-tag.lavender{ background: rgba(197,180,227,0.2); color: #8B6CB0; }
```

**D. Natural decorative element (SVG leaf)**:
```html
<svg class="leaf-deco" viewBox="0 0 40 60" width="40" height="60" style="opacity:0.3;">
  <path d="M20,55 C20,55 5,40 5,25 C5,10 20,5 20,5 C20,5 35,10 35,25 C35,40 20,55 20,55Z"
        fill="#87A96B"/>
</svg>
```

---

## 5. Dedicated Layout Page Types

### Layout 1: Cover
- Warm white base, watercolor wash blobs in all four corners (coral + sky blue + lavender)
- Centered large Dancing Script title
- Italic subtitle, separated by a thin watercolor line at the bottom
- Natural leaf/flower decoration in the lower-right corner

### Layout 2: Story
- Large image on the left (watercolor-style image, 40% width)
- Text on the right: title + body paragraph + handwritten quote
- Small annotation text at the bottom

### Layout 3: Feature
- 3-4 watercolor circular icon cards in a row
- Each card: circular watercolor background + icon + title + description
- Use different watercolor background colors (coral/sky blue/green/lavender)

### Layout 4: Recipe
- Simulated recipe/manual layout
- Numbered steps on the left (handwritten numbers), explanatory text on the right
- Ingredient/tool tag list at the bottom (watercolor rounded tags)

### Layout 5: Data
- Large KPI at the top (coral, Dancing Script)
- ECharts chart below (watercolor palette)
- Charts use soft gradients, without hard edges

### Layout 6: Quote
- Full-page watercolor rendered background
- Large centered quote text (Dancing Script, italic)
- Signature + watercolor decorative line at the bottom

### Layout 7: Section
- Full-page watercolor blobs (coral as the main tone)
- Centered section title (white, large)
- Leaf/flower decoration at the bottom

### Layout 8: Closing
- Warm white base, centered thank-you text (Dancing Script)
- Natural decorative elements scattered around the page
- Contact information at the bottom (small text, handwritten feel)

---

## 6. Border Radius and Shadow Spec

| Element | Radius | Shadow |
|------|------|------|
| Content card | 12px | --shadow-sm |
| Watercolor icon circle | 50% | --shadow-sm |
| Tag | 20px | none |
| Chart container | 12px | --shadow-sm |
| Quote box | 8px | --shadow-md |
| Watercolor blob | Organic shape | filter: blur(40px) |

---

## 7. ECharts Chart Spec

**Palette (watercolor colors)**:
```js
color: ['#F4A261', '#7EC8E3', '#87A96B', '#E8A0A0', '#C5B4E3', '#FFF3C4']
```

**Global configuration**:
```js
const chartDefaults = {
  backgroundColor: 'transparent',
  textStyle: { color: '#6B6B6B', fontFamily: 'Nunito, Noto Sans SC, sans-serif', fontSize: 13 },
  grid: { top: 40, right: 20, bottom: 40, left: 50, containLabel: true }
};
```

**Bar chart example**:
```js
option = {
  ...chartDefaults,
  xAxis: { type: 'category', data: ['一月','二月','三月','四月','五月'],
    axisLine: { lineStyle: { color: 'rgba(61,61,61,0.15)' } },
    axisLabel: { color: '#6B6B6B' } },
  yAxis: { type: 'value',
    splitLine: { lineStyle: { color: 'rgba(61,61,61,0.08)' } },
    axisLabel: { color: '#6B6B6B' } },
  series: [{ type: 'bar', data: [42,68,55,80,72], barWidth: '50%',
    itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
      colorStops: [{ offset: 0, color: '#F4A261' }, { offset: 1, color: 'rgba(244,162,97,0.4)' }] },
      borderRadius: [8,8,0,0] } }]
};
```

**Line chart example**:
```js
series: [{ type: 'line', smooth: true, data: [30,55,45,70,60,85],
  lineStyle: { color: '#7EC8E3', width: 3 },
  areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [{ offset: 0, color: 'rgba(126,200,227,0.4)' }, { offset: 1, color: 'rgba(126,200,227,0.02)' }] } },
  symbol: 'circle', symbolSize: 8,
  itemStyle: { color: '#7EC8E3', borderColor: '#fff', borderWidth: 2 } }]
```

**Pie chart example**:
```js
series: [{ type: 'pie', radius: ['35%','65%'], center: ['50%','55%'],
  itemStyle: { borderColor: '#FAF8F0', borderWidth: 3 },
  label: { color: '#3D3D3D', fontSize: 13, fontFamily: 'Nunito, sans-serif' },
  data: [
    { value: 35, name: '健康', itemStyle: { color: '#87A96B' } },
    { value: 28, name: '旅行', itemStyle: { color: '#7EC8E3' } },
    { value: 22, name: '美食', itemStyle: { color: '#F4A261' } },
    { value: 15, name: '创作', itemStyle: { color: '#C5B4E3' } }
  ] }]
```

---

## 8. AI Illustration Generation Spec

**Style keywords**:
`soft watercolor illustration, visible brush strokes, organic shapes, warm pastel palette, hand-painted texture, botanical elements, cozy lifestyle aesthetic, gentle color bleeding`

**image_search strategy**:
- Add these search terms: `watercolor illustration`, `soft watercolor lifestyle`, `botanical watercolor`
- Prefer watercolor illustrations with soft tones, visible brush strokes, and organic forms
- Avoid digitally precise aesthetics; prefer hand-painted watercolor textures

**generate_image example prompt**:
```
soft watercolor illustration of [具体主题], warm pastel colors, visible brush strokes, organic flowing shapes, botanical leaf accents, cozy lifestyle aesthetic, coral and sage green palette, gentle color bleeding at edges, hand-painted texture, white paper background, no sharp edges
```
