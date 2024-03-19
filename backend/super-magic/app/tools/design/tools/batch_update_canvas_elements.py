"""批量更新画布元素工具

此工具用于一次性更新多个画布元素的位置、尺寸、显示属性。
"""

from app.i18n import i18n
import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail, DisplayType, FileContent
from app.tools.core import BaseToolParams, tool
from app.tools.design.manager.canvas_manager import CanvasManager
from app.tools.design.tools.base_design_tool import BaseDesignTool
from app.tools.design.constants import MAX_BATCH_ELEMENTS

logger = get_logger(__name__)


class ElementUpdate(BaseToolParams):
    """<!--zh: 单个元素的更新信息-->
    Single element update information"""

    element_id: str = Field(
        ...,
        description="""<!--zh: 要更新的元素 ID（必需）-->
Element ID to update (required)"""
    )

    # 位置和尺寸（可选）
    x: Optional[float] = Field(
        default=None,
        description="""<!--zh: 新的 X 坐标（可选）。示例：x=200 表示移动到 x=200 的位置-->
New X coordinate (optional). Example: x=200 moves element to x=200"""
    )

    y: Optional[float] = Field(
        default=None,
        description="""<!--zh: 新的 Y 坐标（可选）。示例：y=150 表示移动到 y=150 的位置-->
New Y coordinate (optional). Example: y=150 moves element to y=150"""
    )

    width: Optional[float] = Field(
        default=None,
        ge=0,
        description="""<!--zh: 新的宽度（可选）。示例：width=300 调整为 300 像素宽-->
New width (optional). Example: width=300 resizes to 300 pixels wide"""
    )

    height: Optional[float] = Field(
        default=None,
        ge=0,
        description="""<!--zh: 新的高度（可选）。示例：height=200 调整为 200 像素高-->
New height (optional). Example: height=200 resizes to 200 pixels tall"""
    )

    # 图层和显示（可选）
    zIndex: Optional[int] = Field(
        default=None,
        description="""<!--zh: 图层层级（可选）。数值越大越靠上。示例：zIndex=10 放到第 10 层-->
Layer z-index (optional). Higher value on top. Example: zIndex=10 places at layer 10"""
    )

    visible: Optional[bool] = Field(
        default=None,
        description="""<!--zh: 是否可见（可选）。true=显示，false=隐藏-->
Visible or not (optional). true=show, false=hide"""
    )

    opacity: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="""<!--zh: 透明度（可选），范围 0-1。0=完全透明，1=完全不透明，0.5=半透明-->
Opacity (optional), range 0-1. 0=fully transparent, 1=fully opaque, 0.5=semi-transparent"""
    )

    rotation: Optional[float] = Field(
        default=None,
        description="""<!--zh: 旋转角度（可选），单位为度。示例：rotation=45 旋转 45 度-->
Rotation angle (optional), in degrees. Example: rotation=45 rotates 45 degrees"""
    )

    # 交互控制（可选）
    locked: Optional[bool] = Field(
        default=None,
        description="""<!--zh: 是否锁定（可选）。true=锁定不可编辑，false=可以编辑-->
Locked or not (optional). true=locked/not editable, false=editable"""
    )

    draggable: Optional[bool] = Field(
        default=None,
        description="""<!--zh: 是否可拖拽（可选）。true=可以拖动，false=不能拖动-->
Draggable or not (optional). true=can drag, false=cannot drag"""
    )

    # 元素特定属性（可选）
    properties: Optional[Dict[str, Any]] = Field(
        default=None,
        description="""<!--zh: 元素特定属性（可选）。用于更新元素的特殊属性，如图片的 src、status 等。
示例：properties={"src": "images/new.jpg", "status": "completed"}-->
Element-specific properties (optional). Used to update special properties like image src, status, etc.
Example: properties={"src": "images/new.jpg", "status": "completed"}"""
    )


