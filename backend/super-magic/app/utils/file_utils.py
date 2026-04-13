"""
File utilities

Collection of file-related utility functions for common operations.
"""

import os
import asyncio
import hashlib
import aiofiles
from dataclasses import dataclass, field
from pathlib import Path
from typing import Union, Optional, List, TYPE_CHECKING

from agentlang.logger import get_logger

if TYPE_CHECKING:
    from app.core.entity.file import File as FileEntity
    from app.core.entity.message.server_message import FileTreeNode

logger = get_logger(__name__)


HASH_READ_CHUNK_SIZE = 256 * 1024
BLAKE2B_DIGEST_SIZE = 16


@dataclass(frozen=True)
class FreshFileStat:
    """通过单次文件打开获取的最新文件元信息。"""
    size: int
    mtime: float


def _get_fresh_file_stat_sync(file_path: Path) -> FreshFileStat:
    """在同步上下文中打开文件并通过 fstat 获取最新 size/mtime。"""
    with open(file_path, 'rb') as f:
        stat_result = os.fstat(f.fileno())
    return FreshFileStat(size=stat_result.st_size, mtime=stat_result.st_mtime)


def _calculate_file_hash_sync(file_path: Path) -> str:
    """在同步上下文中计算文件哈希，供 to_thread 调用。"""
    hash_blake2b = hashlib.blake2b(digest_size=BLAKE2B_DIGEST_SIZE)
    with open(file_path, 'rb') as f:
        while True:
            chunk = f.read(HASH_READ_CHUNK_SIZE)
            if not chunk:
                break
            hash_blake2b.update(chunk)
    return hash_blake2b.hexdigest()


async def is_binary_file(file_path: Union[str, Path]) -> bool:
    """
    Check if file is binary by detecting null bytes in first 512 bytes

    Args:
        file_path: File path to check

    Returns:
        True if file is binary, False if text
    """
    try:
        file_path = Path(file_path)
        async with aiofiles.open(file_path, 'rb') as f:
            chunk = await f.read(512)
            return b'\0' in chunk
    except Exception as e:
        logger.warning(f"Binary detection failed for {file_path}: {e}")
        return True  # Treat unreadable files as binary for safety


async def get_file_size(file_path: Union[str, Path]) -> int:
    """
    Get file size in bytes

    Args:
        file_path: File path to check

    Returns:
        File size in bytes

    Raises:
        OSError: If file does not exist or cannot be accessed
    """
    file_stat = await get_fresh_file_stat(file_path)
    return file_stat.size


async def get_fresh_file_stat(file_path: Union[str, Path]) -> FreshFileStat:
    """
    Get fresh file stat by opening file once.

    Args:
        file_path: File path to inspect

    Returns:
        FreshFileStat: Latest size and mtime from fstat

    Raises:
        OSError: If file does not exist or cannot be accessed
    """
    file_path = Path(file_path).resolve()
    return await asyncio.to_thread(_get_fresh_file_stat_sync, file_path)


async def calculate_file_hash(file_path: Union[str, Path]) -> str:
    """
    Calculate BLAKE2b hash of a file in a worker thread

    Args:
        file_path: File path to hash

    Returns:
        BLAKE2b hex digest of the file content

    Raises:
        OSError: If file cannot be read
    """
    file_path = Path(file_path).resolve()
    return await asyncio.to_thread(_calculate_file_hash_sync, file_path)


def format_file_size(size: int) -> str:
    """
    格式化文件大小

    Args:
        size: 文件大小（字节）

    Returns:
        str: 格式化后的文件大小字符串
    """
    if size < 1024:
        return f"{size}B"
    elif size < 1024 * 1024:
        return f"{size / 1024:.1f}KB"
    elif size < 1024 * 1024 * 1024:
        return f"{size / (1024 * 1024):.1f}MB"
    else:
        return f"{size / (1024 * 1024 * 1024):.1f}GB"


