"""Browser 页面观察与视觉分析 Code Mode 工具。"""

from __future__ import annotations

import asyncio
import json
import re
from enum import StrEnum
from pathlib import Path
from typing import Generic, TypeVar

from pydantic import Field, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.context.agent_context import AgentContext
from app.core.entity.message.server_message import ToolDetail
from app.service.browser import BrowserScreenshotArtifact, BrowserScreenshotService, BrowserService
from app.service.browser.browser_file_adapter import BrowserFileAdapter
from app.service.browser.browser_tool_result_builder import BrowserToolResultBuilder
from app.tools.browser.base import BrowserToolBase, BrowserToolParams
from app.tools.browser.presentation.observation import (
    find_detail,
    find_visual_detail,
    list_elements_detail,
    read_html_detail,
    read_page_detail,
    screenshot_detail,
    visual_query_detail,
)
from app.tools.core import tool
from app.tools.snippet_timeout_registry import SdkSnippetTimeoutRegistry
from app.utils.async_file_utils import async_exists
from magic_use import ElementQuery, ElementScope, FindQuery
from magic_use.errors import BrowserSDKError
from magic_use.models import BrowserPage

P = TypeVar("P", bound=BrowserToolParams)

logger = get_logger(__name__)

# 视觉工具包含截图处理、对象存储发布和模型推理。为包含视觉调用的 Code Mode
# 脚本预留完整执行时间，避免前序 Browser 操作占用默认 60 秒后取消仍在运行的视觉请求。
SdkSnippetTimeoutRegistry.register(
    ["browser_visual_query", "browser_find_visual"],
    min_timeout=120,
)


class BrowserReadScope(StrEnum):
    VIEWPORT = "viewport"
    FULL = "full"


class BrowserHtmlDetail(StrEnum):
    OUTLINE = "outline"
    FULL = "full"


class BrowserReadPageParams(BrowserToolParams):
    scope: BrowserReadScope = Field(BrowserReadScope.VIEWPORT, description="Read the viewport or full rendered page.")
    tab_id: str | None = Field(None, description="Tab ID returned by a Browser tool. Omit to use the default tab.")


class BrowserReadHtmlParams(BrowserToolParams):
    ref: str | None = Field(
        None,
        description="""<!--zh: 以该元素为根只读它这一块。省略则读整个 body。-->
Read only this element's subtree. Omit to read the whole body.""",
    )
    detail: BrowserHtmlDetail = Field(
        BrowserHtmlDetail.OUTLINE,
        description="""<!--zh: outline 折叠重复节点并截断文本，用来看清结构；full 展开全部内容，只对已经缩小的范围使用。-->
outline collapses repeated nodes and trims text, for seeing structure. full expands everything and should only be used on a narrowed ref.""",
    )
    max_chars: int = Field(20_000, ge=1_000, le=200_000, description="Maximum characters to return.")
    tab_id: str | None = Field(None, description="Tab ID returned by a Browser tool. Omit to use the default tab.")


class BrowserFindParams(BrowserToolParams):
    role: str | None = Field(None, description="ARIA role. Omit when the role is uncertain.")
    name: str | None = Field(None, description="Accessible name substring, case-insensitive.")
    text: str | None = Field(None, description="Visible text substring, case-insensitive.")
    visible_only: bool = Field(True, description="Only return visible elements.")
    limit: int = Field(20, ge=1, le=100, description="Maximum number of matches to return.")
    tab_id: str | None = Field(None, description="Tab ID returned by a Browser tool. Omit to use the default tab.")


class BrowserListElementsParams(BrowserToolParams):
    scope: ElementScope = Field(ElementScope.INTERACTIVE, description="Structured element-list scope.")
    ref: str | None = Field(None, description="Root ref required for a subtree element list.")
    tab_id: str | None = Field(None, description="Tab ID returned by a Browser tool. Omit to use the default tab.")


