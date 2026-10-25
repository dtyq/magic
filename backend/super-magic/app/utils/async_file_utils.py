# -*- coding: utf-8 -*-
"""
异步文件操作工具模块

提供统一的异步文件操作工具函数，用于替换checkpoint模块中的阻塞文件操作。
包括文件复制、目录操作、JSON文件读写等。
"""

import asyncio
import errno
import json
import os
import re
import shutil
from collections.abc import AsyncIterable, AsyncIterator
from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Union

import aiofiles
import aiofiles.os
import yaml

from agentlang.logger import get_logger

logger = get_logger(__name__)


async def async_copy_contents(
    src: Union[str, Path],
    dst: Union[str, Path],
    chunk_size: int = 1024 * 1024,
) -> None:
    """以异步分块读写复制文件内容，不处理文件元数据。"""
    src_path = Path(src)
    dst_path = Path(dst)
    await async_mkdir(dst_path.parent, parents=True, exist_ok=True)
    async with aiofiles.open(src_path, "rb") as source_stream:
        async with aiofiles.open(dst_path, "wb") as destination_stream:
            while chunk := await source_stream.read(chunk_size):
                await destination_stream.write(chunk)


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

        # 分块复制，避免大文件一次性读入内存
        async with aiofiles.open(src_path, 'rb') as src_file:
            async with aiofiles.open(dst_path, 'wb') as dst_file:
                while chunk := await src_file.read(1024 * 1024):
                    await dst_file.write(chunk)

        # 复制文件元数据（时间戳、权限）
        stat = await aiofiles.os.stat(str(src_path))
        await asyncio.to_thread(os.utime, str(dst_path), (stat.st_atime, stat.st_mtime))
        await asyncio.to_thread(os.chmod, str(dst_path), stat.st_mode)

        logger.debug(f"异步复制文件完成: {src_path} -> {dst_path}")

    except Exception as e:
        logger.error(f"异步复制文件失败 {src_path} -> {dst_path}: {e}")
        raise


class CopyConflict(StrEnum):
    """目录复制时的冲突处理策略。"""
    ERROR = "error"
    OVERWRITE = "overwrite"
    SKIP = "skip"


