# Notion SaaS Dashboard Visual Spec

## 1. Core Design Concept

- **Product-grade polish**: A light gray base, white cards, and thin borders emulate modern SaaS UIs such as Notion, Linear, and Figma, conveying a professional, trustworthy, efficient product feel.
- **Cards as information units**: All content uses cards as the base container, with consistent spacing, clear hierarchy, and moderate information density.
- **Data-first presentation**: KPI numbers, progress bars, and status tags are the core visual elements. Charts stay clean and restrained without excessive decoration.
- **System font stack**: Inter and system fonts keep the visual language consistent with product UIs and avoid typographic jumps.

---

## 2. Color Specification

```css
:root {
  /* Backgrounds */
  --bg-primary:    #F7F7F5;   /* Notion light-gray primary background */
  --bg-secondary:  #EFEFED;   /* Secondary background */
  --bg-card:       #FFFFFF;   /* White card background */
  --bg-dark:       #191919;   /* Dark cover background */
  --bg-hover:      #F0F0EE;   /* Hover-state background */
  --bg-blue-soft:  #EBF5FF;   /* Soft blue fill */
  --bg-green-soft: #EEFBF3;   /* Soft green fill */
  --bg-red-soft:   #FFF0F0;   /* Soft red fill */
  --bg-yellow-soft:#FFFAE5;   /* Soft yellow fill */

  /* Brand / accent colors */
  --blue:          #2383E2;   /* Notion blue - primary accent */
  --blue-dark:     #0F5FA8;   /* Dark blue */
  --blue-light:    #A8D4F5;   /* Light blue */
  --green:         #0F7B6C;   /* Success green */
  --red:           #E03E3E;   /* Warning red */
  --yellow:        #DFAB01;   /* Attention yellow */
  --purple:        #6940A5;   /* Purple tag */
  --orange:        #D9730D;   /* Orange tag */

  /* Text */
  --text-primary:   #1F1F1F;  /* Primary text */
  --text-secondary: #6B6B6B;  /* Secondary text */
  --text-muted:     #9B9B9B;  /* Muted text */
  --text-on-dark:   #FFFFFF;  /* Text on dark backgrounds */
  --text-blue:      #2383E2;  /* Blue text */

  /* Borders */
  --border-light:   #E5E5E5;  /* Light border */
  --border-medium:  #D0D0D0;  /* Medium border */
  --border-dark:    #A0A0A0;  /* Dark border */
  --border-blue:    #A8D4F5;  /* Blue border */

  /* Shadows */
  --shadow-xs:  0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm:  0 1px 4px rgba(0,0,0,0.08);
  --shadow-md:  0 4px 12px rgba(0,0,0,0.10);
  --shadow-lg:  0 8px 24px rgba(0,0,0,0.12);
}
```

---

## 3. Typography Specification

| Level | Size | Weight | Color | Notes |
|------|------|------|------|------|
| Cover title | 60-68px | 700 | --text-on-dark | `letter-spacing: -0.02em` |
| Page title | 40-48px | 700 | --text-primary | `letter-spacing: -0.01em` |
| Card title | 28-34px | 600 | --text-primary | |
| Subtitle / label | 20-24px | 500 | --text-secondary | |
| Body | 17-20px | 400 | --text-secondary | `line-height: 1.7` |
| Large data text | 44-56px | 700 | --blue or --text-primary | KPI only |
| Tags / badges | 12-14px | 500 | Semantic colors | `letter-spacing: 0.02em` |
| Captions / metadata | 13-15px | 400 | --text-muted | |

**Font family:** `'Inter', -apple-system, BlinkMacSystemFont, 'Noto Sans SC', sans-serif`

**Font import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet"/>
```

---

## 4. Decorative Element Specification

**A. Content Card (notion-card):**
```html
<div class="notion-card">内容</div>
```
```css
.notion-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 24px 28px;
  box-shadow: var(--shadow-sm);
}
```

**B. Status Tag (status-tag):**
```html
<span class="status-tag status-blue">进行中</span>
<span class="status-tag status-green">已完成</span>
<span class="status-tag status-red">阻塞</span>
<span class="status-tag status-yellow">待评审</span>
```
```css
.status-tag {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 4px;
  font-size: 13px; font-weight: 500;
}
.status-blue   { background: var(--bg-blue-soft);   color: var(--blue); }
.status-green  { background: var(--bg-green-soft);  color: var(--green); }
.status-red    { background: var(--bg-red-soft);    color: var(--red); }
.status-yellow { background: var(--bg-yellow-soft); color: var(--yellow); }
```

**C. Property Row (property-row):**
```html
<div class="property-row">
  <span class="prop-key">负责人</span>
  <span class="prop-value">张三</span>
