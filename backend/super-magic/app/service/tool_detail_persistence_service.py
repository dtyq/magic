"""Persist large tool-detail text on the topic volume.

The topic volume is mounted by the sandbox.  This service deliberately creates
its child directory only when a tool detail actually needs persistence.
"""

from __future__ import annotations

import asyncio
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import aiofiles

from agentlang.logger import get_logger
from app.core.entity.message.server_message import DisplayType, Tool, ToolStatus
from app.path_manager import PathManager
from app.utils.async_file_utils import async_mkdir, get_file_id_from_xattr

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class ToolDetailPersistResult:
    persisted: bool
    file_id: Optional[str] = None
    path: Optional[Path] = None
    reason: Optional[str] = None


class ToolDetailPersistenceService:
    """Store large textual tool details and replace them with a file reference."""

    # Match PHP's strlen() semantics: threshold is UTF-8 encoded byte length.
    # 1 KiB avoids persisting small status/summary snippets while still
    # removing genuinely large tool-detail payloads from messages.
    DEFAULT_MIN_CONTENT_LENGTH = 1024
    DEFAULT_XATTR_RETRIES = 3
    DEFAULT_XATTR_RETRY_DELAY_SECONDS = 0.05

    @classmethod
    async def persist(cls, tool: Optional[Tool]) -> ToolDetailPersistResult:
        if tool is None or tool.detail is None:
            return ToolDetailPersistResult(False, reason="missing_tool_detail")

        if tool.status == ToolStatus.ERROR or str(tool.status) == ToolStatus.ERROR.value:
            return ToolDetailPersistResult(False, reason="error_tool")

        if tool.detail.type == DisplayType.IMAGE or str(tool.detail.type) == DisplayType.IMAGE.value:
            return ToolDetailPersistResult(False, reason="image_detail")

        data = cls._to_dict(tool.detail.data)
        content = data.get("content")
        if not isinstance(content, str) or not content:
            return ToolDetailPersistResult(False, reason="empty_content")

        min_length = cls._get_int_env("TOOL_MESSAGE_MIN_CONTENT_LENGTH", cls.DEFAULT_MIN_CONTENT_LENGTH)
        if len(content.encode("utf-8")) < min_length:
            return ToolDetailPersistResult(False, reason="content_below_threshold")

        tool_id = cls._safe_component(str(tool.id))
        if not tool_id:
            logger.warning("工具详情持久化跳过：tool_id 为空")
            return ToolDetailPersistResult(False, reason="missing_tool_id")

        file_name = str(data.get("file_name") or "tool_content.txt")
        extension = cls._safe_extension(file_name)
        path = PathManager.get_tool_detail_content_dir() / f"{tool_id}.{extension}"

        try:
            await cls._write_text(path, content)
            file_id = await cls._read_file_id_with_retry(path, tool_id)
            if not file_id:
                return ToolDetailPersistResult(False, path=path, reason="file_id_xattr_missing")

            data["file_id"] = file_id
            data["storage_type"] = "topic"
            data["file_extension"] = extension
            data["content"] = ""
            # ToolDetail.data is a deliberately open union.  Assignment is not
            # validation-enabled, so retaining the normalized dict preserves
            # protocol fields (file_id/storage_type) not present in FileContent.
            tool.detail.data = data
            return ToolDetailPersistResult(True, file_id=file_id, path=path)
        except Exception as exc:
            logger.warning(
                "工具详情持久化失败，保留 inline 内容: tool_id=%s path=%s error=%s",
                tool_id,
                path,
                exc,
            )
            return ToolDetailPersistResult(False, path=path, reason="persist_failed")

    @staticmethod
    def _to_dict(data: Any) -> dict[str, Any]:
        if isinstance(data, dict):
            return dict(data)
        if hasattr(data, "model_dump"):
            return data.model_dump(mode="json", exclude_none=True)
        return {}

    @staticmethod
    def _safe_component(value: str) -> str:
        return re.sub(r"[^A-Za-z0-9._-]", "_", value).strip("._")

    @classmethod
    def _safe_extension(cls, file_name: str) -> str:
        suffix = Path(file_name).suffix.lower().lstrip(".")
        return cls._safe_component(suffix) or "txt"

    @staticmethod
    def _get_int_env(name: str, default: int) -> int:
        try:
            return max(0, int(os.getenv(name, str(default))))
        except (TypeError, ValueError):
            return default

    @staticmethod
    async def _write_text(path: Path, content: str) -> None:
        await async_mkdir(path.parent, parents=True, exist_ok=True)
        async with aiofiles.open(path, "w", encoding="utf-8") as file:
            await file.write(content)
            await file.flush()
            fileno = file.fileno()
            await asyncio.to_thread(os.fsync, fileno)

    @classmethod
    async def _read_file_id_with_retry(cls, path: Path, tool_id: str) -> Optional[str]:
        retries = cls._get_int_env("TOOL_DETAIL_XATTR_RETRIES", cls.DEFAULT_XATTR_RETRIES)
        delay = max(
            0.0,
            float(os.getenv("TOOL_DETAIL_XATTR_RETRY_DELAY_SECONDS", str(cls.DEFAULT_XATTR_RETRY_DELAY_SECONDS))),
        )
        for attempt in range(retries + 1):
            file_id = (await get_file_id_from_xattr(path) or "").strip()
            if file_id:
                return file_id
            if attempt < retries:
                await asyncio.sleep(delay)
        logger.warning(
            "工具详情文件缺少 MagicFS file_id xattr: tool_id=%s path=%s attempts=%s",
            tool_id,
            path,
            retries + 1,
        )
        return None


__all__ = ["ToolDetailPersistResult", "ToolDetailPersistenceService"]
