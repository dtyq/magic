---
name: document-converter
description: Use for reading, summarizing, analyzing, or converting large or complex documents without loading the whole file at once.
---

# Document Converter Workflow

Use this workflow when the user asks to read, summarize, analyze, or convert a large or complex document.

Do not start by converting the entire file into one large Markdown document. First build a lightweight understanding of the document, sample a few representative units, then decide how to read the rest.

## Default Approach

1. Inspect the document first: identify its type, size, structure, outline, and representative samples.
2. If the file is small, export it directly as one readable Markdown file.
3. If the file is large, sample a few representative units before choosing a full reading strategy.
4. Plan the next read from the sample result and the user's goal.
5. Extract or understand only the selected ranges into reusable Markdown artifacts.
6. Read `document.reading_state.json` between large-document steps to avoid rereading the same content.
7. For summaries, summarize smaller chunks first, then combine them into section-level and document-level summaries.
8. Only perform format conversion when the user explicitly asks for a converted file or when conversion is necessary for extraction.

## Large Document Rules

- Do not read or convert a large document all at once unless the user explicitly requires a full export.
- Always sample first for large files, then choose the next batch from the sample result.
- Use the outline, samples, and `document.reading_state.json` to decide what to read next.
- Prefer text extraction for ordinary document body content.
- Do not use one strategy blindly for the whole file. If the sample shows extractable text, read text ranges. If the sample is image-dominant or scanned, understand document images in batches.
- Do not call the generic visual understanding tool directly for document parsing. Use `understand_document_images` so results are saved and written back to chunks.
- When image understanding is used, process at most 10 images per call. Results must stay under the same source document output directory in `visual-results/` and be written back to the related chunk.
- Before starting a large visual-understanding workload, call `ask_user` to ask whether the user wants to continue because it may take a long time. This applies when many batches are needed, such as scanned PDFs or slide decks with many image-only pages.
- Do not call `ask_user` for small visual reads, such as a document with only a few pages or a single batch of up to 10 images that is clearly needed for the user's request.
- For spreadsheets, inspect sheets, headers, sample rows, and table size before extracting data.
- For slide decks, treat each slide as a natural unit.
- For Word-like documents, follow the heading structure when available.
- For notebooks, preserve cell order and cell type.

## Small Document Rules

- Small files can use `export_document_markdown` directly with the default `artifact_mode: "auto"`.
- For small files, prefer the simple output structure: `document.md`, plus `assets/` or `visual-results/` only when needed.
- Do not create samples, chunks, indexes, or reading state just to read a small file.
- A PDF, Word file, PowerPoint file, or image set with 10 or fewer pages/slides/images is usually small.
- If a PDF, Word file, PowerPoint file, or image set has more than 10 pages/slides/images, do not force `artifact_mode: "simple"`. The tool will reject simple mode for these files; use progressive mode or targeted extraction.
- Text, Markdown, and HTML files are small when they fit comfortably within one normal chunk.
- Small scanned files can be extracted and visually understood directly when needed; do not call `ask_user` unless many visual-understanding batches are required.
- Use `artifact_mode: "progressive"` only when the user wants the large-document workflow or when the file is small but structurally complex enough to need navigation state.

## When The User Wants A Summary

For a large document summary, do not send all extracted text into the model at once.

Use this sequence:

1. Inspect the structure.
2. Sample representative pages, slides, sheets, or sections.
3. Plan the next read from the sample and the user's goal.
4. Extract relevant chunks, or understand image pages in batches when the document is scanned.
5. Summarize each chunk.
6. Merge chunk summaries into section summaries.
7. Merge section summaries into a final answer.

## Code Mode Use

Use Code Mode as the execution path for this workflow. Keep the user-facing response focused on what was inspected, what was extracted, where the readable result is, and what can be done next. Do not expose internal class names, package paths, implementation details, or raw metadata unless the user asks for debugging details.

Use `sdk.tool.call(...)` from Code Mode. Always check `result.ok` before using the result.

All path parameters passed to these tools must be absolute paths.

For the same source document, reuse one stable `output_dir` across all document-converter tool calls. Keep `document.index.json`, `document.outline.md`, `document.reading_state.json`, `samples/`, `chunks/`, `visual-results/`, summaries, converted files, and combined Markdown exports under that same directory unless the user explicitly asks for a different location.

When the user does not provide an output directory, create one under the current workspace output area and derive the directory name from the current full file name, including the extension. For example, use `sample_pdf` for `sample.pdf`, `sample_docx` for `sample.docx`, and `README_md` for `README.md`. Do not use only the file stem in batch jobs, because files such as `sample.pdf`, `sample.docx`, and `sample.png` would otherwise overwrite or mix artifacts in the same `sample/` directory.

Before writing to an existing `output_dir`, make sure it belongs to the same source file. If unsure, choose a fresh unique directory instead of reusing a possibly polluted directory.

## Reuse Existing Parsed Artifacts

