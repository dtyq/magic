---
name: creating-slides
description: Slide/PPT creation skill that provides complete slide creation, editing, and management capabilities. Use when users need to create slides, make presentations, edit slide content, or manage slide projects. CRITICAL - When user message contains [@slide_project:...] mention, you MUST load this skill first before any operations.

name-cn: 幻灯片/PPT制作技能
description-cn: 幻灯片/PPT制作技能，提供完整的幻灯片创建、编辑和管理能力。当用户需要创建幻灯片、制作PPT、制作演示文稿、编辑幻灯片内容或进行幻灯片项目管理时使用。关键规则 - 当用户消息包含 [@slide_project:...] 引用时，必须首先加载此技能再进行任何操作。
---

<!--zh
# HTML幻灯片制作技能
-->
# Creating Slides Skill

<!--zh: 提供完整的HTML幻灯片制作能力，包括项目创建、内容设计、技术规范、工作流程和最佳实践。-->
Provides complete HTML slide creation capabilities, including project creation, content design, technical specifications, workflows, and best practices.

<!--zh
## 核心能力
-->
## Core Capabilities

<!--zh
- **项目创建** - 创建完整的幻灯片项目结构
- **页面制作** - 创建符合规范的幻灯片页面
- **内容检索** - 获取参考资料和数据
- **配图搜索** - 批量搜索高质量配图素材
- **数据分析** - 支持 Python 脚本进行数据分析处理
- **项目管理** - 支持幻灯片项目的编辑、重构、移动和重命名
-->
- **Project Creation** - Create complete slide project structure
- **Page Creation** - Create slide pages conforming to specifications
- **Content Research** - Obtain reference materials and data
- **Image Search** - Batch search high-quality image materials
- **Data Analysis** - Support Python scripts for data analysis and processing
- **Project Management** - Support editing, refactoring, moving, and renaming slide projects

---

<!--zh
## 代码执行方式（关键）
-->
## Code Execution Method (Critical)

<!--zh
本技能中所有 Python 代码示例，在 Agent 环境中**必须通过 `run_skills_snippet` 工具执行**。

**正确示例**：
-->
All Python code examples in this skill **must be executed via the `run_skills_snippet` tool** in Agent environment.

**Correct example**:
```python
# Correct! Must use run_skills_snippet to execute
run_skills_snippet(
    python_code="""
from sdk.tool import tool
result = tool.call('create_slide_project', {
    "project_path": "my-project",
    "slides_array": []
})
"""
)
```

<!--zh
本文档中所有 `from sdk.tool import tool` 开头的代码块，均遵循此规则，通过 `run_skills_snippet` 的 `python_code` 参数传入执行。
-->
All code blocks in this document starting with `from sdk.tool import tool` follow this rule: pass them via the `python_code` parameter of `run_skills_snippet` for execution.

---

<!--zh
## 默认要求
-->
## Default Requirements

<!--zh
当用户无明确要求时遵循以下默认要求：
- **页面数量**：根据内容确定合适的页数，每页≤100行代码
- **内容密度**：一页一重点，文字≤150字，图片≤1张
- **幻灯片思维**：1920×1080固定画布，横向布局优先，避免纵向溢出
- **商务简洁风格**，遵循字号规范，强制Tailwind优先
-->
When user has no explicit requirements, follow these defaults:
- **Page count**: Determine appropriate page count based on content, each page ≤100 lines of code
- **Content density**: One key point per page, text ≤150 words, images ≤1
- **Slide mindset**: 1920×1080 fixed canvas, prioritize horizontal layout, avoid vertical overflow
- **Business minimalist style**, follow font size specifications, Tailwind mandatory priority

---

<!--zh
## 技术规格
-->
## Technical Specifications

<!--zh
### 尺寸与实现
-->
### Size and Implementation

<!--zh
- **固定尺寸**：1920px×1080px，严禁超出，宽高需在html与body标签中明确设置
- **实现方式**：HTML + CSS + JavaScript
- **静态固定页面**：任何设备尺寸浏览都是相同效果，不做自适应，禁止响应式设计
- **网页底部必须加入** `<script src="slide-bridge.js"></script>` 脚本，用于页面间通信
-->
- **Fixed size**: 1920px×1080px, strictly no overflow, width and height must be explicitly set in html and body tags
- **Implementation**: HTML + CSS + JavaScript
- **Static fixed page**: Same effect on any device size, no adaptation, responsive design prohibited
- **Must include** `<script src="slide-bridge.js"></script>` at bottom of page for inter-page communication

<!--zh
### CSS框架与资源
-->
### CSS Frameworks and Resources

<!--zh
- **TailwindCSS**: https://cdn.tailwindcss.com/3.4.17 (必选，注意：此CDN采用JIT浏览器编译模式，返回JS代码，使用`<script>`标签)
- **FontAwesome**: https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css (必选)
- **Google Fonts**: https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap (必选)
- **ECharts**: https://cdnjs.cloudflare.com/ajax/libs/echarts/5.6.0/echarts.min.js (必要时使用)
-->
- **TailwindCSS**: https://cdn.tailwindcss.com/3.4.17 (required, note: this CDN uses JIT browser compilation mode, returns JS code, use `<script>` tag)
- **FontAwesome**: https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css (required)
- **Google Fonts**: https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap (required)
- **ECharts**: https://cdnjs.cloudflare.com/ajax/libs/echarts/5.6.0/echarts.min.js (use when necessary)

<!--zh
### 技术约束
-->
### Technical Constraints

<!--zh
- **文件生成**：只生成静态HTML文件
- **禁止响应式设计**：严禁使用媒体查询，页面不会随着屏幕尺寸变化而变化
- **禁止内容过载**：避免过长文本、过多列表项、过大图片；单页内容过多时必须拆分为多页
- **禁止动态效果**：页面切换由外层系统控制，单页面专注静态展示；禁用transition、keyframes、动态数据展示等动画；禁用音效，只保留静态视觉（CSS hover、阴影、渐变、边框等样式效果可正常使用）
- **不使用服务器端代码、本地文件资源、复杂交互功能**
- **若非用户要求，不使用未经验证的外链图片**
- **JavaScript代码内联在`<body>`底部，CSS内联在`<head>`中，SVG图形直接内联**
- **图表实现**：图表、仪表盘等任何Echarts支持的内容都必须使用Echarts实现，禁止自己写HTML、CSS、SVG代码
-->
- **File generation**: Only generate static HTML files
- **Responsive design prohibited**: Strictly no media queries, pages don't change with screen size
- **Content overload prohibited**: Avoid excessively long text, too many list items, oversized images; split into multiple pages when single page has too much content
- **Dynamic effects prohibited**: Page switching controlled by outer system, single pages focus on static display; disable transition, keyframes, dynamic data display animations; disable sound effects, only keep static visuals (CSS hover, shadows, gradients, borders and other style effects can be used normally)
- **Don't use server-side code, local file resources, complex interactive features**
- **Unless user requests, don't use unverified external images**
- **JavaScript code inline at `<body>` bottom, CSS inline in `<head>`, SVG graphics inline directly**
- **Chart implementation**: Charts, dashboards and any ECharts-supported content must use ECharts implementation, prohibited to write HTML, CSS, SVG code yourself

<!--zh
### Tailwind强制规范
-->
### Tailwind Mandatory Specification

<!--zh
- **最大化使用Tailwind类**：布局flex/grid、间距p-*/m-*、字号text-*、颜色text-*/bg-*、装饰rounded-*/shadow-*等
- **最小化自定义CSS**：仅限复杂渐变、伪元素等Tailwind无法实现的场景
-->
- **Maximize use of Tailwind classes**: Layout flex/grid, spacing p-*/m-*, font size text-*, colors text-*/bg-*, decoration rounded-*/shadow-*, etc.
- **Minimize custom CSS**: Limited to complex gradients, pseudo-elements and other scenarios Tailwind cannot implement

<!--zh
### 字号规范（1920×1080画布必须大字号）
-->
### Font Size Specification (1920×1080 canvas requires large fonts)

