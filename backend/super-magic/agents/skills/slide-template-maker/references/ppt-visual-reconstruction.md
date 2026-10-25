# Presentation Visual Reconstruction

Use this workflow only for PPTX, PPT, POTX, POT, PPSX, WPS presentation files, and presentation-template URLs. Do not use it for Super Magic HTML projects, HTML pages, screenshots, or text briefs. Those sources still create and finalize the same template project; they gather evidence through `project-template-workflow.md` or `input-workflows.md` instead.

## 1. Prepare Visual Evidence

Never call `convert_pptx_to_slide_template`, `pptx-to-html`, or a repository-specific PPTX template converter.

Do not render, convert, or export the deck yourself. `prepare_slide_template_source` renders every page and extracts embedded images in one call, writing all of it outside the workspace. Calling `convert_document_format` or `export_document_markdown` on the source duplicates that work and leaves intermediate files where they do not belong.

1. Call `prepare_slide_template_source` with `template_dir` and `source_presentation` after `create_slide_template_project`. Leave `page_images` out; it exists only for sources that are loose images rather than a presentation. Later tools only need `template_dir`.
2. It renders every page, then produces official full-page PNGs, overlapping crops, a contact sheet, PPTX structure, and public catalog ids such as `asset-01`. Keep this reference material out of `images/`, `slides/`, and `previews/` until `select_slide_template_source_assets` copies approved files.
3. Call `review_slide_template_source` for every index in `recommended_review_indexes`, up to 6 per call. Pages inside one call are reviewed in parallel, so send full batches. In `high-fidelity` the list is every page, because every page ships.
4. Call `select_slide_template_source_assets` with complete decision objects (asset, decision, asset_type, quality, rationale) until `pending_count` is `0`. Do not write `source-analysis.json` yourself and do not pass converter filenames, catalog rows, or id-only lists.
5. If rendering, extraction, or visual reading fails, report the exact failing tool call and stop instead of inventing the deck's appearance. If `prepare_slide_template_source` fails, retry it. Do not emulate source analysis with converter-extracted filenames or a hand-written manifest.

Rendering is allowed only to inspect the source. Rendered page images must never become final slide pages.

## 2. Analyze The Whole Deck

Analyze representative pages through `review_slide_template_source`. First capture overall rhythm, then inspect cover, dense, data, and closing pages more closely. Do not replace this review tool with generic `visual_understanding` calls against converter filenames.

Record internally:

- Source page count, actual use case, audience, and narrative.
- Visual thesis, palette roles, typography hierarchy, spacing, shape language, and image treatment.
- Repeated layouts, low-value pages, page-density risks, and reusable component families.
- Safe reusable assets and sensitive or unclear assets.
- Candidate scene, template ID, and semantic page inventory.

Do not infer the template direction from the source filename alone. If the user already chose page-by-page restoration or reusable extraction, follow that intake. If shape is still missing, ask before `create_slide_template_project`; the recommended default is `hybrid` with 8-15 reusable layouts. Use `high-fidelity` only after the user chooses to keep source pages. High-fidelity still authors semantic HTML; converter HTML and full-slide screenshots are never finished pages.

## 2.1 Map The Backgrounds Before Choosing Layouts

`prepare_slide_template_source` measures the dominant background of every rendered page and returns a background map: one entry per scheme, with a hex value, a light or dark tone, whether the fill is flat or image-backed, and the pages that use it. Read it before deciding the page inventory.

- Treat the map as the deck's tonal structure. A cover and section dividers on a dark field with light content pages between them is a design decision, not noise, and the template must reproduce that alternation.
- `recommended_review_indexes` covers every scheme in `hybrid` and `template-abstraction`, and every page in `high-fidelity`. Review all of them. Every entry you skip becomes a page or a scheme you invent.
- When a scheme is reported as textured or image-backed, the border samples were not uniform: expect a gradient, a split field, a photo, or a full-bleed pattern. Read the reviewed page for how it is constructed, then rebuild it with CSS gradients, a split container, or a retained source asset.
- Record the map in `visual-spec.md` as the surface inventory, naming each surface and listing the layouts that use it. This is what keeps the template from collapsing to one background later.

## 2.2 Measure Geometry Instead Of Assuming It

`review_slide_template_source` reports composition as percentages of page width and height: margins, column count, title block position and width, content block boxes, the shared alignment axis, and density. It reports the type scale the same way, as a percentage of canvas height per role.

- Convert those percentages against the declared canvas and use the results. On a 1920x1080 canvas a 6% left margin is `115px`; do not substitute a round `80px` because it looks reasonable.
- Keep the source's alignment axis. Most business decks align every block to one left axis; recentering that content is the single most visible way a reconstruction stops looking like its source.
- Keep the reported column count and block proportions. A source page built as a 60/40 split must not become two equal cards.
- Keep the reported type scale ratios. Body text stays at or above 1.8% of canvas height, roughly `20px` at 1080, because browser-default sizes are unreadable at presentation scale.
- When the review output leaves a value unstated, read the page image again rather than guessing a default.

## 3. Fuse The Narrative

For reusable/`hybrid` templates, create 8-15 reusable layouts based on the source's full narrative. For `high-fidelity`, keep the source page count minus advertisements, watermarks, download-site pages, contact pages, QR pages, copyright pages, and redundant alternates:

