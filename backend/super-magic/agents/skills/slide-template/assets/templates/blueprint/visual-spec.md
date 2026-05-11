# Engineering Grid Blue (Blueprint) Visual Specification

## 1. Core Design Concept

- **Engineering precision**: off-white background plus light gray grid lines simulate engineering drafting paper, conveying rational, precise, and professional technical authority.
- **Lines as language**: use precise lines for all separation, connection, and annotation; avoid decorative color blocks so information is expressed through structure.
- **Led by engineering blue**: use engineering blue (#2563EB) as the core emphasis color for titles, data highlights, and key nodes, supported by dark slate text.
- **Data-driven layouts**: prioritize information-dense layouts such as charts, flowcharts, architecture diagrams, and comparison tables for technical review scenarios.

---

## 2. Color Specification

```css
:root {
  /* Backgrounds */
  --bg-primary:    #FAF8F5;   /* Engineering paper off-white primary background */
  --bg-secondary:  #F1F5F9;   /* Secondary light blue-gray background */
  --bg-card:       #FFFFFF;   /* White card background */
  --bg-dark:       #1E293B;   /* Dark cover/section background */
  --bg-dark-2:     #0F172A;   /* Deeper dark background */
  --bg-blue-soft:  #EFF6FF;   /* Light blue fill area */
  --bg-amber-soft: #FFFBEB;   /* Light amber warning area */

  /* Brand colors */
  --blue:          #2563EB;   /* Engineering blue - core emphasis */
  --blue-dark:     #1E3A8A;   /* Dark blue - titles/key elements */
  --blue-light:    #BFDBFE;   /* Light blue - fills/backgrounds */
  --amber:         #F59E0B;   /* Amber - warnings/key annotations */
  --navy:          #1E293B;   /* Dark slate blue - covers */

  /* Text */
  --text-primary:   #1E293B;  /* Dark slate gray - primary text */
  --text-secondary: #475569;  /* Medium gray - secondary text */
  --text-muted:     #94A3B8;  /* Light gray - notes/captions */
  --text-on-dark:   #F8FAFC;  /* Text on dark backgrounds */
  --text-blue:      #2563EB;  /* Blue emphasis text */

  /* Grid and lines */
  --grid-line:      #E2E8F0;  /* Background grid line */
  --border-light:   #CBD5E1;  /* Light border */
  --border-blue:    #93C5FD;  /* Blue border */
  --border-dark:    #334155;  /* Dark border */
  --line-tech:      2px solid #2563EB; /* Technical connector line */

  /* Shadows */
  --shadow-sm:  0 1px 3px rgba(0,0,0,0.08);
  --shadow-md:  0 4px 12px rgba(37,99,235,0.10);
  --shadow-lg:  0 8px 24px rgba(37,99,235,0.15);
}
```

---

## 3. Typography and Layout Specification

| Level | Size | Weight | Color | Notes |
|------|------|------|------|------|
| Cover main title | 64–72px | 700 | --text-on-dark | letter-spacing: -0.02em |
| Page main title | 44–52px | 700 | --blue-dark | letter-spacing: -0.01em |
| Section title | 36–42px | 600 | --text-primary | With blue left rule |
| Subtitle | 26–30px | 500 | --text-secondary | |
| Body text | 20–24px | 400 | --text-secondary | line-height: 1.75 |
| Data highlight | 48–64px | 700 | --blue | For KPI use |
| Code/technical annotation | 18–20px | 400 | --blue-dark | font-family: monospace |
| Caption/source | 15–18px | 400 | --text-muted | font-style: italic |

**Font family:** `'Inter', 'Noto Sans SC', sans-serif` (Inter first for English, Noto Sans SC for Chinese)

**Font import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet"/>
```

---

## 4. Decorative Element Specification

**A. Background grid (global)**:
```css
body, .slide-bg {
  background-color: var(--bg-primary);
  background-image:
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

**B. Technical annotation line (dimension-line)**:
```html
<div class="dimension-line">
  <span class="dl-label">系统边界</span>
</div>
```
```css
.dimension-line {
  position: relative;
  border-top: 1.5px solid var(--blue);
  margin: 8px 0;
}
.dimension-line .dl-label {
  position: absolute;
  top: -10px; left: 12px;
  background: var(--bg-primary);
  padding: 0 6px;
  font-size: 13px;
  color: var(--blue);
  font-family: 'Courier New', monospace;
}
```

**C. Blue left-rule title (section-header)**:
```html
<div class="section-header">模块名称</div>
```
```css
.section-header {
  font-size: 36px;
  font-weight: 700;
  color: var(--text-primary);
  border-left: 5px solid var(--blue);
  padding-left: 20px;
  line-height: 1.3;
}
```

**D. Technical card (tech-card)**:
```html
<div class="tech-card">内容</div>
```
```css
.tech-card {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-top: 3px solid var(--blue);
  border-radius: 0 0 4px 4px;
  padding: 24px 28px;
  box-shadow: var(--shadow-sm);
}
```

**E. Node badge (node-badge)**:
```html
<div class="node-badge">API</div>
```
```css
.node-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--blue);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  font-family: 'Courier New', monospace;
  padding: 4px 10px;
  border-radius: 3px;
  letter-spacing: 0.05em;
}
```

**F. Warning/key annotation box (alert-box)**:
```html
<div class="alert-box">⚠ 关键约束条件</div>
```
```css
.alert-box {
  background: var(--bg-amber-soft);
  border: 1.5px solid var(--amber);
  border-left: 4px solid var(--amber);
  border-radius: 0 4px 4px 0;
  padding: 14px 20px;
  font-size: 18px;
  color: #92400E;
}
```

**G. Dark cover background banner**:
```html
<div class="cover-header">
  <span class="cover-tag">TECHNICAL REVIEW</span>
  <span class="cover-date">2026 · Q2</span>
</div>
```
```css
.cover-header {
  background: var(--bg-dark);
  padding: 16px 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.cover-tag {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  letter-spacing: 0.15em;
  color: var(--blue-light);
}
.cover-date {
  font-size: 14px;
  color: var(--text-muted);
}
```

---

## 5. Dedicated Layout Page Types (8)

### 1. Cover Page
- Top (10%): dark banner (bg-dark), monospace project type label on the left and date on the right.
- Main body (75%): grid background, large title on the left (72px, blue-dark), subtitle, and explanatory text with a blue left rule.
- Right (40%): blue-bordered architecture schematic or technical icon group.
- Bottom (15%): light gray information bar containing version, author, and department information.

### 2. System Architecture Page
- Full-page grid background.
- Top: section-header title.
- Main body: layered architecture diagram with top, middle, and bottom layers; each layer combines tech-card and node-badge.
- Use dimension-line connectors with arrows between layers.
- Right side: legend panel (legend-panel).

### 3. Technical Comparison Page
- Top: title plus comparison description.
- Main body: left-right two-column comparison, blue vs gray borders, with the preferred option highlighted.
- Bottom: conclusion alert-box in blue plus decision recommendation.

### 4. Data Metrics Page
- Top: title.
- Upper main body: 3-4 KPI cards in a row with large blue numbers and trend arrows.
- Lower main body: ECharts line/bar chart (60%) plus metric explanation list (40%).

### 5. Process Flow Page
- Top: title.
- Main body: horizontal or vertical flow nodes using node-badge, connector lines, and tech-card descriptions.
- Each node: numbered circle, step name, and brief description.
- Use blue for key steps and amber for exception branches.

### 6. Code/Configuration Display Page
- Left (55%): dark code block (bg-dark, monospace, blue/green/yellow syntax highlighting).
- Right (45%): line-by-line explanatory tech-card items plus alert-box key notes.
- Bottom: row of small performance data cards.

### 7. Section Page
- Full-screen dark blue-black background (bg-dark-2) with low-opacity white grid lines.
- Left: monospace section number (120px, low-opacity blue) plus section name (white, 60px).
- Right: tag group for section keywords using node-badge variants.
- Bottom: thin blue divider plus section introduction.

### 8. Conclusion/Closing Page
- Background: bg-primary grid.
- Top: large title with blue left rule.
- Main body: three-column conclusion cards (tech-card with numbering).
- Bottom: contact information, version number, and QR code in a blue-bordered card.

---

## 6. Corner Radius and Shadow Specification

| Element | Radius | Shadow |
|------|------|------|
| tech-card | 0 0 4px 4px, bottom only | shadow-sm |
| node-badge | 3px | None |
| alert-box | 0 4px 4px 0 | None |
| KPI card | 4px | shadow-md |
| Code block | 4px | None |
| Chart container | 0px | shadow-sm |

---

## 7. ECharts Chart Specification

### Palette
```javascript
color: ['#2563EB', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
```

### Global Configuration Template
```javascript
const blueprintTheme = {
  backgroundColor: 'transparent',
  textStyle: { color: '#475569', fontFamily: 'Inter, Noto Sans SC, sans-serif', fontSize: 14 },
  title: {
    textStyle: { color: '#1E293B', fontSize: 22, fontWeight: '700' },
    subtextStyle: { color: '#94A3B8', fontSize: 14 }
  },
  legend: { textStyle: { color: '#475569', fontSize: 14 } },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#CBD5E1', width: 1.5 } },
    axisTick: { show: false },
    axisLabel: { color: '#475569', fontSize: 14 },
    splitLine: { show: false }
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#94A3B8', fontSize: 13 },
    splitLine: { lineStyle: { color: '#E2E8F0', type: 'dashed' } }
  },
  tooltip: {
    backgroundColor: '#1E293B',
    borderColor: '#2563EB',
    borderWidth: 1,
    textStyle: { color: '#F8FAFC', fontSize: 14 }
  }
};
```

### Line Chart (Performance Trend)
```javascript
option = {
  backgroundColor: 'transparent',
  color: ['#2563EB', '#10B981'],
  grid: { top: 60, bottom: 50, left: 60, right: 40, containLabel: true },
  xAxis: {
    type: 'category',
    axisLabel: { color: '#475569', fontSize: 13 },
    axisLine: { lineStyle: { color: '#CBD5E1' } },
    axisTick: { show: false }
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#94A3B8', fontSize: 13 },
    splitLine: { lineStyle: { color: '#E2E8F0', type: 'dashed' } },
    axisLine: { show: false }
  },
  series: [{
    type: 'line',
    smooth: true,
    lineStyle: { width: 2.5, color: '#2563EB' },
    symbolSize: 7,
    symbol: 'circle',
    itemStyle: { color: '#2563EB', borderColor: '#fff', borderWidth: 2 },
    areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
      colorStops: [{ offset: 0, color: 'rgba(37,99,235,0.15)' }, { offset: 1, color: 'rgba(37,99,235,0.01)' }] } }
  }]
};
```

### Bar Chart (System Comparison)
```javascript
option = {
  backgroundColor: 'transparent',
  color: ['#2563EB', '#94A3B8'],
  grid: { top: 60, bottom: 50, left: 60, right: 20, containLabel: true },
  xAxis: {
    type: 'category',
    axisLabel: { color: '#475569', fontSize: 13 },
    axisLine: { lineStyle: { color: '#CBD5E1' } },
    axisTick: { show: false }
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#94A3B8', fontSize: 13 },
    splitLine: { lineStyle: { color: '#E2E8F0', type: 'dashed' } },
    axisLine: { show: false }
  },
  series: [
    { type: 'bar', barWidth: '32%', itemStyle: { borderRadius: [2,2,0,0], color: '#2563EB' },
      label: { show: true, position: 'top', color: '#1E293B', fontSize: 13, fontWeight: '600' } },
    { type: 'bar', barWidth: '32%', itemStyle: { borderRadius: [2,2,0,0], color: '#CBD5E1' },
      label: { show: true, position: 'top', color: '#475569', fontSize: 13 } }
  ]
};
```

### Radar Chart (Capability Assessment)
```javascript
option = {
  backgroundColor: 'transparent',
  color: ['#2563EB'],
  radar: {
    indicator: [/* Metric array */],
    shape: 'polygon',
    splitNumber: 4,
    axisName: { color: '#475569', fontSize: 13 },
    splitLine: { lineStyle: { color: '#E2E8F0' } },
    splitArea: { areaStyle: { color: ['rgba(37,99,235,0.03)', 'rgba(37,99,235,0.06)'] } },
    axisLine: { lineStyle: { color: '#CBD5E1' } }
  },
  series: [{
    type: 'radar',
    data: [{ value: [], itemStyle: { color: '#2563EB' },
      areaStyle: { color: 'rgba(37,99,235,0.15)' },
      lineStyle: { color: '#2563EB', width: 2 } }]
  }]
};
```

---

## 8. AI Illustration Generation Specification

### Style Keywords
```
technical blueprint style, engineering diagram, clean vector illustration,
navy blue and white color scheme, precise line work, isometric or flat 2D,
professional technical documentation, grid background, no decorative elements,
engineering paper aesthetic
```

### image_search Keyword Strategy

| Purpose | Recommended Keywords |
|------|-----------|
| Cover/background | `system architecture diagram clean`, `technical blueprint white background`, `engineering schematic professional` |
| Architecture diagrams | `microservices architecture diagram`, `cloud infrastructure blueprint`, `software system design diagram` |
| Data/metrics | `technical dashboard metrics`, `performance monitoring chart`, `system analytics visualization` |
| Flowcharts | `technical workflow diagram`, `engineering process flowchart`, `system integration diagram` |

### Image Generation Prompt Examples

**Cover Background**
```
technical blueprint style background, subtle grid pattern on off-white paper, engineering drawing aesthetic, light blue accent lines, precise geometric shapes, professional technical documentation style, no text, 16:9
```

**Architecture/Process Concept Diagram**
```
clean technical diagram of [具体主题], blueprint engineering style, navy blue and white, precise line work, labeled components with arrows, flat 2D isometric view, professional documentation quality, white background
```

### Notes
- Prefer **ECharts charts** for presenting data because they feel more technical.
- Prefer hand-built architecture diagrams with **HTML+CSS** (div layouts, borders, and arrows); they are clearer and easier to control than images.
- Images are suitable for conceptual covers, scene renders, and complex schematics that cannot be implemented with code.
- **Avoid** watercolor, illustration, and cartoon styles; keep the tone rational and engineering-oriented.
