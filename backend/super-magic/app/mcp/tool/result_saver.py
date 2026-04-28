"""MCP 工具结果文件落盘

提供将 MCP 工具执行结果异步保存到文件的功能，支持：
- 用户指定输出路径（相对于 workspace）
- 结果超过阈值时自动保存
- 路径安全检查（防止路径遍历）
- 文件名冲突时自动追加时间戳
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult

from app.path_manager import PathManager
from app.utils.async_file_utils import async_exists, async_mkdir, async_write_json

logger = get_logger(__name__)

# 结果大小超过此阈值（字节）时自动落盘
RESULT_SIZE_THRESHOLD = 8 * 1024

# 默认输出子目录名
MCP_OUTPUT_DIR_NAME = "tool_outputs"


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
    return _get_result_size(result) > RESULT_SIZE_THRESHOLD


async def save_result_to_file(
    result: ToolResult,
    output_file_path: str,
    tool_original_name: str,
    tool_full_name: str,
    server_name: str,
) -> ToolResult:
    """将工具结果异步保存到文件，返回包含文件信息的新 ToolResult

    Args:
        result: 工具执行结果
        output_file_path: 用户指定的相对路径（相对于 workspace），空字符串使用默认路径
        tool_original_name: 工具原始名称（不带前缀）
        tool_full_name: 工具完整名称（带前缀）
        server_name: 所属 MCP 服务器名称

    Returns:
        ToolResult: 包含文件路径和说明的 JSON 字符串结果
    """
    workspace_dir = PathManager.get_workspace_dir()
    file_path, reason = await _resolve_output_path(
        output_file_path, workspace_dir, tool_full_name
    )

    parsed_content = _try_parse_json(result.content)
    output_data = {
        "tool_name": tool_original_name,
        "server_name": server_name,
        "timestamp": datetime.now().isoformat(),
        "result_size_bytes": _get_result_size(result),
        "execution_time": result.execution_time or 0.0,
        "status": "success" if result.ok else "failed",
        "result": parsed_content,
    }

    await async_write_json(file_path, output_data, ensure_ascii=False, indent=2)
    logger.info(f"MCP tool result saved to file: {file_path}")

    relative_path = file_path.relative_to(workspace_dir)
    file_info = {
        "output_file_path": str(relative_path),
        "reason": reason,
        "file_size": _get_result_size(result),
        "tool_name": tool_original_name,
        "server_name": server_name,
        "timestamp": datetime.now().isoformat(),
        "status": "success" if result.ok else "failed",
    }

    return ToolResult(
        content=json.dumps(file_info, ensure_ascii=False, indent=2),
        ok=result.ok,
        name=result.name,
        execution_time=result.execution_time,
    )


async def _resolve_output_path(
    output_file_path: str,
    workspace_dir: Path,
    tool_full_name: str,
) -> tuple[Path, str]:
    """解析输出文件路径，返回 (绝对路径, 原因说明)

    对用户指定路径做安全检查，确保不超出 workspace 范围。
    """
    if output_file_path.strip():
        clean = output_file_path.strip().replace('..', '').replace('//', '/')
        if clean.startswith('/'):
            clean = clean[1:]

        file_path = workspace_dir / clean
        try:
            file_path.resolve().relative_to(workspace_dir.resolve())
            await async_mkdir(file_path.parent, parents=True, exist_ok=True)
            file_path = await _avoid_conflict(file_path)
            return file_path, "指定保存到文件"
        except ValueError:
            logger.warning(f"Unsafe file path detected: {output_file_path}, using default path")

    output_dir = workspace_dir / MCP_OUTPUT_DIR_NAME
    await async_mkdir(output_dir, exist_ok=True)
    filename = _generate_filename(tool_full_name)
    file_path = await _avoid_conflict(output_dir / filename)
    return file_path, "输出内容过长，已自动保存结果为文件，如需详情请读取该文件"


async def _avoid_conflict(file_path: Path) -> Path:
    """若文件已存在，在文件名后追加时间戳避免覆盖"""
    if not await async_exists(file_path):
        return file_path
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return file_path.parent / f"{file_path.stem}_{timestamp}{file_path.suffix}"


def _generate_filename(tool_name: str) -> str:
    """生成输出文件名：{clean_tool_name}_{timestamp}.json"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    clean = "".join(c for c in (tool_name or "") if c.isalnum() or c in "-_") or "mcp_tool"
    return f"{clean}_{timestamp}.json"


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