async def async_copytree(
    src: Union[str, Path],
    dst: Union[str, Path],
    on_conflict: CopyConflict = CopyConflict.ERROR,
    exclude: Optional[set] = None,
    symlinks: bool = False,
) -> None:
    """
    异步复制目录树

    Args:
        src: 源目录路径
        dst: 目标目录路径
        on_conflict: 目标已存在时的冲突策略
            - ERROR: 目标存在即报错（默认，向后兼容）
            - OVERWRITE: 目录合并，同名文件覆盖
            - SKIP: 目录合并，已有文件保留不动
        exclude: 要跳过的文件名集合（仅匹配文件名，不含路径）
        symlinks: 是否保留源目录中的软链

    Raises:
        FileNotFoundError: 源目录不存在
        FileExistsError: 目标目录已存在（仅 ERROR 策略）
        PermissionError: 权限不足
    """
    src_path = Path(src)
    dst_path = Path(dst)
    ignore_func = shutil.ignore_patterns(*exclude) if exclude else None

    try:
        logger.debug(f"开始异步复制目录: {src_path} -> {dst_path} (on_conflict={on_conflict}, exclude={exclude})")

        if on_conflict == CopyConflict.SKIP:
            def _copy_skip(src_f: str, dst_f: str) -> None:
                if not os.path.exists(dst_f):
                    shutil.copy2(src_f, dst_f)

            await asyncio.to_thread(
                shutil.copytree, src_path, dst_path,
                copy_function=_copy_skip, dirs_exist_ok=True,
                ignore=ignore_func, symlinks=symlinks,
            )
        elif on_conflict == CopyConflict.OVERWRITE:
            await asyncio.to_thread(
                shutil.copytree, src_path, dst_path, dirs_exist_ok=True,
                ignore=ignore_func, symlinks=symlinks,
            )
        else:
            await asyncio.to_thread(shutil.copytree, src_path, dst_path, ignore=ignore_func, symlinks=symlinks)

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

    except FileNotFoundError:
        # 目录在 exists 检查之后、rmtree 执行之前被其他操作删除，属于正常竞争情况
        logger.warning(f"删除目录时目录已不存在（竞争条件），跳过: {path_obj}")
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
        IsADirectoryError: 路径是目录
        PermissionError: 权限不足
    """
    path_str = str(path)

    try:
        logger.debug(f"开始异步删除文件: {path_str}")

        if await async_exists(path_str) or await async_is_symlink(path_str):
            await aiofiles.os.remove(path_str)
            logger.debug(f"异步删除文件完成: {path_str}")
        else:
            logger.debug(f"文件不存在，跳过删除: {path_str}")

    except FileNotFoundError:
        # 文件在 exists 检查之后、remove 执行之前被其他操作删除，属于正常竞争情况，不做报错
        logger.warning(f"删除文件时文件已不存在（竞争条件），跳过: {path_str}")
    except Exception as e:
        logger.error(f"异步删除文件失败 {path_str}: {e}")
        raise


async def async_mkstemp(
    suffix: Optional[str] = None,
    prefix: Optional[str] = None,
    dir: Optional[Union[str, Path]] = None,
) -> tuple[int, str]:
    """
    异步创建临时文件，是 tempfile.mkstemp 的异步封装。

    Args:
        suffix: 文件名后缀，例如 '.jpg'
        prefix: 文件名前缀
        dir: 临时文件所在目录，默认使用系统临时目录

    Returns:
        (fd, path): fd 是已打开的文件描述符，path 是临时文件的绝对路径。
        调用方负责关闭 fd（可使用 async_close_fd）并在使用完毕后删除文件。
    """
    import tempfile

    kwargs = {}
    if suffix is not None:
        kwargs["suffix"] = suffix
    if prefix is not None:
        kwargs["prefix"] = prefix
    if dir is not None:
        kwargs["dir"] = str(dir)

    fd, path = await asyncio.to_thread(tempfile.mkstemp, **kwargs)
    logger.debug(f"创建临时文件: {path}")
    return fd, path


async def async_create_temp_text_file(
    content: str,
    *,
    suffix: str = "",
    prefix: str = "",
    directory: Union[str, Path],
    encoding: str = "utf-8",
) -> Path:
    """排他创建临时文本文件，并通过 mkstemp 返回的文件描述符完成写入。"""
    import tempfile

    def _create_and_write() -> Path:
        fd = -1
        path: str | None = None
        try:
            fd, path = tempfile.mkstemp(
                suffix=suffix,
                prefix=prefix,
                dir=str(directory),
                text=True,
            )
            file_object = os.fdopen(fd, "w", encoding=encoding)
            fd = -1
            with file_object:
                file_object.write(content)
                file_object.flush()
            return Path(path)
        except BaseException:
            if fd >= 0:
                os.close(fd)
            if path is not None:
                try:
                    os.unlink(path)
                except FileNotFoundError:
                    pass
            raise

    create_task = asyncio.create_task(asyncio.to_thread(_create_and_write))
    try:
        file_path = await asyncio.shield(create_task)
    except asyncio.CancelledError as cancellation:
        try:
            file_path = await create_task
        except BaseException:
            raise cancellation
        try:
            await async_unlink(file_path)
        finally:
            raise cancellation
    logger.debug(f"创建并写入临时文本文件: {file_path}")
    return file_path


async def async_gettempdir() -> Path:
    """异步获取当前运行环境选择的系统临时目录。"""
    import tempfile

    return Path(await asyncio.to_thread(tempfile.gettempdir))


async def async_close_fd(fd: int) -> None:
    """
    异步关闭文件描述符，是 os.close 的异步封装。

    Args:
        fd: 要关闭的文件描述符，通常由 async_mkstemp 返回
    """
    await asyncio.to_thread(os.close, fd)


async def async_rename(src: Union[str, Path], dst: Union[str, Path]) -> None:
    """
    异步重命名/移动文件或目录

    Args:
        src: 源路径
        dst: 目标路径

    Raises:
        FileNotFoundError: 源路径不存在
        PermissionError: 权限不足
    """
    src_str = str(src)
    dst_str = str(dst)

    try:
        logger.debug(f"开始异步重命名: {src_str} -> {dst_str}")
        await aiofiles.os.rename(src_str, dst_str)
        logger.debug(f"异步重命名完成: {src_str} -> {dst_str}")
    except Exception as e:
        logger.error(f"异步重命名失败 {src_str} -> {dst_str}: {e}")
        raise


async def async_move_file(src: Union[str, Path], dst: Union[str, Path]) -> None:
    """
    异步移动文件，支持跨文件系统移动。

    与 async_rename 不同，本函数只用于文件移动语义：优先使用 rename；
    如果源和目标位于不同设备（例如 /tmp -> S3 挂载的 .workspace），
    则回退为复制文件内容后删除源文件。

    Args:
        src: 源文件路径
        dst: 目标文件路径

    Raises:
        FileNotFoundError: 源路径不存在
        IsADirectoryError: 源路径或目标路径是目录
        PermissionError: 权限不足
        OSError: 移动失败
    """
    src_path = Path(src)
    dst_path = Path(dst)
    src_str = str(src_path)
    dst_str = str(dst_path)

    try:
        logger.debug(f"开始异步移动文件: {src_str} -> {dst_str}")
        await async_mkdir(dst_path.parent, parents=True, exist_ok=True)
        await aiofiles.os.rename(src_str, dst_str)
        logger.debug(f"异步移动文件完成(rename): {src_str} -> {dst_str}")
    except OSError as e:
        if e.errno != errno.EXDEV:
            logger.error(f"异步移动文件失败 {src_str} -> {dst_str}: {e}")
            raise
        logger.warning(f"跨设备移动文件，改用复制后删除: {src_str} -> {dst_str}")
        try:
            await asyncio.to_thread(shutil.copyfile, src_path, dst_path)
            await aiofiles.os.remove(src_str)
            logger.debug(f"异步移动文件完成(copy+unlink): {src_str} -> {dst_str}")
        except Exception as copy_error:
            logger.error(f"跨设备移动文件失败 {src_str} -> {dst_str}: {copy_error}")
            raise


async def async_move_path(src: Union[str, Path], dst: Union[str, Path]) -> None:
    """
    异步移动文件或目录，支持跨文件系统。

    Args:
        src: 源路径
        dst: 目标路径

    Raises:
        FileNotFoundError: 源路径不存在
        PermissionError: 权限不足
        OSError: 移动失败
    """
    src_path = Path(src)
    dst_path = Path(dst)

    try:
        logger.debug(f"开始异步移动路径: {src_path} -> {dst_path}")
        await async_mkdir(dst_path.parent, parents=True, exist_ok=True)
        await asyncio.to_thread(shutil.move, str(src_path), str(dst_path))
        logger.debug(f"异步移动路径完成: {src_path} -> {dst_path}")
    except Exception as e:
        logger.error(f"异步移动路径失败 {src_path} -> {dst_path}: {e}")
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

    except FileNotFoundError:
        # 目录在 exists 检查之后、rmdir 执行之前被其他操作删除，属于正常竞争情况
        logger.warning(f"删除空目录时目录已不存在（竞争条件），跳过: {path_str}")
    except Exception as e:
        logger.error(f"异步删除空目录失败 {path_str}: {e}")
        raise


async def async_symlink(
    src: Union[str, Path],
    dst: Union[str, Path],
    target_is_directory: bool = False,
) -> None:
    """
    异步创建软链

    Args:
        src: 软链目标路径
        dst: 软链路径
        target_is_directory: 目标是否为目录，主要用于兼容 Windows 软链语义

    Raises:
        FileExistsError: 软链路径已存在
        PermissionError: 权限不足
        OSError: 创建失败
    """
    src_path = Path(src)
    dst_path = Path(dst)

    try:
        logger.debug(f"开始异步创建软链: {dst_path} -> {src_path}")
        await asyncio.to_thread(os.symlink, str(src_path), str(dst_path), target_is_directory=target_is_directory)
        logger.debug(f"异步创建软链完成: {dst_path} -> {src_path}")
    except Exception as e:
        logger.error(f"异步创建软链失败 {dst_path} -> {src_path}: {e}")
        raise


async def async_readlink(path: Union[str, Path]) -> str:
    """
    异步读取软链目标

    Args:
        path: 软链路径

    Returns:
        str: 软链保存的目标路径，保留相对路径形式

    Raises:
        OSError: 路径不是软链或读取失败
    """
    try:
        return await asyncio.to_thread(os.readlink, str(path))
    except Exception as e:
        logger.error(f"异步读取软链失败 {path}: {e}")
        raise


async def async_realpath(path: Union[str, Path], *, strict: bool = False) -> Path:
    """异步解析路径中的软链，返回规范化绝对路径。"""
    try:
        resolved = await asyncio.to_thread(os.path.realpath, str(path), strict=strict)
        return Path(resolved)
    except Exception as e:
        logger.error(f"异步解析真实路径失败 {path}: {e}")
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


async def async_create_json(file_path: Union[str, Path], data: Dict[str, Any], **kwargs) -> None:
    """以排他方式异步创建 JSON 文件，目标已存在时抛出 FileExistsError。

    Args:
        file_path: 文件路径
        data: 要写入的数据
        **kwargs: json.dumps 的额外参数

    Raises:
        FileExistsError: 目标文件已经存在
        PermissionError: 权限不足
        IOError: IO 操作失败
        TypeError: 数据无法序列化
    """
    path_obj = Path(file_path)

    try:
        await async_mkdir(path_obj.parent, parents=True, exist_ok=True)
        json_str = await asyncio.to_thread(json.dumps, data, **kwargs)
        async with aiofiles.open(path_obj, 'x', encoding='utf-8') as file:
            await file.write(json_str)
    except FileExistsError:
        logger.debug(f"排他创建 JSON 文件时目标已存在: {path_obj}")
        raise
    except Exception as error:
        logger.error(f"排他创建 JSON 文件失败 {path_obj}: {error}")
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


async def async_append_text(file_path: Union[str, Path], content: str, encoding: str = 'utf-8') -> None:
    """
    异步追加文本，保留原文件并沿用追加写语义，不使用临时文件替换。

    网络挂载路径的 rename/replace 可能产生新的文件记录；追加应写现有对象，不重建整文件。
    """
    async with aiofiles.open(file_path, "a", encoding=encoding) as stream:
        await stream.write(content)


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


async def async_write_text_with_retry(
    file_path: Union[str, Path],
    content: str,
    encoding: str = 'utf-8',
    max_retries: int = 5,
    retry_delay: float = 0.2,
    content_validator: Optional[Callable[[str], bool]] = None,
) -> None:
    """
    写入文本文件并验证写入结果，适用于存在同步延迟的网络存储。

    写入完成后进入轮询验证循环：依次检查文件存在、大小非零、内容非空，
    若提供了 content_validator 则额外执行自定义校验。任一检查失败时重试；
    超过 max_retries 次后抛出 IOError。

    Args:
        file_path: 文件路径
        content: 文本内容
        encoding: 编码格式，默认 utf-8
        max_retries: 最大验证重试次数，默认 5
        retry_delay: 每次验证前等待秒数，默认 0.2
        content_validator: 可选，接收已写入的文本并返回 bool；
            返回 False 视为内容无效，触发重试
    """
    path_obj = Path(file_path)
    await async_write_text(path_obj, content, encoding=encoding)

    for attempt in range(max_retries):
        await asyncio.sleep(retry_delay)

        try:
            # MagicFS 的路径 stat 可能短暂保留覆盖前的大小；新句柄的 fstat
            # 能观察到已写入的文件，避免把成功覆盖误判为空文件。
            file_stat = await async_fresh_stat(path_obj)
        except FileNotFoundError:
            if attempt < max_retries - 1:
                logger.warning(f"File does not exist after write, retrying... (attempt {attempt + 1}/{max_retries}): {path_obj}")
                continue
            raise IOError(f"File does not exist after write: {path_obj}")

        if file_stat.st_size == 0:
            if attempt < max_retries - 1:
                logger.warning(f"File is empty after write, retrying... (attempt {attempt + 1}/{max_retries}): {path_obj}")
                continue
            raise IOError(f"File is empty after write: {path_obj}")

        written_content = await async_read_text(path_obj, encoding=encoding)
        if not written_content or not written_content.strip():
            if attempt < max_retries - 1:
                logger.warning(f"File content is empty after write, retrying... (attempt {attempt + 1}/{max_retries}): {path_obj}")
                continue
            raise IOError(f"File content is empty after write: {path_obj}")

        if content_validator is not None and not content_validator(written_content):
            if attempt < max_retries - 1:
                logger.warning(f"File content failed validation after write, retrying... (attempt {attempt + 1}/{max_retries}): {path_obj}")
                continue
            raise IOError(f"File content failed validation after write: {path_obj}")

        logger.info(f"Verified file write success: {path_obj} (size: {file_stat.st_size} bytes, attempt: {attempt + 1})")
        return

    raise IOError(f"File write verification failed after {max_retries} retries: {path_obj}")


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


async def async_write_bytes_iter(
    file_path: Union[str, Path],
    chunks: AsyncIterable[bytes],
    *,
    append: bool = False,
) -> int:
    """将异步字节流分块写入文件，返回本次写入的字节数。"""
    path = Path(file_path)
    await async_mkdir(path.parent, parents=True, exist_ok=True)
    mode = "ab" if append else "wb"
    written = 0

    async with aiofiles.open(path, mode) as file:
        async for chunk in chunks:
            await file.write(chunk)
            written += len(chunk)

    return written


async def async_read_text(file_path: Union[str, Path], encoding: str = 'utf-8', errors: Optional[str] = None) -> str:
    """
    异步读取文本文件

    Args:
        file_path: 文件路径
        encoding: 编码格式，默认utf-8
        errors: 解码错误处理策略，例如 "replace" 或 "ignore"

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
        async with aiofiles.open(path_obj, 'r', encoding=encoding, errors=errors) as f:
            content = await f.read()

        logger.debug(f"异步读取文本文件完成: {path_obj}")
        return content

    except Exception as e:
        logger.error(f"异步读取文本文件失败 {path_obj}: {e}")
        raise


