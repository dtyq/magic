# -*- coding: utf-8 -*-
"""
异步文件操作工具模块

提供统一的异步文件操作工具函数，用于替换checkpoint模块中的阻塞文件操作。
包括文件复制、目录操作、JSON文件读写等。
"""

import asyncio
import re
import aiofiles
import aiofiles.os
import shutil
import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Union, Any, Dict, Optional

import yaml

from agentlang.logger import get_logger

logger = get_logger(__name__)


async def async_copy2(src: Union[str, Path], dst: Union[str, Path]) -> None:
    """
    异步复制文件，包括内容和元数据

    Args:
        src: 源文件路径
        dst: 目标文件路径

    Raises:
        FileNotFoundError: 源文件不存在
        PermissionError: 权限不足
        IOError: IO操作失败
    """
    src_path = Path(src)
    dst_path = Path(dst)

    try:
        logger.debug(f"开始异步复制文件: {src_path} -> {dst_path}")

        # 检查源文件是否存在
        if not await async_exists(src_path):
            raise FileNotFoundError(f"源文件不存在: {src_path}")

        # 确保目标目录存在
        await async_mkdir(dst_path.parent, parents=True, exist_ok=True)

        # 异步复制文件内容
        async with aiofiles.open(src_path, 'rb') as src_file:
            content = await src_file.read()

        async with aiofiles.open(dst_path, 'wb') as dst_file:
            await dst_file.write(content)

        # 复制文件元数据（时间戳、权限）
        stat = await aiofiles.os.stat(str(src_path))
        await asyncio.to_thread(os.utime, str(dst_path), (stat.st_atime, stat.st_mtime))
        await asyncio.to_thread(os.chmod, str(dst_path), stat.st_mode)

        logger.debug(f"异步复制文件完成: {src_path} -> {dst_path}")

    except Exception as e:
        logger.error(f"异步复制文件失败 {src_path} -> {dst_path}: {e}")
        raise


async def async_copytree(src: Union[str, Path], dst: Union[str, Path]) -> None:
    """
    异步复制目录树

    Args:
        src: 源目录路径
        dst: 目标目录路径

    Raises:
        FileNotFoundError: 源目录不存在
        FileExistsError: 目标目录已存在
        PermissionError: 权限不足
    """
    src_path = Path(src)
    dst_path = Path(dst)

    try:
        logger.debug(f"开始异步复制目录: {src_path} -> {dst_path}")

        await asyncio.to_thread(shutil.copytree, src_path, dst_path)

        logger.debug(f"异步复制目录完成: {src_path} -> {dst_path}")

    except Exception as e:
        logger.error(f"异步复制目录失败 {src_path} -> {dst_path}: {e}")
        raise


async def async_rmtree(path: Union[str, Path]) -> None:
    """
    异步删除目录树

    Args:
        path: 要删除的目录路径

    Raises:
        FileNotFoundError: 目录不存在
        PermissionError: 权限不足
        OSError: 删除失败
    """
    path_obj = Path(path)

    try:
        logger.debug(f"开始异步删除目录: {path_obj}")

        if await async_exists(path_obj):
            await asyncio.to_thread(shutil.rmtree, path_obj)
            logger.debug(f"异步删除目录完成: {path_obj}")
        else:
            logger.debug(f"目录不存在，跳过删除: {path_obj}")

    except Exception as e:
        logger.error(f"异步删除目录失败 {path_obj}: {e}")
        raise


async def async_mkdir(path: Union[str, Path], parents: bool = False, exist_ok: bool = False) -> None:
    """
    异步创建目录

    Args:
        path: 要创建的目录路径
        parents: 是否创建父目录
        exist_ok: 目录已存在是否报错

    Raises:
        FileExistsError: 目录已存在且exist_ok=False
        PermissionError: 权限不足
        OSError: 创建失败
    """
    path_str = str(path)

    try:
        logger.debug(f"开始异步创建目录: {path_str}, parents={parents}, exist_ok={exist_ok}")

        if parents:
            # 需要创建父目录时使用 makedirs
            await aiofiles.os.makedirs(path_str, exist_ok=exist_ok)
        else:
            # 不需要创建父目录时使用 mkdir
            # aiofiles.os.mkdir 不直接支持 exist_ok，需要手动处理
            if exist_ok and await aiofiles.os.path.exists(path_str):
                logger.debug(f"目录已存在且 exist_ok=True，跳过创建: {path_str}")
            else:
                await aiofiles.os.mkdir(path_str)

        logger.debug(f"异步创建目录完成: {path_str}")

    except Exception as e:
        logger.error(f"异步创建目录失败 {path_str}: {e}")
        raise


