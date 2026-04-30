# Museum Art Edu Visual Spec

> Inspired by university art appreciation general education course slides, combining museum label aesthetics with academic typography, a dual-typeface system for Chinese and Western art, and academy red as the focal accent.

---

## 1. Core Design Concept

1. **Museum label aesthetic**: Warm off-white beige `#FAF8F5` simulates the texture of gallery walls, while deep ink-black text feels like restrained, powerful museum label print.
2. **Academy red accent**: `#C0392B` is used only for accent lines, badges, keyword highlights, and card-top emphasis lines, creating a focal point without overwhelming the page.
3. **Dual-type narrative**: Titles use Noto Serif SC for a humanistic serif feel, while body text uses Noto Sans SC for a modern sans-serif feel, creating a dialogue between classical and contemporary styles.
4. **Light/dark mode rhythm**: Light slides (beige `#FAF8F5`) and dark slides (ink black `#1A1A1A`) alternate within the same deck to create rhythm. Dark slides are often used for covers, section titles, quotations, and other emphatic content.

---

## 2. Color Specification

```css
:root {
  /* === Background Colors === */
  --bg-primary: #FAF8F5;        /* Primary background: warm off-white beige, like a museum wall */
  --bg-secondary: #F8F5F0;      /* Secondary background: slightly deeper warm white, alternates with primary */
  --bg-dark: #1A1A1A;           /* Dark background: ink black for covers, sections, quotes, and dark panels */
  --bg-dark-deeper: #141414;    /* Deeper background: distinguishes right panels on dark slides */
  --bg-card: #FFFFFF;           /* Card background: pure white */
  --bg-card-dark: rgba(255,255,255,0.04); /* Dark-slide card background */
  --bg-card-active-dark: rgba(192,57,43,0.08); /* Active card background on dark slides */
  --bg-ink-panel: #F0EBE2;      /* Ink image panel background: warm beige for Chinese painting display */

  /* === Text Colors === */
  --text-primary: #1A1A1A;      /* Primary text: ink black */
  --text-secondary: #2C2C2C;    /* Secondary text, such as card titles */
  --text-body: #444444;         /* Body text */
  --text-muted: #666666;        /* Muted descriptive text */
  --text-placeholder: #999999;  /* Placeholders, tags, and subtitles */
  --text-ghost: #CCCCCC;        /* Ghost text, such as page numbers */
  --text-on-dark: #F8F5F0;      /* Primary text on dark backgrounds */
  --text-on-dark-sub: #888888;  /* Secondary text on dark backgrounds */
  --text-on-dark-muted: rgba(248,245,240,0.55); /* Muted text on dark backgrounds */
  --text-on-dark-ghost: rgba(255,255,255,0.15); /* Page numbers and similar ghost text on dark backgrounds */
  --text-discussion: #D0CEC9;   /* Discussion text on dark backgrounds: warm gray-white */

  /* === Brand / Accent Colors === */
  --accent: #C0392B;            /* Academy red: primary accent */
  --accent-hover: rgba(192,57,43,0.8); /* Slightly transparent academy red on dark slides */
  --accent-light: rgba(192,57,43,0.06); /* Very pale red background */
  --accent-light-2: rgba(192,57,43,0.04); /* Even paler red background */
  --accent-border: rgba(192,57,43,0.2);   /* Red border */
  --accent-border-strong: rgba(192,57,43,0.3); /* Stronger red border */
  --accent-mid: rgba(192,57,43,0.5);      /* Mid-opacity red */
  --accent-icon: rgba(192,57,43,0.15);    /* Red icon background */
  --accent-icon-bg: #FDF0EE;              /* Pale red icon container background */
  --accent-ghost: rgba(192,57,43,0.12);   /* Red ghost number */

  /* === Multi-Color Card System for Dimension Separation === */
  --color-red: #C0392B;         /* Dimension 1: academy red, personal growth / perception layer */
  --color-blue: #2C3E8C;        /* Dimension 2: deep blue, cultural understanding */
  --color-green: #27AE60;       /* Dimension 3: green, creativity / judgment layer */
  --color-orange: #E67E22;      /* Dimension 4: orange, social interaction */
  --color-gold: #8B6914;        /* Dimension 5: golden brown, comprehension layer */

  /* === Borders === */
  --border-light: #EDEAE5;      /* Light border for light slides */
  --border-dark: rgba(255,255,255,0.07); /* Dark-slide border */
  --border-dark-heavier: #2E2E2E; /* Heavier border on dark slides */
  --divider: #DDDDDD;           /* Divider */
  --divider-dashed: #E0DDD8;    /* Dashed divider for field experience lists */

  /* === Shadows === */
  --shadow-card: 0 2px 12px rgba(0,0,0,0.06);   /* Card shadow */
  --shadow-card-light: 0 1px 6px rgba(0,0,0,0.05); /* Light card shadow */
  --shadow-card-medium: 0 2px 16px rgba(0,0,0,0.06); /* Medium card shadow */

  /* === Decorative Ghost Numbers === */
  --ghost-num-color: #F0EDE8;   /* Large ghost chapter number on light backgrounds */
  --ghost-num-dark: rgba(192,57,43,0.10); /* Ghost number on dark backgrounds */
  --ghost-num-card: rgba(0,0,0,0.03);     /* Ghost number in the lower-right of cards */

  /* === Radius === */
  --radius-card: 4px;           /* Card radius: low radius for academic rigor */
  --radius-badge: 2px;          /* Badge radius */
  --radius-icon: 50%;           /* Circular icon */
}
```

