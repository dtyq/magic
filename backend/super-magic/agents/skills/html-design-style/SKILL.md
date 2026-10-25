---
name: html-design-style
description: Apply a bundled DESIGN.md visual system to an existing HTML file while preserving its content and behavior.
---

# HTML Design Style

Use this skill when the user asks to change the visual style of an existing HTML file and provides a bundled `style_code`.

## Workflow

1. Validate the requested `style_code` format.
2. Fetch the matching `DESIGN.md` from Magic Service.
3. Inspect the current HTML structure, content, data flow, event handlers, forms, and responsive behavior.
4. Apply the design system to the current file.
5. Validate that content, data requests, permissions, event handling, and existing interactions remain available.
6. Save and report the validated result.

## Input

The request contains:

- `target_file`: the current HTML file mention and path.
- `style_code`: the identifier of the requested design system.
- `user_intent`: the user's requested visual direction, when provided.

## Fetching the design document

Design documents are owned by Magic Service. Do not expect a local copy under this skill directory.

Fetch the raw `DESIGN.md` with the `get_html_design_style_source` tool. It is a Code Mode
tool, so call it through `sdk.tool.call` in a `run_sdk_snippet` code snippet. Do not start a
separate `python` process for this.

```python
from sdk.tool import tool

result = tool.call("get_html_design_style_source", {"style_code": "apple"})
print(result.content)
```

On success `result.content` holds the complete `DESIGN.md` text after a one-line header with the
`style_code` and `sha256`. Read the whole document before editing; do not print only a prefix.

Rules:

- Resolve `style_code` only as a single identifier: lowercase ASCII letters, digits, dots, and hyphens, beginning with a letter or digit.
- Reject empty values, path separators, `..`, absolute paths, and any other malformed value before calling the tool.
- Use only the returned `content` as the design source of truth.
- Do not reconstruct the design system from a catalog, preview metadata, or prior knowledge.
- If `result.ok` is false, report the failure from `result.content` and leave the target file unchanged. Do not guess a fallback style.

## Modification rules

- Change only the visual style. Preserve the current page content and information hierarchy unless the user explicitly requests content changes.
- Preserve data loading, API calls, event handlers, forms, permissions, and navigation behavior.
- Apply the design system to colors, typography, spacing, layout, shapes, elevation, component states, and responsive behavior.
- Reuse existing local assets when possible. Do not replace working assets with remote resources without an explicit request.
- Keep the HTML file self-contained and compatible with the existing preview environment.
- Do not change `MagicAgentApi`, iframe bridge protocols, or unrelated project files.
- Treat the user's short prompt as a dispatch request. Apply every preservation and validation rule in this skill even when the prompt does not repeat them.
- Update the referenced HTML file through the standard workspace file flow so the change creates a new file version and keeps the previous version available for restore. Update the original file in place. Do not create a sibling copy or remove previous file versions.

## Failure behavior

If the style code is invalid, the design document cannot be fetched, the target file cannot be read, or the requested change cannot be validated, do not overwrite the target file. Explain the exact failure and leave the original file unchanged.

## Output

Report:

- the applied `style_code`;
- the modified file paths;
- the preserved behaviors that were checked;
- the validation result;
- any remaining visual or responsive risk.
