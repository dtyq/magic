# Editorial Redline (Monocle Editorial) Visual Specification

## 1. Core Design Concept

- **Editing as design**:Use the editorial layout logic of Monocle magazine to drive slides: each page feels like a carefully typeset feature article, with rigorous hierarchy and whitespace as the protagonist.
- **Restrained luxury**:A pure white base and deep charcoal text form the dominant tone; Monocle's signature editorial red (#C8102E) is the only accent color and must never be overused.
- **Grid discipline**:Strictly follow a magazine column grid system, with alignment lines running through the page and no casually floating elements.
- **Typography as brand**:Serif headlines (Cormorant Garamond) convey a premium magazine feel, sans-serif body text (DM Sans) ensures screen readability, and monospaced labels (DM Mono) carry journal metadata.

---

## 2. Color Specification

```css
:root {
 /* ── Main background colors ── */
 --white:      #FFFFFF;  /* Main content page background */
 --off-white:    #F7F5F2;  /* Secondary background, card base */
 --warm-gray:    #EEEBE6;  /* Section dividers, quote backgrounds */

 /* ── Text colors ── */
 --ink-black:    #1A1A1A;  /* Main title, Body text */
 --ink-black-rgb:  26, 26, 26;
 --text-secondary: #4A4A4A;  /* Subtitles, lead text */
 --text-muted:   #8A8A8A;  /* Metadata, labels, footnotes */
 --text-ultra-muted:#C0BDB8;  /* Decorative lines, separators */

 /* ── Dark page colors (covers/section pages) ── */
 --cover-bg:    #111111;  /* Deep black cover background */
 --cover-bg-rgb:  17, 17, 17;
 --cover-text:   #F7F5F2;  /* Cover primary text */
 --cover-muted:   #888888;  /* Cover secondary text */

 /* ── Brand accent color ── */
 --editorial-red:  #C8102E;  /* Monocle editorial red: only for labels, issue numbers, and keyword underlines */
 --editorial-red-rgb: 200, 16, 46;

 /* ── Border colors ── */
 --border-strong:  #1A1A1A;  /* Heavy divider (below top navigation bar) */
 --border-mid:   #D4D0CB;  /* Card borders, column rules */
 --border-light:  #EEEBE6;  /* Light divider */
}
```

---

## 3. Typography Specification

| Level | Font families | Size | Weight | Color |
|------|--------|------|------|------|
| Cover headline (English) | Cormorant Garamond | clamp(4rem, 9vw, 9vw) | 700 italic | --cover-text |
| Cover headline (Chinese) | Noto Serif SC | clamp(3rem, 7vw, 7vw) | 700 | --cover-text |
| Content page title | Cormorant Garamond | clamp(2rem, 4.5vw, 4.5vw) | 600 | --ink-black |
| Content page subtitle | DM Sans | clamp(1rem, 2vw, 2vw) | 500 | --text-secondary |
| Body text | DM Sans | max(15px, 1.3vw) | 400 | --ink-black, opacity:.85 |
| Large data number | Cormorant Garamond | clamp(2.5rem, 5.5vw, 5.5vw) | 700 | --ink-black |
| Issue number/label | DM Mono | 11–13px | 400 | --editorial-red / --text-muted |
| Footnote/source | DM Mono | 10–11px | 400 | --text-muted, opacity:.7 |

**Font import:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=Noto+Serif+SC:wght@600;700&family=Noto+Sans+SC:wght@400;500&display=swap" rel="stylesheet">
```

---

## 4. Decorative Element Specification

**A. Top navigation bar (masthead)**
```html
<div class="masthead">
 <span class="issue-tag">ISSUE 193 · MAY 2026</span>
 <span class="brand">MONOCLE</span>
 <span class="section-tag">AFFAIRS</span>
