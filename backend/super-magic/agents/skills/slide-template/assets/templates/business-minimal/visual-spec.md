# Business Minimal Visual Specification

## 1. Core Design Concept

- **Minimal and professional**: use a primarily white background and generous whitespace so data and conclusions take center stage.
- **McKinsey-style rigor**: emphasize information hierarchy, data logic, and matrix analysis while rejecting decorative redundancy.
- **Anchored by brand blue**: use deep professional blue (#1A56DB) as the only emphasis color, directing every visual focal point to it.
- **Dark-page contrast**: use dark pages (#141820) for cover and section pages to contrast strongly with white content pages and add pacing.

---

## 2. Color Specification

```css
:root {
  --bg-primary:   #FFFFFF;
  --bg-secondary: #F7F8FA;
  --bg-dark:      #141820;
  --text-primary:   #141820;
  --text-secondary: #52586A;
  --text-muted:     #9299AA;
  --brand-blue:        #1A56DB;
  --brand-blue-mid:    #3B7FEF;
  --brand-blue-light:  #EBF2FF;
  --status-up:   #0D7A4E;
  --status-down: #C0392B;
  --status-flat: #92600A;
  --border-light:  #E8ECF2;
}
```

---

## 3. Typography and Layout Specification

| Level | Size | Weight | Color |
|------|------|------|------|
| Main title | 64–76px | 800 | --text-primary, letter-spacing:-0.02em |
| Content title | 40–52px | 700 | --brand-blue or --text-primary |
| Subtitle | 28–36px | 500 | --text-secondary |
| Body text | 22–26px | 400 | --text-primary, line-height:1.75 |
| Data highlight | 56–72px | 800 | --brand-blue |
| Support label | 16–20px | 400 | --text-muted |

Font family: `'Noto Sans SC', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif`

**Font import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap" rel="stylesheet"/>
```

---

## 4. Decorative Element Specification

**A. Brand-blue top bar** (cover page, 8px high):
```css
position:absolute; top:0; left:0; right:0; height:8px;
background: var(--brand-blue);
```

**B. Left rule for content titles**:
```html
<span style="display:inline-block;width:5px;height:1.1em;
  background:var(--brand-blue);margin-right:16px;vertical-align:middle;"></span>
```

**C. Quote block**:
```css
border-left: 5px solid var(--brand-blue);
background: var(--brand-blue-light);
padding: 18px 24px; border-radius: 0 4px 4px 0;
```

**D. Oversized background text on section pages**:
```html
<div style="position:absolute;right:40px;bottom:-20px;
  font-size:280px;font-weight:900;color:rgba(255,255,255,0.04);
  letter-spacing:-0.05em;user-select:none;">02</div>
```

---

## 5. Dedicated Layout Page Types (8)

### 1. Cover Page
- Top: 8px brand-blue horizontal bar.
- Left (55%): large title (76px), subtitle, badge, divider, and speaker/date.
- Right (45%): dark background block (bg-dark) containing oversized white text decoration or company logo.

### 2. Agenda Page
- Left (35%): dark background, brand-blue top bar, and oversized white "AGENDA" text.
- Right (65%): numbered agenda list, each item containing a brand-blue number, section name, and page number.
- Current section highlight: brand-blue left rule plus light blue background.

### 3. KPI Dashboard Page
- Top: four KPI cards in a row, each with a thin blue top rule.
- Below: bar chart on the left (55%) and data table on the right (45%).

### 4. McKinsey Matrix Page
- 2×2 or 3×3 matrix cells with axis labels.
- Highlight key quadrants with a light blue background.
- Each cell: title plus key point description.

### 5. SWOT Quadrants Page
- 2×2 cells distinguished by four colors: green, red, blue, and orange.
- Each cell: full S/W/O/T title plus a 3-5 item key point list.

### 6. Financial Waterfall Page
- Top: title plus time-range badge.
- Main body: ECharts waterfall chart with positive growth in green, negative decline in red, and total in blue.
- Right side: key data summary cards.

### 7. Section Page
- Full-screen dark background (bg-dark) plus 4px blue top rule.
- Left: section number (brand blue, 120px) plus section name (white, 60px).
- Right: translucent oversized number as background decoration.

### 8. Ending Page
- Top: brand-blue horizontal bar (8px).
- Center: thank-you text plus contact card with a blue left rule.
- Bottom: company information plus disclaimer.

---

## 6. Corner Radius and Shadow Specification

| Element | Radius | Shadow |
|------|------|------|
| Cards/sections | 4px | 0 1px 3px rgba(0,0,0,0.06) |
| Emphasis cards | 4px | 0 4px 12px rgba(0,0,0,0.08) |
| Badges/tags | 4px | None |
| Do not use | >8px | Colored shadows |

---

## 7. ECharts Chart Specification

### Palette
```javascript
color: ['#0A58CA', '#5F6368', '#198754', '#DC3545', '#9AA0A6', '#0D3B8E']
```

### Global Configuration Template
```javascript
const theme = {
    backgroundColor: '#FFFFFF',
    textStyle: { color: '#1A1D20', fontFamily: 'Noto Sans SC, sans-serif' },
    title: {
        textStyle: { color: '#1A1D20', fontSize: 28, fontWeight: 'bold' },
        subtextStyle: { color: '#5F6368', fontSize: 18 }
    },
    legend: { textStyle: { color: '#5F6368', fontSize: 18 } },
    categoryAxis: {
        axisLine: { lineStyle: { color: '#DEE2E6' } },
        axisTick: { show: false },
        axisLabel: { color: '#5F6368', fontSize: 16 },
        splitLine: { show: false }
    },
    valueAxis: {
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#9AA0A6', fontSize: 16 },
        splitLine: { lineStyle: { color: '#F0F0F0', type: 'dashed' } }
    },
    tooltip: {
        backgroundColor: '#FFFFFF',
        borderColor: '#DEE2E6',
        textStyle: { color: '#1A1D20', fontSize: 16 }
    }
};
```

### Bar Chart (Quarterly Data Comparison)
```javascript
option = {
    backgroundColor: '#FFFFFF',
    color: ['#0A58CA', '#9AA0A6'],
    grid: { top: 80, bottom: 60, left: 80, right: 40, containLabel: true },
    xAxis: {
        type: 'category',
        data: ['Q1', 'Q2', 'Q3', 'Q4'],
        axisLabel: { color: '#5F6368', fontSize: 18 },
        axisLine: { lineStyle: { color: '#DEE2E6' } },
        axisTick: { show: false }
    },
    yAxis: {
        type: 'value',
        axisLabel: { color: '#9AA0A6', fontSize: 16 },
        splitLine: { lineStyle: { color: '#F0F0F0', type: 'dashed' } },
        axisLine: { show: false }
    },
    series: [{
        type: 'bar',
        barWidth: '40%',
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', color: '#1A1D20', fontSize: 16, fontWeight: 'bold' }
    }]
};
```

### Line Chart (Trend Analysis)
```javascript
option = {
    backgroundColor: '#FFFFFF',
    color: ['#0A58CA', '#198754'],
    grid: { top: 80, bottom: 60, left: 80, right: 40, containLabel: true },
    xAxis: { type: 'category', axisLabel: { color: '#5F6368', fontSize: 18 }, axisLine: { lineStyle: { color: '#DEE2E6' } }, axisTick: { show: false } },
    yAxis: { type: 'value', axisLabel: { color: '#9AA0A6', fontSize: 16 }, splitLine: { lineStyle: { color: '#F0F0F0', type: 'dashed' } }, axisLine: { show: false } },
    series: [{
        type: 'line',
        smooth: true,
        lineStyle: { width: 3 },
        symbolSize: 8,
        areaStyle: { opacity: 0.08 }
    }]
};
```

### Pie Chart (Share Analysis)
```javascript
option = {
    backgroundColor: '#FFFFFF',
    color: ['#0A58CA', '#5F6368', '#198754', '#DC3545', '#9AA0A6'],
    series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '55%'],
        label: { fontSize: 18, color: '#1A1D20', formatter: '{b}\n{d}%' },
        labelLine: { lineStyle: { color: '#DEE2E6' } },
        itemStyle: { borderWidth: 2, borderColor: '#FFFFFF' }
    }]
};
```

---

## 8. AI Illustration Generation Specification

### Style Keywords
Add the following style modifiers to image-generation prompts:
```
minimalist business style, clean white background, professional photography,
soft natural lighting, muted color palette, high contrast black and white tones,
corporate aesthetic, editorial photography style
```

### image_search Keyword Strategy

| Purpose | Recommended Keywords |
|------|-----------|
| Cover/background | `minimalist office architecture`, `clean white workspace`, `abstract geometric black white` |
| People/teams | `professional business portrait`, `corporate team meeting`, `executive leadership photo` |
| Data/technology | `data visualization abstract`, `financial chart professional`, `technology minimal white` |
| Cities/buildings | `modern architecture minimal`, `city skyline black white`, `glass building exterior` |

### Image Generation Prompt Examples

**Background Image (for Covers)**
```
minimalist corporate background, clean white and light gray gradient, subtle geometric lines, professional business aesthetic, no text, ultra wide 16:9
```

**Illustration (Content Page Accent)**
```
flat design business icon illustration, minimal line art style, deep blue on white background, professional corporate theme, [具体主题], clean and simple
```

### Notes
- Prefer `image_search` for real photography because it is more persuasive than generated images.
- Generated images are suitable for solid-color or gradient backgrounds, icon illustrations, and specific scenarios that cannot be found through search.
- For the Business Minimal style, **avoid** bright colors, complex textures, and cartoon styles.
