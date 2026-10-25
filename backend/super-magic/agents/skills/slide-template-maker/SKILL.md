---
name: slide-template-maker
description: "Create, reconstruct, extract, or update reusable HTML slide templates from presentation files, images, screenshots, HTML, text style briefs, existing template folders, or Super Magic slide projects. Use when the user asks to make a slide/PPT template, convert a PPT/PPTX into a template, recreate a visual style as a template, extract reusable layouts, or improve an existing template."
---

# Slide Template Maker

Create reusable slide template projects through semantic authoring and visual reconstruction. The project directory also contains the generated preview assets required by the later publishing workflow.

## Scope

Own every workflow that creates or changes a template:

- Reconstruct a template from PPTX, PPT, POTX, POT, PPSX, or another OOXML presentation file.
- Create a template from images, screenshots, HTML, or a written style brief.
- Extract a template from an existing Super Magic slide project.
- Update an existing template when the user explicitly requests an update.

Do not use this skill to browse, install, select, or apply an existing platform template. Load `slide-template` for those tasks.

## Source vs pipeline

The source is evidence. It never changes the output contract, and it never disables create, authoring, or finalize.

Every source type still queries taxonomy, calls `create_slide_template_project`, authors `visual-spec.md` / `theme.css` / `slides/`, then calls `finalize_slide_template` and confirms `previews/`. `finalize_slide_template` renders the authored HTML. It does not need PPTX, OOXML, or `source-analysis.json`. Missing prepare is a hard block only when `source.method` is `visual-reconstruction`.

Do not report that finalization is impossible because the source is a Super Magic HTML project, an image, a text brief, or anything other than PPTX. That is a false blocker. Skipping prepare for those sources is correct; skipping finalize is not. `previews/` comes from authored slides, not from source analysis.

Read the matching evidence reference, then return here for create, authoring, and finalize:

| Source | Evidence reference | `source.method` | Prepare / review / select |
| --- | --- | --- | --- |
| PPTX, PPT after conversion, POTX, PPSX | `references/ppt-visual-reconstruction.md` | `visual-reconstruction` | Required |
| Super Magic slide project (`magic.project.js`) | `references/project-template-workflow.md` | `project-extract` | Do not call |
| Images or screenshots | `references/input-workflows.md` | `image-rebuild` | Optional `page_images` only |
| HTML pages that are not a Super Magic project | `references/input-workflows.md` | `html-import` | Do not call |
| Text style brief | `references/input-workflows.md` | `brief-generator` | Do not call |
| Existing template folder | `references/input-workflows.md` | keep existing | Do not call |

Also read `references/scene-routing.md`, `references/template-taxonomy.md`, `references/template-json-spec.md`, and `references/quality-guidelines.md`.

## Non-Negotiable PPT Rule

Never call `convert_pptx_to_slide_template`, `pptx-to-html`, or any legacy PPTX-to-template script. Never refine converter-generated HTML into a final template.

For OOXML presentation files, render pages only to obtain visual evidence. Analyze those images, then author new semantic HTML and CSS from scratch. The final template must not contain full-slide screenshots, converter DOM, renderer wrappers, `slide-001.html`, `Converted Slide`, or source-tracing attributes.

## Output Contract

Write one standalone project directory at the workspace root. Its semantic name is generated in Chinese or English according to the selected language tag. The name is a filesystem detail and is not added to `template.json`. The source files and generated preview assets share this directory:

```text
<semantic-template-name>/
├── template.json
├── visual-spec.md
├── theme.css
├── images/
├── slides/
├── previews/
│   ├── thumbnail.png
│   ├── collage.png
│   └── slides/
└── template-assets.json
```

Do not add a `slide-templates/` prefix. Do not create a ZIP, `magic.project.js`, `index.html`, `slide-bridge.js`, `preview.html`, or `packages/`. `previews/` and `template-assets.json` are required finalization outputs and must stay inside the same project directory.

Later tools only need `template_dir`. Do not write `source-analysis.json`, do not create `.template-work/` inside the template directory, and do not maintain hidden working-directory paths yourself.

## Tool ownership

