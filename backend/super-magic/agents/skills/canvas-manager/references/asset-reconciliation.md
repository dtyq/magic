# Asset reconciliation

Load this reference only when the user reports a mismatch between the Canvas and local `images`/`videos` folders, or explicitly asks to restore canvas layers from local media. Ordinary generation failures, a single missing file, or a vague "fix the canvas" request do not trigger it.

## Controlled flow

1. Read-only comparison: reconcile Canvas details against the local media scope the user named.
2. Report clearly: what is missing, present, conflicting, or undecidable.
3. Only after the user explicitly asks to repair, import the unambiguous unregistered assets with `add_canvas_elements` using `source=imported` and the real supplied local `asset_path` (absolute paths may come from any local directory; relative paths must stay inside the workspace).
4. Do not delete, overwrite, auto-resolve name conflicts, or modify existing Content.
5. After import, query the new Elements to confirm actual state.
6. If the Canvas tools cannot complete the requested repair, use the controlled `magic.project.js` fallback below instead of claiming success or silently changing project files.

The repair must use real source files only. If the named `.tmp`, Workspace asset, or supplied local absolute path does not exist, is empty, or cannot be mapped to an exact local path, stop and report that there is no real asset to repair. Never create sample images, download substitutes, generate replacement media, copy files into `imports/`, or use shell commands such as `mkdir`/`cp` to manufacture a successful test. A successful import is proven only by querying the exact returned `element_id` and checking its Content, status, and canonical project-local media path.

## `magic.project.js` recovery fallback

Use this fallback only when all applicable Canvas tools have failed or cannot represent the requested repair, and the user has already explicitly requested the repair. Resolve the exact current Canvas project path first; never guess a project directory or edit a different project.

1. Preserve a backup or recoverable copy of the original `magic.project.js`, and check its current content before editing so a concurrent update is not overwritten.
2. Parse the JSONP assignment without splitting on the first `=`. Preserve the surrounding `window.magicProjectConfig = ...` wrapper and any unrelated top-level fields.
3. Read the `canvas` value. When it starts with `MAGICPROJECTDESIGNDATA://`, remove only that prefix, Base64-decode the payload, gzip-decompress it, and parse the UTF-8 JSON object. If the value is plain JSON instead, preserve that format and do not silently migrate it to the compressed format.
4. Apply the smallest repair to the decoded `canvas` object. Preserve `version`, `type`, `name`, `contents`, unknown Canvas fields, Content IDs, Connection fields, and all sidecar files unless the requested repair explicitly requires a related change. Do not migrate unsupported versions.
5. Serialize the repaired Canvas object as UTF-8 JSON, gzip-compress it, Base64-encode it, and restore the exact `MAGICPROJECTDESIGNDATA://` prefix. Put the result back into the original `canvas` field.
6. Write the complete JSONP file atomically, then re-read and decode it again. Verify the repaired fields, wrapper, project version, and that unrelated fields were preserved before reporting success.

This fallback is a persistence repair boundary, not a general file-editing capability. Never use it for ordinary Canvas creation, Content generation, Content selection, layout, or Connection changes that the business tools can perform.

This is not a dry-run/confirm tool; keep the read-only comparison, user confirmation, and explicit import as separate stages.
