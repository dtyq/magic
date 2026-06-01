"""Path validation helpers for document_parse Code Mode tools."""

from pathlib import Path

from agentlang.tools.tool_result import ToolResult


def require_absolute_path(raw_path: str, field_name: str) -> tuple[Path | None, ToolResult | None]:
    """Return a Path only when the user supplied an absolute path."""
    path = Path(raw_path)
    if not path.is_absolute():
        return None, ToolResult.error(f"{field_name} must be an absolute path: {raw_path}")
    return path, None