async def async_unlink(path: Union[str, Path]) -> None:
    """
    异步删除文件

    Args:
        path: 要删除的文件路径

    Raises:
        FileNotFoundError: 文件不存在
        IsADirectoryError: 路径是目录
        PermissionError: 权限不足
    """
    path_str = str(path)

    try:
        logger.debug(f"开始异步删除文件: {path_str}")

        if await async_exists(path_str):
            await aiofiles.os.remove(path_str)
            logger.debug(f"异步删除文件完成: {path_str}")
        else:
            logger.debug(f"文件不存在，跳过删除: {path_str}")

    except Exception as e:
        logger.error(f"异步删除文件失败 {path_str}: {e}")
        raise


async def async_rmdir(path: Union[str, Path]) -> None:
    """
    异步删除空目录

    Args:
        path: 要删除的目录路径

    Raises:
        FileNotFoundError: 目录不存在
        OSError: 目录不为空或删除失败
        PermissionError: 权限不足
    """
    path_str = str(path)

    try:
        logger.debug(f"开始异步删除空目录: {path_str}")

        if await async_exists(path_str):
            await aiofiles.os.rmdir(path_str)
            logger.debug(f"异步删除空目录完成: {path_str}")
        else:
            logger.debug(f"目录不存在，跳过删除: {path_str}")

    except Exception as e:
        logger.error(f"异步删除空目录失败 {path_str}: {e}")
        raise


async def async_write_json(file_path: Union[str, Path], data: Dict[str, Any], **kwargs) -> None:
    """
    异步写入JSON文件

    Args:
        file_path: 文件路径
        data: 要写入的数据
        **kwargs: json.dumps的额外参数

    Raises:
        PermissionError: 权限不足
        IOError: IO操作失败
        TypeError: 数据无法序列化
    """
    path_obj = Path(file_path)

    try:
        logger.debug(f"开始异步写入JSON文件: {path_obj}")

        # 确保目录存在
        await async_mkdir(path_obj.parent, parents=True, exist_ok=True)

        # 序列化数据
        json_str = await asyncio.to_thread(json.dumps, data, **kwargs)

        # 异步写入文件
        async with aiofiles.open(path_obj, 'w', encoding='utf-8') as f:
            await f.write(json_str)

        logger.debug(f"异步写入JSON文件完成: {path_obj}")

    except Exception as e:
        logger.error(f"异步写入JSON文件失败 {path_obj}: {e}")
        raise


async def async_read_json(file_path: Union[str, Path]) -> Dict[str, Any]:
    """
    异步读取JSON文件

    Args:
        file_path: 文件路径

    Returns:
        Dict[str, Any]: 解析后的JSON数据

    Raises:
        FileNotFoundError: 文件不存在
        json.JSONDecodeError: JSON格式错误
        IOError: IO操作失败
    """
    path_obj = Path(file_path)

    try:
        logger.debug(f"开始异步读取JSON文件: {path_obj}")

        # 检查文件是否存在
        if not await async_exists(path_obj):
            raise FileNotFoundError(f"JSON文件不存在: {path_obj}")

        # 异步读取文件内容
        async with aiofiles.open(path_obj, 'r', encoding='utf-8') as f:
            content = await f.read()

        # 解析JSON
        data = await asyncio.to_thread(json.loads, content)

        logger.debug(f"异步读取JSON文件完成: {path_obj}")
        return data

    except Exception as e:
        logger.error(f"异步读取JSON文件失败 {path_obj}: {e}")
        raise


async def async_write_text(file_path: Union[str, Path], content: str, encoding: str = 'utf-8') -> None:
    """
    异步写入文本文件

    Args:
        file_path: 文件路径
        content: 文本内容
        encoding: 编码格式，默认utf-8

    Raises:
        PermissionError: 权限不足
        IOError: IO操作失败
    """
    path_obj = Path(file_path)

    try:
        logger.debug(f"开始异步写入文本文件: {path_obj}")

        # 确保目录存在
        await async_mkdir(path_obj.parent, parents=True, exist_ok=True)

        # 异步写入文件
        async with aiofiles.open(path_obj, 'w', encoding=encoding) as f:
            await f.write(content)

        logger.debug(f"异步写入文本文件完成: {path_obj}")

    except Exception as e:
        logger.error(f"异步写入文本文件失败 {path_obj}: {e}")
        raise