def _count_text_lines_sync(file_path: Path, encoding: str) -> int:
    """同步统计文本文件行数，供 asyncio.to_thread 调用。"""
    with file_path.open('r', encoding=encoding) as f:
        return sum(1 for _ in f)


async def async_count_text_lines(file_path: Union[str, Path], encoding: str = 'utf-8') -> int:
    """
    异步统计文本文件行数

    通过线程池执行流式逐行统计，避免阻塞事件循环，也避免整文件读入内存。

    Args:
        file_path: 文件路径
        encoding: 编码格式，默认utf-8

    Returns:
        int: 文件总行数

    Raises:
        FileNotFoundError: 文件不存在
        IOError: IO操作失败
        UnicodeDecodeError: 文本解码失败
    """
    path_obj = Path(file_path)

    try:
        return await asyncio.to_thread(_count_text_lines_sync, path_obj, encoding)
    except Exception as e:
        logger.error(f"异步统计文本文件行数失败 {path_obj}: {e}")
        raise


async def async_try_count_text_lines(file_path: Union[str, Path], encoding: str = 'utf-8') -> Optional[int]:
    """
    安全统计文本文件行数（不抛异常）

    与 async_count_text_lines 的区别：
    - async_count_text_lines: 文件不存在或统计失败时抛出异常
    - async_try_count_text_lines: 返回 None，适合附加信息统计场景

    Args:
        file_path: 文件路径
        encoding: 编码格式，默认utf-8

    Returns:
        Optional[int]: 文件总行数，失败或不存在返回 None
    """
    path_obj = Path(file_path)

    try:
        return await async_count_text_lines(path_obj, encoding=encoding)
    except FileNotFoundError:
        return None
    except Exception as e:
        logger.error(f"统计文件 {path_obj} 行数失败: {e}")
        return None


