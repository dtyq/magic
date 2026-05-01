# Late-Night Code Studio (Tech Dark) Visual Spec

## 1. Core Design Concept

- **Immersive tech feel**: A near-black deep navy base (#070B14) creates a professional, frontier atmosphere, with electric cyan and tech blue as accent colors.
- **Layered lighting**: Gradient text, glow shadows, glassmorphism cards, and scan-line textures build multilayered visual depth.
- **Data visualization first**: Charts and data are the protagonists; all colors are optimized for ECharts charts on dark backgrounds.
- **Interface-driven design**: Mimics a real operating-system UI with a top status bar, bottom info bar, and content area, creating the impact of a "live system screenshot."

---

## 2. Color Spec

```css
:root {
  --bg-base: #070b14;
  --bg-surface: #0d1525;
  --bg-elevated: #162035;
  --bg-overlay: #1e2d47;
  --bg-glass: rgba(255, 255, 255, 0.04);
  --bg-glass-md: rgba(255, 255, 255, 0.07);

  --text-primary: #edf2fa;
  --text-secondary: #7b90b2;
  --text-muted: #3d5070;

  --neon-cyan: #00e5ff;
  --neon-blue: #4d8eff;
  --neon-purple: #9b6fff;
  --neon-green: #00e5a0;
  --neon-orange: #ff8c42;
  --neon-red: #ff4d6d;

  --grad-cyan-blue: linear-gradient(135deg, #00e5ff 0%, #4d8eff 100%);
  --grad-blue-purple: linear-gradient(135deg, #4d8eff 0%, #9b6fff 100%);

  --border-glow: rgba(0, 229, 255, 0.25);
  --border-subtle: rgba(255, 255, 255, 0.07);
  --glow-cyan:
    0 0 24px rgba(0, 229, 255, 0.35), 0 0 48px rgba(0, 229, 255, 0.15);
}
```

---

## 3. Typography Spec

| Level | Size | Weight | Style |
| --- | --- | --- | --- |
| Hero title | 68-80px | 900 | Gradient text cyan→blue, letter-spacing: -0.03em |
| Content heading | 44-56px | 700 | color: --neon-cyan, text-shadow glow |
| Subtitle | 28-36px | 500 | color: --text-secondary |
| Body | 22-26px | 400 | color: --text-primary, line-height: 1.75 |
| Data highlight | 60-80px | 900 | Gradient text + filter drop-shadow |
| Helper label | 16-20px | 500 | color: --text-muted, uppercase, letter-spacing: 0.08em |
| Code | 20-24px | 400 | JetBrains Mono / Fira Code |

Font families: `'Noto Sans SC', sans-serif` (CJK body copy); `'JetBrains Mono', 'Fira Code', monospace` (code blocks)

**Font import:**

```html
<link
  href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap"
  rel="stylesheet"
/>
```

**Gradient text pattern:**

```css
background: linear-gradient(135deg, #00e5ff, #4d8eff);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
filter: drop-shadow(0 0 12px rgba(0, 229, 255, 0.4));
```

---

## 4. Background Decoration Spec

**A. Grid texture** (standard for content pages, layered over bg-base):

```css
background-image:
  linear-gradient(rgba(0, 229, 255, 0.03) 1px, transparent 1px),
  linear-gradient(90deg, rgba(0, 229, 255, 0.03) 1px, transparent 1px);
background-size: 48px 48px;
```

**B. Radial glows** (cover/section pages, position:absolute pointer-events:none):

```html
<!-- Left cyan primary glow -->
<div
  style="position:absolute;top:-100px;left:-100px;width:700px;height:700px;
  background:radial-gradient(ellipse,rgba(0,229,255,0.10) 0%,transparent 70%);
  pointer-events:none;"
></div>
<!-- Bottom-right purple secondary glow -->
<div
  style="position:absolute;bottom:-150px;right:-50px;width:500px;height:500px;
  background:radial-gradient(ellipse,rgba(155,111,255,0.08) 0%,transparent 70%);
  pointer-events:none;"
></div>
```

**C. Scan-line texture** (layered on top, pointer-events:none, adjustable opacity):

```css
background: repeating-linear-gradient(
  0deg,
  transparent,
  transparent 3px,
  rgba(0, 229, 255, 0.012) 3px,
  rgba(0, 229, 255, 0.012) 4px
);
```

**D. L-shaped corner ornaments** (four corners on cover/section pages):

```html
<div
  style="position:absolute;top:0;left:0;width:100px;height:100px;
  border-top:2px solid #00E5FF;border-left:2px solid #00E5FF;
  box-shadow:inset 0 0 20px rgba(0,229,255,0.08);"
></div>
<div
  style="position:absolute;top:0;right:0;width:100px;height:100px;
  border-top:2px solid #00E5FF;border-right:2px solid #00E5FF;"
></div>
<div
  style="position:absolute;bottom:0;left:0;width:100px;height:100px;
  border-bottom:2px solid rgba(0,229,255,0.4);border-left:2px solid rgba(0,229,255,0.4);"
></div>
<div
  style="position:absolute;bottom:0;right:0;width:100px;height:100px;
  border-bottom:2px solid rgba(0,229,255,0.4);border-right:2px solid rgba(0,229,255,0.4);"
></div>
```

**E. Large background number** (section pages):

```html
<div
  style="position:absolute;right:40px;bottom:-40px;
  font-size:320px;font-weight:900;line-height:1;
  color:rgba(0,229,255,0.03);letter-spacing:-0.05em;
  font-family:'Noto Sans SC',sans-serif;user-select:none;"
>
  01
</div>
```

---

## 5. Dedicated Layout Page Types (8)

### 1. Cover

- Fullscreen bg-base + grid texture + dual glows + scan lines + four corner ornaments
- Left (55%): large gradient hero title (80px) + subtitle + 2 tag badges + gradient divider + speaker/date
- Right (45%): tech-style geometric decoration (concentric rings / hexagon matrix / rotating frames)

### 2. Architecture

- Top: page title + system version/environment badge
- Main: four architecture layers (frontend layer→API layer→service layer→data layer), each as a horizontal arch-box row
- Between layers: vertical arrow connector lines (dashed rgba(0,229,255,0.3))
- Right: legend panel (color → layer description)

### 3. Code Demo

- Left (60%): code-block with line-number column and syntax highlighting (keyword/string/comment/number/func)
- Right (40%): 3-4 key-point cards, each with a circular neon number
- Top: file path breadcrumb (`src / components / Button.tsx`)

### 4. Benchmark

- Top: title + test environment badge (Node version/hardware configuration)
- Left (55%): horizontal comparison bars (compare-bar), Plan A in cyan vs Plan B in gray
- Right (45%): ECharts radar chart for multidimensional comparison
- Bottom: conclusion summary card (glowing border)

### 5. Dashboard

- Top: 4 KPI cards in a row (each with value + trend arrow + mini progress bar)
- Below: left line/bar chart (60%) + right donut chart (40%)

### 6. Horizontal Timeline

- Center horizontal line (gradient cyan→blue)
- Nodes: circular glowing markers, with event cards alternating above and below
- Each card: year (large neon text) + event name + short description

### 7. Section

- Fullscreen dark background + dual glows + corner ornaments + large background number
- Center: section number (neon cyan gradient, 120px) + gradient divider + section name (white, 64px)

### 8. Ending

- Fullscreen dark background + layered glows (3, different colors)
- Center: large gradient title ("Thank You" / "Q&A")
- Below: contact card (glowing border) + QR code area

---

## 6. Border Radius Spec

| Element               | Radius                 |
| --------------------- | ---------------------- |
| Standard card         | 12px                   |
| Large container/modal | 16px                   |
| Badge/tag             | 4px (squared-off feel) |
| Progress bar          | 3px                    |
| Code block            | 10px                   |
| Button                | 6px                    |

---

## 7. ECharts Chart Spec

### Palette

```javascript
color: ["#00D4FF", "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444"];
```

### Global Configuration Template

```javascript
const darkTheme = {
  backgroundColor: "#0B0F1A",
  textStyle: { color: "#8B9BB4", fontFamily: "Noto Sans SC, sans-serif" },
  title: {
    textStyle: { color: "#E8EDF5", fontSize: 28, fontWeight: "bold" },
    subtextStyle: { color: "#8B9BB4", fontSize: 18 },
  },
  legend: { textStyle: { color: "#8B9BB4", fontSize: 16 } },
  categoryAxis: {
    axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
    axisTick: { show: false },
    axisLabel: { color: "#8B9BB4", fontSize: 16 },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: "#4A5568", fontSize: 16 },
    splitLine: {
      lineStyle: { color: "rgba(255,255,255,0.05)", type: "dashed" },
    },
  },
  tooltip: {
    backgroundColor: "#1A2236",
    borderColor: "rgba(0,212,255,0.3)",
    textStyle: { color: "#E8EDF5", fontSize: 16 },
  },
};
```

### Bar Chart (with Glow Effect)

```javascript
option = {
  backgroundColor: "#0B0F1A",
  color: ["#00D4FF", "#3B82F6"],
  grid: { top: 80, bottom: 60, left: 80, right: 40, containLabel: true },
  xAxis: {
    type: "category",
    axisLabel: { color: "#8B9BB4", fontSize: 18 },
    axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
    axisTick: { show: false },
  },
  yAxis: {
    type: "value",
    axisLabel: { color: "#4A5568", fontSize: 16 },
    splitLine: {
      lineStyle: { color: "rgba(255,255,255,0.05)", type: "dashed" },
    },
    axisLine: { show: false },
  },
  series: [
    {
      type: "bar",
      barWidth: "40%",
      itemStyle: {
        borderRadius: [6, 6, 0, 0],
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "#00D4FF" },
            { offset: 1, color: "rgba(0,212,255,0.2)" },
          ],
        },
      },
      label: {
        show: true,
        position: "top",
        color: "#00D4FF",
        fontSize: 16,
        fontWeight: "bold",
      },
    },
  ],
};
```

### Line Chart (Glowing Line)

```javascript
option = {
  backgroundColor: "#0B0F1A",
  color: ["#00D4FF", "#8B5CF6"],
  grid: { top: 80, bottom: 60, left: 80, right: 40, containLabel: true },
  xAxis: {
    type: "category",
    axisLabel: { color: "#8B9BB4", fontSize: 18 },
    axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
    axisTick: { show: false },
  },
  yAxis: {
    type: "value",
    axisLabel: { color: "#4A5568", fontSize: 16 },
    splitLine: {
      lineStyle: { color: "rgba(255,255,255,0.05)", type: "dashed" },
    },
    axisLine: { show: false },
  },
  series: [
    {
      type: "line",
      smooth: true,
      lineStyle: {
        width: 3,
        shadowBlur: 12,
        shadowColor: "rgba(0,212,255,0.6)",
      },
      symbolSize: 8,
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "rgba(0,212,255,0.3)" },
            { offset: 1, color: "rgba(0,212,255,0.02)" },
          ],
        },
      },
    },
  ],
};
```

### Radar Chart (Capability Assessment)

```javascript
option = {
  backgroundColor: "#0B0F1A",
  radar: {
    indicator: [
      /* indicator array */
    ],
    shape: "polygon",
    splitNumber: 4,
    axisName: { color: "#8B9BB4", fontSize: 16 },
    splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
    splitArea: {
      areaStyle: { color: ["rgba(0,212,255,0.02)", "rgba(0,212,255,0.05)"] },
    },
    axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
  },
  series: [
    {
      type: "radar",
      lineStyle: { color: "#00D4FF", width: 2 },
      areaStyle: { color: "rgba(0,212,255,0.15)" },
      itemStyle: { color: "#00D4FF" },
    },
  ],
};
```

---

## 8. AI Illustration Generation Spec

### Style Keywords

When generating images, add the following style modifiers to the prompt:

```
dark tech aesthetic, deep navy black background, neon cyan blue glow,
futuristic digital art, glowing circuit patterns, cyberpunk inspired,
high contrast neon lighting, ultra detailed, cinematic lighting
```

### image_search Keyword Strategy

| Use | Recommended Keywords |
| --- | --- |
| Cover/background | `dark technology background neon`, `cyberpunk city night blue`, `abstract digital network dark` |
| AI/data | `artificial intelligence neural network visualization`, `big data abstract dark`, `machine learning concept art` |
| Product/interface | `dark UI dashboard screenshot`, `futuristic interface design`, `holographic display technology` |
| Chip/hardware | `CPU chip closeup macro`, `semiconductor circuit board dark`, `GPU technology detail` |
| Space/future | `space technology dark background`, `satellite orbit earth`, `futuristic city skyline night` |

### Image Generation Prompt Examples

**Cover background image**

```
dark tech background, deep navy blue and black gradient, subtle glowing circuit board patterns, neon cyan accent lines, futuristic digital aesthetic, no text, ultra wide 16:9, high quality
```

**AI/technology themed illustration**

```
futuristic [具体主题] concept art, dark background, neon blue and cyan glowing elements, digital particles, abstract technology visualization, cinematic lighting, ultra detailed
```

**Data visualization background**

```
abstract data visualization background, dark navy, glowing blue grid lines, floating data points and graphs, tech aesthetic, no text, 16:9
```

### Notes

- For dark templates, **strongly prefer** using `generate_image` for backgrounds, because search engines rarely surface dark background images that perfectly match the palette
- For people photos, use `image_search` to find real photos, but add a dark overlay (`rgba(11,15,26,0.6)`) in the slide to blend them into the dark theme
- Avoid images with white/light backgrounds; if they must be used, blend them in CSS with `mix-blend-mode: luminosity` or a dark gradient overlay

---

## 9. Advanced Components Added in 2026 Redesign

- **System console (`console-window`)**: terminal-like deployment or inference log surface, used to make the slide feel like a real live system.
- **Node topology (`node-map`, `node-card`)**: compact architecture node cards for gateway, agent bus, sandbox, data, and observability layers.
- **Incident timeline (`incident-feed`, `incident-row`)**: real-time status feed for deploys, alerts, scans, and automation events.
- **Benchmark matrix (`benchmark-matrix`)**: dense performance comparison table for latency, success rate, cost, throughput, and error rate.
- **Operations panel (`ops-panel`)**: reusable glass panel with optional glow state for dashboard, system review, and product launch pages.
