"""
画布图片视觉理解工具

为画布图片元素提供视觉理解能力的工具函数。
调用 VisualUnderstanding 工具分析图片，并将结果转换为 VisualUnderstanding 数据格式。
"""

import hashlib
import json
import re
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any, Tuple

from agentlang.path_manager import PathManager
from agentlang.utils.datetime_formatter import get_current_datetime_str
from agentlang.logger import get_logger
from app.tools.visual_understanding import VisualUnderstanding, VisualUnderstandingParams
from app.tools.design.utils.magic_project_design_parser import VisualUnderstanding as VisualUnderstandingData
from app.utils.async_file_utils import (
    async_read_json,
    async_write_json,
    async_mkdir,
    async_exists,
    async_stat
)

logger = get_logger(__name__)

# 结构化查询：要求同时返回摘要和详细分析
CANVAS_IMAGE_ANALYSIS_QUERY = """请分析这张图片，并以JSON格式返回结果：

{
  "summary": "1句话的简洁描述（80字以内），概括图片的主题和关键视觉元素",
  "detailed": {
    "theme": "图片的主题和主体内容",
    "visual_elements": "颜色、构图、光线、纹理等视觉特征",
    "style": "艺术风格或设计风格",
    "mood": "传达的情感和氛围",
    "use_cases": "适合使用的场景"
  }
}

请确保summary极其简洁（不超过80字），detailed提供深入分析。只返回JSON，不要添加其他文字。"""

# 简单查询：仅需要摘要
CANVAS_IMAGE_SIMPLE_QUERY = """请用1句话简洁描述这张图片的主要内容，包括主题和关键视觉元素。不超过80字。"""


def _get_cache_key(image_path: str, query: str, file_mtime: float) -> str:
    """
    生成缓存键。

    基于图片路径、查询内容和文件修改时间生成唯一的缓存键。
    当图片文件被修改后，缓存键会改变，从而触发重新分析。

    参数：
        image_path: 图片文件路径
        query: 分析查询内容
        file_mtime: 文件修改时间戳

    返回：
        缓存键（MD5哈希值）
    """
    # 使用图片路径、查询内容和文件修改时间生成唯一键
    key_content = f"{image_path}|{query}|{file_mtime}"
    return hashlib.md5(key_content.encode('utf-8')).hexdigest()


async def _get_cache_dir() -> Path:
    """
    获取缓存目录路径。

    使用系统临时目录存储缓存，避免污染工作区。

    返回：
        缓存目录的 Path 对象
    """
    # 使用系统临时目录
    temp_dir = Path(tempfile.gettempdir())
    cache_dir = temp_dir / "super-magic" / "canvas_image_visual_understanding"
    await async_mkdir(cache_dir, parents=True, exist_ok=True)
    return cache_dir


async def _load_from_cache(cache_key: str) -> Optional[VisualUnderstandingData]:
    """
    从缓存加载分析结果。

    参数：
        cache_key: 缓存键

    返回：
        如果缓存存在且有效，返回 VisualUnderstandingData；否则返回 None
    """
    try:
        cache_dir = await _get_cache_dir()
        cache_file = cache_dir / f"{cache_key}.json"

        if not await async_exists(cache_file):
            return None

        data = await async_read_json(cache_file)

        # 重建 VisualUnderstandingData 对象
        result = VisualUnderstandingData(
            summary=data.get('summary', ''),
            detailed=data.get('detailed'),
            analyzedAt=data.get('analyzedAt')
        )

        logger.info(f"从缓存加载分析结果: {cache_key}")
        return result

    except Exception as e:
        logger.warning(f"加载缓存失败 {cache_key}: {e}")
        return None


async def _save_to_cache(cache_key: str, result: VisualUnderstandingData) -> None:
    """
    保存分析结果到缓存。

    参数：
        cache_key: 缓存键
        result: 分析结果
    """
    try:
        cache_dir = await _get_cache_dir()
        cache_file = cache_dir / f"{cache_key}.json"

        # 转换为可序列化的字典
        data = {
            'summary': result.summary,
            'detailed': result.detailed,
            'analyzedAt': result.analyzedAt
        }

        await async_write_json(cache_file, data, ensure_ascii=False, indent=2)

        logger.info(f"分析结果已缓存: {cache_key}")

    except Exception as e:
        logger.warning(f"保存缓存失败 {cache_key}: {e}")


