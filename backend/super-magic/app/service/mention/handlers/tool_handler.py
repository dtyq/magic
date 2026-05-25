"""Tool mention handler

@tool mention 经 magic-service 端 ToolMentionNormalizer 规范化后，会带上以下字段：
  - id（tool flow code）/ name（前端原始名）/ tool_name / description / json_schema

handler 职责：
  1. handle(): 把 mention 摘要写入 <mentions> 上下文（提供 tool_id / json_schema 给 LLM 引用）
  2. get_tip(): 通过 horizon push_notification 推送指引 —— 告知 LLM 通过
     run_sdk_snippet 调用 call_simple_tool 工具来真正调用远端 tool flow。
"""
import json
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from app.service.mention.base import BaseMentionHandler, logger

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext

# json_schema 摘要展示长度上限，避免污染上下文
_SCHEMA_SUMMARY_MAX_LEN = 800


def _get_tool_id(mention: Dict[str, Any]) -> str:
    return str(mention.get("id") or mention.get("tool_id") or "").strip()


def _get_tool_name(mention: Dict[str, Any]) -> str:
    return str(
        mention.get("tool_name")
        or mention.get("name")
        or "unknown-tool"
    ).strip()


def _format_schema_summary(schema: Any) -> str:
    """把 json_schema 序列化为单行片段，过长时截断。"""
    if not schema:
        return ""
    try:
        text = json.dumps(schema, ensure_ascii=False, separators=(",", ":"))
    except (TypeError, ValueError):
        return ""
    if len(text) > _SCHEMA_SUMMARY_MAX_LEN:
        text = text[:_SCHEMA_SUMMARY_MAX_LEN] + "..."
    return text


class ToolHandler(BaseMentionHandler):
    """处理 tool 类型的 mention"""

    def get_type(self) -> str:
        return "tool"

    async def get_tip(
        self,
        mention: Dict[str, Any],
        agent_context: Optional["AgentContext"] = None,
    ) -> str:
        """推送 tool mention 指引到 horizon。

        指引内容：
          - 提示 LLM 通过 run_sdk_snippet + tool.call("call_simple_tool", ...) 调用
          - arguments 需满足 mention 中给出的 json_schema
          - 缺失 agent_context 时退化为 Before proceeding: 文本注入
        """
        tool_id = _get_tool_id(mention)
        tool_name = _get_tool_name(mention)
        description = str(mention.get("description") or "").strip()

        if not tool_id:
            tip = (
                f"Tool '{tool_name}' is referenced but its tool_id is missing; "
                f"ask the user to confirm before invoking."
            )
        else:
            desc_part = f" Purpose: {description}." if description else ""
            tip = (
                f"Tool '{tool_name}' (tool_id='{tool_id}') is referenced.{desc_part} "
                f"To execute it, call `call_simple_tool` via run_sdk_snippet, e.g.:\n"
                f"```python\n"
                f"from sdk.tool import tool\n"
                f"result = tool.call(\"call_simple_tool\", {{\n"
                f"    \"tool_id\": \"{tool_id}\",\n"
                f"    \"arguments\": {{ ... must satisfy the tool's json_schema in the mention ... }},\n"
                f"}})\n"
                f"```\n"
                f"Inspect the json_schema in the mention block above to build a valid `arguments`."
            )

        if agent_context is not None:
            try:
                agent_context.horizon.push_notification("tool_mention", tip)
                return ""
            except Exception as e:
                logger.warning(f"推送 tool mention horizon 通知失败: {e}")

        return tip

    async def handle(
        self,
        mention: Dict[str, Any],
        index: int,
        agent_context: Optional["AgentContext"] = None,
    ) -> List[str]:
        tool_id = _get_tool_id(mention)
        tool_name = _get_tool_name(mention)
        description = str(mention.get("description") or "").strip()
        schema_summary = _format_schema_summary(mention.get("json_schema"))

        logger.info(
            f"用户 prompt 添加 Tool 引用: {tool_name} "
            f"(tool_id={tool_id})"
        )

        lines = [f"{index}. [@tool:{tool_name}]"]
        if tool_id:
            lines.append(f"   - tool_id: {tool_id}")
        if description:
            lines.append(f"   - description: {description}")
        if schema_summary:
            lines.append(f"   - json_schema: {schema_summary}")

        return lines