async def async_realpath(path: Union[str, Path], *, strict: bool = False) -> Path:
    """
    异步解析链接，供边界层校验目标仍在允许的目录内。

    这里只把可能阻塞的路径解析移出事件循环；是否允许访问由调用方结合自己的作用域决定。
    """
    return Path(await asyncio.to_thread(os.path.realpath, str(path), strict=strict))


async def async_fresh_stat(file_path: str | Path) -> os.stat_result:
    """
    打开文件取 fstat，避免仅使用网络挂载的路径元数据缓存。

    只用于写后验证等必须观察当前内容的场景；常规高频探测仍使用
    async_stat，避免为每次检查额外打开文件。
    """
    async with aiofiles.open(file_path, "rb") as stream:
        return await asyncio.to_thread(os.fstat, stream.fileno())


async def async_read_bytes_iter(file_path: str | Path, *, chunk_size: int = 256 * 1024) -> AsyncIterator[bytes]:
    """
    使用单个句柄分段读取，结束或取消时关闭文件。

    只降低测量时的峰值内存，不减少总读取量。不得用它替换大文件的 mtime 快速探测。
    调用方提前停止时使用 aclosing，保证异步生成器及时退出文件上下文。
    """
    if chunk_size <= 0:
        raise ValueError("Read chunk size must be positive")
    async with aiofiles.open(file_path, "rb") as stream:
        while chunk := await stream.read(chunk_size):
            yield chunk


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


