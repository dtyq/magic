"""Constants for structured document parsing."""

from __future__ import annotations

PDF_EXTENSIONS = {".pdf"}
WORD_EXTENSIONS = {
    ".doc", ".docx", ".docm",
    ".dot", ".dotx", ".dotm",
    ".odt", ".rtf",
    ".wps", ".wpt",
}
POWERPOINT_EXTENSIONS = {
    ".ppt", ".pptx", ".pptm",
    ".pps", ".ppsx", ".ppsm",
    ".pot", ".potx", ".potm",
    ".odp",
    ".dps", ".dpt",
}
SPREADSHEET_EXTENSIONS = {
    ".xls", ".xlsx", ".xlsm", ".xlsb",
    ".xlt", ".xltx", ".xltm",
    ".ods",
    ".csv", ".tsv",
    ".et", ".ett",
}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tif", ".tiff", ".webp"}
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
DEFAULT_SUMMARY_CHUNK_MAX_CHARS = 1200
DEFAULT_VIRTUAL_PAGE_GROUP_SIZE = 10
DEFAULT_VISUAL_MAX_PAGES = 10
DEFAULT_SAMPLE_MAX_UNITS = 5
DEFAULT_SIMPLE_DOCUMENT_MAX_UNITS = 10
DEFAULT_IMAGE_UNDERSTANDING_MAX_IMAGES = 10
DEFAULT_IMAGE_UNDERSTANDING_CONCURRENCY = 5
DEFAULT_IMAGE_UNDERSTANDING_STAGGER_SECONDS = 0.2
INDEX_FILENAME = "document.index.json"
OUTLINE_FILENAME = "document.outline.md"
SUMMARY_FILENAME = "document.summary.md"
READING_STATE_FILENAME = "document.reading_state.json"
CHUNKS_DIRNAME = "chunks"
ASSETS_DIRNAME = "assets"
SAMPLES_DIRNAME = "samples"
VISUAL_RESULTS_DIRNAME = "visual-results"
