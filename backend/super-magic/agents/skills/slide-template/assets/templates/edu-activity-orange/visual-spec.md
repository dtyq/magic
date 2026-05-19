# Energetic Classroom Orange (edu-activity-orange) Visual Spec

## 1. Core Design Concept

- **Dual-mode rhythm**: the cover (01 )and closing (10 )pages use a deep navy-black background `#0f172a`, while all content pages (02–09 )use a bright white base `#f8fafc`, creating a strong visual cadence with the dark pages as bookends. 
- **Energetic orange as the sole accent**: `#f97316` runs through the deck, unifies title keyword highlights / left/top orange border bars / round/square number badges / icon color / Divider / Progress bar / Activity number badge. 
- **Structured handbook feel**: left orange card borders (4–6px )or top orange bars (5px via `::before` )are the core visual language, communicating a checklist-like handbook feel; all content pages use a three-part page header with an English eyebrow label (`ACTIVITY OVERVIEW` ), a large title, and an orange divider. 
- **Education-friendly presentation**: Noto Sans SC extra-bold black-weight titles (900 )and a clear content hierarchy are suitable for classroom projection; debrief prompt boxes use purple italic text (`#7c3aed` )for visual distinction; theory intro boxes use a green palette (`#22c55e / #f0fdf4` )to stay distinct from the activity flow. 
- **Side-by-side image and content layout**: activity detail pages (01 cover / 04 icebreaker / 07 project crisis / 09 one-week startup )use a split layout with a left image (500–560px )and right content; the left image overlays a dark-to-transparent rightward gradient mask, with a fixed orange pill activity badge at the top. 

---

## 2. Color Spec

```css
:root {
  /* Background */
  --bg-primary:     #f8fafc;   /* content page primary background */
  --bg-dark:        #0f172a;   /* dark background for cover/closing */
  --bg-card:        #ffffff;   /* card/list item background */
  --bg-card-dark:   #1e293b;   /* Dark info box (goal/scenario box ) */
  --bg-accent-soft: #fff7ed;   /* Soft orange background (debrief/hint/requirement item ) */

  /* Accent color - energetic orange */
  --color-primary:        #f97316;               /* Primary orange */
  --color-primary-light:  rgba(249,115,22,0.12); /* icon container/badge background */
  --color-primary-border: rgba(249,115,22,0.35); /* badge/bottom bar border */
  --color-primary-deep:   #ea580c;               /* Deep orange (SBI S letter/highlight text ) */
  --color-primary-pale:   #fb923c;               /* Light orange (badge text/strong emphasis ) */
  --color-primary-bg-btn: rgba(249,115,22,0.08); /* Bottom info barBackground */

  /* Supporting colors */
  --color-accent-purple: #7c3aed;   /* debrief quote text */
  --color-accent-green:  #22c55e;   /* Theory intro boxBorders */
  --color-accent-green-bg: #f0fdf4; /* Theory intro boxBackground */
  --color-accent-green-text: #166534;
  --color-accent-amber:  #d97706;   /* SBI B letter color */
  --color-accent-teal:   #059669;   /* SBI I letter color */

  /* Text */
  --text-primary:       #1e293b;   /* title/primary text */
  --text-body:          #334155;   /* step/card body text */
  --text-secondary:     #475569;   /* body/explanation */
  --text-muted:         #64748b;   /* subtitle/description/table header */
  --text-light:         #94a3b8;   /* activity number/time/subtle info */
  --text-on-dark:       #e2e8f0;   /* primary text on dark backgrounds */
  --text-on-dark-muted: #94a3b8;   /* muted text on dark backgrounds */
  --text-on-dark-dim:   #cbd5e1;   /* scenario description text on dark backgrounds */

  /* Borders */
  --border-card:   rgba(0,0,0,0.06);
  --border-accent: #f97316;

  /* Shadow */
  --shadow-card: 0 4px 24px rgba(0,0,0,0.06);  /* Main card */
  --shadow-sm:   0 2px 10px rgba(0,0,0,0.05);  /* list item/role card */
  --shadow-xs:   0 2px 8px rgba(0,0,0,0.06);   /* chip/small card */
  --shadow-xxs:  0 2px 8px rgba(0,0,0,0.04);   /* table row */
  --shadow-img:  0 2px 12px rgba(0,0,0,0.05);  /* stat box */

  /* Radius */
  --radius-card:   20px;   /* Main card/activity card */
  --radius-item:   14px;   /* list item/role card/step card */
  --radius-sm:     12px;   /* hint/annotation box */
  --radius-xs:     10px;   /* chip/small card/item card */
  --radius-badge:  100px;  /* pill label/activity badge */
  --radius-num:    12px;   /* square number badge */
  --radius-circle: 50%;    /* circular flow number */
  --radius-img:    16px;   /* Image container */

  /* Font sizes */
  --font-hero:  72px;   /* covermain title */
  --font-title: 64px;   /* content page title */
  --font-act:   60px;   /* Activity detail page title (left image/right text page ) */
  --font-h2:    40px;   /* secondary heading */
  --font-h3:    32px;   /* tertiary heading/activity name */
  --font-h4:    28px;   /* quaternary heading/section heading */
  --font-h5:    26px;   /* quinary heading/module title */
  --font-body:  24px;   /* Body text */
  --font-sm:    22px;   /* small body/chip/badge */
  --font-xs:    20px;   /* caption/metadata/page label */
  --font-2xs:   19px;   /* description/table content */
  --font-3xs:   18px;   /* flow number/version */
}
```

