"""Constants for structured document parsing."""

from __future__ import annotations

PDF_EXTENSIONS = {".pdf"}
WORD_EXTENSIONS = {".doc", ".docx"}
POWERPOINT_EXTENSIONS = {".ppt", ".pptx"}
SPREADSHEET_EXTENSIONS = {".xls", ".xlsx", ".csv"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp"}
NOTEBOOK_EXTENSIONS = {".ipynb"}
HTML_EXTENSIONS = {".html", ".htm"}
MARKDOWN_EXTENSIONS = {".md", ".markdown"}
TEXT_EXTENSIONS = {
    ".txt", ".py", ".js", ".ts", ".java", ".cpp", ".c", ".go", ".rs",
    ".php", ".rb", ".css", ".xml", ".json", ".yaml", ".yml", ".toml",
    ".conf", ".properties", ".ini", ".cfg", ".log", ".sh", ".bat",
}

SUPPORTED_EXTENSIONS = (
    PDF_EXTENSIONS
    | WORD_EXTENSIONS
    | POWERPOINT_EXTENSIONS
    | SPREADSHEET_EXTENSIONS
    | IMAGE_EXTENSIONS
    | NOTEBOOK_EXTENSIONS
    | HTML_EXTENSIONS
    | MARKDOWN_EXTENSIONS
    | TEXT_EXTENSIONS
)

DEFAULT_CHUNK_MAX_CHARS = 12000
DEFAULT_VIRTUAL_PAGE_GROUP_SIZE = 10
DEFAULT_VISUAL_MAX_PAGES = 10
INDEX_FILENAME = "document.index.json"
OUTLINE_FILENAME = "document.outline.md"
SUMMARY_FILENAME = "document.summary.md"
CHUNKS_DIRNAME = "chunks"
ASSETS_DIRNAME = "assets"
VISUAL_RESULTS_DIRNAME = "visual-results"
