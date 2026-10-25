"""启动任务工具的用户展示与国际化辅助方法。"""

from __future__ import annotations

from collections.abc import Mapping

from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n


def translate_action(tool_name: str) -> str:
    return i18n.translate(tool_name, category="tool.actions")


def translate_message(message_key: str, **kwargs: object) -> str:
    return i18n.translate(f"startup_task.{message_key}", category="tool.messages", **kwargs)


def translate_error(info: object) -> str:
    """按错误码给用户看的脱敏说明；未知错误码统一为通用失败文案。"""
    error_code = str(info.get("error_code") or "unknown") if isinstance(info, Mapping) else "unknown"
    message = translate_message(f"error.{error_code}")
    if message == f"startup_task.error.{error_code}":
        return translate_message("error.unknown")
    return message


def translate_status(status: str) -> str:
    return translate_message(f"status.{status}")


def get_argument(arguments: Mapping[str, object] | None, key: str) -> str:
    return str((arguments or {}).get(key) or "")


def markdown_detail(file_name: str, lines: list[str]) -> ToolDetail:
    return ToolDetail(type=DisplayType.MD, data=FileContent(file_name=file_name, content="\n".join(lines)))