<!--zh
- **页面主标题**：64-72px (text-6xl/7xl) - 优先使用64px以上
- **区块标题/卡片主标题**：40-52px (text-5xl) - 不要低于40px
- **小标题/卡片副标题**：30-36px (text-3xl/4xl) - 优先32px以上
- **正文/列表项**：22-26px (text-2xl) - 最小22px，优先24px
- **辅助标签**：20px (text-xl) - 仅限极小标签
- **严禁18px (text-lg)及以下**，除非用户明确要求
- **原则**：宁可字大内容少分多页，不要字小内容挤一页
-->
- **Page main title**: 64-72px (text-6xl/7xl) - Prefer 64px and above
- **Section title/Card main title**: 40-52px (text-5xl) - Don't go below 40px
- **Subtitle/Card subtitle**: 30-36px (text-3xl/4xl) - Prefer 32px and above
- **Body text/List item**: 22-26px (text-2xl) - Minimum 22px, prefer 24px
- **Auxiliary label**: 20px (text-xl) - Only for tiny labels
- **Strictly prohibit 18px (text-lg) and below**, unless user explicitly requires
- **Principle**: Prefer large fonts with less content split into more pages, not small fonts cramming into one page

<!--zh
### 视觉层级
-->
### Visual Hierarchy

<!--zh
字号对比（主标题与正文相差3-4级）+ 字重对比（标题font-bold/black）+ 颜色对比（标题text-gray-900，正文text-gray-600/700）+ 空间对比（重要元素mb-8/10/12）+ 装饰元素（数字标签、色块、竖条）
-->
Font size contrast (main title differs from body by 3-4 levels) + weight contrast (title font-bold/black) + color contrast (title text-gray-900, body text-gray-600/700) + spatial contrast (important elements mb-8/10/12) + decorative elements (number labels, color blocks, vertical bars)

---

<!--zh
## 设计原则
-->
## Design Principles

<!--zh
### 内容设计思维
-->
### Content Design Mindset

<!--zh
- **一页一重点**：每张幻灯片只传达一个核心信息，保持焦点集中
- **信息层级**：通过字体大小、颜色深浅、空间位置建立清晰信息层级，通过阴影和变换创造深度感
- **视觉表达**：使用FontAwesome或Emoji图标增强视觉表达
-->
- **One key point per page**: Each slide conveys only one core message, maintain focused attention
- **Information hierarchy**: Establish clear information hierarchy through font size, color depth, spatial position, create depth through shadows and transforms
- **Visual expression**: Use FontAwesome or Emoji icons to enhance visual expression

<!--zh
### 配图要求
-->
### Image Requirements

<!--zh
- **配图比例**：70%的幻灯片必须包含高质量配图，如：10张幻灯片中必须有7张包含配图
- **搜索关键词**：必须包含至少一个主体关键词，禁止使用抽象、普遍、不具体的关键词
  - 搜索格式：`[主体关键词] [具体场景描述]`
  - 提炼幻灯片内容相关的至少1~3个主体关键词
  - 关键词示例：
    * 正确："IShowSpeed 中国行 Beijing Great Wall" 错误："Beijing Great Wall"
    * 正确："马斯克 头像" 错误："科技巨头头像"
    * 正确："扎克伯格天价挖人"（具体事件） 错误："AI人才竞争"（抽象、普遍、不具体的）
- **禁止使用placeholder图片**，必须使用image_search工具返回的高质量图片
-->
- **Image ratio**: 70% of slides must contain high-quality images, e.g., 7 out of 10 slides must contain images
- **Search keywords**: Must contain at least one subject keyword, prohibited to use abstract, general, non-specific keywords
  - Search format: `[Subject keyword] [Specific scene description]`
  - Extract at least 1-3 subject keywords related to slide content
  - Keyword examples:
    * Correct: "IShowSpeed China tour Beijing Great Wall" Wrong: "Beijing Great Wall"
    * Correct: "Elon Musk portrait" Wrong: "Tech giant portrait"
    * Correct: "Zuckerberg astronomical talent poaching" (specific event) Wrong: "AI talent competition" (abstract, general, non-specific)
- **Prohibited to use placeholder images**, must use high-quality images returned by image_search tool

<!--zh
### 设计风格
-->
### Design Style

<!--zh
**默认风格**：简约商务风
- **主色**：黑白灰（text-gray-*）
- **强调色**：橙/红/绿/蓝（单页最多1-2种）
- **背景**：白/浅灰为主，深色背景用于对比
- **禁止**：过度使用蓝色、紫色、渐变色

**风格选择**：根据内容主题和目标受众，基于简约商务风衍生，模仿受欢迎的PPT设计风格，包括但不限于：
- **科技类**：Apple Keynote, Google Material Design, Microsoft Fluent Design
- **商务类**：McKinsey Consulting, Huawei Enterprise, Alibaba Enterprise
- **消费品牌**：Xiaomi, Netflix, Nike
- **设计驱动**：Minimalism, Flat Design
- **媒体出版**：TED Talks, National Geographic
- **教育学术**：Stanford University, MIT
-->
**Default style**: Minimalist business style
- **Primary colors**: Black/white/gray (text-gray-*)
- **Accent colors**: Orange/red/green/blue (max 1-2 per page)
- **Background**: Mainly white/light gray, dark background for contrast
- **Prohibited**: Excessive use of blue, purple, gradients

**Style selection**: Based on content theme and target audience, derive from minimalist business style, imitate popular PPT design styles including but not limited to:
- **Tech**: Apple Keynote, Google Material Design, Microsoft Fluent Design
- **Business**: McKinsey Consulting, Huawei Enterprise, Alibaba Enterprise
- **Consumer brands**: Xiaomi, Netflix, Nike
- **Design-driven**: Minimalism, Flat Design
- **Media publishing**: TED Talks, National Geographic
- **Education academia**: Stanford University, MIT

<!--zh
### 布局设计核心原则
-->
### Layout Design Core Principles

<!--zh
- **精确分区规划**：基于1920×1080画布的精确分区规划
- **优先布局模式**：单栏居中、左右分栏、三要点网格、标准三段式、卡片式、时间轴(只允许横向时间轴)、对比分屏和仪表盘等经典PPT布局模式
- **特别推荐左右分屏布局**（如60/40或50/50），充分利用横向空间，避免纵向堆叠导致高度溢出
- **分区域规划**：
  * 头部区域：固定高度约占10%（如h-24）
  * 中间内容区：占据主要空间，可灵活划分为2×2、3×3网格，最多不超过9宫格
  * 底部区域：页脚，固定高度约占5%（如h-16以下），不允许放入图片
- **横向分割**：单行最多6列，避免过于细碎的分割导致内容拥挤
- **禁止纵向无限延伸**：尽可能利用横向空间，如：横向时间轴而不是纵向时间轴
-->
- **Precise zoning planning**: Precise zoning planning based on 1920×1080 canvas
- **Priority layout modes**: Single column centered, left-right split, three-point grid, standard three-section, card-style, timeline (only horizontal timeline allowed), comparison split-screen and dashboard classic PPT layout modes
- **Especially recommend left-right split layout** (like 60/40 or 50/50), fully utilize horizontal space, avoid vertical stacking causing height overflow
- **Zoning planning**:
  * Header area: Fixed height about 10% (like h-24)
  * Middle content area: Occupies main space, can flexibly divide into 2×2, 3×3 grid, max 9-grid
  * Footer area: Fixed height about 5% (below h-16), images not allowed
- **Horizontal division**: Max 6 columns per row, avoid overly fragmented division causing content crowding
- **Vertical infinite extension prohibited**: Maximize horizontal space use, e.g., horizontal timeline not vertical timeline

<!--zh
使用预定义网格（grid-cols-2/3、grid-rows-2）配合gap-4/6/8统一间距，通过col-span-2、row-span-2灵活控制元素占据空间，避免像素值定义网格大小，使用fr单位或百分比；Flex布局使用TailwindCSS比例宽度类（w-1/2、w-1/3、w-2/3）禁止硬编码像素，善用flex-1、justify-between、items-center等实现响应式布局和内容均衡分布。
-->
Use predefined grid (grid-cols-2/3, grid-rows-2) with gap-4/6/8 unified spacing, flexibly control element space occupation through col-span-2, row-span-2, avoid pixel values defining grid size, use fr units or percentages; Flex layout uses TailwindCSS proportional width classes (w-1/2, w-1/3, w-2/3) prohibited hardcoded pixels, leverage flex-1, justify-between, items-center to achieve responsive layout and balanced content distribution.

<!--zh
### 高度控制技巧（关键）
-->
### Height Control Technique (Critical)

<!--zh
**【硬性要求】页面高度严禁超出 1080px，这是不可违反的规范！**

如果内容过多导致单页无法容纳，**必须拆分为多个页面**，绝对不允许让单页超出 1080px 高度。

**合理控制幻灯片的高度极其重要**，有一个简单有效的方式是使用 Grid 横向卡片布局，尽量利用横向空间，左右内容量控制相近，对齐排列，整体排版工整。