</div>
```
```css
.masthead {
 display: flex; justify-content: space-between; align-items: center;
 padding: 0 4vw; height: 6.5vh;
 border-bottom: 2px solid var(--border-strong);
 font-family: var(--mono); font-size: 11px;
 letter-spacing: 0.12em; text-transform: uppercase;
}
.brand { font-family: var(--mono); font-weight: 500; letter-spacing: 0.18em; }
.issue-tag { color: var(--editorial-red); }
.section-tag { color: var(--text-muted); }
```

**B. Red tag badge (red-tag)**
```html
<div class="red-tag">COVER STORY</div>
```
```css
.red-tag {
 display: inline-block;
 padding: 3px 10px;
 background: var(--editorial-red);
 color: #fff;
 font-family: var(--mono); font-size: 10px;
 letter-spacing: 0.14em; text-transform: uppercase;
}
```

**C. Oversized ghost text decoration (ghost-number)**
```html
<div class="ghost-number">01</div>
```
```css
.ghost-number {
 position: absolute; z-index: 0;
 font-family: var(--serif-en); font-weight: 700;
 font-size: 38vw; line-height: 0.85;
 color: var(--ink-black); opacity: 0.025;
 pointer-events: none; letter-spacing: -0.05em;
}
```

**D. Column rule (col-rule)**
```css
.col-rule {
 width: 1px; background: var(--border-mid);
 align-self: stretch; margin: 0 2vw;
}
```

**E. Pull quote (pull-quote)**
```html
<blockquote class="pull-quote">
 "Design is not just what it looks like. Design is how it works."
