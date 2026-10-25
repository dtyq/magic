"""Code Mode 微信投递；模型说明见 agents/skills/im-channels/reference/wechat.md。"""
from __future__ import annotations

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.channel.wechat import api
from app.channel.wechat.code_mode_delivery import check_send_permission, deliver_messages
from app.channel.wechat.models import WechatMessageItem
from app.core.context.agent_context import AgentContext
from app.core.entity.event.event_context import EventContext
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.core import BaseTool, BaseToolParams, tool


class SendWechatMessageParams(BaseToolParams):
    items: list[WechatMessageItem] = Field(min_length=1, description="Messages to send in order to the current WeChat session.")


@tool(code_mode_only=True)
class SendWechatMessage(BaseTool[SendWechatMessageParams]):
    """Send explicit messages to the current WeChat session."""

    def is_visible_in_context(self, agent_context: AgentContext) -> bool:
        try:
            check_send_permission(agent_context)
            return True
        except ValueError:
            return False

    async def execute(self, tool_context: ToolContext, params: SendWechatMessageParams) -> ToolResult:
        context = tool_context.get_extension_typed("agent_context", AgentContext)
        if context is None:
            return ToolResult.error("The current Agent context is required. No messages were sent.")
        try:
            check_send_permission(context)
        except ValueError as error:
            return ToolResult.error(f"WeChat delivery is unavailable: {error} No messages were sent.")
        try:
            results = await deliver_messages(tool_context, params.items)
        except Exception as error:
            return ToolResult.error(
                f"WeChat delivery did not complete: {error}. "
                "Some items may already have been sent. Check delivery records before retrying."
            )
        events = tool_context.get_extension_typed("event_context", EventContext)
        sent = sum(result.status == "sent" for result in results)
        mirrored = events is not None and not events.outbound_mirror_failed
        content = "\n".join(
            f"Item {result.index + 1} ({result.kind}): {result.status}. {result.message}".rstrip()
            for result in results
        )
        content += f"\nSent {sent}/{len(results)} items. Current text budget: {api.text_max_bytes()} UTF-8 bytes."
        if not mirrored:
            content += "\nWeb mirroring was incomplete. Preserve confirmed WeChat sends; do not resend them to repair Web history."
        if any(result.status == "unknown" for result in results):
            content += "\nDo not automatically retry unknown delivery."
        return ToolResult(
            ok=sent == len(results) and mirrored, content=content,
            data={
                "items": [result.model_dump(mode="json") for result in results],
                "summary": {"sent": sent, "total": len(results)},
                "web_message_ids": list(events.outbound_message_ids) if events else [],
                "web_mirror_status": "sent" if mirrored else "incomplete",
            },
        )

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult,
        arguments: dict[str, object] | None = None,
    ) -> ToolDetail:
        data = result.data if isinstance(result.data, dict) else {}
        items = data.get("items", [])
        lines = [i18n.translate(
            "send_wechat_message.success" if result.ok else "send_wechat_message.incomplete",
            category="tool.messages",
        )]
        if isinstance(items, list):
            for item in items:
                if not isinstance(item, dict):
                    continue
                status = str(item.get("status", "failed"))
                lines.append(f"- {int(item.get('index', 0)) + 1}: " + i18n.translate(
                    f"send_wechat_message.{status}", category="tool.messages",
                ))
                error_code = item.get("error_code")
                if error_code in {"text_too_long", "preparation_failed", "wechat_api_error", "delivery_unknown"}:
                    lines.append(i18n.translate(
                        f"send_wechat_message.error.{error_code}", category="tool.messages",
                    ))
                original_items = (arguments or {}).get("items")
                index = int(item.get("index", 0))
                if isinstance(original_items, list) and index < len(original_items):
                    source = original_items[index]
                    if isinstance(source, dict) and isinstance(source.get("path"), str):
                        from pathlib import Path

                        lines.append(f"`{Path(source['path']).name}`")
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="wechat-delivery.md", content="\n".join(lines)),
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult,
        execution_time: float, arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        return {
            "action": i18n.translate(self.name, category="tool.actions"),
            "remark": i18n.translate(
                "send_wechat_message.success" if result.ok else "send_wechat_message.incomplete",
                category="tool.messages",
            ),
        }