---

## 3. Typography Specification

**Font import (must be copied into the `<head>` of each slide HTML):**
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&family=Noto+Serif+SC:wght@400;600;700&display=swap" rel="stylesheet"/>
```

| Level | Font | Size | Weight | Color Variable | Letter Spacing | Notes |
|------|------|------|------|----------|--------|------|
| Cover title | Noto Sans SC | 96px | 900 | `--text-primary` | -0.02em | Large-text impact |
| Dark-slide title (serif) | Noto Serif SC | 64-68px | 700 | `--text-on-dark` | 3-4px | Section / function slide titles |
| Light-slide title (sans-serif) | Noto Sans SC | 52-56px | 700 | `--text-primary` | — | Top title bar |
| Top large title (serif) | Noto Serif SC | 68px | 700 | `--text-primary` | 4px | `definition-flow` layout |
| Subtitle | Noto Sans SC | 36px | 300 | `#555555` | 0.15em | Cover subtitle |
| Page subtitle | Noto Sans SC | 26px | 400 | `#888888` | 2px | Supporting text in title areas |
| Card title | Noto Sans SC | 28-36px | 700 | `--text-secondary` | 1-2px | — |
| Card verb / emphasis word | Noto Sans SC | 32px | 700 | `--accent` | 2px | Goal-card verb |
| Body | Noto Sans SC | 24-28px | 300/400 | `--text-body` | — | Line height 1.8-1.9 |
| Body on dark slides | Noto Sans SC | 24-26px | 300/500 | `--text-discussion` | — | Line height 1.7 |
| Small body / description | Noto Sans SC | 20-22px | 400 | `--text-muted` | — | Line height 1.65-1.75 |
| English page tag | Noto Sans SC | 15-18px | 500/600 | `--accent` | 3-4px | Uppercase |
| Page number | Noto Sans SC | 16-20px | 400 | `--text-ghost` | 0.1-0.2em | — |
| Large ghost number on light slides | Noto Sans SC | 120px | 900 | `#F0EDE8` | -0.05em | Top-right decoration |
| Large serif ghost number | Noto Serif SC | 52px | 700 | `rgba(192,57,43,0.12)` | — | In-card decoration |

---

## 4. Decorative Element Specification

### 4.1 Academy Red Accent Line (accent-line)
```html
<div class="accent-line"></div>
```
```css
.accent-line {
  width: 48–64px;
  height: 3–4px;
  background-color: #C0392B;
  margin-bottom: 28–40px;
}
```

### 4.2 Top Red Decorative Bar for Dark Left Panels
```html
<div class="left-deco-top"></div>
```
```css
.left-deco-top {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
  background: #C0392B;
}
```

