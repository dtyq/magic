"""删除画布元素工具

此工具用于从设计项目的画布上删除一个或多个元素。
"""

from app.i18n import i18n
from typing import Any, Dict, List, Union, Optional

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail, DisplayType, FileContent
from app.tools.core import BaseToolParams, tool
from app.tools.design.manager.canvas_manager import CanvasManager
from app.tools.design.tools.base_design_tool import BaseDesignTool
from app.tools.design.utils.magic_project_design_parser import flatten_all_elements

logger = get_logger(__name__)


class DeleteCanvasElementParams(BaseToolParams):
    project_path: str = Field(
        ...,
        description="""<!--zh: 设计项目的相对路径（包含 magic.project.js 的文件夹，即画布项目标识）-->
Relative path to the design project (folder containing magic.project.js, the canvas project identifier)"""
    )

    element_ids: Union[str, List[str]] = Field(
        ...,
        description="""<!--zh: 要删除的元素 ID（字符串）或 ID 列表（支持批量删除）-->
Element ID(s) to delete (string or list of strings, supports batch deletion)"""
    )

    @field_validator('element_ids')
    @classmethod
    def validate_element_ids(cls, v: Union[str, List[str]]) -> Union[str, List[str]]:
        """Validate element_ids is not empty"""
        if isinstance(v, str):
            if not v.strip():
                raise ValueError("Element ID cannot be empty")
        elif isinstance(v, list):
            if not v:
                raise ValueError("Element IDs list cannot be empty")
            if any(not isinstance(id_, str) or not id_.strip() for id_ in v):
                raise ValueError("All element IDs must be non-empty strings")
        else:
            raise ValueError("Element IDs must be a string or list of strings")
        return v