class BrowserScreenshotParams(BrowserToolParams):
    labels: bool = Field(False, description="Overlay labels mapped to current element refs.")
    full_page: bool = Field(False, description="Capture the full scrollable page instead of the viewport.")
    output_path: str | None = Field(
        None,
        description="Optional workspace path ending in .webp, .jpg, .jpeg, or .png. Omit for a temporary UI screenshot. Do not capture a screenshot in order to analyze it; use browser_visual_query instead.",
    )
    scale: float | None = Field(
        None,
        ge=0.5,
        le=3.0,
        description="Optional saved-resolution multiplier. Omit to use the same adaptive resolution as the Tool Detail screenshot.",
    )
    quality: int | None = Field(
        None,
        ge=1,
        le=100,
        description="Optional WebP or JPEG quality from 1 to 100. Omit to use the Tool Detail snapshot quality. Invalid for PNG.",
    )
    tab_id: str | None = Field(None, description="Tab ID returned by a Browser tool. Omit to use the default tab.")

    @model_validator(mode="after")
    def validate_output_options(self) -> "BrowserScreenshotParams":
        if self.quality is not None and self.output_path is None:
            raise ValueError("quality requires output_path because temporary screenshots use managed settings")
        if self.scale is not None and self.output_path is None:
            raise ValueError("scale requires output_path because temporary screenshots use managed settings")
        if self.quality is not None and Path(self.output_path or "").suffix.lower() == ".png":
            raise ValueError("quality is only valid for WebP or JPEG screenshot output")
        return self


class BrowserVisualQueryParams(BrowserToolParams):
    query: str = Field(..., min_length=1, description="Precise question about the rendered page image.")
    full_page: bool = Field(False, description="Analyze the full scrollable page instead of the viewport.")
    tab_id: str | None = Field(None, description="Tab ID returned by a Browser tool. Omit to use the default tab.")


class BrowserFindVisualParams(BrowserToolParams):
    target: str = Field(..., min_length=1, description="Visual target to identify among labeled elements.")
    tab_id: str | None = Field(None, description="Tab ID returned by a Browser tool. Omit to use the default tab.")


class _BrowserVisualToolBase(BrowserToolBase[P], Generic[P]):
    """浏览器视觉工具基类，复用截图 artifact、原生视觉和同步定位分析。"""

    async def _execute_visual_query(
        self,
        tool_context: ToolContext,
        *,
        service: BrowserService,
        current_page: BrowserPage,
        query: str,
        labels: bool,
        full_page: bool,
    ) -> ToolResult:
        async def operation() -> ToolResult:
            page, screenshot = await service.screenshot(
                current_page.id,
                full_page=full_page,
                labels=labels,
                session_id=current_page.session_id,
            )
            if self.name == "browser_visual_query":
                artifact = await BrowserScreenshotService(tool_context).publish(screenshot.image)
                if await self._push_native_visual_message(
                    tool_context,
                    query=query,
                    artifact=artifact,
                ):
                    await self.record_page_observation(
                        tool_context,
                        page_id=page.id,
                        url=page.url,
                        title=page.title,
                    )
                    return BrowserToolResultBuilder.native_visual(
                        page,
                        screenshot,
                        artifact,
                        query,
                    )
                analysis = await service.analyze_screenshot(screenshot.image, query)
                await self.record_page_observation(
                    tool_context,
                    page_id=page.id,
                    url=page.url,
                    title=page.title,
                )
                return BrowserToolResultBuilder.visual(page, screenshot, artifact, analysis)

            artifact_task = asyncio.create_task(
                BrowserScreenshotService(tool_context).publish(screenshot.image)
            )
            analysis_task = asyncio.create_task(
                service.analyze_screenshot(screenshot.image, query)
            )
            try:
                # 截图发布和视觉推理彼此独立，并行执行可避免对象存储时延串行叠加到模型时延上。
                artifact = await artifact_task
                analysis = await analysis_task
            except asyncio.CancelledError:
                artifact_task.cancel()
                analysis_task.cancel()
                await asyncio.gather(artifact_task, analysis_task, return_exceptions=True)
                raise
            except BrowserSDKError as exc:
                if not artifact_task.done():
                    artifact_task.cancel()
                if not analysis_task.done():
                    analysis_task.cancel()
                await asyncio.gather(artifact_task, analysis_task, return_exceptions=True)
                error_result = BrowserToolResultBuilder.error(
                    exc,
                    user_error=self._error_message(exc.code),
                )
                if not artifact_task.cancelled() and artifact_task.exception() is None:
                    return BrowserToolResultBuilder.attach_screenshot(
                        error_result,
                        page,
                        screenshot,
                        artifact_task.result(),
                    )
                return error_result
            except Exception as exc:
                if not artifact_task.done():
                    artifact_task.cancel()
                if not analysis_task.done():
                    analysis_task.cancel()
                await asyncio.gather(artifact_task, analysis_task, return_exceptions=True)
                logger.exception("Browser visual analysis failed")
                error_result = ToolResult.error(
                    f"Browser visual analysis failed because of an unexpected error: {exc}",
                    data={"error_code": "unexpected_error"},
                    extra_info={
                        "error_code": "unexpected_error",
                        "user_error": self._message("browser.error.unexpected"),
                    },
                )
                if not artifact_task.cancelled() and artifact_task.exception() is None:
                    return BrowserToolResultBuilder.attach_screenshot(
                        error_result,
                        page,
                        screenshot,
                        artifact_task.result(),
                    )
                return error_result
            if self.name == "browser_visual_query":
                await self.record_page_observation(
                    tool_context,
                    page_id=page.id,
                    url=page.url,
                    title=page.title,
                )
            return BrowserToolResultBuilder.visual(page, screenshot, artifact, analysis)

        return await self.execute_safely(operation())

    async def _push_native_visual_message(
        self,
        tool_context: ToolContext,
        *,
        query: str,
        artifact: BrowserScreenshotArtifact,
    ) -> bool:
        agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
        if agent_context is None:
            return False
        try:
            model_state = agent_context.model_context.resolve_text_model()
            if not model_state.config.supports_multimodal:
                return False
            from app.service.native_visual_message_builder import NativeVisualMessageBuilder

            message = await NativeVisualMessageBuilder(
                agent_context.get_workspace_dir()
            ).build_user_message(
                query,
                [artifact.source_ref],
                show_in_ui=False,
                source="native_visual",
            )
            agent_context.horizon.push_user_message(message)
            return True
        except asyncio.CancelledError:
            raise
        except (AttributeError, OSError, ValueError):
            logger.warning("Browser native visual message preparation failed", exc_info=True)
            return False


