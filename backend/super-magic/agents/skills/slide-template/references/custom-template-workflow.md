# Custom Template Workflow

Use when the user describes a style in text, provides screenshots, or gives an existing PPT project.

1. Input:

- Existing project: use `list_dir`, then read 2-3 representative HTML pages.
- Screenshot: use `visual_understanding` to extract palette, background, font hierarchy, card/container style, decorative elements, and style keywords.
- Text: infer the same design spec from the user's words.

2. Before generating, read one built-in template spec as a quality benchmark, such as `<skill_dir>/assets/templates/monocle-editorial/visual-spec.md` or `<skill_dir>/assets/templates/ink-classic/visual-spec.md`. Match its depth and structure; do not generate a generic color-and-card stylesheet.
3. Extract a full design system: core concept, background/text/accent colors, gradients, borders, shadows, radius, font hierarchy, decorations, layout structure, component patterns, ECharts style, image search keywords, and image generation style keywords.
4. Ask the user for a template name, or suggest a lowercase hyphenated dir and short display name.
5. Generate a wrapper folder at the user's workspace root, for example `<workspace>/<new-dir>/`. Do not generate custom templates under `<skill_dir>/assets/templates/` or otherwise inside this skill's install tree.
6. Create exactly inside that folder:

- `visual-spec.md`
- `theme.css`
- `preview.html`

7. `visual-spec.md` must be a professional visual system specification, not a short style note. It must include these 8 sections:

- `1. Core Design Concept`: 3-5 specific design principles that define the style's visual thesis, spatial logic, and emotional tone.
- `2. Color Specification`: a complete CSS `:root` block with background, text, accent, border, and chart colors. Include `*-rgb` variables for colors that need opacity control, and annotate each variable's usage.
- `3. Typography Specification`: a table with at least 6 text levels, including font families, sizes using `clamp()` or fixed px values, weights, colors, and a required Google Fonts link.
- `4. Decorative Element Specification`: at least 4 template-specific decorative elements or components. Each must include representative HTML markup and CSS code, not only a description.
- `5. Dedicated Layout Page Types`: at least 6 layout types. For each layout, specify the background treatment, grid or absolute-position structure, main content zones, visual anchor, and suitable slide use cases.
- `6. Corner Radius and Shadow Specification`: a table listing radius and shadow/glow rules for major components, plus the design principle behind those choices.
- `7. ECharts Chart Specification`: a palette array, a reusable global config object, and complete options for at least line and bar charts. Add other chart types when the style needs them.
- `8. AI Image Generation Specification`: style keywords, an `image_search` keyword strategy table, 2-3 `generate_images` prompt examples, and clear notes on when to prefer real photos, illustrations, or no image.

8. `theme.css` must implement the generated visual system:

- Include `:root` variables, font stacks, chart colors, and reusable spacing/radius/shadow variables.
- Include the fixed canvas reset: `html,body,.slide-container{width:1920px;height:1080px}` with `overflow:hidden`.
- Implement the decorative elements/components from `visual-spec.md` section 4 as reusable CSS classes.
- Implement layout helpers and page-level variants needed by the dedicated layouts in section 5.
- Prefer distinctive template-specific classes over generic centered text/card styles.

9. `preview.html` must load `theme.css` and demonstrate the style:

- Show the full palette with color values and usage labels.
- Show at least 2 layout thumbnails or mini sections that reflect the dedicated layouts.
- Render the core decorative elements/components, not only list them.

10. Quality gate before using the custom template:

- The generated files should feel comparable in depth to built-in templates: strong concept, precise typography, distinct layout patterns, and reusable CSS components.
- Every slide created from this template should have one clear visual anchor, such as a large image area, chart, matrix, KPI block, signature decoration, or dramatic typography.
- If the generated template looks like a generic dashboard or simple card grid, rework `visual-spec.md` and `theme.css` before creating slides.

11. Read generated `visual-spec.md`, copy generated `theme.css` to the PPT project root, and continue the built-in template workflow from step 4 (slide HTML linking `theme.css`).