`create_slide_template_project` owns the template directory, `template.json`, and the initial slide scaffolds. Do not recreate or overwrite those files with `shell_exec`, `run_python_snippet`, `write_file`, or other generic file tools. After creation, generic file tools may edit only `visual-spec.md`, `theme.css`, `images/`, and the declared `slides/*.html` files. Category and tag codes must come from `query_slide_template_taxonomy` by matching this template's audience, purpose, and visuals. When `source.method` is `visual-reconstruction`, source review and asset selection must go through `review_slide_template_source` and `select_slide_template_source_assets`. If a dedicated tool fails, retry that same tool. Do not emulate it.

The template is not complete when authoring finishes. Call `finalize_slide_template` with the returned `template_directory`, inspect `result.ok` and `result.content`, and confirm `previews/thumbnail.png`, `previews/collage.png`, and one preview per indexed slide exist. Report completion only after finalization succeeds and those preview files are present. If any required step fails or is skipped, tell the user it is blocked: name the blocker and the remaining steps. Do not say the template is complete. HTML/CSS in the folder is not enough.

## Intake Checkpoint

**CHECKPOINT:** Before `create_slide_template_project`, call `ask_user` once for missing direction. These questions are about the target template, not the source, so ask them from the user's request alone: do not open, convert, or render the deck first. Do not put `ask_user` inside `run_sdk_snippet` or Code Mode.

Ask only what the user did not already answer, and only when the answer would change the finished template. Write questions in the user's language. Prefer `select`. Set `default` on every question. Omit `timeout` because these choices affect the finished template; use `timeout=60` only for a simple choice where the default is safe and continuing without the user is acceptable. If the user skips or says to decide, continue with those defaults. If `ask_user` is blocked, use the same defaults without asking.

Drop a question when the user already specified it:

- Reusable / 可复用 / extract the visual system / keep the style only → skip shape; use `hybrid` and 8–15 pages.
- Page-by-page / 逐页 / keep every page / 尽量还原结构 → skip shape; use `high-fidelity` and keep source pages minus ads, watermarks, and copyright pages.
- Keep / replace source images, or explicit asset instructions → skip asset strategy.
- Concrete text briefs, screenshot style rebuilds, and HTML rebuilds skip shape unless the user also uploaded a presentation and asked for page-by-page reconstruction.
- Generic “做成模板 / 做模板 / 转成模板” without reusable or page-by-page language does not skip shape.

When shape is missing, recommend reusable 8–15 pages unless the user asked to restore the source page by page. High-fidelity still means new semantic HTML. Never use converter HTML or full-slide screenshots as finished pages.

Translate the question and every option into the user's language before sending them. The shape below is the meaning to convey, not literal text to paste:

```text
<question type="select" default="Reusable 8-15 pages">
What should the template be?
<option>Reusable 8-15 pages — extract color, type, and components into a reusable template</option>
<option>Keep source pages — rewrite each useful page in semantic HTML, drop ads and copyright pages</option>
</question>

<question type="select" default="Keep usable source images">
How should source images be handled?
<option>Keep usable source images — logos, faces, QR codes, and private screenshots still need a later confirm</option>
<option>Replace all images with neutral placeholders</option>
</question>
```

Add a situational question only when it would change the result, such as a non-16:9 canvas, mixed Chinese/English sample copy, or an unclear training-versus-report scene.

## Workflow

The main path is three beats for every source type: create, author, finalize. Source-specific evidence gathering sits between create and authoring and never replaces finalize.

1. Note the source type from the Source vs pipeline table and load that evidence reference. A Super Magic slide project, HTML folder, screenshot set, or text brief is not an OOXML presentation file. Do not convert or export those sources, and do not plan to call `prepare_slide_template_source` on them later.
2. Run the Intake Checkpoint. Do not call `create_slide_template_project` until missing shape and asset questions are asked or safely defaulted.
3. Query the live catalog through `query_slide_template_taxonomy` exactly once, then pick one exact `category_code` and 4–10 exact `tag_codes` by meaning from the source's audience, use case, visible style, palette, layouts, mood, and language. Do not substring-search names, guess codes, or add `featured` automatically.
4. Determine a backend-compatible semantic base ID: `SLIDE-` plus lowercase kebab-case words. `create_slide_template_project` appends a short six-character uppercase hexadecimal suffix to the backend `template_id`, but the local directory name contains no random suffix. Use the returned `created.data["template_directory"]` for every later call.
5. Call `create_slide_template_project` with the selected category, tags, bilingual labels, source canvas, and the `source.method` from the table. Do not create the template directory manually.
6. If and only if the source is an OOXML presentation file (PPTX, or PPT after conversion to PPTX), run these three tools in order. Nothing else touches that file.
   - `prepare_slide_template_source` with `template_dir` and `source_presentation`. It renders every page itself into the runtime directory, so leave `page_images` out and never pre-convert the deck. A legacy `.ppt` is the one exception: convert it to `.pptx` through `document-converter` first, because the structure reader needs OOXML. Pass `high-fidelity` after a page-by-page intake, otherwise `hybrid`. Read the reported background map; it names every measured background scheme and the pages that use it.
   - `review_slide_template_source` for every index in `recommended_review_indexes`, up to 6 per call. Pages in one call are reviewed in parallel, so send full batches rather than one page at a time. Every skipped index is a page whose margins, type scale, and background you will be inventing.
   - `select_slide_template_source_assets` with 1–8 complete decision objects per call. Use public ids such as `asset-01`. Repeat until `pending_count` is `0`. Never pass converter filenames, catalog rows, id-only objects, or a list of ids. `target_name` is a semantic stem; the tool keeps the original file extension.
