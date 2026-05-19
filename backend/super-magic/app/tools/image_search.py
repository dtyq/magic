from app.i18n import i18n
import asyncio
import html
import os
import random
import re
import xml.etree.ElementTree as ET
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urlparse

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.path_manager import PathManager
from app.core.entity.message.server_message import ToolDetail, DisplayType, FileContent
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool
from app.tools.visual_understanding import VisualUnderstanding, VisualUnderstandingParams
from app.tools.download_from_url import DownloadFromUrl, DownloadFromUrlParams
from app.tools.image_search_utils import get_image_search_driver
from app.tools.image_search_utils.drivers.base import ImageSearchResultItem

logger = get_logger(__name__)

# Constants
VISUAL_ANALYSIS_BATCH_SIZE = 10  # Maximum concurrent visual analysis tasks per batch
IMAGE_DOWNLOAD_CONCURRENCY = 20  # Maximum concurrent image downloads


@dataclass
class FilteredImage:
    """Filtered image data with all necessary information"""
    url: str
    name: str
    width: int
    height: int
    file_size: int
    encoding_format: str
    date_published: Optional[str]
    host_page_url: Optional[str]
    thumbnail_url: Optional[str]
    visual_analysis: Optional[str] = None
    local_path: Optional[str] = None
    is_fallback: bool = False  # Mark if this image comes from fallback filtering


class ImageSearchParams(BaseToolParams):
    topic_id: str = Field(
        ...,
        description="""<!--zh: 搜索主题标识符，用于同一主题下的图片去重。对于同一搜索主题使用相同的topic_id（如'xiaomi-su7-research'），确保不同搜索词不会返回重复图片-->
Search topic identifier for deduplication within the same topic. Use the same topic_id for the same search topic (e.g., 'xiaomi-su7-research') to ensure different search terms don't return duplicate images"""
    )
    requirements_xml: str = Field(
        ...,
        description="""<!--zh
图片需求XML配置，示例如下：
<requirements>
    <requirement>
        <name>张三李四的同框合影</name>
        <query>张三 李四 同框 合影 2025</query>
        <visual_understanding_prompt>分析是否适合作为封面和关系演变部分使用，能体现两人关系</visual_understanding_prompt>
        <requirement_explanation>我们在制作张三与李四关系演变报告，需要张三和李四同框的图片作为封面和关系演变部分使用，要求清晰度高，画面专业，能体现两人关系</requirement_explanation>
        <expected_aspect_ratio>16:9</expected_aspect_ratio>
        <count>8</count>
    </requirement>
    <requirement>
        <name>张三李四的社交媒体争执</name>
        <query>张三 李四 争执 社交媒体 争论 2025</query>
        <visual_understanding_prompt>寻找展示张三和李四社交媒体争执的截图或合成图</visual_understanding_prompt>
        <requirement_explanation>我们在制作张三与李四关系演变报告，需要展示两人在社交媒体上的争执，可以是相关平台的截图组合或相关新闻报道图片</requirement_explanation>
        <expected_aspect_ratio>9:16</expected_aspect_ratio>
        <count>10</count>
    </requirement>
</requirements>

格式要求：
- 每个 <requirement> 标签包含一个搜索需求
- 所有文本字段需要进行适当的 XML 转义
- name: 需求名称，用于在搜索结果中区分不同类型的图片，必填
- query: 搜索关键词，具体策略请参考工具的搜索指南，必填
- visual_understanding_prompt: 视觉分析提示词，指定对图片内容的特定分析要求。视觉分析无法正确评估图片的清晰度，只能分析内容，因此请勿使用此参数来评估图片的清晰度，必填
- requirement_explanation: 需求解释，说明为什么需要搜索这个图片，特别是对于大模型可能不熟悉的事物，需要提供详细的视觉特征描述，必填
- expected_aspect_ratio: 期望的图片长宽比，支持格式如 '16:9'（横版）、'4:3'（横版）、'1:1'（正方形）、'9:16'（竖版）、'3:4'（竖版）等。系统会自动根据宽高比选择合理的最小分辨率（如16:9选择1280x720），以确保图片清晰度，必填
- count: 可选，默认10，最多20
-->
Image requirements XML configuration, example:
<requirements>
    <requirement>
        <name>Zhang San and Li Si photo together</name>
        <query>Zhang San Li Si together photo 2025</query>
        <visual_understanding_prompt>Analyze if suitable as cover and relationship evolution section, showing their relationship</visual_understanding_prompt>
        <requirement_explanation>We are creating Zhang San and Li Si relationship evolution report, need their photos together for cover and relationship evolution section, requiring high clarity, professional composition, showing their relationship</requirement_explanation>
        <expected_aspect_ratio>16:9</expected_aspect_ratio>
        <count>8</count>
    </requirement>
    <requirement>
        <name>Zhang San and Li Si social media dispute</name>
        <query>Zhang San Li Si dispute social media argument 2025</query>
        <visual_understanding_prompt>Find screenshots or composites showing Zhang San and Li Si social media dispute</visual_understanding_prompt>
        <requirement_explanation>We are creating Zhang San and Li Si relationship evolution report, need to show their social media disputes, can be platform screenshot combinations or related news images</requirement_explanation>
        <expected_aspect_ratio>9:16</expected_aspect_ratio>
        <count>10</count>
    </requirement>
</requirements>

Format requirements:
- Each <requirement> tag contains one search requirement
- All text fields need proper XML escaping
- name: Requirement name to distinguish different image types in search results, required
- query: Search keywords, refer to tool search guide for specific strategy, required
- visual_understanding_prompt: Visual analysis prompt specifying content analysis requirements. Visual analysis cannot properly assess image clarity, only content, so don't use this parameter for clarity assessment, required
- requirement_explanation: Requirement explanation describing why this image is needed. For entities unfamiliar to the model, provide detailed visual feature descriptions, required
- expected_aspect_ratio: Expected image aspect ratio, supports formats like '16:9' (landscape), '4:3' (landscape), '1:1' (square), '9:16' (portrait), '3:4' (portrait), etc. System automatically selects reasonable minimum resolution based on aspect ratio (e.g., 1280x720 for 16:9) to ensure image clarity, required
- count: Optional, default 10, max 20"""
    )

def _parse_aspect_ratio(ratio_str: str) -> Optional[float]:
    """Parse aspect ratio string to float value

    Args:
        ratio_str: Aspect ratio string like '16:9', '4:3', etc.

    Returns:
        Float value of the ratio, or None if parsing fails
    """
    if not ratio_str:
        return None

    try:
        parts = ratio_str.strip().split(':')
        if len(parts) == 2:
            width = float(parts[0])
            height = float(parts[1])
            if height > 0:
                return width / height
    except (ValueError, IndexError):
        pass

    return None


