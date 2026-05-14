"""MCP 服务模块

仅负责 MCP 配置的"摄取"与"种子注入"，不建连、不 discover。连接生命周期由
`using-mcp` Skill 按需触发（见 `/api/sdk/mcp/*` 路由与 `MCPServerManager`）。

职责边界：
- `ingest_from_message`：消息链路唯一入口，解析 client 侧 mcp_config → upsert 到 ChatMcpStore。
  不再向模型注入任何沉淀提醒，using-mcp skill 在需要时主动查询 store 并显式连接。
- `seed_from_global_config`：启动期入口，把 config/mcp.json 合并进 ChatMcpStore
"""

import traceback
from typing import Any, Dict, List, Optional

from agentlang.logger import get_logger

from app.core.context.agent_context import AgentContext
from app.mcp.config.loader import load_global_mcp_config
from app.mcp.config.models import MCPConfigSource, MCPServerConfig, MCPServerType
from app.mcp.store import UpsertChangeType, get_chat_mcp_store

logger = get_logger(__name__)


class MCPService:
    """MCP 服务类：只做配置摄取，不接管连接生命周期。"""

    @staticmethod
    async def ingest_from_message(
        mcp_config: Optional[Dict[str, Any]],
        agent_context: Optional[AgentContext],
    ) -> None:
        """消息到达时的唯一入口：增量持久化配置，不建连、不注入任何提醒。

        Args:
            mcp_config: 客户端消息携带的 `mcp_config`，形如 `{"mcpServers": {...}}`
            agent_context: 当前 agent 上下文（保留参数以与调用点兑齐，当前未使用）；允许为 None
        """
        if not mcp_config:
            return
        try:
            valid_configs = MCPService._parse_mcp_config(mcp_config)
            if not valid_configs:
                return

            store = get_chat_mcp_store()
            diff = await store.upsert_many(valid_configs, source=MCPConfigSource.CLIENT_CONFIG)
            added = sum(1 for v in diff.values() if v == UpsertChangeType.ADDED)
            changed = sum(1 for v in diff.values() if v == UpsertChangeType.CHANGED)
            logger.info(
                f"已摄取客户端 MCP 配置：upsert {len(valid_configs)} 项，"
                f"added={added}, changed={changed}"
            )

        except Exception as e:
            logger.error(f"摄取客户端 MCP 配置失败: {e}")
            logger.error(f"错误详情: {traceback.format_exc()}")
            # 不抛异常，不影响聊天主流程

    @staticmethod
    async def seed_from_global_config() -> None:
        """启动期入口：把 config/mcp.json 合并进 ChatMcpStore，不建连。"""
        try:
            global_configs = await load_global_mcp_config()
            if not global_configs:
                logger.debug("未发现全局 MCP 配置，跳过 seed")
                return
            store = get_chat_mcp_store()
            diff = await store.upsert_many(global_configs, source=MCPConfigSource.GLOBAL_CONFIG)
            logger.info(
                f"全局 MCP 配置已 seed 到 ChatMcpStore：共 {len(global_configs)} 项，"
                f"added={sum(1 for v in diff.values() if v == UpsertChangeType.ADDED)}, "
                f"changed={sum(1 for v in diff.values() if v == UpsertChangeType.CHANGED)}, "
                f"unchanged={sum(1 for v in diff.values() if v == UpsertChangeType.UNCHANGED)}"
            )
        except Exception as e:
            logger.error(f"Seed 全局 MCP 配置失败: {e}")
            logger.error(f"错误详情: {traceback.format_exc()}")

    # ── 内部 ──────────────────────────────────────────────────────────────

    @staticmethod
    def _parse_mcp_config(mcp_config: Dict[str, Any]) -> List[MCPServerConfig]:
        """解析客户端 mcp_config，返回有效 MCPServerConfig 列表。

        无效条目记录 warning 后丢弃，不进入存储。
        """
        mcp_servers_raw = mcp_config.get("mcpServers")
        if not isinstance(mcp_servers_raw, dict) or not mcp_servers_raw:
            return []

        valid: List[MCPServerConfig] = []
        for key, raw in mcp_servers_raw.items():
            if not isinstance(raw, dict):
                logger.warning(f"MCP 服务器 {key} 配置格式错误：期望 dict，跳过")
                continue
            if not raw.get("enabled", True):
                continue

            # 拷贝一份避免污染调用方字典
            cfg_dict = dict(raw)
            server_name = cfg_dict.get("name")
            if not server_name or not str(server_name).strip():
                server_name = key
            cfg_dict["name"] = server_name

            # 补全 type 字段
            config_type = str(cfg_dict.get("type", "")).lower()
            if config_type not in ("http", "stdio"):
                if cfg_dict.get("command") and not cfg_dict.get("url"):
                    cfg_dict["type"] = MCPServerType.STDIO.value
                elif cfg_dict.get("url"):
                    cfg_dict["type"] = MCPServerType.HTTP.value
                else:
                    logger.warning(f"MCP 服务器 {server_name} 无法推断类型，跳过")
                    continue

            # 标记来源
            cfg_dict["source"] = MCPConfigSource.CLIENT_CONFIG.value
            # 已存在的 error_message 不进入 store；store 只持久化可建连的配置
            cfg_dict.pop("error_message", None)

            try:
                valid.append(MCPServerConfig(**cfg_dict))
            except Exception as e:
                logger.warning(f"MCP 服务器 {server_name} 构建失败: {e}")

        return valid
