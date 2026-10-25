---
name: creating-slides
description: Slide/PPT creation skill that provides complete slide creation, editing, and management capabilities. Use when users need to create slides, make presentations, edit slide content, configure slide transitions, or manage slide projects. CRITICAL - When user message contains [@slide_project:...] mention, you MUST load this skill first before any operations.

---

# Creating Slides Skill

Provides complete HTML slide creation capabilities, including project creation, content design, technical specifications, workflows, and best practices.

## Core Capabilities

- **Project Creation** - Create complete slide project structure
- **Page Creation** - Create slide pages conforming to specifications
- **Content Research** - Obtain reference materials and data
- **Image Search** - Batch search high-quality image materials
- **Data Analysis** - Support Python scripts for data analysis and processing
- **Project Management** - Support editing, refactoring, moving, and renaming slide projects

---

## Code Execution Method (Critical)

All Python code examples in this skill **must be executed via the `run_sdk_snippet` tool** in Agent environment.

`create_slide_project` and `create_slide` are Code Mode only. Call them with
`sdk.tool.call`, never as directly mounted tools. Before executing, read
[slide tool contracts](references/slide-tools.md) for overwrite behavior, notes,
page registration, and the difference between a saved file and successful layout QA.

**Correct example**:

```python
# Correct! Must use run_sdk_snippet to execute
run_sdk_snippet(
    python_code="""
from sdk.tool import tool
result = tool.call('create_slide_project', {
    "project_path": "my-project",
    "slides_array": []
})
"""
)
```

All code blocks in this document starting with `from sdk.tool import tool` follow this rule: pass them via the `python_code` parameter of `run_sdk_snippet` for execution.

---

## Default Requirements

When user has no explicit requirements, follow these defaults:

- **Page count**: Determine appropriate page count based on content, each page ≤100 lines of code
- **Content density**: One key point per page, text ≤150 words, images ≤1
- **Slide mindset**: 1920×1080 fixed canvas, prioritize horizontal layout, avoid vertical overflow
- **Business minimalist style**, follow font size specifications, Tailwind mandatory priority

---

## In-slide builds