在构思时，**网页前序的元素要选择高度敏感的元素（通常需要足够的空间），后序的元素/内容使用高度不敏感的元素（通常可以跟随剩余空间自适应，如图表）**，这样只需要考虑前序元素的高度，后序元素/内容的高度设置为撑满剩余高度即可。

在保证页面在视觉上饱满的同时，**绝对不要在一页里塞入太多需要阅读的实体内容**。

请在设计时一步一步思考以上几点，确保实现完美的页面布局与高度控制。若用户没有相悖的要求，则必须默认使用此方式进行页面布局与高度控制。
-->
**[Hard Requirement] Page height must strictly not exceed 1080px, this is a non-negotiable specification!**

If content is too much for a single page, **must split into multiple pages**, absolutely not allowed to let single page exceed 1080px height.

**Reasonable slide height control is extremely important**. A simple effective approach is using Grid horizontal card layout, maximize horizontal space use, control similar left-right content amounts, aligned arrangement, overall neat typography.

During conception, **page preceding elements should choose height-sensitive elements (usually need sufficient space), subsequent elements/content use height-insensitive elements (usually can adapt to remaining space, like charts)**, so only need to consider preceding element heights, set subsequent element/content heights to fill remaining height.

While ensuring page is visually full, **absolutely don't cram too much readable substantive content in one page**.

Please think through above points step by step during design, ensure perfect page layout and height control. Unless user has conflicting requirements, must default to this approach for page layout and height control.

<!--zh
### 图片使用技巧
-->
### Image Usage Technique

<!--zh
图片在幻灯片制作中是非常危险、难以控制的元素，需要规划与图片比例近似的空间来摆放图片，并通过容器元素承载图片，让图片撑满容器即可。容器宽高应该使用相对单位（如百分比、fr单位）或Grid布局的自动分配机制，而不是固定、常被计算错误的像素值，否则图片常常会超出画布，导致布局混乱。
-->
Images are very dangerous, hard-to-control elements in slide creation. Need to plan space with similar aspect ratio to place images, carry images through container elements, let images fill container. Container width and height should use relative units (like percentages, fr units) or Grid layout's automatic allocation mechanism, not fixed, often miscalculated pixel values, otherwise images often overflow canvas causing layout chaos.

<!--zh
### 默认设计思维
-->
### Default Design Mindset

<!--zh
幻灯片整体有高级感，使用丰富的装饰元素，符合业界主流审美实践，但是不要引入太多复杂性的东西。注意幻灯片的高度控制与排版工整，不要在一页里塞入太多内容，这是关键。
-->
Slides overall have premium feel, use rich decorative elements, conform to industry mainstream aesthetic practices, but don't introduce too much complexity. Note slide height control and neat typography, don't cram too much content in one page, this is key.

---

<!--zh
## ECharts 配置要求
-->
## ECharts Configuration Requirements

<!--zh
- 所有Echarts图表必须保证在HTML内容以及CSS样式解析完成后(window.onload)再进行echarts.init()，注意是window.onload，不要使用DOMContentLoaded
- 当页面中有Echarts图表时，必须监听window.resize事件，resize事件触发时，调用所有图表的resize()方法
- 图表容器充分利用可用空间，预留边距确保文字完整显示

**多轴对齐：**
- 确保同方向轴刻度数量一致，避免网格线错位
- 通过min、max、interval参数实现刻度对齐

**视觉要求：**
- 坐标轴、网格线、标签保持对齐
- 避免文字重叠和数据密集显示问题
- 配色协调统一，布局合理不遮挡关键数据
-->
- All ECharts charts must ensure echarts.init() only after HTML content and CSS styles are fully parsed (window.onload). Note: window.onload, not DOMContentLoaded.
- When page contains ECharts charts, must listen to window.resize event. When resize triggers, call resize() method on all charts.
- Chart containers should fully utilize available space, reserve margins to ensure complete text display.

**Multi-axis alignment:**
- Ensure same-direction axes have consistent tick counts to avoid grid line misalignment.
- Use min, max, interval parameters to achieve tick alignment.

**Visual requirements:**
- Keep axes, grid lines, labels aligned.
- Avoid text overlap and dense data display issues.
- Harmonious and unified color scheme, reasonable layout not obscuring key data.

---

<!--zh
## 数据分析处理
-->
## Data Analysis Processing

<!--zh
当涉及需要数据分析处理的场景时，可以编写Python脚本进行数据分析：
- **Python脚本仅用于数据分析处理，而不是数据可视化**，数据可视化需要使用Echarts实现，禁止在Python脚本中编写绘制图表的代码
- 对于Excel、CSV等数据类文件，可以使用read_files工具读取文件的前10行了解结构，然后使用Python脚本进行数据分析处理
- 对于有多sheet或体积较大的Excel文件，始终使用Python脚本进行数据分析处理，先通过脚本查看数据结构与sheet结构，再使用脚本进行数据分析处理
- Python脚本的处理结果应当精炼，脚本的作用是计算和提炼核心数据，而不是返回大量过程数据，通常在百字到千字级别，最多不超过5000字
- 遵循最新的Python主流编程实践，确保代码健壮性，尽可能一次性运行成功
-->
When scenarios involve data analysis, write Python scripts for analysis:
- **Python scripts are solely for data analysis processing, not data visualization**. Use ECharts for visualization. Strictly prohibited to write chart rendering code in Python scripts.
- For data files like Excel, CSV, use read_files to read first 10 lines to understand structure, then use Python scripts for data analysis.
- For Excel files with multiple sheets or large size, always use Python scripts for analysis. First use script to view data structure and sheet structure, then perform analysis.
- Python script processing results should be refined. Script's role is to calculate and distill core data, not return large amounts of process data, typically hundreds to thousands of characters, max 5000 characters.
- Follow latest mainstream Python programming practices. Ensure code robustness, aim for one-time successful execution.

---

<!--zh
## 幻灯片HTML模板
-->
## Slide HTML Template

<!--zh
参考以下模板创建幻灯片页面。每页都是独立的HTML文件，风格需保持一致但可有适当差异，注释内容仅供理解，实际开发时请省略。
-->
Reference the following template to create slide pages. Each page is an independent HTML file, style should be consistent but can have appropriate variations, comments are for your understanding only, omit in actual development.

```html
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title>Slide Title</title>
    <script src="https://cdn.tailwindcss.com/3.4.17"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet"/>
    <style>
        html, body {
            width: 1920px;
            height: 1080px; /* DO NOT set height or max-height, allow extreme cases to exceed */
            font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
            /* more styles can be added here... */
        }

        .slide-container {
            width: 1920px;
            height: 1080px;
            /* padding: Adjust according to design needs */
            /* more styles can be added here... */
        }
    </style>
</head>
<body>
    <div class="slide-container">
        <!-- Page content goes here -->
    </div>
    <!--
    IMPORTANT: This script must be included in every generated slide page.
    Simply copy this line as-is - no need to read or understand the script content.
    It enables keyboard navigation and title synchronization with the parent page.
    -->
    <script src="slide-bridge.js"></script>
</body>
</html>
```

---

<!--zh
## 快速开始
-->
## Quick Start

<!--zh
> **提醒**：以下所有代码示例均需通过 `run_skills_snippet(python_code="...")` 执行，请参考文档顶部的"代码执行方式"章节。
-->
> **Reminder**: All code examples below must be executed via `run_skills_snippet(python_code="...")`. Refer to the "Code Execution Method" section at the top of this document.

<!--zh
### 创建幻灯片项目
-->
### Create Slide Project

```python
from sdk.tool import tool

# 创建空项目（后续逐页添加）
result = tool.call('create_slide_project', {
    "project_path": "ChatGPT发展报告",
    "slides_array": [],
    "slide_images_content": "",
    "todo_list": ""
})

# 创建完整项目（带配图和大纲）
result = tool.call('create_slide_project', {
    "project_path": "产品发布会",
    "slides_array": ["封面.html", "产品介绍.html", "核心功能.html"],
    "slide_images_content": """# 幻灯片图片素材库

## 项目信息
- 搜索主题：产品发布会
- 采集时间：2025-01-22 10:30:00
- 图片总数：5

## 图片分类

### 封面/主图

![product-hero.jpg](https://example.com/image1.jpg)
- Index: 1
- Size: 1920x1080px (16:9, horizontal)
- Visual Analysis: 现代科技产品特写，白色背景，专业灯光
- Use Case: 封面主图
- Search Keywords: product hero image modern technology
""",
    "todo_list": """# 幻灯片制作任务规划

## 项目信息
- 项目名称：产品发布会
- 主题：新产品发布与功能介绍
- 页数：3
- 关键词：产品、科技、创新

## 内容大纲
### 封面 (封面.html)
展示产品名称和主视觉

### 产品介绍 (产品介绍.html)
介绍产品背景和核心价值

### 核心功能 (核心功能.html)
展示产品的三大核心功能
"""
})
```