async def async_write_bytes(
    file_path: Union[str, Path],
    content: bytes | bytearray | memoryview,
) -> None:
    """
    异步写入二进制文件

    Args:
        file_path: 文件路径
        content: 二进制内容

    Raises:
        PermissionError: 权限不足
        IOError: IO操作失败
        TypeError: 内容不是 bytes / bytearray / memoryview
    """
    path_obj = Path(file_path)

    try:
        logger.debug(f"开始异步写入二进制文件: {path_obj}")

        if isinstance(content, bytes):
            normalized_content = content
        elif isinstance(content, (bytearray, memoryview)):
            normalized_content = bytes(content)
        else:
            raise TypeError("二进制内容必须是 bytes、bytearray 或 memoryview 类型")

        # 确保目录存在
        await async_mkdir(path_obj.parent, parents=True, exist_ok=True)

        # 异步写入文件
        async with aiofiles.open(path_obj, 'wb') as f:
            await f.write(normalized_content)

        logger.debug(f"异步写入二进制文件完成: {path_obj}, 写入了 {len(normalized_content)} 字节")

    except Exception as e:
        logger.error(f"异步写入二进制文件失败 {path_obj}: {e}")
        raise


async def async_read_text(file_path: Union[str, Path], encoding: str = 'utf-8') -> str:
    """
    异步读取文本文件

    Args:
        file_path: 文件路径
        encoding: 编码格式，默认utf-8

    Returns:
        str: 文件内容

    Raises:
        FileNotFoundError: 文件不存在
        IOError: IO操作失败
    """
    path_obj = Path(file_path)

    try:
        logger.debug(f"开始异步读取文本文件: {path_obj}")

        # 检查文件是否存在
        if not await async_exists(path_obj):
            raise FileNotFoundError(f"文本文件不存在: {path_obj}")

        # 异步读取文件内容
        async with aiofiles.open(path_obj, 'r', encoding=encoding) as f:
            content = await f.read()

        logger.debug(f"异步读取文本文件完成: {path_obj}")
        return content

    except Exception as e:
        logger.error(f"异步读取文本文件失败 {path_obj}: {e}")
        raise


async def async_read_bytes(file_path: Union[str, Path], size: Optional[int] = None, offset: int = 0) -> bytes:
    """
    异步读取二进制文件

    Args:
        file_path: 文件路径
        size: 读取字节数，None表示读取全部内容
        offset: 起始偏移量，默认从文件开头读取

    Returns:
        bytes: 文件内容

    Raises:
        FileNotFoundError: 文件不存在
        IOError: IO操作失败
    """
    path_obj = Path(file_path)

    try:
        logger.debug(f"开始异步读取二进制文件: {path_obj}, size={size}, offset={offset}")

        # 检查文件是否存在
        if not await async_exists(path_obj):
            raise FileNotFoundError(f"二进制文件不存在: {path_obj}")

        # 异步读取文件内容
        async with aiofiles.open(path_obj, 'rb') as f:
            # 如果有偏移量，先定位
            if offset > 0:
                await f.seek(offset)

            # 读取指定大小或全部内容
            if size is not None:
                content = await f.read(size)
            else:
                content = await f.read()

        logger.debug(f"异步读取二进制文件完成: {path_obj}, 读取了 {len(content)} 字节")
        return content

    except Exception as e:
        logger.error(f"异步读取二进制文件失败 {path_obj}: {e}")
        raise


async def async_exists(path: Union[str, Path]) -> bool:
    """
    异步检查路径是否存在

    Args:
        path: 路径

    Returns:
        bool: 路径是否存在

    Raises:
        OSError: 系统错误
    """
    try:
        return await aiofiles.os.path.exists(str(path))
    except Exception as e:
        logger.error(f"检查路径存在性失败 {path}: {e}")
        raise


async def async_stat(path: Union[str, Path]):
    """
    异步获取文件/目录状态信息

    Args:
        path: 路径

    Returns:
        os.stat_result: 状态信息

    Raises:
        FileNotFoundError: 路径不存在
        OSError: 系统错误
    """
    try:
        return await aiofiles.os.stat(str(path))
    except Exception as e:
        logger.error(f"获取路径状态失败 {path}: {e}")
        raise