### 4.3 Left Vertical Red Gradient Line for Dark Sidebars
```html
<div class="left-deco"></div>
```
```css
.left-deco {
  position: absolute;
  top: 0; left: 0;
  width: 4px; height: 100%;
  background: linear-gradient(to bottom, transparent, #C0392B 30%, #C0392B 70%, transparent);
}
```

### 4.4 Large Ghost Chapter Number for Cover Top-Right Decoration
```html
<div class="chapter-badge">
  <div class="chapter-num">01</div>
  <div class="chapter-label">CHAPTER ONE</div>
</div>
```
```css
.chapter-badge { position: absolute; top: 60px; right: 100px; text-align: right; }
.chapter-num { font-size: 120px; font-weight: 900; color: #F0EDE8; line-height: 1; letter-spacing: -0.05em; }
.chapter-label { font-size: 20px; color: #C0392B; letter-spacing: 0.2em; margin-top: -16px; }
```

### 4.5 English Page Tag (page-tag)
```html
<div class="page-tag">OVERVIEW</div>
```
```css
.page-tag {
  font-size: 15–18px;
  color: #C0392B;        /* Solid color on light slides; use rgba(192,57,43,0.8) on dark slides */
  letter-spacing: 4px;
  font-weight: 500–600;
  margin-bottom: 12–16px;
  text-transform: uppercase;
}
```

### 4.6 Top Title Bar for Light Slides (top-bar, 120px High)
```html
<div class="top-bar">
  <span class="page-label">OVERVIEW</span>
  <span class="page-title">课程概述</span>
  <span class="page-num">02 / 10</span>
</div>
```
```css
.top-bar {
  height: 120px;
  background: #FAF8F5;
  display: flex; align-items: center;
  padding: 0 100px;
  border-bottom: 2px solid #EDEAE5;
  flex-shrink: 0;
}
.page-label { font-size: 18px; color: #C0392B; letter-spacing: 0.2em; font-weight: 500; margin-right: 32px; }
.page-title { font-size: 52px; font-weight: 700; color: #1A1A1A; }
.page-num { margin-left: auto; font-size: 20px; color: #CCC; letter-spacing: 0.1em; }
```

### 4.7 Top Large Title Section for Dark Slides / definition-flow Slides (196-220px High)
```html
<div class="top-section">
  <div>
    <div class="page-tag">What is Appreciation?</div>
    <div class="page-title serif">什么是"鉴赏"？</div>
    <div class="page-subtitle">辅助说明文字</div>
  </div>
  <div class="page-num">03 / 10</div>
</div>
```
```css
.top-section {
  height: 196–220px;
  background: #1A1A1A;   /* Dark slide */
  /* Or background: #F8F5F0 for light slides */
  display: flex; align-items: center;
  padding: 0 140px;
  flex-shrink: 0;
  position: relative;
}
.top-section::after {
  content: '';
  position: absolute;
  bottom: 0; left: 140px; right: 140px;
  height: 1px;
  background: rgba(26,26,26,0.1);  /* Light slide */
  /* Or rgba(255,255,255,0.07) for dark slides */
}
.page-title.serif { font-size: 68px; font-weight: 700; letter-spacing: 4px; }
.page-subtitle { font-size: 26px; color: #888; letter-spacing: 2px; margin-top: 12px; }
.page-num { margin-left: auto; align-self: flex-start; padding-top: 52–56px; }
```

### 4.8 Bottom Decorative Dot Row for Covers
```html
<div class="bottom-deco">
  <div class="deco-dot"></div>
  <div class="deco-dot" style="opacity:0.5"></div>
  <div class="deco-dot" style="opacity:0.25"></div>
  <span class="deco-text">ART APPRECIATION</span>
</div>
```
```css
.deco-dot { width: 8px; height: 8px; border-radius: 50%; background: #C0392B; }
.deco-text { font-size: 18px; color: #BBB; letter-spacing: 0.1em; }
.bottom-deco { position: absolute; bottom: 48px; right: 100px; display: flex; align-items: center; gap: 12px; }
```