When starting a new topic or when the current context does not show whether a document has already been parsed, do not immediately re-run extraction. If the source file still exists, first look for an existing output directory that matches the current full file name, such as `document-converter-output/sample_pdf/` for `sample.pdf`.

Reuse existing artifacts when all of these are true:

- `document.index.json` exists.
- `document.outline.md` exists.
- `chunks/` exists and contains Markdown chunk files.
- The `source_path` in `document.index.json` points to the same source document.
- The source document has not changed since the index was created, when timestamps or stored metadata are available.

If valid parsed artifacts already exist, read `document.reading_state.json` when present, then read `document.outline.md` and `document.index.json`. Read only the needed chunk files or call `summarize_document` on that `output_dir`. Do not re-run `export_document_markdown` or `extract_document_content` just to rediscover content that is already available.

If only `samples/` and `document.reading_state.json` exist, treat the document as sampled but not fully extracted. Use `plan_document_reading` to choose the next bounded extraction or image-understanding step.

Re-run extraction only when artifacts are missing, incomplete, point to a different source file, appear stale, do not cover the needed range, or the user explicitly asks to regenerate the Markdown.

## Batch Conversion Rules

- Process every file requested by the user. Do not invent a local supported-extension whitelist.
- Prefer calling `inspect_document` or `export_document_markdown` and record the returned error when a file is unsupported.
- Do not skip images, CSS, logs, configuration files, code files, or small text-like files just because they look different from office documents.
- Keep the source directory clean. Write reports, summaries, indexes, chunks, and combined Markdown files under the chosen output root, not inside the input directory.
- Use a unique output directory for each input file. The directory name should include the original extension as described above.
- For batch reports, record one row per file with `input_path`, `output_dir`, `ok`, `file_type`, `index_path`, `combined_path`, and `error` when present.
- Count success from actual tool results and output files, not from the planned file list.

## Tools

### `inspect_document`

Use this first for any large or complex document. It performs a lightweight inspection and returns the document type, scale, structure unit, outline, samples, and recommended strategy.

Parameters:

- `input_path` (required): absolute path to the source document.

Do not use this tool to read full content or create Markdown chunks.

### `sample_document_content`

Use this after inspection for large or complex documents. It writes a small Markdown sample under `samples/` and updates `document.reading_state.json`. Use the sample to decide whether the rest should be read as text, spreadsheet ranges, slides, or document images.

Parameters:

- `input_path` (required): absolute path to the source document.
- `output_dir` (required): absolute path to the stable output directory for this source document.
- `strategy` (optional): sampling strategy. Use `auto` unless the user asked for specific pages or sections.
- `ranges` (optional): range expression such as `1-3,8`.
- `max_units` (optional): maximum sampled units. Use the default for first pass.
- `include_images` (optional): whether image links should be included when supported. This does not run visual understanding.

Do not treat a sample as the final extraction.

### `plan_document_reading`

Use this after sampling or partial extraction to decide the next bounded read.

Parameters:

- `output_dir` (required): absolute path to the stable output directory containing document-converter artifacts.
- `goal` (optional): current user goal, such as summary, clause lookup, or extracting decisions.
- `budget` (optional): reading budget such as `20 pages` or `10 images`.

This tool only recommends the next action. It does not extract or summarize content.

### `build_document_index`

Use this after inspection or sampling when you need a stable navigation map before extracting detailed content. It creates `document.index.json` and `document.outline.md`.

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
- `mode` (optional): extraction mode. Use `local_text` for ordinary PDF body text and `auto` when no specific mode is needed. Use `visual` only after reading the outline/chunks and confirming that selected scanned or visually complex PDF pages are necessary; visual results must be stored as files.
- `max_chars` (optional): maximum characters per chunk. Use the default unless the user needs smaller or larger chunk files.
- `extract_images` (optional): whether image assets should be extracted when supported.
- `exclude_watermark_images` (optional): whether high-confidence watermark images should be skipped. Keep the default unless the user explicitly needs every raw image.
- `deduplicate_repeated_images` (optional): whether repeated identical images, such as logos on every page, should be kept only once. Keep the default for normal reading/export tasks.

Do not use this as a blind whole-file converter unless the user explicitly requires a full export.

### `understand_document_images`

Use this when extracted chunks show image-only pages, scans, charts, signatures, stamps, or other visual content needed for the user's goal. It understands document image assets and writes the result back into the related chunk.

This tool requires `document.index.json` and image assets under the same `output_dir`. If the document has only been sampled, first call `extract_document_content` for the selected range with image extraction enabled, then call this tool.

Parameters:

- `output_dir` (required): absolute path to the stable output directory containing `document.index.json`.
- `images` (optional): absolute image paths to process. At most 10 images per call.
- `ranges` (optional): page or slide range whose images should be processed, such as `1-10`.
- `chunk_ids` (optional): chunk ids whose images should be processed.
- `query` (optional): visual understanding instruction. Leave empty for normal document-image-to-Markdown reading.
- `write_mode` (optional): use the default unless there is a specific reason.
- `max_images` (optional): maximum images for this call. Never exceed 10.
- `concurrency` (optional): internal concurrency. Use the default unless the environment is constrained.
- `force` (optional): whether to reprocess images that already have results.

