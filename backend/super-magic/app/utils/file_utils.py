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
from typing import TYPE_CHECKING, TypedDict, Union

from agentlang.logger import get_logger

if TYPE_CHECKING:
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


class WorkspaceEntry(TypedDict):
    path: str
    size: int | None


@dataclass
class WorkspaceSnapshot:
    """工作区文件树快照。

    展示与条目集合来自同一次观测，两者必须一致：分开采集会让模型看到的树和别处用的
    集合对不上。变更检测不使用它（变更只有一个来源：变更账本事件），条目集合供嵌套
    规则文件的发现使用。
    """

    display: str                        # 格式化树形字符串，注入 LLM 展示
    entries: list[WorkspaceEntry] = field(default_factory=list)  # [{"path": str, "size": int|None}]


def extract_workspace_entries(nodes: list["FileTreeNode"]) -> list[WorkspaceEntry]:
    """从 FileTreeNode 列表中提取结构化工作区条目。

    每条条目：{"path": 相对路径, "size": 文件大小字节或 None（目录）}
    目录路径以 "/" 结尾，与文件区分。
    """
    entries: list[WorkspaceEntry] = []
    for node in (nodes or []):
        if node.error:
            continue
        if node.is_directory:
            entries.append({"path": node.relative_file_path + "/", "size": None})
            entries.extend(extract_workspace_entries(node.children or []))
        else:
            entries.append({"path": node.relative_file_path, "size": node.file_size})
    return entries