# Agent-facing usage is documented in agents/skills/browser/.
@tool(name="browser_read_page", code_mode_only=True)
class BrowserReadPage(BrowserToolBase[BrowserReadPageParams]):
    """Read rendered page content through Lens."""

    name = "browser_read_page"
    operation_key = "browser.read_as_markdown"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, read_page_detail(result))

    async def execute(self, tool_context: ToolContext, params: BrowserReadPageParams) -> ToolResult:
        async def operation(service: BrowserService, current_page: BrowserPage) -> ToolResult:
            page, markdown = await service.read_page(
                current_page.id,
                params.scope.value,
                current_page.session_id,
            )
            await self.record_page_observation(
                tool_context,
                page_id=page.id,
                url=page.url,
                title=page.title,
            )
            return BrowserToolResultBuilder.markdown(page, params.scope.value, markdown)

        return await self.execute_current_page(tool_context, operation, tab_id=params.tab_id)


# Agent-facing usage is documented in agents/skills/browser/.
@tool(name="browser_read_html", code_mode_only=True)
class BrowserReadHtml(BrowserToolBase[BrowserReadHtmlParams]):
    """Read real markup structure for application-style pages and selector discovery.

    Use browser_read_page for articles and documents. Use this when browser_read_page
    returns little or nothing, or before browser_evaluate so selectors come from real markup.
    """

    name = "browser_read_html"
    operation_key = "browser.read_html"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, read_html_detail(result))

    async def execute(self, tool_context: ToolContext, params: BrowserReadHtmlParams) -> ToolResult:
        async def operation(service: BrowserService, current_page: BrowserPage) -> ToolResult:
            page, html, truncated = await service.read_html(
                current_page.id,
                ref=params.ref,
                detail=params.detail.value,
                max_chars=params.max_chars,
                session_id=current_page.session_id,
            )
            await self.record_page_observation(
                tool_context,
                page_id=page.id,
                url=page.url,
                title=page.title,
            )
            return BrowserToolResultBuilder.html_outline(
                page,
                ref=params.ref,
                detail=params.detail.value,
                html=html,
                truncated=truncated,
                max_chars=params.max_chars,
            )

        return await self.execute_current_page(tool_context, operation, tab_id=params.tab_id)