</div>
```
```css
.property-row {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 0; border-bottom: 1px solid var(--border-light);
  font-size: 15px;
}
.prop-key   { color: var(--text-muted); min-width: 80px; flex-shrink: 0; }
.prop-value { color: var(--text-primary); font-weight: 500; }
```

**D. KPI Data Card (kpi-card):**
```html
<div class="kpi-card">
  <div class="kpi-value">2,847</div>
  <div class="kpi-label">月活用户</div>
  <div class="kpi-delta up">↑ 12.4%</div>
</div>
```
```css
.kpi-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 20px 24px;
  box-shadow: var(--shadow-xs);
}
.kpi-value { font-size: 44px; font-weight: 700; color: var(--text-primary); line-height: 1; letter-spacing: -0.02em; }
.kpi-label { font-size: 13px; color: var(--text-muted); margin-top: 6px; }
.kpi-delta { font-size: 14px; font-weight: 600; margin-top: 4px; }
.kpi-delta.up   { color: var(--green); }
.kpi-delta.down { color: var(--red); }
```

**E. Progress Bar (progress-bar):**
```html
<div class="progress-wrap">
  <div class="progress-bar" style="width:72%"></div>
</div>
```
```css
.progress-wrap { height: 6px; background: var(--bg-secondary); border-radius: 3px; overflow: hidden; }
.progress-bar  { height: 100%; background: var(--blue); border-radius: 3px; }
```

**F. Data Table (notion-table):**
```css
.notion-table { width: 100%; border-collapse: collapse; font-size: 15px; }
.notion-table th {
  text-align: left; padding: 10px 14px;
  font-size: 12px; font-weight: 600; color: var(--text-muted);
  letter-spacing: 0.06em; text-transform: uppercase;
  border-bottom: 1px solid var(--border-light);
}
.notion-table td {
  padding: 10px 14px; border-bottom: 1px solid var(--bg-secondary);
  color: var(--text-secondary); vertical-align: middle;
}
.notion-table tr:last-child td { border-bottom: none; }
.notion-table tr:hover td { background: var(--bg-hover); }
```

**G. Cover Top Navigation Bar (nav-bar):**
```css
.nav-bar {
  position: absolute; top: 0; left: 0; right: 0; height: 52px;
  background: rgba(25,25,25,0.95);
  display: flex; align-items: center; padding: 0 48px;
  gap: 24px; border-bottom: 1px solid rgba(255,255,255,0.08);
}
.nav-logo { font-size: 18px; font-weight: 700; color: #fff; }
.nav-item  { font-size: 14px; color: rgba(255,255,255,0.6); cursor: pointer; }
.nav-item.active { color: #fff; }
```

**H. Feature Card (feat-card):**
```html
<div class="feat-card blue">
  <div class="feat-icon" style="background:var(--bg-blue-soft);">🤖</div>
  <div class="feat-title">多 Agent 协作</div>
  <div class="feat-desc">主理人 Agent 调度多个专家 Agent 并行工作，分工精细、效率翻倍。</div>
  <div class="feat-meta"><span class="status-tag status-blue">已上线</span></div>
</div>
```
The 3px color bar at the top distinguishes feature categories (blue/green/purple/orange/red/yellow).

**I. Quote Block (quote-block):**
```html
<div class="quote-block">
  用 AI 替代市场、运营、法务等岗位，零人力成本 7×24 小时产出。
  <div class="quote-author">— 超级麦吉用户案例</div>
</div>
```

**J. Callout:**
```html
<div class="callout blue">
  <span class="callout-icon">💡</span>
  <span class="callout-text">企业级开源 AI Agent 平台，Apache 2.0 协议，数据完全自主。</span>
</div>
```
Supports four semantic colors: blue, green, yellow, and red.

**K. Number Badge (number-badge):**
```html
<span class="number-badge">1</span>
<span class="number-badge outline">2</span>
<span class="number-badge gray">3</span>
```

**L. Data Highlight Card (highlight-card):**
```html
<div class="highlight-card">
  <div class="hc-value">10亿+</div>
  <div class="hc-label">日均 Token 处理量</div>
  <div class="hc-delta">↑ 持续增长</div>
</div>
```
Blue gradient background with a decorative circle in the upper-right, suitable for hero data proof points on cover slides.

**M. Tag Pill (tag-pill):**
```html
<div class="tag-group">
  <span class="tag-pill blue">开源</span>
  <span class="tag-pill green">企业级</span>
  <span class="tag-pill purple">多 Agent</span>
  <span class="tag-pill orange">沙盒隔离</span>
</div>
```

**N. Testimonial Card (testimonial-card):**
```html
<div class="testimonial-card">
  <div class="testimonial-stars">★★★★★</div>
  <div class="testimonial-text">8 人团队用超级麦吉，完成了 80 人团队的工作量。</div>
  <div class="testimonial-author">
    <div class="author-avatar">张</div>
    <div>
      <div class="author-name">张明远</div>
      <div class="author-role">跨境电商 · CEO</div>
    </div>
  </div>
</div>
```

**O. Product Matrix Card (matrix-card):**
```html
<div class="matrix-card">
  <div class="matrix-icon" style="background:var(--bg-blue-soft);">⚡</div>
  <div>
    <div class="matrix-title">超级麦吉 Super Magic</div>
    <div class="matrix-desc">通用型 AI Agent，专为复杂任务场景设计，支持多 Agent 协作。</div>
    <span class="matrix-badge">已开源</span>
  </div>
</div>
```

**P. Security and Compliance Badge (shield-badge):**
```html
<div class="shield-badge">
  <div class="shield-icon">🔒</div>
  <div>
    <div class="shield-title">沙盒安全隔离</div>
    <div class="shield-desc">自研沙盒容器 + VPC 隔离，高危动作人工审批</div>
  </div>
</div>
```

**Q. Enhanced Comparison Table (compare-table):**
```html
<table class="compare-table">
  <thead><tr>
    <th>功能</th><th>传统工具</th><th class="highlight">超级麦吉</th>
  </tr></thead>
  <tbody>
    <tr>
      <td>多 Agent 协作</td>
      <td><span class="cross">—</span></td>
      <td class="highlight"><span class="check">✓</span></td>
    </tr>
  </tbody>
</table>
```

**R. Timeline:**
```html
<div class="timeline">
  <div class="timeline-item">
    <div class="timeline-dot done">✓</div>
    <div class="timeline-content">
      <div class="timeline-title">超级麦吉 1.0 发布</div>
      <div class="timeline-desc">首个开源一站式 AI 生产力平台上线</div>
      <div class="timeline-date">2025年Q3</div>
    </div>
  </div>
</div>
```

**S. Metric Comparison Row (metric-row):**
```html
<div class="metric-row">
  <span class="metric-label">任务完成率</span>
  <span class="metric-value green">96.8%</span>
</div>
```

**T. Page Header (page-header):**
```html
<div class="page-header">
  <div>
    <div class="page-title">产品矩阵全景</div>
    <div class="page-subtitle">四大产品模块，覆盖企业 AI 全场景</div>
  </div>
  <span class="status-tag status-green">全部已开源</span>
</div>
```

---

## 5. Dedicated Layout Types (8)

### 1. Cover
- Full-screen dark background (`bg-dark #191919`) + top `nav-bar` that simulates product navigation
- Left side (55%): large title (60px), subtitle, and two CTA button styles
- Right side (45%): product screenshot or UI mockup using nested `notion-card` layout
- Bottom: customer logo row or data proof points

### 2. Features
- Top: page title + subtitle
- Body: 2x3 or 3x2 feature card grid (`notion-card`, with icon + title + description)
- Each card can place a `status-tag` in the upper-right

### 3. Dashboard
- Top: four KPI cards in a row
- Lower left (60%): ECharts line or bar chart
- Lower right (40%): `notion-table` data list + progress bars

### 4. Comparison
- Top: title
- Body: three comparison cards (Free / Pro / Enterprise), with the middle column highlighted by a blue border
- Each column: large price text + feature list (green checkmarks / gray dashes)

### 5. Workflow
- Top: title
- Body: horizontal step cards (4-5 steps, `notion-card` + numbered circle + arrow connectors)
- Each step card contains a title, description, and `status-tag`

### 6. Status
- Top: title + date
- Body: `notion-table` with project name / owner / status / progress / due date
- Status column uses the `status-tag` component
- Bottom: overall progress summary using `progress-bar`

### 7. Section
- Full-screen dark background (`bg-dark`) + top `nav-bar`
- Center: section number (large, low-opacity blue) + section name (white, 52px)
- Below: three key points for the section in a row of small white cards

### 8. Closing
- Dark background + centered large title
- Primary CTA button with blue fill + secondary outlined CTA
- Bottom: contact `property-row` or QR-code card

---

## 6. Radius and Shadow Specification

| Element | Radius | Shadow |
|------|------|------|
| notion-card | 8px | shadow-sm |
| kpi-card | 8px | shadow-xs |
| status-tag | 4px | none |
| Buttons | 6px | none |
| Chart container | 8px | shadow-sm |
| Table container | 8px | shadow-sm |
| Cover screenshot frame | 10px | shadow-lg |

---

## 7. ECharts Chart Specification

### Palette
```javascript
color: ['#2383E2', '#0F7B6C', '#D9730D', '#6940A5', '#E03E3E', '#DFAB01']
```

### Global Configuration Template
```javascript
const notionTheme = {
  backgroundColor: 'transparent',
  textStyle: { color: '#6B6B6B', fontFamily: 'Inter, Noto Sans SC, sans-serif', fontSize: 13 },
  title: {
    textStyle: { color: '#1F1F1F', fontSize: 20, fontWeight: '600' },
    subtextStyle: { color: '#9B9B9B', fontSize: 13 }
  },
  legend: { textStyle: { color: '#6B6B6B', fontSize: 13 } },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#E5E5E5', width: 1 } },
    axisTick: { show: false },
    axisLabel: { color: '#9B9B9B', fontSize: 12 },
    splitLine: { show: false }
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#9B9B9B', fontSize: 12 },
    splitLine: { lineStyle: { color: '#F0F0EE' } }
  },
  tooltip: {
    backgroundColor: '#1F1F1F',
    borderColor: '#333',
    borderWidth: 1,
    textStyle: { color: '#FFFFFF', fontSize: 13 }
  }
};
```

### Line Chart (Growth Trend)
```javascript
option = {
  backgroundColor: 'transparent',
  color: ['#2383E2', '#0F7B6C'],
  grid: { top: 50, bottom: 40, left: 50, right: 30, containLabel: true },
  xAxis: {
    type: 'category',
    axisLabel: { color: '#9B9B9B', fontSize: 12 },
    axisLine: { lineStyle: { color: '#E5E5E5' } },
    axisTick: { show: false }
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#9B9B9B', fontSize: 12 },
    splitLine: { lineStyle: { color: '#F0F0EE' } },
    axisLine: { show: false }
  },
  series: [{
    type: 'line', smooth: true,
    lineStyle: { width: 2.5 },
    symbolSize: 6, symbol: 'circle',
    itemStyle: { color: '#2383E2', borderColor: '#fff', borderWidth: 2 },
    areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
      colorStops: [{ offset: 0, color: 'rgba(35,131,226,0.12)' }, { offset: 1, color: 'rgba(35,131,226,0)' }] } }
  }]
};
```

### Bar Chart (Feature Usage)
```javascript
option = {
  backgroundColor: 'transparent',
  color: ['#2383E2'],
  grid: { top: 40, bottom: 40, left: 50, right: 20, containLabel: true },
  xAxis: {
    type: 'category',
    axisLabel: { color: '#9B9B9B', fontSize: 12 },
    axisLine: { lineStyle: { color: '#E5E5E5' } },
    axisTick: { show: false }
  },
  yAxis: {
    type: 'value',
    axisLabel: { color: '#9B9B9B', fontSize: 12 },
    splitLine: { lineStyle: { color: '#F0F0EE' } },
    axisLine: { show: false }
  },
  series: [{
    type: 'bar', barWidth: '50%',
    itemStyle: { borderRadius: [4,4,0,0], color: '#2383E2' },
    label: { show: true, position: 'top', color: '#6B6B6B', fontSize: 12 }
  }]
};
```

### Donut Chart (Share Analysis)
```javascript
option = {
  backgroundColor: 'transparent',
  color: ['#2383E2', '#0F7B6C', '#D9730D', '#6940A5'],
  series: [{
    type: 'pie', radius: ['45%', '70%'],
    center: ['50%', '50%'],
    itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 4 },
    label: { show: true, color: '#6B6B6B', fontSize: 13 },
    emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.1)' } }
  }]
};
```

---

## 8. AI Illustration Generation Specification

### Style Keywords
```
SaaS product UI screenshot style, clean minimal interface, light gray background,
white cards with subtle shadows, modern dashboard design, Notion/Linear aesthetic,
professional product illustration, no decorative elements, screen mockup style
```

### image_search Keyword Strategy

| Use Case | Recommended Keywords |
|------|-----------|
| Cover / product screenshot | `SaaS dashboard UI design`, `product interface screenshot`, `modern web app design` |
| Feature display | `productivity tool features`, `project management software UI`, `team collaboration platform` |
| Data / dashboard | `analytics dashboard design`, `data visualization interface`, `business metrics dashboard` |
| Team / collaboration | `remote team collaboration`, `product team workflow`, `B2B software presentation` |

### Image Generation Prompt Examples

**Cover product screenshot**
```
clean SaaS product dashboard UI mockup, light gray background #F7F7F5, white card components with subtle shadows, blue accent #2383E2, Inter font style, modern minimal design, showing [具体功能], no decorative elements, professional product screenshot style
```

**Feature icon illustration**
```
flat minimal icon illustration of [功能主题], clean line style, blue #2383E2 on white background, simple geometric shapes, SaaS product icon style, no gradients
```

### Notes
- Prefer **ECharts charts** for data display because they best match the product UI style
- Use the **notion-table** component for structured data because it is clearer than images
- Images are suitable for cover product UI screenshots and feature scenario illustrations
- **Avoid** hand-drawn, illustrated, or retro styles; keep a modern SaaS product feel
