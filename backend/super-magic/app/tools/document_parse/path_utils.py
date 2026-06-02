"""Path validation helpers for document_parse Code Mode tools."""

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict

from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.utils.async_file_utils import async_exists, async_is_dir, async_is_file, async_iterdir
from app.utils.document_parse.file_signature import DocumentFileSignature
from app.utils.fuzzy_text_matcher import normalize_filename_for_match


@dataclass
class DocumentPathResolution:
    """Resolved document path plus optional model-facing correction note."""

    path: Path
    correction_note: str | None = None


def require_absolute_path(raw_path: str, field_name: str) -> tuple[Path | None, ToolResult | None]:
    """Return a Path only when the user supplied an absolute path."""
    path = Path(raw_path)
    if not path.is_absolute():
        return None, ToolResult.error(f"{field_name} must be an absolute path: {raw_path}")
    return path, None


async def require_existing_input_file(raw_path: str, field_name: str = "input_path") -> tuple[DocumentPathResolution | None, ToolResult | None]:
    """Resolve an existing absolute input file, correcting low-risk punctuation drift."""
    path, error = require_absolute_path(raw_path, field_name)
    if error:
        return None, error
    assert path is not None
    if await async_exists(path):
        if await async_is_dir(path):
            return None, ToolResult.error(f"Input path is a directory, not a file: {raw_path}")
        return DocumentPathResolution(path=path), None

    fuzzy = await _find_unique_normalized_sibling(path)
    if fuzzy:
        note = (
            "Path auto-correction applied.\n"
            f"- Input path: `{raw_path}`\n"
            f"- Resolved path: `{fuzzy}`\n"
            "- Reason: the file name differs only by punctuation or boundary-space normalization.\n"
            "Use the resolved path for future document-converter calls."
        )
        return DocumentPathResolution(path=fuzzy, correction_note=note), None
    return None, ToolResult.error(f"File does not exist: {raw_path}")


async def require_valid_input_file(raw_path: str, field_name: str = "input_path") -> tuple[DocumentPathResolution | None, ToolResult | None]:
    """Resolve an existing input file and reject obvious format/extension mismatches."""
    resolved, error = await require_existing_input_file(raw_path, field_name)
    if error or not resolved:
        return None, error
    mismatch = await DocumentFileSignature.validate(resolved.path)
    if mismatch:
        return None, ToolResult.error(mismatch)
    return resolved, None


async def require_existing_output_dir(raw_path: str, field_name: str = "output_dir") -> tuple[DocumentPathResolution | None, ToolResult | None]:
    """Resolve an existing absolute output directory for read-only document artifacts."""
    path, error = require_absolute_path(raw_path, field_name)
    if error:
        return None, error
    assert path is not None
    if await async_exists(path):
        if not await async_is_dir(path):
            return None, ToolResult.error(f"Output path is not a directory: {raw_path}")
        return DocumentPathResolution(path=path), None

    fuzzy = await _find_unique_normalized_sibling(path, require_file=False)
    if fuzzy:
        if not await async_is_dir(fuzzy):
            return None, ToolResult.error(f"Output path is not a directory: {raw_path}")
        note = (
            "Path auto-correction applied.\n"
            f"- Input path: `{raw_path}`\n"
            f"- Resolved path: `{fuzzy}`\n"
            "- Reason: the directory name differs only by punctuation or boundary-space normalization.\n"
            "Use the resolved path for future document-converter calls."
        )
        return DocumentPathResolution(path=fuzzy, correction_note=note), None
    return None, ToolResult.error(f"Output directory does not exist: {raw_path}")


async def _find_unique_normalized_sibling(path: Path, require_file: bool = True) -> Path | None:
    parent = path.parent
    if not await async_exists(parent) or not await async_is_dir(parent):
        return None
    wanted = normalize_filename_for_match(path.name)
    matches: list[Path] = []
    for item in await async_iterdir(parent):
        if normalize_filename_for_match(item.name) != wanted:
            continue
        if require_file and not await async_is_file(item):
            continue
        matches.append(item)
    return matches[0] if len(matches) == 1 else None


def prepend_correction_note(content: str, correction_note: str | None) -> str:
    """Attach a path correction note to tool content when fuzzy path resolution was used."""
    if not correction_note:
        return content
    return f"{correction_note}\n\n{content}"


def build_document_parse_after_remark(
    tool_name: str,
    action_key: str,
    message_prefix: str,
    result: ToolResult,
    file_name: str,
) -> dict:
    """Build consistent after-call UI remarks for document-converter tools.

    Failed document-converter calls must use a custom remark so the UI shows the
    concrete tool failure instead of the generic retry wording.
    """
    if not result.ok:
        result.use_custom_remark = True
    message_key = f"{message_prefix}.after_success" if result.ok else f"{message_prefix}.after_failed"
    return {
        "tool_name": tool_name,
        "action": i18n.translate(action_key, category="tool.actions"),
        "remark": i18n.translate(message_key, category="tool.messages", file_name=file_name),
    }


def build_document_parse_error_detail(
    tool_name: str,
    result: ToolResult,
    arguments: Dict[str, Any] | None = None,
) -> ToolDetail:
    """Build a visible after-call detail panel for failed document-converter tools."""
    args = arguments or {}
    display_args = {
        key: value
        for key, value in args.items()
        if key in {"input_path", "output_dir", "ranges", "target_format", "goal"} and value not in (None, "")
    }
    error_text = str(result.content or "Unknown document-converter tool error.")
    if len(error_text) > 4000:
        error_text = f"{error_text[:4000]}\n... (truncated)"

    lines = [
        f"# {i18n.translate('document_parse.detail_error_title', category='tool.messages')}",
        "",
        f"- {i18n.translate('document_parse.detail_error_tool', category='tool.messages')}: `{tool_name}`",
    ]
    if display_args:
        lines.extend([
            "",
            f"## {i18n.translate('document_parse.detail_error_inputs', category='tool.messages')}",
        ])
        lines.extend(f"- `{key}`: `{value}`" for key, value in display_args.items())
    lines.extend([
        "",
        f"## {i18n.translate('document_parse.detail_error_message', category='tool.messages')}",
        "",
        "~~~text",
        error_text,
        "~~~",
        "",
        i18n.translate("document_parse.detail_error_next_step", category="tool.messages"),
    ])
    return ToolDetail(
        type=DisplayType.MD,
        data=FileContent(file_name="document_converter_error.md", content="\n".join(lines)),
    )