---

## 3. Typography Spec

| Level | Size | Weight | Color | Usage |
|------|------|------|------|------|
| Hero title (cover/closing ) | 72px / 64px | 900 | #ffffff + span:#f97316 | cover main title / closing large title |
| Page main title | 64px | 900 | #1e293b + span:#f97316 | content pages (02/03/08 ) |
| Activity detail title | 58–62px | 900 | #1e293b + span:#f97316 | left image/right text activity page |
| Subtitle/intro quote | 36px | 400 | #94a3b8 | cover subtitle |
| Secondary heading | 40px | 700 | #1e293b | principle card title |
| Tertiary heading | 32px | 700 | #1e293b | activity name/structure heading |
| Quaternary heading H4 | 28px | 700 | #1e293b | section heading/step title |
| Quinary heading H5 | 26px | 700 | #1e293b | module title (SBI/task/scoring ) |
| Body text | 24px | 400 | #475569 | line-height:1.7 |
| Card body text | 22–23px | 400 | #475569/#334155 | line-height:1.6–1.65 |
| Small description | 20–21px | 400 | #64748b | role description/scenario text |
| English label | 20px | 500–600 | #f97316 | letter-spacing:0.08–0.1em |
| Annotation/metadata | 20px | 400 | #64748b | version number/time label |
| Smallest text | 18–19px | 400–600 | #64748b | table note/step description |

Font Stack: `'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif`

**Font Import (must be copied into each slide HTML `<head>` ): **
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&display=swap" rel="stylesheet"/>
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" rel="stylesheet"/>
```

---

## 4. Decorative element Spec

### 4.1 Orange title divider (required below each page title )
```html
<div class="title-bar"></div>
<!-- small version -->
<div class="title-bar-sm"></div>
```
Spec: wide56–64px, height4–5px, Background`#f97316`, Radius3px, margin-top:12–14px, margin-bottom:48–52px

### 4.2 English page label (required at the top of content pages )
```html
<div class="text-label">ACTIVITY OVERVIEW</div>
```
Spec: 20px, `#f97316`, font-weight:500–600, letter-spacing:0.08–0.1em, margin-bottom:8–12px