### 4.9 Image Transition Overlay for Blending Image-Left/Text-Right Layouts
```css
/* Light slides: blend the left image toward the right */
.img-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to right, transparent 60%, #FAF8F5 100%);
}
/* Dark-slide version */
.img-overlay-dark {
  position: absolute; inset: 0;
  background: linear-gradient(to right, transparent 60%, #1A1A1A 100%);
}
/* Cover left-image right-side blend */
.left-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to right, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 80%, rgba(250,248,245,0.6) 100%);
}
/* Dark image filter for dark-background slides */
.concert-img { filter: brightness(0.6) saturate(0.8); }
```

### 4.10 Section Subtitle with Leading Short Line
```html
<div class="scope-title">课程覆盖范围</div>
```
```css
.scope-title {
  font-size: 20–22px;
  color: #999;
  letter-spacing: 0.15em;
  margin-bottom: 28px;
  display: flex; align-items: center; gap: 12px;
}
.scope-title::before {
  content: '';
  display: inline-block;
  width: 32px; height: 2px;
  background: #C0392B;
}
```

### 4.11 Activity Badge (activity-badge)
```html
<div class="activity-badge">
  <i class="fa-solid fa-flask"></i>
  <span>课堂活动</span>
</div>
```
```css
.activity-badge {
  display: inline-flex; align-items: center; gap: 10px;
  background: rgba(192,57,43,0.15);
  border: 1px solid rgba(192,57,43,0.3);
  border-radius: 2px;
  padding: 8px 20px;
  margin-bottom: 32px;
  width: fit-content;
}
.activity-badge i { color: #C0392B; font-size: 16px; }
.activity-badge span { font-size: 16px; color: rgba(192,57,43,0.9); letter-spacing: 3px; }
```

---

## 5. Dedicated Layout Types

### Type 1: Classic Image-Left/Text-Right Cover (cover-split)
- **Structure**: 620px full-height master artwork or art object image on the left (`object-fit: cover`) + beige title area on the right (`flex: 1`, `padding 80px 100px 80px 80px`)
- **Right-side elements**: top-right ghost chapter number (120px, `#F0EDE8`), solid academy red tag with no radius, main title (96px 900), subtitle (36px 300), horizontal divider, metadata row with vertical label/value pairs and 48px gap, bottom decorative dot row
- **Use cases**: course covers and section covers

### Type 2: Top Title Bar + Image-Left/Text-Right Content (top-bar-split)
- **Structure**: 120px top title bar with red English page tag, localized title, and right page number + main left image (780px, gradient blend) + right text area (`padding 64px 100px`)
- **Right-side elements**: welcome/explanatory text (28px 300, line height 1.8, keywords marked in red 500) + section subtitle with leading red line + 2x2 function card grid
- **Card style**: white background, `1px solid #EDEAE5`, square icon container (48px, `#FDF0EE` background), sharp corners with no radius
- **Use cases**: course overview, feature introduction, scope explanation

### Type 3: Top Large Title + Definition Left / Flow Right (definition-flow)
- **Structure**: 220px top title area with English page tag, large serif title, and subtitle (`padding 0 140px`) + body padding of 52-60px 140px
- **Left side**: dark definition block (`#1A1A1A` background, `padding 36px 40px`, white text, red emphasis words) + supplemental note block with pale red border (`rgba(192,57,43,0.06)` background)
- **Right side**: three-column horizontal flow cards with white background and 4px top accent lines that fade from solid to semi-transparent to lighter; each card contains a large icon, LAYER number, name, English name, question sentence, and description
- **Flow arrows**: 48px-wide arrow areas between cards, colored `rgba(192,57,43,0.4)`
- **Use cases**: concept definitions, three-layer models, theoretical frameworks

