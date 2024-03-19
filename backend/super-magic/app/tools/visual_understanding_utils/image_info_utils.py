"""Image information extraction utilities."""
import os
import asyncio
from typing import Optional, Tuple, Any
from PIL import Image
from agentlang.logger import get_logger
from app.utils.async_file_utils import async_exists, async_stat

logger = get_logger(__name__)


async def get_image_dimensions(image_path: str) -> tuple[Optional[Tuple[int, int]], Optional[float], Optional[int]]:
    """获取图片尺寸信息

    Args:
        image_path: 图片文件路径

    Returns:
        Tuple containing:
        - Optional[Tuple[int, int]]: Image size in pixels (width, height)
        - Optional[float]: Aspect ratio (width/height)
        - Optional[int]: File size in bytes
    """
    try:
        # Get file size
        file_size = None
        if await async_exists(image_path):
            stat_result = await async_stat(image_path)
            file_size = stat_result.st_size

        # Get image dimensions using PIL (在线程中执行，因为PIL没有异步版本)
        def _get_dimensions():
            with Image.open(image_path) as img:
                return img.size

        width, height = await asyncio.to_thread(_get_dimensions)
        aspect_ratio = width / height if height > 0 else None

        aspect_ratio_str = f"{aspect_ratio:.2f}" if aspect_ratio else "N/A"
        logger.debug(f"图片尺寸获取成功: {image_path} -> {width}x{height}, 宽高比: {aspect_ratio_str}, 文件大小: {file_size} bytes")
        return (width, height), aspect_ratio, file_size

    except Exception as e:
        logger.warning(f"获取图片尺寸失败 {image_path}: {e}")
        return None, None, None


def calculate_and_format_aspect_ratio(width: Any, height: Any, format_style: str = "chinese") -> str:
    """计算并格式化宽高比信息

    Args:
        width: 图片宽度
        height: 图片高度
        format_style: 格式化风格，"chinese" 用于中文描述，"symbol" 用于符号格式

    Returns:
        格式化的宽高比字符串
    """
    try:
        # Convert to numeric values
        w = float(width) if isinstance(width, (int, float, str)) and str(width) != "N/A" else None
        h = float(height) if isinstance(height, (int, float, str)) and str(height) != "N/A" else None

        if w is None or h is None or w <= 0 or h <= 0:
            return ""

        # Calculate aspect ratio
        ratio = w / h

        # Check common aspect ratios with tolerance
        if abs(ratio - 16/9) < 0.05:
            if format_style == "chinese":
                return "横向，宽高比 16:9"
            else:
                return " (16:9)"
        elif abs(ratio - 4/3) < 0.05:
            if format_style == "chinese":
                return "横向，宽高比 4:3"
            else:
                return " (4:3)"
        elif abs(ratio - 3/2) < 0.05:
            if format_style == "chinese":
                return "横向，宽高比 3:2"
            else:
                return " (3:2)"
        elif abs(ratio - 1) < 0.05:
            if format_style == "chinese":
                return "正方形，宽高比 1:1"
            else:
                return " (1:1)"
        elif abs(ratio - 21/9) < 0.05:
            if format_style == "chinese":
                return "横向，宽高比 21:9"
            else:
                return " (21:9)"
        elif abs(ratio - 5/4) < 0.05:
            if format_style == "chinese":
                return "横向，宽高比 5:4"
            else:
                return " (5:4)"
        elif ratio > 1:
            # Landscape image
            if format_style == "chinese":
                return f"横向，宽高比 {ratio:.2f}:1"
            else:
                return f" ({ratio:.2f}:1)"
        elif ratio < 1:
            # Portrait image - check common ratios inverted
            inverted_ratio = 1 / ratio
            if abs(inverted_ratio - 16/9) < 0.05:
                if format_style == "chinese":
                    return "纵向，宽高比 9:16"
                else:
                    return " (9:16)"
            elif abs(inverted_ratio - 4/3) < 0.05:
                if format_style == "chinese":
                    return "纵向，宽高比 3:4"
                else:
                    return " (3:4)"
            elif abs(inverted_ratio - 3/2) < 0.05:
                if format_style == "chinese":
                    return "纵向，宽高比 2:3"
                else:
                    return " (2:3)"
            elif abs(inverted_ratio - 5/4) < 0.05:
                if format_style == "chinese":
                    return "纵向，宽高比 4:5"
                else:
                    return " (4:5)"
            else:
                if format_style == "chinese":
                    return f"纵向，宽高比 1:{inverted_ratio:.2f}"
                else:
                    return f" (1:{inverted_ratio:.2f})"
        else:
            # Exactly 1:1
            if format_style == "chinese":
                return "正方形，宽高比 1:1"
            else:
                return " (1:1)"

    except (ValueError, TypeError, ZeroDivisionError):
        return ""