# Agent-facing usage is documented in agents/skills/browser/.
@tool(name="browser_find", code_mode_only=True)
class BrowserFind(BrowserToolBase[BrowserFindParams]):
    """Find page elements by accessible role, name, or visible text without guessing a ref."""

    name = "browser_find"
    operation_key = "browser.find_element"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, find_detail(result))

    async def execute(self, tool_context: ToolContext, params: BrowserFindParams) -> ToolResult:
        async def operation(service: BrowserService, current_page: BrowserPage) -> ToolResult:
            result = await service.find(
                current_page.id,
                FindQuery(
                    role=params.role,
                    name=params.name,
                    text=params.text,
                    visible_only=params.visible_only,
                    limit=params.limit,
                ),
                current_page.session_id,
            )
            return BrowserToolResultBuilder.find(result)

        return await self.execute_current_page(tool_context, operation, tab_id=params.tab_id)


# Agent-facing usage is documented in agents/skills/browser/.
@tool(name="browser_list_elements", code_mode_only=True)
class BrowserListElements(BrowserToolBase[BrowserListElementsParams]):
    """Capture a structured page snapshot and element refs."""

    name = "browser_list_elements"
    operation_key = "browser.list_elements"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, list_elements_detail(result))

    async def execute(self, tool_context: ToolContext, params: BrowserListElementsParams) -> ToolResult:
        async def operation(service: BrowserService, current_page: BrowserPage) -> ToolResult:
            snapshot = await service.snapshot(
                current_page.id,
                ElementQuery(
                    scope=params.scope,
                    root_ref=params.ref,
                ),
                current_page.session_id,
            )
            await self.record_page_observation(
                tool_context,
                page_id=snapshot.page_id,
                url=snapshot.url,
                title=snapshot.title,
            )
            return BrowserToolResultBuilder.snapshot(snapshot)

        return await self.execute_current_page(tool_context, operation, tab_id=params.tab_id)


# Agent-facing usage is documented in agents/skills/browser/.
@tool(name="browser_screenshot", code_mode_only=True)
class BrowserScreenshot(BrowserToolBase[BrowserScreenshotParams]):
    """Capture and display a Browser screenshot without analyzing it."""

    name = "browser_screenshot"
    operation_key = "browser.screenshot"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, screenshot_detail(result))

    async def execute(self, tool_context: ToolContext, params: BrowserScreenshotParams) -> ToolResult:
        async def operation(service: BrowserService, current_page: BrowserPage) -> ToolResult:
            page, screenshot = await service.screenshot(
                current_page.id,
                full_page=params.full_page,
                labels=params.labels,
                session_id=current_page.session_id,
            )
            screenshot_service = BrowserScreenshotService(tool_context)
            encoded = await screenshot_service.encode(screenshot.image)
            saved = None
            if params.output_path is not None:
                agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
                if agent_context is None:
                    raise ValueError("Agent context is required to save a Browser screenshot")
                file_path, workspace_path = await BrowserFileAdapter.resolve_workspace_output_path(
                    agent_context.get_workspace_dir(),
                    params.output_path,
                )
                file_exists = await async_exists(file_path)
                before_event = EventType.BEFORE_FILE_UPDATED if file_exists else EventType.BEFORE_FILE_CREATED
                await self._dispatch_file_event(
                    tool_context,
                    str(file_path),
                    before_event,
                    is_screenshot=True,
                )
                saved = await BrowserFileAdapter.save_workspace_screenshot(
                    screenshot.image,
                    file_path=file_path,
                    workspace_path=workspace_path,
                    scale=params.scale,
                    quality=params.quality,
                    default_width=encoded.width,
                    default_height=encoded.height,
                    default_quality=encoded.quality,
                )
                after_event = EventType.FILE_UPDATED if file_exists else EventType.FILE_CREATED
                await self._dispatch_file_event(
                    tool_context,
                    str(file_path),
                    after_event,
                    is_screenshot=True,
                )
                artifact = encoded
            else:
                artifact = await screenshot_service.publish(encoded)
            return BrowserToolResultBuilder.screenshot(page, screenshot, artifact, saved)

        return await self.execute_current_page(tool_context, operation, tab_id=params.tab_id)


