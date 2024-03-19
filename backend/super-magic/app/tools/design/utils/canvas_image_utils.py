"""
画布图片工具模块

提供画布图片处理的工具函数，包括：
- 自动图片尺寸读取
- 图片文件验证
- 图片信息获取
"""

import asyncio
from pathlib import Path
from typing import Tuple

from agentlang.logger import get_logger

logger = get_logger(__name__)


async def get_image_dimensions(image_path: Path) -> Tuple[int, int]:
    """
    从文件读取图片尺寸

    使用 PIL/Pillow 高效读取图片元数据，不会将整个图片加载到内存中。

    Args:
        image_path: 图片文件的绝对路径

    Returns:
        (宽度, 高度) 元组，单位为像素

    Raises:
        FileNotFoundError: 图片文件不存在
        ValueError: 文件不是有效的图片或无法读取
        ImportError: 未安装 PIL/Pillow

    Examples:
        >>> from pathlib import Path
        >>> width, height = await get_image_dimensions(Path("/path/to/image.jpg"))
        >>> print(f"Image size: {width}x{height}")
        Image size: 1920x1080
    """
    if not await asyncio.to_thread(image_path.exists):
        raise FileNotFoundError(f"Image file not found: {image_path}")

    try:
        from PIL import Image
    except ImportError as e:
        raise ImportError(
            "PIL/Pillow is required for image dimension reading. "
            "Install it with: pip install Pillow"
        ) from e

    def _read_image_size():
        with Image.open(image_path) as img:
            return img.size

    try:
        width, height = await asyncio.to_thread(_read_image_size)
        logger.debug(f"从 {image_path.name} 读取图片尺寸: {width}x{height}")
        return width, height
    except Exception as e:
        raise ValueError(f"无法读取图片尺寸 {image_path}: {e}") from e


async def validate_image_file(image_path: Path, workspace_path: Path) -> None:
    """
    验证图片文件是否存在且可访问

    Args:
        image_path: 图片文件的绝对路径
        workspace_path: 工作区根路径（用于错误消息）

    Raises:
        ValueError: 如果图片文件不存在或在工作区外

    Examples:
        >>> from pathlib import Path
        >>> await validate_image_file(
        ...     Path("/workspace/images/photo.jpg"),
        ...     Path("/workspace")
        ... )
    """
    # 检查文件是否存在
    if not await asyncio.to_thread(image_path.exists):
        # 计算相对路径以提供更好的错误消息
        try:
            relative_path = image_path.relative_to(workspace_path)
            raise ValueError(f"Image file not found: {relative_path}")
        except ValueError:
            raise ValueError(f"Image file not found: {image_path}")

    # 检查是否为文件（不是目录）
    if not await asyncio.to_thread(image_path.is_file):
        try:
            relative_path = image_path.relative_to(workspace_path)
            raise ValueError(f"Path is not a file: {relative_path}")
        except ValueError:
            raise ValueError(f"Path is not a file: {image_path}")

    # 检查是否在工作区内
    try:
        image_path.relative_to(workspace_path)
    except ValueError:
        raise ValueError(
            f"Image file is outside the workspace: {image_path}\n"
            f"Workspace path: {workspace_path}"
        )


async def get_image_info(
    src_relative: str,
    workspace_path: Path
) -> Tuple[int, int]:
    """
    从相对路径获取图片信息（尺寸）

    这是一个便捷函数，结合了路径解析、验证和尺寸读取。

    Args:
        src_relative: 相对于工作区根目录的图片路径
        workspace_path: 工作区根路径

    Returns:
        (宽度, 高度) 元组，单位为像素

    Raises:
        ValueError: 如果图片文件无效或无法读取

    Examples:
        >>> from pathlib import Path
        >>> width, height = await get_image_info(
        ...     "Demo/images/photo.jpg",
        ...     Path("/workspace")
        ... )
        >>> print(f"Image size: {width}x{height}")
        Image size: 1920x1080
    """
    # 解析绝对路径
    image_path = workspace_path / src_relative

    # 验证文件
    await validate_image_file(image_path, workspace_path)

    # 读取尺寸
    return await get_image_dimensions(image_path)
