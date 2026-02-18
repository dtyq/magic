"""update_agent - 更新指定 Agent 的名称、描述或提示词"""

import json
from typing import Optional, Dict, Any

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from agentlang.utils.shadow_code import ShadowCode
from app.tools.core import BaseTool, BaseToolParams, tool
from app.core.entity.message.server_message import ToolDetail, DisplayType
from app.paths import PathManager
from app.i18n import i18n

logger = get_logger(__name__)


class UpdateAgentParams(BaseToolParams):
    """UpdateAgent 工具参数"""
    agent_code: Optional[str] = Field(
        default=None,
        description="""<!--zh: Agent 编码。如不提供则使用当前会话的 agent_code。
Agent code. If not provided, uses the current session's agent_code.-->"""
    )
    name_zh: Optional[str] = Field(
        default=None,
        description="""<!--zh: Agent 中文名称
Agent Chinese name-->"""
    )
    name_en: Optional[str] = Field(
        default=None,
        description="""<!--zh: Agent 英文名称
Agent English name-->"""
    )
    description_zh: Optional[str] = Field(
        default=None,
        description="""<!--zh: Agent 中文描述
Agent Chinese description-->"""
    )
    description_en: Optional[str] = Field(
        default=None,
        description="""<!--zh: Agent 英文描述
Agent English description-->"""
    )
    prompt: Optional[str] = Field(
        default=None,
        description="""<!--zh: 新的系统提示词（明文）。将自动进行混淆处理后上传。
New system prompt (plaintext). Will be obfuscated automatically before upload.-->"""
    )


@tool()
class UpdateAgent(BaseTool[UpdateAgentParams]):
    """<!--zh
    更新指定自定义 Agent 的信息。支持部分更新：名称、描述、提示词。
    提示词会自动封装为标准 prompt 对象并经过 ShadowCode 混淆后上传。
    -->
    Update a custom agent's info. Supports partial updates: name, description, prompt.
    Prompt is automatically wrapped into a standard prompt object and obfuscated via ShadowCode.
    """

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        if not result.ok:
            return None
        agent_code = (arguments or {}).get("agent_code") or result.extra_info.get("agent_code")
        if not agent_code:
            return None
        return ToolDetail(
            type=DisplayType.CODE,
            data={"code": agent_code}
        )

    def _get_remark_content(self, result: ToolResult, arguments=None) -> str:
        if result.ok:
            args = arguments or {}
            parts = []
            if args.get("name_zh") or args.get("name_en"):
                parts.append(i18n.translate("agent_manager.field_name", category="tool.messages"))
            if args.get("description_zh") or args.get("description_en"):
                parts.append(i18n.translate("agent_manager.field_description", category="tool.messages"))
            if args.get("prompt") is not None:
                parts.append(i18n.translate("agent_manager.field_prompt", category="tool.messages"))
            separator = "\u3001" if i18n.get_language() == "zh_CN" else ", "
            if parts:
                return i18n.translate("agent_manager.update_success", category="tool.messages", fields=separator.join(parts))
            return i18n.translate("agent_manager.update_default", category="tool.messages")
        return ""

    async def execute(self, tool_context: ToolContext, params: UpdateAgentParams) -> ToolResult:
        from app.core.context.agent_context import AgentContext
        from app.infrastructure.sdk.magic_service.factory import get_magic_service_sdk
        from app.infrastructure.sdk.magic_service.parameter.update_agent_parameter import UpdateAgentParameter

        # Resolve agent_code
        agent_code = params.agent_code
        if not agent_code:
            agent_context = tool_context.get_extension_typed("agent_context", AgentContext)
            if agent_context:
                agent_code = agent_context.get_agent_code()

        if not agent_code:
            return ToolResult(ok=False, content=i18n.translate("agent_manager.agent_code_not_found", category="tool.messages"))

        # Check that at least one field is provided
        if not any([params.name_zh, params.name_en, params.description_zh,
                     params.description_en, params.prompt]):
            return ToolResult(ok=False, content=i18n.translate("agent_manager.update_no_fields", category="tool.messages"))

        try:
            # Build update parameters
            name_i18n = None
            if params.name_zh or params.name_en:
                name_i18n = {}
                if params.name_zh:
                    name_i18n["zh_CN"] = params.name_zh
                if params.name_en:
                    name_i18n["en_US"] = params.name_en

            description_i18n = None
            if params.description_zh or params.description_en:
                description_i18n = {}
                if params.description_zh:
                    description_i18n["zh_CN"] = params.description_zh
                if params.description_en:
                    description_i18n["en_US"] = params.description_en

            prompt_shadow = None
            if params.prompt is not None:
                # Build prompt object: { version, structure: { string } }
                prompt_obj = {
                    "version": "1.0.0",
                    "structure": {
                        "string": params.prompt
                    }
                }
                # Serialize to JSON then shadow
                prompt_json = json.dumps(prompt_obj, ensure_ascii=False)
                prompt_shadow = ShadowCode.shadow(prompt_json)

            sdk = get_magic_service_sdk()
            parameter = UpdateAgentParameter(
                code=agent_code,
                name_i18n=name_i18n,
                description_i18n=description_i18n,
                prompt_shadow=prompt_shadow,
            )
            result = await sdk.agent.update_agent_async(parameter)

            # Update local cache
            agent_dir = PathManager.get_agent_studio_dir(agent_code)
            agent_json_path = agent_dir / "agent.json"
            if agent_json_path.exists():
                try:
                    agent_info = json.loads(agent_json_path.read_text(encoding="utf-8"))
                    if name_i18n:
                        agent_info["name_i18n"] = {**agent_info.get("name_i18n", {}), **name_i18n}
                    if description_i18n:
                        agent_info["description_i18n"] = {**agent_info.get("description_i18n", {}), **description_i18n}
                    if params.prompt is not None:
                        agent_info["prompt"] = {
                            "version": "1.0.0",
                            "structure": {"string": params.prompt}
                        }
                    agent_json_path.write_text(json.dumps(agent_info, ensure_ascii=False, indent=2), encoding="utf-8")
                except Exception as e:
                    logger.warning(f"Failed to update local cache: {e}")

            # Format response
            _t = lambda key, **kw: i18n.translate(key, category="tool.messages", **kw)

            updated_fields = []
            if name_i18n:
                updated_fields.append(f"{_t('agent_manager.field_name')}: {name_i18n}")
            if description_i18n:
                updated_fields.append(f"{_t('agent_manager.field_description')}: {description_i18n}")
            if params.prompt is not None:
                preview = params.prompt[:100] + "..." if len(params.prompt) > 100 else params.prompt
                updated_fields.append(f"{_t('agent_manager.field_prompt')}: {preview}")

            summary = (
                f"## {_t('agent_manager.summary_update_success')}\n\n"
                f"- **{_t('agent_manager.label_code')}**: {agent_code}\n"
                f"- **{_t('agent_manager.label_updated_fields')}**:\n"
                + "\n".join(f"  - {f}" for f in updated_fields)
            )

            return ToolResult(content=summary, extra_info={"agent_code": agent_code})

        except Exception as e:
            logger.error(f"Failed to update agent: {e}")
            return ToolResult(ok=False, content=i18n.translate("agent_manager.update_error", category="tool.messages", error=str(e)))
