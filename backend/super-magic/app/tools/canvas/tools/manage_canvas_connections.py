"""Canvas Connection 工具。"""

from typing import Any

from pydantic import ConfigDict, Field, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.tools.canvas.application.commands import ConnectionCommand
from app.tools.canvas.presentation import (
    CanvasToolDetailBuilder,
    batch_tool_result,
    canvas_remark,
    error_result,
    items_content,
)
from app.tools.canvas.tools.support import _application
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool


class ConnectionInput(BaseToolParams):
    """单个 Connection 新增、移除或替换参数。"""

    model_config = ConfigDict(extra="forbid")

    item_ref: str = Field(..., min_length=1)
    source_element_id: str | None = None
    target_element_id: str | None = None
    replace_existing_connections: bool = False
    remove_connection_ids: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_operation(self) -> "ConnectionInput":
        """保证每个 item 只表达一个明确 Connection 操作。"""
        has_endpoints = self.source_element_id is not None or self.target_element_id is not None
        if has_endpoints and (not self.source_element_id or not self.target_element_id):
            raise ValueError("source_element_id and target_element_id must be provided together")
        if self.replace_existing_connections and (not has_endpoints or not self.remove_connection_ids):
            raise ValueError("replacement requires endpoints and remove_connection_ids")
        if self.remove_connection_ids and has_endpoints and not self.replace_existing_connections:
            raise ValueError("set replace_existing_connections=true when replacing an existing Connection")
        if not has_endpoints and not self.remove_connection_ids:
            raise ValueError("connection item must add, remove, or replace a Connection")
        return self

    def to_command(self) -> ConnectionCommand:
        """转换为应用层 Connection 命令。"""
        return ConnectionCommand(
            item_ref=self.item_ref,
            source_element_id=self.source_element_id,
            target_element_id=self.target_element_id,
            replace_existing_connections=self.replace_existing_connections,
            remove_connection_ids=tuple(self.remove_connection_ids),
        )


@tool(name="manage_canvas_connections", code_mode_only=True)
class ManageCanvasConnections(BaseTool[BaseToolParams]):
    """<!--zh: 新增、删除或替换明确的 Connection。-->Manage explicit Canvas Connections."""

    name = "manage_canvas_connections"
    feedback_action_key = "manage_canvas_connections"

    class Params(BaseToolParams):
        """批量 Connection 操作参数。"""

        model_config = ConfigDict(extra="forbid")

        project_path: str = Field(..., min_length=1, description="Workspace-relative Canvas project path.")
        items: list[ConnectionInput] = Field(..., min_length=1)

    params_class = Params

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, Any] | None = None
    ) -> dict[str, str]:
        """根据新增、删除、替换参数生成连线操作前反馈。"""
        args = arguments or {}
        items = args.get("items") or []
        if any(item.get("replace_existing_connections") for item in items if isinstance(item, dict)):
            action_key = "canvas.replace_connections"
        elif items and all(
            item.get("remove_connection_ids") and not item.get("source_element_id")
            for item in items if isinstance(item, dict)
        ):
            action_key = "canvas.remove_connections"
        else:
            action_key = self.feedback_action_key
        project_path = args.get("project_path", "")
        remark = canvas_remark("canvas.connections_pending", project_path, total=len(items))
        return {
            "action": i18n.translate(action_key, category="tool.actions"),
            "remark": remark,
            "tool_name": tool_name,
        }

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict[str, Any] | None = None,
    ) -> dict[str, str]:
        """生成连线操作后的新增、删除或替换结果反馈。"""
        if not result.ok:
            remark = i18n.translate("canvas.operation_failed", category="tool.messages")
        else:
            values = (result.data or {}).get("items", [])
            removed = sum(1 for item in values if item.get("status") in {"removed", "already_removed"})
            replaced = sum(1 for item in values if item.get("status") in {"replaced", "already_replaced"})
            added = len(values) - removed - replaced
            remark = canvas_remark(
                "canvas.connections_result",
                added=added,
                removed=removed,
                replaced=replaced,
            )
        args = arguments or {}
        items = args.get("items") or []
        if any(item.get("replace_existing_connections") for item in items if isinstance(item, dict)):
            action_key = "canvas.replace_connections"
        elif items and all(
            item.get("remove_connection_ids") and not item.get("source_element_id")
            for item in items if isinstance(item, dict)
        ):
            action_key = "canvas.remove_connections"
        else:
            action_key = self.feedback_action_key
        return {
            "action": i18n.translate(action_key, category="tool.actions"),
            "remark": remark,
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, Any] | None = None
    ) -> ToolDetail | None:
        """生成连线工具自己的端点和操作详情。"""
        data = result.data or {}
        builder = CanvasToolDetailBuilder(self.name, "connections", result, arguments)
        builder.add_field("project_path", data.get("project_path") or builder.arguments.get("project_path") or "-")
        for item in data.get("items", []):
            builder.add_item(
                {
                    "item_ref": item.get("item_ref", "-"),
                    "status": item.get("status", "-"),
                    "connection_id": item.get("connection_id", "-"),
                    "source": item.get("source_element_id", "-"),
                    "target": item.get("target_element_id", "-"),
                }
            )
        return builder.build()

    async def execute(self, tool_context: ToolContext, params: Params) -> ToolResult:
        """按明确 ID 管理 Connection。"""
        try:
            result = await _application(tool_context).connections(params.project_path, [item.to_command() for item in params.items])
            return batch_tool_result(
                content=items_content(
                    "Canvas Connections updated successfully.",
                    result.to_dict(),
                    "call query_canvas_element_details with the affected Element IDs to verify the Connections",
                ),
                data=result.to_dict(),
            )
        except Exception as error:
            return error_result(error)