- Merge repeated covers and transitions into one cover and one section divider.
- Merge repeated text pages into concept, detail, quote, or case layouts.
- Merge related data pages into a dashboard and a focused analysis page.
- Merge repeated image pages into gallery, moodboard, or portfolio layouts.
- Merge sequential steps into a process, framework, timeline, or roadmap.
- Remove advertisements, watermarks, download-site pages, contact pages, QR pages, copyright pages, and redundant alternates.

For reusable/`hybrid` templates, do not copy every page, do not keep only the first ten pages, and do not add generic filler. For `high-fidelity`, keep useful source pages and still drop junk pages; do not paste converter HTML or full-slide screenshots.

## 4. Author A Clean Template

`create_slide_template_project` must already have created `<semantic-template-name>/` at the workspace root before conversion. Later tools only need `template_dir`. Do not use a converter draft as final source or add a `slide-templates/` prefix. After authoring, call `finalize_slide_template` so `previews/` and `template-assets.json` are generated beside the source files. Compare those previews with the source before reporting completion. If finalization fails or `previews/` is missing, report the blocker and remaining steps instead of saying the template is complete.

Author the files in this order:

1. `visual-spec.md`: the reusable design system, not a source summary. Include the surface inventory from the background map and the measured spacing and type scale.
2. `theme.css`: design tokens, one surface class per background scheme, typography scale, components, chart palette, and visual helpers.
3. `images/`: preserve safe original assets from `images/source-assets/` first; add semantic aliases or other local assets only when needed.
4. `slides/*.html`: new semantic HTML and page-specific CSS, each page carrying the surface class of the source page it derives from.
5. `template.json`: final metadata and semantic slide order.

### Surface System

Build the palette as background-and-foreground pairs so a page can change tone without any page rewriting its own colors. Every color inside a page reads from the active surface:

```css
:root {
  --accent: #e6b566;
  --radius: 4px;
  --type-title: 6.5%;
}

.surface-deep {
  --surface: #102a43;
  --on-surface: #f2f6fb;
  --on-surface-muted: #9fb3c8;
  --surface-border: #24405c;
  --surface-accent: #f0b429;
}

.surface-paper {
  --surface: #f7f8fa;
  --on-surface: #1f2933;
  --on-surface-muted: #5c6b7a;
  --surface-border: #d9e2ec;
  --surface-accent: #b57b12;
}

.slide-container {
  background: var(--surface);
  color: var(--on-surface);
}
```

Each slide root then declares which surface it uses:

```html
<main class="slide-container surface-deep" data-width="1920" data-height="1080">
```

Add a surface class for every scheme in the background map, including gradient and image-backed ones. Accent colors usually need a per-surface value because a hue that reads well on a dark field is often too light on paper.

For presentation-derived templates, write the source canvas detected from the presentation. For example:

```json
"source": {
  "kind": "derived",
  "method": "visual-reconstruction",
  "file": "source-deck.pptx",
  "canvas": { "width": 1920, "height": 1080 }
}
```

Keep `source.file` to the source basename. Never expose an absolute workspace path.

Do not replace a square or other source canvas with `1920x1080`; the dimensions may be normalized for authoring, but the aspect ratio must remain unchanged.

## 5. Asset Handling

- Prefer high-quality source bitmaps, illustrations, photos, textures, icons, or motifs when they materially preserve the source visual identity. `prepare_slide_template_source` keeps them as temporary candidates; `select_slide_template_source_assets` copies only approved assets into `images/source-assets/` using public ids such as `asset-01`. Do not retain every source image, and do not force an asset into the template when it is blurry, redundant, irrelevant, sensitive, or harms the layout.
- Preserve the extracted asset's original crop, focal point, transparency, aspect ratio, masking, and overlay treatment. A generated replacement is allowed only when the source asset is unavailable, unreadable, or explicitly rejected as sensitive.
- Deduplicate repeated assets by content identity.
- Normalize retained bitmap assets to WebP when practical and name them by role.
- Use CSS or SVG for charts, diagrams, icons, and small motifs.
- Do not keep full-slide screenshots, source-specific dashboards, real customer data, personal photos, QR codes, or proprietary UI without explicit confirmation.
- When the visual system requires imagery but the source cannot be reused safely, create neutral replacement assets instead of empty boxes.
- Every selected source asset must have a semantic target filename, an intended role, and an actual reference from final HTML or CSS. The final package must contain no unselected or unused source asset.

## 6. Reconstruction Gate

The result fails visual reconstruction if any of these remain:

- `slide-001.html`, `Converted Slide`, renderer class names, or source-tracing attributes.
- Full-slide screenshots used as page backgrounds to imitate the source.
- Absolute-positioned fragments copied from converter output without semantic reconstruction.
- Source filename, provider branding, download-site text, private metrics, or conversion notes in visible content.
- `source.kind: "converted"` or a converter method in newly generated metadata.

It also fails on fidelity, even when every structural check passes:

- The template uses one background while the background map reported several, or a page carries a tone the source never used there.
- `theme.css` hard-codes a single `body` or `.slide-container` background instead of surface classes, so tone cannot vary per page.
- Text sits on a background it has no contrast against, which is what happens when a light page is rebuilt on a dark surface.
- Margins, column counts, or alignment collapse into a generic centered layout that ignores the measured composition.
- Body text falls below 1.8% of canvas height, or the type scale flattens into one or two sizes.
- Accent color, corner radius, border weight, or the source's signature motif is dropped without a recorded reason.

Run the shared quality checks in `quality-guidelines.md` before reporting completion.
