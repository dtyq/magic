---
name: file-bundle
description: Use when a user wants to download or package a collection of existing workspace files, including mixed images, documents, audio, video, code, or archives, or reports that a previously provided file bundle card cannot be used.
---

# File Bundle

Create a message card with `create_client_side_file_bundle` through Code Mode in `run_sdk_snippet`. The card lists the selected files and lets the user download them individually or package them into a ZIP in their browser. The tool does not create, upload, or download an archive itself. This card is currently supported only by the Web client; other clients may not display it or support its download controls.

## Choose the Right Capability

- Existing workspace files delivered to the user: use this skill.
- External HTTP/HTTPS resources downloaded into the workspace: use the `download` skill.
- A ZIP explicitly needed as a persistent project file for later sharing or processing: create that archive through the existing file workflow. Do not substitute a browser-only card.
- A single file: an ordinary file link is sufficient unless it belongs to the requested collection.

## Create a Card

First identify the exact files with the existing file-list or search tools. Include only the requested files; do not infer membership from a directory or previous attachments. Then run:

```python
from sdk.tool import tool

result = tool.call("create_client_side_file_bundle", {
    "title": "Project materials",
    "file_paths": [
        "images/scene.png",
        "documents/script.md",
        "audio/narration.wav",
    ],
})
print(result.content)
```

Read `result.content` and check `result.ok`. Use a collection title in the user's language. Normally, the successful card is the collection's delivery entry; do not also create a ZIP or manifest just to add a final-response link. Use the attachment fallback below when the user cannot use the card.

## Attachment Fallback

Prefer the card because Web packages the files when the user clicks, without storing a ZIP in the project. An ordinary ZIP attachment is stored as a project file; deleting it later may only soft-delete it and retain its object-storage usage until cleanup.

If the user reports that the card is missing, cannot be clicked, or cannot download, an unsupported client is one possible cause, not a confirmed diagnosis. Do not repeatedly provide the same card or require the user to switch to Web. Create a ZIP of the same selected files through the existing file workflow and deliver it as a normal downloadable attachment, using the current channel's delivery guidance when applicable. This is an accepted fallback despite its storage cost; do not silently omit unavailable members or expand the collection.

Fallback does not bypass file access, watermark, subscription, or agreement policies. An explicit permission or policy error must be resolved through the existing rules rather than repackaging to evade it. Report attachment readiness only after the ZIP is created and available; never claim the user has saved it.

## Parameters and Boundaries

- `title`: non-empty collection name, up to 160 characters, without path separators or control characters. The tool adds `.zip` if needed; source filenames are unchanged.
- `file_paths`: non-empty list of exact workspace-relative paths to ordinary files. Any file type is supported. Do not pass directories, wildcard patterns, URLs, sandbox absolute paths, personal files, or files from another project.
- Project identity comes from the tool context. Files must already be synchronized and have real MagicFS file IDs. Duplicate IDs are removed in first-occurrence order.
- One call accepts up to 200 paths by default; its complete message detail must fit within 256 KiB. Configured limits can differ. Oversized collections fail without omitting files; use smaller explicit collections.
- All references must resolve successfully. Cancellation or any invalid member prevents creation of an incomplete card.

## Result and Download Behavior

A successful result means the download card is ready. It does not mean that a ZIP exists, that the user clicked download, or that a file was saved to disk. State the actual result and let the user use the card.

`result.data` contains `title`, `archive_name`, `project_id`, `total_bytes`, and the complete `items` list. Each item has `file_id`, `relative_file_path`, `file_name`, and `file_size`. Read these fields only for precise programmatic follow-up; do not print the full manifest into model context when `content` is sufficient.

Members are fixed by ID. Downloading uses the latest accessible content for those IDs, not a historical snapshot. A deleted file recreated at the same path does not replace the original member. ZIP entries preserve relative folders; downloading one file saves that source file directly.

Permission is checked again when the user clicks. Images follow the existing quality, watermark, subscription, and agreement policies selected in the UI. Do not pass options to skip these policies or claim that watermark removal is available to every account.

Browser packaging has a capacity limit. If a member cannot be retrieved, no incomplete ZIP is saved. The user can retry, download an individual file, or request a smaller collection. Source files are not deleted, modified, or copied by this tool.

## Errors

- Missing or unsynchronized file: read the reported path and reason, correct the selection or wait for synchronization, then retry.
- Directory, symlink, or path outside the workspace: select the actual ordinary file inside the current project.
- Missing project context: run from the intended project topic.
- Oversized message: split the explicitly selected files into smaller named collections; do not silently truncate.
- Tool creation success followed by a download error: do not report archive creation or disk-save success. The card's click-time error is separate from the tool result.