</blockquote>
```
```css
.pull-quote {
 font-family: var(--serif-en); font-style: italic;
 font-size: clamp(1.4rem, 2.8vw, 2.8vw); font-weight: 600;
 line-height: 1.35; color: var(--ink-black);
 border-top: 2px solid var(--border-strong);
 border-bottom: 1px solid var(--border-mid);
 padding: 2.5vh 0; margin: 0;
}
```

**F. Bottom footer (slide-foot)**
```css
.slide-foot {
 display: flex; justify-content: space-between; align-items: center;
 padding: 0 4vw; height: 5.5vh;
 border-top: 1px solid var(--border-mid);
 font-family: var(--mono); font-size: 10px;
 color: var(--text-muted); letter-spacing: 0.08em;
}
```

---

## 5. Dedicated Layout Page Types (8)

### 1. Cover Dark
- Full-screen deep black background (#111111)
- Top masthead: issue number (red) + MONOCLE wordmark + date
- Left-aligned body: small red tag + oversized italic serif title (English) + Chinese subtitle + one-line lead
- Bottom: speaker name + institution + year, with a large expanse of black space on the right

### 2. Contents Page
- White background with top masthead
- Left column (40%): large issue-number decoration + issue introduction
- Right column (60%): numbered list, each item with issue label + title + page number, separated by a vertical column rule
- Bottom footer

### 3. Feature Article Page
- White background with top masthead
- Left (55%): red tag + serif headline + 2-3 paragraphs + pull quote
- Right (45%): full-height image container (thin border) + caption (small DM Mono)
- Bottom footer

### 4. Data Report Page
- Off-white background (#F7F5F2) with top masthead
- Top: red tag + title
- Body: three equal-width stat cards, each with a large number (Cormorant Garamond) + unit + explanatory text
- Bottom: horizontal data source bar + footer

### 5. City/Region Feature Page
- White background with top masthead
- Top banner: full-width image (about 35vh high), with city name overlaid in white at bottom left
- Two columns below: body text on the left, keyword cards with thin borders on the right
- Bottom footer

### 6. Dialogue/Interview Page
- White background with top masthead
- Left (35%): portrait image (vertical, thin border) + name + title (DM Mono)
- Right (65%): red tag + title + Q&A body text (Q in red DM Mono, A in body style)
- Bottom footer

### 7. Opinion/Quote Page
- Off-white background with top masthead
- Large central area: oversized pull quote (italic serif, page focal point)
- Bottom: source, author, and issue metadata (DM Mono)
- Leave 8vw side margins and masthead + 6vh spacing at top and bottom

### 8. Sign-off/Acknowledgements Page
- Full-screen deep black background with top masthead (dark version)
- Center: MONOCLE wordmark-style typography + one closing sentence (white italic serif)
- Bottom: contact information + next issue preview + thank-you note (small DM Mono)
- Bottom right: small editorial-red square decoration

---

## 6. Corner Radius and Shadow Specification

| Element | Radii | Shadows |
|------|------|------|
| Stat card | 0(square corners) | None |
| Image container | 0 | None |
| Callout | 0 | None |
| Red tag | 0 | None |
| **Principle** | **No rounded corners anywhere in the template** | **No shadows anywhere in the template** |

The Monocle style builds a magazine-print feel with straight lines, thin borders, and hard corners; rounded corners and shadows would break its serious editorial character.

---

## 7. ECharts Chart Specification

### Palette
```javascript
color: ['#1A1A1A', '#C8102E', '#8A8A8A', '#4A4A4A', '#C0BDB8', '#EEEBE6']
```

### Global Configuration Template
```javascript
const monocleTheme = {
  backgroundColor: '#F7F5F2',
  textStyle: { color: '#4A4A4A', fontFamily: 'DM Sans, Noto Sans SC, sans-serif', fontSize: 14 },
  title: {
    textStyle: { color: '#1A1A1A', fontSize: 24, fontWeight: '600', fontFamily: 'DM Sans' },
    subtextStyle: { color: '#8A8A8A', fontSize: 14 }
  },
  legend: { textStyle: { color: '#4A4A4A', fontSize: 13 } },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#1A1A1A', width: 1.5 } },
    axisTick: { show: false },
    axisLabel: { color: '#4A4A4A', fontSize: 13 },
    splitLine: { show: false }
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#8A8A8A', fontSize: 13 },
    splitLine: { lineStyle: { color: '#EEEBE6', type: 'solid' } }
  },
  tooltip: {
    backgroundColor: '#1A1A1A',
    borderColor: '#C8102E',
    borderWidth: 1,
    textStyle: { color: '#F7F5F2', fontSize: 13 }
  }
};
```

### Line chart
```javascript
option = {
  backgroundColor: '#F7F5F2',
  color: ['#1A1A1A', '#C8102E'],
  grid: { top: 70, bottom: 60, left: 70, right: 40, containLabel: true },
  xAxis: { type: 'category', axisLabel: { color: '#4A4A4A', fontSize: 13 },
    axisLine: { lineStyle: { color: '#1A1A1A', width: 1.5 } }, axisTick: { show: false } },
  yAxis: { type: 'value', axisLabel: { color: '#8A8A8A', fontSize: 13 },
    splitLine: { lineStyle: { color: '#EEEBE6' } }, axisLine: { show: false } },
  series: [{ type: 'line', smooth: false, lineStyle: { width: 2 }, symbolSize: 5, symbol: 'circle' }]
};
```

### Bar chart
```javascript
option = {
  backgroundColor: '#F7F5F2',
  color: ['#1A1A1A', '#C8102E', '#8A8A8A'],
  grid: { top: 70, bottom: 60, left: 70, right: 40, containLabel: true },
  xAxis: { type: 'category', axisLabel: { color: '#4A4A4A', fontSize: 13 },
    axisLine: { lineStyle: { color: '#1A1A1A', width: 1.5 } }, axisTick: { show: false } },
  yAxis: { type: 'value', axisLabel: { color: '#8A8A8A', fontSize: 13 },
    splitLine: { lineStyle: { color: '#EEEBE6' } }, axisLine: { show: false } },
  series: [{ type: 'bar', barWidth: '28%', itemStyle: { borderRadius: 0 },
    label: { show: true, position: 'top', color: '#1A1A1A', fontSize: 13 } }]
};
```

---

## 8. AI Illustration Generation Specification

### Style Keywords
```
editorial photography style, high contrast, desaturated tones, architectural precision,
journalistic composition, Monocle magazine aesthetic, clean white space,
sophisticated minimalism, global affairs visual language
```

### image_search Keyword Strategy

| Purpose | Recommended Keywords |
|------|-----------|
| Cover/Background | `editorial photography minimal`, `architectural detail monochrome`, `city street journalism` |
| Portraits/interviews | `portrait editorial black white`, `business leader interview photo` |
| Cities/regions | `[城市名] architecture aerial`, `urban design street level`, `city lifestyle editorial` |
| Design/culture | `design object minimal photography`, `craft detail close-up editorial` |
| Data/business | `business data visualization clean`, `economic report infographic minimal` |

### Image Generation Prompt Examples

**Cover Background**
```
editorial photography, [具体场景], high contrast black and white, architectural precision, journalistic composition, Monocle magazine style, no text, 16:9 wide format, sophisticated minimalism
```

**City feature image**
```
street level photography of [城市名], editorial style, muted tones, architectural detail, people in motion, journalistic documentary feel, no text
```

### Notes
- The Monocle style **prioritizes real photography**, avoiding illustrations or overly designed graphics
- Images should have strong composition and layered light and shadow; low-saturation or black-and-white imagery is preferred
- Images may occupy 40-50% of cover and city feature pages; on other pages they should play a supporting role
- **Avoid**:cartoon illustrations, bright palettes, excessive gradients, and decorative geometric patterns