7. Super Magic projects, HTML pages, text briefs, and screenshot rebuilds skip beat 6. When the source is loose images rather than an OOXML file, you may pass them as `page_images` instead of `source_presentation`; that is still optional evidence, not a substitute for finalize.
8. Author `visual-spec.md`, `theme.css`, `images/`, and the declared `slides/*.html` files in `template_dir`, following the Source Fidelity Rules below. For reusable/hybrid templates, keep 8–15 useful slides and fuse repeated source pages. For high-fidelity, keep the source page count minus ads, watermarks, and copyright pages.
9. Always call `finalize_slide_template`. It renders authored HTML into `previews/`. It hard-blocks missing prepare only when `source.method` is `visual-reconstruction`. It also hard-blocks incomplete asset decisions, unused selected assets, converter residue, canvas/taxonomy errors, and missing previews. Unreviewed source pages become warnings, not a hard stop.
10. Compare `previews/slides/` with the source. If `result.data["warnings"]` lists unreviewed pages, inspect those previews first. Fix and finalize again if needed.
11. If every Completion Gate item passed, report the project directory, inventory, selected/discarded assets, preview paths, warnings, and remaining limits. If any item failed or was skipped, use the Blocked Report instead. Never delete the user-provided source file or any final file listed by `template.json` or `template-assets.json`.

Sanitize sensitive content and ask the user before keeping ambiguous logos, real people, QR codes, customer screenshots, private dashboards, or proprietary UI.

## Source Fidelity Rules

A reconstruction that keeps the source's page structure but loses its background rhythm, margins, or type scale is a failed reconstruction. These four rules produce most of the visual gap between a template and its source. `references/ppt-visual-reconstruction.md` carries the measurement protocol.

- Rebuild each page on the background of the source page it derives from. A deck that opens dark and turns light in later sections must keep that alternation. Never sample one page and apply its background to the whole template. For OOXML reconstructions, `prepare_slide_template_source` reports a measured hex and light/dark tone per page, and `review_slide_template_source` repeats it per reviewed page; treat both as ground truth over your own impression. For Super Magic projects, HTML, images, and text briefs, measure those schemes yourself from the source.
- Give `theme.css` one surface class per background scheme, each pairing a background with its own foreground, muted-text, border, and accent-on-surface values. A single hard-coded `body` background makes mixed-tone decks impossible, because slide markup then has no way to switch text color with the surface.
- Use the measured margins, alignment axis, column count, and block proportions. For OOXML reconstructions, take them from `review_slide_template_source`. For other sources, measure them from the source pages yourself. Do not fall back to a centered title with an even card grid; that is the most common way a reconstruction stops resembling its source.
- Derive type sizes from the reported percentage of canvas height rather than browser defaults. Keep body text at or above 1.8% of canvas height, about `20px` on a 1080-tall canvas, and scale every other role from the same base.

## Authoring Rules