@dataclass
class WorkspaceSnapshot:
    """工作区文件树快照，同时承载展示和 diff 两种用途。"""
    display: str                        # 格式化树形字符串，注入 LLM 展示
    entries: List[dict] = field(default_factory=list)  # [{"path": str, "size": int|None}]


def extract_paths_from_local_tree(nodes: List["FileTreeNode"]) -> List[dict]:
    """从本地扫描的 FileTreeNode 列表中提取结构化路径条目。

    每条条目：{"path": 相对路径, "size": 文件大小字节或 None（目录）}
    目录路径以 "/" 结尾，与文件区分。
    """
    entries: List[dict] = []
    for node in (nodes or []):
        if node.error:
            continue
        if node.is_directory:
            entries.append({"path": node.relative_file_path + "/", "size": None})
            entries.extend(extract_paths_from_local_tree(node.children or []))
        else:
            entries.append({"path": node.relative_file_path, "size": node.file_size})
    return entries


def extract_paths_from_magic_tree(root: "FileEntity", prefix: str = "") -> List[dict]:
    """从 Magic Service 返回的 File 树中提取结构化路径条目。

    每条条目：{"path": 相对路径, "size": 文件大小字节或 None（目录）}
    """
    entries: List[dict] = []
    for child in (root.children or []):
        rel = f"{prefix}{child.name}" if prefix else child.name
        if child.is_directory:
            entries.append({"path": rel + "/", "size": None})
            entries.extend(extract_paths_from_magic_tree(child, prefix=rel + "/"))
        else:
            entries.append({"path": rel, "size": child.size})
    return entries


def convert_file_tree_to_string(file_tree_root: Optional['FileEntity'], show_file_size: bool = False) -> str:
    """
    将 Magic Service 返回的 File 树结构转换为字符串格式

    Args:
        file_tree_root: 文件树根节点（FileEntity 类型）
        show_file_size: 是否显示文件大小，默认为 False

    Returns:
        str: 格式化的文件树字符串
    """
    if not file_tree_root:
        return "No files found"

    output_lines = []

    # 添加根目录行
    output_lines.append("[DIR] 根目录/\n")

    # 递归构建文件树
    if file_tree_root.children:
        _append_file_nodes_to_string(file_tree_root.children, output_lines, "", True, show_file_size)

    return "".join(output_lines)


def _append_file_nodes_to_string(nodes: List['FileEntity'], output_lines: List[str], indent: str, is_root: bool = False, show_file_size: bool = False):
    """
    递归将文件节点追加到字符串输出中

    Args:
        nodes: 文件节点列表（FileEntity 类型）
        output_lines: 输出行列表
        indent: 缩进字符串
        is_root: 是否为根级别
        show_file_size: 是否显示文件大小
    """
    for idx, node in enumerate(nodes):
        is_last_item = (idx == len(nodes) - 1)

        # 创建前缀
        if is_root:
            prefix = "└─" if is_last_item else "├─"
            next_indent = "   " if is_last_item else "│  "
        else:
            prefix = f"{indent}{'└─' if is_last_item else '├─'}"
            next_indent = f"{indent}{'   ' if is_last_item else '│  '}"

        if node.is_directory:
            # 目录
            child_count = len(node.children) if node.children else 0
            count_str = f"{child_count} items"
            dir_line = f"{prefix}[DIR] {node.name}/ ({count_str})\n"
            output_lines.append(dir_line)

            # 递归处理子节点
            if node.children:
                _append_file_nodes_to_string(node.children, output_lines, next_indent, False, show_file_size)
        else:
            # 文件
            if show_file_size:
                size_str = format_file_size(node.size) if node.size is not None else "0B"
                file_line = f"{prefix}[FILE] {node.name} ({size_str})\n"
            else:
                file_line = f"{prefix}[FILE] {node.name}\n"
            output_lines.append(file_line)