class BatchUpdateCanvasElementsParams(BaseToolParams):
    """批量更新画布元素参数"""

    project_path: str = Field(
        ...,
        description="""<!--zh: 设计项目的相对路径（包含 magic.project.js 的文件夹）-->
Relative path to the design project (folder containing magic.project.js)"""
    )

    updates: List[ElementUpdate] = Field(
        ...,
        description=f"""<!--zh: 要更新的元素列表（1-{MAX_BATCH_ELEMENTS} 个）。每个元素至少要指定一个属性。
示例：[
  {{"element_id": "img-001", "x": 200, "y": 100}},
  {{"element_id": "img-002", "opacity": 0.5, "visible": false}}
]-->
List of element updates (1-{MAX_BATCH_ELEMENTS} elements). Each element must specify at least one property.
Example: [
  {{"element_id": "img-001", "x": 200, "y": 100}},
  {{"element_id": "img-002", "opacity": 0.5, "visible": false}}
]""",
        min_length=1,
        max_length=MAX_BATCH_ELEMENTS
    )

    @field_validator("updates")
    @classmethod
    def validate_updates(cls, v: List[ElementUpdate]) -> List[ElementUpdate]:
        """验证每个更新至少包含一个属性"""
        for i, update in enumerate(v):
            # 检查是否至少提供了一个更新属性
            has_update = any([
                update.x is not None,
                update.y is not None,
                update.width is not None,
                update.height is not None,
                update.zIndex is not None,
                update.visible is not None,
                update.opacity is not None,
                update.rotation is not None,
                update.locked is not None,
                update.draggable is not None,
                update.properties is not None,
            ])
            if not has_update:
                raise ValueError(
                    f"Update at index {i} (element_id: {update.element_id}) "
                    f"must provide at least one property to update"
                )
        return v


