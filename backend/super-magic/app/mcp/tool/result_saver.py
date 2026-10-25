"""MCP 工具结果的临时落盘与显式持久化。"""

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import StrEnum
from pathlib import Path
from typing import Any

from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.path_manager import PathManager
from app.utils.async_file_utils import (
    async_chmod,
    async_close_fd,
    async_mkdir,
    async_mkstemp,
    async_realpath,
    async_stat,
    async_unlink,
    async_write_json,
)
from app.utils.runtime_storage import (
    RuntimeEvictionPolicy,
    ensure_runtime_directory,
    evict_runtime_files,
    get_runtime_config_int,
    get_runtime_config_size_bytes,
    trigger_opportunistic_cleanup,
)

logger = get_logger(__name__)

# 未指定输出路径时默认使用的运行时子目录名 (.runtime/<name>/)
MCP_OUTPUT_DIR_NAME = "mcp_outputs"


@dataclass(frozen=True, slots=True)
class _McpOutputConfig:
    result_size_threshold: int
    eviction_policy: RuntimeEvictionPolicy


def _load_mcp_output_config() -> _McpOutputConfig:
    return _McpOutputConfig(
        result_size_threshold=get_runtime_config_size_bytes(
            "runtime_cleanup.mcp_outputs.result_size_threshold",
            minimum=1,
        ),
        eviction_policy=RuntimeEvictionPolicy(
            max_entries=get_runtime_config_int(
                "runtime_cleanup.mcp_outputs.max_file_count",
                minimum=1,
            ),
            target_entries=get_runtime_config_int(
                "runtime_cleanup.mcp_outputs.target_file_count",
                minimum=0,
            ),
            max_total_bytes=get_runtime_config_size_bytes(
                "runtime_cleanup.mcp_outputs.max_total_size",
                minimum=1,
            ),
            target_total_bytes=get_runtime_config_size_bytes(
                "runtime_cleanup.mcp_outputs.target_total_size",
                minimum=0,
            ),
            max_age_seconds=get_runtime_config_int(
                "runtime_cleanup.mcp_outputs.max_age_days",
                minimum=1,
            )
            * 24
            * 60
            * 60,
        ),
    )


class McpOutputStorageScope(StrEnum):
    """MCP 落盘结果的生命周期范围。"""

    TEMPORARY = "temporary"
    WORKSPACE = "workspace"
    EXTERNAL = "external"


@dataclass(frozen=True, slots=True)
class McpOutputMetadata:
    output_file_path: str
    storage_scope: McpOutputStorageScope
    file_size: int
    tool_name: str
    server_name: str
    timestamp: str
    status: str

    def to_data(self) -> dict[str, str | int]:
        return {
            "output_file_path": self.output_file_path,
            "storage_scope": self.storage_scope.value,
            "file_size": self.file_size,
            "tool_name": self.tool_name,
            "server_name": self.server_name,
            "timestamp": self.timestamp,
            "status": self.status,
        }


@dataclass(frozen=True, slots=True)
class _ResolvedOutputPath:
    path: Path
    storage_scope: McpOutputStorageScope


def should_save_to_file(result: ToolResult, output_file_path: str) -> bool:
    """判断是否应该将结果保存到文件

    Args:
        result: 工具执行结果
        output_file_path: 用户指定的输出路径（空字符串表示未指定）

    Returns:
        bool: 是否需要保存
    """
    if output_file_path.strip():
        return True
    return _get_result_size(result) > _load_mcp_output_config().result_size_threshold


async def save_result_to_file(
    result: ToolResult,
    output_file_path: str,
    tool_original_name: str,
    server_name: str,
    workspace_dir: Path | None,
) -> ToolResult:
    """保存成功结果，并返回可供模型和前端分别消费的文件信息。"""
    resolved_output = await _resolve_output_path(
        output_file_path,
        tool_original_name,
        workspace_dir,
    )

    parsed_content = _try_parse_json(result.content)
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    output_data = {
        "tool_name": tool_original_name,
        "server_name": server_name,
        "timestamp": timestamp,
        "result_size_bytes": _get_result_size(result),
        "execution_time": result.execution_time or 0.0,
        "status": "success" if result.ok else "failed",
        "result": parsed_content,
    }

    try:
        await async_write_json(resolved_output.path, output_data, ensure_ascii=False, indent=2)
        await async_chmod(resolved_output.path, 0o600)
    except BaseException:
        if resolved_output.storage_scope == McpOutputStorageScope.TEMPORARY:
            try:
                await async_unlink(resolved_output.path)
            except BaseException as cleanup_error:
                logger.warning(
                    "Failed to clean up incomplete MCP output file: path=%s, error=%s",
                    resolved_output.path,
                    cleanup_error,
                )
        raise
    logger.info("MCP tool result saved to file: %s", resolved_output.path)

    file_stat = await async_stat(resolved_output.path)
    metadata = McpOutputMetadata(
        output_file_path=str(resolved_output.path),
        storage_scope=resolved_output.storage_scope,
        file_size=file_stat.st_size,
        tool_name=tool_original_name,
        server_name=server_name,
        timestamp=timestamp,
        status="success" if result.ok else "failed",
    )

    return ToolResult(
        content=_build_model_content(metadata),
        ok=result.ok,
        data=metadata.to_data(),
        extra_info=result.extra_info,
        system=result.system,
        name=result.name,
        execution_time=result.execution_time,
        tool_call_id=result.tool_call_id,
        use_custom_remark=result.use_custom_remark,
    )