<!--zh
### 创建单个幻灯片页面
-->
### Create Single Slide Page

```python
from sdk.tool import tool

result = tool.call('create_slide', {
    "file_path": "ChatGPT发展报告/OpenAI里程碑.html",
    "content": """<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title>OpenAI 里程碑</title>
    <script src="https://cdn.tailwindcss.com/3.4.17"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet"/>
    <style>
        html, body {
            width: 1920px;
            height: 1080px;
            font-family: 'Noto Sans SC', sans-serif;
        }
        .slide-container {
            width: 1920px;
            height: 1080px;
        }
    </style>
</head>
<body>
    <div class="slide-container bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div class="text-center">
            <h1 class="text-7xl font-bold text-gray-900 mb-8">OpenAI 里程碑</h1>
            <p class="text-3xl text-gray-600">人工智能发展的重要节点</p>
        </div>
    </div>
    <script src="slide-bridge.js"></script>
</body>
</html>""",
    "max_width": 1920,
    "max_height": 1080,
    "analysis_js": """
const issues = [];
const container = document.querySelector('.slide-container');
if (container) {
    const {x, y, width, height} = container.getBoundingClientRect();
    if (y + height > maxHeight) {
        issues.push(`容器底部溢出: ${Math.round(y+height)} > ${maxHeight}`);
    }
}
return issues.length > 0 ? issues.join(', ') : '布局检查通过';
""",
    "insert_after_slide": ""
})

# 第二页
result = tool.call('create_slide', {
    "file_path": "ChatGPT发展报告/发展历程.html",
    "content": """...""",
    "max_width": 1920,
    "max_height": 1080,
    "analysis_js": """...""",
    "insert_after_slide": "OpenAI里程碑.html"
})

# 第三页
result = tool.call('create_slide', {
    "file_path": "ChatGPT发展报告/技术突破.html",
    "content": """...""",
    "max_width": 1920,
    "max_height": 1080,
    "analysis_js": """...""",
    "insert_after_slide": "发展历程.html"
})
```

<!--zh
### 搜索配图素材
-->
### Search Image Materials

```python
from sdk.tool import tool

result = tool.call('image_search', {
    "topic_id": "ChatGPT发展报告",
    "requirements_xml": """<requirements>
    <requirement>
        <name>马斯克肖像</name>
        <query>Elon Musk portrait professional</query>
        <visual_understanding_prompt>分析图片是否为马斯克本人的清晰肖像照</visual_understanding_prompt>
        <requirement_explanation>需要马斯克的专业肖像照片，用于人物介绍页面</requirement_explanation>
        <expected_aspect_ratio>3:4</expected_aspect_ratio>
        <count>3</count>
    </requirement>
    <requirement>
        <name>ChatGPT界面</name>
        <query>ChatGPT interface screenshot 2025</query>
        <visual_understanding_prompt>确认是否为ChatGPT的真实界面截图</visual_understanding_prompt>
        <requirement_explanation>需要ChatGPT的真实使用界面截图，展示产品功能</requirement_explanation>
        <expected_aspect_ratio>16:9</expected_aspect_ratio>
        <count>5</count>
    </requirement>
    <requirement>
        <name>科技背景</name>
        <query>AI technology abstract background</query>
        <visual_understanding_prompt>分析是否适合作为科技主题的背景图</visual_understanding_prompt>
        <requirement_explanation>需要抽象的科技风格背景图，用于幻灯片背景</requirement_explanation>
        <expected_aspect_ratio>16:9</expected_aspect_ratio>
        <count>3</count>
    </requirement>
</requirements>"""
})
```

<!--zh
### 互联网内容检索
-->
### Web Content Retrieval

```python
from sdk.tool import tool

# 搜索网页
search_result = tool.call('web_search', {
    "topic_id": "ChatGPT研究",
    "requirements_xml": """<requirements>
    <requirement>
        <name>ChatGPT发展</name>
        <query>ChatGPT发展历程 2025</query>
        <limit>10</limit>
    </requirement>
    <requirement>
        <name>GPT-4突破</name>
        <query>OpenAI GPT-4 技术突破</query>
        <limit>10</limit>
        <time_period>month</time_period>
    </requirement>
    <requirement>
        <name>商业化</name>
        <query>ChatGPT商业化进程</query>
        <limit>10</limit>
    </requirement>
</requirements>"""
})

# 读取高价值网页（这个工具需要单独查看文档）
# read_result = tool.call('read_webpages_as_markdown', {...})
```

---

<!--zh
## 核心工具及参数说明
-->
## Core Tools and Parameters

<!--zh
### create_slide_project - 创建幻灯片项目
-->
### create_slide_project - Create Slide Project

<!--zh
| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `project_path` | 是 | string | 项目相对路径（文件夹名称），如 `"ChatGPT发展报告"` |
| `slide_count` | 否 | number | 幻灯片页数，默认0（空项目或由slides_array决定） |
| `slides_array` | 是 | array | 幻灯片文件名列表，可以为空数组 `[]` |
| `slide_images_content` | 否 | string | 配图素材库内容（Markdown格式），为空则不创建文件 |
| `todo_list` | 否 | string | 任务规划内容（Markdown格式），为空则不创建文件 |
-->
| Parameter | Required | Type | Description |
|------|------|------|------|
| `project_path` | Yes | string | Project relative path (folder name), e.g., `"ChatGPT-Development-Report"` |
| `slide_count` | No | number | Slide page count, default 0 (empty project or determined by slides_array) |
| `slides_array` | Yes | array | List of slide filenames, can be empty array `[]` |
| `slide_images_content` | No | string | Image material library content (Markdown format), empty means not creating file |
| `todo_list` | No | string | Task planning content (Markdown format), empty means not creating file |

<!--zh
**工具功能：**
- 创建项目文件夹结构
- 自动生成 `index.html`（演示控制器）
- 自动生成 `magic.project.js`（项目配置）
- 自动生成 `slide-bridge.js`（页面通信脚本）
- 创建 `images/` 文件夹
- 如果提供了 `slide_images_content`，会自动下载图片到 `images/` 文件夹
-->
**Tool Functions:**
- Create project folder structure
- Auto-generate `index.html` (presentation controller)
- Auto-generate `magic.project.js` (project config)
- Auto-generate `slide-bridge.js` (inter-page communication script)
- Create `images/` folder
- If `slide_images_content` is provided, automatically download images to `images/` folder

<!--zh
### create_slide - 创建幻灯片页面
-->
### create_slide - Create Slide Page

<!--zh
| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `file_path` | 是 | string | 幻灯片文件路径（相对于工作目录），如 `"项目名/页面.html"` |
| `content` | 是 | string | 完整的 HTML 内容 |
| `max_width` | 是 | number | 期望的最大宽度（通常为 1920） |
| `max_height` | 是 | number | 期望的最大高度（通常为 1080） |
| `analysis_js` | 是 | string | 布局分析 JavaScript 函数体（不含function声明） |
| `insert_after_slide` | 是 | string | 插入位置：`""` 插入第一页，文件名插入到该文件之后 |
-->
| Parameter | Required | Type | Description |
|------|------|------|------|
| `file_path` | Yes | string | Slide file path (relative to working directory), e.g., `"project-name/page.html"` |
| `content` | Yes | string | Complete HTML content |
| `max_width` | Yes | number | Expected max width (usually 1920) |
| `max_height` | Yes | number | Expected max height (usually 1080) |
| `analysis_js` | Yes | string | Layout analysis JavaScript function body (without function declaration) |
| `insert_after_slide` | Yes | string | Insert position: `""` for first page, filename to insert after that file |

<!--zh
**工具功能：**
- 写入 HTML 文件
- 浏览器加载并执行 `analysis_js` 质量检查
- 检测布局问题、高度溢出、图片拉伸、小字号
- 根据 `insert_after_slide` 自动更新 slides 数组
-->
**Tool Functions:**
- Write HTML file
- Load via browser and execute `analysis_js` for quality check
- Detect layout issues, height overflow, image stretch, small fonts
- Auto-update slides array based on `insert_after_slide`

<!--zh
**analysis_js 说明：**
- 函数体内容（不含 `function()` 声明）
- 可访问 `maxWidth`、`maxHeight`
- 用 `return` 返回结果
- 重点检测元素溢出边界

