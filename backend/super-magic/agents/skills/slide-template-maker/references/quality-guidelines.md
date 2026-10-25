# Template Quality Guidelines

Passing schema validation is necessary but not sufficient. A finished template must also be visually coherent, reusable, and presentation-ready.

## Visual Bar

1. Every slide has a clear visual anchor: image, chart, metric block, matrix, process, timeline, quote panel, strong typography, or a scene-specific motif.
2. The cover communicates the visual system immediately; title plus subtitle alone is insufficient.
3. The deck uses multiple layout families and at least three reusable component families.
4. Data pages contain readable sample values, legends, labels, and hierarchy.
5. Text-heavy pages use grouping, sidebars, highlights, numbered structures, or pull quotes.
6. Color roles, typography, spacing, radii, borders, shadows, icons, charts, and image treatment remain coherent.
7. Normal content pages intentionally use the declared source canvas. Accidental empty areas caused by changing the source ratio, tiny type, and scattered cards are failures.
8. Default content is realistic and editable. Do not use lorem ipsum, fake contact details, fake URLs, or gray placeholders.

## Source Fidelity Bar

Applies to every template derived from a presentation, image, screenshot, or HTML source. Structural validity does not imply the template resembles what the user gave you.

1. Each page carries the background tone of the source page it derives from, and the deck reproduces the source's light and dark alternation instead of one flat tone.
2. Every background scheme in the background map exists in the finished template, and no page uses a tone the source never used in that position.
3. `theme.css` defines a surface class per scheme with paired foreground, muted-text, border, and accent values. Every slide root carries one.
4. Text contrast holds on each surface. Nothing relies on a default color that only works on one tone.
5. Margins, alignment axis, column counts, and block proportions follow the measured composition rather than a centered default.
6. The type scale keeps the source's ratios, with body text at or above 1.8% of canvas height.
7. Accent color, corner radius, border weight, shadow depth, and the source's signature motifs survive, or their removal is recorded in `visual-spec.md`.

## Common Failure Modes

Check for these directly. Each one passes schema validation and still produces a template the user will reject.

| Failure | What it looks like | Prevention |
| --- | --- | --- |
| Flattened tone | The whole template is dark because the sampled pages were dark | Read the background map; review one page per scheme |
| Single hard-coded background | `body` or `.slide-container` sets one background color | Surface classes with paired foreground tokens |
| Invisible text | Light-page text kept its dark color on a dark surface | Read colors from the active surface only |
| Recentered layout | Everything centered while the source used one left axis | Apply the measured alignment axis and margins |
| Generic card grid | Every page becomes equal cards regardless of the source | Keep measured column counts and block proportions |
| Browser-default type | Text sized for a web page, unreadable at presentation scale | Derive px from percentage of canvas height |
| Flattened type scale | Only one or two sizes across the deck | Keep a role per reported typography entry |
| Lost motif | The source's rule lines, mascot, or texture silently disappear | Carry `must_preserve` items into the pages that need them |
| Ratio drift | A square or 4:3 source rebuilt at 16:9 with dead space | Keep `source.canvas` and its aspect ratio |
| Unreviewed sections | Pages 12-20 rebuilt from imagination | Clear every warning about unreviewed pages and variants |

## Scene Page Inventory

Use these as starting points for reusable/`hybrid` templates, then adapt to the source. High-fidelity templates follow the source page inventory minus junk pages.

| Scene | Recommended layouts |
| --- | --- |
| Business report | cover, agenda, executive summary, KPI dashboard, performance, risk, timeline, decision matrix, closing |
| Startup pitch | cover, problem, solution, product, market, business model, traction, go-to-market, team, funding ask |
| Product growth | cover, vision, user insight, funnel, roadmap, comparison, experiment, launch, dashboard |
| Sales marketing | cover, campaign, persona, message, channel, calendar, offer, enablement, performance |
| Education training | cover, goals, agenda, concept, example, activity, knowledge check, resources, recap |
| Academic research | cover, question, literature, methodology, experiment, results, discussion, limitations, conclusion |
| Technology engineering | cover, overview, architecture, workflow, pipeline, benchmark, roadmap, controls, closing |
| Government organization | cover, background, stakeholders, program, implementation, budget, impact, governance, next steps |
| Healthcare | cover, context, population, pathway, study design, outcomes, safety, implementation, closing |
| Culture creative | cover, concept, moodboard, portfolio, timeline, experience, visual system, campaign, closing |