### Type 4: Dark Left Panel + Step Cards Right (dark-panel-steps)
- **Structure**: 500px dark panel on the left (`#1A1A1A`, 4px red line at top, `padding 0 60px`) + steps area and reference resources area on the right (`padding 64px 100px 64px 72px`, `gap 36px`)
- **Left-side elements**: activity badge with translucent red border, large serif title (52px 700), red accent line (48px), purpose label (15px translucent white), and purpose description
- **Step cards**: white background, 4px radius, serif ghost number (48px, `rgba(192,57,43,0.1)`), step title (22px 700) + description (20px `#777`)
- **Step connector arrow**: 36px wide, colored `rgba(192,57,43,0.3)`
- **Reference resource row**: pale red background (`rgba(192,57,43,0.04)`), red border, icon + title + subtitle
- **Use cases**: classroom activities, experiment steps, operational processes

### Type 5: Five-Question Method List (dark-question-list)
- **Structure**: 196px dark title area + left image below (480px, darkening filter + gradient blend) + right question-card list (`padding 40px 140px 40px 56px`, `gap 18px`)
- **Question cards**: translucent dark background (`rgba(255,255,255,0.04)`), 3px left vertical line (default `rgba(192,57,43,0.2)`, active `#C0392B`), active card background `rgba(192,57,43,0.08)`
- **Inside each card**: serif sequence number (40px, solid red when active) + vertical divider + content area (15px type label + 26px 600 main question) + right icon
- **Use cases**: five-question method frameworks, methodology lists, step lists

### Type 6: Dark Left Sidebar + Table List Right (dark-sidebar-table)
- **Structure**: 420px dark sidebar on the left (`#1A1A1A`, 4px gradient red line on the left, `padding 0 56px`) + table area on the right (`padding 60px 80px 60px 64px`)
- **Left-side elements**: small English label (15px translucent white), large serif title (56px 700, `#F8F5F0`), red accent line (48px), large number (64px 700 red) + unit description
- **Table rows**: three-column grid (section / topic / hours), white background, 4px radius, 96px height, light shadow; **current section highlighted row** uses `#1A1A1A` background and beige-white text
- **Total row**: top divider `2px solid rgba(192,57,43,0.3)`, red total label and value
- **Use cases**: course structure overview, chapter directory, schedule

### Type 7: Three-Column Resource Page (three-column-resources)
- **Structure**: 120px top title bar + body with three equal-width columns (`border-right: 1px solid #EDEAE5`; no border on the last column)
- **Column header**: `padding 40px 56px 32px`, 1px bottom border, 64px icon container with different backgrounds per column (red/green/blue), 32px column title, 19px English subtitle
- **Column content**: `padding 32px 56px`, `gap 24px`; bibliography uses red-dot list; online resources use white cards with solid red icons; field experiences use dashed divider rows with square red icon containers
- **Use cases**: learning resources, recommended reading, reference links

### Type 8: Dark Two-Column Closing Page (dark-discussion-preview)
- **Structure**: full dark background `#1A1A1A` + left discussion area (`flex: 1`, `border-right: 1px solid #2E2E2E`) + right preview area (560px, `#141414`)
- **Left side**: section tag with leading red line (`#C0392B`), large title (56px 900 white), question cards (`#242424` background, 4px solid red left border, 40px 900 red number, 24px 300 `#D0CEC9` text)
- **Right side**: preview header (`border-bottom: 1px solid #2E2E2E`) + preview content area + bottom info bar; CTA button uses solid red background (`#C0392B`)
- **Bottom info bar**: `border-top: 1px solid #2E2E2E`, course name + page number, both `#444`
- **Use cases**: reflection discussions, lesson reviews, section closings, next-lesson previews

---

## 6. Radius and Shadow Specification

| Element | Radius | Shadow |
|------|------|------|
| Content cards on light slides | `4px` | `0 2px 12px rgba(0,0,0,0.06)` |
| Content cards on dark slides | `4px` | None; separated by borders/backgrounds |
| Step cards | `4px` | `0 2px 10px rgba(0,0,0,0.05)` |
| Goal cards | `4px` | `0 2px 16px rgba(0,0,0,0.06)` |
| Square icon containers | `0`, sharp corners | None |
| Circular icon containers | `50%` | None |
| Badges / activity tags | `2px` | None |
| Solid course tags | `0`, sharp corners | None |
| Image containers | `0`, sharp corners | None |
| CTA buttons | `0`, sharp corners | None |
| Question cards on dark slides | `0`, sharp corners | None |