async def async_is_dir(path: Union[str, Path]) -> bool:
    """
    异步检查路径是否为目录

    Args:
        path: 路径

    Returns:
        bool: 路径是否为目录

    Raises:
        OSError: 系统错误
    """
    try:
        return await aiofiles.os.path.isdir(str(path))
    except Exception as e:
        logger.error(f"检查路径是否为目录失败 {path}: {e}")
        raise


async def async_is_file(path: Union[str, Path]) -> bool:
    """
    异步检查路径是否为文件

    Args:
        path: 路径

    Returns:
        bool: 路径是否为文件

    Raises:
        OSError: 系统错误
    """
    try:
        return await aiofiles.os.path.isfile(str(path))
    except Exception as e:
        logger.error(f"检查路径是否为文件失败 {path}: {e}")
        raise


async def async_is_symlink(path: Union[str, Path]) -> bool:
    """
    异步检查路径是否为软链

    Args:
        path: 路径

    Returns:
        bool: 路径是否为软链

    Raises:
        OSError: 系统错误
    """
    try:
        return await aiofiles.os.path.islink(str(path))
    except Exception as e:
        logger.error(f"检查路径是否为软链失败 {path}: {e}")
        raise


async def async_stat(path: Union[str, Path]) -> os.stat_result:
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
    except FileNotFoundError:
        # 可选文件尚未创建不一定是业务错误；保留异常，由调用方判断缺失状态。
        logger.debug(f"路径不存在: {path}")
        raise
    except Exception as e:
        logger.error(f"获取路径状态失败 {path}: {e}")
        raise