- Use the declared source canvas from `template.json` with no responsive layout. Default to `1920x1080` only when the source does not provide dimensions, and preserve source ratios such as `1:1`.
- Preserve the generated slide canvas contract on every page. Each slide must keep one root element in the form `<main class="slide-container" data-width="..." data-height="...">`.
- Keep `data-width` and `data-height` equal to `template.json.source.canvas.width` and `template.json.source.canvas.height`. When replacing scaffold content, replace only the content inside the root canvas; do not remove or rename the `slide-container` class or either dimension attribute.
- Make `visual-spec.md` the design contract: palette, typography scale, spacing, every background scheme with the pages that use it, components, chart rules, image treatment, page rhythm, editing guidance, and forbidden patterns.
- Keep reusable visual-system CSS in `theme.css`: design tokens, the surface classes, typography scale, components, and chart palette. Keep page-specific grid, flex, padding, and positioning in each slide HTML file.
- Apply a surface class on the `slide-container` root of every page and read colors from that surface's tokens. Do not hard-code per-page colors that bypass the surface system.
- Use lowercase kebab-case filenames for English-context templates. Chinese-context templates may use concise Chinese semantic filenames such as `封面.html`, while `layout` remains lowercase kebab-case.
- Give every slide a clear visual anchor and a layout purpose distinct from adjacent slides.
- Add at least three meaningful editable regions per slide using `data-slot`, `data-slot-type`, `data-slot-role`, and `data-content-hint`.
- Store all images and SVG files under `images/`; reference them from slides with `../images/...`.
- Keep default visible sample content in English unless the user requests another language.
- Keep template CSS and assets local. Do not add mandatory CDN dependencies or `slide-bridge.js` to template pages.
- Never use remote images, absolute local paths, empty image placeholders, fake URLs, lorem ipsum, or source-download-site text.
- When the source deck contains a reusable image or illustration, prefer it when it is high quality, visually relevant, safe, and actually improves the page. Ask before retaining ambiguous private dashboards, customer screenshots, personal photos, logos, QR codes, or other sensitive material; if rejected, record the replacement decision in `visual-spec.md`. Do not force an original asset into a layout that becomes worse because of it.

## Required tool sequence

Call the tools through Code Mode:

Each snippet runs in a fresh process, so nothing you compute survives into the next one. Print the whole catalog in the taxonomy snippet; there is no way to look up a group you skipped without paying for the call again.

```python
from sdk.tool import tool

catalog = tool.call("query_slide_template_taxonomy")
if not catalog.ok:
    raise SystemExit(catalog.content)
print(catalog.content)  # Already lists every active category code.

for group in catalog.data["groups"]:
    print(f"\n{group['code']}\t{group['zh']}")
    for tag in group["tags"]:
        print(f"{tag['code']}\t{tag['zh']}")
```

Then create the project in a second snippet. The example uses a PPTX reconstruction. For other sources, change `source.method` to `project-extract`, `html-import`, `image-rebuild`, or `brief-generator`, skip the prepare/review/select snippet, and still call `finalize_slide_template` after authoring. Every literal below is placeholder text from an unrelated deck: replace `category_code` and `tag_codes` with codes you actually read from the catalog above, and replace the labels, canvas, and slide plan with this source's values. If the tool rejects your `category_code`, the error lists the codes that are currently active; retry with the closest one instead of querying the catalog again.

```python
from sdk.tool import tool

created = tool.call("create_slide_template_project", {
    "template_id": "SLIDE-navy-quarterly-review",
    "category_code": "<one exact code printed under categories>",
    "tag_codes": [
        "purpose-quarterly-review",
        "style-business",
        "color-navy",
        "layout-dashboard",
        "mood-professional",
        "language-english"
    ],
    "label": {"zh_CN": "深蓝经营复盘", "en_US": "Navy Business Review"},
    "description": {"zh_CN": "适合经营复盘和指标分析。", "en_US": "A reusable template for operating reviews and metric analysis."},
    "source": {
        "kind": "derived",
        "method": "visual-reconstruction",
        "file": "source-deck.pptx",
        "canvas": {"width": 1920, "height": 1080}
    },
    "slides": [
        {"file": "slides/cover.html", "title": "Business Review", "layout": "cover", "description": "Opening cover."}
    ]
})
if not created.ok:
    raise SystemExit(created.content)

print(created.data["template_directory"])
```

For an OOXML presentation file only, the required Code Mode sequence between project creation and authoring is:

