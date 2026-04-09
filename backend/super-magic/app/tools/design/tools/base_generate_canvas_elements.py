"""生成并写入画布元素的抽象基类

提供「占位符准备 → 并发执行任务 → 更新占位符」三阶段通用流程（Template Method 模式）。
子类只需实现 _get_task_placeholder_info 和 _execute_task_item 两个抽象方法。
占位符的创建/更新直接通过 CanvasManager 完成，水平排列布局由 base 内部实现。
"""

from __future__ import annotations

import asyncio
import dataclasses
from abc import abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Generic, List, Optional, Tuple, TypeVar

from agentlang.context.tool_context import ToolContext
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.tools.core import BaseToolParams
from app.tools.design.constants import DEFAULT_ELEMENT_SPACING
from app.tools.design.manager.canvas_manager import CanvasManager
from app.tools.design.tools.base_design_tool import BaseDesignTool
from app.tools.design.utils.canvas_layout_utils import calculate_next_element_position
from app.tools.design.utils.magic_project_design_parser import (
    ImageElement,
    VideoElement,
    flatten_all_elements,
)

logger = get_logger(__name__)

TParams = TypeVar("TParams", bound=BaseToolParams)


@dataclass
class ElementDetail:
    """画布元素快照，贯穿占位符创建、任务执行、结果汇总全流程

    占位符创建后即产生该对象；任务完成后更新写回，再次产生新快照。

    Attributes:
        id: 元素 ID
        type: 元素类型（"image" / "video" 等）
        name: 元素名称
        x: X 坐标，复用已有元素时可能为 None
        y: Y 坐标，复用已有元素时可能为 None
        width: 宽度，复用已有元素时可能为 None
        height: 高度，复用已有元素时可能为 None
    """

    id: str
    type: str
    name: str
    x: Optional[float]
    y: Optional[float]
    width: Optional[float]
    height: Optional[float]


@dataclass
class PlaceholderUpdate:
    """写回占位符的更新内容基类，子类可通过继承添加元素类型专属字段

    Attributes:
        status: 占位符状态，固定为 "completed" 或 "failed"
    """

    status: str

    def to_dict(self) -> Dict[str, Any]:
        """转换为 CanvasManager.update_element 所需的字典，自动过滤 None 值。"""
        return {k: v for k, v in dataclasses.asdict(self).items() if v is not None}


@dataclass
class TaskPlaceholderInfo:
    """占位符所需的最小信息，由子类从任务中提取

    Attributes:
        name: 元素名称
        width: 占位符宽度（像素）
        height: 占位符高度（像素）
        element_type: 画布元素类型，默认 "image"
    """

    name: str
    width: float
    height: float
    element_type: str = "image"


@dataclass
class TaskExecutionResult:
    """单个任务的执行结果

    Attributes:
        index: 任务在列表中的索引（0 起）
        success: 是否执行成功
        placeholder_update: 要写回占位符的更新内容
        updated_elements: 占位符更新后的元素快照列表，用于汇总到最终 ToolResult
        error_message: 失败时的错误描述
        metadata: 子类专用扩展数据，基类不解析，由子类在 _build_result_content / _collect_extra_info 中读取
    """

    index: int
    success: bool
    placeholder_update: PlaceholderUpdate
    updated_elements: List[ElementDetail] = field(default_factory=list)
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_success(self) -> bool:
        return self.success

    @property
    def is_failed(self) -> bool:
        return not self.success