When the user requests click-controlled reveals, read
[in-page-builds.md](references/in-page-builds.md). Builds are optional and never required:
the default is no builds. Only when several substantial content blocks on a page are best
presented one at a time may you consider adding them yourself, or offer them to the user,
following the "Proactive use" section there (which also covers remembering the user's habit). Use only its declarative element
attributes; keep HTML static and preserve the existing slide creation/editing workflow.
Proactive builds must follow its "Proactive use" rules: original element animations take
priority, attributes must be exactly as documented, and the user is told what was added.
Never promise native PowerPoint animations.

## Slide transitions

When the user requests page transitions, read [slide-transitions.md](references/slide-transitions.md)
and the current magic.project.js, then call update_slide_transitions through
`sdk.tool.call` inside `run_sdk_snippet` (Code Mode only). Collect default and page settings
in one operations batch and save once. An unknown outcome requires rereading before further
writes to that configuration. Keep slide HTML static.
Do not add transitions without a request. Preserve existing settings, including explicit none,
during content editing, template replacement, and regeneration. These settings apply to the
online player; do not promise native PowerPoint transitions or standalone index.html playback.

## Technical Specifications

### Size and Implementation

- **Fixed size**: 1920px×1080px, strictly no overflow, width and height must be explicitly set in html and body tags
- **Implementation**: HTML + CSS + JavaScript
- **Static fixed page**: Same effect on any device size, no adaptation, responsive design prohibited
- **Must include** `<script src="slide-bridge.js"></script>` at bottom of page for inter-page communication

### Speaker notes contract

Every generated slide must contain one inert speaker-notes block outside the visual slide DOM:

```html
<template data-magic-slide-notes data-format="plain-text" data-version="1">
Speaker notes for this page.
</template>
```

Generate concise, presentation-ready notes from the page purpose, visible content, audience, and narrative flow. Keep the block outside the rendered canvas. When editing an existing slide, preserve the block and update it whenever the page's message changes. Do not place speaker notes in visible slide elements or remove an existing block unless the user explicitly asks to clear it.

### Inter-slide Links

- Use a normal `<a>` element with a path relative to the current slide HTML file's directory. For example, when the current page is `slides/slide-1.html`, use `<a href="slide-2.html">查看第二页</a>`; use `../` when crossing directories.
- The target file must exist in `magic.project.js`'s `slides` array. Do not use page numbers, display titles, hash conventions, custom routes, or absolute local paths.
- Do not add custom `postMessage`, iframe manipulation, or navigation code for same-deck links; the PPT runtime handles ordinary links specially.
- Keep links to other projects, ordinary HTML documents, and external websites as normal relative paths or full URLs.

### CSS Frameworks and Resources

- **TailwindCSS**: https://cdn.tailwindcss.com/3.4.17 (required, note: this CDN uses JIT browser compilation mode, returns JS code, use `<script>` tag)
- **FontAwesome**: https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css (required)
- **Google Fonts**: https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap (required)
- **ECharts**: https://cdnjs.cloudflare.com/ajax/libs/echarts/5.6.0/echarts.min.js (use when necessary)

### Technical Constraints

- **File generation**: Only generate static HTML files
- **Responsive design prohibited**: Strictly no media queries, pages don't change with screen size
- **Content overload prohibited**: Avoid excessively long text, too many list items, oversized images; split into multiple pages when single page has too much content
- **Dynamic effects prohibited**: Page switching controlled by outer system, single pages focus on static display; disable in-page transitions, keyframes, dynamic data display animations; declarative click builds are allowed when requested, or proactively under the conservative rules in creating-slides/references/in-page-builds.md; disable sound effects, only keep static visuals (CSS hover, shadows, gradients, borders and other style effects can be used normally)
- **Don't use server-side code, local file resources, complex interactive features**
- **Unless user requests, don't use unverified external images**
- **JavaScript code inline at `<body>` bottom, CSS inline in `<head>`, SVG graphics inline directly**
- **Chart implementation**: Charts, dashboards and any ECharts-supported content must use ECharts implementation, prohibited to write HTML, CSS, SVG code yourself

### Tailwind Mandatory Specification

- **Maximize use of Tailwind classes**: Layout flex/grid, spacing p-_/m-_, font size text-_, colors text-_/bg-_, decoration rounded-_/shadow-\*, etc.
- **Minimize custom CSS**: Limited to complex gradients, pseudo-elements and other scenarios Tailwind cannot implement

### Font Size Specification (1920×1080 canvas requires large fonts)

- **Page main title**: 64-72px (text-6xl/7xl) - Prefer 64px and above
- **Section title/Card main title**: 40-52px (text-5xl) - Don't go below 40px
- **Subtitle/Card subtitle**: 30-36px (text-3xl/4xl) - Prefer 32px and above
- **Body text/List item**: 22-26px (text-2xl) - Minimum 22px, prefer 24px
- **Auxiliary label**: 20px (text-xl) - Only for tiny labels
- **Strictly prohibit 18px (text-lg) and below**, unless user explicitly requires
- **Principle**: Prefer large fonts with less content split into more pages, not small fonts cramming into one page

### Visual Hierarchy

Font size contrast (main title differs from body by 3-4 levels) + weight contrast (title font-bold/black) + color contrast (title text-gray-900, body text-gray-600/700) + spatial contrast (important elements mb-8/10/12) + decorative elements (number labels, color blocks, vertical bars)

---

## Design Principles

### Content Design Mindset

- **One key point per page**: Each slide conveys only one core message, maintain focused attention
- **Information hierarchy**: Establish clear information hierarchy through font size, color depth, spatial position, create depth through shadows and transforms
- **Visual expression**: Use FontAwesome or Emoji icons to enhance visual expression

### Image Requirements

- **Image ratio**: 70% of slides must contain high-quality images, e.g., 7 out of 10 slides must contain images
- When an image is the main visual anchor, make it part of the layout rather than a tiny corner illustration. It should usually occupy about one third to one half of the main content area.
- Slides without images still need a strong visual anchor, such as a chart, matrix, color block, large number, geometric decoration, card grid, or flow diagram. Avoid pages with only a title and sparse body text.
- **Search keywords**: Must contain at least one subject keyword, prohibited to use abstract, general, non-specific keywords
  - Search format: `[Subject keyword] [Specific scene description]`
  - Extract at least 1-3 subject keywords related to slide content
  - Keyword examples:
    - Correct: "IShowSpeed China tour Beijing Great Wall" Wrong: "Beijing Great Wall"
    - Correct: "Elon Musk portrait" Wrong: "Tech giant portrait"
    - Correct: "Zuckerberg astronomical talent poaching" (specific event) Wrong: "AI talent competition" (abstract, general, non-specific)
- **Prohibited to use placeholder images**, must use high-quality images returned by image_search tool

### Design Style

**Default style**: Minimalist business style

- **Primary colors**: Black/white/gray (text-gray-\*)
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

### Layout Design Core Principles

- **Precise zoning planning**: Precise zoning planning based on 1920×1080 canvas
- **Priority layout modes**: Single column centered, left-right split, three-point grid, standard three-section, card-style, timeline (only horizontal timeline allowed), comparison split-screen and dashboard classic PPT layout modes
- **Especially recommend left-right split layout** (like 60/40 or 50/50), fully utilize horizontal space, avoid vertical stacking causing height overflow
- **Zoning planning**:
  - Header area: Fixed height about 10% (like h-24)
  - Middle content area: Occupies main space, can flexibly divide into 2×2, 3×3 grid, max 9-grid
  - Footer area: Fixed height about 5% (below h-16), images not allowed
- **Horizontal division**: Max 6 columns per row, avoid overly fragmented division causing content crowding
- **Vertical infinite extension prohibited**: Maximize horizontal space use, e.g., horizontal timeline not vertical timeline

Use predefined grid (grid-cols-2/3, grid-rows-2) with gap-4/6/8 unified spacing, flexibly control element space occupation through col-span-2, row-span-2, avoid pixel values defining grid size, use fr units or percentages; Flex layout uses TailwindCSS proportional width classes (w-1/2, w-1/3, w-2/3) prohibited hardcoded pixels, leverage flex-1, justify-between, items-center to achieve responsive layout and balanced content distribution.

### Height Control Technique (Critical)

**[Hard Requirement] Page height must strictly not exceed 1080px, this is a non-negotiable specification!**

If content is too much for a single page, **must split into multiple pages**, absolutely not allowed to let single page exceed 1080px height.

**Reasonable slide height control is extremely important**. A simple effective approach is using Grid horizontal card layout, maximize horizontal space use, control similar left-right content amounts, aligned arrangement, overall neat typography.

During conception, **page preceding elements should choose height-sensitive elements (usually need sufficient space), subsequent elements/content use height-insensitive elements (usually can adapt to remaining space, like charts)**, so only need to consider preceding element heights, set subsequent element/content heights to fill remaining height.

While ensuring page is visually full, **absolutely don't cram too much readable substantive content in one page**.

Please think through above points step by step during design, ensure perfect page layout and height control. Unless user has conflicting requirements, must default to this approach for page layout and height control.

### Image Usage Technique

Images are very dangerous, hard-to-control elements in slide creation. Need to plan space with similar aspect ratio to place images, carry images through container elements, let images fill container. Container width and height should use relative units (like percentages, fr units) or Grid layout's automatic allocation mechanism, not fixed, often miscalculated pixel values, otherwise images often overflow canvas causing layout chaos.

Content-related images may also be used as local section backgrounds to add depth. Put an independent overlay layer above the background image and keep text/cards in a separate foreground layer. Do not apply `opacity` to a container that also holds text.

```html
<div
  class="relative"
  style="background-image:url('images/xxx.jpg');
     background-size:cover;background-position:center;"
>
  <div class="absolute inset-0" style="background:rgba(14,20,32,0.60);"></div>
  <div class="relative z-10"><!-- content --></div>
</div>
```

Use background images selectively. Avoid repeating the same full-image treatment on most consecutive slides; alternate with charts, cards, diagrams, or clean graphic pages.

### Default Design Mindset

Slides overall have premium feel, use rich decorative elements, conform to industry mainstream aesthetic practices, but don't introduce too much complexity. Note slide height control and neat typography, don't cram too much content in one page, this is key.

---

## ECharts Configuration Requirements

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

## Data Analysis Processing

When scenarios involve data analysis, write Python scripts for analysis:

- **Python scripts are solely for data analysis processing, not data visualization**. Use ECharts for visualization. Strictly prohibited to write chart rendering code in Python scripts.
- For data files like Excel, CSV, use read_files to read first 10 lines to understand structure, then use Python scripts for data analysis.
- For Excel files with multiple sheets or large size, always use Python scripts for analysis. First use script to view data structure and sheet structure, then perform analysis.
- Python script processing results should be refined. Script's role is to calculate and distill core data, not return large amounts of process data, typically hundreds to thousands of characters, max 5000 characters.
- Follow latest mainstream Python programming practices. Ensure code robustness, aim for one-time successful execution.

---

## Slide HTML Template

Reference the following template to create slide pages. Each page is an independent HTML file, style should be consistent but can have appropriate variations, comments are for your understanding only, omit in actual development.

```html
<!DOCTYPE html>
<html lang="zh">
  <head>
    <meta charset="utf-8" />
    <meta content="width=device-width, initial-scale=1.0" name="viewport" />
    <title>Slide Title</title>
    <script src="https://cdn.tailwindcss.com/3.4.17"></script>
    <link
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap"
      rel="stylesheet"
    />
    <style>
      html,
      body {
        width: 1920px;
        height: 1080px; /* DO NOT set height or max-height, allow extreme cases to exceed */
        font-family:
          "Noto Sans SC",
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          sans-serif;
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

## Quick Start

> **Reminder**: All code examples below must be executed via `run_sdk_snippet(python_code="...")`. Refer to the "Code Execution Method" section at the top of this document.

### Create Slide Project

For the planned project example, first prepare `production_plan` as the complete
Markdown described in [Production plan format](references/slide-tools.md#production-plan-format).
Its three page entries must match `cover.html`, `product-intro.html`, and `key-features.html`.

```python
from sdk.tool import tool

# Create empty project (add pages later)
result = tool.call('create_slide_project', {
    "project_path": "ChatGPT-Evolution-Report",
    "slides_array": [],
    "slide_images_content": "",
    "todo_list": ""
})

# Create a project skeleton with images and a complete design plan
result = tool.call('create_slide_project', {
    "project_path": "Product-Launch",
    "slides_array": ["cover.html", "product-intro.html", "key-features.html"],
    "slide_images_content": """# Slide Image Library

## Project Info
- Search topic: Product Launch
- Collected at: 2025-01-22 10:30:00
- Total images: 5

## Image Categories

### Cover / Hero

![product-hero.jpg](https://example.com/image1.jpg)
- Index: 1
- Size: 1920x1080px (16:9, horizontal)
- Visual Analysis: Modern tech product close-up, white background, professional lighting
- Use Case: Cover hero image
- Search Keywords: product hero image modern technology
""",
    "todo_list": production_plan
})
print(result.content)
```

### Create Single Slide Page

```python
from sdk.tool import tool

result = tool.call('create_slide', {
    "file_path": "ChatGPT-Evolution-Report/OpenAI-Milestones.html",
    "content": """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title>OpenAI Milestones</title>
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
            <h1 class="text-7xl font-bold text-gray-900 mb-8">OpenAI Milestones</h1>
            <p class="text-3xl text-gray-600">Key moments in AI development</p>
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
        issues.push(`Container bottom overflow: ${Math.round(y+height)} > ${maxHeight}`);
    }
}
return issues.length > 0 ? issues.join(', ') : 'Layout check passed';
""",
    "insert_after_slide": ""
})

# Second page
result = tool.call('create_slide', {
    "file_path": "ChatGPT-Evolution-Report/Development-Timeline.html",
    "content": """...""",
    "max_width": 1920,
    "max_height": 1080,
    "analysis_js": """...""",
    "insert_after_slide": "OpenAI-Milestones.html"
})

# Third page
result = tool.call('create_slide', {
    "file_path": "ChatGPT-Evolution-Report/Technical-Breakthroughs.html",
    "content": """...""",
    "max_width": 1920,
    "max_height": 1080,
    "analysis_js": """...""",
    "insert_after_slide": "Development-Timeline.html"
})
```

### Search Image Materials

```python
from sdk.tool import tool

result = tool.call('image_search', {
    "search_group_name": "product-report-images",
    "requirements": [
        {
            "name": "Product Interface",
            "query": "Example App product interface screenshot",
            "visual_understanding_prompt": "Confirm the image shows the product interface and recognizable features.",
            "requirement_explanation": "Use a product interface screenshot to illustrate the main features.",
            "expected_aspect_ratio": "16:9",
            "count": 5
        },
        {
            "name": "Technology Background",
            "query": "AI technology abstract background",
            "visual_understanding_prompt": "Assess whether the content is suitable as a technology-themed background.",
            "requirement_explanation": "Use an abstract technology image as a slide background.",
            "expected_aspect_ratio": "16:9",
            "count": 3
        }
    ]
})
print(result.content)
```

### Web Content Retrieval

```python
from sdk.tool import tool

# Search web pages
search_result = tool.call('web_search', {
    "search_group_name": "industry-report",
    "requirements": [
        {
            "name": "Industry Overview",
            "query": "enterprise AI software industry report",
            "limit": 10,
            "language": "en-US",
            "region": "US"
        },
        {
            "name": "Recent Developments",
            "query": "enterprise AI software product updates",
            "limit": 10,
            "language": "en-US",
            "region": "US",
            "time_period": "month"
        }
    ]
})
print(search_result.content)

# Read high-value webpages (refer to separate documentation for this tool)
# read_result = tool.call('read_webpages_as_markdown', {...})
```

---

## Core Tools and Parameters

### create_slide_project - Create Slide Project

| Parameter              | Required | Type   | Description                                                                     |
| ---------------------- | -------- | ------ | ------------------------------------------------------------------------------- |
| `project_path`         | Yes      | string | Project relative path (folder name), e.g., `"ChatGPT-Development-Report"`       |
| `slide_count`          | No       | number | Requested page count, default 0; does not create page HTML                     |
| `slides_array`         | No       | array  | Ordered slide filenames; defaults to empty array `[]`                          |
| `slide_images_content` | No       | string | Image material library content (Markdown format), empty means not creating file |
| `todo_list`            | No       | string | Task planning content (Markdown format), empty means not creating file          |

**Tool Functions:**

- Create project folder structure
- Auto-generate `index.html` (presentation controller)
- Auto-generate `magic.project.js` (project config)
- Auto-generate `slide-bridge.js` (inter-page communication script)
- Create `images/` folder
- If `slide_images_content` is provided, automatically download images to `images/` folder

### create_slide - Create Slide Page

| Parameter            | Required | Type   | Description                                                                       |
| -------------------- | -------- | ------ | --------------------------------------------------------------------------------- |
| `file_path`          | Yes      | string | Slide file path (relative to working directory), e.g., `"project-name/page.html"` |
| `content`            | Yes      | string | Complete HTML content                                                             |
| `speaker_notes`      | No       | string | Omit to preserve existing notes or create an empty block; `""` clears notes; text replaces them |
| `max_width`          | Yes      | number | Expected max width (usually 1920)                                                 |
| `max_height`         | Yes      | number | Expected max height (usually 1080)                                                |
| `analysis_js`        | Yes      | string | Layout analysis JavaScript function body (without function declaration)           |
| `insert_after_slide` | Yes      | string | New slide position: `""` for first page, filename to insert after; ignored for existing slides |

**Tool Functions:**

- Write HTML file
- Load via browser and execute `analysis_js` for quality check
- Detect layout issues, height overflow, image stretch, small fonts
- Register new slides based on `insert_after_slide`; preserve existing slide order on content updates

**analysis_js Instructions:**

- Function body content (without `function()` declaration)
- Can access `maxWidth`, `maxHeight`
- Use `return` for result
- Focus on detecting element overflow

**insert_after_slide Instructions:**

- `""` for first page, filename to insert after
- Applies only to slides not yet in the slides array. Updating an existing slide preserves its position.

### image_search - Batch Search Images

| Parameter          | Required | Type   | Description                                  |
| ------------------ | -------- | ------ | -------------------------------------------- |
| `search_group_name` | Yes      | string | Short name you create for related searches. Reuse the exact name within a group and choose a new name for a separate group. Images are deduplicated within each group; do not use the platform conversation ID. |
| `requirements`    | Yes      | array  | Non-empty list of search requirement objects; each item runs one search |

Each `requirements` item contains:

- `name` - Requirement name (required)
- `query` - Search keywords (required)
- `visual_understanding_prompt` - Visual analysis prompt (required)
- `requirement_explanation` - Requirement explanation (required)
- `expected_aspect_ratio` - Expected aspect ratio, e.g., `16:9`, `9:16`, `1:1` (required)
- `count` - Image count (optional, default 20, max 50)

**Key Principles:**

- Each requirement must provide clear search keywords
- Keywords must include subject words, prohibit pure generic terms
- Choose language based on search intent (Chinese/English/mixed)
- Visual analysis cannot assess clarity, only content

### web_search - Web Search

| Parameter          | Required | Type   | Description                                  |
| ------------------ | -------- | ------ | -------------------------------------------- |
| `search_group_name` | Yes      | string | Short name you create for related searches. Reuse the exact name within a group and choose a new name for a separate group. This labels results without deduplication; do not use the platform conversation ID. |
| `requirements`    | Yes      | array  | Non-empty list of search requirement objects; each item runs one search |

Each `requirements` item contains:

- `name` - Requirement name (required)
- `query` - Search keywords (required)
- `limit` - Result count (optional, default 10, max 20)
- `offset` - Pagination offset (optional, default 0)
- `language` - Search language (optional, default zh-CN)
- `region` - Search region (optional, default CN)
- `time_period` - Time range (optional): day/week/month/year

---

## Project Architecture

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

## Tool Usage Principles

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

## Magic Project Mechanism

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

## Tool Parameter Format Specifications

### create_slide_project Parameter Formats

#### slide_images_content Format Requirements

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

**Important Notes**:

1. Use standard Markdown image format: `![filename](url)`
2. filename serves as image alt text and also as filename when downloading
3. filename must include file extension, e.g., .jpg, .png, .webp, etc.
4. filename should prioritize user's preferred language, be concise and clear, e.g., "trump-assassination-attempt.jpg", "chatgpt-viral-phenomenon.png", "tesla-q4-earnings.jpg"

#### todo_list Format Requirements

Pass the complete `slide-todo.md` Markdown, with project information, an overall
design scheme, and a content plan and design specification for every page.
An outline alone is insufficient. Record the palette, typography, shared layout,
decorations, and reusable styling; for each page specify its content, layout,
media and asset readiness, static emphasis, text limits, and visual hierarchy.

When using a template, derive colors and decorations from its actual `theme.css`
and ensure text and accent colors contrast with the selected backgrounds.
Read [Production plan format](references/slide-tools.md#production-plan-format)
for the complete example before preparing this parameter. Adapt it to the user's
language, selected theme, content, and actual page count.

#### magic.project.js Format Description (slide type)

magic.project.js is a JSONP format project configuration file that defines slide project structure and page list.

**File Structure**:

```javascript
window.magicProjectConfig = {
  version: "1.0.0",
  type: "slide",
  name: "Project Name",
  slides: ["cover.html", "contents.html", "content-page.html"],
};
window.magicProjectConfigure(window.magicProjectConfig);
```

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

## image_search Keyword Strategy

### Basic Principles

When using image_search tool, query keywords must be diversified, try 2-3 different keyword combinations for each requirement.

### Keyword Language Selection Principles

Judge language based on search intent and information source, try multilingual combinations:

- Search foreign websites/international reports → Use English or original language
- Search local websites → Use local language
- Uncertain about source → Mix multiple languages for comprehensive results
- Same topic can use different languages to get different perspectives

### Search Strategy Framework

1. **Core word**: Most direct topic word
2. **Qualifier**: Core word + attribute/function/scenario
3. **Combination**: Multiple related elements combined
4. **Variant**: Synonym/abbreviation/colloquialism/multilingual variant

### Search Examples

**Search iPhone official images**:

- "iPhone", "iPhone 17 Pro Max", "iPhone official"

**Search Chinese netizens' comments about Musk (screenshots)**:

- "Musk Weibo", "Musk comments Chinese", "Musk social media China"

**Search international news images about Musk**:

- "Elon Musk", "Musk Tesla", "Musk 2025"

**Search WeChat function interface**:

- "WeChat app", "WeChat interface", "WeChat Pay"

**Search international reports about WeChat**:

- "WeChat", "WeChat China", "WeChat report"

**Search Tesla Shanghai factory (mixed)**:

- "Tesla Shanghai", "Tesla Shanghai Gigafactory", "Tesla China factory"

### Wrong Examples (Avoid)

- Use "collaboration software" → Too generic, should use "Figma", "Figma collaboration" etc.
- Use "database tool" → No subject, should use "Notion database", "Airtable" etc.
- **Prohibit generic searches**: No using only generic industry terms (software/platform/tool), pure function terms (payment/chat), pure adjectives (modern/advanced)

### Keyword Diversification Principles

- From core to specific: Subject name → Subject+attribute → Subject+scenario+time
- Try different expressions: Choose language based on source/abbreviation/full name/multilingual variants
- Combine different elements: Subject/action/time/location
- At least 2-3 different angles per requirement

---

## Create Specific Slide Workflow

If user requests creating specific slides or requests imitating/referencing to generate slides, reference partial workflow of complete creation workflow to flexibly complete user's creation needs.

### Best Practices

#### 1. Use create_slide_project to Create Project

- **When user has no image requirements**: slide_images_content can be empty
- **When user already provided images**: No need to use image_search tool to search images, instead use visual_understanding tool to analyze image info, write image info into slide_images_content per format requirements
- **When user already provided outline or specific text**: No need to use web_search tool to search webpages, directly extract todo_list content

#### 2. Use create_slide Through Code Mode to Create Slides

- Create slides based on user-provided information
- Insist on using create_slide tool, use analysis_js to analyze layout
- Don't use file writing tools

#### 3. Special Handling for Imitate/Reference Scenarios

- **Remember to copy original images**: Copy original images to new project's images folder, ensure complete slide project architecture
- Use shell_exec(command="cp src_path dst_path") command to copy images

---

## Complete Creation Workflow

If user has no special requirements, follow this workflow step by step to complete slide creation task:

### 1. Internet Search

- Understand task description and user needs
- **Round 1 search (required)**: Generate 3 keyword sets for web_search tool, search relevant pages
- **Round 2 search (optional)**: If search results differ from expectations (common in current events scenarios), generate 3+ keyword sets again, conduct second round search with web_search
- Select high-value pages, eliminate duplicates and irrelevant pages. If user doesn't specify count, default to 5 high-value pages, use read_webpages_as_markdown to get high-value page content

### 2. Image Search and Content Planning

- **Batch image search**: Use image_search tool to batch search image materials, default minimum batch search 5+ requirements at once, all different, covering large, medium, small, horizontal, vertical various sizes or different scenarios for later use, reuse the project's image search_group_name across calls to deduplicate images
- **One-time batch search**: Speculate various types of image needs potentially needed later, initiate batch search in one go, common examples: search background large images, character portraits, product close-ups, icons in different sizes and scenarios
- **Avoid duplicates**: Don't repeatedly use visual analysis on similar content images, ensure similar content images only used once
- **Content planning**: Based on user needs and reference materials, analyze and plan slide content:
  - Analyze user specific needs and background
  - Extract core content points from reference files
  - Determine slide page count (determine appropriate page count based on content)
  - Identify target audience and usage scenarios
  - Choose appropriate design style: Select most suitable style direction from design style list based on content theme
- **Prepare content**: Prepare complete slide_images_content and todo_list content
- **User requirements priority**: If user has explicit other image requirements, prioritize user requirements

### 3. Project Initialization

Call create_slide_project, it will help you complete the following in one go:

- Create project folder and skeleton structure
- Auto-generate slide-images.md and slide-todo.md files
- Auto-download image materials to images folder
- Create all necessary project files and structure

### 4. Slide Content Development

Page-by-page creation workflow:

for each slide:

- **Step 1: Image selection and usage**
  - Container analysis: First analyze width-height ratio and size design of image container in current page layout
  - Select high-definition, professional, highly relevant to content theme and matching aspect ratio images
  - Only allow using local images, prohibit using external images, avoid hotlink protection, image loading failures, etc.

- **Step 2: Page creation**
  - Before creation, think about height control, follow design principles and constraints
  - Identify the main visual anchor before writing HTML
  - If text is sparse, enlarge the conclusion and add cards, a chart, a large number, a background block, or a meaningful image area
  - If using a background image, keep text readable with an overlay and avoid repeating the same treatment on consecutive slides
  - Prefer horizontal split, grid, dashboard, matrix, timeline, or card layouts over small centered text blocks
  - Determine insert position: first page insert_after_slide="", subsequent use previous filename
  - Use create_slide, leverage analysis_js to analyze layout
  - Serious issues: fix at most once, if unresolved continue next page
  - Unless partial edits, always use create_slide, don't use other file tools
  - User requests partial edits: can use file editing tools
  - Ensure reasonable layout, complete content, good visuals

### 5. Project Delivery

- Provide project summary
- Explain file structure and functional features

---

## Edit Slide Workflow

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

## Move or Rename Slide Workflow

If user requests modifying slide file names or paths, reference the following workflow:

1. Use list_dir tool to get complete project folder hierarchy, determine reasonable adjustment plan
2. View magic.project.js file in slide project, understand slides array content
3. Use shell_exec(command="mv old_path new_path") command to move or rename files, use edit_file to update slides array in magic.project.js. In the same configuration update, migrate the matching transitions.slides key from the old path to the new path. Deletion removes its override; copying copies only an explicit override, while an inherited setting stays inherited.

---

## Flexible Project Management

- **Empty project creation**: create_slide_project supports creating empty projects (slides_array=[]), can add slides page by page
- **Dynamic adjustment**: slides array in magic.project.js can be modified anytime via edit_file to change page list and order
- **Use cases**: Build page by page from scratch, migrate from existing PPT, dynamically adjust pages
- **File naming**: Prohibited from adding sequence numbers to filenames (e.g. 01_xxx.html), order is managed by slides array and unrelated to filenames

---

## PPTX File Processing Rules

- Cannot directly process pptx files, but can use Python scripts to export each page of pptx as an image, then use visual understanding tools to analyze image information
- Cannot read and extract materials from pptx
- Cannot directly modify pptx, when user gives a pptx for optimization, need to inform them and ask if they accept creating a new online slide
- HTML slides can be exported as PDF or pptx in the user interface, exported files cannot be re-edited
- When user requests exceed capabilities, need to inform them in plain language

---

## User Terminology

Users have terminology to describe actions for specified pages:

- **Refactor**: Think and review content in design principles, redesign and recombine page with completely different layout design
- **Fix**: Think and review height control techniques, image usage techniques, etc., and fix issues in page

Example: Refactor [slide.html](./project-name/slide.html)

If user doesn't specify page, ask for clarification, proceed after user confirmation.