@tool()
class BatchUpdateCanvasElements(BaseDesignTool[BatchUpdateCanvasElementsParams]):
    """<!--zh
    批量更新画布元素工具

    【主要用途】一次性调整多个元素的位置、尺寸、显示效果。

    【典型场景】
    ✓ 布局调整：把 10 个图标向右移动 50px
    ✓ 对齐元素：让 5 个按钮的 y 坐标都设为 200
    ✓ 统一样式：把一组元素都设为 50% 透明度
    ✓ 批量控制：同时锁定/解锁多个背景元素
    ✓ 显示控制：批量显示/隐藏一组元素

    【支持的属性】
    位置：x, y
    尺寸：width, height
    显示：visible（可见性）, opacity（透明度）, rotation（旋转角度）
    层级：zIndex（图层层级）
    交互：locked（锁定）, draggable（可拖拽）

    【不支持的操作】
    ✗ 修改元素名称、类型
    ✗ 修改颜色、文本内容等复杂属性
    → 这些请使用 update_canvas_element 工具

    【容错机制】
    即使某些元素更新失败,其他元素仍会继续处理。
    最终返回成功和失败的详细信息。

    【限制】
    - 单次最多 20 个元素
    - 每个元素至少要更新一个属性
    -->
    Batch update canvas elements tool

    【Main Purpose】Update multiple elements' position, size, and display properties at once.

    【Typical Scenarios】
    ✓ Layout adjustment: Move 10 icons 50px to the right
    ✓ Align elements: Set y coordinate of 5 buttons to 200
    ✓ Unify style: Set a group of elements to 50% opacity
    ✓ Batch control: Lock/unlock multiple background elements simultaneously
    ✓ Display control: Batch show/hide a group of elements

    【Supported Properties】
    Position: x, y
    Size: width, height
    Display: visible (visibility), opacity (transparency), rotation (rotation angle)
    Layer: zIndex (layer level)
    Interaction: locked (lock status), draggable (draggable)

    【Unsupported Operations】
    ✗ Modify element name, type
    ✗ Modify colors, text content and other complex properties
    → Use update_canvas_element tool for these

    【Error Tolerance】
    Even if some element updates fail, other elements will continue processing.
    Returns detailed success and failure information.

    【Limits】
    - Max 20 elements per operation
    - Each element must update at least one property
    """

    async def execute(
        self, tool_context: ToolContext, params: BatchUpdateCanvasElementsParams
    ) -> ToolResult:
        """执行批量更新元素操作

        Args:
            tool_context: 工具上下文
            params: 批量更新参数

        Returns:
            ToolResult: 批量更新结果，包含成功和失败的详细信息
        """
        try:
            # 1. 验证项目路径
            project_path, error_result = await self._ensure_project_ready(
                params.project_path,
                require_magic_project_js=True
            )
            if error_result:
                return error_result

            # 2. 获取项目管理器
            manager = CanvasManager(str(project_path))

            # 3. 批量更新（只加载和保存一次文件）
            async with manager.with_lock():
                await manager.load()

                results = []
                updated_ids = []

                # 4. 逐个更新元素
                for update in params.updates:
                    try:
                        # 4.1 检查元素是否存在
                        element = await manager.get_element_by_id(update.element_id)
                        if element is None:
                            raise ValueError(f"Element not found: {update.element_id}")

                        # 4.2 构建更新字典
                        updates_dict = self._build_updates_dict(update)
                        if not updates_dict:
                            raise ValueError("No valid updates provided")

                        # 4.3 应用更新
                        success = await manager.update_element(
                            update.element_id, updates_dict
                        )
                        if not success:
                            raise ValueError("Update failed")

                        # 4.4 记录成功
                        results.append({
                            "success": True,
                            "element_id": update.element_id,
                            "element_name": element.name,
                            "element_type": element.type,
                            "updated_fields": list(updates_dict.keys())
                        })
                        updated_ids.append(update.element_id)

                    except Exception as e:
                        logger.error(f"Failed to update element {update.element_id}: {e}")
                        results.append({
                            "success": False,
                            "element_id": update.element_id,
                            "error": str(e)
                        })

                # 5. 在保存前，对更新了 src 的图片元素执行视觉理解
                await self._perform_visual_understanding_for_updated_images(
                    manager=manager,
                    project_path=project_path,
                    results=results,
                    updates=params.updates
                )

                # 6. 保存配置（一次性保存，包含视觉理解结果）并触发文件更新事件
                config_file = self._get_magic_project_js_path(project_path)

                # 触发文件更新前事件（保存旧内容用于checkpoint回滚）
                await self._dispatch_file_event(tool_context, str(config_file), EventType.BEFORE_FILE_UPDATED)

                # 安全地保存更改（包含批量更新 + 视觉理解结果）
                save_error = await self._safe_save_canvas(manager, "batch update elements with visual understanding")
                if save_error:
                    return save_error

                # 触发文件更新后事件（通知其他系统）
                await self._dispatch_file_event(tool_context, str(config_file), EventType.FILE_UPDATED)

            # 7. 格式化输出结果
            return await self._format_batch_result(results, project_path, params, manager)

        except Exception as e:
            logger.error(f"Batch update failed: {e}")
            return ToolResult.error(
                f"Batch update failed: {str(e)}",
                extra_info={"error_type": "design.error_unexpected"}
            )

    def _build_updates_dict(self, update: ElementUpdate) -> Dict[str, Any]:
        """构建更新字典，只包含非 None 的属性

        Args:
            update: 元素更新信息

        Returns:
            更新字典
        """
        updates_dict = {}

        # 位置和尺寸
        if update.x is not None:
            updates_dict["x"] = update.x
        if update.y is not None:
            updates_dict["y"] = update.y
        if update.width is not None:
            updates_dict["width"] = update.width
        if update.height is not None:
            updates_dict["height"] = update.height

        # 图层和显示
        if update.zIndex is not None:
            updates_dict["zIndex"] = update.zIndex
        if update.visible is not None:
            updates_dict["visible"] = update.visible
        if update.opacity is not None:
            updates_dict["opacity"] = update.opacity
        if update.rotation is not None:
            updates_dict["rotation"] = update.rotation

        # 交互控制
        if update.locked is not None:
            updates_dict["locked"] = update.locked
        if update.draggable is not None:
            updates_dict["draggable"] = update.draggable

        # 元素特定属性
        if update.properties is not None:
            # 将 properties 中的所有键值对合并到 updates_dict
            updates_dict.update(update.properties)

        return updates_dict

    async def _perform_visual_understanding_for_updated_images(
        self,
        manager: CanvasManager,
        project_path: Path,
        results: List[Dict[str, Any]],
        updates: List[ElementUpdate]
    ) -> None:
        """对更新了 src 的图片元素自动执行视觉理解

        Args:
            manager: 画布管理器
            project_path: 项目路径
            results: 更新结果列表
            updates: 更新参数列表
        """
        # 1. 收集所有更新了 src 的图片元素
        elements_to_analyze = []

        for result, update in zip(results, updates):
            # 只处理成功更新的元素
            if not result.get("success"):
                continue

            # 检查是否更新了 src
            src_updated = False
            if update.properties and "src" in update.properties:
                src_updated = True

            if not src_updated:
                continue

            # 获取元素
            element = await manager.get_element_by_id(update.element_id)
            if element is None:
                logger.warning(f"无法找到元素 {update.element_id}，跳过视觉理解")
                continue

            # 只处理图片元素
            if element.type != "image":
                continue

            elements_to_analyze.append((update.element_id, element))

        if not elements_to_analyze:
            logger.info("没有需要执行视觉理解的图片元素")
            return

        logger.info(f"开始对 {len(elements_to_analyze)} 个更新了 src 的图片元素执行视觉理解（并发）")

        # 2. 创建并发任务
        async def analyze_single(element_id: str, element) -> tuple[str, bool, Optional[str]]:
            """分析单个元素的异步函数"""
            try:
                await self._perform_visual_understanding(element, project_path)
                logger.info(f"元素 {element_id} 视觉理解完成")
                return element_id, True, None
            except Exception as e:
                logger.warning(f"元素 {element_id} 视觉理解失败: {e}")
                return element_id, False, str(e)

        # 3. 并发执行所有视觉理解任务
        tasks = [analyze_single(element_id, element) for element_id, element in elements_to_analyze]
        results = await asyncio.gather(*tasks, return_exceptions=False)

        # 4. 统计结果
        succeeded = sum(1 for _, success, _ in results if success)
        failed = len(results) - succeeded
        logger.info(f"视觉理解完成，共 {len(elements_to_analyze)} 个元素（成功: {succeeded}, 失败: {failed}）")
        # 注意：不在此处保存，由调用方统一保存（包含批量更新 + 视觉理解结果）

    async def _format_batch_result(
        self, results: List[Dict[str, Any]], project_path: Path, params: BatchUpdateCanvasElementsParams, manager: CanvasManager
    ) -> ToolResult:
        """格式化批量更新结果

        Args:
            results: 更新结果列表
            project_path: 项目路径
            params: 批量更新参数
            manager: 画布管理器

        Returns:
            格式化的 ToolResult
        """
        total_count = len(results)
        succeeded = [r for r in results if r.get("success")]
        failed = [r for r in results if not r.get("success")]
        succeeded_count = len(succeeded)
        failed_count = len(failed)

        # 构建输出内容
        content_lines = [
            "Batch Update Summary:",
            f"- Total: {total_count} elements",
            f"- Succeeded: {succeeded_count} elements",
            f"- Failed: {failed_count} elements",
            ""
        ]

        # 显示成功的更新
        if succeeded:
            content_lines.append("Updated Elements:")
            for i, result in enumerate(succeeded, 1):
                element_id = result["element_id"]
                element_name = result.get("element_name", "")
                element_type = result.get("element_type", "")
                updated_fields = ", ".join(result.get("updated_fields", []))

                name_display = f'"{element_name}"' if element_name else ""
                type_display = f"[{element_type}]" if element_type else ""

                content_lines.append(
                    f"  {i}. {element_id} {type_display} {name_display} - Updated: {updated_fields}"
                )
            content_lines.append("")

        # 显示失败的更新
        if failed:
            content_lines.append("Failed Updates:")
            for i, result in enumerate(failed, 1):
                element_id = result["element_id"]
                error = result.get("error", "Unknown error")
                content_lines.append(f"  {i}. {element_id} - Error: {error}")
            content_lines.append("")

        content_lines.append(f"Changes saved to: {project_path}/magic.project.js")

        # 获取成功更新的元素 ID 列表
        updated_element_ids = [r["element_id"] for r in succeeded]

        # 构建完整的元素详情（用于前端展示）
        elements_detail = await self._build_elements_detail_from_ids(
            project_path,
            updated_element_ids,
            manager
        )

        # 构建 extra_info
        extra_info = {
            "project_path": params.project_path,
            "total_count": total_count,
            "succeeded_count": succeeded_count,
            "failed_count": failed_count,
            "updated_element_ids": updated_element_ids,
            "elements": elements_detail,  # 完整的元素详情
            "errors": [
                {"element_id": r["element_id"], "error": r["error"]}
                for r in failed
            ]
        }

        return ToolResult(
            content="\n".join(content_lines),
            ok=True,  # 部分成功策略：即使有失败也返回 True
            extra_info=extra_info
        )

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not result.ok:
            return i18n.translate("update_canvas_element.exception", category="tool.messages")

        if not arguments or "updates" not in arguments:
            return i18n.translate("update_canvas_element.exception", category="tool.messages")

        updates = arguments["updates"]
        total_count = len(updates) if isinstance(updates, list) else 0

        return i18n.translate("batch_update_canvas_elements.success", category="tool.messages", count=total_count)

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
            default_action_code="batch_update_canvas_elements",
            default_success_message_code="batch_update_canvas_elements.success"
        ) if not result.ok else {
            "action": i18n.translate("batch_update_canvas_elements", category="tool.actions"),
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