```python
from sdk.tool import tool

template_dir = "<created.data['template_directory']>"

# Renders every page itself. Do not call convert_document_format first,
# and do not pass page_images for an OOXML presentation file.
prepared = tool.call("prepare_slide_template_source", {
    "template_dir": template_dir,
    "source_presentation": source_pptx_path,
    "reconstruction_mode": "hybrid"  # Use high-fidelity after a page-by-page intake.
})
if not prepared.ok:
    raise SystemExit(prepared.content)
print(prepared.content)

# Up to 6 pages per call, reviewed in parallel. Do not review one page at a time.
pending = prepared.data["recommended_review_indexes"]
for start in range(0, len(pending), 6):
    reviewed = tool.call("review_slide_template_source", {
        "template_dir": template_dir,
        "source_indexes": pending[start:start + 6]
    })
    if not reviewed.ok:
        raise SystemExit(reviewed.content)
    print(reviewed.content)

# Send 1-8 complete objects per call. Repeat until pending_count == 0.
# Do not pass catalog ids, catalog rows, or empty dicts.
selected = tool.call("select_slide_template_source_assets", {
    "template_dir": template_dir,
    "decisions": [
        {
            "asset": "asset-01",
            "decision": "reuse",
            "asset_type": "illustration",
            "quality": "high",
            "rationale": "Brand mascot used on cover and section dividers.",
            "target_name": "mascot.webp",
            "intended_role": "Cover visual anchor.",
        },
        {
            "asset": "asset-02",
            "decision": "discard",
            "asset_type": "photo",
            "quality": "poor",
            "rationale": "Low-resolution crop unused by the reconstructed layout.",
        },
    ],
})
if not selected.ok:
    raise SystemExit(selected.content)
print(selected.content)
```

Then author files under `template_dir` and finalize:

```python
finalized = tool.call("finalize_slide_template", {
    "template_dir": template_dir
})
if not finalized.ok:
    raise SystemExit(finalized.content)
print(finalized.content)
```

If that call fails or `previews/` is missing, the task is blocked. Tell the user the blocker and remaining steps. Do not say the template is complete. Do not skip this call because the source is not PPTX.

`prepare_slide_template_source` is only for OOXML files or optional `page_images`. It reads that source without modifying it and writes every render into the runtime directory. It never generates HTML. Read `prepared.data["canvas"]`, `prepared.data["recommended_review_indexes"]`, and `asset-01` style catalog ids. Do not read or write the hidden working directory. Do not call it on a Super Magic project, HTML folder, or text brief.

If a dedicated source tool fails, print `result.content`, fix the arguments, and retry the same tool. Do not copy converter images into the template directory and do not hand-write a replacement manifest.

`finalize_slide_template` does not create a ZIP or upload files. Its `template-assets.json` records the validated `category_code` and `tag_codes`, local thumbnail, collage, page previews, cleanup result, a complete `SaveSlidesTemplateRequest`-compatible field set, and the fields that still require a separate upload/publish workflow. Local preview paths are not file keys; the publish workflow fills the `*_file_key` values after uploading the corresponding files.

## Tool Guidance

- Call `query_slide_template_taxonomy` once and print every group's tags in that same snippet. Pick exact codes by the source's audience, purpose, and visuals. Do not substring-search names such as 封面 or AI. Then call `create_slide_template_project`.
- Do not convert, export, or render an OOXML presentation file yourself. `prepare_slide_template_source` renders those pages into the runtime directory, so `convert_document_format`, `export_document_markdown`, and `document-converter-output/` have no place in this workflow. Other document-converter tasks outside template making keep their normal workspace output.
- Do not replace `review_slide_template_source` with hand-written `source-analysis.json`, and do not run `visual_understanding` over the source pages yourself. The review tool already sends the full page plus detail crops with the measured background as ground truth, so a separate pass costs the same tokens and produces weaker, unrecorded results.
- Use `visual_understanding` for standalone images, screenshots, and generated `previews/slides/` files.
- Call `visual_understanding_webpage` and `analysis_slide_webpage` only through `run_sdk_snippet` with `sdk.tool.call(...)`; they are not directly mounted on the slide agent.
- Use `visual_understanding_webpage` through that Code Mode path to inspect source HTML before finalization. Pass the declared canvas as `viewport_width` and `viewport_height`, with `device_scale_factor: 1`.
- Use `analysis_slide_webpage` through that Code Mode path for declared-canvas overflow, clipping, scrollbar, and broken-image checks. It is Code Mode only; read [its contract](references/webpage-layout-analysis.md) for parameters, pagination, results, and failures. The tool uses `max_width` and `max_height` as its Browser viewport.
- After `finalize_slide_template`, use `visual_understanding` on the generated files under `previews/slides/`. These images are the authoritative visual evidence because they are the exact preview artifacts that will be published. If finalize was skipped, failed, or `previews/` is missing, stop and use the Blocked Report. Do not say the template is complete.
- Do not install Playwright or Chromium from the Agent. Template finalization uses the configured Super Magic Browser backend automatically.
- Use `generate_images` only for neutral, non-sensitive visual assets when the source does not provide enough usable imagery.
- Use `ask_user` for the Intake Checkpoint, later sensitive-asset confirms, intentional template updates, and an occupied user-provided target. Do not ask questions the user already answered.