async def async_lstat(path: Union[str, Path]) -> os.stat_result:
    """
    异步获取路径自身的状态信息，不跟随软链

    与 async_stat 的区别：路径本身是软链时返回软链自己的 stat，而不是目标
    文件的 stat。因此一次调用就能用 st_mode 判定三种状态——软链
    （S_ISLNK）、真实文件/目录、以及由 FileNotFoundError 表示的缺失。
    在 AGFS 这类网络挂载上，这把"是否存在 / 是否软链 / 指向哪里"的多次探测
    收敛成一次 syscall。

    例：/app/.user/.lark-cli/cache 在一次挂载上分别是"缺失"、"已是指向
    target 的软链"或"被真实目录占用"，调用方据此决定创建、保留还是先清理。

    Args:
        path: 路径

    Returns:
        os.stat_result: 路径自身的状态信息

    Raises:
        FileNotFoundError: 路径不存在
        OSError: 系统错误
    """
    try:
        # aiofiles 未提供 lstat，按 async_readlink 的既有方式走线程池。
        return await asyncio.to_thread(os.lstat, str(path))
    except FileNotFoundError:
        # 路径缺失是需要与"被真实文件占用"区分开的正常状态，交由调用方判断。
        logger.debug(f"路径不存在: {path}")
        raise
    except Exception as e:
        logger.error(f"获取路径状态失败 {path}: {e}")
        raise


async def async_chmod(path: Union[str, Path], mode: int) -> None:
    """
    异步修改路径权限。

    Args:
        path: 文件或目录路径
        mode: 目标权限位

    Raises:
        FileNotFoundError: 路径不存在
        PermissionError: 权限不足
        OSError: 修改失败
    """
    try:
        await asyncio.to_thread(os.chmod, str(path), mode)
    except Exception as e:
        logger.error(f"修改路径权限失败 {path}: {e}")
        raise


