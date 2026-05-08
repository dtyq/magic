# Academic Research Visual Specification

## 1. Core Design Concept

- **Rigorous and clear**: use a primarily white background, moderate information density, and a balance of charts and text to convey academic authority.
- **Structured layout**: emphasize information hierarchy with academic elements such as numbering, quote blocks, and data tables.
- **Anchored by deep navy**: use deep navy (#0F2444) as the main color for cover and section pages, and primary blue (#1A6DC0) as the content emphasis color.
- **Dual-font strategy**: use Noto Serif SC for titles to strengthen the academic feel, and Noto Sans SC for body text readability.

---

## 2. Color Specification

```css
:root {
  --bg-primary:   #FFFFFF;
  --bg-secondary: #F0F4F9;
  --bg-accent:    #E8F4FD;
  --bg-teal-soft: #E6FAF8;
  --bg-dark:      #0F2444;
  --bg-dark-2:    #1A3560;

  --text-primary:   #0F1E33;
  --text-secondary: #3D5470;
  --text-muted:     #6B82A0;

  --navy: #0F2444;
  --blue: #1A6DC0;
  --teal: #1A8A7A;

  --highlight-yellow: #F9E84A;
  --positive: #1A7A4A;
  --negative: #B02020;

  --border-light:  #D0DAE8;
  --border-teal:   #7ECFC8;
}
```

---

## 3. Typography and Layout Specification

| Level | Size | Weight | Color |
|------|------|------|------|
| Main title | 60–72px | 800 | --navy, letter-spacing:-0.02em; Noto Serif SC can be used |
| Section title | 44–52px | 700 | --blue, with section numbering such as "Chapter 1" or "1.2" |
| Content title | 36–44px | 600 | --text-primary |
| Subtitle | 26–32px | 500 | --text-secondary |
| Body text | 22–26px | 400 | --text-secondary, line-height:1.8 |
| Data highlight | 52–68px | 800 | --blue or --teal |
| Caption/source | 16–20px | 400 | --text-muted, font-style:italic |

**Font family:** `'Noto Serif SC', 'Noto Sans SC', serif, sans-serif`

**Font import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&family=Noto+Serif+SC:wght@400;600;700&display=swap" rel="stylesheet"/>
```

---

## 4. Decorative Element Specification

**A. Top cover banner** (deep navy, about 15% height):
```html
<div style="position:absolute;top:0;left:0;right:0;height:162px;
  background:var(--bg-dark);"></div>
```

**B. Quote block with a teal left rule**:
```css
border-left: 5px solid var(--teal);
background: var(--bg-teal-soft);
padding: 18px 24px; border-radius: 0 6px 6px 0;
```

**C. Key conclusion block with a blue left rule**:
```css
border-left: 5px solid var(--blue);
background: var(--bg-accent);
padding: 18px 24px; border-radius: 0 6px 6px 0;
```

**D. Yellow highlight annotation**:
```html
<mark style="background:var(--highlight-bg);
  border-bottom:2px solid var(--highlight-yellow);padding:0 4px;">重点内容</mark>
```

**E. Section number background decoration**:
```html
<div style="position:absolute;top:60px;left:60px;
  font-size:120px;font-weight:900;color:rgba(26,109,192,0.06);
  line-height:1;letter-spacing:-0.05em;user-select:none;">1</div>
```

**F. Oversized background text on section pages** (on a dark background):
```html
<div style="position:absolute;right:40px;bottom:-30px;
  font-size:300px;font-weight:900;color:rgba(255,255,255,0.05);
  letter-spacing:-0.05em;user-select:none;">02</div>
```

---

## 5. Dedicated Layout Page Types (8)

### 1. Cover Page
- Top (15%): deep navy banner containing the university/institution name and conference name in white.
- Main body (70%): white area with centered large title (navy, 68px), subtitle, and author information.
- Bottom (15%): light blue-gray information bar for supervisor, date, and discipline, with a 3px blue top rule.

### 2. Research Background Page
- Left (55%): key point list with blue numbered circles and a conclusion quote block.
- Right (45%): ECharts chart or schematic for research status, plus caption.

### 3. Methodology Flow Page
- Top: section title with section number.
- Main body: horizontal flowchart with method-node plus arrows, 4-6 nodes.
- Below: small detail cards for each node, matching the node colors.

### 4. Experiment Data Results Page
- Top: 3-4 result-card components in a row for key metric values.
- Below: ECharts chart on the left (60%) and experiment comparison table on the right (40%).
- Bottom: figure caption (fig-caption), italic, with data source.

### 5. Comparison Analysis Page
- Top: title plus comparison description.
- Main body: exp-table comparing the proposed method against SOTA, with best values bolded in green.
- Bottom: conclusion quote block with a teal left rule.

### 6. Literature Review Page
- Top: title.
- Main body: two-column citation-card list with 4-6 references.
- Right side: vertical research-context timeline.

### 7. Section Page
- Full-screen deep navy (bg-dark) with a 4px blue top rule.
- Left: section number (light blue, 120px) and section name (white, 60px).
- Right: translucent oversized number as background decoration.

### 8. Conclusion and Outlook Page
- Left (50%): key findings list with blue numbering and a conclusion quote block.
- Right (50%): future outlook card with teal border and acknowledgment text.

---

## 6. Corner Radius and Shadow Specification

| Element | Radius | Shadow |
|------|------|------|
| Cards/sections | 6px | 0 2px 8px rgba(0,0,0,0.06) |
| Quote blocks | 0 6px 6px 0 | None |
| Badges/tags | 4px | None |
| Do not use | >8px | Colored shadows |

---

## 7. ECharts Chart Specification

### Palette
```javascript
color: ['#2B6CB0', '#2C7A7B', '#744210', '#276749', '#702459', '#553C9A']
```

### Global Configuration Template
```javascript
const academicTheme = {
    backgroundColor: '#FFFFFF',
    textStyle: { color: '#4A5568', fontFamily: 'Noto Sans SC, sans-serif' },
    title: {
        textStyle: { color: '#1E3A5F', fontSize: 26, fontWeight: 'bold' },
        subtextStyle: { color: '#718096', fontSize: 16 }
    },
    legend: { textStyle: { color: '#4A5568', fontSize: 16 } },
    categoryAxis: {
        axisLine: { lineStyle: { color: '#CBD5E0' } },
        axisTick: { lineStyle: { color: '#CBD5E0' } },
        axisLabel: { color: '#4A5568', fontSize: 16 },
        splitLine: { show: false }
    },
    valueAxis: {
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#718096', fontSize: 15 },
        splitLine: { lineStyle: { color: '#EDF2F7' } }
    },
    tooltip: {
        backgroundColor: '#1E3A5F',
        borderColor: '#2B6CB0',
        textStyle: { color: '#FFFFFF', fontSize: 15 }
    }
};
```

### Line Chart (Research Trends)
```javascript
option = {
    backgroundColor: '#FFFFFF',
    color: ['#2B6CB0', '#2C7A7B', '#744210'],
    grid: { top: 80, bottom: 70, left: 80, right: 60, containLabel: true },
    xAxis: {
        type: 'category',
        axisLabel: { color: '#4A5568', fontSize: 16 },
        axisLine: { lineStyle: { color: '#CBD5E0' } },
        axisTick: { lineStyle: { color: '#CBD5E0' } }
    },
    yAxis: {
        type: 'value',
        name: '数量（篇）',
        nameTextStyle: { color: '#718096', fontSize: 14 },
        axisLabel: { color: '#718096', fontSize: 15 },
        splitLine: { lineStyle: { color: '#EDF2F7' } },
        axisLine: { show: false }
    },
    series: [{
        type: 'line',
        smooth: false,  /* Straight lines feel more rigorous for academic charts */
        lineStyle: { width: 2.5 },
        symbolSize: 6,
        symbol: 'circle'
    }]
};
```

### Grouped Bar Chart (Experiment Comparison)
```javascript
option = {
    backgroundColor: '#FFFFFF',
    color: ['#2B6CB0', '#2C7A7B'],
    grid: { top: 80, bottom: 70, left: 80, right: 40, containLabel: true },
    xAxis: {
        type: 'category',
        axisLabel: { color: '#4A5568', fontSize: 16 },
        axisLine: { lineStyle: { color: '#CBD5E0' } }
    },
    yAxis: {
        type: 'value',
        axisLabel: { color: '#718096', fontSize: 15 },
        splitLine: { lineStyle: { color: '#EDF2F7' } },
        axisLine: { show: false }
    },
    series: [
        { type: 'bar', barWidth: '30%', itemStyle: { borderRadius: [3,3,0,0] },
          label: { show: true, position: 'top', color: '#1E3A5F', fontSize: 14 } },
        { type: 'bar', barWidth: '30%', itemStyle: { borderRadius: [3,3,0,0] },
          label: { show: true, position: 'top', color: '#2C7A7B', fontSize: 14 } }
    ]
};
```

### Scatter Plot (Correlation Analysis)
```javascript
option = {
    backgroundColor: '#FFFFFF',
    color: ['#2B6CB0'],
    grid: { top: 80, bottom: 70, left: 80, right: 60, containLabel: true },
    xAxis: {
        type: 'value',
        name: 'X 变量',
        nameTextStyle: { color: '#718096', fontSize: 14 },
        axisLabel: { color: '#718096', fontSize: 15 },
        splitLine: { lineStyle: { color: '#EDF2F7' } }
    },
    yAxis: {
        type: 'value',
        name: 'Y 变量',
        nameTextStyle: { color: '#718096', fontSize: 14 },
        axisLabel: { color: '#718096', fontSize: 15 },
        splitLine: { lineStyle: { color: '#EDF2F7' } }
    },
    series: [{
        type: 'scatter',
        symbolSize: 10,
        itemStyle: { opacity: 0.7 }
    }]
};
```

---

## 8. AI Illustration Generation Specification

### Style Keywords
Add the following style modifiers to image-generation prompts:
```
academic research style, clean white background, professional scientific illustration,
navy blue and teal color scheme, data-driven visualization, editorial diagram style,
clear and informative, no decorative elements
```

### image_search Keyword Strategy

| Purpose | Recommended Keywords |
|------|-----------|
| Cover/background | `university campus aerial view`, `research laboratory professional`, `academic library books` |
| Research scenes | `scientist laboratory experiment`, `researcher data analysis computer`, `academic conference presentation` |
| Data/charts | `scientific data visualization`, `research methodology diagram`, `statistical analysis chart` |
| Discipline topics | `[具体学科] research concept`, `[领域] academic illustration`, `[主题] scientific diagram` |

### Image Generation Prompt Examples

**Cover Background**
```
clean academic background, subtle navy blue geometric pattern on white, professional university style, minimal decoration, 16:9 wide format, no text
```

**Research Flowchart (Concept Illustration)**
```
scientific diagram of [具体研究主题], clean infographic style, navy blue and teal color scheme, white background, professional academic illustration, labeled components
```

**Discipline Concept Diagram**
```
academic concept illustration of [主题], clean minimal style, blue and teal palette, white background, suitable for research presentation
```

### Notes
- In academic styles, **prioritize** real data charts (ECharts) over images because charts are more persuasive.
- Use `image_search` to find real photos of laboratories, campuses, or scholars; these are more credible than generated images.
- Generated images are suitable for conceptual schematics, research framework diagrams, and visualizations of abstract concepts that cannot be photographed.
- **Avoid** cartoon illustrations, bright color palettes, and decorative patterns; keep the tone academically rigorous.
