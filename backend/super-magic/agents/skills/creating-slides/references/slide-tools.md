# Slide creation tool contracts

`create_slide_project` and `create_slide` are Code Mode only. Run Python through
`run_sdk_snippet`, import `tool` from `sdk.tool`, and call `tool.call(...)`.
Print and read each `result.content`; use `result.ok` for dependent steps.
Both tools report their result through content, not a structured `result.data` contract.

## create_slide_project

Use after the skill's project confirmation and template selection steps. Name the
directory and pages in the user's preferred language, using concise topic names
without sequence-number prefixes or filesystem-unsupported characters.

| Parameter | Required | Meaning |
| --- | --- | --- |
| `project_path` | Yes | Project directory relative to the workspace. |
| `slide_count` | No | Requested count, default `0`; it does not generate page HTML. |
| `slides_array` | No | Ordered project-relative HTML paths, default `[]`. Empty projects can receive pages later. |
| `slide_images_content` | No | Complete Markdown image library; default `""` skips its file and downloads. |
| `todo_list` | No | Complete Markdown production plan; default `""` skips its file. |

The tool creates `index.html`, `magic.project.js`, `slide-bridge.js`, and `images/`.
It optionally writes `slide-images.md` and downloads images, and writes `slide-todo.md`.
It does not create the HTML pages listed in `slides_array`; create those separately.
An existing directory is reused and generated files can be overwritten. Do not use
project creation to edit or reinitialize an existing deck: that can replace its page
list and transition metadata. Use page creation or the relevant editing workflow.