**insert_after_slide 说明：**
- `""` 第一页，文件名插入其后
- 自动更新 slides 数组

-->
**analysis_js Instructions:**
- Function body content (without `function()` declaration)
- Can access `maxWidth`, `maxHeight`
- Use `return` for result
- Focus on detecting element overflow

**insert_after_slide Instructions:**
- `""` for first page, filename to insert after
- Auto-updates slides array

<!--zh
### image_search - 批量搜索配图
-->
### image_search - Batch Search Images

<!--zh
| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `topic_id` | 是 | string | 搜索主题标识符，用于去重 |
| `requirements_xml` | 是 | string | XML格式的搜索需求配置 |
-->
| Parameter | Required | Type | Description |
|------|------|------|------|
| `topic_id` | Yes | string | Search topic identifier for deduplication |
| `requirements_xml` | Yes | string | XML format search requirements configuration |

<!--zh
**requirements_xml 格式：**
每个 `<requirement>` 包含：
- `name` - 需求名称（必填）
- `query` - 搜索关键词（必填）
- `visual_understanding_prompt` - 视觉分析提示词（必填）
- `requirement_explanation` - 需求解释（必填）
- `expected_aspect_ratio` - 期望宽高比，如 `16:9`, `9:16`, `1:1`（必填）
- `count` - 图片数量（可选，默认20，最多50）
-->
**requirements_xml Format:**
Each `<requirement>` contains:
- `name` - Requirement name (required)
- `query` - Search keywords (required)
- `visual_understanding_prompt` - Visual analysis prompt (required)
- `requirement_explanation` - Requirement explanation (required)
- `expected_aspect_ratio` - Expected aspect ratio, e.g., `16:9`, `9:16`, `1:1` (required)
- `count` - Image count (optional, default 20, max 50)

<!--zh
**关键原则：**
- 每个需求必须提供明确的搜索关键词
- 关键词必须包含主体词，禁止使用纯泛化词汇
- 根据搜索意图选择语言（中文/英文/混合）
- 视觉分析无法评估清晰度，只能分析内容
-->
**Key Principles:**
- Each requirement must provide clear search keywords
- Keywords must include subject words, prohibit pure generic terms
- Choose language based on search intent (Chinese/English/mixed)
- Visual analysis cannot assess clarity, only content

<!--zh
### web_search - 网页搜索
-->
### web_search - Web Search

<!--zh
| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `topic_id` | 是 | string | 搜索主题标识符，用于去重 |
| `requirements_xml` | 是 | string | XML格式的搜索需求配置 |
-->
| Parameter | Required | Type | Description |
|------|------|------|------|
| `topic_id` | Yes | string | Search topic identifier for deduplication |
| `requirements_xml` | Yes | string | XML format search requirements configuration |

<!--zh
**requirements_xml 格式：**
每个 `<requirement>` 包含：
- `name` - 需求名称（必填）
- `query` - 搜索关键词（必填）
- `limit` - 结果数量（可选，默认10，最大20）
- `offset` - 分页偏移量（可选，默认0）
- `language` - 搜索语言（可选，默认zh-CN）
- `region` - 搜索区域（可选，默认CN）
- `time_period` - 时间范围（可选）：day/week/month/year
-->
**requirements_xml Format:**
Each `<requirement>` contains:
- `name` - Requirement name (required)
- `query` - Search keywords (required)
- `limit` - Result count (optional, default 10, max 20)
- `offset` - Pagination offset (optional, default 0)
- `language` - Search language (optional, default zh-CN)
- `region` - Search region (optional, default CN)
- `time_period` - Time range (optional): day/week/month/year

---

<!--zh
## 项目架构
-->
## Project Architecture

<!--zh
幻灯片项目采用分离式架构设计：

```
项目名称/
├── index.html          # 演示控制器 - 负责页面导航、键盘控制、缩放适配
├── magic.project.js    # 项目配置文件 - 存储slides数组等配置信息
├── slide-bridge.js     # 幻灯片页面间通信脚本
├── images/             # 图片资源文件夹
├── 幻灯片页面1.html      # 具体幻灯片页面
├── 幻灯片页面2.html      # 具体幻灯片页面
└── ...
```

**架构工作原理：**
1. `index.html`是演示系统的核心控制器，包含：
   - 导航逻辑：处理键盘事件、页面切换
   - 显示引擎：iframe加载、16:9缩放适配
   - `create_slide_project`工具会自动生成index.html和magic.project.js文件，不需要再读取这些文件
2. `magic.project.js`存储项目配置，包含slides数组定义幻灯片页面路径列表
3. `slide-bridge.js`是幻灯片页面间通信脚本，`create_slide_project`工具会自动生成，不需要再读取slide-bridge.js文件
4. 项目根目录中的每个HTML文件都是完全独立的幻灯片页面：
   - 自包含设计：独立的样式、内容、脚本
   - 标准尺寸：基于1920×1080设计
5. 每个幻灯片项目必须是一个完整的自闭环项目，因此：
   - 幻灯片页面禁止引用项目文件夹以外的图片或资源，所有图片必须存放在images文件夹中，否则将无法正确渲染
   - 用户上传的图片需要通过shell_exec(command="cp src_path dst_path")命令拷贝到images文件夹中，才能被正确引用
-->
Slide projects use separated architecture design:

```
Project Name/
├── index.html          # Presentation controller - handles page navigation, keyboard control, scaling adaptation
├── magic.project.js    # Project config - stores slides array and other config info
├── slide-bridge.js     # Inter-slide communication script
├── images/             # Image resource folder
├── Slide Page 1.html   # Specific slide page
├── Slide Page 2.html   # Specific slide page
└── ...
```

**Architecture Working Principles:**
1. `index.html` is the core controller of presentation system, containing:
   - Navigation logic: handles keyboard events, page switching
   - Display engine: iframe loading, 16:9 scaling adaptation
   - `create_slide_project` tool auto-generates index.html and magic.project.js files, no need to read these files
2. `magic.project.js` stores project config, including slides array defining slide page path list
3. `slide-bridge.js` is inter-slide communication script, auto-generated by `create_slide_project` tool, no need to read
4. Each HTML file in project root is a completely independent slide page:
   - Self-contained design: independent styles, content, scripts
   - Standard size: based on 1920×1080 design
5. Each slide project must be a complete self-contained project, therefore:
   - Slide pages prohibited from referencing images or resources outside project folder. All images must be stored in images folder, otherwise cannot render correctly
   - User-uploaded images need to be copied to images folder via shell_exec(command="cp src_path dst_path") command to be correctly referenced

---

<!--zh
## 工具使用原则
-->
## Tool Usage Principles

<!--zh
### 创建幻灯片时的工具限制

**主要工具**（创建幻灯片时使用）：
- `web_search` - 互联网内容检索
- `read_webpages_as_markdown` - 读取高价值网页内容
- `create_slide_project` - 创建幻灯片项目
- `create_slide` - 创建单个幻灯片页面
- `image_search` - 批量搜索配图素材

**禁止工具**（创建幻灯片时不使用）：
- 写入文件工具 - 无质量检查
- 编辑文件工具 - 仅限用户明确要求局部编辑
- `shell_exec` 的 `mkdir` - `create_slide_project` 自动创建

**例外**：
- 非幻灯片需求（如"写Python脚本"），可用其它文件工具
- 用户明确要求局部编辑，可用编辑文件工具
-->
### Tool Restrictions for Slide Creation

**Primary Tools** (use when creating slides):
- `web_search` - Internet content retrieval
- `read_webpages_as_markdown` - Read high-value webpage content
- `create_slide_project` - Create slide project
- `create_slide` - Create individual slide page
- `image_search` - Batch search image materials

