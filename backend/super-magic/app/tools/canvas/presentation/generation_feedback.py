"""Canvas 生成类工具的用户反馈构建。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Mapping, cast

from agentlang.context.tool_context import ToolContext
from agentlang.event import EventPairType, get_correlation_manager
from agentlang.event.data import PendingToolCallEventData
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import (
    DisplayType,
    OperationResultItem,
    OperationResultListContent,
    OperationResultStatus,
    OperationResultTarget,
    OperationResultTargetType,
    ToolDetail,
)
from app.i18n import i18n
from app.tools.canvas.application.results.base import CanvasResult
from app.tools.canvas.domain.content_fields.generated_media_protocol import (
    generated_media_types,
    ordered_generated_media_types,
)

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext
    from app.tools.core.base_tool import BaseTool

logger = get_logger(__name__)


@dataclass
class GenerationMediaCounts:
    """记录一种媒体类型在本次批量操作中的状态数量。"""

    media_type: str
    total: int = 0
    completed: int = 0
    processing: int = 0
    failed: int = 0


@dataclass
class GenerationFeedbackSummary:
    """记录生成反馈需要的媒体分类统计。"""

    by_type: dict[str, GenerationMediaCounts]

    @property
    def media_types(self) -> tuple[str, ...]:
        """返回按稳定顺序排列的媒体类型。"""
        return tuple(media_type for media_type in ordered_generated_media_types() if media_type in self.by_type)

    @property
    def total(self) -> int:
        """返回生成任务总数。"""
        return sum(item.total for item in self.by_type.values())

    @property
    def is_supported(self) -> bool:
        """判断本次操作是否是纯图片/视频生成批次。"""
        return bool(self.by_type) and all(media_type in generated_media_types() for media_type in self.by_type)

    @property
    def is_mixed(self) -> bool:
        """判断本次批次是否同时包含图片和视频。"""
        return len(self.media_types) > 1

    def media_label(self) -> str:
        """返回详情中使用的媒体类型名称。"""
        if self.media_types == ("image",):
            return i18n.translate("canvas.media.image", category="tool.messages")
        if self.media_types == ("video",):
            return i18n.translate("canvas.media.video", category="tool.messages")
        return i18n.translate("canvas.media.image_video", category="tool.messages")


class CanvasGenerationFeedback:
    """根据生成参数和结果统一构建 Canvas 的 action、remark 与 detail 数据。"""

    _GENERATED_SOURCES = {"generated"}
    _MEDIA_TYPES = generated_media_types()
    _COMPLETED_STATUSES = {"added", "completed"}
    _PROCESSING_STATUSES = {"pending", "processing", "queued", "running"}
    _FAILED_STATUSES = {
        "failed",
        "error",
        "not_found",
        "not_applicable",
        "not_applied",
        "unavailable",
    }

    @classmethod
    async def report_placeholders(
        cls,
        tool: BaseTool,
        tool_context: ToolContext,
        arguments: dict[str, Any],
        result: CanvasResult,
    ) -> None:
        """把已经保存的占位元素投影为现有工具卡片的进行中明细。"""
        try:
            detail = cls.operation_result_detail(ToolResult(content="", data=result.to_dict()), arguments)
            if detail is not None:
                await cls.report_pending_detail(tool, tool_context, arguments, detail)
        except Exception as error:
            logger.warning("构建 Canvas 占位元素进度失败: %s", error)

    @staticmethod
    async def report_pending_detail(
        tool: BaseTool,
        tool_context: ToolContext,
        arguments: dict[str, Any],
        detail: ToolDetail,
    ) -> None:
        """复用工具进度事件更新同一张卡片，消息发送失败不阻断实际生成。"""
        agent_context = cast("AgentContext | None", tool_context.get_extension("agent_context"))
        if agent_context is None:
            return
        try:
            friendly = await tool.get_before_tool_call_friendly_action_and_remark(
                tool.name, tool_context, arguments,
            )
            correlation_id = get_correlation_manager().get_active_correlation_id(
                EventPairType.TOOL_CALL, agent_context.context_id,
            ) or tool_context.tool_call_id
            detail_data = detail.model_dump(mode="json", exclude_none=True)
            # 两代消息工厂都从 detail.data.message 读取 remark；保持工具状态 running，
            # 例：2 个占位元素已保存，只提供定位入口，不表示 2 张图片已经生成。
            detail_data["data"]["message"] = friendly.get("remark", "")
            event_data = PendingToolCallEventData(
                tool_context=tool_context,
                tool_name=tool.name,
                tool_instance=tool,
                correlation_id=correlation_id,
                arguments={
                    "name": tool.name,
                    "action": friendly.get("action", ""),
                    "detail": detail_data,
                    "correlation_id": correlation_id,
                },
            )
            agent_context.update_activity_time()
            await agent_context.dispatch_event(EventType.PENDING_TOOL_CALL, event_data)
        except Exception as error:
            logger.warning("发送 Canvas 占位元素进度失败: %s", error)

    @classmethod
    def from_arguments(cls, arguments: Mapping[str, Any] | None) -> GenerationFeedbackSummary:
        """从工具调用参数统计生成媒体类型和任务总数。"""
        return cls._summarize(arguments=arguments, result_items=None)

    @classmethod
    def is_pure_generated_batch(cls, arguments: Mapping[str, Any] | None) -> bool:
        """判断批次是否全部由图片或视频生成 Content 组成。"""
        items = cls._argument_items(arguments)
        if not items:
            return False
        return all(
            isinstance(item.get("content"), Mapping)
            and item["content"].get("source") in cls._GENERATED_SOURCES
            and item["content"].get("content_type") in cls._MEDIA_TYPES
            for item in items
        )

    @classmethod
    def from_result(
        cls,
        result: ToolResult,
        arguments: Mapping[str, Any] | None,
    ) -> GenerationFeedbackSummary:
        """结合工具结果和原始参数统计成功、处理中、失败数量。"""
        data = result.data or {}
        result_items = data.get("items") if isinstance(data, dict) else None
        return cls._summarize(arguments=arguments, result_items=result_items)

    @classmethod
    def action_key(cls, summary: GenerationFeedbackSummary, *, pending: bool = False) -> str:
        """返回当前生成阶段对应的国际化 action 键。"""
        if summary.media_types == ("image",):
            return "canvas.generate_image_ing" if pending else "canvas.generate_image"
        if summary.media_types == ("video",):
            return "canvas.generate_video_ing" if pending else "canvas.generate_video"
        return "canvas.generate_media_ing" if pending else "canvas.generate_media"

    @classmethod
    def remark(
        cls,
        summary: GenerationFeedbackSummary,
        *,
        pending: bool = False,
        names: tuple[str, ...] = (),
    ) -> str:
        """将统计结果转换成用户可读的生成反馈。"""
        if pending:
            return "、".join(names) if names else cls._pending_remark(summary)
        segments = []
        for media_type in summary.media_types:
            counts = summary.by_type[media_type]
            label = cls._media_label(media_type)
            for key, count in (
                ("completed", counts.completed),
                ("processing", counts.processing),
                ("failed", counts.failed),
            ):
                if count:
                    segments.append(
                        i18n.translate(
                            f"canvas.generate_status.{key}",
                            category="tool.messages",
                            count=count,
                            media=label,
                        )
                    )
        if not segments:
            return i18n.translate("canvas.operation_failed", category="tool.messages")
        return "；".join(segments)

    @classmethod
    def failure_remark(cls, summary: GenerationFeedbackSummary, names: tuple[str, ...] = ()) -> str:
        """构建整批生成调用失败时的具体媒体反馈。"""
        if names:
            return "；".join(
                i18n.translate(
                    "canvas.generate_named_item_status.failed",
                    category="tool.messages",
                    name=name,
                )
                for name in names
            )
        segments = []
        for media_type in summary.media_types:
            counts = summary.by_type[media_type]
            segments.append(
                i18n.translate(
                    "canvas.generate_status.failed",
                    category="tool.messages",
                    count=counts.total,
                    media=cls._media_label(media_type),
                )
            )
        return "；".join(segments) or i18n.translate("canvas.operation_failed", category="tool.messages")

    @classmethod
    def operation_result_detail(
        cls,
        result: ToolResult,
        arguments: Mapping[str, Any] | None,
    ) -> ToolDetail | None:
        """把纯生成批次转换为可展开的逐项结果卡片。"""
        if not cls.is_pure_generated_batch(arguments):
            return None

        data = result.data or {}
        raw_items = data.get("items") if isinstance(data, Mapping) else None
        if not isinstance(raw_items, list) or not raw_items:
            return None

        project_path = arguments.get("project_path") if isinstance(arguments, Mapping) else None
        names_by_ref = cls._names_by_item_ref(arguments)
        display_items: list[OperationResultItem] = []
        for raw_item in raw_items:
            if not isinstance(raw_item, Mapping):
                continue
            item_ref = str(raw_item.get("item_ref") or "")
            element_id = str(raw_item.get("element_id") or "")
            status = str(raw_item.get("status") or "").casefold()
            label = names_by_ref.get(item_ref) or item_ref or element_id
            if not label:
                continue

            is_failed = status not in cls._COMPLETED_STATUSES | cls._PROCESSING_STATUSES
            operation_status = OperationResultStatus.ERROR if is_failed else OperationResultStatus.SUCCESS
            if is_failed:
                message_key = "canvas.generate_item_status.failed"
            elif status in cls._PROCESSING_STATUSES:
                message_key = "canvas.generate_item_status.processing"
            else:
                message_key = "canvas.generate_item_status.completed"

            target = None
            if isinstance(project_path, str) and project_path.strip() and element_id:
                target = OperationResultTarget(
                    type=OperationResultTargetType.CANVAS_ELEMENT,
                    project_path=project_path,
                    element_id=element_id,
                    content_id=raw_item.get("content_id") or None,
                    content_type=cls.media_type_for_item(raw_item, arguments),
                )

            description = ""
            if is_failed:
                description = str(
                    raw_item.get("error")
                    or raw_item.get("persistence_error")
                    or raw_item.get("query_error")
                    or ""
                )
            display_items.append(
                OperationResultItem(
                    label=label,
                    kind="text",
                    status=operation_status,
                    message=i18n.translate(message_key, category="tool.messages"),
                    description=description,
                    target=target,
                    started_at=raw_item.get("started_at") or None,
                    expected_finished_at=raw_item.get("expected_finished_at") or None,
                    is_processing=status in cls._PROCESSING_STATUSES,
                )
            )

        if not display_items:
            return None
        return ToolDetail(
            type=DisplayType.OPERATION_RESULT_LIST,
            data=OperationResultListContent(items=display_items),
        )

    @classmethod
    def remark_for_result(
        cls,
        result: ToolResult,
        arguments: Mapping[str, Any] | None,
    ) -> str:
        """按名称和真实逐项状态构建终态 remark。"""
        summary = cls.from_result(result, arguments)
        names_by_ref = cls._names_by_item_ref(arguments)
        raw_items = (result.data or {}).get("items") if isinstance(result.data, Mapping) else None
        if isinstance(raw_items, list):
            segments: list[str] = []
            for raw_item in raw_items:
                if not isinstance(raw_item, Mapping):
                    continue
                item_ref = str(raw_item.get("item_ref") or "")
                label = names_by_ref.get(item_ref) or item_ref
                if not label:
                    continue
                status = str(raw_item.get("status") or "").casefold()
                if status not in cls._COMPLETED_STATUSES | cls._PROCESSING_STATUSES:
                    key = "canvas.generate_named_item_status.failed"
                elif status in cls._PROCESSING_STATUSES:
                    key = "canvas.generate_named_item_status.processing"
                else:
                    key = "canvas.generate_named_item_status.completed"
                segments.append(i18n.translate(key, category="tool.messages", name=label))
            if segments:
                return "；".join(segments)

        return cls.remark(summary, names=tuple(names_by_ref.values()))

    @classmethod
    def item_names(cls, arguments: Mapping[str, Any] | None) -> tuple[str, ...]:
        """返回按入参顺序排列的生成名称。"""
        return tuple(cls._names_by_item_ref(arguments).values())

    @classmethod
    def detail_title_key(cls, summary: GenerationFeedbackSummary) -> str:
        """返回生成详情标题对应的国际化键。"""
        if summary.media_types == ("image",):
            return "generated_images"
        if summary.media_types == ("video",):
            return "generated_videos"
        return "generated_media"

    @classmethod
    def media_type_for_item(
        cls,
        item: Mapping[str, Any],
        arguments: Mapping[str, Any] | None,
    ) -> str | None:
        """根据结果项的 item_ref 找回原始生成媒体类型。"""
        direct_type = item.get("content_type") or item.get("type") or item.get("media_type")
        if direct_type in cls._MEDIA_TYPES:
            return str(direct_type)
        item_ref = item.get("item_ref")
        for argument_item in cls._argument_items(arguments):
            if argument_item.get("item_ref") != item_ref:
                continue
            content = argument_item.get("content")
            if isinstance(content, Mapping) and content.get("source") in cls._GENERATED_SOURCES:
                media_type = content.get("content_type")
                return str(media_type) if media_type in cls._MEDIA_TYPES else None
        return None

    @classmethod
    def _summarize(
        cls,
        *,
        arguments: Mapping[str, Any] | None,
        result_items: Any,
    ) -> GenerationFeedbackSummary:
        """按参数建立类型索引，并按结果状态累计数量。"""
        type_by_ref = cls._type_by_item_ref(arguments)
        counts: dict[str, GenerationMediaCounts] = {}

        if result_items is None:
            for media_type in type_by_ref.values():
                counts.setdefault(media_type, GenerationMediaCounts(media_type)).total += 1
            return GenerationFeedbackSummary(counts)

        for item in result_items if isinstance(result_items, list) else []:
            if not isinstance(item, Mapping):
                continue
            media_type = cls.media_type_for_item(item, arguments)
            if media_type not in cls._MEDIA_TYPES:
                continue
            current = counts.setdefault(media_type, GenerationMediaCounts(media_type))
            current.total += 1
            status = str(item.get("status") or "").lower()
            if status in cls._COMPLETED_STATUSES:
                current.completed += 1
            elif status in cls._PROCESSING_STATUSES:
                current.processing += 1
            else:
                current.failed += 1
        return GenerationFeedbackSummary(counts)

    @classmethod
    def _type_by_item_ref(cls, arguments: Mapping[str, Any] | None) -> dict[str, str]:
        """收集纯 generated 图片/视频参数，排除导入和用户内容。"""
        result: dict[str, str] = {}
        for item in cls._argument_items(arguments):
            content = item.get("content")
            if not isinstance(content, Mapping) or content.get("source") not in cls._GENERATED_SOURCES:
                continue
            media_type = content.get("content_type")
            item_ref = item.get("item_ref")
            if media_type in cls._MEDIA_TYPES and item_ref:
                result[str(item_ref)] = str(media_type)
        return result

    @staticmethod
    def _argument_items(arguments: Mapping[str, Any] | None) -> list[Mapping[str, Any]]:
        """读取批量工具的 items 参数。"""
        items = arguments.get("items") if isinstance(arguments, Mapping) else None
        return [item for item in items if isinstance(item, Mapping)] if isinstance(items, list) else []

    @staticmethod
    def _media_label(media_type: str) -> str:
        """翻译图片或视频的用户展示名称。"""
        return i18n.translate(f"canvas.media.{media_type}", category="tool.messages")

    @classmethod
    def media_label_for_type(cls, media_type: str) -> str:
        """返回单个媒体类型的用户展示名称。"""
        return cls._media_label(media_type)

    @classmethod
    def _pending_remark(cls, summary: GenerationFeedbackSummary) -> str:
        """构建生成提交阶段的待处理提示。"""
        segments = []
        for media_type in summary.media_types:
            counts = summary.by_type[media_type]
            segments.append(
                i18n.translate(
                    "canvas.generate_pending",
                    category="tool.messages",
                    total=counts.total,
                    media=cls._media_label(media_type),
                )
            )
        return "；".join(segments)

    @classmethod
    def _names_by_item_ref(cls, arguments: Mapping[str, Any] | None) -> dict[str, str]:
        """按入参顺序收集生成名称，名称缺失时回退到 item_ref。"""
        result: dict[str, str] = {}
        for item in cls._argument_items(arguments):
            item_ref = str(item.get("item_ref") or "")
            if not item_ref:
                continue
            content = item.get("content")
            content_name = content.get("name") if isinstance(content, Mapping) else None
            name = str(content_name or item.get("name") or item_ref).strip()
            if name:
                result[item_ref] = name
        return result