### 4.3 Cover split bar with left image and right text
- Left side900px: full-bleed image (opacity:0.75 )+ `linear-gradient(135deg, rgba(249,115,22,0.55), rgba(15,23,42,0.6))` orange gradient mask + bottom-left quote with orange vertical rule (border-left:4px solid #f97316, font-size:32px, color:rgba(255,255,255,0.9) )
- right flexible area: deep navy-black background `#0f172a`, padding:80px 90px, rounded orange pill `.badge` label, extra-bold white title (orange `<span>` keyword ), `.title-bar`, two-column metadata grid, and horizontal activity badges at the bottom

### 4.4 Split bar with left image and right content (Activity detail page )
- Left side 500-560px: full-bleed image + `linear-gradient(to right, rgba(15,23,42,0.18–0.25), rgba(15,23,42,0))` rightward gradient mask + top orange pill activity number badge (top:48px, left:40px )
- right flexible area: padding:52–56px, header area (English label + large title + divider )+ right-side metadata chip column (flex-direction:column, align-items:flex-end )

### 4.5 Left orange-border card (principle card/main content card )
```html
<div class="card">内容</div>           <!-- border-left:6px solid #f97316 -->
<div class="card-sm">small version</div>       <!-- border-left:4px solid #f97316 -->
```

### 4.6 Top orange-bar activity card (overview page )
```html
<div class="act-card">
  <!-- The top 5px orange bar is generated automatically by the ::before pseudo-element. -->
  <div class="text-label">第 1 周</div>
  <div class="act-num">活动一</div>
  <i class="fa-solid fa-handshake act-icon"></i>
  <div class="act-name">破冰</div>
  <div class="act-theme">活动主题描述</div>
  <div class="act-meta">
    <div class="act-tag"><i class="fa-solid fa-clock"></i>20 分钟</div>
    <div class="act-time"><i class="fa-solid fa-users"></i>5-6人小组</div>
  </div>
</div>
```

### 4.7 Dark goal box (required on activity pages )
```html
<div class="card-dark" style="display:flex;align-items:flex-start;gap:14–16px;">
  <i class="fa-solid fa-bullseye" style="color:#f97316;font-size:26–28px;flex-shrink:0;margin-top:2px;"></i>
  <div class="text-sm text-on-dark">目标Text, <strong style="color:#fb923c;">关键词</strong></div>
</div>
```

### 4.8 Solid orange goal box (desert island survival variant )
```html
<div style="background:#f97316;border-radius:14px;padding:20px 28px;display:flex;align-items:flex-start;gap:14px;">
  <i class="fa-solid fa-bullseye" style="color:#fff;font-size:26px;flex-shrink:0;margin-top:2px;"></i>
  <div style="font-size:22px;color:#fff;line-height:1.65;">目标Text, <strong>关键词</strong></div>
</div>
```

### 4.9 Debrief prompt box (at the bottom of each activity page )
```html
<div class="debrief-box">
  <i class="fa-solid fa-comments" style="color:#f97316;font-size:22–24px;flex-shrink:0;margin-top:2–3px;"></i>
  <div class="debrief-text">「引导问题Text？」</div>
</div>
```
Spec: Background`#fff7ed`, border-left:4–5px solid #f97316, debrief text in purple italic `#7c3aed`

### 4.10 Theory intro box (green palette, specific to activity three )
```html
<div class="theory-box">
  <i class="fa-solid fa-book-open" style="color:#22c55e;font-size:22px;flex-shrink:0;margin-top:2px;"></i>
  <div class="theory-text">理论名称与说明</div>
</div>
```
Spec: Background`#f0fdf4`, border-left:4px solid #22c55e, TextColor`#166534`

### 4.11 Soft orange background hint/requirement item
```html
<div class="card-soft">内容</div>
<!-- or inline requirement item -->
<div style="background:#fff7ed;border-radius:10px;padding:14px 18px;border-left:4px solid #f97316;">
  <i class="fa-solid fa-file-contract" style="color:#f97316;font-size:20px;flex-shrink:0;"></i>
  <div style="font-size:21px;color:#92400e;"><strong style="color:#ea580c;">标题</strong>说明Text</div>
</div>
```

### 4.12 Closing page background glow decoration
```html
<div class="bg-glow-1"></div>  <!-- 800px orange glow in the upper right -->
<div class="bg-glow-2"></div>  <!-- 600px orange glow in the lower left -->
```

### 4.13 Bottom info bar (Closing page )
```html
<div class="bottom-bar">
  <div class="bottom-item"><i class="fa-solid fa-building-columns"></i>课程名称</div>
  <div class="bottom-divider"></div>
  <div class="bottom-item"><i class="fa-solid fa-book"></i>课程简称</div>
  <div class="bottom-divider"></div>
  <div class="bottom-item"><i class="fa-solid fa-calendar"></i>v1 · 2026</div>
  <div class="bottom-divider"></div>
  <div class="bottom-item"><i class="fa-solid fa-lock"></i>仅供课堂教学使用</div>
</div>
```

### 4.14 Metadata chip
```html
<div class="chip"><i class="fa-solid fa-clock"></i>20 分钟</div>
<div class="chip"><i class="fa-solid fa-users"></i>5-6 人随机小组</div>
```

---

## 5. Dedicated Layout Types

### Type 1 · Cover page (left image/right text dark split bar )
- **Structure**: `.slide-cover` → `.cover-left` (900px )+ `.cover-right` (flexible )
- **Left side**: full-bleed image (opacity:0.75 )+ `.cover-overlay` orange gradient mask + bottom-left `.cover-quote` intro quote (orange vertical rule + white text )
- **Right side**: `#0f172a` dark background, padding:80px 90px, top rounded orange `.badge` label, extra-bold white title (`<span>` orange keyword ), `.title-bar`, two-column `.meta-grid` metadata (icon + label + value ), horizontal activity badges at the bottom (`.badge` variant ), and version number in the lower right
- **Best for**: cover / opening page

### Type 2 · Two-column content page (white background, instructions/rules )
- **Structure**: `.slide-light` → top header area + flexible `.grid-2`
- **Header**: `.text-label` English label + large title (`.text-title`, orange `<span>` keyword )+ `.title-bar`
- **Left side**: `.card` (large card with left orange border, icon + title + body text + `.card-soft` highlighted intro quote )+ `.card-dark` (dark hint box )
- **Right side**: structure heading + `.structure-items` (`.card-plain` list, `.num-badge` square number + label + description )
- **Best for**: usage instructions / rule introduction / structure explanation

### Type 3 · Activity overview page (six-column card grid )
- **Structure**: `.slide-light`, header area (left: title, right: `.stat-box` metric group )+ flexible `.grid-6`
- **Each `.act-card`**: top 5px orange bar (`::before` )+ `.text-label` (week )+ `.act-num` (number, gray )+ `.act-icon` (44px orange icon )+ `.act-name` (activity name )+ `.act-theme` (theme description )+ `.act-meta` (`.act-tag` duration + `.act-time` participant count )
- **Best for**: table of contents / overview / parallel multi-item displays

### Type 4 · Activity detail page A (Header + two-column content, no image )
- **Structure**: `.slide-container` (flex-direction:column )→ `.header` (title + horizontal metadata chips )+ flexible `.grid-2`
- **Header**: left side (`.act-label` + `.act-title` + `.title-bar` )+ right side (`.meta-row`, `.chip` horizontal row )
- **Left column**: role assignment (`.roles-grid` two columns, `.role-card` left orange border )+ image frame (`.img-box`, border-radius:16px )
- **Right column**: `.card-dark` goal box + flow title + `.flow-steps` (`.flow-dot` circular number + step title + description )+ `.theory-box` (optional )+ `.debrief-box`
- **Best for**: blind tower building (05 ) / SBI feedback card (08 ) / desert island survival (06 ) and other content-dense activities

### Type 5 · Activity detail page B (left image, right content split bar )
- **Structure**: `.slide-activity` → `.activity-img-col` (500–560px )+ `.activity-content` (flexible )
- **Left side**: image + `.activity-img-overlay` rightward gradient mask + `.activity-badge` orange pill number
- **Right side**: top area (`.top-row`, left: title area, right: `.meta-chips` vertical chip column )+ `.card-dark` goal box + step title + `.steps-grid` (three-column step cards, `border-top:4px solid #f97316` )+ `.debrief-box`
- **Best for**: icebreaker (04 ) / project crisis (07 ) / one-week startup (09 ) and other illustrated activity pages

### Type 6 · Role-play/table page (left image, right table )
- **Structure**: `.slide-activity` → `.activity-img-col` (520px )+ `.activity-content`
- **Right side**: header area + `.card-dark` scenario box + role heading + `.roles-table` (border-collapse:separate, 8px row spacing, white rounded rows, first column with bold orange role names, last column with gray italic hidden pressure )+ `.flow-row` (four horizontal step cards, `border-top:3px solid #f97316` )+ `.debrief-box`
- **Best for**: project crisis (07 ) and other pages with role cards and tables

### Type 7 · Framework page (white background, SBI/theoretical framework )
- **Structure**: `.slide-light` → header area + flexible `.grid-2`
- **Left column**: `.card-dark` goal box + framework heading + three linked cards (`.sbi-cards`, three-color background: orange/yellow/green, large letter + word + description )+ example heading + positive/improvement example boxes (green/red left borders )
- **Right column**: flow title + `.flow-steps` (`.num-circle` circular number )+ image frame + `.debrief-box`
- **Best for**: SBI feedback card (08 ) and other framework/methodology pages

### Type 8 · Closing page (dark centered layout, panoramic recap )
- **Structure**: `.slide-dark-center` + `.bg-glow-1` + `.bg-glow-2` background glow + centered `.inner` (width:1400px, z-index:1 )
- **Content hierarchy**: top `.badge` label → extra-bold white large title (orange `<span>` keyword )→ gray subtitle (dot-separated motto )→ `.pills-row` (horizontal activity recap pills )→ `.principles-row` (four principle cards, translucent dark background + orange icons )→ `.bottom-bar` bottom info bar
- **Best for**: farewell / closing / thanks

---

## 6. Radius and Shadow Spec

| element | Radius | Shadow |
|------|------|------|
| Main card (principle card/activity card ) | 20px | 0 4px 24px rgba(0,0,0,0.06) |
| dark goal/scenario box | 14–16px | None |
| list item/role card/step card | 14px | 0 2px 10px rgba(0,0,0,0.05) |
| hint/theory/debrief box | 12–14px | None |
| Metadata chip | 10px | 0 2px 8px rgba(0,0,0,0.06) |
| item card/small card | 10px | 0 2px 8px rgba(0,0,0,0.05) |
| badge/pill label/activity number | 100px | None |
| square number badge (large ) | 12px | None |
| square number badge (small ) | 8px | None |
| item number badge (smallest ) | 6px | None |
| circular flow number | 50% | None |
| Image container | 16px | None |
| Stat box | 14–16px | 0 2px 12px rgba(0,0,0,0.05) |
| table row | 10px (first and last cells ) | 0 2px 8px rgba(0,0,0,0.04) |

---

## 7. ECharts Chart Spec

Palette (energetic orange gradient palette ): 
```js
color: ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#1e293b', '#475569', '#94a3b8']
```

Global Config: 
```js
{
  backgroundColor: 'transparent',
  textStyle: { fontFamily: 'Noto Sans SC', color: '#475569', fontSize: 18 },
  grid: { left: 60, right: 40, top: 40, bottom: 40, containLabel: true }
}
```

**Pie / Donut Chart Example** (scoring dimension page ): 
```js
{
  tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
  series: [{
    type: 'pie',
    radius: ['45%', '78%'],
    center: ['50%', '50%'],
    data: [
      { value: 30, name: '方案质量', itemStyle: { color: '#f97316' } },
      { value: 30, name: '团队协作', itemStyle: { color: '#fb923c' } },
      { value: 25, name: '路演表现', itemStyle: { color: '#fdba74' } },
      { value: 15, name: '复盘报告', itemStyle: { color: '#fed7aa' } }
    ],
    label: { show: true, fontSize: 20, fontFamily: 'Noto Sans SC', color: '#334155', formatter: '{b}\n{d}%' },
    labelLine: { length: 12, length2: 10 }
  }]
}
```

**Horizontal Progress Bar** (scoring dimension alternative ): 
```html
<div class="score-row">
  <div class="score-label"><i class="fa-solid fa-file-alt" style="color:#f97316;margin-right:8px;"></i>方案质量</div>
  <div class="score-bar-wrap"><div class="score-bar" style="width:90%;"></div></div>
  <div class="score-pct">30%</div>
</div>
```

**Bar Chart Example**: 
```js
{
  xAxis: { axisLine: { lineStyle: { color: '#e2e8f0' } }, axisLabel: { color: '#64748b', fontSize: 18 } },
  yAxis: { splitLine: { lineStyle: { color: '#f1f5f9' } }, axisLabel: { color: '#64748b', fontSize: 18 } },
  series: [{ type: 'bar', barWidth: '50%', itemStyle: { color: '#f97316', borderRadius: [6,6,0,0] } }]
}
```

**Line Chart Example**: 
```js
{
  series: [{
    type: 'line', smooth: true,
    lineStyle: { color: '#f97316', width: 3 },
    areaStyle: { color: 'rgba(249,115,22,0.1)' },
    symbol: 'circle', symbolSize: 8, itemStyle: { color: '#f97316' }
  }]
}
```

---

## 8. AI Illustration Generation Spec

### Style Keywords
`educational illustration, flat design, warm orange and navy palette, team collaboration, workshop activity, clean white background, modern graphic style, Chinese university students, group activity`

### image_search Strategy
- cover/activity hero image: `team collaboration workshop photo`, `group activity students classroom`, `teamwork discussion university`
- activity detail image: 
  - Icebreaker activity: `icebreaker group discussion students`
  - Blind tower building: `blindfold team building trust exercise`
  - Desert island survival: `survival decision making group simulation`
  - Project crisis: `role play conflict management workshop`
  - SBI feedback: `feedback cards team review session`
  - One-week startup: `startup pitch presentation students`
- Closing page: `teamwork success celebration learning growth`

### generate_images Example Prompt
```
flat vector illustration of [specific activity scene, e.g. students doing blindfold tower building exercise], warm orange and navy blue color palette, clean white background, modern educational illustration style, simple geometric characters, friendly and collaborative atmosphere, no text
```

### Photorealistic image prompt (realistic image for cover/activity pages )
```
photo of [specific scene, e.g. university students discussing in small groups], natural warm lighting, candid classroom atmosphere, diverse students, modern campus environment, high quality
```