class BaseGenerateCanvasElements(BaseDesignTool[TParams], Generic[TParams]):
    """生成并写入画布元素的抽象基类

    子类必须实现：
    - _get_task_placeholder_info(task, idx) → TaskPlaceholderInfo
      只需返回名称和尺寸，占位符构建逻辑全部由 base 封装。
    - _execute_task_item(idx, task, placeholder, tool_context, project_path, **kwargs) → TaskExecutionResult

    子类可选覆盖：
    - _max_elements_per_row: int
      每行最多放几个占位符，超出后自动换行，默认 6。
    - _prepare_task_kwargs(tool_context, project_path) → Dict
      在并发执行前准备额外 kwargs，会透传给每个 _execute_task_item 调用。
    - _build_result_content(project_path, tasks, placeholders, task_results) → str
      生成写入 ToolResult.content 的模型可读文本。
    """

    # 每行最多放几个占位符，子类可覆盖
    _max_elements_per_row: int = 6

    # ------------------------------------------------------------------
    # 抽象接口
    # ------------------------------------------------------------------

    @abstractmethod
    def _get_task_placeholder_info(self, task: Any, idx: int) -> TaskPlaceholderInfo:
        """从任务中提取占位符所需的名称和尺寸。

        只需关注任务本身的数据（名称、宽高），不需要了解画布内部细节。
        占位符的 element_type、status、位置计算全部由 base 完成。

        Args:
            task: 任务描述对象（子类确定类型）
            idx: 任务在列表中的索引

        Returns:
            TaskPlaceholderInfo，只需填写 name / width / height，element_type 可选（默认 "image"）。
        """

    @abstractmethod
    async def _execute_task_item(
        self,
        idx: int,
        task: Any,
        placeholder: ElementDetail,
        tool_context: ToolContext,
        project_path: Path,
        **kwargs: Any,
    ) -> TaskExecutionResult:
        """执行单个任务的核心逻辑。

        Args:
            idx: 任务索引
            task: 任务描述对象
            placeholder: 对应的占位符快照（含 id / name / x / y / width / height）
            tool_context: 工具上下文
            project_path: 设计项目绝对路径
            **kwargs: 由 _prepare_task_kwargs 提供的额外参数

        Returns:
            TaskExecutionResult，其中 placeholder_update 会被写回占位符。
            成功时 status 应为 "completed"；失败时应为 "failed"。
        """

    # ------------------------------------------------------------------
    # 可覆盖钩子
    # ------------------------------------------------------------------

    async def _prepare_task_kwargs(
        self,
        tool_context: ToolContext,
        project_path: Path,
    ) -> Dict[str, Any]:
        """在并发执行前准备额外 kwargs，透传给每个 _execute_task_item 调用。

        默认返回空字典，子类可覆盖以传入模型 ID、时间戳、输出目录等参数。
        """
        return {}

    def _collect_extra_info(
        self,
        tasks: List[Any],
        placeholders: List[ElementDetail],
        task_results: List[TaskExecutionResult],
    ) -> Dict[str, Any]:
        """生成子类专属的额外信息，会被合并到最终 ToolResult.extra_info 中。

        默认返回空字典；子类可覆盖以传出 pending_operations 等特定状态数据。
        返回的 key 若与基类已有 key 重名，子类值优先（基类先写，子类覆盖）。
        """
        return {}

    def _build_result_content(
        self,
        project_path: Path,
        tasks: List[Any],
        placeholders: List[ElementDetail],
        task_results: List[TaskExecutionResult],
    ) -> str:
        """生成给模型读的结果描述。子类可覆盖以定制格式。"""
        total = len(tasks)
        succeeded_count = sum(1 for r in task_results if r.is_success)
        failed_count = total - succeeded_count

        warning_line = (
            f"\n- Warning: {failed_count}/{total} tasks failed"
            if failed_count > 0 else ""
        )

        result = (
            f"Generated and Added to Canvas:\n"
            f"- Success: {succeeded_count} element(s)\n"
            f"- Failed: {failed_count} element(s){warning_line}\n"
            f"- Project: {project_path}"
        )

        success_results = [r for r in task_results if r.is_success]
        if success_results:
            result += "\n\nSucceeded Elements:"
            for r in success_results:
                p = placeholders[r.index]
                pos = f" at ({p.x:.0f}, {p.y:.0f})" if p.x is not None and p.y is not None else ""
                result += f"\n- {p.name} (id: {p.id}){pos}"

        failed_results = [r for r in task_results if r.is_failed]
        if failed_results:
            result += "\n\nFailed Elements (pass element_id to retry in place):"
            for r in failed_results:
                p = placeholders[r.index]
                result += f'\n- {p.name} (element_id: "{p.id}")'

        return result

    # ------------------------------------------------------------------
    # 三阶段主流程
    # ------------------------------------------------------------------

    async def _run_generate_flow(
        self,
        tool_context: ToolContext,
        project_path_str: str,
        tasks: List[Any],
    ) -> ToolResult:
        """三阶段通用流程入口，由子类 execute() 调用。

        接受相对路径字符串（来自工具参数），内部统一转换为 Path 后使用。

        Phase 1: 准备占位符（新建或复用）
        Phase 2: 并发执行任务，每个任务完成后立即更新其占位符
        Phase 3: 汇总结果，构建 ToolResult

        Args:
            tool_context: 工具上下文
            project_path_str: 设计项目相对路径（来自工具参数，仅用于对外 extra_info）
            tasks: 任务列表，元素类型由子类决定
        """
        project_path, error_result = await self._ensure_project_ready(
            project_path_str, require_magic_project_js=True
        )
        if error_result:
            return error_result

        logger.info(f"开始三阶段流程: task_count={len(tasks)}, project={project_path}")

        # Phase 1: 准备占位符
        logger.info("Phase 1: 准备占位符")
        all_placeholders, error_result = await self._prepare_placeholders(
            tasks, tool_context, project_path
        )
        if error_result:
            return error_result

        # Phase 2: 并发执行任务
        logger.info("Phase 2: 并发执行任务并即时更新")
        extra_kwargs = await self._prepare_task_kwargs(tool_context, project_path)

        task_results: List[TaskExecutionResult] = list(await asyncio.gather(*[
            self._execute_and_update_single(
                idx=idx,
                task=task,
                placeholder=all_placeholders[idx],
                tool_context=tool_context,
                project_path=project_path,
                **extra_kwargs,
            )
            for idx, task in enumerate(tasks)
        ]))

        # Phase 3: 汇总结果
        succeeded_count = sum(1 for r in task_results if r.is_success)
        failed_count = sum(1 for r in task_results if r.is_failed)
        elements_detail = [
            dataclasses.asdict(elem)
            for r in task_results
            for elem in r.updated_elements
        ]

        logger.info(f"流程完成: 成功={succeeded_count}, 失败={failed_count}")

        placeholders_as_dicts = [dataclasses.asdict(p) for p in all_placeholders]
        extra_data = self._collect_extra_info(tasks, all_placeholders, task_results)

        if succeeded_count == 0 and all_placeholders:
            failed_desc = "; ".join(
                f"{p.name or p.id} (element_id: \"{p.id}\")"
                for p in all_placeholders
            )
            return ToolResult.error(
                f"Task execution failed: all {len(all_placeholders)} task(s) failed. "
                f"To retry in place, pass element_id for each: {failed_desc}",
                extra_info={
                    "error_type": "design.error_unexpected",
                    "project_path": project_path_str,
                    "total_count": len(all_placeholders),
                    "succeeded_count": 0,
                    "failed_count": failed_count,
                    "created_elements": placeholders_as_dicts,
                    **extra_data,
                },
            )

        result_content = self._build_result_content(
            project_path, tasks, all_placeholders, task_results
        )

        return ToolResult(
            content=result_content,
            data={
                "created_elements": placeholders_as_dicts,
                "succeeded_count": succeeded_count,
                "failed_count": failed_count,
            },
            extra_info={
                "project_path": project_path_str,
                "total_count": len(all_placeholders),
                "succeeded_count": succeeded_count,
                "failed_count": failed_count,
                "created_elements": placeholders_as_dicts,
                "elements": elements_detail,
                **extra_data,
            },
        )

    # ------------------------------------------------------------------
    # Phase 1：占位符准备
    # ------------------------------------------------------------------

    async def _prepare_placeholders(
        self,
        tasks: List[Any],
        tool_context: ToolContext,
        project_path: Path,
    ) -> Tuple[Optional[List[ElementDetail]], Optional[ToolResult]]:
        """Phase 1：新建或复用占位符，返回 (all_placeholders, error_result)。

        - 有 element_id 的任务：复用已有元素，重置 status 为 processing（单次写事务）
        - 无 element_id 的任务：按水平布局新建占位符（单次写事务）

        Returns:
            成功时 (List[ElementDetail], None)；失败时 (None, ToolResult.error)
        """
        new_task_indices = [idx for idx, t in enumerate(tasks) if not getattr(t, "element_id", None)]
        existing_task_indices = [idx for idx, t in enumerate(tasks) if getattr(t, "element_id", None)]

        task_placeholders: Dict[int, ElementDetail] = {}
        manager = CanvasManager(str(project_path))
        config_file = self._get_magic_project_js_path(project_path)

        # 复用已有占位符：一次事务批量重置为 processing
        if existing_task_indices:
            existing_ids = [tasks[idx].element_id for idx in existing_task_indices]

            async def reset_to_processing(config: Any) -> None:
                for element_id in existing_ids:
                    await manager.update_element(element_id, {"status": "processing"}, config=config)

            await manager.run_write_transaction(
                reset_to_processing,
                before_write=lambda: self._dispatch_file_event(
                    tool_context, str(config_file), EventType.BEFORE_FILE_UPDATED
                ),
                after_write=lambda _: self._dispatch_file_event(
                    tool_context, str(config_file), EventType.FILE_UPDATED
                ),
            )

            for idx in existing_task_indices:
                task = tasks[idx]
                task_placeholders[idx] = ElementDetail(
                    id=task.element_id,
                    type="",
                    name=getattr(task, "name", ""),
                    x=None,
                    y=None,
                    width=None,
                    height=None,
                )

            logger.info(f"复用占位符：重置 {len(existing_task_indices)} 个为 processing")

        # 新建占位符：水平排列，一次事务批量创建
        if new_task_indices:
            infos = [self._get_task_placeholder_info(tasks[idx], idx) for idx in new_task_indices]

            async def create_placeholders(config: Any) -> List[ElementDetail]:
                all_elements = flatten_all_elements(config) if (
                    config.canvas and config.canvas.elements
                ) else []

                # 计算起始坐标及初始列偏移
                col_start = 0
                init_row_height = 0.0
                if not all_elements:
                    start_x, start_y = 0.0, 0.0
                elif len(infos) >= 2:
                    # 找最后一行，判断是否还有空位可以继续排
                    max_y = max(
                        e.absolute_y or 0.0
                        for e in all_elements
                        if e.absolute_y is not None
                    )
                    last_row_els = [
                        e for e in all_elements
                        if e.absolute_y is not None
                        and abs((e.absolute_y or 0.0) - max_y) < 1.0
                    ]
                    col_in_last_row = len(last_row_els)
                    if col_in_last_row < self._max_elements_per_row:
                        # 最后一行有剩余空间，从该行右侧继续
                        rightmost = max(last_row_els, key=lambda e: (e.absolute_x or 0.0))
                        start_x = (rightmost.absolute_x or 0.0) + (rightmost.width or 0.0) + DEFAULT_ELEMENT_SPACING
                        start_y = max_y
                        col_start = col_in_last_row
                        init_row_height = max(e.height or 0.0 for e in last_row_els)
                    else:
                        # 最后一行已满，换到新行
                        max_bottom = max(
                            (e.absolute_y or 0.0) + (e.height or 0.0)
                            for e in all_elements
                            if e.absolute_y is not None and e.height is not None
                        )
                        start_x = 0.0
                        start_y = max_bottom + DEFAULT_ELEMENT_SPACING
                else:
                    # 单个占位符：智能寻找不重叠位置
                    start_x, start_y = calculate_next_element_position(
                        config, infos[0].width, infos[0].height
                    )

                # 计算 z_index（与现有最大值 +1）
                z_indices = [e.zIndex for e in all_elements if e.zIndex is not None]
                base_z_index = (max(z_indices) + 1) if z_indices else 1

                created: List[ElementDetail] = []
                x = start_x
                row_y = start_y
                row_height = init_row_height
                col = col_start
                for info in infos:
                    if col >= self._max_elements_per_row:
                        row_y += row_height + DEFAULT_ELEMENT_SPACING
                        x = 0.0  # 新行始终从 x=0 开始
                        row_height = 0.0
                        col = 0
                    element_id = manager.generate_element_id()
                    element = self._make_placeholder_element(element_id, info, x, row_y, base_z_index)
                    await manager.add_element(element, config=config)
                    created.append(ElementDetail(
                        id=element_id,
                        type=info.element_type,
                        name=info.name,
                        x=x,
                        y=row_y,
                        width=info.width,
                        height=info.height,
                    ))
                    x += info.width + DEFAULT_ELEMENT_SPACING
                    row_height = max(row_height, info.height)
                    col += 1

                return created

            created_elements: List[ElementDetail] = await manager.run_write_transaction(
                create_placeholders,
                before_write=lambda: self._dispatch_file_event(
                    tool_context, str(config_file), EventType.BEFORE_FILE_UPDATED
                ),
                after_write=lambda _: self._dispatch_file_event(
                    tool_context, str(config_file), EventType.FILE_UPDATED
                ),
            )

            if len(created_elements) != len(new_task_indices):
                return None, ToolResult.error(
                    "未能创建占位符元素",
                    extra_info={"error_type": "design.error_unexpected"},
                )

            for i, idx in enumerate(new_task_indices):
                task_placeholders[idx] = created_elements[i]

            logger.info(f"新建占位符：{len(new_task_indices)} 个，水平排列")

        if not task_placeholders:
            return None, ToolResult.error(
                "未能准备任何占位符元素",
                extra_info={"error_type": "design.error_unexpected"},
            )

        all_placeholders = [task_placeholders[idx] for idx in range(len(tasks))]
        logger.info(
            f"占位符准备完成：新建 {len(new_task_indices)} 个，复用 {len(existing_task_indices)} 个"
        )
        return all_placeholders, None

    def _make_placeholder_element(
        self,
        element_id: str,
        info: TaskPlaceholderInfo,
        x: float,
        y: float,
        z_index: int,
    ) -> Any:
        """根据 TaskPlaceholderInfo 创建对应类型的占位符元素对象。"""
        common = dict(
            id=element_id,
            name=info.name,
            x=x,
            y=y,
            width=info.width,
            height=info.height,
            zIndex=z_index,
        )
        if info.element_type == "video":
            return VideoElement(**common, type="video", status="processing")
        return ImageElement(**common, type="image", status="processing")

    # ------------------------------------------------------------------
    # Phase 2 辅助
    # ------------------------------------------------------------------

    async def _execute_and_update_single(
        self,
        idx: int,
        task: Any,
        placeholder: ElementDetail,
        tool_context: ToolContext,
        project_path: Path,
        **kwargs: Any,
    ) -> TaskExecutionResult:
        """执行单个任务并立即将结果写入对应占位符。"""
        result = await self._execute_task_item(
            idx, task, placeholder, tool_context, project_path, **kwargs
        )
        updated_elements = await self._update_placeholder(
            result, placeholder, tool_context, project_path
        )
        result.updated_elements = updated_elements
        return result

    async def _update_placeholder(
        self,
        result: TaskExecutionResult,
        placeholder: ElementDetail,
        tool_context: ToolContext,
        project_path: Path,
    ) -> List[ElementDetail]:
        """将 TaskExecutionResult.placeholder_update 写回对应占位符，返回更新后的元素快照。"""
        manager = CanvasManager(str(project_path))
        config_file = self._get_magic_project_js_path(project_path)
        element_id = placeholder.id
        update_dict = result.placeholder_update.to_dict()

        async def do_update(config: Any) -> List[ElementDetail]:
            success = await manager.update_element(element_id, update_dict, config=config)
            if not success:
                logger.warning(f"更新占位符失败 (id={element_id}): 元素未找到")
                return []
            element = await manager.get_element_by_id(element_id, config=config)
            if element is None:
                return []
            return [ElementDetail(
                id=element.id,
                type=getattr(element, "type", ""),
                name=element.name,
                x=element.x,
                y=element.y,
                width=element.width,
                height=element.height,
            )]

        try:
            return await manager.run_write_transaction(
                do_update,
                before_write=lambda: self._dispatch_file_event(
                    tool_context, str(config_file), EventType.BEFORE_FILE_UPDATED
                ),
                after_write=lambda _: self._dispatch_file_event(
                    tool_context, str(config_file), EventType.FILE_UPDATED
                ),
            )
        except Exception as e:
            logger.error(f"更新占位符异常 (id={element_id}): {e}", exc_info=True)
            return []