> The overall style favors **low radius and mostly sharp corners** to express academic rigor. Only content cards use a small 4px radius.

---

## 7. ECharts Chart Specification

### Palette
```javascript
const artEduPalette = [
  '#C0392B',  // Academy red (primary)
  '#1A1A1A',  // Ink black
  '#2C3E8C',  // Deep blue
  '#27AE60',  // Green
  '#E67E22',  // Orange
  '#8B6914',  // Golden brown
  '#9B59B6',  // Purple
  '#95A5A6',  // Gray
];
```

### Global Configuration
```javascript
const artEduChartBase = {
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily: "'Noto Sans SC', sans-serif",
    color: '#1A1A1A',
  },
  title: {
    textStyle: { fontSize: 22, fontWeight: 700, color: '#1A1A1A' },
    subtextStyle: { fontSize: 16, color: '#999' },
  },
  legend: {
    textStyle: { fontSize: 16, color: '#666' },
    itemGap: 20,
  },
  grid: { left: 60, right: 40, top: 60, bottom: 50, containLabel: true },
  tooltip: {
    backgroundColor: '#1A1A1A',
    borderColor: 'rgba(192,57,43,0.3)',
    borderWidth: 1,
    textStyle: { color: '#F8F5F0', fontSize: 16 },
  },
};
```

### Bar Chart Example
```javascript
{
  ...artEduChartBase,
  xAxis: {
    type: 'category',
    axisLine: { lineStyle: { color: '#EDEAE5' } },
    axisLabel: { color: '#666', fontSize: 15 },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: '#EDEAE5', type: 'dashed' } },
    axisLabel: { color: '#999', fontSize: 14 },
  },
  series: [{
    type: 'bar',
    barWidth: '50%',
    itemStyle: {
      color: '#C0392B',
      borderRadius: [2, 2, 0, 0],
    },
  }],
}
```

### Line Chart Example
```javascript
{
  ...artEduChartBase,
  series: [{
    type: 'line',
    smooth: true,
    lineStyle: { color: '#C0392B', width: 3 },
    itemStyle: { color: '#C0392B' },
    areaStyle: { color: 'rgba(192,57,43,0.08)' },
  }],
}
```

### Pie Chart Example
```javascript
{
  ...artEduChartBase,
  series: [{
    type: 'pie',
    radius: ['35%', '65%'],
    center: ['50%', '50%'],
    itemStyle: { borderRadius: 2, borderColor: '#FAF8F5', borderWidth: 2 },
    label: { fontSize: 16, color: '#333' },
    color: artEduPalette,
  }],
}
```

---

## 8. AI Illustration Generation Specification

### Style Keywords
- **Artwork**: `museum artwork, fine art photography, editorial art print`
- **Scenes**: `museum interior, gallery space, art classroom, academic setting`
- **Humanities**: `warm academic tone, soft natural lighting, cultural heritage`
- **Chinese ink painting**: `Chinese ink painting, brush and ink, traditional Chinese art, xieyi style`
- **Avoid**: tech feel, neon colors, cyberpunk, cartoon style

### image_search Strategy
- Artwork pages: search `[artist name] [artwork title] artwork museum`
- Scene pages: search `art museum interior gallery exhibition`
- People pages: search `art professor lecture university classroom`
- Architecture pages: search `classical architecture museum building`
- Chinese ink painting pages: search `Chinese ink painting traditional art`
- Music pages: search `classical music concert symphony orchestra`

### generate_image Example Prompts

**Cover / artwork, realistic and not stylized:**
```
photo of [specific artwork or scene], museum quality, warm natural lighting, high detail, editorial photography style
```

**Concept illustration, stylized:**
```
flat editorial illustration of [specific topic], warm beige and deep red color palette, clean academic style, minimal geometric shapes, no shadows, white background, art education visual
```

**Atmospheric scene:**
```
watercolor illustration of [scene description], warm tones, soft brushwork, museum aesthetic, muted palette with red accent, academic art style
```