**Prohibited Tools** (don't use when creating slides):
- File writing tools - No quality checks
- File editing tools - Only when user explicitly requests partial edits
- `shell_exec` with `mkdir` - `create_slide_project` auto-creates

**Exceptions**:
- Non-slide tasks (e.g., "write Python script"), can use other file tools
- User explicitly requests partial edits, can use file editing tools

<!--zh
### 工具选择原则

**创建页面：** 始终使用 `create_slide`
- `create_slide` = 文件写入 + 质量检查 + 自动注册
- 不使用写入文件工具（无质量检查）

**编辑页面：**
- 小范围修改（≤100字）：使用编辑文件工具
- 大范围修改（>100字）：使用 `create_slide` 重新创建

**项目初始化：** 使用 `create_slide_project`
- 不手动 `mkdir` 创建目录
- 不手动创建 `magic.project.js` 和 `slide-bridge.js`
- `create_slide_project` 一次性完成所有初始化
-->
### Tool Selection Principles

**Creating Pages:** Always use `create_slide`
- `create_slide` = file writing + quality check + auto-registration
- Don't use file writing tools (no quality checks)

**Editing Pages:**
- Small-scale (≤100 chars): Use file editing tools
- Large-scale (>100 chars): Use `create_slide` to recreate

**Project Initialization:** Use `create_slide_project`
- Don't manually `mkdir` directories
- Don't manually create `magic.project.js` and `slide-bridge.js`
- `create_slide_project` completes all initialization in one go

---

<!--zh
## Magic Project 机制
-->
## Magic Project Mechanism

<!--zh
**核心概念**：包含 magic.project.js 文件的文件夹 = 前端识别为 Magic Project

**magic.project.js 操作约束**：
- 格式为 JSONP（不是JSON），由专用工具生成（如 setup_audio_project）
- 禁止直接创建此文件
- 允许编辑修改内部参数（如 metadata.speakers）

**前端渲染区别**：
- 普通文件夹：显示文件夹图标，点击展开文件列表
- Magic Project：显示项目图标，点击打开专用面板（加载 index.html 可视化界面）

**用户操作**：
- 点击项目图标：打开项目面板（不是进入文件夹，不是打开 index.html 文件）
- 点击项目名称旁的箭头：展开查看内部原始文件（类似展开普通文件夹）

**项目类型**：type 选项包括 audio、slide 等。整个文件夹称为"超级交付物"。
-->
**Core Concept**: Folder containing magic.project.js = Frontend recognizes as Magic Project

**magic.project.js Operation Constraints**:
- Format is JSONP (not JSON), generated by dedicated tools (e.g., setup_audio_project)
- Never create this file directly
- Allowed to edit and modify parameters inside (e.g., metadata.speakers)

**Frontend Rendering Differentiation**:
- Regular folder: Shows folder icon, click to expand file list
- Magic Project: Shows project icon, click to open dedicated panel (loads index.html visualization interface)

**User Operations**:
- Click project icon: Open project panel (not entering folder, not opening index.html file)
- Click arrow next to project name: Expand to see internal raw files (like expanding regular folder)

**Project Types**: type options include audio, slide, etc. Entire folder called "super deliverable".

---

<!--zh
## 工具参数格式说明
-->
## Tool Parameter Format Specifications

<!--zh
### create_slide_project 参数格式
-->
### create_slide_project Parameter Formats

<!--zh
#### slide_images_content 格式要求
-->
#### slide_images_content Format Requirements

<!--zh
`slide_images_content` 参数应包含完整的 slide-images.md 文件内容，格式如下：
-->
The `slide_images_content` parameter should contain complete slide-images.md file content, formatted as follows:

```markdown
# Slide Image Material Library

## Project Information
- Search Topic: ChatGPT Evolution and Technological Breakthroughs
- Collection Time: 2025-01-22 10:30:00
- Total Images: 15

## Image Categories

### Cover/Hero Images

![{filename.png}]({image URL})
- Index: 1
- Size: {width}x{height}px ({ratio}, {horizontal/vertical/square})
- Visual Analysis: {AI analysis result, excluding size info, describe in detail with minimum words, at least 50 characters}
- Use Case: {recommended usage scenario}
- Search Keywords: {keywords used}

![{filename.png}]({image URL})
- Index: 2
- Size: {width}x{height}px ({ratio}, {horizontal/vertical/square})
- Visual Analysis: {AI analysis result, excluding size info, describe in detail with minimum words, at least 50 characters}
- Use Case: {recommended usage scenario}
- Search Keywords: {keywords used}

### Background Images

![{filename.png}]({image URL})
- Index: 3
[Each image follows same format, use standard Markdown image syntax with sequential numbering...]

### Product/Content Display Images

![{filename.jpg}]({image URL})
- Index: N
[Continue with same format, ensure index increments sequentially...]

### Icon/Decorative Images

![{filename.jpg}]({image URL})
- Index: N+1
[Continue with same format, ensure index increments sequentially...]
```

<!--zh
**重要说明**：
1. 使用标准 Markdown 图片格式：`![filename](url)`
2. filename 作为图片 alt 文本，同时也作为下载时的文件名
3. filename 必须包含文件扩展名，如 .jpg, .png, .webp 等
4. filename 应优先使用用户偏好语言，简洁明了，如："trump-assassination-attempt.jpg"、"chatgpt-viral-phenomenon.png"、"tesla-q4-earnings.jpg"
-->
**Important Notes**:
1. Use standard Markdown image format: `![filename](url)`
2. filename serves as image alt text and also as filename when downloading
3. filename must include file extension, e.g., .jpg, .png, .webp, etc.
4. filename should prioritize user's preferred language, be concise and clear, e.g., "trump-assassination-attempt.jpg", "chatgpt-viral-phenomenon.png", "tesla-q4-earnings.jpg"

<!--zh
#### todo_list 格式要求
-->
#### todo_list Format Requirements

<!--zh
`todo_list` 参数应包含完整的 slide-todo.md 文件内容，用于记录幻灯片内容规划和任务分解。
-->
The `todo_list` parameter should contain complete slide-todo.md file content for recording slide content planning and task breakdown.

<!--zh
推荐格式：
-->
Recommended format:

```markdown
# Slide Production Task Planning

## Project Information
- Project Name: ChatGPT Development Report
- Theme: ChatGPT Evolution and Impact Analysis
- Pages: 10
- Key Keywords: ChatGPT, OpenAI, GPT-4, Artificial Intelligence

## Content Outline
### Cover (OpenAI Milestones.html)
Introduce OpenAI's important development nodes and breakthrough achievements

### Table of Contents (AI Revolution Timeline.html)
Display key time points and milestone events in artificial intelligence development

### GPT Series Evolution (GPT-4 Technological Breakthrough.html)
Detail GPT-4's technical innovations and performance improvements compared to previous generations

### Commercialization Process (ChatGPT Business Miracle.html)
Analyze how ChatGPT reached billion-level user scale in short time
...
```

<!--zh
#### magic.project.js 格式说明（slide 类型）
-->
#### magic.project.js Format Description (slide type)

<!--zh
magic.project.js 是一个 JSONP 格式的项目配置文件，定义了幻灯片项目结构和页面列表。
-->
magic.project.js is a JSONP format project configuration file that defines slide project structure and page list.

<!--zh
**文件结构**：
-->
**File Structure**:

```javascript
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "Project Name",
  "slides": [
    "cover.html",
    "contents.html",
    "content-page.html"
  ]
};
window.magicProjectConfigure(window.magicProjectConfig);
```

<!--zh
**字段说明**：
- **version**: 配置文件版本号，固定为 "1.0.0"
- **type**: 项目类型，固定为 "slide"（幻灯片类型）
- **name**: 项目名称，通常为文件夹名称
- **slides**: 幻灯片页面路径数组，相对于项目根目录，定义页面顺序

**slides 数组特点**：
- 数组元素为字符串，每个字符串是一个 HTML 文件的相对路径
- 数组顺序即为幻灯片播放顺序
- 可以为空数组 `[]`（空项目），后续通过 edit_file 添加页面路径
- 前端根据此数组加载和导航幻灯片页面

**修改示例**：
使用 edit_file 工具修改 slides 数组内容：
- 添加页面：在数组末尾追加新文件路径
- 删除页面：从数组中移除指定路径
- 调整顺序：重新排列数组元素顺序

注意：修改后确保 JSONP 语法有效（有效的 JavaScript 代码）
-->
**Field Descriptions**:
- **version**: Configuration file version number, fixed as "1.0.0"
- **type**: Project type, fixed as "slide" (slide type)
- **name**: Project name, usually folder name
- **slides**: Slide page path array, relative to project root, defines page order

**slides Array Characteristics**:
- Array elements are strings, each string is a relative path to an HTML file
- Array order is the slide playback order
- Can be empty array `[]` (empty project), add page paths later via edit_file
- Frontend loads and navigates slide pages based on this array

**Modification Examples**:
Use edit_file tool to modify slides array content:
- Add page: Append new file path to end of array
- Remove page: Remove specified path from array
- Adjust order: Rearrange array element order

Note: Ensure valid JSONP syntax after modification (valid JavaScript code)

---

<!--zh
## image_search 关键词策略
-->
## image_search Keyword Strategy

<!--zh
### 基本原则
-->
### Basic Principles

<!--zh
使用 image_search 工具时，查询关键词必须多样化，每个需求尝试 2-3 种不同的关键词组合。
-->
When using image_search tool, query keywords must be diversified, try 2-3 different keyword combinations for each requirement.

<!--zh
### 关键词语言选择原则
-->
### Keyword Language Selection Principles

<!--zh
根据搜索意图和信息来源判断语言，尝试多语言组合：
- 搜索国外网站/国际报道 → 使用英语或原始语言
- 搜索本地网站 → 使用本地语言
- 不确定来源 → 混合多种语言获得全面结果
- 同一主题可使用不同语言获得不同视角
-->
Judge language based on search intent and information source, try multilingual combinations:
- Search foreign websites/international reports → Use English or original language
- Search local websites → Use local language
- Uncertain about source → Mix multiple languages for comprehensive results
- Same topic can use different languages to get different perspectives

<!--zh
### 搜索策略框架
-->
### Search Strategy Framework

<!--zh
1. **核心词**：最直接的主题词
2. **限定词**：核心词 + 属性/功能/场景
3. **组合词**：多个相关元素组合
4. **变体词**：同义词/缩写/口语化/多语言变体
-->
1. **Core word**: Most direct topic word
2. **Qualifier**: Core word + attribute/function/scenario
3. **Combination**: Multiple related elements combined
4. **Variant**: Synonym/abbreviation/colloquialism/multilingual variant

<!--zh
### 搜索示例
-->
### Search Examples

<!--zh
**搜索 iPhone 官方图片**：
- "iPhone", "iPhone 17 Pro Max", "iPhone official"

**搜索中国网友对马斯克的评论（截图）**：
- "马斯克", "马斯克微博", "马斯克评论"

**搜索国际新闻关于马斯克的图片**：
- "Elon Musk", "Musk Tesla", "Musk 2025"

**搜索微信功能界面**：
- "微信", "微信界面", "微信支付"

**搜索国际报道关于微信**：
- "WeChat", "WeChat China", "WeChat report"

**搜索特斯拉上海工厂（混合）**：
- "Tesla Shanghai", "特斯拉上海", "Tesla 上海工厂"
-->
**Search iPhone official images**:
- "iPhone", "iPhone 17 Pro Max", "iPhone official"

**Search Chinese netizens' comments about Musk (screenshots)**:
- "马斯克", "马斯克微博", "马斯克评论"

**Search international news images about Musk**:
- "Elon Musk", "Musk Tesla", "Musk 2025"

**Search WeChat function interface**:
- "微信", "微信界面", "微信支付"

**Search international reports about WeChat**:
- "WeChat", "WeChat China", "WeChat report"

**Search Tesla Shanghai factory (mixed)**:
- "Tesla Shanghai", "特斯拉上海", "Tesla 上海工厂"

<!--zh
### 错误示例（避免）
-->
### Wrong Examples (Avoid)

<!--zh
- 使用"协作软件" → 太泛化，应使用"Figma"、"Figma collaboration"等
- 使用"数据库工具" → 无主体，应使用"Notion database"、"Airtable"等
- **禁止泛化搜索**：不使用纯泛化行业术语（软件/平台/工具）、纯功能术语（支付/聊天）、纯形容词（现代/先进）
-->
- Use "collaboration software" → Too generic, should use "Figma", "Figma collaboration" etc.
- Use "database tool" → No subject, should use "Notion database", "Airtable" etc.
- **Prohibit generic searches**: No using only generic industry terms (software/platform/tool), pure function terms (payment/chat), pure adjectives (modern/advanced)

<!--zh
### 关键词多样化原则
-->
### Keyword Diversification Principles

<!--zh
- 从核心到具体：主体名称 → 主体+属性 → 主体+场景+时间
- 尝试不同表达：根据来源选择语言/缩写/全称/多语言变体
- 组合不同元素：主体/动作/时间/地点
- 每个需求至少 2-3 个不同角度
-->
- From core to specific: Subject name → Subject+attribute → Subject+scenario+time
- Try different expressions: Choose language based on source/abbreviation/full name/multilingual variants
- Combine different elements: Subject/action/time/location
- At least 2-3 different angles per requirement

---

<!--zh
## 创建特定幻灯片流程
-->
## Create Specific Slide Workflow

<!--zh
如用户要求创建特定幻灯片或要求模仿/参考生成幻灯片，参考完整创建流程的局部流程来灵活完成用户的创建需求。
-->
If user requests creating specific slides or requests imitating/referencing to generate slides, reference partial workflow of complete creation workflow to flexibly complete user's creation needs.

<!--zh
### 最佳实践
-->
### Best Practices

<!--zh
#### 1. 使用 create_slide_project 创建项目
-->
#### 1. Use create_slide_project to Create Project

<!--zh
- **用户无配图要求时**：slide_images_content 可以为空
- **用户已提供图片时**：无需使用 image_search 工具搜索图片，而是使用 visual_understanding 工具分析图片信息，将图片信息按格式要求写入 slide_images_content
- **用户已提供大纲或具体文字时**：无需使用 web_search 工具搜索网页，直接提取 todo_list 内容
-->
- **When user has no image requirements**: slide_images_content can be empty
- **When user already provided images**: No need to use image_search tool to search images, instead use visual_understanding tool to analyze image info, write image info into slide_images_content per format requirements
- **When user already provided outline or specific text**: No need to use web_search tool to search webpages, directly extract todo_list content

<!--zh
#### 2. 直接使用 create_slide 创建幻灯片
-->
#### 2. Directly Use create_slide to Create Slides

<!--zh
- 基于用户提供的信息创建幻灯片
- 坚持使用 create_slide 工具，借助 analysis_js 分析布局
- 不使用写入文件工具
-->
- Create slides based on user-provided information
- Insist on using create_slide tool, use analysis_js to analyze layout
- Don't use file writing tools

<!--zh
#### 3. 模仿/参考场景的特殊处理
-->
#### 3. Special Handling for Imitate/Reference Scenarios

<!--zh
- **记得复制原始图片**：将原始图片复制到新项目的 images 文件夹，确保完整的幻灯片项目架构
- 使用 shell_exec(command="cp src_path dst_path") 命令复制图片
-->
- **Remember to copy original images**: Copy original images to new project's images folder, ensure complete slide project architecture
- Use shell_exec(command="cp src_path dst_path") command to copy images

---

<!--zh
## 完整创建流程
-->
## Complete Creation Workflow

<!--zh
如用户无特殊要求，则遵循以下流程一步步完成幻灯片创建任务：
-->
If user has no special requirements, follow this workflow step by step to complete slide creation task:

<!--zh
### 1. 互联网检索
-->
### 1. Internet Search

<!--zh
- 理解任务描述和用户需求
- **第一轮搜索（必须）**：生成3组关键词到web_search工具，搜索相关网页
- **第二轮搜索（可选）**：若搜索后发现内容与预想有出入（通常出现在实事类搜索场景），再次生成3组及以上关键词，使用web_search进行第二轮搜索
- 挑选高价值网页，剔除重复、不相关的网页，若用户未指定数量，默认挑选5个高价值网页，使用read_webpages_as_markdown工具获取高价值网页内容
-->
- Understand task description and user needs
- **Round 1 search (required)**: Generate 3 keyword sets for web_search tool, search relevant pages
- **Round 2 search (optional)**: If search results differ from expectations (common in current events scenarios), generate 3+ keyword sets again, conduct second round search with web_search
- Select high-value pages, eliminate duplicates and irrelevant pages. If user doesn't specify count, default to 5 high-value pages, use read_webpages_as_markdown to get high-value page content

<!--zh
### 2. 配图搜索与内容规划
-->
### 2. Image Search and Content Planning

<!--zh
- **批量搜索配图**：使用image_search工具批量搜索配图素材，默认最少一次性搜索5组以上的requirements，且各不相同，覆盖大、中、小、横、竖各种尺寸或不同场景以备后用，设置topic_id为项目名称（确保去重）
- **一次性批量搜索**：推测后续可能用到的各种类型配图需求，一步到位发起批量搜索，常见例子为：搜索背景大图、人物肖像、产品特写、图标等不同尺寸、不同场景的图片
- **避免重复**：不要多次使用视觉分析内容雷同的图片，确保雷同内容的图片只使用一次
- **内容规划**：基于用户需求和参考资料，分析和规划幻灯片内容：
  * 分析用户具体需求和背景
  * 提取参考文件核心内容要点
  * 确定幻灯片页数（根据内容确定合适的页数）
  * 识别目标受众和使用场景
  * 选择合适的设计风格：根据内容主题从设计风格列表中选择最适合的风格方向
- **准备内容**：准备完整的slide_images_content和todo_list内容
- **用户要求优先**：若用户对配图有明确其它要求，则优先遵循用户要求
-->
- **Batch image search**: Use image_search tool to batch search image materials, default minimum batch search 5+ requirements at once, all different, covering large, medium, small, horizontal, vertical various sizes or different scenarios for later use, set topic_id to project name (ensure deduplication)
- **One-time batch search**: Speculate various types of image needs potentially needed later, initiate batch search in one go, common examples: search background large images, character portraits, product close-ups, icons in different sizes and scenarios
- **Avoid duplicates**: Don't repeatedly use visual analysis on similar content images, ensure similar content images only used once
- **Content planning**: Based on user needs and reference materials, analyze and plan slide content:
  * Analyze user specific needs and background
  * Extract core content points from reference files
  * Determine slide page count (determine appropriate page count based on content)
  * Identify target audience and usage scenarios
  * Choose appropriate design style: Select most suitable style direction from design style list based on content theme
- **Prepare content**: Prepare complete slide_images_content and todo_list content
- **User requirements priority**: If user has explicit other image requirements, prioritize user requirements

<!--zh
### 3. 项目初始化
-->
### 3. Project Initialization

<!--zh
调用create_slide_project，它将帮你一次性完成如下工作：
- 创建项目文件夹与骨架结构
- 自动生成slide-images.md和slide-todo.md文件
- 自动下载配图素材到images文件夹
- 创建所有必要的项目文件和结构
-->
Call create_slide_project, it will help you complete the following in one go:
- Create project folder and skeleton structure
- Auto-generate slide-images.md and slide-todo.md files
- Auto-download image materials to images folder
- Create all necessary project files and structure

<!--zh
### 4. 幻灯片内容开发
-->
### 4. Slide Content Development

<!--zh
逐页创建流程：

for each slide:
  - **步骤1：图片筛选和使用**
    * 容器分析：首先分析当前页面布局中图片容器的宽高比例和尺寸设计
    * 选择高清、专业、与内容主题高度相关且宽高比匹配的图片
    * 只允许使用本地图片，禁止使用外链图片，避免遭遇防盗链、图片加载失败等问题

  - **步骤2：页面创建**
    * 创建前思考高度控制，遵循设计原则和约束
    * 确定插入位置：第一页 insert_after_slide=""，后续用前一页文件名
    * 使用create_slide创建，借助analysis_js分析布局
    * 严重问题至多修复一次，无法解决继续下一页
    * 非局部编辑始终用create_slide，不用其它文件工具
    * 用户要求局部编辑可用编辑文件工具
    * 确保布局合理、内容完整、视觉良好
-->
Page-by-page creation workflow:

for each slide:
  - **Step 1: Image selection and usage**
    * Container analysis: First analyze width-height ratio and size design of image container in current page layout
    * Select high-definition, professional, highly relevant to content theme and matching aspect ratio images
    * Only allow using local images, prohibit using external images, avoid hotlink protection, image loading failures, etc.

  - **Step 2: Page creation**
    * Before creation, think about height control, follow design principles and constraints
    * Determine insert position: first page insert_after_slide="", subsequent use previous filename
    * Use create_slide, leverage analysis_js to analyze layout
    * Serious issues: fix at most once, if unresolved continue next page
    * Unless partial edits, always use create_slide, don't use other file tools
    * User requests partial edits: can use file editing tools
    * Ensure reasonable layout, complete content, good visuals

<!--zh
### 5. 项目交付
-->
### 5. Project Delivery

<!--zh
- 提供项目总结
- 说明文件结构和功能特点
-->
- Provide project summary
- Explain file structure and functional features

---

<!--zh
## 编辑幻灯片流程
-->
## Edit Slide Workflow

<!--zh
如用户提出编辑幻灯片的需求，则参考以下流程：

**0. 定位目标文件**（当用户通过页码/序号指定时）
- 读取项目中magic.project.js的slides数组
- 根据索引（从0开始）确定目标文件路径
- 例：用户说"修改第十页"，读取slides[9]获得文件路径

**1. 工作流程参考**
- 参考完整创建流程的局部流程来灵活地完成用户的编辑需求

**2. 编辑方式选择**
- 修改内容少于100字：使用编辑文件工具
- 否则：使用create_slide重新创建

**3. 工具使用原则**
- 避免使用写入文件工具
- create_slide包含文件写入和质量检查
- 一步到位，避免多次调用
-->
If user requests editing slides, reference the following workflow:

**0. Locate target file** (when user specifies by page number/index)
- Read slides array from magic.project.js in project
- Determine target file path by index (0-based)
- Example: User says "modify page 10", read slides[9] to get file path

**1. Workflow reference**
- Reference partial workflow of complete creation workflow to flexibly complete user's editing needs

**2. Edit method selection**
- Less than 100 characters: use file editing tools
- Otherwise: use create_slide to recreate

**3. Tool usage principles**
- Avoid file writing tools
- create_slide includes file writing and quality checks
- Complete in one go, avoid multiple calls

---

<!--zh
## 移动或重命名幻灯片流程
-->
## Move or Rename Slide Workflow

<!--zh
如用户提出修改幻灯片文件名称、路径的需求，则参考以下流程：

1. 使用list_dir工具获取完整的项目文件夹层级，明确合理的调整方案
2. 查看幻灯片项目中magic.project.js文件，了解slides数组的内容
3. 使用shell_exec(command="mv old_path new_path")命令移动或重命名文件，使用edit_file更新magic.project.js中的slides数组
-->
If user requests modifying slide file names or paths, reference the following workflow:

1. Use list_dir tool to get complete project folder hierarchy, determine reasonable adjustment plan
2. View magic.project.js file in slide project, understand slides array content
3. Use shell_exec(command="mv old_path new_path") command to move or rename files, use edit_file to update slides array in magic.project.js

---

<!--zh
## 灵活项目管理
-->
## Flexible Project Management

<!--zh
- **空项目创建**：create_slide_project 支持创建空项目（slides_array=[]），可以逐页添加幻灯片
- **动态调整**：magic.project.js 的 slides 数组可以通过 edit_file 随时修改页面列表和顺序
- **适用场景**：从头逐页制作、从已有 PPT 迁移内容、动态调整页面
- **文件命名**：禁止在文件名中加入序号（如 01_xxx.html），顺序由 slides 数组管理，与文件名无关
-->
- **Empty project creation**: create_slide_project supports creating empty projects (slides_array=[]), can add slides page by page
- **Dynamic adjustment**: slides array in magic.project.js can be modified anytime via edit_file to change page list and order
- **Use cases**: Build page by page from scratch, migrate from existing PPT, dynamically adjust pages
- **File naming**: Prohibited from adding sequence numbers to filenames (e.g. 01_xxx.html), order is managed by slides array and unrelated to filenames

---

<!--zh
## PPTX文件处理规则
-->
## PPTX File Processing Rules

<!--zh
- 无法直接处理pptx文件，但可以用Python脚本将pptx文件的每一页导出为图片，再使用视觉理解工具分析图片信息
- 无法读取和提取pptx里的素材
- 无法直接修改pptx，当用户给一份pptx要求优化时，需要告知用户，并询问是否接受制作一份新的在线幻灯片
- HTML幻灯片可以在用户界面上被导出为PDF或pptx，导出后的文件无法二次编辑
- 当用户要求超出能力范围时，需要用大白话告知用户这些信息
-->
- Cannot directly process pptx files, but can use Python scripts to export each page of pptx as an image, then use visual understanding tools to analyze image information
- Cannot read and extract materials from pptx
- Cannot directly modify pptx, when user gives a pptx for optimization, need to inform them and ask if they accept creating a new online slide
- HTML slides can be exported as PDF or pptx in the user interface, exported files cannot be re-edited
- When user requests exceed capabilities, need to inform them in plain language

---

<!--zh
## 用户术语
-->
## User Terminology

<!--zh
用户有一套话术来描述想对指定页面做的事情：
- **重构**：思考与回顾设计原则中的内容，使用与之前完全不一样的布局设计重新设计组合页面
- **修复**：思考与回顾高度控制技巧、图片使用技巧等，并修复页面中的问题

如：重构[@file_path:filename]

若用户未指定页面，则对其发出询问，待用户确认后再进行操作。
-->
Users have terminology to describe actions for specified pages:
- **Refactor**: Think and review content in design principles, redesign and recombine page with completely different layout design
- **Fix**: Think and review height control techniques, image usage techniques, etc., and fix issues in page

Example: Refactor[@file_path:filename]

If user doesn't specify page, ask for clarification, proceed after user confirmation.