def _calculate_reasonable_resolution_from_aspect_ratio(aspect_ratio: float) -> tuple[int, int]:
    """Calculate reasonable resolution based on aspect ratio to ensure good image quality

    Args:
        aspect_ratio: Aspect ratio as float (width/height)

    Returns:
        Tuple of (width, height) with reasonable resolution for the given aspect ratio
    """
    # Define common aspect ratios and their reasonable resolutions
    # Use mid-to-high quality resolutions to avoid blurry images

    # Handle common aspect ratios with predefined resolutions
    if 1.7 <= aspect_ratio <= 1.8:  # ~16:9 (1.778)
        return (1280, 720)
    elif 1.3 <= aspect_ratio <= 1.4:  # ~4:3 (1.333)
        return (1024, 768)
    elif 0.9 <= aspect_ratio <= 1.1:  # ~1:1 (1.0)
        return (1024, 1024)
    elif 0.55 <= aspect_ratio <= 0.65:  # ~9:16 (0.5625)
        return (720, 1280)
    elif 0.7 <= aspect_ratio <= 0.8:  # ~3:4 (0.75)
        return (768, 1024)
    else:
        # For other aspect ratios, calculate based on a target pixel count
        # Aim for around 1M pixels (1024x1024) for good quality
        target_pixels = 1024 * 1024

        # Calculate dimensions based on aspect ratio
        # width / height = aspect_ratio
        # width * height = target_pixels
        # So: width = sqrt(target_pixels * aspect_ratio)
        #     height = sqrt(target_pixels / aspect_ratio)

        width = int(math.sqrt(target_pixels * aspect_ratio))
        height = int(math.sqrt(target_pixels / aspect_ratio))

        # Ensure minimum dimensions to avoid tiny images
        width = max(width, 300)
        height = max(height, 300)

        return (width, height)


def _calculate_aspect_ratio_difference(actual_ratio: float, expected_ratio: float) -> float:
    """Calculate the relative difference between two aspect ratios

    Returns:
        Relative difference as a percentage (0.0 = same, 0.2 = 20% different)
    """
    if expected_ratio <= 0:
        return float('inf')

    return abs(actual_ratio - expected_ratio) / expected_ratio


def _calculate_resolution_difference(actual_width: int, actual_height: int,
                                   expected_width: int, expected_height: int) -> float:
    """Calculate the relative difference between two resolutions

    Returns:
        Relative difference based on total pixels
    """
    actual_pixels = actual_width * actual_height
    expected_pixels = expected_width * expected_height

    if expected_pixels <= 0:
        return float('inf')

    return abs(actual_pixels - expected_pixels) / expected_pixels


def _estimate_reasonable_file_size(width: int, height: int) -> tuple[int, int]:
    """Estimate reasonable file size range for given resolution

    Returns:
        Tuple of (min_size_bytes, max_size_bytes)
    """
    total_pixels = width * height

    # For very small images (icons, thumbnails), be more lenient
    if total_pixels < 10000:  # < 100x100
        return (1024, 500 * 1024)  # 1KB - 500KB

    # For normal images, estimate based on typical compression ratios
    # Minimum: highly compressed JPEG, ~0.1 byte per pixel
    # Maximum: less compressed or PNG, ~3 bytes per pixel
    min_size = int(total_pixels * 0.1)
    max_size = int(total_pixels * 3)

    # Apply reasonable bounds
    min_size = max(min_size, 5 * 1024)  # At least 5KB
    max_size = min(max_size, 50 * 1024 * 1024)  # At most 50MB

    return (min_size, max_size)


def _parse_requirements_xml(xml_string: str, require_visual_understanding_prompt: bool = True) -> List[Dict[str, Any]]:
    """解析需求XML字符串

    Args:
        xml_string: XML格式的需求字符串
        require_visual_understanding_prompt: 是否要求 visual_understanding_prompt 必填，默认 True。
            当 search_only=True 时，应设置为 False

    Returns:
        List of requirement dictionaries

    Raises:
        ValueError: XML格式错误或缺少必要字段
    """
    try:
        # 解析XML
        root = ET.fromstring(xml_string.strip())

        if root.tag != 'requirements':
            raise ValueError("XML根节点必须是 <requirements>")

        requirements = []

        for req_element in root.findall('requirement'):
            # 提取必要字段
            name = req_element.find('name')
            query = req_element.find('query')
            visual_understanding_prompt = req_element.find('visual_understanding_prompt')
            requirement_explanation = req_element.find('requirement_explanation')
            expected_aspect_ratio = req_element.find('expected_aspect_ratio')

            # 检查必要字段（根据 require_visual_understanding_prompt 决定是否包含 visual_understanding_prompt）
            required_fields = [
                ('name', name),
                ('query', query),
                ('requirement_explanation', requirement_explanation),
                ('expected_aspect_ratio', expected_aspect_ratio)
            ]

            # 只有在需要视觉理解时才要求 visual_understanding_prompt 必填
            if require_visual_understanding_prompt:
                required_fields.append(('visual_understanding_prompt', visual_understanding_prompt))

            for field_name, element in required_fields:
                if element is None or not element.text or not element.text.strip():
                    raise ValueError(f"字段 '{field_name}' 不能为空")

            # 提取可选字段
            count_element = req_element.find('count')
            count = 20  # 默认值
            if count_element is not None and count_element.text:
                try:
                    count = int(count_element.text.strip())
                    if count < 1 or count > 50:
                        raise ValueError(f"count 必须在 1-50 之间，当前值: {count}")
                except ValueError as e:
                    if "invalid literal" in str(e):
                        raise ValueError(f"count 必须是数字，当前值: {count_element.text}")
                    raise

            # 构造需求对象
            # visual_understanding_prompt 如果不存在，使用空字符串
            visual_prompt = ""
            if visual_understanding_prompt is not None and visual_understanding_prompt.text:
                visual_prompt = visual_understanding_prompt.text.strip()

            requirement = {
                'name': name.text.strip(),
                'query': query.text.strip(),
                'visual_understanding_prompt': visual_prompt,
                'requirement_explanation': requirement_explanation.text.strip(),
                'expected_aspect_ratio': expected_aspect_ratio.text.strip(),
                'count': count
            }

            requirements.append(requirement)

        if not requirements:
            raise ValueError("至少需要一个 <requirement> 元素")

        return requirements

    except ET.ParseError as e:
        raise ValueError(f"XML解析错误: {e}")