async def analyze_image_for_canvas(
    image_path: str,
    custom_query: Optional[str] = None,
    include_detailed_analysis: bool = True,
    use_cache: bool = True,
    max_retries: int = 1
) -> VisualUnderstandingData:
    """
    为画布元素分析图片并返回视觉理解结果。

    此函数调用 VisualUnderstanding 工具来分析图片，
    并将结果转换为画布元素使用的 VisualUnderstanding 数据格式。
    视觉模型通过一次调用同时输出摘要和详细分析。

    支持缓存机制和自动重试：
    - 缓存基于图片路径、查询内容和文件修改时间
    - 失败时自动重试指定次数

    参数：
        image_path: 图片文件路径（相对于工作区或绝对路径）
        custom_query: 自定义分析查询。如果未提供，则使用默认的结构化查询
        include_detailed_analysis: 是否包含详细分析（默认为 True）
        use_cache: 是否使用缓存（默认为 True）
        max_retries: 失败时的最大重试次数（默认为 1）

    返回：
        VisualUnderstandingData: 包含摘要、详细信息和时间戳的分析结果

    异常：
        ValueError: 如果图片路径不存在或分析失败
    """
    logger.info(f"开始为画布分析图片: {image_path}, include_detailed={include_detailed_analysis}, use_cache={use_cache}")

    # 验证图片路径是否存在
    workspace_dir = PathManager.get_workspace_dir()

    # 标准化路径：去除开头的 /，兼容两种格式（/path 和 path）
    normalized_path = image_path.lstrip('/') if isinstance(image_path, str) else str(image_path).lstrip('/')

    if not Path(normalized_path).is_absolute():
        full_path = workspace_dir / normalized_path
    else:
        full_path = Path(normalized_path)

    if not full_path.exists():
        error_msg = f"图片文件不存在: {normalized_path} (完整路径: {full_path})"
        logger.error(error_msg)
        raise ValueError(error_msg)

    # 根据参数确定查询内容
    if custom_query:
        query = custom_query
        use_structured_output = False  # 自定义查询可能不返回结构化格式
    else:
        query = CANVAS_IMAGE_ANALYSIS_QUERY if include_detailed_analysis else CANVAS_IMAGE_SIMPLE_QUERY
        use_structured_output = include_detailed_analysis

    # 检查缓存
    if use_cache:
        file_stat = await async_stat(full_path)
        file_mtime = file_stat.st_mtime
        cache_key = _get_cache_key(image_path, query, file_mtime)
        cached_result = await _load_from_cache(cache_key)
        if cached_result is not None:
            logger.info(f"使用缓存的分析结果: {image_path}")
            return cached_result

    # 使用重试机制调用视觉理解工具
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            if attempt > 0:
                logger.info(f"重试分析图片 ({attempt}/{max_retries}): {image_path}")

            result = await _perform_visual_analysis(
                full_path=full_path,
                image_path=image_path,
                query=query,
                use_structured_output=use_structured_output
            )

            # 分析成功，保存到缓存
            if use_cache:
                await _save_to_cache(cache_key, result)

            return result

        except Exception as e:
            last_error = e
            logger.warning(f"分析图片失败 (尝试 {attempt + 1}/{max_retries + 1}): {image_path}, 错误: {str(e)}")

            # 如果还有重试机会，继续；否则抛出异常
            if attempt >= max_retries:
                break

    # 所有重试都失败
    error_msg = f"分析图片失败（已重试 {max_retries} 次）{image_path}: {str(last_error)}"
    logger.error(error_msg)
    raise ValueError(error_msg) from last_error


async def _perform_visual_analysis(
    full_path: Path,
    image_path: str,
    query: str,
    use_structured_output: bool
) -> VisualUnderstandingData:
    """
    执行实际的视觉分析。

    参数：
        full_path: 图片的完整路径
        image_path: 原始图片路径（用于日志和存储）
        query: 分析查询内容
        use_structured_output: 是否使用结构化输出

    返回：
        VisualUnderstandingData: 分析结果

    异常：
        ValueError: 如果分析或解析失败
    """
    # 调用视觉理解工具
    visual_tool = VisualUnderstanding()
    # 使用绝对路径以确保 VisualUnderstanding 能找到文件
    params = VisualUnderstandingParams(
        images=[str(full_path)],  # 传递绝对路径而不是相对路径
        query=query
    )

    result = await visual_tool.execute_purely(
        params,
        include_download_info_in_content=False,
        include_dimensions_info_in_content=False,
        skip_format_validation=True  # 跳过格式验证，因为是刚生成的图片，PIL可以处理
    )

    if not result.ok:
        error_msg = f"视觉理解失败: {result.content}"
        logger.error(error_msg)
        raise ValueError(error_msg)

    logger.info(f"视觉理解成功完成: {image_path}")

    # 解析结果
    analysis_content = result.content

    if use_structured_output:
        # 尝试解析 JSON 响应
        summary, detailed = _parse_structured_response(analysis_content, image_path)
    else:
        # 对于简单查询或自定义查询，使用 content 作为摘要
        summary = _ensure_summary_length(analysis_content)
        detailed = None

    # 获取当前时间戳
    analyzed_at = get_current_datetime_str()

    # 创建并返回 VisualUnderstanding 对象
    return VisualUnderstandingData(
        summary=summary,
        detailed=detailed,
        analyzedAt=analyzed_at
    )


