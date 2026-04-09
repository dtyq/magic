"""从互联网搜索图片并添加到画布工具

每个 task 独立指定搜索词和数量，并发执行，自动下载后通过
BaseGenerateCanvasElements 的三阶段流程（占位符→执行→更新）写入画布。
"""

import asyncio
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, ToolDetail
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.design.tools.base_generate_canvas_elements import (
    BaseGenerateCanvasElements,
    ElementDetail,
    PlaceholderUpdate,
    TaskExecutionResult,
    TaskPlaceholderInfo,
)
from app.tools.download_from_url import DownloadFromUrl, DownloadFromUrlParams
from app.tools.image_search import ImageSearch, ImageSearchParams
from app.utils.async_file_utils import async_mkdir, async_unlink

logger = get_logger(__name__)


@dataclass
class SearchImagePlaceholderUpdate(PlaceholderUpdate):
    """图片搜索结果写回占位符的内容

    Attributes:
        src: 已下载图片的项目相对路径
        width: 实际图片宽度
        height: 实际图片高度
    """

    src: Optional[str] = None
    width: Optional[float] = None
    height: Optional[float] = None


@dataclass
class DownloadedImageInfo:
    """单张已下载图片的信息，作为 _run_generate_flow 的 task 类型

    Attributes:
        element_name: 画布元素名称
        relative_path: 相对于项目目录的图片路径（如 images/xxx.jpg）
        actual_width: 从文件读取的实际宽度
        actual_height: 从文件读取的实际高度
    """

    element_name: str
    relative_path: str
    actual_width: float
    actual_height: float


