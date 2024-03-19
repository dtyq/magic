"""调整画布元素图层顺序工具

此工具用于调整设计项目画布上元素的图层顺序（z-index）。
"""

from app.i18n import i18n
from typing import Any, Dict, Optional

from pydantic import Field, field_validator, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail, DisplayType, FileContent
from app.tools.core import BaseToolParams, tool
from app.tools.design.manager.canvas_manager import CanvasManager
from app.tools.design.tools.base_design_tool import BaseDesignTool

logger = get_logger(__name__)

# Allowed reorder actions
ALLOWED_ACTIONS = {
    "bring_to_front",
    "bring_forward",
    "send_backward",
    "send_to_back",
    "set_zindex"
}


class ReorderCanvasElementsParams(BaseToolParams):
    project_path: str = Field(
        ...,
        description="""<!--zh: 设计项目的相对路径（包含 magic.project.js 的文件夹，即画布项目标识）-->
Relative path to the design project (folder containing magic.project.js, the canvas project identifier)"""
    )

    element_id: str = Field(
        ...,
        description="""<!--zh: 要调整图层的元素 ID-->
Element ID to reorder"""
    )

    action: str = Field(
        ...,
        description="""<!--zh: 图层调整操作类型：
        - "bring_to_front"：置于顶层（最大 z-index + 1）
        - "bring_forward"：上移一层（z-index + 1）
        - "send_backward"：下移一层（z-index - 1，最小为 0）
        - "send_to_back"：置于底层（z-index = 0）
        - "set_zindex"：设置指定 z-index（需要提供 z_index 参数）
        -->
Layer reorder action type:
        - "bring_to_front": Bring to front (max z-index + 1)
        - "bring_forward": Bring forward one layer (z-index + 1)
        - "send_backward": Send backward one layer (z-index - 1, min 0)
        - "send_to_back": Send to back (z-index = 0)
        - "set_zindex": Set specific z-index (requires z_index parameter)
        """
    )

    z_index: Optional[int] = Field(
        default=None,
        description="""<!--zh: 指定的 z-index 值（仅当 action="set_zindex" 时需要）-->
Specific z-index value (required only when action="set_zindex")"""
    )

    @field_validator('element_id')
    @classmethod
    def validate_element_id(cls, v: str) -> str:
        """Validate element_id is not empty"""
        if not v.strip():
            raise ValueError("Element ID cannot be empty")
        return v

    @field_validator('action')
    @classmethod
    def validate_action(cls, v: str) -> str:
        """Validate action is allowed"""
        if v not in ALLOWED_ACTIONS:
            raise ValueError(
                f"Invalid action '{v}'. Allowed actions: {', '.join(sorted(ALLOWED_ACTIONS))}"
            )
        return v

    @field_validator('z_index')
    @classmethod
    def validate_z_index_range(cls, v: Optional[int]) -> Optional[int]:
        """Validate z_index is non-negative"""
        if v is not None and v < 0:
            raise ValueError(f"z_index must be non-negative, got {v}")
        return v

    @model_validator(mode='after')
    def validate_set_zindex_requires_parameter(self):
        """Validate z_index is provided when action is set_zindex"""
        if self.action == 'set_zindex' and self.z_index is None:
            raise ValueError("z_index is required when action is 'set_zindex'")
        return self


