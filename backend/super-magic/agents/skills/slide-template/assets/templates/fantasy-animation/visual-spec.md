# Ghibli Fairy Tale (Fantasy-Animation) Visual Spec

## 1. Core Design Concept

- **Ghibli/Disney narrative aesthetics**: Soft sky blue (#E8F4FC) paired with warm cream accents creates a warm, charming storybook atmosphere that honors classic animation aesthetics. 
- **Character-driven content**: Each page centers on friendly characters or magical creatures, paired with storybook-style layouts so the information carries emotional resonance. 
- **soft painterly texture**: All edges feel soft and organic, backgrounds use subtle watercolor washes, and layered foreground/background depth evokes hand-drawn animation frames. 
- **magical decorative language**: Stars, spark particles, flowers, leaves, and magic orbs serve as decorative accents, with gold reserved as the dedicated color for magical effects. 

---

## 2. Color Spec

```css
:root {
  /* Background */
  --bg-primary:    #E8F4FC;   /* Soft sky blue primary background */
  --bg-secondary:  #FFF8E7;   /* Warm cream secondary background */
  --bg-card:       #FFFFFF;   /* White card background */
  --bg-dark:       #2D5A3D;   /* Deep forest green cover */
  --bg-magic:      rgba(244,208,63,0.12); /* Gold magic base */
  --bg-rose:       rgba(232,160,191,0.15); /* Rose pink base */

  /* Fantasy palette */
  --forest-green:  #2D5A3D;   /* Deep forest green - titles */
  --warm-brown:    #5D4E37;   /* Warm brown - Body text */
  --gold:          #F4D03F;   /* Gold - magical effects */
  --rose-pink:     #E8A0BF;   /* Rose pink - warmth and charm */
  --sage-green:    #87A96B;   /* Sage green - nature */
  --sky-blue:      #7EC8E3;   /* Sky blue - dreams */
  --coral-red:     #F08080;   /* Coral red - emphasis */
  --lavender:      #B8A9D9;   /* Lavender - magic */

  /* Text */
  --text-primary:   #2D5A3D;  /* Deep forest green - main title */
  --text-body:      #5D4E37;  /* Warm brown - Body text */
  --text-secondary: #7A6A5A;  /* medium brown - Secondary text */
  --text-muted:     #A09080;  /* Light brown - annotations */
  --text-on-dark:   #FFF8E7;  /* Text on dark backgrounds */
  --text-gold:      #D4A017;  /* Gold emphasis */

  /* Borders */
  --border-light:   rgba(45,90,61,0.12);
  --border-mid:     rgba(45,90,61,0.25);
  --border-gold:    rgba(244,208,63,0.6);
  --border-rose:    rgba(232,160,191,0.5);

  /* Soft shadows */
  --shadow-sm:  0 2px 10px rgba(45,90,61,0.08);
  --shadow-md:  0 6px 20px rgba(45,90,61,0.12);
  --shadow-lg:  0 12px 40px rgba(45,90,61,0.15);
  --shadow-magic: 0 0 20px rgba(244,208,63,0.4);
}
```

---

## 3. Typography Spec

| Level | Size | Weight | Color | Notes |
|------|------|------|------|------|
| cover main title | 64–72px | 700 | --text-primary | fantasy serif type, organic curvature |
| page main title | 44–52px | 700 | --text-primary | Cinzel decorative serif |
| section title | 34–40px | 600 | --forest-green | with gold decoration |
| subtitle | 22–26px | 400 | --text-body | Lora italic |
| Body text | 18–22px | 400 | --text-body | line-height: 1.85 |
| magic callout | 16–18px | 600 | --gold | gold sparkle effect |
| character dialogue | 18–20px | 400 | --text-body | font-style: italic |
| caption | 14–15px | 400 | --text-muted | |

**Font family: ** `'Cinzel', 'Lora', 'Noto Serif SC', serif` (Cinzel decorative serif for titles, Lora for body text)

**Font Import: **
```html
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,600;1,400&family=Noto+Serif+SC:wght@400;600;700&display=swap" rel="stylesheet"/>
```

---

## 4. Decorative element Spec

**A. watercolor wash background**: 
```css
.slide-container {
  background-color: var(--bg-primary);
  background-image:
    radial-gradient(ellipse at 20% 20%, rgba(244,208,63,0.10) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 80%, rgba(232,160,191,0.12) 0%, transparent 50%),
    radial-gradient(ellipse at 60% 30%, rgba(126,200,227,0.08) 0%, transparent 40%);
}
```

**B. Gold magic star decoration**: 
```html
<div class="magic-stars">
  <span class="star" style="top:10%;left:5%;font-size:18px;">✦</span>
  <span class="star" style="top:20%;right:8%;font-size:12px;">✧</span>
  <span class="star" style="bottom:15%;left:10%;font-size:14px;">★</span>
</div>
```
```css
.magic-stars span {
  position: absolute;
  color: var(--gold);
  opacity: 0.6;
  pointer-events: none;
}
```

**C. storybook container (scroll/suitcase style)**: 
```html
<div class="storybook-card">Content</div>
```
```css
.storybook-card {
  background: var(--bg-card);
  border: 1.5px solid var(--border-mid);
  border-radius: 20px;
  padding: 24px 28px;
  box-shadow: var(--shadow-md);
  position: relative;
}
.storybook-card::before {
  content: '';
  position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px;
  border: 1px solid rgba(45,90,61,0.08);
  border-radius: 14px;
  pointer-events: none;
}
```

**D. Magic glow effect**: 
```css
.magic-glow {
  text-shadow: 0 0 12px rgba(244,208,63,0.6), 0 0 24px rgba(244,208,63,0.3);
  color: var(--gold);
}
```

---

## 5. Dedicated Layout Types

### Layout 1: Cover (Cover page )
- Soft sky blue base with watercolor washes in all four corners (gold + rose pink)
- large centered character illustration (occupying 40% of the page )
- title set in Cinzel, with an italic subtitle
- scattered gold star decorations
- bottom flower/leaf decoration band

### Layout 2: Chapter (chapter story page )
- left scene illustration (40% width, rounded card)
- Right side: section title + story text + character speech bubble
- gold decorative line at the bottom

### Layout 3: Character (Character page )
- large centered full-body character art (circular/organic crop)
- surrounding attribute cards (magic/power/wisdom, etc.)
- watercolor-rendered background with gold star accents

### Layout 4: Map (magic map page )
- hand-drawn map background
- locations marked with cute icons
- routes connected with dashed lines
- legend uses storybook cards

### Layout 5: Data (magic data page )
- spellbook/scroll-style data display
- KPI values use large gold text
- charts use fantasy colors
- background includes magic particle effects

### Layout 6: Quote (magic quote page )
- full-page watercolor-rendered background (primarily gold)
- large centered quote text (Lora italic)
- gold decorative lines + star accents
- small character icon at the bottom

### Layout 7: Section (Section page )
- deep forest green background
- centered gold decorative frame with a white section title
- organic leaf decorations in four corners
- thin warm-cream line at the bottom

### Layout 8: Closing (Back cover page )
- soft sky blue base, centered thank-you text (Cinzel)
- large character/scene illustration
- gold star-rain decoration
- bottom contact info (storybook style)

---

## 6. Radius and Shadow Spec

| element | Radius | Shadow |
|------|------|------|
| storybook card | 20px | --shadow-md |
| character image container | 50% (circular) or organic shape | --shadow-lg |
| Attribute card | 16px | --shadow-sm |
| magic tag | 20px | none |
| chart container | 16px | --shadow-sm |
| Speech bubble | 16px | --shadow-sm |

---

## 7. ECharts Chart Spec

**Palette (Fantasy palette )**: 
```js
color: ['#F4D03F', '#E8A0BF', '#87A96B', '#7EC8E3', '#F08080', '#B8A9D9']
```

**Global Config**: 
```js
const chartDefaults = {
  backgroundColor: 'transparent',
  textStyle: { color: '#5D4E37', fontFamily: 'Lora, Noto Serif SC, serif', fontSize: 13 },
  grid: { top: 40, right: 20, bottom: 40, left: 50, containLabel: true }
};
```

**Bar Chart Example**: 
```js
option = {
  ...chartDefaults,
  xAxis: { type: 'category', data: ['春','夏','秋','冬','魔法季'],
    axisLine: { lineStyle: { color: 'rgba(45,90,61,0.3)' } },
    axisLabel: { color: '#5D4E37' } },
  yAxis: { type: 'value',
    splitLine: { lineStyle: { color: 'rgba(45,90,61,0.08)' } },
    axisLabel: { color: '#5D4E37' } },
  series: [{ type: 'bar', data: [65,82,74,91,100], barWidth: '50%',
    itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
      colorStops: [{ offset: 0, color: '#F4D03F' }, { offset: 1, color: 'rgba(244,208,63,0.4)' }] },
      borderRadius: [8,8,0,0] },
    label: { show: true, position: 'top', color: '#5D4E37', fontSize: 12 } }]
};
```

**Pie Chart Example**: 
```js
series: [{ type: 'pie', radius: ['35%','65%'], center: ['50%','55%'],
  itemStyle: { borderColor: '#E8F4FC', borderWidth: 3 },
  label: { color: '#5D4E37', fontSize: 13, fontFamily: 'Lora, serif' },
  data: [
    { value: 35, name: '魔法', itemStyle: { color: '#F4D03F' } },
    { value: 28, name: '自然', itemStyle: { color: '#87A96B' } },
    { value: 22, name: '梦境', itemStyle: { color: '#7EC8E3' } },
    { value: 15, name: '爱', itemStyle: { color: '#E8A0BF' } }
  ] }]
```

---

## 8. AI Illustration Generation Spec

**Style Keywords**: 
`whimsical hand-drawn animation, Studio Ghibli inspired, storybook illustration, soft watercolor texture, warm pastel colors, charming character design, magical elements, golden sparkles`

**image_search Strategy**: 
- add these search terms: `whimsical illustration` / `storybook art` / `fantasy animation style`
- prioritize soft colors / hand-drawn texture / illustrations with characters or magical elements
- avoid photorealistic images and hard-edged geometric styles

**generate_image Example Prompt**: 
```
whimsical hand-drawn animation style illustration of [具体主题], Studio Ghibli inspired aesthetic, soft watercolor texture, warm pastel colors (sky blue #E8F4FC, warm cream #FFF8E7, forest green #2D5A3D, gold #F4D03F), charming friendly characters, magical sparkles and stars, storybook composition, gentle shadows, no sharp edges, cozy and enchanting atmosphere
```
