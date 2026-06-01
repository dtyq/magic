---
name: document-converter
description: Use for reading, summarizing, analyzing, or converting large or complex documents without loading the whole file at once.
---

# Document Converter Workflow

Use this workflow when the user asks to read, summarize, analyze, or convert a large or complex document.

Do not start by converting the entire file into one large Markdown document. First build a lightweight understanding of the document, then read only the parts needed for the user's goal.

## Default Approach

1. Inspect the document first: identify its type, size, structure, outline, and representative samples.
2. For large files, create a navigable outline before reading detailed content.
3. Choose a targeted range based on the user's question: pages, sections, slides, sheets, ranges, images, or notebook cells.
4. Extract only the selected parts into readable Markdown chunks.
5. For summaries, summarize smaller chunks first, then combine them into section-level and document-level summaries.
6. Only perform format conversion when the user explicitly asks for a converted file or when conversion is necessary for extraction.

## Large Document Rules

- Do not read or convert a large document all at once unless the user explicitly requires a full export.
- Use the outline and samples to decide what to read next.
- Prefer text extraction for ordinary document body content.
- Use visual understanding only for pages or images where layout, scans, charts, signatures, or visual details matter.
- For spreadsheets, inspect sheets, headers, sample rows, and table size before extracting data.
- For slide decks, treat each slide as a natural unit.
- For Word-like documents, follow the heading structure when available.
- For notebooks, preserve cell order and cell type.

## When The User Wants A Summary

For a large document summary, do not send all extracted text into the model at once.

Use this sequence:

1. Inspect the structure.
2. Read the outline and representative samples.
3. Extract relevant chunks, or extract all chunks in batches if a full summary is required.
4. Summarize each chunk.
5. Merge chunk summaries into section summaries.
6. Merge section summaries into a final answer.

## Code Mode Use

Use Code Mode as the execution path for this workflow. Keep the user-facing response focused on what was inspected, what was extracted, where the readable result is, and what can be done next. Do not expose internal class names, package paths, implementation details, or raw metadata unless the user asks for debugging details.

Use `sdk.tool.call(...)` from Code Mode. Always check `result.ok` before using the result.

All path parameters passed to these tools must be absolute paths.

For the same source document, reuse one stable `output_dir` across all document-converter tool calls. Keep `document.index.json`, `document.outline.md`, `chunks/`, summaries, converted files, and combined Markdown exports under that same directory unless the user explicitly asks for a different location.

## Tools

### `inspect_document`

Use this first for any large or complex document. It performs a lightweight inspection and returns the document type, scale, structure unit, outline, samples, and recommended strategy.

Parameters:

- `input_path` (required): absolute path to the source document.

Do not use this tool to read full content or create Markdown chunks.

### `build_document_index`

Use this after inspection when you need a stable navigation map before deciding what to extract. It creates `document.index.json` and `document.outline.md`.

Parameters:

- `input_path` (required): absolute path to the source document.
- `output_dir` (required): absolute path to the directory where index and outline files should be written.

Do not use this tool for content extraction or summarization.

### `extract_document_content`

Use this to read selected parts of a document into bounded Markdown chunks. Prefer targeted ranges over full-document extraction.

Parameters:

- `input_path` (required): absolute path to the source document.
- `output_dir` (required): absolute path to the directory where `chunks/`, `document.index.json`, and `document.outline.md` should be written.
- `ranges` (optional): range expression for the needed content, such as `1-3,8,10-12`. The range may refer to pages, slides, sections, sheets, or cells depending on file type.
- `mode` (optional): extraction mode. Use `local_text` for ordinary PDF body text, `visual` for selected scanned or visually complex PDF pages, and `auto` when no specific mode is needed.
- `max_chars` (optional): maximum characters per chunk. Use the default unless the user needs smaller or larger chunk files.
- `extract_images` (optional): whether image assets should be extracted when supported.

Do not use this as a blind whole-file converter unless the user explicitly requires a full export.

### `export_document_markdown`

Use this for the common request "convert this document to Markdown." It extracts the requested range, writes bounded chunk files, updates the index and outline, and can write a combined Markdown file for user download.

Parameters:

- `input_path` (required): absolute path to the source document.
- `output_dir` (required): absolute path to the directory where Markdown export artifacts should be written.
- `ranges` (optional): range expression to export. Omit it when the user explicitly wants the whole document.
- `mode` (optional): extraction mode. Use `local_text` for ordinary PDF body text and `visual` only for selected scanned or visually complex PDF pages.
- `max_chars` (optional): maximum characters per chunk.
- `combined_filename` (optional): file name for the combined Markdown output. Use an empty string to skip the combined file.

This tool is a convenience workflow for Markdown export, not a replacement for targeted extraction when the user only needs specific content.

### `summarize_document`

Use this after chunks already exist. It summarizes from `document.index.json` and `chunks/` instead of reading the original document again.

Parameters:

- `output_dir` (required): absolute path to the directory containing `document.index.json` and `chunks/`.
- `max_chunk_chars` (optional): maximum characters copied from each chunk into the summary draft.

Do not call this before extracting content.

### `convert_document_format`

Use this only when the user explicitly asks for a converted file or conversion is required before extraction. It only changes file format.

Parameters:

- `input_path` (required): absolute path to the source document.
- `output_dir` (required): absolute path to the directory for converted files.
- `target_format` (required): target format, such as `pdf`, `png`, `jpg`, `docx`, `pptx`, or `xlsx`.
- `ranges` (optional): page range for conversion tasks that support ranges, such as rendering selected PDF pages to images.

Do not use this tool for semantic extraction, chunking, indexing, or summarization.

## Code Mode Examples

### Inspect before extracting

```python
from sdk.tool import tool

doc = "/absolute/path/to/uploads/report.pdf"
out = "/absolute/path/to/document-output/report"

profile = tool.call("inspect_document", {
    "input_path": doc,
})
if not profile.ok:
    raise SystemExit(profile.content)

index = tool.call("build_document_index", {
    "input_path": doc,
    "output_dir": out,
})
if not index.ok:
    raise SystemExit(index.content)

print(index.content)
```

### Extract only the needed range

```python
from sdk.tool import tool

result = tool.call("extract_document_content", {
    "input_path": "/absolute/path/to/uploads/report.pdf",
    "output_dir": "/absolute/path/to/document-output/report",
    "ranges": "1-3,8,10-12",
    "mode": "local_text",
})
if not result.ok:
    raise SystemExit(result.content)

print(result.content)
```

Use `mode: "visual"` only for selected pages where layout, scans, charts, signatures, or visual details matter.

### Export a document to Markdown

```python
from sdk.tool import tool

export = tool.call("export_document_markdown", {
    "input_path": "/absolute/path/to/uploads/report.pdf",
    "output_dir": "/absolute/path/to/document-output/report",
    "mode": "local_text",
    "combined_filename": "report.md",
})
if not export.ok:
    raise SystemExit(export.content)

print(export.content)
```

### Summarize from the index and chunks

```python
from sdk.tool import tool

summary = tool.call("summarize_document", {
    "output_dir": "/absolute/path/to/document-output/report",
})
if not summary.ok:
    raise SystemExit(summary.content)

print(summary.content)
```

### Convert format only when conversion is the user's goal

```python
from sdk.tool import tool

converted = tool.call("convert_document_format", {
    "input_path": "/absolute/path/to/uploads/slides.pptx",
    "output_dir": "/absolute/path/to/document-output/slides",
    "target_format": "pdf",
})
if not converted.ok:
    raise SystemExit(converted.content)

print(converted.content)
```