For webpage visual QA, call the tools in `run_sdk_snippet` like this:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

canvas_width = 1920  # Read source.canvas.width from template.json.
canvas_height = 1080  # Read source.canvas.height from template.json.
visual_result = tool.call("visual_understanding_webpage", {
    "target": "<semantic-template-name>/slides/cover.html",
    "query": "Review visual hierarchy, readability, composition, canvas usage, and image quality.",
    "viewport_width": canvas_width,
    "viewport_height": canvas_height,
    "device_scale_factor": 1
})
if not visual_result.ok:
    raise SystemExit(visual_result.content)
print(visual_result.content)

layout_result = tool.call("analysis_slide_webpage", {
    "target": "<semantic-template-name>/slides/cover.html",
    "max_width": canvas_width,
    "max_height": canvas_height
})
if not layout_result.ok:
    raise SystemExit(layout_result.content)
print(layout_result.content)
""")
```

After finalization, visually inspect the exact generated preview instead of recapturing the webpage:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("visual_understanding", {
    "images": [
        "<semantic-template-name>/previews/slides/slide-001.png",
        "<rendered source page this slide derives from>"
    ],
    "query": (
        "The first image is the rebuilt slide, the second is its source page. "
        "Compare background color and tone, margins, alignment axis, title placement, "
        "type scale, and accent color, then list every mismatch. Also review hierarchy, "
        "readability, canvas usage, and image quality."
    )
})
if not result.ok:
    raise SystemExit(result.content)
print(result.content)
""")
```

## Completion Gate

Do not report completion until every item below is true. Authored HTML/CSS, a `template.json`, or a directory name is not completion.

- `finalize_slide_template` was called and returned `result.ok`.
- `template.json` validates against `references/template-json.schema.json`.
- `category_code` and every `tag_codes` value exist in the live taxonomy catalog, describe this template semantically, and `tag_codes` is non-empty.
- When `source.method` is `visual-reconstruction`, every extracted source asset has a completed `reuse` or `discard` decision. Only selected assets that are actually referenced by final HTML/CSS may remain under `images/source-assets/`.
- Every indexed slide exists, loads `../theme.css`, and resolves local assets.
- Every indexed slide has exactly one `main.slide-container` root, and its `data-width`/`data-height` values match `template.json.source.canvas`.
- No legacy conversion residue or forbidden output file remains.
- `previews/` exists with `thumbnail.png`, `collage.png`, and one `previews/slides/` image per indexed slide. Spot-check cover, dense-content, data/process, and closing pages against the source. If warnings list unreviewed source pages or unreviewed background variants, inspect those previews first.
- When `source.method` is `visual-reconstruction`, every background scheme reported by `prepare_slide_template_source` appears in the finished template, each on the pages that correspond to the source. A deck whose previews are all one tone while the source mixed tones fails this gate. Other source types still need a recorded surface inventory, measured from the source you actually have.
- `theme.css` defines a surface class per background scheme, and every slide root carries one.
- Body text measures at least 1.8% of canvas height, and page margins match the reviewed source geometry rather than a default centered layout.
- The template has a coherent design system and meaningful layout diversity, not only structurally valid files.

## Blocked Report

If a required tool fails, a required step is skipped, or a gate item is missing after retries, the task is blocked. Tell the user it is incomplete. Do not say the template is complete, ready, or finished.

Write the report in the user's language and include:

- `status: blocked`
- The blocker: tool name, error from `result.content`, or the missing artifact
- Remaining steps that were not executed
- What already exists so the user can continue

Example: `finalize_slide_template` was not called or failed, so `previews/` was never captured. Say that screenshots, thumbnail, and collage were not generated, and that finalization is still required. Do not present the authored slides as a finished template.

False blocker: the source is a Super Magic HTML project, an image, or a text brief, so finalize cannot run and previews cannot be generated. That is wrong. Call `finalize_slide_template` after authoring. It renders the authored HTML and does not require PPTX or source analysis.
