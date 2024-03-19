"""File operations utilities for visual understanding."""
import os
import re
import uuid
import asyncio
import tempfile
from pathlib import Path
from typing import Optional, List
from agentlang.logger import get_logger
from agentlang.paths import PathManager
from app.utils.async_file_utils import (
    async_copy2,
    async_mkdir,
    async_exists,
    async_unlink,
    async_rmdir,
    async_scandir,
)
from .models import CopiedFileInfo

logger = get_logger(__name__)


def get_workspace_path() -> Path:
    """Get the workspace directory path using PathManager

    Returns:
        Path: Workspace directory path
    """
    # Use PathManager to get the workspace directory
    # .visual is relative to workspace, not project root
    workspace_dir = PathManager.get_workspace_dir()
    logger.debug(f"使用PathManager获取workspace目录: {workspace_dir}")
    return workspace_dir


def is_file_in_workspace(file_path: str) -> bool:
    """Check if file is within the workspace directory

    Args:
        file_path: File path to check

    Returns:
        bool: True if file is in workspace, False otherwise
    """
    workspace_path = get_workspace_path()
    file_abs_path = Path(file_path).resolve()
    workspace_abs_path = workspace_path.resolve()

    # Check if file is within workspace directory
    try:
        file_abs_path.relative_to(workspace_abs_path)
        logger.debug(f"文件在workspace内: {file_path}")
        return True
    except ValueError:
        logger.debug(f"文件不在workspace内: {file_path}")
        return False


async def copy_file_to_visual_dir(file_path: str, original_source: Optional[str] = None) -> Optional[CopiedFileInfo]:
    """Copy file to workspace/.visual directory

    Args:
        file_path: Local file path to copy
        original_source: Original source (URL or path) to extract file extension from

    Returns:
        Optional[CopiedFileInfo]: Information about the copied file, or None if failed
    """
    try:
        workspace_path = get_workspace_path()

        # Create .visual directory if not exists (under workspace)
        visual_dir = workspace_path / ".visual"
        await async_mkdir(visual_dir, parents=True, exist_ok=True)
        logger.debug(f"确保workspace/.visual目录存在: {visual_dir}")

        # Generate filename preserving original name
        original_file = Path(file_path)
        file_stem = original_file.stem
        file_suffix = original_file.suffix

        # If no file extension and original_source provided, extract from original_source
        if not file_suffix and original_source:
            # Extract extension from original source (URL or path)
            if re.match(r'^https?://', original_source):
                # For URL, extract from the path part before query parameters
                url_path = original_source.split('?')[0].split('#')[0]
                extracted_suffix = Path(url_path).suffix
                if extracted_suffix:
                    file_suffix = extracted_suffix
                    logger.debug(f"从原始URL提取文件扩展名: {original_source} -> {file_suffix}")
            else:
                # For local path
                extracted_suffix = Path(original_source).suffix
                if extracted_suffix:
                    file_suffix = extracted_suffix
                    logger.debug(f"从原始路径提取文件扩展名: {original_source} -> {file_suffix}")

        # Use original filename (keep hash filename) and just add extension
        unique_filename = f"{file_stem}{file_suffix}"

        copied_path = visual_dir / unique_filename
        # Relative path is relative to workspace (not project root)
        relative_path = f".visual/{unique_filename}"

        # 获取源文件大小
        from app.utils.async_file_utils import async_stat
        src_stat = await async_stat(file_path)
        src_size = src_stat.st_size

        # 复制文件，带重试机制
        max_retries = 3
        retry_delay = 0.2
        copy_success = False

        for attempt in range(1, max_retries + 1):
            logger.debug(f"尝试复制文件到 .visual 目录 (第 {attempt}/{max_retries} 次): {file_path} -> {copied_path}")

            await async_copy2(file_path, copied_path)

            # 给文件系统一点时间刷新
            import asyncio
            await asyncio.sleep(0.1)

            # 验证文件是否成功复制（大小一致且 > 0）
            try:
                dst_stat = await async_stat(copied_path)
                dst_size = dst_stat.st_size

                if dst_size > 0 and dst_size == src_size:
                    logger.info(f"文件复制成功 (尝试 {attempt}/{max_retries})，大小: {dst_size} bytes")
                    copy_success = True
                    break
                else:
                    logger.warning(f"文件复制后大小不匹配 (尝试 {attempt}/{max_retries}): 源={src_size}, 目标={dst_size}")
                    if attempt < max_retries:
                        await asyncio.sleep(retry_delay)
            except Exception as e:
                logger.warning(f"验证复制文件失败 (尝试 {attempt}/{max_retries}): {e}")
                if attempt < max_retries:
                    await asyncio.sleep(retry_delay)

        if not copy_success:
            raise IOError(f"文件复制失败，重试 {max_retries} 次后仍然失败: {file_path} -> {copied_path}")

        copied_file_info = CopiedFileInfo(
            original_path=str(Path(file_path).resolve()),
            copied_path=str(copied_path),
            relative_path=relative_path  # Relative to workspace
        )

        logger.info(f"文件已复制到workspace/.visual目录: {file_path} -> {relative_path}")
        return copied_file_info

    except Exception as e:
        logger.error(f"复制文件到workspace/.visual目录失败: {e}")
        return None