async def async_access(path: Union[str, Path], mode: int) -> bool:
    """
    异步检查当前进程是否具备指定访问权限。

    Args:
        path: 文件或目录路径
        mode: os.R_OK / os.W_OK / os.X_OK 等权限位

    Returns:
        bool: 是否具备权限
    """
    try:
        return await asyncio.to_thread(os.access, str(path), mode)
    except Exception as e:
        logger.error(f"检查路径访问权限失败 {path}: {e}")
        raise


async def async_replace(src: Union[str, Path], dst: Union[str, Path]) -> None:
    """
    异步原子替换路径。

    Args:
        src: 临时源路径
        dst: 目标路径

    Raises:
        FileNotFoundError: 源路径不存在
        PermissionError: 权限不足
        OSError: 替换失败
    """
    try:
        await asyncio.to_thread(os.replace, str(src), str(dst))
    except Exception as e:
        logger.error(f"原子替换路径失败 {src} -> {dst}: {e}")
        raise


async def async_which(command: str, path: Optional[str] = None) -> Optional[str]:
    """
    异步查找 PATH 中的可执行命令。

    Args:
        command: 命令名称
        path: 可选 PATH 字符串

    Returns:
        Optional[str]: 命令路径，未找到时返回 None
    """
    try:
        return await asyncio.to_thread(shutil.which, command, path=path)
    except Exception as e:
        logger.error(f"查找命令失败 {command}: {e}")
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


async def async_try_read_json(file_path: Union[str, Path]) -> Optional[Dict[str, Any]]:
    """安全读取 JSON 文件（不抛异常）。

    文件不存在时静默返回 None；JSON 解析失败或其他 IO 错误才打 ERROR 日志。
    适合读取"可能不存在"的可选配置/状态文件。

    Returns:
        Optional[Dict[str, Any]]: 解析后的 JSON 数据，文件不存在时返回 None
    """
    path_obj = Path(file_path)
    try:
        async with aiofiles.open(path_obj, 'r', encoding='utf-8') as f:
            content = await f.read()
        return await asyncio.to_thread(json.loads, content)
    except FileNotFoundError:
        logger.debug(f"JSON 文件不存在（忽略）: {path_obj}")
        return None
    except Exception as e:
        logger.error(f"读取 JSON 文件失败 {path_obj}: {e}")
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


def _read_magicfs_file_id(filepath: str) -> Optional[str]:
    """Synchronous xattr read, intended to run in a thread pool."""
    try:
        raw = os.getxattr(filepath, "user.magicfs.file_id")  # type: ignore[attr-defined]
        return raw.decode("utf-8").strip("\"'")
    except (OSError, AttributeError):
        return None


async def get_file_id_from_xattr(filepath: Union[str, Path]) -> Optional[str]:
    """
    Read the magicfs file ID from extended attributes (user.magicfs.file_id).

    Runs in a thread pool via ``asyncio.to_thread`` because magicfs is a
    FUSE-based filesystem where xattr reads involve user-space IPC and can
    block the event loop for a non-trivial amount of time.

    Only available on Linux; returns None silently on other platforms or when
    the attribute is absent.

    Args:
        filepath: path to the file or directory

    Returns:
        Optional[str]: the file ID (e.g. "877250661392134145"), or None
    """
    return await asyncio.to_thread(_read_magicfs_file_id, str(filepath))


def _read_magicfs_s3_key(filepath: str) -> Optional[str]:
    """Synchronous xattr read for s3_key, intended to run in a thread pool."""
    try:
        raw = os.getxattr(filepath, "user.magicfs.s3_key")  # type: ignore[attr-defined]
        return raw.decode("utf-8").strip("\"'")
    except (OSError, AttributeError):
        return None


async def get_s3_key_from_xattr(filepath: Union[str, Path]) -> Optional[str]:
    """
    Read the magicfs S3 object key from extended attributes (user.magicfs.s3_key).

    Runs in a thread pool via ``asyncio.to_thread`` because magicfs is a
    FUSE-based filesystem where xattr reads involve user-space IPC and can
    block the event loop for a non-trivial amount of time.

    Only available on Linux; returns None silently on other platforms or when
    the attribute is absent.

    Args:
        filepath: path to the file or directory

    Returns:
        Optional[str]: the S3 object key
            (e.g. "TGosRaFhvb/588417216353927169/project_xxx/workspace/877250661392134145"),
            or None when unavailable
    """
    return await asyncio.to_thread(_read_magicfs_s3_key, str(filepath))