For `slide_images_content`, follow the main skill's Tool Parameter Format Specifications:
use `![filename.png](URL)`, including a filename extension. Alt text becomes the downloaded
filename. Record image size/aspect ratio, visual analysis, intended usage, and search keywords.
For `todo_list`, include an overall design scheme and per-page content and design plans.
When a template is selected, derive its colors and decoration from `theme.css` and check
text contrast against the actual background instead of inventing an independent palette.
Follow [Production plan format](#production-plan-format) for the complete planning example.

```python
from sdk.tool import tool

result = tool.call("create_slide_project", {
    "project_path": "quarterly-review",
    "slides_array": []
})
print(result.content)
if not result.ok:
    raise SystemExit("Project initialization failed; inspect its result before creating pages.")
```

A successful initialization does not prove all image downloads succeeded or that pages
exist. Read any download warnings, verify needed assets, and create pages before reporting
a complete presentation. After failure, inspect the directory before retrying; do not
assume every partial file was removed.

### Production plan format

Pass the full Markdown as `todo_list`. Include an overall design scheme and both
page content and design specifications for every entry in `slides_array`; an empty
project can still carry its planned pages. Adapt filenames and authored content to
the user's language. Do not substitute a content outline for the design specifications.

The example below assumes a selected template whose `theme.css` actually defines
the listed palette and decorations. Replace these values with the selected theme's
definitions; without a template, define a consistent palette in the overall scheme.
Confirm text and accent contrast on each background. Mark assets as ready only after
verifying their local files; pending assets remain production tasks.

```markdown
# Slide Production Plan

## Project Information
- Project Name: Product Launch
- Theme: Introduce the product and its three core benefits
- Pages: 3
- Target Audience: Prospective customers and decision makers
- Keywords: product, workflow, collaboration

## Overall Design Scheme
- Visual Tone: Minimal technology presentation with one clear conclusion per page
- Color Palette: Background #0F172A; body and titles #F8FAFC; secondary text #CBD5E1; accent #22D3EE, extracted from theme.css
- Typography: Main title 96px/700; section title 64px/700; body 32px/400; labels 24px/500
- Shared Layout: 1920x1080 canvas; 96px safe margins; split layouts for product context and a three-column grid for benefits
- Brand Elements: Theme-defined 4px cyan divider; consistent product label and bottom-right page number
- Reusable Styling: Cards use a 1px accent border, 24px radius, and 32px padding; title blocks use 1.1 line height and the theme's heading font

## Per-Page Planning

### Cover (cover.html)

#### Page Content
- Core Message: State the product's main benefit
- Main Title: "One workspace. Clearer decisions."
- Subtitle: "A connected workflow for your team"
- Supporting Information: Product name, presenter, and confirmed launch date
- Key Data: None

#### Design Specifications
- Layout: Full-width product hero image with a left-aligned title block inside the safe margins
- Decorations: Theme divider below the product label; page number in the shared position
- Media: Horizontal product hero image, preferably 16:9; images/product-hero.jpg
- Asset Readiness: Pending; download and verify the local image before authoring
- Static Emphasis: Dark overlay behind the title; accent applied to one key phrase
- Text Limits: Title at most 8 words; subtitle at most 12 words; no body paragraph
- Visual Hierarchy: Title 96px > subtitle 40px > supporting information 24px; title is the focal point

### Product Introduction (product-intro.html)

#### Page Content
- Core Message: Explain the customer problem and the product's response
- Main Title: "Bring scattered work together"
- Body: Three short statements covering the current problem, the proposed workflow, and the user benefit
- Key Data: Use only verified product facts; omit unsupported performance claims

#### Design Specifications
- Layout: 60/40 split with a workflow diagram on the left and three stacked text blocks on the right
- Decorations: Theme divider and shared page-number treatment
- Media: Locally authored static workflow diagram; no external image required
- Asset Readiness: Diagram pending; build it from the confirmed product workflow
- Static Emphasis: Accent border around the final outcome; avoid highlighting every step
- Text Limits: Title at most 8 words; each statement at most 18 words
- Visual Hierarchy: Workflow outcome > title 64px > body 32px > labels 24px

### Key Features (key-features.html)

#### Page Content
- Core Message: Compare three distinct customer benefits
- Main Title: "Three ways to simplify teamwork"
- Features: Shared context, clear ownership, and visible progress; confirm these against product requirements
- Supporting Copy: One concrete usage example per feature

#### Design Specifications
- Layout: Three equal-width cards below a full-width heading; keep card text aligned
- Decorations: Shared card borders, theme divider, and page number
- Media: Three simple static icons or geometric markers; no photographs
- Asset Readiness: Not applicable for geometric markers; verify local files if icons are used
- Static Emphasis: One accent label per card; consistent treatment across all three
- Text Limits: Title at most 8 words; feature labels at most 3 words; examples at most 16 words each
- Visual Hierarchy: Title 64px > feature labels 40px > examples 32px; cards have equal visual weight
```

Before calling `create_slide_project`, prepare `production_plan` as a Python string
containing this Markdown adapted to the actual deck. Match page count and filenames
to the planned deck, and verify template colors, contrast, and asset readiness.

## create_slide

Writes complete HTML, persists inert speaker notes, runs custom browser layout analysis,
and registers a new page in `magic.project.js`. Existing page files are overwritten.
Create page HTML directly in the project directory: automatic registration looks for
`magic.project.js` beside the page and registers its filename.

| Parameter | Required | Meaning |
| --- | --- | --- |
| `file_path` | Yes | Output HTML path relative to the workspace, including the project directory. |
| `content` | Yes | Complete authored HTML, including `slide-bridge.js` and the skill's static canvas requirements. |
| `speaker_notes` | No | Omit to preserve notes on an existing page, or create an empty notes block on a new page. `""` clears notes; text replaces them. |
| `max_width` / `max_height` | Yes | Positive canvas dimensions in pixels; normally `1920` and `1080`. |
| `analysis_js` | Yes | JavaScript function body, not a function declaration. It can use `maxWidth` and `maxHeight` and must return its findings. |
| `insert_after_slide` | Yes | Project-relative anchor page path; `""` inserts a new page first. Missing anchors append with a warning. Ignored for existing pages, which retain their order. |

The tool handles the invisible `data-magic-slide-notes` block. Do not place speaker notes
in visible slide content. Each new path is added to the deck; updating an existing page
keeps its original position and preserves existing transition settings.

For `analysis_js`, select at least five meaningful elements from the authored page and
check all four canvas edges (`x < 0`, `y < 0`, `x + width > maxWidth`,
`y + height > maxHeight`). Check image enlargement and aspect-ratio distortion too.
Return an `issues` array with measured values and identifiable selectors so repairs can
target the actual problem. Use page-specific selectors rather than copying unrelated ones.

After authoring `slide_html` and its `analysis_body`, execute:

```python
from sdk.tool import tool

result = tool.call("create_slide", {
    "file_path": "quarterly-review/cover.html",
    "content": slide_html,
    "speaker_notes": "Introduce the quarter's main conclusion.",
    "max_width": 1920,
    "max_height": 1080,
    "analysis_js": analysis_body,
    "insert_after_slide": ""
})
print(result.content)
```

Write failure returns `ok=False`. Browser analysis can fail after a successful file write,
and registration status is reported separately in content. `ok=True` therefore does not
prove layout QA passed or that registration succeeded: read all three stages. Correct
layout issues using the skill's repair limits. If registration failed, inspect the current
`magic.project.js` before correcting the page list; preserve its existing metadata.
Never report a page as visually checked when browser analysis failed.

Create the project before dependent pages. Review each page's result before continuing;
do not blindly run page creation in parallel or suppress failed-stage details.