def _parse_structured_response(content: str, image_path: str) -> Tuple[str, Optional[Dict[str, Any]]]:
    """
    解析视觉理解返回的结构化 JSON 响应。

    参数：
        content: 视觉理解返回的响应内容
        image_path: 图片路径，用于日志记录

    返回：
        元组 (summary, detailed_dict)
    """
    try:
        # 尝试从 content 中提取 JSON（处理模型可能添加 markdown 代码块的情况）
        json_match = re.search(r'```json\s*(\{.*?\})\s*```', content, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            # 尝试直接查找 JSON 对象
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
            else:
                json_str = content

        # 解析 JSON
        parsed = json.loads(json_str)

        # 提取 summary 和 detailed
        summary = parsed.get("summary", "")
        detailed = parsed.get("detailed")

        # 验证 summary 存在且长度合适
        if not summary:
            logger.warning(f"结构化响应中没有 summary，使用降级方案: {image_path}")
            summary = _ensure_summary_length(content)
        else:
            summary = _ensure_summary_length(summary)

        # 向 detailed 中添加图片元数据（使用原始路径，不是绝对路径）
        if detailed and isinstance(detailed, dict):
            detailed["image_source"] = image_path  # 保留原始路径（相对或绝对路径）

        logger.info(f"成功解析结构化响应: {image_path}")
        return summary, detailed

    except json.JSONDecodeError as e:
        logger.warning(f"JSON 解析失败 {image_path}: {e}")
        logger.debug(f"响应内容前 200 字符: {content[:200]}...")

        # 降级方案：尝试从 markdown 格式提取
        summary, detailed = _parse_markdown_response(content, image_path)
        return summary, detailed

    except Exception as e:
        logger.error(f"解析结构化响应时发生意外错误 {image_path}: {e}")
        # 最终降级方案：使用 content 作为摘要
        return _ensure_summary_length(content), None


def _parse_markdown_response(content: str, image_path: str) -> Tuple[str, Optional[Dict[str, Any]]]:
    """
    作为降级方案，解析 Markdown 格式的响应。

    参数：
        content: Markdown 格式的响应内容
        image_path: 图片路径，用于日志记录

    返回：
        元组 (summary, detailed_dict)
    """
    try:
        # 尝试提取摘要部分
        summary_match = re.search(r'###?\s*摘要\s*\n(.+?)(?=\n###|$)', content, re.DOTALL)
        if summary_match:
            summary = summary_match.group(1).strip()
        else:
            # 降级方案：使用第一段
            paragraphs = content.split('\n\n')
            summary = paragraphs[0].strip() if paragraphs else content.strip()

        summary = _ensure_summary_length(summary)

        # 尝试提取详细分析部分
        detailed = None
        detailed_match = re.search(r'###?\s*详细分析\s*\n(.+)', content, re.DOTALL)
        if detailed_match:
            detailed_text = detailed_match.group(1).strip()
            detailed = {
                "full_analysis": detailed_text,
                "image_source": image_path
            }

        logger.info(f"从 markdown 格式解析响应: {image_path}")
        return summary, detailed

    except Exception as e:
        logger.error(f"解析 markdown 响应时出错 {image_path}: {e}")
        return _ensure_summary_length(content), None


def _ensure_summary_length(text: str, max_length: int = 80) -> str:
    """
    确保摘要文本在最大长度范围内。

    参数：
        text: 摘要文本
        max_length: 允许的最大长度

    返回：
        如果需要，则为截断后的摘要
    """
    text = text.strip()

    if len(text) <= max_length:
        return text

    # 尝试在句子边界截断
    # 在前 max_length 个字符中查找最后一个句号
    truncated = text[:max_length]
    min_length = 5  # 最小长度，避免截断过短

    for punct in ["。", ".", "！", "!", "？", "?"]:
        last_idx = truncated.rfind(punct)
        if last_idx >= min_length:  # 只要句号位置合理就截断
            return text[:last_idx + 1]

    # 硬截断并添加省略号
    return text[:max_length].rstrip() + "..."