def _read_magicfs_metadata_version(filepath: str) -> Optional[str]:
    """Synchronous xattr read for metadata_version, intended to run in a thread pool."""
    try:
        raw = os.getxattr(filepath, "user.magicfs.metadata_version")  # type: ignore[attr-defined]
        return raw.decode("utf-8").strip("\"'")
    except (OSError, AttributeError):
        return None


async def get_metadata_version_from_xattr(filepath: Union[str, Path]) -> Optional[str]:
    """
    Read the magicfs metadata version from extended attributes (user.magicfs.metadata_version).

    Runs in a thread pool via ``asyncio.to_thread`` because magicfs is a
    FUSE-based filesystem where xattr reads involve user-space IPC and can
    block the event loop for a non-trivial amount of time.

    Only available on Linux; returns None silently on other platforms or when
    the attribute is absent.

    Args:
        filepath: path to the file or directory

    Returns:
        Optional[str]: the metadata version string, or None when unavailable
    """
    return await asyncio.to_thread(_read_magicfs_metadata_version, str(filepath))


def _read_magicfs_content_version(filepath: str) -> Optional[str]:
    """Synchronous xattr read for content_version, intended to run in a thread pool."""
    try:
        raw = os.getxattr(filepath, "user.magicfs.content_version")  # type: ignore[attr-defined]
        return raw.decode("utf-8").strip("\"'")
    except (OSError, AttributeError):
        return None


async def get_content_version_from_xattr(filepath: Union[str, Path]) -> Optional[str]:
    """
    Read the magicfs content version from extended attributes (user.magicfs.content_version).

    Runs in a thread pool via ``asyncio.to_thread`` because magicfs is a
    FUSE-based filesystem where xattr reads involve user-space IPC and can
    block the event loop for a non-trivial amount of time.

    Only available on Linux; returns None silently on other platforms or when
    the attribute is absent.

    Args:
        filepath: path to the file or directory

    Returns:
        Optional[str]: the content version string, or None when unavailable
    """
    return await asyncio.to_thread(_read_magicfs_content_version, str(filepath))


def _write_magicfs_content_version(filepath: str, version: str) -> None:
    """Synchronous xattr write for content_version, intended to run in a thread pool."""
    os.setxattr(filepath, "user.magicfs.content_version", version.encode("utf-8"))  # type: ignore[attr-defined]


async def set_content_version_to_xattr(filepath: Union[str, Path], version: str) -> None:
    """
    Write the magicfs content version to extended attributes (user.magicfs.content_version).

    Runs in a thread pool via ``asyncio.to_thread`` because magicfs is a
    FUSE-based filesystem where xattr writes involve user-space IPC and can
    block the event loop for a non-trivial amount of time.

    Only available on Linux; raises OSError on other platforms.

    Args:
        filepath: path to the file or directory
        version: version string to write (e.g. "3")
    """
    await asyncio.to_thread(_write_magicfs_content_version, str(filepath), version)


def _list_xattr_names(filepath: str) -> list[str]:
    """Synchronous xattr name listing, intended to run in a thread pool."""
    try:
        return os.listxattr(filepath)  # type: ignore[attr-defined]
    except (OSError, AttributeError):
        return []


async def async_list_xattr_names(filepath: Union[str, Path]) -> list[str]:
    """
    List extended attribute names of a path (e.g. ["user.magicfs.file_id", ...]).

    Runs in a thread pool via ``asyncio.to_thread`` because AGFS plugins are
    FUSE-based and xattr calls involve user-space IPC.

    Only available on Linux; returns an empty list on other platforms, when the
    path does not exist, or when the filesystem does not support xattrs.

    Args:
        filepath: path to the file or directory

    Returns:
        list[str]: attribute names, possibly empty
    """
    return await asyncio.to_thread(_list_xattr_names, str(filepath))


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

        # scandir 返回迭代器后，逐项读取仍可能触发网络 I/O；整个扫描都在线程中完成。
        def scan_paths() -> list[Path]:
            with os.scandir(path_str) as entries:
                return [Path(entry.path) for entry in entries]

        items = await asyncio.to_thread(scan_paths)

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
