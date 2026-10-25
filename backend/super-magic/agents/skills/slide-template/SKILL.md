---
name: slide-template
description: "Browse, select, install, inspect, and apply existing platform slide templates for new presentations. Use when the user wants template options, provides an exact template code, asks to use an installed template for a new presentation, or needs guidance applying a template package. For changing the template of an existing HTML slide project or a specific slide, load slide-template-replacement. Do not use for creating, converting, extracting, or updating templates; load slide-template-maker for those tasks."
---

# Slide Template

Use existing platform templates to create presentations. This skill does not create or modify template packages.

For an existing HTML slide project that needs its template changed, load `slide-template-replacement` instead. That skill owns the whole-deck and single-slide replacement workflows.

## Responsibility Boundary

Load `slide-template-maker` instead when the user asks to:

- Create a template from a style brief, image, screenshot, or HTML source.
- Convert or visually reconstruct a template from PPTX, PPT, POTX, POT, or PPSX.
- Extract a template from an existing Super Magic slide project.
- Update, repair, sanitize, or improve an existing template source directory.

Never call `convert_pptx_to_slide_template` from this skill.

## Template Source

- Platform templates are external resources identified by an exact template `code`.
- The code must come from a platform-provided list, user selection, user-provided value, or explicit upstream context.
- Do not invent codes, rewrite casing, list legacy local template folders, or copy files from this skill directory.

## Selection Decision

- Exact template code: install and inspect that package.
- Candidate list available but nothing selected: recommend 3-5 suitable options through `ask_user`; include name, short description, exact code, and a no-template option.
- No code or candidate list: ask the user to select from the platform template UI, provide a code, or confirm no template.
- Concrete style brief but no existing template selection: load `slide-template-maker`; do not generate a custom template inside this skill.

## Install And Inspect

Call `install_slides_template` through Code Mode:

```python
from sdk.tool import tool

result = tool.call("install_slides_template", {
    "code": template_code
})

installed_directory = result.data["installed_directory"]
```

After installation:

1. Read `template.json` first.
2. Resolve resources only from `template.json.files` and `template.json.slides`.
3. Read `theme.css` when present.
4. Read `visual-spec.md` when present.
5. Read representative semantic slide HTML files and only the assets needed by selected pages.
6. Copy required CSS, pages, fonts, images, SVG files, chart data, and local runtime files into the target presentation project. Never reference the temporary installed directory from generated slides.

## Application Modes

### Semantic Page-Master Mode

Use page-master-preserving edits when either signal is present:

- New format: `source.kind` is `derived` and `source.method` is `visual-reconstruction` or `project-extract`.
- Legacy compatibility: `source.kind` is `converted` and `source.file` has a presentation-family extension, or package documentation explicitly identifies it as PPT-derived.

For these templates:

- Treat `slides/*.html` as concrete reusable page masters.
- Choose pages using `layout`, `title`, `description`, actual HTML structure, slot hints, asset dependencies, and previews when available.
- Copy the closest source page before editing.
- Replace mapped text slots first; replace content images or chart data only when required.
- Preserve DOM structure, page CSS, visual anchors, backgrounds, decorations, SVG shapes, typography hierarchy, palette, and absolute positioning unless broken or unsafe.
- Keep all required local dependencies together with the copied page.

### Component-System Mode

Use this for ordinary templates that are not page-master-derived:

- Load `creating-slides` after reading the package.
- Follow the installed palette, typography, components, layout patterns, chart colors, image rules, and decorations.
- Use slot hints when available, but compose a new page from the template's own system when no page master fits.
- Do not fall back to an unrelated generic business style.

## Image Rules

- Inspect template assets before searching or generating images.
- Reuse template-provided backgrounds, motifs, illustrations, and placeholders when suitable.
- Use image search only for factual people, products, places, screenshots, brands, or other exact visuals the template cannot provide.
- Use image generation only for creative or abstract supporting visuals.
- Never stylize factual photos, real people, real places, products, screenshots, brand marks, QR codes, or data graphics.
- If a page does not need an image, use a chart, matrix, metric, process, color field, or template-specific decoration as its visual anchor.

## Safety And Output

- Applying a template does not bypass sensitive-asset checks. Do not copy unconfirmed logos, real people, internal screenshots, QR codes, customer visuals, private dashboards, or proprietary UI into a new deck.
- Generated presentation pages must use project-local CSS and assets.
- Keep every slide fixed at 1920x1080 with no responsive layout.
- Do not paste raw template HTML into the conversation.