async def generate_file_download_url(relative_path: str, file_service) -> Optional[str]:
    """Generate download URL using file service

    Args:
        relative_path: Path relative to workspace (e.g., '.visual/a.png')
        file_service: FileService instance for URL generation

    Returns:
        Optional[str]: Download URL, or None if generation failed
    """
    logger.debug(f"生成下载链接，相对于workspace的路径: {relative_path}")

    # Add workspace prefix for FileService
    file_path_with_workspace = f"{relative_path}"
    logger.debug(f"添加workspace前缀后的路径: {file_path_with_workspace}")

    result = await file_service.get_file_download_url(
        file_path=file_path_with_workspace,  # Path with workspace prefix
        expires_in=3600  # 1 hour
    )

    download_url = result.get("download_url")
    if download_url:
        logger.info(f"生成下载链接成功: {relative_path} -> {download_url}")
        return download_url
    else:
        logger.error(f"下载链接生成失败，结果中没有download_url: {result}")
        return None


async def cleanup_copied_files(copied_files: List[CopiedFileInfo]):
    """Clean up files that were copied to .visual directory

    Args:
        copied_files: List of copied file information
    """
    if not copied_files:
        return

    for copied_file_info in copied_files:
        try:
            copied_path = Path(copied_file_info.copied_path)
            if await async_exists(copied_path):
                await async_unlink(copied_path)
                logger.debug(f"已清理复制的文件: {copied_file_info.relative_path}")
        except Exception as e:
            logger.warning(f"清理复制文件失败: {e}")


async def create_temp_directory() -> Optional[Path]:
    """Create a unique temporary directory for this operation

    Returns:
        Optional[Path]: Temporary directory path, or None if creation failed
    """
    try:
        # Create a new unique directory for each operation to avoid conflicts
        temp_dir_base = Path(tempfile.gettempdir())
        unique_dir_name = f"super_magic_visual_understanding_{uuid.uuid4()}"
        temp_dir = temp_dir_base / unique_dir_name
        await async_mkdir(temp_dir, parents=True, exist_ok=True)
        logger.debug(f"临时目录已创建: {temp_dir}")
        return temp_dir
    except Exception as e:
        logger.error(f"创建临时图片目录失败: {e}", exc_info=True)
        return None


async def cleanup_temp_directory(temp_dir: Path):
    """Clean up specific temporary directory

    Args:
        temp_dir: Temporary directory to clean up
    """
    if not temp_dir or not await async_exists(temp_dir):
        return

    try:
        # Remove all files in the temporary directory
        entries = await async_scandir(temp_dir)
        for entry in entries:
            if entry.is_file():
                await async_unlink(entry.path)

        # Remove the directory itself
        await async_rmdir(temp_dir)
        logger.debug(f"临时图片目录已清理: {temp_dir}")
    except Exception as e:
        logger.warning(f"清理临时图片目录失败: {e}")