Use this instead of the generic visual understanding tool when parsing document images.

### `export_document_markdown`

Use this for the common request "convert this document to Markdown." For large files, inspect and sample first, then choose the export mode and range. It extracts the requested range, writes bounded chunk files, updates the index and outline, and can write a combined Markdown file for user download.

Parameters:

- `input_path` (required): absolute path to the source document.
- `output_dir` (required): absolute path to the directory where Markdown export artifacts should be written.
- `ranges` (optional): range expression to export. Omit it when the user explicitly wants the whole document.
- `mode` (optional): extraction mode. Use `local_text` for ordinary PDF body text. Use `visual` only for selected scanned or visually complex PDF pages after confirming visual recognition is needed; visual results must be stored as files.
- `max_chars` (optional): maximum characters per chunk.
- `combined_filename` (optional): file name for the combined Markdown output. Use an empty string to skip the combined file.
- `artifact_mode` (optional): output artifact mode. Use `auto` by default. Use `simple` only for flat small-file output and `progressive` for full index/chunk/reading-state output. Large files reject `simple`; when that happens, switch to progressive or targeted extraction.
- `exclude_watermark_images` (optional): whether high-confidence watermark images should be skipped. Keep the default unless the user explicitly needs every raw image.
- `deduplicate_repeated_images` (optional): whether repeated identical images, such as logos on every page, should be kept only once. Keep the default for normal reading/export tasks.

This tool is a convenience workflow for Markdown export, not a replacement for targeted extraction when the user only needs specific content.

In simple mode, the main artifact is `document.md`. Do not expect `chunks/`, `document.index.json`, `document.outline.md`, or `document.reading_state.json` to exist.

In batch exports, `output_dir` must be unique for each source file and should include the source file extension in the directory name.

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

### Sample and plan before reading a large document

```python
import re
from pathlib import Path
from sdk.tool import tool

def document_output_dir(output_root: str, input_path: str) -> str:
    path = Path(input_path)
    safe_name = re.sub(r"[^\w.-]+", "_", path.name, flags=re.UNICODE).strip("._")
    safe_name = safe_name.replace(".", "_") or "document"
    return str(Path(output_root) / safe_name)

doc = "/absolute/path/to/uploads/report.pdf"
out = document_output_dir("/absolute/path/to/document-output", doc)

profile = tool.call("inspect_document", {
    "input_path": doc,
})
if not profile.ok:
    raise SystemExit(profile.content)

sample = tool.call("sample_document_content", {
    "input_path": doc,
    "output_dir": out,
    "max_units": 5,
    "include_images": True,
})
if not sample.ok:
    raise SystemExit(sample.content)

plan = tool.call("plan_document_reading", {
    "output_dir": out,
    "goal": "summarize the document",
    "budget": "10 pages",
})
if not plan.ok:
    raise SystemExit(plan.content)

print(plan.content)
```

### Extract only the needed range

```python
from sdk.tool import tool

doc = "/absolute/path/to/uploads/report.pdf"
out = "/absolute/path/to/document-output/report_pdf"

result = tool.call("extract_document_content", {
    "input_path": doc,
    "output_dir": out,
    "ranges": "1-3,8,10-12",
    "mode": "local_text",
})
if not result.ok:
    raise SystemExit(result.content)

print(result.content)
```

Use `understand_document_images` for image-only pages after chunks and image assets exist. Use `mode: "visual"` only for selected PDF pages when this dedicated image workflow is not enough.

### Understand scanned or image-only pages

```python
from sdk.tool import tool

doc = "/absolute/path/to/uploads/report.pdf"
out = "/absolute/path/to/document-output/report_pdf"

extract = tool.call("extract_document_content", {
    "input_path": doc,
    "output_dir": out,
    "ranges": "1-10",
    "mode": "local_text",
    "extract_images": True,
})
if not extract.ok:
    raise SystemExit(extract.content)

result = tool.call("understand_document_images", {
    "output_dir": out,
    "ranges": "1-10",
    "max_images": 10,
})
if not result.ok:
    raise SystemExit(result.content)

print(result.content)
```

### Export a document to Markdown

```python
import re
from pathlib import Path
from sdk.tool import tool

def document_output_dir(output_root: str, input_path: str) -> str:
    path = Path(input_path)
    safe_name = re.sub(r"[^\w.-]+", "_", path.name, flags=re.UNICODE).strip("._")
    safe_name = safe_name.replace(".", "_") or "document"
    return str(Path(output_root) / safe_name)

doc = "/absolute/path/to/uploads/report.pdf"
out = document_output_dir("/absolute/path/to/document-output", doc)

export = tool.call("export_document_markdown", {
    "input_path": doc,
    "output_dir": out,
    "artifact_mode": "auto",
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