async def async_try_read_text(file_path: Union[str, Path], encoding: str = 'utf-8') -> Optional[str]:
    """
    安全读取文本文件（不抛异常）

    与 async_read_text 的区别：
    - async_read_text: 文件不存在或读取失败时抛出异常
    - async_try_read_text: 返回 None，适合可选文件读取场景

    Args:
        file_path: 文件路径
        encoding: 编码格式，默认utf-8

    Returns:
        Optional[str]: 文件内容，失败或不存在返回 None
    """
    path_obj = Path(file_path)

    try:
        logger.debug(f"尝试异步读取文本文件: {path_obj}")

        # 直接读取，不提前检查存在性（避免多余的文件系统调用）
        async with aiofiles.open(path_obj, 'r', encoding=encoding) as f:
            content = await f.read()

        logger.debug(f"成功读取文本文件: {path_obj}")
        return content

    except FileNotFoundError:
        # 文件不存在，静默返回 None（不记录错误日志）
        logger.debug(f"文件不存在: {path_obj}")
        return None
    except Exception as e:
        logger.error(f"读取文件 {path_obj} 失败: {e}")
        return None


async def async_scandir(path: Union[str, Path]) -> list[os.DirEntry]:
    """
    异步扫描目录，返回 DirEntry 对象列表

    DirEntry 对象包含缓存的文件类型信息，调用 is_file()/is_dir() 不需要额外的 stat 系统调用，
    在网络文件系统上性能更好且不会阻塞事件循环

    Args:
        path: 目录路径

    Returns:
        list[os.DirEntry]: DirEntry 对象列表，可直接调用 .is_file()/.is_dir()/.path/.name

    Raises:
        FileNotFoundError: 目录不存在
        NotADirectoryError: 路径不是目录
        PermissionError: 权限不足
    """
    path_str = str(path)

    try:
        logger.debug(f"开始异步扫描目录: {path_str}")

        # 检查目录是否存在
        if not await async_exists(path_str):
            raise FileNotFoundError(f"目录不存在: {path_str}")

        # 使用 aiofiles.os.scandir 异步遍历目录
        entries = []
        with await aiofiles.os.scandir(path_str) as scanner:
            for entry in scanner:
                entries.append(entry)

        logger.debug(f"异步扫描目录完成: {path_str}, 找到 {len(entries)} 个项目")
        return entries

    except Exception as e:
        logger.error(f"异步扫描目录失败 {path_str}: {e}")
        raise


async def async_iterdir(path: Union[str, Path]) -> list[Path]:
    """
    异步遍历目录内容，返回 Path 对象列表

    注意: 返回的 Path 对象调用 is_file()/is_dir() 需要额外的 stat 调用（阻塞操作）
    如果需要判断文件类型，建议使用 async_scandir() 返回 DirEntry 对象

    Args:
        path: 目录路径

    Returns:
        list[Path]: Path 对象列表

    Raises:
        FileNotFoundError: 目录不存在
        NotADirectoryError: 路径不是目录
        PermissionError: 权限不足
    """
    path_str = str(path)

    try:
        logger.debug(f"开始异步遍历目录: {path_str}")

        # 检查目录是否存在
        if not await async_exists(path_str):
            raise FileNotFoundError(f"目录不存在: {path_str}")

        # 使用 aiofiles.os.scandir 异步遍历目录
        items = []
        with await aiofiles.os.scandir(path_str) as entries:
            for entry in entries:
                items.append(Path(entry.path))

        logger.debug(f"异步遍历目录完成: {path_str}, 找到 {len(items)} 个项目")
        return items

    except Exception as e:
        logger.error(f"异步遍历目录失败 {path_str}: {e}")
        raise


# ── Markdown with YAML frontmatter ───────────────────────────────────────────

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?", re.DOTALL)


@dataclass
class MarkdownFile:
    """Parsed Markdown file with optional YAML frontmatter.

    Attributes:
        raw:  Original file content as-is.
        meta: Parsed YAML frontmatter dict; empty if none present.
        body: Content after stripping the frontmatter block.
    """
    raw: str
    meta: Dict[str, Any] = field(default_factory=dict)
    body: str = ""


def _parse_markdown(raw: str) -> MarkdownFile:
    m = _FRONTMATTER_RE.match(raw)
    if not m:
        return MarkdownFile(raw=raw, meta={}, body=raw)
    try:
        meta = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        meta = {}
    return MarkdownFile(raw=raw, meta=meta, body=raw[m.end():])


async def async_read_markdown(file_path: Union[str, Path]) -> MarkdownFile:
    """Read and parse a Markdown file with optional YAML frontmatter.

    Raises:
        FileNotFoundError: if the file does not exist.
    """
    return _parse_markdown(await async_read_text(file_path))


async def async_try_read_markdown(file_path: Union[str, Path]) -> Optional[MarkdownFile]:
    """Read and parse a Markdown file; return None if the file does not exist."""
    raw = await async_try_read_text(file_path)
    return _parse_markdown(raw) if raw is not None else None
