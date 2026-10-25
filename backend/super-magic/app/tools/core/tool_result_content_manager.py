"""模型交付正文的全局文件化保护，不改原始业务结果和用户详情。"""

import re
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator

from agentlang.config.config import config
from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.token_estimator import num_tokens_from_string
from app.tools.core.base_tool import ToolResultContentMode
from app.tools.core.tool_result_storage import (
    ToolResultFile,
    ToolResultStorageConfig,
    discard_result_file,
    measure_text_bytes,
    save_tool_result,
)

logger = get_logger(__name__)

_SAVE_FAILED = "The oversized output could not be saved. No complete output file is available."
_SIZE_REJECTED = "The returned text exceeds the automatic file size limit. No complete output file was created."
_RECOVERY = "Output is incomplete. Do not repeat an action with side effects just to recover its output."


class ToolResultContentDisposition(StrEnum):
    STORED = "stored"
    SAVE_FAILED = "save_failed"
    SIZE_REJECTED = "size_rejected"


class _ContentConfig(BaseModel):
    max_inline_tokens: int = Field(default=20_000, gt=0, strict=True)
    max_preview_lines: int = Field(default=5, gt=0, strict=True)
    max_preview_tokens: int = Field(default=1_000, gt=0, strict=True)

    @model_validator(mode="after")
    def validate_budget(self) -> "_ContentConfig":
        if self.max_preview_tokens >= self.max_inline_tokens:
            raise ValueError("Preview token limit must be below the inline limit.")
        # 不允许配置小到连原业务状态与不完整说明都无法交付。
        minimum_notice = f"Tool execution succeeded. {_SIZE_REJECTED}\n{_RECOVERY}"
        if num_tokens_from_string(minimum_notice) > self.max_inline_tokens:
            raise ValueError("Inline limit cannot hold the required failure notice.")
        return self


def _token_prefix(text: str, limit: int) -> str:
    """只取原文连续前缀；不用会额外追加截断文案的通用 helper。"""
    if limit <= 0:
        return ""
    if num_tokens_from_string(text) <= limit:
        return text
    low, high = 0, len(text)
    while low < high:
        middle = (low + high + 1) // 2
        if num_tokens_from_string(text[:middle]) <= limit:
            low = middle
        else:
            high = middle - 1
    return text[:low]


def _preview(content: str, settings: _ContentConfig) -> str:
    # 估算器中一个 token 最多对应 4 字符；提前限制扫描范围不改变两重上限的结果。
    candidate = content[:4 * (settings.max_preview_tokens + 1)]
    for line_count, match in enumerate(re.finditer(r"\r\n|\r|\n", candidate), start=1):
        if line_count == settings.max_preview_lines:
            candidate = candidate[:match.start()]
            break
    return _token_prefix(candidate, settings.max_preview_tokens)


def _with_preview(notice: str, preview: str, limit: int) -> str:
    if not preview:
        return notice
    label = "\n\nBeginning excerpt (incomplete; not a summary):\n"
    if num_tokens_from_string(notice + label) >= limit:
        return notice
    # 最终检查包含固定提示和路径；token 估算的取整不可简单按两段相减视为精确预算。
    available = limit - num_tokens_from_string(notice + label) - 1
    return notice + label + _token_prefix(preview, available)


class ToolResultContentManager:
    async def prepare(
        self,
        result: ToolResult,
        *,
        mode: ToolResultContentMode = ToolResultContentMode.GLOBAL,
        tool_name: str,
        tool_context: ToolContext | None,
    ) -> ToolResult:
        if result.ok and mode in (ToolResultContentMode.SELF_MANAGED, ToolResultContentMode.INSTRUCTION):
            return result
        try:
            settings = _ContentConfig.model_validate(config.get("agent.tool_result", {}))
        except Exception as error:
            # 配置失误不能关闭出口保护，也不能把已完成的业务误报为失败。
            logger.warning(f"Invalid tool output budget; using defaults: error_type={type(error).__name__}")
            settings = _ContentConfig()
        if num_tokens_from_string(result.content) <= settings.max_inline_tokens:
            return result

        preview = _preview(result.content, settings)
        status = "Tool execution succeeded." if result.ok else "Tool execution failed."
        disposition = ToolResultContentDisposition.SAVE_FAILED
        saved: ToolResultFile | None = None
        try:
            storage_settings = ToolResultStorageConfig.load()
            size_bytes = await measure_text_bytes(result.content, storage_settings.max_file_size)
            if size_bytes > storage_settings.max_file_size:
                disposition = ToolResultContentDisposition.SIZE_REJECTED
            else:
                saved = await save_tool_result(
                    result.content,
                    size_bytes=size_bytes,
                    tool_name=tool_name,
                    settings=storage_settings,
                    tool_context=tool_context,
                )
                disposition = ToolResultContentDisposition.STORED
        except Exception as error:
            logger.warning(
                f"Tool output save failed: tool={tool_name}, call_id={result.tool_call_id}, "
                f"error_type={type(error).__name__}"
            )

        if saved is not None:
            notice = (
                f"{status} The full returned text was saved because it exceeded the inline limit.\n"
                f"Path: {saved.path}\nSize: {saved.size_bytes} bytes (UTF-8).\n"
                "Read or search this file, or process it with code, before deciding the next step. "
                "Check the entire result before concluding that all items are complete. "
                "This runtime file may be removed by cleanup or sandbox rebuild."
            )
            if num_tokens_from_string(notice) > settings.max_inline_tokens:
                notice = (
                    f"{status} Full returned text saved.\nPath: {saved.path}\n"
                    "Read the file before deciding the next step. It may be removed by cleanup or sandbox rebuild."
                )
            if num_tokens_from_string(notice) > settings.max_inline_tokens:
                await discard_result_file(saved.path)
                disposition = ToolResultContentDisposition.SAVE_FAILED
                saved = None
        if saved is None:
            reason = _SIZE_REJECTED if disposition == ToolResultContentDisposition.SIZE_REJECTED else _SAVE_FAILED
            notice = f"{status} {reason}\n{_RECOVERY}"

        content = _with_preview(notice, preview, settings.max_inline_tokens)
        logger.info(
            f"Tool output delivery: tool={tool_name}, call_id={result.tool_call_id}, "
            f"disposition={disposition.value}, path={saved.path if saved else None}"
        )
        # AFTER 事件已持有原对象；浅复制保留结果子类、控制信号和结构化数据引用。
        return result.model_copy(update={"content": content})


tool_result_content_manager = ToolResultContentManager()