@tool()
class ReorderCanvasElements(BaseDesignTool[ReorderCanvasElementsParams]):
    """<!--zh
    调整画布元素图层顺序工具

    此工具用于调整设计项目画布上元素的图层顺序（z-index）。z-index 决定了元素的叠放顺序，数值越大越靠上。

    支持的操作：
    - bring_to_front：置于顶层 - 将元素置于所有其他元素之上
    - bring_forward：上移一层 - 将元素的 z-index 增加 1
    - send_backward：下移一层 - 将元素的 z-index 减少 1（最小为 0）
    - send_to_back：置于底层 - 将元素的 z-index 设置为 0
    - set_zindex：设置指定 z-index - 直接设置元素的 z-index 为指定值

    使用场景：
    - 调整元素的显示层级，控制遮挡关系
    - 快速将元素置于顶层或底层
    - 微调元素的相对位置

    注意事项：
    - 多个元素可以有相同的 z-index（渲染顺序由元素在数组中的位置决定）
    - 调整一个元素的 z-index 不会自动调整其他元素
    - z-index 可以有间隙（如 0, 1, 5, 10），不需要连续
    - 锁定的元素也可以调整图层（工具层不阻止）
    -->
    Reorder canvas elements layer tool

    This tool adjusts the layer order (z-index) of elements on the design project canvas. z-index determines the stacking order of elements, with higher values appearing on top.

    Supported operations:
    - bring_to_front: Bring to front - Place element above all other elements
    - bring_forward: Bring forward - Increase element's z-index by 1
    - send_backward: Send backward - Decrease element's z-index by 1 (minimum 0)
    - send_to_back: Send to back - Set element's z-index to 0
    - set_zindex: Set specific z-index - Directly set element's z-index to specified value

    Use cases:
    - Adjust element display hierarchy to control overlap relationships
    - Quickly bring element to front or back
    - Fine-tune element relative positions

    Notes:
    - Multiple elements can have the same z-index (render order determined by position in array)
    - Adjusting one element's z-index won't automatically adjust others
    - z-index can have gaps (e.g., 0, 1, 5, 10), doesn't need to be continuous
    - Locked elements can also be reordered (tool layer doesn't prevent)
    """

    async def execute(self, tool_context: ToolContext, params: ReorderCanvasElementsParams) -> ToolResult:
        """Execute canvas element reorder operation

        Args:
            tool_context: Tool context
            params: Parameter object containing reorder information

        Returns:
            ToolResult: Contains reorder result details
        """
        try:
            # Use base class method to ensure project is ready
            project_path, error_result = await self._ensure_project_ready(
                params.project_path,
                require_magic_project_js=True
            )
            if error_result:
                return error_result

            # Initialize CanvasManager
            manager = CanvasManager(str(project_path))

            # Use canvas lock to protect the entire operation (prevent concurrent modifications)
            async with manager.with_lock():
                await manager.load()

                # Check if element exists
                element = await manager.get_element_by_id(params.element_id)
                if element is None:
                    return self._error_element_not_found(params.element_id)

                # Get current z-index
                old_z_index = element.zIndex if element.zIndex is not None else 0

                # Calculate new z-index based on action
                new_z_index = await self._calculate_new_z_index(
                    manager,
                    params.element_id,
                    params.action,
                    old_z_index,
                    params.z_index
                )

                # Update element's z-index
                success = await manager.change_z_index(params.element_id, new_z_index)

                if not success:
                    return self._error_element_not_found(params.element_id)

                # 获取配置文件路径
                config_file = self._get_magic_project_js_path(project_path)

                # 触发文件更新前事件（保存旧内容用于checkpoint回滚）
                await self._dispatch_file_event(tool_context, str(config_file), EventType.BEFORE_FILE_UPDATED)

                # 安全地保存更改
                save_error = await self._safe_save_canvas(manager, "reorder element")
                if save_error:
                    return save_error

                # 触发文件更新后事件（通知其他系统）
                await self._dispatch_file_event(tool_context, str(config_file), EventType.FILE_UPDATED)

                # Reload to get updated element
                await manager.reload()
                updated_element = await manager.get_element_by_id(params.element_id)

            # Generate result content
            result_content = self._generate_result_content(
                params,
                element,
                updated_element,
                old_z_index,
                new_z_index
            )

            # 构建完整的元素详情（用于前端展示）
            elements_detail = await self._build_elements_detail_from_ids(
                project_path,
                [params.element_id],
                manager
            )

            # 将元素信息放入 extra_info
            return ToolResult(
                content=result_content,
                extra_info={
                    "project_path": params.project_path,
                    "element_name": updated_element.name,
                    "element_id": params.element_id,
                    "elements": elements_detail
                }
            )

        except Exception as e:
            logger.exception(f"Failed to reorder canvas element: {e!s}")
            return ToolResult.error(
                f"Failed to reorder canvas element: {e!s}",
                extra_info={"error_type": "design.error_unexpected"}
            )

    async def _calculate_new_z_index(
        self,
        manager: CanvasManager,
        element_id: str,
        action: str,
        current_z_index: int,
        specified_z_index: Optional[int]
    ) -> int:
        """Calculate new z-index based on action

        Args:
            manager: Canvas manager
            element_id: Element ID
            action: Reorder action
            current_z_index: Current z-index
            specified_z_index: Specified z-index (for set_zindex action)

        Returns:
            New z-index value
        """
        if action == "bring_to_front":
            # Get max z-index from all elements
            stats = await manager.get_statistics()
            if stats.z_index_range == (0, 0):
                # Only one element or all elements have z-index 0
                return 1
            max_z_index = stats.z_index_range[1]
            return max_z_index + 1

        elif action == "bring_forward":
            # Move up one layer
            return current_z_index + 1

        elif action == "send_backward":
            # Move down one layer (minimum 0)
            return max(0, current_z_index - 1)

        elif action == "send_to_back":
            # Set to bottom layer
            return 0

        elif action == "set_zindex":
            # Set to specified value
            if specified_z_index is None:
                raise ValueError("z_index parameter is required for set_zindex action")
            return specified_z_index

        else:
            raise ValueError(f"Unknown action: {action}")

    # noinspection PyMethodMayBeStatic
    def _generate_result_content(
        self,
        params: ReorderCanvasElementsParams,
        original_element: Any,
        updated_element: Any,
        old_z_index: int,
        new_z_index: int
    ) -> str:
        """Generate structured result content

        Args:
            params: Tool parameters
            original_element: Original element before reorder
            updated_element: Updated element after reorder
            old_z_index: Old z-index value
            new_z_index: New z-index value

        Returns:
            Formatted result content
        """
        # Action descriptions
        action_descriptions = {
            "bring_to_front": "Brought to front",
            "bring_forward": "Brought forward one layer",
            "send_backward": "Sent backward one layer",
            "send_to_back": "Sent to back",
            "set_zindex": f"Set z-index to {new_z_index}"
        }

        action_desc = action_descriptions.get(params.action, params.action)

        result = f"""Element Details:
- ID: {params.element_id}
- Name: {updated_element.name}
- Type: {updated_element.type}

Layer Change:
- Action: {action_desc}
- Old z-index: {old_z_index}
- New z-index: {new_z_index}"""

        if old_z_index == new_z_index:
            result += "\n\n⚠️ Note: z-index unchanged (already at target position)"

        result += f"\n\nChanges saved to: {params.project_path}/magic.project.js"

        return result

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """Get remark content"""
        if not result.ok:
            return i18n.translate("reorder_canvas_elements.exception", category="tool.messages")

        if not arguments or "element_id" not in arguments:
            return i18n.translate("reorder_canvas_elements.success", category="tool.messages")

        element_id = arguments["element_id"]
        action = arguments.get("action", "reordered")

        # 优先使用元素名称，如果没有则使用元素ID
        element_display = element_id
        if result.extra_info and "element_name" in result.extra_info:
            element_name = result.extra_info["element_name"]
            if element_name and element_name.strip():
                element_display = element_name

        return i18n.translate("reorder_canvas_elements.success", category="tool.messages", element_display=element_display,
            action=action)

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult,
        execution_time: float, arguments: Dict[str, Any] = None
    ) -> Dict:
        """Get friendly action and remark after tool call

        Args:
            tool_name: Tool name
            tool_context: Tool context
            result: Tool execution result
            execution_time: Execution time
            arguments: Execution arguments

        Returns:
            Dict: Contains action and remark
        """
        # 使用基类的通用错误处理方法
        return self._handle_design_tool_error(
            result,
            default_action_code="reorder_canvas_elements",
            default_success_message_code="reorder_canvas_elements.success"
        ) if not result.ok else {
            "action": i18n.translate("reorder_canvas_elements", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
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
