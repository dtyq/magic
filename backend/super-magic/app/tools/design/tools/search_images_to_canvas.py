"""搜索图片并添加到画布工具

此工具整合了图片搜索、下载和画布元素创建，一步完成图片搜索并添加到画布。
支持单张或批量搜索，自动处理布局和视觉理解。
"""

from app.i18n import i18n
import asyncio
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import aiofiles
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail, DisplayType, FileContent
from app.tools.core import BaseToolParams, tool
from app.tools.design.tools.base_design_tool import BaseDesignTool
from app.tools.design.tools.batch_create_canvas_elements import (
    BatchCreateCanvasElements,
    BatchCreateCanvasElementsParams,
    ElementCreationSpec,
)
from app.tools.design.constants import DEFAULT_ELEMENT_SPACING
from app.tools.download_from_url import DownloadFromUrl, DownloadFromUrlParams
from app.tools.image_search import ImageSearch, ImageSearchParams

logger = get_logger(__name__)


class SearchImagesToCanvasParams(BaseToolParams):
    """<!--zh
    搜索图片到画布的参数

    设计理念：最小化必填参数,其他全部内部处理
    -->
    Search images to canvas parameters

    Design philosophy: Minimize required parameters, handle everything else internally
    """

    # ========== 必填参数 ==========
    project_path: str = Field(
        ...,
        description="""<!--zh: 设计项目的相对路径（包含 magic.project.js 的文件夹，即画布项目标识）-->
Relative path to the design project (folder containing magic.project.js, the canvas project identifier)"""
    )

    topic_id: str = Field(
        ...,
        description="""<!--zh: 搜索主题标识符，用于同一主题下的图片去重。对于同一搜索主题使用相同的 topic_id（如 'product-research'），确保不同搜索词不会返回重复图片-->
Search topic identifier for deduplication within the same topic. Use the same topic_id for the same search topic (e.g., 'product-research') to ensure different search terms don't return duplicate images"""
    )

    requirements_xml: str = Field(
        ...,
        description="""<!--zh: 搜索需求XML配置，复用 image_search 的格式

示例：
<requirements>
    <requirement>
        <name>产品图</name>
        <query>智能手表 产品 摄影</query>
        <requirement_explanation>需要清晰的智能手表产品图</requirement_explanation>
        <expected_aspect_ratio>1:1</expected_aspect_ratio>
        <count>4</count>
    </requirement>
</requirements>

字段说明：
- name: 需求名称，用于标识不同类型的图片
- query: 搜索关键词
- requirement_explanation: 需求解释
- expected_aspect_ratio: 期望的图片长宽比（如 '16:9', '1:1', '9:16' 等）
- count: 可选，默认10，最多20

注意：visual_understanding_prompt 字段已移除，视觉理解由 batch_create_canvas_elements 自动执行-->
Search requirements XML configuration, reusing image_search format

Example:
<requirements>
    <requirement>
        <name>Product Images</name>
        <query>smartwatch product photography</query>
        <requirement_explanation>Need clear smartwatch product images</requirement_explanation>
        <expected_aspect_ratio>1:1</expected_aspect_ratio>
        <count>4</count>
    </requirement>
</requirements>

Fields:
- name: Requirement name to identify different image types
- query: Search keywords
- requirement_explanation: Requirement explanation
- expected_aspect_ratio: Expected image aspect ratio (e.g., '16:9', '1:1', '9:16')
- count: Optional, default 10, max 20

Note: visual_understanding_prompt field has been removed, visual understanding is automatically performed by batch_create_canvas_elements"""
    )

    # ========== 可选参数 ==========
    name_prefix: str = Field(
        "",
        description="""<!--zh: 元素名称前缀（可选）。为空则使用 requirement.name，批量时自动添加 _1, _2 后缀-->
Element name prefix (optional). If empty, use requirement.name. For multiple images, _1, _2 suffixes will be automatically added"""
    )

    # ========== 自动处理（内部完成，LLM无需关心）==========
    # - 图片搜索和下载: image_search 内部已完成
    # - 视觉理解: 调用 image_search 时关闭其视觉理解（enable_visual_understanding=False）
    #             由 batch_create_canvas_elements 统一执行标准视觉理解
    # - layout_mode: 根据图片总数自动选择
    #   * 1张: None（默认位置）
    #   * 2-3张: "horizontal"
    #   * 4张: "grid" + grid_columns=2
    #   * 5+张: "grid" + grid_columns=3 或 4（根据总数）
    # - spacing: 固定 20.0
    # - start_x/start_y: 固定 100.0
    # - 坐标(x, y): 由 batch_create_canvas_elements 自动计算
    # - 尺寸(width, height): 自动从图片文件读取
    # - element_id: 自动生成唯一ID