@tool()
class ImageSearch(BaseTool[ImageSearchParams]):
    """<!--zh: 图片搜索工具，根据关键词搜索并智能筛选符合要求的高质量图片，因此返回的图片数量可能少于期望数量。-->
Image search tool that searches and intelligently filters high-quality images meeting requirements based on keywords. Returned image count may be less than expected."""

    # Class-level storage for deduplication across different topic_ids
    _topic_url_cache: Dict[str, Set[str]] = {}

    def __init__(self, **data):
        super().__init__(**data)
        # 使用驱动工厂获取图片搜索驱动
        self.driver = get_image_search_driver()

        # Initialize tools
        self._visual_tool = VisualUnderstanding()
        self._download_tool = DownloadFromUrl()

    def get_prompt_hint(self) -> str:
        """获取图片搜索工具的搜索策略提示"""
        return """\
<!--zh
使用图片搜索工具时，query 搜索关键词必须多样化，每个需求应尝试2-3个不同角度的关键词组合。

关键词语言选择原则：
根据搜索意图和信息来源判断语言，并尝试多语言组合：
- 搜索外网内容/国际报道 → 使用英文或原始语言
- 搜索本地网站内容 → 使用本地语言
- 不确定信息来源 → 混合使用多种语言以获取更全面结果
- 同一主题可用不同语言搜索获取不同视角的内容

搜索策略框架：
1.核心词：最简单直接的主题词
2.限定词：核心词+属性/功能/场景
3.组合词：多个相关要素组合
4.变体词：同义词/简称/俗称/多语言变体

示例（根据搜索意图选择语言）：
搜索 iPhone 官方图片：
- "iPhone", "iPhone 17 Pro Max", "iPhone official"

搜索中国网友对马斯克的评论截图：
- "马斯克", "马斯克微博", "马斯克评论"

搜索马斯克的国际新闻图片：
- "Elon Musk", "Musk Tesla", "Musk 2025"

搜索微信功能界面：
- "微信", "微信界面", "微信支付"

搜索微信的国际报道：
- "WeChat", "WeChat China", "WeChat report"

搜索特斯拉上海工厂（混合）：
- "Tesla Shanghai", "特斯拉上海", "Tesla 上海工厂"

错误示例（避免）：
用"协作软件"搜索 → 太泛化，应该用"Figma"、"Figma协作"等具体名称
用"database tool"搜索 → 没有主体，应该用"Notion database"、"Airtable"等
禁用泛化搜索，不允许只使用通用行业词(software/platform/tool)、纯功能词(payment/chat)、纯形容词(modern/advanced)

关键词多样化原则：
- 从核心到具体：主体名称→主体+属性→主体+场景+时间
- 尝试不同表述：根据信息来源选择语言/简称/全称/多语言变体
- 组合不同要素：主体/行为/时间/地点
- 每个requirement至少尝试2-3种不同角度
-->
When using image search tool, query keywords must be diversified, try 2-3 different keyword combinations for each requirement.

Keyword Language Selection Principles:
Judge language based on search intent and information source, try multilingual combinations:
- Search foreign websites/international reports → Use English or original language
- Search local websites → Use local language
- Uncertain about source → Mix multiple languages for comprehensive results
- Same topic can use different languages to get different perspectives

Search Strategy Framework:
1. Core word: Most direct topic word
2. Qualifier: Core word + attribute/function/scenario
3. Combination: Multiple related elements combined
4. Variant: Synonym/abbreviation/colloquialism/multilingual variant

Examples (choose language based on search intent):
Search iPhone official images:
- "iPhone", "iPhone 17 Pro Max", "iPhone official"

Search Chinese netizens' comments about Musk (screenshots):
- "马斯克", "马斯克微博", "马斯克评论"

Search international news images about Musk:
- "Elon Musk", "Musk Tesla", "Musk 2025"

Search WeChat function interface:
- "微信", "微信界面", "微信支付"

Search international reports about WeChat:
- "WeChat", "WeChat China", "WeChat report"

Search Tesla Shanghai factory (mixed):
- "Tesla Shanghai", "特斯拉上海", "Tesla 上海工厂"

Wrong Examples (Avoid):
Use "collaboration software" → Too generic, should use "Figma", "Figma collaboration" etc.
Use "database tool" → No subject, should use "Notion database", "Airtable" etc.
Prohibit generic searches, no using only generic industry terms (software/platform/tool), pure function terms (payment/chat), pure adjectives (modern/advanced)

Keyword Diversification Principles:
- From core to specific: Subject name → Subject+attribute → Subject+scenario+time
- Try different expressions: Choose language based on source/abbreviation/full name/multilingual variants
- Combine different elements: Subject/action/time/location
- At least 2-3 different angles per requirement
"""

    async def _search_single_query(
        self,
        query: str,
        count: int,
        expected_ratio: float,
        expected_resolution: tuple[int, int],
        seen_urls: Set[str]
    ) -> tuple[List[FilteredImage], int]:
        """Search images for a single query using driver

        Returns:
            Tuple of (filtered_images, original_count)
        """
        all_filtered_images = []
        all_raw_results: List[ImageSearchResultItem] = []
        total_original_count = 0
        offset = 0
        max_retries = 1
        retry_count = 0

        while retry_count <= max_retries:
            results = await self.driver.search(query=query, count=count, offset=offset)

            if not results:
                break

            total_original_count += len(results)
            all_raw_results.extend(results)

            # Filter images with deduplication
            filtered_images = self._filter_images(results, expected_ratio, expected_resolution, seen_urls)
            all_filtered_images.extend(filtered_images)

            # If we got enough images, stop searching
            if len(all_filtered_images) >= count:
                break

            # Prepare for next retry
            retry_count += 1
            offset += count

        # If ideal filtering resulted in less than 3 images, apply fallback filtering
        if len(all_filtered_images) < 3 and all_raw_results:
            logger.debug(f"理想匹配得到 {len(all_filtered_images)} 张图片，进行候补匹配补足")
            fallback_matched_images = self._fallback_filter_images(
                all_raw_results, expected_ratio, expected_resolution, seen_urls, all_filtered_images
            )
            all_filtered_images.extend(fallback_matched_images)

        return all_filtered_images, total_original_count

    def _filter_images(self, image_results: List[ImageSearchResultItem], expected_ratio: float, expected_resolution: tuple[int, int], seen_urls: Set[str] = None) -> List[FilteredImage]:
        """Filter images based on hard criteria and deduplication

        Args:
            image_results: Image search result items from driver
            expected_ratio: Expected aspect ratio (already validated)
            expected_resolution: Expected resolution tuple (already validated)
            seen_urls: Set of URLs already seen for deduplication

        Returns:
            List of filtered images that pass all criteria
        """
        filtered_images = []

        for item in image_results:
            try:
                url = item.content_url
                if not url:
                    continue

                # Check for duplicates if seen_urls provided
                if seen_urls is not None and url in seen_urls:
                    logger.debug(f"跳过重复图片: {url}")
                    continue

                width = item.width
                height = item.height

                # Skip if no valid dimensions
                if not isinstance(width, int) or not isinstance(height, int) or width <= 0 or height <= 0:
                    logger.debug(f"跳过无效尺寸的图片: {item.name}")
                    continue

                # Parse file size
                try:
                    file_size = int(item.content_size.split(' ')[0]) if item.content_size else 0
                except (ValueError, IndexError):
                    file_size = 0

                # Filter by aspect ratio
                actual_ratio = width / height
                ratio_diff = _calculate_aspect_ratio_difference(actual_ratio, expected_ratio)
                if ratio_diff > 0.2:  # Allow 20% difference
                    logger.debug(f"剔除长宽比不符的图片: {actual_ratio:.2f} vs {expected_ratio:.2f}")
                    continue

                # Filter by resolution
                exp_width, exp_height = expected_resolution
                resolution_diff = _calculate_resolution_difference(width, height, exp_width, exp_height)
                if resolution_diff > 0.5:  # Allow 50% difference in total pixels
                    logger.debug(f"剔除分辨率差距过大的图片: {width}x{height} vs {exp_width}x{exp_height}")
                    continue

                # Filter by file size reasonableness (skip if file_size is 0, e.g. SerpApi)
                if file_size > 0:
                    min_size, max_size = _estimate_reasonable_file_size(width, height)
                    if file_size < min_size or file_size > max_size:
                        logger.debug(f"剔除文件体积异常的图片: {file_size} bytes for {width}x{height}")
                        continue

                # Create filtered image object
                filtered_image = FilteredImage(
                    url=url,
                    name=item.name or f"图片 {len(filtered_images) + 1}",
                    width=width,
                    height=height,
                    file_size=file_size,
                    encoding_format=item.encoding_format,
                    date_published=item.date_published,
                    host_page_url=item.host_page_url,
                    thumbnail_url=item.thumbnail_url
                )

                filtered_images.append(filtered_image)

            except Exception as e:
                logger.warning(f"处理图片数据时出错: {e}")
                continue

        logger.debug(f"筛选完成: 原始 {len(image_results)} 张 -> 筛选后 {len(filtered_images)} 张")
        return filtered_images

    def _fallback_filter_images(self, all_raw_results: List[ImageSearchResultItem], expected_ratio: float, expected_resolution: tuple[int, int], seen_urls: Set[str], existing_images: List[FilteredImage]) -> List[FilteredImage]:
        """Fallback filter images by calculating match scores, returning up to 3 - len(existing_images) best matches

        Args:
            all_raw_results: All raw image results collected from driver
            expected_ratio: Expected aspect ratio
            expected_resolution: Expected resolution tuple
            seen_urls: URLs already seen for deduplication
            existing_images: Images already filtered by ideal filtering

        Returns:
            List of fallback-filtered images marked as fallback
        """
        # Get URLs from existing images to avoid duplicates
        existing_urls = {img.url for img in existing_images}

        # Calculate how many more images we need
        needed_count = 3 - len(existing_images)
        if needed_count <= 0:
            return []

        scored_images = []

        for item in all_raw_results:
            # Basic validation and deduplication
            if not item.content_url:
                continue
            if item.content_url in seen_urls or item.content_url in existing_urls:
                continue
            if not isinstance(item.width, int) or not isinstance(item.height, int) or item.width <= 0 or item.height <= 0:
                continue

            # Calculate match score
            score = self._calculate_match_score_from_item(item, expected_ratio, expected_resolution)

            # Create filtered image
            try:
                file_size = int(item.content_size.split(' ')[0]) if item.content_size else 0
            except (ValueError, IndexError):
                file_size = 0

            filtered_image = FilteredImage(
                url=item.content_url,
                name=item.name or "未命名图片",
                width=item.width,
                height=item.height,
                file_size=file_size,
                encoding_format=item.encoding_format,
                date_published=item.date_published,
                host_page_url=item.host_page_url,
                thumbnail_url=item.thumbnail_url,
                is_fallback=True
            )
            scored_images.append((score, filtered_image))

        # Sort by score (highest first) and take needed count
        scored_images.sort(key=lambda x: x[0], reverse=True)
        fallback_matched = [img for _, img in scored_images[:needed_count]]

        logger.debug(f"候补匹配完成: 从 {len(all_raw_results)} 张原始图片中选出 {len(fallback_matched)} 张补足图片")
        return fallback_matched

    def _calculate_match_score_from_item(self, item: ImageSearchResultItem, expected_ratio: float, expected_resolution: tuple[int, int]) -> float:
        """Calculate image match score based on aspect ratio and resolution

        Args:
            item: Image search result item
            expected_ratio: Expected aspect ratio
            expected_resolution: Expected resolution tuple

        Returns:
            float: Match score, higher is better
        """
        score = 0.0

        # Aspect ratio score (weight: 0.6)
        if item.height > 0:
            actual_ratio = item.width / item.height
            ratio_diff = abs(actual_ratio - expected_ratio) / expected_ratio
            ratio_score = 1.0 / (1.0 + ratio_diff * 0.5)
        else:
            ratio_score = 0.0
        score += ratio_score * 0.6

        # Resolution score (weight: 0.4)
        expected_width, expected_height = expected_resolution
        expected_pixels = expected_width * expected_height
        if expected_pixels > 0:
            actual_pixels = item.width * item.height
            pixel_diff = abs(actual_pixels - expected_pixels) / expected_pixels
            resolution_score = 1.0 / (1.0 + pixel_diff * 0.3)
        else:
            resolution_score = 0.0
        score += resolution_score * 0.4

        return score

    async def execute(
        self,
        tool_context: ToolContext,
        params: ImageSearchParams
    ) -> ToolResult:
        """执行图片搜索并返回结果"""
        return await self.execute_purely(params)

    async def execute_purely(
        self,
        params: ImageSearchParams,
        search_only: bool = False
    ) -> ToolResult:
        """执行图片搜索的核心逻辑

        Args:
            params: 搜索参数
            search_only: 是否仅搜索（不下载、不视觉理解），默认 False。
                当 search_only=True 时，只返回搜索结果 URL，不执行下载和视觉理解。
                SearchImagesToCanvas 调用时应设置为 True，由 SearchImagesToCanvas 自己处理下载
        """
        # 解析XML需求
        # 当 search_only=True 时，visual_understanding_prompt 不是必填字段
        try:
            requirements_data = _parse_requirements_xml(
                params.requirements_xml,
                require_visual_understanding_prompt=not search_only
            )
        except ValueError as e:
            return ToolResult.error(f"需求XML解析失败: {e}，请在修正XML数据后重新执行")

        # Validate parameters for each requirement
        validated_requirements = []
        for i, req_data in enumerate(requirements_data):
            expected_ratio = _parse_aspect_ratio(req_data['expected_aspect_ratio'])
            if expected_ratio is None:
                return ToolResult.error(f"需求 '{req_data['name']}' 无法解析期望的长宽比参数: '{req_data['expected_aspect_ratio']}'。请使用格式如 '16:9'、'4:3'、'1:1' 等")

            # Calculate reasonable resolution based on aspect ratio
            expected_resolution = _calculate_reasonable_resolution_from_aspect_ratio(expected_ratio)

            validated_requirements.append({
                'requirement_data': req_data,
                'expected_ratio': expected_ratio,
                'expected_resolution': expected_resolution
            })

        # Get or create URL set for this topic_id
        if params.topic_id not in self._topic_url_cache:
            self._topic_url_cache[params.topic_id] = set()
        seen_urls = self._topic_url_cache[params.topic_id]

        # Perform concurrent searches for all requirements
        logger.debug(f"开始并发搜索 {len(requirements_data)} 个需求")

        # 每个请求随机延迟，避免同时到达上游触发限流
        async def _staggered_image_search(val_req: dict):
            await asyncio.sleep(random.uniform(0, 1.0))
            requirement_data = val_req['requirement_data']
            return await self._search_single_query(
                query=requirement_data['query'],
                count=requirement_data['count'],
                expected_ratio=val_req['expected_ratio'],
                expected_resolution=val_req['expected_resolution'],
                seen_urls=seen_urls
            )

        search_tasks = [
            _staggered_image_search(val_req)
            for val_req in validated_requirements
        ]

        # Execute all searches concurrently
        search_results = await asyncio.gather(*search_tasks, return_exceptions=True)

        # Process results by requirement
        requirement_results = []
        for i, result in enumerate(search_results):
            requirement_data = validated_requirements[i]['requirement_data']
            if isinstance(result, Exception):
                logger.error(f"搜索需求 '{requirement_data['name']}' 失败: {result}")
                continue

            filtered_images, original_count = result
            if filtered_images:
                requirement_results.append({
                    'requirement_data': requirement_data,
                    'images': filtered_images,
                    'original_count': original_count
                })

        if not requirement_results:
            requirement_names = [req_data['name'] for req_data in requirements_data]
            return ToolResult(
                content=f"## Image Search Results\n\nTopic ID: {params.topic_id}\nRequirements: {', '.join(requirement_names)}\nNo images found that match the criteria.",
                extra_info={"topic_id": params.topic_id, "requirements": requirement_names, "result_count": 0}
            )

        # 如果仅搜索模式，直接返回搜索结果（不下载、不视觉理解）
        if search_only:
            logger.debug(f"仅搜索模式（search_only=True），跳过下载和视觉理解，直接返回 {len(requirement_results)} 个需求的结果")
            # Update seen URLs cache
            for requirement_result in requirement_results:
                for img in requirement_result['images']:
                    seen_urls.add(img.url)

            # Build result with URLs only
            return self._build_result_multi_requirement(params, requirement_results)

        # 完整流程：下载 + 视觉理解
        # Download all filtered images
        all_images = []
        for requirement_result in requirement_results:
            all_images.extend(requirement_result['images'])

        logger.debug(f"开始下载 {len(all_images)} 张筛选后的图片")
        await self._download_images(all_images)

        # Filter out failed downloads and perform visual analysis by requirement
        final_requirement_results = []
        for requirement_result in requirement_results:
            downloadable_images = [img for img in requirement_result['images'] if img.local_path is not None]
            if downloadable_images:
                # Visual analysis for this requirement
                logger.debug(f"开始视觉分析需求 '{requirement_result['requirement_data']['name']}' 的 {len(downloadable_images)} 张图片")
                await self._analyze_images_with_visual_understanding_for_requirement(downloadable_images, requirement_result['requirement_data'])

                # Update seen URLs cache with successfully analyzed images
                for img in downloadable_images:
                    seen_urls.add(img.url)

                final_requirement_results.append({
                    'requirement_data': requirement_result['requirement_data'],
                    'images': downloadable_images,
                    'original_count': requirement_result['original_count']
                })

        if not final_requirement_results:
            requirement_names = [req_data['name'] for req_data in requirements_data]
            return ToolResult(
                content=f"## Image Search Results\n\nTopic ID: {params.topic_id}\nRequirements: {', '.join(requirement_names)}\nImages were found but failed to download.",
                extra_info={"topic_id": params.topic_id, "requirements": requirement_names, "result_count": 0}
            )

        # Build final result
        return self._build_result_multi_requirement(params, final_requirement_results)



    def _build_result_multi_requirement(self, params: ImageSearchParams, requirement_results: List[Dict]) -> ToolResult:
        """Build result for multi-requirement search

                Args:
            params: Search parameters
            requirement_results: List of requirement results, each containing:
                - requirement_data: Dict with requirement data
                - images: List[FilteredImage]
                - original_count: int
        """
        # Calculate totals
        total_images = sum(len(rr['images']) for rr in requirement_results)
        total_original = sum(rr['original_count'] for rr in requirement_results)
        requirement_names = [rr['requirement_data']['name'] for rr in requirement_results]

        # Build result markdown
        markdown_parts = [
            "## Image Search Results\n",
            f"Topic ID: {params.topic_id}\n",
            f"Requirements: {len(requirement_results)}\n",
            f"Total Images: {total_images}\n",
            "---\n",
        ]

        # Add results by requirement
        for requirement_result in requirement_results:
            requirement_data = requirement_result['requirement_data']
            images = requirement_result['images']
            original_count = requirement_result['original_count']

            # Count ideal and fallback filtered images
            ideal_matched = [img for img in images if not img.is_fallback]
            fallback_matched = [img for img in images if img.is_fallback]

            # Calculate expected resolution for display
            expected_ratio = _parse_aspect_ratio(requirement_data['expected_aspect_ratio'])
            expected_resolution_display = "Unknown"
            if expected_ratio:
                expected_resolution = _calculate_reasonable_resolution_from_aspect_ratio(expected_ratio)
                expected_resolution_display = f"{expected_resolution[0]}x{expected_resolution[1]}"

            # Requirement header
            markdown_parts.extend([
                f"\n### {requirement_data['name']} ({len(images)} images)\n",
                f"Search Query: {requirement_data['query']}\n",
                f"Expected Spec: {requirement_data['expected_aspect_ratio']} (auto-selected resolution {expected_resolution_display})\n",
                f"Raw Search: {original_count} images, Ideal Matches: {len(ideal_matched)}, Fallback Matches: {len(fallback_matched)}\n",
                "\n"
            ])

            # Add images for this requirement
            for i, img in enumerate(images):
                item_md = [f"\n#### {i+1}. {img.name}\n"]

                # Display image using original URL
                item_md.append(f"![{img.name}]({img.url})")

                # Add fallback indicator if this is a fallback-filtered image
                if img.is_fallback:
                    item_md.append("\nFallback match: image spec differs from expected and this is the best available candidate.")

                # Add visual analysis if available
                if img.visual_analysis:
                    item_md.append(f"\n**AI Visual Analysis**: {img.visual_analysis}")

                item_md.append("\n")
                markdown_parts.extend(item_md)

            markdown_parts.append("---\n")

        final_markdown = "\n".join(markdown_parts)
        all_images_for_sanitization = [
            img
            for requirement_result in requirement_results
            for img in requirement_result['images']
        ]
        sanitized_markdown = self._sanitize_content_by_images(final_markdown, all_images_for_sanitization)

        # 构建 data 字段，方便 agent 编码访问
        # 将所有图片信息展平为列表，只保留必要字段
        all_images_list = []
        for requirement_result in requirement_results:
            for img in requirement_result['images']:
                all_images_list.append({
                    "url": img.url,
                    "width": img.width,
                    "height": img.height
                })

        return ToolResult(
            content=sanitized_markdown,
            data={"images": all_images_list},
            extra_info={
                "topic_id": params.topic_id,
                "requirement_names": requirement_names,
                "result_count": total_images,
                "original_count": total_original,
                "requirement_count": len(requirement_results),
                "deduplicated": len(self._topic_url_cache.get(params.topic_id, set())),
                # Add requirement_results for SearchImagesToCanvas to extract image info
                "requirement_results": requirement_results
            }
        )

    async def _download_images(self, images: List[FilteredImage]) -> None:
        """Download images to cache using download_from_url tool with concurrency control

        Args:
            images: List of images to download
        """
        if not images:
            return

        # Create semaphore to limit concurrent downloads
        semaphore = asyncio.Semaphore(IMAGE_DOWNLOAD_CONCURRENCY)

        tasks = []
        for img in images:
            # Use cache_only mode - pass empty file_path to trigger cache mode
            download_params = DownloadFromUrlParams(
                url=img.url,
                file_path="",  # Empty path triggers cache_only mode
                override=True
            )

            task = self._download_single_image_with_semaphore(img, download_params, semaphore)
            tasks.append(task)

        # Execute downloads concurrently with concurrency control
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _download_single_image_with_semaphore(self, img: FilteredImage, params: DownloadFromUrlParams, semaphore: asyncio.Semaphore) -> None:
        """Download a single image using cache_only mode with semaphore control

        Args:
            img: Image to download
            params: Download parameters
            semaphore: Semaphore to control concurrency
        """
        async with semaphore:
            await self._download_single_image(img, params)

    async def _download_single_image(self, img: FilteredImage, params: DownloadFromUrlParams) -> None:
        """Download a single image using cache_only mode

        Args:
            img: Image to download
            params: Download parameters
        """
        try:
            result = await self._download_tool.execute_purely(params, cache_only=True)
            if result.ok and result.extra_info:
                img.local_path = result.extra_info.get("file_path")
            else:
                logger.warning(f"下载失败: {img.url} - {result.content or 'Unknown error'}")
        except Exception as e:
            logger.warning(f"下载图片异常: {img.url} - {e}")

    async def _analyze_images_with_visual_understanding_for_requirement(self, images: List[FilteredImage], requirement_data: Dict[str, Any]) -> None:
        """Analyze images using visual understanding tool for a specific requirement

        Args:
            images: List of images with local paths
            requirement_data: Dict containing requirement data including visual analysis request
        """
        language_code = i18n.get_language()
        if not isinstance(language_code, str) or not language_code.strip():
            language_code = "zh_CN"
        language_code = language_code.strip()
        output_language_rule = f"最终输出语言请严格遵循用户语言代码：{language_code}。"
        length_rule = "篇幅保持高信息密度：优先120-180词；若该语言不以词计数，则控制在180-260字符。"

        # Build analysis query
        full_query = f"""# 图片分析任务
你是一个图片分析专家，你擅长用最少的文字，尽可能详细地描述图片的内容。
这张图片来自搜索关键词：「{requirement_data['query']}」
详细地描述这张图片的内容，并包含以下分析要求：

## 基本分析要求
1. 图片内容的完整、详尽的客观描述
2. 图片描述需包含构图信息，如：图中每个元素的方位、排列等
3. 图片中的主要文字内容
4. 图片中若有时间信息必须指出，有助于判断图片的时效性
5. 实用性分析：
   - 是否包含水印或版权标识
   - 若作为背景图使用，适合搭配什么颜色的文字（如：深色背景适合搭配浅色文字，浅色背景适合搭配深色文字）
6. 适用场景分析：请简短说明这张图片适合用于什么类型的配图场景，根据图片实际内容给出具体的适用建议

## 额外分析要求
```
{requirement_data['visual_understanding_prompt']}
```

## 需求解释
```
{requirement_data['requirement_explanation']}
```

## 重要提醒
- 由于你总是错误地判断清晰度，因此就算额外分析要求中包含清晰度分析，也不要在分析中包含任何关于图片清晰度的描述。
- 关于 flag{{REJECT_IMAGE}} 标记的使用规则（请严格遵守）：
  - 仅当你**明确观察到**图片中存在水印文字、可见 logo、版权署名等无法用于商用配图的技术问题时，才在分析结果末尾**单独一行**输出 flag{{REJECT_IMAGE}}。
  - 在以下任何情况下，**绝对不要**输出 flag{{REJECT_IMAGE}}：未观察到水印或版权标识、不确定是否存在、你在描述中已经写出"无水印""无版权标识""未见水印"等否定性结论。
  - 不要解释这个标记，也不要在正文中提及它。
- 为提高信息密度，请用最少的文字表达最多的有效信息，避免空话、套话、重复表达。
- {output_language_rule}
- {length_rule}

接下来，请根据上述要求对图片进行分析。
"""

        # Create concurrent tasks for all images, but process in batches to limit load
        valid_images_with_paths = [img for img in images if img.local_path]

        if not valid_images_with_paths:
            logger.debug("没有可分析的图片")
            return

        # Process images in batches of 5 to avoid overwhelming the server
        batch_size = VISUAL_ANALYSIS_BATCH_SIZE
        valid_images = []

        for i in range(0, len(valid_images_with_paths), batch_size):
            batch = valid_images_with_paths[i:i+batch_size]

            # Create tasks for current batch
            tasks = [self._analyze_single_image(img, full_query) for img in batch]

            logger.debug(f"开始分析第 {i//batch_size + 1} 批图片，共 {len(tasks)} 张")

            # Execute current batch concurrently
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results for current batch
            for img, result in zip(batch, results):
                if isinstance(result, Exception):
                    logger.warning(f"视觉分析异常: {img.name} - {result}")
                    # Skip image if analysis fails
                    continue
                elif isinstance(result, str):
                    # Check if analysis result is empty
                    if not result.strip():
                        logger.info(f"图片视觉分析结果为空，跳过: {img.name}")
                        continue

                    # Check for REJECT_IMAGE marker
                    reject_pattern = 'flag{REJECT_IMAGE}'
                    if reject_pattern in result:
                        # Self-consistency check: if the model itself states there is no
                        # watermark/copyright issue, treat the marker as a hallucinated
                        # tail and keep the image instead of dropping it silently.
                        # Covers Chinese & English negation phrasings commonly produced
                        # by lightweight vision models (e.g. qwen-flash).
                        result_without_marker = result.replace(reject_pattern, '')
                        negation_pattern = re.compile(
                            r'(无水印|没有水印|未见水印|不含水印|无版权(标识|信息)?|没有版权(标识|信息)?|未见版权(标识|信息)?|不含版权(标识|信息)?'
                            r'|no\s+watermark|without\s+watermark|no\s+copyright)',
                            re.IGNORECASE,
                        )
                        if negation_pattern.search(result_without_marker):
                            logger.warning(
                                f"视觉分析输出了 REJECT 标记但同时声明无水印/版权问题，判定为模型误标，保留图片: {img.name}"
                            )
                            # fall through and keep the image
                        else:
                            logger.info(f"图片被视觉分析拒绝: {img.name}")
                            continue  # Skip this image

                    # Remove any REJECT_IMAGE markers and clean up
                    analysis = result.replace(reject_pattern, '').strip()
                    analysis = re.sub(r'\s+', ' ', analysis).strip()

                    # Skip if analysis is empty after cleanup
                    if not analysis:
                        logger.info(f"图片视觉分析清理后为空，跳过: {img.name}")
                        continue

                    img.visual_analysis = analysis
                    valid_images.append(img)
                else:
                    logger.warning(f"视觉分析返回未知结果类型: {img.name}")
                    # Skip image if analysis result is unexpected
                    continue

        # Update the original list with only valid images
        images.clear()
        images.extend(valid_images)

        logger.debug(f"并发视觉分析完成，保留 {len(valid_images)} 张有效图片")

    @staticmethod
    def _is_local_path_in_workspace(local_path: str) -> bool:
        """检查本地路径是否在 workspace 内"""
        try:
            if not local_path:
                return False
            resolved_local_path = Path(local_path).resolve()
            workspace_path = Path(PathManager.get_workspace_dir()).resolve()
            resolved_local_path.relative_to(workspace_path)
            return True
        except Exception:
            return False

    @staticmethod
    def _get_network_image_name(img: FilteredImage) -> str:
        """从网络图片 URL 提取可展示名称"""
        if img.url:
            try:
                parsed = urlparse(img.url)
                file_name = os.path.basename(parsed.path)
                if file_name:
                    return file_name
            except Exception:
                pass

        if img.local_path:
            file_name = Path(img.local_path).name
            if file_name:
                return file_name

        return "网络图片"

    def _sanitize_content_by_images(self, content: str, images: List[FilteredImage]) -> str:
        """基于图片对象脱敏 workspace 外本地路径，不依赖硬编码目录规则"""
        if not content or not images:
            return content

        sanitized_content = content
        for img in images:
            if not img.local_path or self._is_local_path_in_workspace(img.local_path):
                continue

            display_name = self._get_network_image_name(img)
            candidate_paths = {img.local_path}
            try:
                resolved_local_path = str(Path(img.local_path).resolve())
                if resolved_local_path:
                    candidate_paths.add(resolved_local_path)
            except Exception:
                pass

            for local_path in candidate_paths:
                sanitized_content = sanitized_content.replace(local_path, display_name)

        return sanitized_content

    def _sanitize_visual_result_for_llm(self, content: str, img: FilteredImage) -> str:
        """仅在 image_search 的 ToolResult 中脱敏 workspace 外本地路径"""
        return self._sanitize_content_by_images(content, [img])

    def _build_tool_detail_markdown(self, topic_id: str, requirement_results: List[Dict]) -> str:
        """基于结构化 requirement_results 独立组装 tool detail markdown"""
        total_images = sum(len(rr.get("images", [])) for rr in requirement_results)
        markdown_parts = [
            "## Image Search Results\n",
            f"Topic ID: {topic_id}\n",
            f"Requirements: {len(requirement_results)}\n",
            f"Total Images: {total_images}\n",
            "---\n",
        ]

        for requirement_result in requirement_results:
            requirement_data = requirement_result.get("requirement_data", {})
            images: List[FilteredImage] = requirement_result.get("images", [])
            original_count = requirement_result.get("original_count", 0)

            ideal_matched = [img for img in images if not img.is_fallback]
            fallback_matched = [img for img in images if img.is_fallback]

            expected_aspect_ratio = requirement_data.get("expected_aspect_ratio", "Unknown")
            expected_resolution_display = "Unknown"
            expected_ratio = _parse_aspect_ratio(expected_aspect_ratio)
            if expected_ratio:
                expected_resolution = _calculate_reasonable_resolution_from_aspect_ratio(expected_ratio)
                expected_resolution_display = f"{expected_resolution[0]}x{expected_resolution[1]}"

            markdown_parts.extend([
                f"\n### {requirement_data.get('name', 'Unnamed Requirement')} ({len(images)} images)\n",
                f"Search Query: {requirement_data.get('query', 'Unknown')}\n",
                f"Expected Spec: {expected_aspect_ratio} (auto-selected resolution {expected_resolution_display})\n",
                f"Raw Search: {original_count} images, Ideal Matches: {len(ideal_matched)}, Fallback Matches: {len(fallback_matched)}\n",
                "\n",
            ])

            for i, img in enumerate(images):
                safe_img_name = html.escape(img.name, quote=True)
                safe_img_url = html.escape(img.url, quote=True)

                markdown_parts.append(f"\n#### {i+1}. {img.name}\n")
                markdown_parts.append(
                    f'<img src="{safe_img_url}" alt="{safe_img_name}" '
                    f'style="max-height:280px" />'
                )

                if img.width > 0 and img.height > 0:
                    gcd_val = math.gcd(img.width, img.height)
                    ratio_width = img.width // gcd_val if gcd_val else img.width
                    ratio_height = img.height // gcd_val if gcd_val else img.height
                    markdown_parts.append(f"\nSize: {img.width}x{img.height}, Ratio: {ratio_width}:{ratio_height}")

                if img.is_fallback:
                    markdown_parts.append("\nFallback match: image spec differs from expected and this is the best available candidate.")

                if img.visual_analysis:
                    markdown_parts.append(f"\n**AI Visual Analysis**: {img.visual_analysis}")

                markdown_parts.append("\n")

            markdown_parts.append("---\n")

        detail_markdown = "\n".join(markdown_parts)
        all_images = [img for requirement_result in requirement_results for img in requirement_result.get("images", [])]
        return self._sanitize_content_by_images(detail_markdown, all_images)

    async def _analyze_single_image(self, img: FilteredImage, full_query: str) -> str:
        """Analyze a single image using visual understanding tool

        Args:
            img: Image to analyze
            full_query: Analysis query

        Returns:
            str: Analysis result or empty string if failed
        """
        try:
            visual_params = VisualUnderstandingParams(
                images=[img.local_path],
                query=full_query
            )

            result = await self._visual_tool.execute_purely(
                visual_params,
                include_download_info_in_content=False,
                include_dimensions_info_in_content=True
            )

            if result.ok and result.content:
                cleaned_content = result.content.strip()
                return self._sanitize_visual_result_for_llm(cleaned_content, img)
            else:
                logger.warning(f"视觉分析失败: {img.name}")
                return ""

        except Exception as e:
            logger.warning(f"视觉分析异常: {img.name} - {e}")
            return ""

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """生成工具详情，用于前端展示"""
        if not result.ok:
            return None

        # Extract info from new format
        if arguments:
            requirements_xml = arguments.get("requirements_xml", "")
            topic_id = arguments.get("topic_id", "")
            # Try to parse requirements from XML for filename generation
            try:
                requirements_data = _parse_requirements_xml(requirements_xml) if requirements_xml else []
                requirement_names = [req['name'] for req in requirements_data]
            except:
                requirement_names = ["Unknown"]
        else:
            requirement_names = result.extra_info.get("requirement_names", ["Unknown"])
            topic_id = result.extra_info.get("topic_id", "")

        try:
            # Build safe filename from requirement names and topic_id
            names_str = '_'.join(requirement_names[:3])
            safe_names = re.sub(r'[\\/*?:"<>|]', '_', names_str)  # Replace invalid filename chars
            if topic_id:
                safe_topic = re.sub(r'[\\/*?:"<>|]', '_', topic_id)
                file_name = f"image_search_results_{safe_topic}_{safe_names[:20]}.md"
            else:
                file_name = f"image_search_results_{safe_names[:30]}.md"

            requirement_results = result.extra_info.get("requirement_results", []) if result.extra_info else []
            if requirement_results:
                detail_content = self._build_tool_detail_markdown(topic_id, requirement_results)
            else:
                # 无结构化图片数据时，仍使用基础信息独立组装 detail，不复用 result.content
                detail_content = (
                    "## Image Search Results\n\n"
                    f"Topic ID: {topic_id}\n"
                    f"Requirements: {len(requirement_names)}\n"
                    "Total Images: 0\n"
                )

            return ToolDetail(
                type=DisplayType.MD,
                data=FileContent(
                    file_name=file_name,
                    content=detail_content
                )
            )
        except Exception as e:
            logger.error(f"生成图片搜索工具详情失败: {e!s}")
            return None  # 异常情况下不显示详情



    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        # Extract info from new format
        if arguments:
            requirements_xml = arguments.get("requirements_xml", "")
            topic_id = arguments.get("topic_id", "")
            # Try to parse requirements from XML for display generation
            try:
                requirements_data = _parse_requirements_xml(requirements_xml) if requirements_xml else []
                requirement_names = [req['name'] for req in requirements_data]
            except:
                requirement_names = ["未知"]
        else:
            requirement_names = result.extra_info.get("requirement_names", [])
            topic_id = result.extra_info.get("topic_id", "")

        # Build display string for requirements
        requirement_names_display = requirement_names[:3]
        requirements_str = '、'.join(requirement_names_display)
        if len(requirement_names) > 3:
            requirements_str += f"等{len(requirement_names)}个需求"

        if not result.ok:
            return f"搜索图片 '{requirements_str}' 时出错"
        elif result.extra_info:
            result_count = result.extra_info.get("result_count", 0)
            requirement_count = result.extra_info.get("requirement_count", 0)
            deduplicated = result.extra_info.get("deduplicated", 0)

            remark = f"已完成图片搜索 '{requirements_str}'，找到 {result_count} 张符合条件的图片"

            # Add filtering info
            extra_info = []
            if requirement_count > 0:
                extra_info.append(f"{requirement_count} 个需求")
            if deduplicated > 0:
                extra_info.append(f"已去重 {deduplicated} 张")

            if extra_info:
                remark += f"（{', '.join(extra_info)}）"

            return remark
        else:
            return f"已完成图片搜索 '{requirements_str}'"

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """获取工具调用后的友好动作和备注"""
        if not result.ok:
            return {
                "action": i18n.translate("image_search", category="tool.actions"),
                "remark": i18n.translate("image_search.error", category="tool.messages", error=result.content)
            }

        return {
            "action": i18n.translate("image_search", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
