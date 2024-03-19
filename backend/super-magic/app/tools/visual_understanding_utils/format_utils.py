"""Formatting utilities for visual understanding output."""
import re
from typing import List, Dict, Any, Optional
from agentlang.logger import get_logger
from .models import (
    ImageDownloadResult,
    ImageDownloadStatus,
    ImageDimensionInfo,
    BatchImageProcessingResults,
)
from .image_info_utils import calculate_and_format_aspect_ratio

logger = get_logger(__name__)


def format_file_size(file_size: int) -> str:
    """格式化文件大小

    Args:
        file_size: 文件大小（字节）

    Returns:
        str: 格式化后的文件大小字符串
    """
    if file_size < 1024:
        return f"{file_size}B"
    elif file_size < 1024 * 1024:
        return f"{file_size/1024:.1f}KB"
    else:
        return f"{file_size/(1024*1024):.1f}MB"


def extract_image_source_name(image_source: str) -> str:
    """从图片来源提取显示路径

    Args:
        image_source: 图片URL或本地文件路径

    Returns:
        str: 图片显示路径，本地文件直接返回原始路径，URL返回文件名
    """
    if re.match(r'^https?://', image_source):
        # 如果是URL，提取URL中的文件名
        file_name = image_source.split('/')[-1].split('?')[0]
        return file_name if file_name else "网络图片"
    else:
        # 如果是本地文件路径，直接返回原始路径（已经是相对于工作区的路径）
        return image_source


def build_dimension_info_text(image_dimensions: ImageDimensionInfo) -> str:
    """构建单个图片的尺寸信息文本

    Args:
        image_dimensions: 图片尺寸信息对象

    Returns:
        str: 格式化的尺寸信息文本
    """
    if not image_dimensions or not image_dimensions.size:
        return "尺寸信息不可用"

    width, height = image_dimensions.size
    size_info = f"{width}×{height}像素"

    # Format aspect ratio
    if image_dimensions.aspect_ratio:
        size_info += f"，{calculate_and_format_aspect_ratio(width, height)}"

    # Format file size
    if image_dimensions.file_size:
        size_info += f"，文件大小 {format_file_size(image_dimensions.file_size)}"

    return size_info


def format_image_dimensions_info(image_dimensions_list: List[Optional[ImageDimensionInfo]], images: List[str]) -> str:
    """格式化图片尺寸信息为人类可读的文本

    Args:
        image_dimensions_list: 图片尺寸信息列表
        images: 图片列表

    Returns:
        str: 格式化后的图片尺寸信息
    """
    if not image_dimensions_list:
        return ""

    # Check if any image has dimension information or if we need to show "尺寸信息不可用"
    has_any_info = len(image_dimensions_list) > 0

    if not has_any_info:
        return ""

    info_parts = ["## 图片尺寸信息"]

    if len(images) == 1:
        # Single image format
        if image_dimensions_list and image_dimensions_list[0] and image_dimensions_list[0].size:
            image_name = extract_image_source_name(images[0])
            dimension_text = build_dimension_info_text(image_dimensions_list[0])
            info_parts.append(f"[图片1] {image_name}: {dimension_text}")
        else:
            image_name = extract_image_source_name(images[0])
            info_parts.append(f"[图片1] {image_name}: 尺寸信息不可用")
    else:
        # Multiple images format - image_dimensions_list now matches images list 1:1
        for i, image_source in enumerate(images):
            if i >= len(image_dimensions_list):
                break

            image_name = extract_image_source_name(image_source)
            current_dimensions = image_dimensions_list[i]

            if current_dimensions and current_dimensions.size:
                dimension_text = build_dimension_info_text(current_dimensions)
                info_parts.append(f"[图片{i+1}] {image_name}: {dimension_text}")
            else:
                info_parts.append(f"[图片{i+1}] {image_name}: 尺寸信息不可用")

    return "\n".join(info_parts)


def format_download_info_for_content(
    batch_results: BatchImageProcessingResults,
    images: List[str]
) -> str:
    """格式化下载状态信息为人类可读的文本

    Args:
        batch_results: 批量处理结果对象
        images: 图片列表

    Returns:
        str: 格式化后的下载状态信息
    """
    download_status_dict = batch_results.get_download_status_dict()
    if not download_status_dict:
        return ""

    # 统计下载状态详情
    download_error_info = []
    status_desc_map = {
        ImageDownloadStatus.DOWNLOAD_ERROR: "下载失败",
        ImageDownloadStatus.TIMEOUT: "下载超时",
        ImageDownloadStatus.INVALID_CONTENT: "内容无效",
        ImageDownloadStatus.SIZE_TOO_LARGE: "图片过大"
    }

    # 收集真正失败的图片（不包括下载失败但识别成功的）
    true_failed_info = []

    for i, image_source in enumerate(images):
        if image_source in download_status_dict:
            download_result = download_status_dict[image_source]

            # 只有下载失败且最终也没有成功识别的，才算真正的处理失败
            if download_result.status in status_desc_map and download_result.status != ImageDownloadStatus.SUCCESS:
                error_desc = status_desc_map.get(download_result.status, '未知错误')
                image_name = extract_image_source_name(image_source)

                # 这里需要判断这个图片是否在最终的失败列表中（通过检查是否有成功的image_data来判断）
                # 如果下载失败但最终有输出，说明使用原URL成功了
                download_error_info.append(f"• 图{i+1} ({image_name}): {error_desc}")

    # 使用实际的成功/失败数量
    actual_success_count = batch_results.success_count
    actual_failed_count = batch_results.failed_count

    # 构建信息文本
    info_parts = ["## 图片处理状态"]

    if len(images) == 1:
        # Single image format
        if actual_failed_count > 0:
            info_parts.extend(true_failed_info)
        elif actual_success_count > 0:
            info_parts.append("✅ 处理成功")
    else:
        # Multiple images format - 使用实际的成功/失败统计
        if actual_success_count > 0:
            info_parts.append(f"✅ 成功处理: {actual_success_count}张")
        if actual_failed_count > 0:
            info_parts.append(f"⚠️ 处理失败: {actual_failed_count}张")

        # 显示失败详情（只显示真正处理失败的图片）
        if actual_failed_count > 0:
            info_parts.append("\n详细情况:")
            for failed_result in batch_results.failed_results:
                info_parts.append(f"• 图{failed_result.index} ({failed_result.name}): {failed_result.error}")

    return "\n".join(info_parts)