@tool()
class SearchImagesToCanvas(BaseDesignTool[SearchImagesToCanvasParams]):
    """<!--zh
    搜索图片并自动添加到画布工具

    【功能说明】
    一步完成图片搜索、下载和画布元素创建。支持单张或批量搜索,自动布局。

    【常见场景】
    - 单张素材：特定图片搜索
    - 灵感墙：大量图片收集
    - 案例库：分类素材整理
    - 素材收集：多需求批量搜索

    【参数说明】
    必填参数：
    - project_path: 设计项目路径
    - topic_id: 搜索主题标识符（用于去重）
    - requirements_xml: 搜索需求XML配置

    可选参数：
    - name_prefix: 元素名称前缀（为空则使用 requirement.name）

    【使用示例】
    示例1：搜索单张图片
    ```json
    {
      "project_path": "/path/to/project",
      "topic_id": "product-research",
      "requirements_xml": "<requirements><requirement><name>产品图</name><query>智能手表 产品</query>...</requirement></requirements>"
    }
    ```

    示例2：批量搜索（4张）
    ```json
    {
      "project_path": "/path/to/project",
      "topic_id": "inspiration",
      "requirements_xml": "<requirements><requirement><name>灵感图</name><query>现代设计</query><count>4</count>...</requirement></requirements>"
    }
    ```

    【注意】
    - 自动去重：同一 topic_id 下自动去重
    - 自动布局：根据图片数量自动选择最佳布局
    - 视觉理解：由 batch_create_canvas_elements 自动执行
    -->
    Search images and automatically add to canvas tool

    【Function】
    Complete image search, download and canvas element creation in one step. Supports single or batch search with auto layout.

    【Common Scenarios】
    - Single asset: Specific image search
    - Inspiration wall: Large image collection
    - Case library: Categorized asset organization
    - Asset collection: Multi-requirement batch search

    【Parameter Description】
    Required parameters:
    - project_path: Design project path
    - topic_id: Search topic identifier (for deduplication)
    - requirements_xml: Search requirements XML configuration

    Optional parameters:
    - name_prefix: Element name prefix (use requirement.name if empty)

    【Usage Examples】
    Example 1: Search single image
    ```json
    {
      "project_path": "/path/to/project",
      "topic_id": "product-research",
      "requirements_xml": "<requirements><requirement><name>Product Images</name><query>smartwatch product</query>...</requirement></requirements>"
    }
    ```

    Example 2: Batch search (4 images)
    ```json
    {
      "project_path": "/path/to/project",
      "topic_id": "inspiration",
      "requirements_xml": "<requirements><requirement><name>Inspiration Images</name><query>modern design</query><count>4</count>...</requirement></requirements>"
    }
    ```

    【Notes】
    - Auto deduplication: Automatic deduplication under the same topic_id
    - Auto layout: Automatically select best layout based on image count
    - Visual understanding: Automatically performed by batch_create_canvas_elements
    """

    def __init__(self, **data):
        super().__init__(**data)
        self._search_tool = ImageSearch()
        self._batch_create_tool = BatchCreateCanvasElements()
        self._download_tool = DownloadFromUrl()

    async def execute(
        self,
        tool_context: ToolContext,
        params: SearchImagesToCanvasParams
    ) -> ToolResult:
        """执行搜索图片并创建元素

        Args:
            tool_context: 工具上下文
            params: 包含搜索参数的对象

        Returns:
            ToolResult: 包含创建结果详细信息
        """
        try:
            # 1. 使用基类方法确保项目已准备好
            project_path, error_result = await self._ensure_project_ready(
                params.project_path,
                require_magic_project_js=True
            )
            if error_result:
                return error_result

            # 获取 workspace 路径（用于后续路径计算）
            # 确保是绝对路径
            workspace_path = Path(tool_context.base_dir).resolve()
            logger.debug(f"Workspace path: {workspace_path}")

            logger.info(
                f"开始搜索图片并添加到画布: topic_id={params.topic_id}, project={params.project_path}"
            )

            # 2. 调用 image_search（仅搜索，不下载）
            # 重要：关闭 image_search 的视觉理解和下载，由本工具统一处理下载
            search_params = ImageSearchParams(
                topic_id=params.topic_id,
                requirements_xml=params.requirements_xml
            )

            search_result = await self._search_tool.execute_purely(
                search_params,
                search_only=True  # 关键：仅搜索，不下载不视觉理解，由本工具自己处理下载
            )

            if not search_result.ok:
                logger.error(f"图片搜索失败: {search_result.content}")
                return search_result

            # 3. 提取搜索结果（仅包含 URL，未下载）
            image_urls = self._extract_image_urls(search_result)

            if not image_urls:
                return ToolResult.error(
                    "No images found from search",
                    extra_info={"error_type": "design.error_search_no_results"}
                )

            logger.info(f"成功搜索到 {len(image_urls)} 张图片")

            # 4. 并发下载图片到项目 images 目录
            project_images_dir = project_path / "images"
            await asyncio.to_thread(project_images_dir.mkdir, parents=True, exist_ok=True)

            # 计算相对于 workspace 的路径
            try:
                relative_images_dir = str(project_images_dir.relative_to(workspace_path))
            except ValueError:
                relative_images_dir = f"{project_path.name}/images"

            logger.debug(f"图片下载目录: {project_images_dir}, 相对路径: {relative_images_dir}")

            # 并发下载图片
            image_infos = await self._download_images_to_project(
                image_urls,
                relative_images_dir,
                workspace_path,
                tool_context
            )

            if not image_infos:
                return ToolResult.error(
                    "Failed to download images",
                    extra_info={"error_type": "design.error_download_failed"}
                )

            logger.info(f"成功下载 {len(image_infos)} 张图片到项目目录")

            # 5. 生成元素名称（基于 requirement.name 或 name_prefix）
            element_names = self._generate_element_names(
                image_infos,
                params.name_prefix
            )
            logger.debug(f"元素名称: {element_names}")

            # 6. 构建批量创建规格（完全复用工具一的模式）
            element_specs = []
            for idx, image_info in enumerate(image_infos):
                element_spec = ElementCreationSpec(
                    element_type="image",
                    name=element_names[idx],
                    # x, y 留空，让 batch_create 自动计算
                    # width, height 留空，自动读取
                    properties={
                        "src": image_info["relative_path"],
                    }
                )
                element_specs.append(element_spec)

            # 7. 选择布局模式（复用工具一的逻辑）
            layout_mode, grid_columns = self._select_layout_mode(len(image_infos))
            logger.debug(f"选择布局: layout_mode={layout_mode}, grid_columns={grid_columns}")

            # 8. 调用 batch_create_canvas_elements（完全复用工具一）
            batch_params = BatchCreateCanvasElementsParams(
                project_path=params.project_path,
                elements=element_specs,
                layout_mode=layout_mode,
                grid_columns=grid_columns,
                spacing=DEFAULT_ELEMENT_SPACING,
                start_x=100.0,
                start_y=100.0,
            )

            batch_result = await self._batch_create_tool.execute(
                tool_context, batch_params
            )

            if not batch_result.ok:
                return batch_result

            # 9. 生成结果信息（完全复用工具一的格式）
            created_elements = batch_result.extra_info.get("created_elements", [])
            failed_elements = batch_result.extra_info.get("failed_elements", [])
            elements_detail = batch_result.extra_info.get("elements", [])

            result_content = self._generate_result_content(
                params,
                created_elements,
                failed_elements
            )

            return ToolResult(
                content=result_content,
                extra_info={
                    "project_path": params.project_path,
                    "total_count": len(image_infos),
                    "succeeded_count": len(created_elements),
                    "failed_count": len(failed_elements),
                    "created_elements": created_elements,
                    "failed_elements": failed_elements,
                    "elements": elements_detail,  # 完整的元素详情
                }
            )

        except Exception as e:
            logger.exception(f"搜索图片到画布失败: {e!s}")
            return ToolResult.error(
                f"搜索图片到画布失败: {e!s}",
                extra_info={"error_type": "design.error_unexpected"}
            )

    def _extract_image_urls(
        self,
        search_result: ToolResult
    ) -> List[Dict[str, Any]]:
        """从搜索结果提取图片 URL 信息（不包含 local_path）

        Args:
            search_result: image_search 的返回结果

        Returns:
            [
                {
                    "url": "https://example.com/image.jpg",
                    "width": 1920,
                    "height": 1080,
                    "name": "产品图",
                    "requirement_name": "产品图"
                },
                ...
            ]

        注意：不包含 visual_analysis 和 local_path，因为已关闭 image_search 的视觉理解和下载
        """
        image_urls = []

        # image_search 的返回结构在 extra_info 中
        extra_info = search_result.extra_info or {}

        # 从 requirement_results 中提取图片信息
        requirement_results = extra_info.get("requirement_results", [])

        if not requirement_results:
            logger.warning("_extract_image_urls: extra_info 中没有 requirement_results")
            return image_urls

        # 遍历每个 requirement 的结果
        for requirement_result in requirement_results:
            requirement_data = requirement_result.get('requirement_data', {})
            requirement_name = requirement_data.get('name', '图片')
            filtered_images = requirement_result.get('images', [])

            logger.debug(
                f"处理需求 '{requirement_name}': {len(filtered_images)} 张图片"
            )

            # 遍历每个 FilteredImage 对象
            for img in filtered_images:
                # FilteredImage 是 dataclass，提取 URL
                if hasattr(img, 'url') and img.url:
                    url = img.url
                elif isinstance(img, dict) and 'url' in img:
                    url = img['url']
                else:
                    logger.warning(f"图片缺少 url: {img}")
                    continue

                # 提取图片信息（仅包含 URL 和元数据）
                image_info = {
                    "url": url,
                    "width": getattr(img, 'width', 0) if hasattr(img, 'width') else img.get('width', 0),
                    "height": getattr(img, 'height', 0) if hasattr(img, 'height') else img.get('height', 0),
                    "name": getattr(img, 'name', '') if hasattr(img, 'name') else img.get('name', ''),
                    "requirement_name": requirement_name
                }

                image_urls.append(image_info)

        logger.debug(f"成功提取 {len(image_urls)} 张图片 URL")

        return image_urls

    async def _download_images_to_project(
        self,
        image_urls: List[Dict[str, Any]],
        relative_images_dir: str,
        workspace_path: Path,
        tool_context: ToolContext
    ) -> List[Dict[str, Any]]:
        """并发下载图片到项目 images 目录

        Args:
            image_urls: 图片 URL 信息列表
            relative_images_dir: 相对于 workspace 的图片目录路径
            workspace_path: workspace 根路径

        Returns:
            [
                {
                    "relative_path": "project-name/images/xxx.jpg",
                    "width": 1920,
                    "height": 1080,
                    "name": "产品图",
                    "requirement_name": "产品图"
                },
                ...
            ]
        """
        # URL 去重：避免同一 URL 被并发下载
        seen_urls = {}
        unique_image_urls = []
        for image_info in image_urls:
            url = image_info["url"]
            if url not in seen_urls:
                seen_urls[url] = image_info
                unique_image_urls.append(image_info)
            else:
                logger.debug(f"跳过重复 URL: {url}")

        logger.debug(f"去重后: {len(unique_image_urls)} / {len(image_urls)} 张图片")

        # 并发下载限制
        IMAGE_DOWNLOAD_CONCURRENCY = 20
        semaphore = asyncio.Semaphore(IMAGE_DOWNLOAD_CONCURRENCY)

        # 创建下载任务
        tasks = []
        for idx, image_info in enumerate(unique_image_urls):
            # 生成文件名（使用 name + 时间戳 + 索引）
            # 从图片信息中提取名称，使用基类的清理方法
            image_name = image_info.get("name") or image_info.get("requirement_name") or "image"
            clean_name = self._sanitize_filename(image_name, max_length=180)

            # 时间戳（精确到秒） + 索引（从1开始，避免并发冲突）
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            index_suffix = idx + 1

            file_extension = self._get_file_extension_from_url(image_info["url"])
            file_name = f"{clean_name}_{timestamp}_{index_suffix}{file_extension}"
            file_path = f"{relative_images_dir}/{file_name}"

            task = self._download_single_image_with_semaphore(
                image_info,
                file_path,
                workspace_path,
                tool_context,
                semaphore
            )
            tasks.append(task)

        # 并发执行下载
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 收集成功下载的图片信息
        downloaded_images = []
        for idx, result in enumerate(results):
            if isinstance(result, Exception):
                logger.warning(f"下载图片失败: {unique_image_urls[idx]['url']} - {result}")
                continue

            if result:
                downloaded_images.append(result)

        logger.debug(f"成功下载 {len(downloaded_images)} / {len(unique_image_urls)} 张图片")

        return downloaded_images

    async def _download_single_image_with_semaphore(
        self,
        image_info: Dict[str, Any],
        file_path: str,
        workspace_path: Path,
        tool_context: ToolContext,
        semaphore: asyncio.Semaphore
    ) -> Optional[Dict[str, Any]]:
        """下载单张图片（带并发控制）

        Args:
            image_info: 图片 URL 信息
            file_path: 相对于 workspace 的文件路径
            workspace_path: workspace 根路径
            tool_context: 工具上下文
            semaphore: 并发控制信号量

        Returns:
            成功时返回包含 relative_path 的图片信息，失败返回 None
        """
        async with semaphore:
            return await self._download_single_image(image_info, file_path, workspace_path, tool_context)

    async def _download_single_image(
        self,
        image_info: Dict[str, Any],
        file_path: str,
        workspace_path: Path,
        tool_context: ToolContext
    ) -> Optional[Dict[str, Any]]:
        """下载单张图片

        Args:
            image_info: 图片 URL 信息
            file_path: 相对于 workspace 的文件路径
            workspace_path: workspace 根路径
            tool_context: 工具上下文

        Returns:
            成功时返回包含 relative_path 的图片信息，失败返回 None
        """
        try:
            download_params = DownloadFromUrlParams(
                url=image_info["url"],
                file_path=file_path
            )

            # 使用传入的 tool_context（它已经有正确的 base_dir）
            result = await self._download_tool.execute(tool_context, download_params)

            if result.ok and result.extra_info:
                downloaded_path = result.extra_info.get("file_path")
                if downloaded_path:
                    downloaded_file_path = Path(downloaded_path)

                    # 验证下载的文件是否为有效的图片文件（使用基类方法）
                    is_valid, error_msg = await self._validate_image_file(str(downloaded_file_path))
                    if not is_valid:
                        logger.warning(f"下载的图片文件校验失败: {error_msg}")
                        # 删除无效文件
                        try:
                            if downloaded_file_path.exists():
                                await asyncio.to_thread(downloaded_file_path.unlink)
                        except Exception as e:
                            logger.warning(f"删除无效文件失败: {downloaded_path} - {e}")
                        return None

                    # 转换为相对于 workspace 的路径
                    try:
                        relative_path = str(downloaded_file_path.relative_to(workspace_path))
                    except ValueError:
                        # 如果无法计算相对路径，使用原始 file_path
                        relative_path = file_path

                    return {
                        "relative_path": relative_path,
                        "width": image_info["width"],
                        "height": image_info["height"],
                        "name": image_info["name"],
                        "requirement_name": image_info["requirement_name"]
                    }
            else:
                logger.warning(f"下载失败: {image_info['url']} - {result.content or 'Unknown error'}")
                return None

        except Exception as e:
            logger.warning(f"下载图片异常: {image_info['url']} - {e}")
            return None

    def _get_file_extension_from_url(self, url: str) -> str:
        """从 URL 提取文件扩展名

        Args:
            url: 图片 URL

        Returns:
            文件扩展名（如 .jpg, .png），默认为 .jpg
        """
        from urllib.parse import urlparse
        parsed = urlparse(url)
        path = parsed.path

        # 尝试从路径提取扩展名
        if '.' in path:
            ext = path.rsplit('.', 1)[-1].lower()
            # 只接受常见的图片扩展名
            if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']:
                return f'.{ext}'

        # 默认返回 .jpg
        return '.jpg'

    # noinspection PyMethodMayBeStatic
    def _make_relative_to_workspace(self, absolute_path: str, workspace_path: Path) -> str:
        """转换为相对于 workspace 的路径（复用工具一的逻辑）

        Args:
            absolute_path: 绝对路径
            workspace_path: workspace 根路径

        Returns:
            相对于 workspace 的路径
        """
        path_obj = Path(absolute_path)

        try:
            # 尝试计算相对于 workspace 的路径
            relative = path_obj.relative_to(workspace_path)
            return str(relative)
        except ValueError:
            # 如果不在 workspace 下，返回文件名
            logger.warning(f"图片路径 {absolute_path} 不在 workspace {workspace_path} 下，仅使用文件名")
            return path_obj.name

    def _generate_element_names(
        self,
        image_infos: List[Dict],
        name_prefix: str
    ) -> List[str]:
        """生成元素名称（复用工具一的命名逻辑）

        Args:
            image_infos: 图片信息列表
            name_prefix: 名称前缀

        Returns:
            元素名称列表
        """
        if len(image_infos) == 1:
            return [name_prefix or image_infos[0].get("name", "图片")]
        else:
            base_name = name_prefix or image_infos[0].get("requirement_name", "图片")
            return [f"{base_name}_{i+1}" for i in range(len(image_infos))]

    def _select_layout_mode(
        self,
        image_count: int
    ) -> Tuple[Optional[str], int]:
        """选择布局模式（统一使用横向排列，更直观）

        Args:
            image_count: 图片数量

        Returns:
            (layout_mode, grid_columns) - grid_columns 对 horizontal 模式无效
        """
        # 统一使用横向排列布局，不再使用网格布局
        return "horizontal", None

    # noinspection PyMethodMayBeStatic
    def _generate_result_content(
        self,
        params: SearchImagesToCanvasParams,
        created_elements: List[Dict],
        failed_elements: List[Dict]
    ) -> str:
        """生成结构化的结果内容（复用工具一的格式）

        Args:
            params: 工具参数
            created_elements: 成功创建的元素列表
            failed_elements: 失败的元素列表

        Returns:
            格式化的结果内容
        """
        total = len(created_elements) + len(failed_elements)
        success_count = len(created_elements)

        result = f"""Searched and Added to Canvas:
- Success: {success_count} / {total} images
- Project: {params.project_path}"""

        if created_elements:
            result += "\n\nCreated Elements:"
            for elem in created_elements[:8]:  # 搜索可能更多，显示8个
                # 添加文件路径信息（从 properties.src 获取）
                src = elem.get('properties', {}).get('src', 'unknown')
                result += f"\n- {elem['name']} (id: {elem['id']}) at ({elem['x']:.0f}, {elem['y']:.0f})"
                result += f"\n  File: {src}"

        if failed_elements:
            result += f"\n\nFailed: {len(failed_elements)} elements"
            for elem in failed_elements[:8]:
                result += f"\n- {elem['name']}: {elem['error']}"

        return result

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments:
            return i18n.translate("create_canvas_element.exception", category="tool.messages")

        # 从 extra_info 获取实际数量
        succeeded_count = result.extra_info.get("succeeded_count", 0) if result.extra_info else 0

        if not result.ok:
            return i18n.translate("create_canvas_element.exception", category="tool.messages")

        # 成功时返回简单消息
        if succeeded_count == 1:
            return i18n.translate("search_images_to_canvas.success_single", category="tool.messages")
        else:
            return i18n.translate("search_images_to_canvas.success_multiple", category="tool.messages", succeeded_count=succeeded_count)

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult,
        execution_time: float, arguments: Dict[str, Any] = None
    ) -> Dict:
        """获取工具调用后的友好操作和备注

        Args:
            tool_name: 工具名称
            tool_context: 工具上下文
            result: 工具执行结果
            execution_time: 执行时间
            arguments: 执行参数

        Returns:
            Dict: 包含 action 和 remark 的字典
        """
        # 使用基类的通用错误处理方法
        return self._handle_design_tool_error(
            result,
            default_action_code="search_images_to_canvas",
            default_success_message_code="create_canvas_element.success"
        ) if not result.ok else {
            "action": i18n.translate("search_images_to_canvas", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        """生成工具详情，用于前端展示

        Args:
            tool_context: 工具上下文
            result: 工具结果
            arguments: 工具参数

        Returns:
            Optional[ToolDetail]: 工具详情
        """
        if not result.ok:
            return None

        try:
            from app.core.entity.message.server_message import DesignElementContent

            # 从 extra_info 获取数据
            extra_info = result.extra_info or {}
            project_path = extra_info.get("project_path", "")
            elements = extra_info.get("elements", [])

            return ToolDetail(
                type=DisplayType.DESIGN,
                data=DesignElementContent(
                    type="element",
                    project_path=project_path,
                    elements=elements
                )
            )
        except Exception as e:
            logger.error(f"生成工具详情失败: {e!s}")
            return None