# Agent-facing usage is documented in agents/skills/browser/.
@tool(name="browser_visual_query", code_mode_only=True)
class BrowserVisualQuery(_BrowserVisualToolBase[BrowserVisualQueryParams]):
    """Answer a visual question about the rendered Browser page."""

    name = "browser_visual_query"
    operation_key = "browser.visual_query"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, visual_query_detail(result, arguments or {}))

    async def execute(self, tool_context: ToolContext, params: BrowserVisualQueryParams) -> ToolResult:
        async def operation(service: BrowserService, current_page: BrowserPage) -> ToolResult:
            return await self._execute_visual_query(
                tool_context,
                service=service,
                current_page=current_page,
                query=params.query,
                labels=False,
                full_page=params.full_page,
            )

        return await self.execute_current_page(tool_context, operation, tab_id=params.tab_id)


# Agent-facing usage is documented in agents/skills/browser/.
@tool(name="browser_find_visual", code_mode_only=True)
class BrowserFindVisual(_BrowserVisualToolBase[BrowserFindVisualParams]):
    """Identify a visual target in a labeled screenshot."""

    name = "browser_find_visual"
    operation_key = "browser.find_interactive_element_visually"

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None) -> ToolDetail:
        return self.create_browser_tool_detail(result, find_visual_detail(result))

    async def execute(self, tool_context: ToolContext, params: BrowserFindVisualParams) -> ToolResult:
        async def operation(service: BrowserService, current_page: BrowserPage) -> ToolResult:
            query = (
                "Inspect this labeled browser screenshot and identify the target described below. "
                "Return exactly one visible label and brief visual evidence. Use this format: "
                'Label: A<number>\\nEvidence: <why it matches>. '
                "Do not mention alternative labels, invent labels, or return element refs.\n\n"
                f"Target: {params.target}"
            )
            visual_result = await self._execute_visual_query(
                tool_context,
                service=service,
                current_page=current_page,
                query=query,
                labels=True,
                full_page=False,
            )
            if not visual_result.ok:
                return visual_result
            analysis = visual_result.data.get("analysis")
            labels = visual_result.data.get("label_to_ref")
            page = visual_result.data.get("page")
            if not isinstance(analysis, str) or not isinstance(labels, dict) or not isinstance(page, dict):
                return BrowserToolResultBuilder.visual_match_error(
                    visual_result,
                    "Visual analysis returned an incomplete labeled-screenshot result. Capture a fresh visual match.",
                )
            valid_labels = {
                label.upper(): ref
                for label, ref in labels.items()
                if isinstance(label, str) and isinstance(ref, str)
            }
            matched_labels = self._matched_labels(analysis, tuple(valid_labels))
            if len(matched_labels) != 1:
                reason = (
                    "Visual analysis did not identify a valid label."
                    if not matched_labels
                    else "Visual analysis identified more than one valid label."
                )
                return BrowserToolResultBuilder.visual_match_error(
                    visual_result,
                    f"{reason} Capture a fresh visual match and require one label only.",
                )
            label = matched_labels[0]
            generation = page.get("document_generation")
            if not isinstance(generation, int):
                return BrowserToolResultBuilder.visual_match_error(
                    visual_result,
                    "Visual analysis returned no document generation. Capture a fresh visual match.",
                )
            return BrowserToolResultBuilder.visual_match(
                visual_result,
                page_id=current_page.id,
                document_generation=generation,
                target=params.target,
                label=label,
                ref=valid_labels[label],
                evidence=self._evidence(analysis),
            )

        return await self.execute_current_page(tool_context, operation, tab_id=params.tab_id)

    @staticmethod
    def _matched_labels(analysis: str, valid_labels: tuple[str, ...]) -> tuple[str, ...]:
        matched = []
        for label in valid_labels:
            pattern = rf"(?<![A-Z0-9]){re.escape(label)}(?![A-Z0-9])"
            if re.search(pattern, analysis, flags=re.IGNORECASE):
                matched.append(label)
        return tuple(matched)

    @staticmethod
    def _evidence(analysis: str) -> str:
        try:
            payload = json.loads(analysis)
        except json.JSONDecodeError:
            payload = None
        if isinstance(payload, dict):
            evidence = payload.get("evidence")
            if isinstance(evidence, str) and evidence.strip():
                return evidence.strip()
        match = re.search(r"(?im)^\s*evidence\s*:\s*(.+(?:\n(?!\s*label\s*:).+)*)", analysis)
        if match:
            return " ".join(match.group(1).split())
        return " ".join(analysis.split())
