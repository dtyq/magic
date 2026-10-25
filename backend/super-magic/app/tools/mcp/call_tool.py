"""mcp_call_tool 工具"""

import json
from pathlib import Path
from typing import Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.context.agent_context import AgentContext
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.mcp.manager import ensure_server_connected
from app.mcp.tool import result_saver
from app.tools.core import BaseToolParams, tool
from app.tools.mcp._base import BaseMcpTool

logger = get_logger(__name__)


class McpCallToolParams(BaseToolParams):
    server_name: str = Field(
        ...,
        description="Target MCP server name.",
    )
    tool_name: str = Field(
        ...,
        description="Tool name returned by mcp_list_tools or mcp_get_tool_schema.",
    )
    tool_params: str = Field(
        ...,
        description=(
            "JSON object string matching mcp_get_tool_schema, for example "
            "'{\"key\": \"value\"}'. Pass '{}' when the tool has no parameters."
        ),
    )
    output_file_path: str = Field(
        default="",
        description=(
            "Optional absolute JSON output path. Successful results are returned inline by default; "
            "when omitted, results larger than the configured "
            "runtime_cleanup.mcp_outputs.result_size_threshold are stored in the capacity-managed .runtime "
            "directory and may disappear after later eviction or a sandbox restart. To keep a result "
            "across restarts or deliver it to the user, provide an absolute path inside the current "
            ".workspace directory."
        ),
    )


@tool(name="mcp_call_tool")
class McpCallTool(BaseMcpTool[McpCallToolParams]):
    """Invoke an MCP tool, connecting its server when needed."""

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        args = arguments or {}
        server_name = args.get("server_name", "")
        target_tool = args.get("tool_name", "")
        return {
            "action": i18n.translate("call_tool", category="tool.actions"),
            "remark": i18n.translate(
                "mcp.call_tool.calling", category="tool.messages",
                server_name=server_name, tool_name=target_tool,
            ),
            "tool_name": tool_name,
        }

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        args = arguments or {}
        server_name = args.get("server_name", "")
        target_tool = args.get("tool_name", "")
        if result.ok:
            return i18n.translate(
                "mcp.call_tool.called", category="tool.messages",
                server_name=server_name, tool_name=target_tool,
            )
        return i18n.translate(
            "mcp.call_tool.failed", category="tool.messages",
            server_name=server_name, tool_name=target_tool,
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult,
        execution_time: float, arguments: Dict[str, Any] = None,
    ) -> Dict:
        action = i18n.translate("call_tool", category="tool.actions")
        remark = self._get_remark_content(result, arguments)
        return {"action": action, "remark": remark}

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        args = arguments or {}
        server_name = args.get("server_name", "") or "-"
        target_tool = args.get("tool_name", "") or "-"
        tool_params_raw = args.get("tool_params", "") or ""

        status_label = "Success" if result.ok else "Error"
        header = f"**{server_name}** · `{target_tool}` · {status_label}"

        meta_parts: list[str] = []
        execution_time = getattr(result, "execution_time", None)
        if execution_time is not None:
            meta_parts.append(f"Latency {execution_time:.2f}s")
        output_path = self._extract_output_path(result)
        if output_path:
            meta_parts.append(f"Output: `{output_path}`")

        sections: list[str] = [header]
        if meta_parts:
            sections.append("> " + " · ".join(meta_parts))

        formatted_params = self._format_json_params(tool_params_raw)
        sections.append(f"#### Request\n\n```json\n{formatted_params}\n```")

        content_text = result.content or ""
        truncated = False
        if len(content_text) > 2000:
            content_text = content_text[:2000]
            truncated = True

        response_label = "#### Response" if result.ok else "#### Error"
        rendered_content = self._render_content_block(content_text)
        sections.append(f"{response_label}\n\n{rendered_content}")
        if truncated:
            sections.append("_…response truncated for display_")

        md = "\n\n".join(sections)
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="mcp_call_result.md", content=md),
        )

    @staticmethod
    def _format_json_params(raw: str) -> str:
        """入参 JSON 字符串美化；解析失败时原样返回，避免详情页报错"""
        if not raw:
            return "{}"
        try:
            return json.dumps(json.loads(raw), ensure_ascii=False, indent=2)
        except (json.JSONDecodeError, TypeError):
            return raw

    @staticmethod
    def _render_content_block(content: str) -> str:
        """输出内容可能是JSON / 纯文本 / CSV 等：
        能解析为 JSON dict/list 则用 ```json 美化，其余一律作为 plain text 包裹，
        避免原文里的 # / < / * 等字符被外层 markdown 误渲染。
        外层使用 4 个反引号 fence，容下内容包含 3 个反引号的场景。
        """
        text = (content or "").strip()
        if not text:
            return "_(empty)_"
        try:
            obj = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            obj = None
        if isinstance(obj, (dict, list)):
            pretty = json.dumps(obj, ensure_ascii=False, indent=2)
            return f"```json\n{pretty}\n```"
        return f"````text\n{text}\n````"

    @staticmethod
    def _extract_output_path(result: ToolResult) -> str:
        data = result.data if isinstance(result.data, dict) else None
        if not data:
            return ""
        path = data.get("output_file_path")
        return str(path) if path else ""

    async def execute(
        self, tool_context: ToolContext, params: McpCallToolParams
    ) -> ToolResult:
        server_name = params.server_name.strip()
        tool_name = params.tool_name.strip()
        if not server_name or not tool_name:
            return ToolResult.error("server_name and tool_name must not be empty.")

        result_saver.trigger_mcp_output_cleanup()
        requested_output_path = params.output_file_path.strip()
        if requested_output_path and not Path(requested_output_path).is_absolute():
            return ToolResult.error(
                "output_file_path must be an absolute path. To keep the result across sandbox "
                "restarts or deliver it to the user, use an absolute path inside the current "
                ".workspace directory."
            )

        ok = await self._ensure_server_in_manager(server_name)
        if not ok:
            return ToolResult.error(f"Unknown MCP server: {server_name}")

        try:
            parsed_params = json.loads(params.tool_params)
        except json.JSONDecodeError as e:
            return ToolResult.error(
                f"tool_params must be a valid JSON object string: {e!s}"
            )
        if not isinstance(parsed_params, dict):
            return ToolResult.error(
                "tool_params must decode to a JSON object (dict at top level)."
            )

        ensure_result = await ensure_server_connected(server_name)
        if ensure_result.status != "success":
            return ToolResult.error(
                ensure_result.error or f"Failed to connect MCP server: {server_name}",
            )

        manager = self._get_manager()
        try:
            result = await manager.call_tool(server_name, tool_name, parsed_params)
        except Exception as e:
            logger.error(
                f"MCP call failed: {server_name}.{tool_name}: {e}", exc_info=True
            )
            return ToolResult.error(f"MCP tool call failed: {e!s}")

        result.name = f"{server_name}.{tool_name}"

        # 按需落盘：用户指定路径时作为产物交付，未指定但结果超阈值时自动保存到运行时目录避免冲击上下文
        if result.ok and result_saver.should_save_to_file(result, params.output_file_path):
            try:
                agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
                workspace_dir = (
                    Path(agent_context.get_workspace_dir())
                    if agent_context is not None
                    else None
                )
                result = await result_saver.save_result_to_file(
                    result=result,
                    output_file_path=params.output_file_path,
                    tool_original_name=tool_name,
                    server_name=server_name,
                    workspace_dir=workspace_dir,
                )
            except Exception as save_error:
                # 落盘失败不能吃掉原始调用结果，原始 result 透传供模型继续推理
                logger.error(f"Failed to save MCP result to file: {save_error}")

        return result