@tool()
class DeleteCanvasElement(BaseDesignTool[DeleteCanvasElementParams]):
    """<!--zh
    删除画布元素工具

    此工具用于从设计项目的画布上删除一个或多个元素。

    支持的操作：
    - 单个删除：传入单个元素 ID
    - 批量删除：传入元素 ID 列表，一次性删除多个元素

    删除特性：
    - 幂等性：多次删除同一个元素不会报错
    - 容错性：如果某些 ID 不存在，不影响其他 ID 的删除
    - 详细统计：返回删除成功和失败的详细信息

    注意事项：
    - 删除操作不可恢复（除非有备份）
    - 删除 group 或 frame 元素不会自动删除其子元素
    - 删除锁定的元素不会被阻止（工具层权限高于 UI 层）
    - 删除元素后，其他元素的 z-index 不会自动调整

    返回信息包括：
    - 删除成功的元素数量和 ID 列表
    - 未找到的元素数量和 ID 列表
    - 被删除元素的名称和类型
    -->
    Delete canvas element tool

    This tool deletes one or more elements from the design project canvas.

    Supported operations:
    - Single deletion: Pass a single element ID
    - Batch deletion: Pass a list of element IDs to delete multiple elements at once

    Deletion features:
    - Idempotent: Deleting the same element multiple times won't cause errors
    - Fault-tolerant: If some IDs don't exist, it won't affect deletion of other IDs
    - Detailed statistics: Returns detailed info on successful and failed deletions

    Notes:
    - Deletion is irreversible (unless there's a backup)
    - Deleting group or frame elements won't automatically delete their children
    - Deleting locked elements is not blocked (tool layer has higher privileges than UI layer)
    - After deletion, z-index of other elements won't be automatically adjusted

    Return information includes:
    - Count and ID list of successfully deleted elements
    - Count and ID list of elements not found
    - Names and types of deleted elements
    """

    async def execute(self, tool_context: ToolContext, params: DeleteCanvasElementParams) -> ToolResult:
        """Execute canvas element deletion operation

        Args:
            tool_context: Tool context
            params: Parameter object containing deletion information

        Returns:
            ToolResult: Contains deletion result details
        """
        try:
            # Use base class method to ensure project is ready
            project_path, error_result = await self._ensure_project_ready(
                params.project_path,
                require_magic_project_js=True
            )
            if error_result:
                return error_result

            # Normalize element_ids to list
            element_ids_list = self._normalize_element_ids(params.element_ids)

            # Remove duplicates while preserving order
            element_ids_list = list(dict.fromkeys(element_ids_list))

            # Initialize CanvasManager
            manager = CanvasManager(str(project_path))

            current_config = await manager.read_current_canvas()

            # Find which elements exist and collect their info before deletion
            found_elements = []
            not_found_ids = []

            for element_id in element_ids_list:
                element = await manager.get_element_by_id(element_id, config=current_config)
                if element:
                    found_elements.append(element)
                else:
                    not_found_ids.append(element_id)

            if found_elements:
                found_ids = [element.id for element in found_elements]
                config_file = self._get_magic_project_js_path(project_path)

                deleted_count = await manager.run_write_transaction(
                    lambda config: manager.delete_elements(found_ids, config=config),
                    verify_content=lambda verified_config, _: all(
                        candidate.id not in set(found_ids)
                        for candidate in flatten_all_elements(verified_config)
                    ),
                    before_write=lambda: self._dispatch_file_event(
                        tool_context,
                        str(config_file),
                        EventType.BEFORE_FILE_UPDATED,
                    ),
                    after_write=lambda _: self._dispatch_file_event(
                        tool_context,
                        str(config_file),
                        EventType.FILE_UPDATED,
                    ),
                )
            else:
                deleted_count = 0

            # Generate result content
            result_content = self._generate_result_content(
                params,
                element_ids_list,
                found_elements,
                not_found_ids,
                deleted_count
            )

            # 构建被删除元素的详情（在删除前已经收集，只保留基本字段）
            deleted_elements_detail = []
            for element in found_elements:
                # 只提取基本字段
                if isinstance(element, dict):
                    detail = {
                        "id": element.get("id", ""),
                        "type": element.get("type", ""),
                        "name": element.get("name", ""),
                        "x": element.get("x", 0),
                        "y": element.get("y", 0),
                        "width": element.get("width", 0),
                        "height": element.get("height", 0)
                    }
                else:
                    # 对象属性访问
                    detail = {
                        "id": getattr(element, "id", ""),
                        "type": getattr(element, "type", ""),
                        "name": getattr(element, "name", ""),
                        "x": getattr(element, "x", 0),
                        "y": getattr(element, "y", 0),
                        "width": getattr(element, "width", 0),
                        "height": getattr(element, "height", 0)
                    }
                deleted_elements_detail.append(detail)

            return ToolResult(
                content=result_content,
                extra_info={
                    "project_path": params.project_path,
                    "elements": deleted_elements_detail  # 被删除的元素详情（仅基本字段）
                }
            )

        except Exception as e:
            logger.exception(f"Failed to delete canvas element(s): {e!s}")
            return ToolResult.error(
                f"Failed to delete canvas element(s): {e!s}",
                extra_info={"error_type": "design.error_unexpected"}
            )

    # noinspection PyMethodMayBeStatic
    def _normalize_element_ids(self, element_ids: Union[str, List[str]]) -> List[str]:
        """Normalize element_ids to list format

        Args:
            element_ids: Single ID or list of IDs

        Returns:
            List of element IDs
        """
        if isinstance(element_ids, str):
            return [element_ids]
        return element_ids

    # noinspection PyMethodMayBeStatic
    def _generate_result_content(
        self,
        params: DeleteCanvasElementParams,
        requested_ids: List[str],
        deleted_elements: List[Any],
        not_found_ids: List[str],
        deleted_count: int
    ) -> str:
        """Generate structured result content

        Args:
            params: Tool parameters
            requested_ids: List of requested element IDs
            deleted_elements: List of deleted element objects
            not_found_ids: List of IDs that were not found
            deleted_count: Number of elements actually deleted

        Returns:
            Formatted result content
        """
        result = "Deletion Summary:"
        result += f"\n- Total Requested: {len(requested_ids)}"
        result += f"\n- Successfully Deleted: {deleted_count}"
        result += f"\n- Not Found: {len(not_found_ids)}"

        # List deleted elements with details
        if deleted_elements:
            result += "\n\nDeleted Elements:"
            for element in deleted_elements:
                element_info = f"\n- {element.id}"
                if hasattr(element, 'type') and element.type:
                    element_info += f" ({element.type}"
                    if hasattr(element, 'name') and element.name:
                        element_info += f' "{element.name}"'
                    element_info += ")"
                elif hasattr(element, 'name') and element.name:
                    element_info += f' ("{element.name}")'
                result += element_info

        # List not found elements
        if not_found_ids:
            result += "\n\nNot Found Elements:"
            for element_id in not_found_ids:
                result += f"\n- {element_id}"

        result += f"\n\nChanges saved to: {params.project_path}/magic.project.js"

        return result

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """Get remark content"""
        if not result.ok:
            return i18n.translate("delete_canvas_element.exception", category="tool.messages")

        # Try to extract deletion stats from result content
        # For simplicity, we'll use a generic success message
        # If we need detailed stats, we'd need to pass them through the result
        return i18n.translate("delete_canvas_element.success", category="tool.messages")

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
            default_action_code="delete_canvas_element",
            default_success_message_code="delete_canvas_element.success"
        ) if not result.ok else {
            "action": i18n.translate("delete_canvas_element", category="tool.actions"),
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
