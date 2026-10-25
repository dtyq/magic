# Template JSON Specification

`template.json` is the only metadata entry point for a generated template.

## Required Shape

```json
{
  "schema_version": "1.0",
  "template_id": "SLIDE-navy-quarterly-review-A1B2C3",
  "category_code": "PPT-CATE-business-report",
  "tag_codes": [
    "purpose-quarterly-review",
    "style-business",
    "color-navy",
    "layout-dashboard",
    "mood-professional",
    "language-english"
  ],
  "label": {
    "zh_CN": "深蓝季度经营复盘",
    "en_US": "Navy Quarterly Review"
  },
  "description": {
    "zh_CN": "适合经营复盘、指标分析和管理层决策的深蓝商务模板。",
    "en_US": "A navy business template for operating reviews, metric analysis, and executive decisions."
  },
  "files": {
    "visual_spec": "visual-spec.md",
    "theme_css": "theme.css",
    "slides_dir": "slides",
    "images_dir": "images"
  },
  "slides": [
    {
      "file": "slides/cover.html",
      "title": "Quarterly Business Review",
      "layout": "cover",
      "description": "Opening cover with a strong visual field, report title, period, and presenter metadata."
    }
  ],
  "source": {
    "kind": "derived",
    "method": "visual-reconstruction",
    "file": "source-deck.pptx",
    "canvas": { "width": 1920, "height": 1080 }
  },
  "warnings": []
}
```

## Rules

- `schema_version` is always `"1.0"`.
- `template_id` must match the backend rule `^SLIDE-[A-Za-z0-9]+(-[A-Za-z0-9]+)*$`. The create tool accepts a lowercase semantic base such as `SLIDE-navy-quarterly-review` and appends a six-character uppercase hexadecimal suffix such as `A1B2C3`.
- The local folder name is generated from the localized label selected by the language tag and does not include the random ID suffix. `language-chinese` produces a name such as `SLIDE-深蓝季度经营复盘`; `language-english` produces `SLIDE-navy-quarterly-review`. The folder name is not stored in `template.json`; use the returned `created.data["template_directory"]` instead of reconstructing the path. Existing templates whose folder is named by `template_id` remain valid.
- `category_code` is required and must be an active exact code from `query_slide_template_taxonomy`. Pick it by this template's audience and use case, not by filename or keyword match.
- `tag_codes` is a required non-empty array of unique exact codes from the same catalog. Pick them by visible purpose, style, color, layout, mood, and language as described in `template-taxonomy.md`. Never invent tags, substring-search names, or add `featured` automatically.
- Bilingual labels and descriptions are required and describe the reusable template, not the production process.
- `files.visual_spec`, `files.theme_css`, `files.slides_dir`, and `files.images_dir` are required.
- `slides` contains only `file`, `title`, `layout`, and `description`; array order is the default page order.
- English-context slide filenames use semantic lowercase kebab-case. Chinese-context templates may use Chinese semantic filenames such as `slides/封面.html`, `slides/目录.html`, and `slides/数据看板.html`. Keep `layout` as a stable lowercase kebab-case identifier in every language.
- `source.kind` is `original` or `derived` for newly generated templates.
- `source.method` is one of `manual`, `brief-generator`, `image-rebuild`, `html-import`, `visual-reconstruction`, or `project-extract`.
- `source.file` contains a source basename or an empty string, never an absolute path.
- `source.canvas` records the fixed source canvas in CSS pixels. Preserve the source aspect ratio; use `1920x1080` only when the source does not declare another size.

Do not write `name`, `template_dir`, `package_type`, `created_at`, `updated_at`, `taxonomy`, `review_status`, `copyright_notice`, `publish_options`, `files.package_zip`, `slides[].slots`, `slides[].source_slide`, `slides[].best_for`, or `slides[].risks`.