class SearchTaskSpec(BaseModel):
    """单个搜索任务"""

    name: str = Field(
        ...,
        description="""<!--zh: 元素名称。返回多张图时自动加 _1 _2 后缀。用用户使用的语言填写，应反映具体搜索内容。-->
Canvas element name. When multiple images are returned, _1 _2 suffixes are added automatically. Use the user's language and describe the specific content being searched.""",
    )
    query: str = Field(
        ...,
        description="""<!--zh: 搜索关键词。-->
Search keywords.""",
    )
    requirement_explanation: str = Field(
        "",
        description="""<!--zh: 需求说明（可选），帮助搜索引擎理解图片用途。-->
Requirement explanation (optional). Helps the search engine understand the intended use of the images.""",
    )
    expected_aspect_ratio: str = Field(
        "",
        description="""<!--zh: 期望长宽比（可选），如 '16:9', '1:1', '9:16'。-->
Expected aspect ratio (optional), e.g. '16:9', '1:1', '9:16'.""",
    )
    count: int = Field(
        10,
        ge=1,
        le=20,
        description="""<!--zh: 搜索数量，默认 10，最多 20。-->
Number of images to search. Default 10, maximum 20.""",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("name 不能为空")
        return v

    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("query 不能为空")
        return v


class SearchCanvasImagesParams(BaseToolParams):
    """search_canvas_images 工具参数"""

    project_path: str = Field(
        ...,
        description="""<!--zh: 设计项目的相对路径（包含 magic.project.js 的文件夹）。-->
Relative path to the design project (folder containing magic.project.js).""",
    )
    topic_id: str = Field(
        ...,
        description="""<!--zh: 搜索主题标识符，用于同一主题下去重。对同一主题使用相同的 topic_id，避免不同搜索词返回重复图片。-->
Search topic identifier for deduplication. Use the same topic_id for the same search theme to avoid duplicate images across multiple calls.""",
    )
    tasks: List[SearchTaskSpec] = Field(
        ...,
        description="""<!--zh: 搜索任务列表，每个 task 代表一组搜索需求，并发执行。-->
Search task list. Each task represents one search requirement; all tasks run concurrently.""",
    )

    @field_validator("tasks")
    @classmethod
    def validate_tasks(cls, v: List[SearchTaskSpec]) -> List[SearchTaskSpec]:
        if not v:
            raise ValueError("tasks 不能为空列表，至少需要一个任务")
        return v


@tool()
class SearchCanvasImages(BaseGenerateCanvasElements[SearchCanvasImagesParams]):
    """<!--zh: 从互联网搜索图片并自动添加到画布。每个 task 独立指定搜索词和数量，并发执行，结果自动下载并创建为画布元素。-->
    Search images from the internet and automatically add them to the canvas. Each task independently specifies keywords and count; all tasks run concurrently, and results are downloaded and created as canvas elements.
    """

    def __init__(self, **data):
        super().__init__(**data)
        self._search_tool = ImageSearch()
        self._download_tool = DownloadFromUrl()

    async def execute(
        self,
        tool_context: ToolContext,
        params: SearchCanvasImagesParams,
    ) -> ToolResult:
        try:
            # 提前校验项目，以便拿到 project_path 做下载目录
            project_path, error_result = await self._ensure_project_ready(
                params.project_path, require_magic_project_js=True
            )
            if error_result:
                return error_result

            workspace_path = Path(tool_context.base_dir).resolve()
            logger.info(
                f"开始搜索图片并添加到画布: topic_id={params.topic_id}, "
                f"tasks={len(params.tasks)}, project={params.project_path}"
            )

            # 1. 将 tasks 转为 requirements_xml，调用 image_search（仅搜索，不下载）
            search_result = await self._search_tool.execute_purely(
                ImageSearchParams(
                    topic_id=params.topic_id,
                    requirements_xml=self._build_requirements_xml(params.tasks),
                ),
                search_only=True,
            )
            if not search_result.ok:
                logger.error(f"图片搜索失败: {search_result.content}")
                return search_result

            # 2. 提取图片 URL 列表
            image_urls = self._extract_image_urls(search_result)
            if not image_urls:
                return ToolResult.error(
                    "No images found from search",
                    extra_info={"error_type": "design.error_search_no_results"},
                )
            logger.info(f"成功搜索到 {len(image_urls)} 张图片")

            # 3. 并发下载图片到项目 images 目录
            project_images_dir = project_path / "images"
            await async_mkdir(project_images_dir, parents=True, exist_ok=True)
            try:
                relative_images_dir = str(project_images_dir.relative_to(workspace_path))
            except ValueError:
                relative_images_dir = f"{project_path.name}/images"

            raw_infos = await self._download_images_to_project(
                image_urls, relative_images_dir, workspace_path, project_path, tool_context
            )
            if not raw_infos:
                return ToolResult.error(
                    "Failed to download images",
                    extra_info={"error_type": "design.error_download_failed"},
                )
            logger.info(f"成功下载 {len(raw_infos)} 张图片到项目目录")

            # 4. 生成元素名称，读取实际文件尺寸，组装 DownloadedImageInfo 作为 tasks
            element_names = self._generate_element_names(raw_infos)
            download_tasks: List[DownloadedImageInfo] = []
            for idx, info in enumerate(raw_infos):
                abs_path = project_path / info["relative_path"]
                try:
                    ws_relative = str(abs_path.relative_to(workspace_path))
                except ValueError:
                    ws_relative = str(abs_path)
                w, h = await self._read_image_dimensions_with_retry(tool_context, ws_relative)
                download_tasks.append(DownloadedImageInfo(
                    element_name=element_names[idx],
                    relative_path=info["relative_path"],
                    actual_width=w or float(info.get("width") or 400.0),
                    actual_height=h or float(info.get("height") or 300.0),
                ))

            # 5. 交给 BaseGenerateCanvasElements 三阶段流程
            #    Phase 1: 按 actual_width/height 创建占位符（水平排列）
            #    Phase 2: _execute_task_item 直接用已下载的 src 更新占位符
            #    Phase 3: 汇总结果
            return await self._run_generate_flow(tool_context, params.project_path, download_tasks)

        except Exception as e:
            logger.exception(f"search_canvas_images 失败: {e!s}")
            return ToolResult.error(
                f"搜索图片到画布失败: {e!s}",
                extra_info={"error_type": "design.error_unexpected"},
            )

    # ------------------------------------------------------------------
    # 实现 BaseGenerateCanvasElements 抽象接口
    # ------------------------------------------------------------------

    def _get_task_placeholder_info(self, task: DownloadedImageInfo, idx: int) -> TaskPlaceholderInfo:
        return TaskPlaceholderInfo(
            name=task.element_name,
            width=task.actual_width,
            height=task.actual_height,
            element_type="image",
        )

    async def _execute_task_item(
        self,
        idx: int,
        task: DownloadedImageInfo,
        placeholder: ElementDetail,
        tool_context: ToolContext,
        project_path: Path,
        **kwargs: Any,
    ) -> TaskExecutionResult:
        # 图片已下载完毕，直接将 src 写回占位符即可
        return TaskExecutionResult(
            index=idx,
            success=True,
            placeholder_update=SearchImagePlaceholderUpdate(
                status="completed",
                src=task.relative_path,
                width=task.actual_width,
                height=task.actual_height,
            ),
        )

    # ------------------------------------------------------------------
    # 覆盖钩子
    # ------------------------------------------------------------------

    def _build_created_element_dict(
        self,
        placeholder: ElementDetail,
        task_result: TaskExecutionResult,
    ) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "id": placeholder.id,
            "type": placeholder.type,
            "name": placeholder.name,
            "width": placeholder.width,
            "height": placeholder.height,
        }
        if task_result.is_success:
            update = task_result.placeholder_update
            if isinstance(update, SearchImagePlaceholderUpdate) and update.src:
                d["src"] = update.src
        return d

    # ------------------------------------------------------------------
    # 覆盖结果文案
    # ------------------------------------------------------------------

    def _build_result_content(
        self,
        project_path: Path,
        tasks: List[DownloadedImageInfo],
        placeholders: List[ElementDetail],
        task_results: List[TaskExecutionResult],
    ) -> str:
        total = len(tasks)
        succeeded = sum(1 for r in task_results if r.is_success)
        failed = total - succeeded

        result = (
            f"Searched and Added to Canvas:\n"
            f"- Success: {succeeded} / {total} images\n"
            f"- Project: {project_path}"
        )

        success_results = [r for r in task_results if r.is_success]
        if success_results:
            result += "\n\nCreated Elements:"
            for r in success_results[:8]:
                p = placeholders[r.index]
                pos = f" at ({p.x:.0f}, {p.y:.0f})" if p.x is not None and p.y is not None else ""
                result += f"\n- {p.name} (id: {p.id}){pos}"

        failed_results = [r for r in task_results if r.is_failed]
        if failed_results:
            result += f"\n\nFailed: {failed} elements"
            for r in failed_results[:8]:
                p = placeholders[r.index]
                result += f"\n- {p.name}: {r.error_message or 'unknown error'}"

        return result

    # ------------------------------------------------------------------
    # 搜索与下载
    # ------------------------------------------------------------------

    @staticmethod
    def _build_requirements_xml(tasks: List[SearchTaskSpec]) -> str:
        """将 tasks 列表转为 image_search 所需的 requirements_xml 格式"""
        parts = ["<requirements>"]
        for task in tasks:
            parts.append("  <requirement>")
            parts.append(f"    <name>{task.name}</name>")
            parts.append(f"    <query>{task.query}</query>")
            if task.requirement_explanation:
                parts.append(f"    <requirement_explanation>{task.requirement_explanation}</requirement_explanation>")
            if task.expected_aspect_ratio:
                parts.append(f"    <expected_aspect_ratio>{task.expected_aspect_ratio}</expected_aspect_ratio>")
            parts.append(f"    <count>{task.count}</count>")
            parts.append("  </requirement>")
        parts.append("</requirements>")
        return "\n".join(parts)

    def _extract_image_urls(self, search_result: ToolResult) -> List[Dict[str, Any]]:
        """从搜索结果提取图片 URL 信息"""
        image_urls = []
        extra_info = search_result.extra_info or {}
        requirement_results = extra_info.get("requirement_results", [])

        if not requirement_results:
            logger.warning("_extract_image_urls: extra_info 中没有 requirement_results")
            return image_urls

        for requirement_result in requirement_results:
            requirement_data = requirement_result.get("requirement_data", {})
            requirement_name = requirement_data.get("name", "image")
            for img in requirement_result.get("images", []):
                if hasattr(img, "url") and img.url:
                    url = img.url
                elif isinstance(img, dict) and "url" in img:
                    url = img["url"]
                else:
                    logger.warning(f"图片缺少 url: {img}")
                    continue
                image_urls.append({
                    "url": url,
                    "width": getattr(img, "width", 0) if hasattr(img, "width") else img.get("width", 0),
                    "height": getattr(img, "height", 0) if hasattr(img, "height") else img.get("height", 0),
                    "name": getattr(img, "name", "") if hasattr(img, "name") else img.get("name", ""),
                    "requirement_name": requirement_name,
                })

        return image_urls

    async def _download_images_to_project(
        self,
        image_urls: List[Dict[str, Any]],
        relative_images_dir: str,
        workspace_path: Path,
        project_path: Path,
        tool_context: ToolContext,
    ) -> List[Dict[str, Any]]:
        """并发下载图片到项目 images 目录"""
        seen_urls: Dict[str, bool] = {}
        unique_urls = []
        for info in image_urls:
            if info["url"] not in seen_urls:
                seen_urls[info["url"]] = True
                unique_urls.append(info)

        semaphore = asyncio.Semaphore(20)
        coroutines = []
        for idx, info in enumerate(unique_urls):
            image_name = info.get("name") or info.get("requirement_name") or "image"
            clean_name = self._sanitize_filename(image_name, max_length=180)
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            ext = self._get_file_extension_from_url(info["url"])
            file_path = f"{relative_images_dir}/{clean_name}_{timestamp}_{idx + 1}{ext}"
            coroutines.append(
                self._download_single_image_with_semaphore(
                    info, file_path, workspace_path, project_path, tool_context, semaphore
                )
            )

        results = await asyncio.gather(*coroutines, return_exceptions=True)

        downloaded = []
        for idx, result in enumerate(results):
            if isinstance(result, Exception):
                logger.warning(f"下载图片失败: {unique_urls[idx]['url']} - {result}")
            elif result:
                downloaded.append(result)
        return downloaded

    async def _download_single_image_with_semaphore(
        self,
        image_info: Dict[str, Any],
        file_path: str,
        workspace_path: Path,
        project_path: Path,
        tool_context: ToolContext,
        semaphore: asyncio.Semaphore,
    ) -> Optional[Dict[str, Any]]:
        async with semaphore:
            return await self._download_single_image(
                image_info, file_path, workspace_path, project_path, tool_context
            )

    async def _download_single_image(
        self,
        image_info: Dict[str, Any],
        file_path: str,
        workspace_path: Path,
        project_path: Path,
        tool_context: ToolContext,
    ) -> Optional[Dict[str, Any]]:
        try:
            result = await self._download_tool.execute(
                tool_context,
                DownloadFromUrlParams(url=image_info["url"], file_path=file_path),
            )
            if result.ok and result.extra_info:
                downloaded_path = result.extra_info.get("file_path")
                if downloaded_path:
                    downloaded_file_path = Path(downloaded_path)
                    is_valid, error_msg = await self._validate_image_file(str(downloaded_file_path))
                    if not is_valid:
                        logger.warning(f"下载的图片文件校验失败: {error_msg}")
                        try:
                            if downloaded_file_path.exists():
                                await async_unlink(downloaded_file_path)
                        except Exception as e:
                            logger.warning(f"删除无效文件失败: {downloaded_path} - {e}")
                        return None
                    try:
                        relative_path = str(downloaded_file_path.relative_to(project_path))
                    except ValueError:
                        try:
                            relative_path = str(downloaded_file_path.relative_to(workspace_path))
                        except ValueError:
                            relative_path = file_path
                    return {
                        "relative_path": relative_path,
                        "width": image_info["width"],
                        "height": image_info["height"],
                        "name": image_info["name"],
                        "requirement_name": image_info["requirement_name"],
                    }
            logger.warning(f"下载失败: {image_info['url']} - {result.content or 'Unknown error'}")
            return None
        except Exception as e:
            logger.warning(f"下载图片异常: {image_info['url']} - {e}")
            return None

    # noinspection PyMethodMayBeStatic
    def _get_file_extension_from_url(self, url: str) -> str:
        """从 URL 提取文件扩展名，默认 .jpg"""
        parsed = urlparse(url)
        path = parsed.path
        if "." in path:
            ext = path.rsplit(".", 1)[-1].lower()
            if ext in {"jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"}:
                return f".{ext}"
        return ".jpg"

    @staticmethod
    def _generate_element_names(image_infos: List[Dict]) -> List[str]:
        """按 requirement_name 分组生成元素名称，多张图自动加 _1 _2 后缀"""
        from collections import Counter

        name_counts: Counter = Counter(info["requirement_name"] for info in image_infos)
        name_counters: Dict[str, int] = {}
        names = []
        for info in image_infos:
            req_name = info["requirement_name"]
            if name_counts[req_name] == 1:
                names.append(req_name)
            else:
                name_counters[req_name] = name_counters.get(req_name, 0) + 1
                names.append(f"{req_name}_{name_counters[req_name]}")
        return names

    # ------------------------------------------------------------------
    # 展示与 i18n
    # ------------------------------------------------------------------

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        if not result.ok:
            return i18n.translate("search_canvas_images.exception", category="tool.messages")
        succeeded_count = result.extra_info.get("succeeded_count", 0) if result.extra_info else 0
        if succeeded_count == 1:
            return i18n.translate("search_canvas_images.success_single", category="tool.messages")
        return i18n.translate(
            "search_canvas_images.success_multiple",
            category="tool.messages",
            succeeded_count=succeeded_count,
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        if not result.ok:
            return self._handle_design_tool_error(
                result,
                default_action_code="search_canvas_images",
                default_success_message_code="search_canvas_images.exception",
            )
        return {
            "action": i18n.translate("search_canvas_images", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments),
        }

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: Dict[str, Any] = None,
    ) -> Optional[ToolDetail]:
        if not result.ok:
            return None
        try:
            from app.core.entity.message.server_message import DesignElementContent

            extra_info = result.extra_info or {}
            return ToolDetail(
                type=DisplayType.DESIGN,
                data=DesignElementContent(
                    type="element",
                    project_path=extra_info.get("project_path", ""),
                    elements=extra_info.get("elements", []),
                ),
            )
        except Exception as e:
            logger.error(f"生成工具详情失败: {e!s}")
            return None