## Assets And Safety

- Prefer a small number of high-impact local assets over decorative clutter.
- Use semantic filenames such as `hero-clinical-pathway.webp` and `texture-paper-grain.webp`.
- Deduplicate repeated images and resize them for their actual slide role.
- Never generate or retain fake logos, fake people, fake dashboards, QR codes, or proprietary UI.
- Recommend neutral replacement for ambiguous sensitive assets; retain originals only after explicit user confirmation.

## Structural Checks

Confirm:

- Every slide has one `main.slide-container` root with `data-width` and `data-height` attributes matching `template.json.source.canvas`. The root class and dimension attributes are part of the preview canvas protocol and must not be renamed or removed.
- Before finalization, all temporary material is confined to the returned working directory outside the workspace. After finalization, the template directory contains only the source files, `images/`, `slides/`, generated `previews/`, and `template-assets.json`.
- `template.json` validates against `template-json.schema.json`.
- `category_code` is an active exact taxonomy code, `tag_codes` is non-empty and unique, and `template-assets.json.backend_fields` carries the same values.
- Every slide index points to an existing file and every slide loads `../theme.css`.
- Each slide has at least three useful slot hints and no remote or absolute asset reference.
- Every slide root carries a surface class, and `theme.css` declares one class per background scheme in the background map.
- No forbidden metadata or legacy conversion residue remains.
- The temporary working directory, leftover `.template-work/`, reference renders, extracted candidates, contact sheets, downloaded source copies, and QA scratch files are absent from the completed template.

## Browser And Visual Checks

Invoke both webpage QA tools through `run_sdk_snippet` with `sdk.tool.call(...)`, following the Code Mode example in the main skill. Do not call them as standalone tools. Use the declared canvas as the Browser viewport and use `device_scale_factor: 1` for visual capture.

Use `analysis_slide_webpage` through that Code Mode path on all pages when practical, or at minimum on every high-risk page. Fix overflow, clipping, scrollbars, missing images, and aspect-ratio distortion.

Before finalization, use `visual_understanding_webpage` through that Code Mode path on representative pages. After finalization, inspect the matching generated files under `previews/slides/` with `visual_understanding`; those generated images are the authoritative evidence for the final result.

Visually inspect at least:

- Cover.
- Densest content page.
- Data, process, or comparison page.
- Image-led page.
- Closing page.
- One page from every background scheme in the background map.

Review hierarchy, readability, composition, canvas usage, image quality, and layout repetition. If a sampled page fails, improve it and re-run the relevant checks.

For a source-derived template, pass two images in the same `visual_understanding` call: the generated preview and the rendered source page it derives from. Ask for a mismatch list covering background color and tone, margins, alignment axis, title placement, type scale, and accent color. A single-image review reliably misses tone and geometry drift, because a page can look internally consistent while no longer matching its source.

Before reporting completion, check the tone sequence directly. Read the background tone of the generated previews in order and compare that sequence with the background map. If the source alternated tones and the previews do not, the template failed regardless of what the per-page reviews said.

## Completion Report

Use `status: complete` only when every Completion Gate item in the skill passed, including generated `previews/thumbnail.png`, `previews/collage.png`, and one preview per indexed slide. This report is required for every source type. Missing previews is never explained away as "the source was not PPTX".

```text
status: complete
source_path:
input_type:
output_dir:
template_id:
category_code:
label.zh_CN:
slide_count:
routing_reason:
visual_reconstruction_summary:
background_schemes:
slide_inventory:
removed_or_replaced_sensitive_assets:
validation:
quality_pass:
remaining_limitations:
```

If any required step failed or was skipped, use `status: blocked`. Do not say the template is complete, ready, or finished. HTML/CSS in the folder is not enough.

```text
status: blocked
blocker:
missing_steps:
existing_artifacts:
```

Name the failed or skipped tool, quote `result.content` when a tool failed, and list remaining work. If `finalize_slide_template` was not called or failed, say that `previews/` was not captured and that thumbnail, collage, and page screenshots still need to be generated.
