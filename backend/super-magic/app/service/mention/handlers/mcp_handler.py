"""MCP mention handler

@mcp mention 经 magic-service 端 McpMentionNormalizer 规范化后，会带上以下字段：
  - name / description（顶层）
  - config（嵌套子字段，与原 mcpConfig.mcpServers[name] 字段口径一致：
    type=http/stdio、url、token、headers、command、args、env、allowedTools 等）

handler 职责：
  1. handle(): 把 mention 摘要写入 <mentions> 上下文
  2. get_tip(): 复用 super-magic 现有的 MCPService.ingest_from_message 完成 server 注册
     （等同于原本 mcpConfig.mcpServers 入口路径），并通过 horizon 推送指引让 LLM
     使用 using-mcp skill / mcp.* 工具调用该 server 提供的能力。
"""
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from app.service.mention.base import BaseMentionHandler, logger

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext

# super-magic 端 MCPServerConfig 期望的字段名（snake_case），用于把 PHP 端
# McpServerConfig::toArray 输出的 camelCase / 历史字段映射成可被 pydantic 接受的 dict。
# 同时充当白名单：未在此映射中的字段不会进入 mcpServers cfg，避免 mention 元字段污染。
_FIELD_MAPPING: Dict[str, str] = {
    "name": "name",
    "type": "type",
    "description": "description",
    "url": "url",
    "token": "token",
    "headers": "headers",
    "command": "command",
    "args": "args",
    "env": "env",
    "allowedTools": "allowed_tools",  # camelCase → snake_case
    "allowed_tools": "allowed_tools",
    "server_options": "server_options",
}


def _build_mcp_server_config(
    mention_name: str,
    raw_config: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """从 normalize 后的 config 子字段提取 MCPServerConfig 可接受的 dict。

    返回 None 表示配置不足以构建有效 server（缺 url 又缺 command）。
    """
    cfg: Dict[str, Any] = {}
    for src_key, dst_key in _FIELD_MAPPING.items():
        if src_key in raw_config and raw_config[src_key] not in (None, ""):
            cfg[dst_key] = raw_config[src_key]

    # 必须有 name；优先取顶层 mention.name，回退 cfg.name
    if not cfg.get("name"):
        if not mention_name:
            return None
        cfg["name"] = mention_name

    # 至少要有 url 或 command；ingest_from_message._parse_mcp_config 也会再做一次校验
    if not cfg.get("url") and not cfg.get("command"):
        return None

    return cfg


class MCPHandler(BaseMentionHandler):
    """处理 mcp 类型的 mention"""

    def get_type(self) -> str:
        return "mcp"

    async def get_tip(
        self,
        mention: Dict[str, Any],
        agent_context: Optional["AgentContext"] = None,
    ) -> str:
        """注册 MCP server 并推送 horizon 指引。

        - 从 mention['config'] 提取运行时配置 → 构造 {"mcpServers": {name: cfg}} →
          调用 super-magic MCPService.ingest_from_message 完成增量注册（与原本
          客户端消息携带 mcp_config 的入口完全一致）。
        - 之后推 horizon mcp_mention 通知，提示 LLM 该 server 已可用、建议通过
          using-mcp skill / mcp_* 工具调用。
        - agent_context 缺失时跳过注册，仅退化为 Before proceeding: 文本提示。
        """
        from app.service.mcp_service import MCPService

        mention_name = str(mention.get("name") or "").strip()
        description = str(mention.get("description") or "").strip()
        raw_config = mention.get("config") or {}
        if not isinstance(raw_config, dict):
            raw_config = {}

        if not mention_name:
            logger.warning("收到 mcp mention 但缺少 name 字段，跳过注册")
            return "An @mcp mention is missing its name; skipping registration."

        server_cfg = _build_mcp_server_config(mention_name, raw_config)

        # agent_context 缺失：仅退化文本提示，不能调 ingest（依赖 horizon）
        if agent_context is None:
            if server_cfg is None:
                return (
                    f"MCP server '{mention_name}' is referenced but its runtime "
                    f"configuration is incomplete; ask the user to verify."
                )
            return (
                f"MCP server '{mention_name}' is referenced. "
                f"Use the using-mcp skill (read_skills(['using-mcp'])) to learn how "
                f"to connect and call its tools."
            )

        # 配置缺失：仅推一条警告级提示，不调 ingest
        if server_cfg is None:
            tip = (
                f"MCP server '{mention_name}' is referenced but its runtime "
                f"configuration is incomplete (missing url and command); "
                f"ask the user to verify before attempting to use it."
            )
            try:
                agent_context.horizon.push_notification("mcp_mention", tip)
                return ""
            except Exception as e:
                logger.warning(f"推送 mcp mention horizon 通知失败: {e}")
            return tip

        # 调用 super-magic 现有的 mcp_config 注册入口（与客户端消息 mcp_config 同路径）
        try:
            await MCPService.ingest_from_message(
                {"mcpServers": {mention_name: server_cfg}},
                agent_context,
            )
            logger.info(f"已通过 mention 注册 MCP server: {mention_name}")
        except Exception as e:
            logger.warning(f"通过 mention 注册 MCP server '{mention_name}' 失败: {e}")

        # MCPService.ingest_from_message 内部仅在 added/changed 且 agent has_skill('using-mcp')
        # 时推送 mcp_service 通知；此处再推一条 mcp_mention 通知，明确告知 LLM 该 mention
        # 对应的 server 已可用，并提示用 using-mcp skill 学习调用方式。
        desc_part = f" Purpose: {description}." if description else ""
        tip = (
            f"MCP server '{mention_name}' is referenced and has been registered.{desc_part} "
            f"To call its tools, first run read_skills(['using-mcp']) to learn the workflow, "
            f"then connect and invoke via the mcp_* tools."
        )
        try:
            agent_context.horizon.push_notification("mcp_mention", tip)
            return ""
        except Exception as e:
            logger.warning(f"推送 mcp mention horizon 通知失败: {e}")
        return tip

    async def handle(
        self,
        mention: Dict[str, Any],
        index: int,
        agent_context: Optional["AgentContext"] = None,
    ) -> List[str]:
        mention_name = str(mention.get("name") or "unknown-mcp").strip()
        description = str(mention.get("description") or "").strip()

        logger.info(f"用户 prompt 添加 MCP 引用: {mention_name}")

        lines = [f"{index}. [@mcp:{mention_name}]"]
        if description:
            lines.append(f"   - description: {description}")

        return lines