async def _resolve_output_path(
    output_file_path: str,
    tool_original_name: str,
    workspace_dir: Path | None,
) -> _ResolvedOutputPath:
    """解析显式绝对路径或创建 `.runtime/mcp_outputs` 临时文件。"""
    if output_file_path.strip():
        candidate = Path(output_file_path.strip())
        if not candidate.is_absolute():
            raise ValueError("output_file_path must be an absolute path.")
        resolved = await async_realpath(candidate)
        await async_mkdir(resolved.parent, parents=True, exist_ok=True)
        storage_scope = await _classify_explicit_scope(resolved, workspace_dir)
        return _ResolvedOutputPath(path=resolved, storage_scope=storage_scope)

    output_dir = await ensure_runtime_directory(
        PathManager.get_runtime_dir() / MCP_OUTPUT_DIR_NAME
    )
    fd, raw_path = await async_mkstemp(
        suffix=".json",
        prefix=f"{_clean_tool_name(tool_original_name)}-",
        dir=output_dir,
    )
    await async_close_fd(fd)
    return _ResolvedOutputPath(
        path=Path(raw_path),
        storage_scope=McpOutputStorageScope.TEMPORARY,
    )


async def _classify_explicit_scope(
    output_path: Path,
    workspace_dir: Path | None,
) -> McpOutputStorageScope:
    if workspace_dir is None:
        return McpOutputStorageScope.EXTERNAL
    resolved_workspace = await async_realpath(workspace_dir)
    if output_path == resolved_workspace or resolved_workspace in output_path.parents:
        return McpOutputStorageScope.WORKSPACE
    return McpOutputStorageScope.EXTERNAL


def trigger_mcp_output_cleanup() -> None:
    output_dir = PathManager.get_runtime_dir() / MCP_OUTPUT_DIR_NAME
    trigger_opportunistic_cleanup(
        "mcp_outputs",
        lambda: evict_runtime_files(
            output_dir,
            policy=_load_mcp_output_config().eviction_policy,
            suffixes=(".json",),
        ),
    )


def _clean_tool_name(tool_name: str) -> str:
    clean = "".join(
        character
        for character in (tool_name or "")
        if character.isalnum() or character in "-_"
    )
    return (clean or "mcp")[:24]


def _build_model_content(metadata: McpOutputMetadata) -> str:
    if metadata.storage_scope == McpOutputStorageScope.TEMPORARY:
        lifecycle = (
            "This is a capacity-managed .runtime file. It may be deleted by later cleanup or when "
            "the sandbox is rebuilt. To keep a future result, provide an absolute output_file_path "
            "inside the current .workspace directory."
        )
    elif metadata.storage_scope == McpOutputStorageScope.WORKSPACE:
        lifecycle = "This file is inside the current .workspace directory and is intended to persist."
    else:
        lifecycle = "This file is outside .workspace. Its persistence depends on that external path."
    return (
        "MCP tool execution succeeded and the full result was saved to a JSON file.\n\n"
        f"Path: {metadata.output_file_path}\n"
        f"Size: {metadata.file_size} bytes\n"
        f"Storage scope: {metadata.storage_scope.value}\n\n"
        f"{lifecycle}"
    )


def _get_result_size(result: ToolResult) -> int:
    """计算结果内容的字节大小"""
    if not result.content:
        return 0
    return len(str(result.content).encode('utf-8'))


def _try_parse_json(content: Any) -> Any:
    """尝试将字符串内容解析为 JSON 对象，失败时返回原内容"""
    if not isinstance(content, str):
        return content
    try:
        return json.loads(content.strip())
    except (json.JSONDecodeError, ValueError):
        return content
