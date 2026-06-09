"""ChatMcpStore

Per-instance 的 MCP 服务器配置存储，仅做配置持久化（增量 upsert / remove），不建连。

文件路径：PathManager.get_chat_history_dir() / "mcp_servers.json"

职责边界：
- 只负责读写 JSON 文件，维护来源、时间戳等元数据
- 不关心 MCPServerManager、不关心 discover
- 对外暴露 MCPServerConfig 作为配置单元
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import StrEnum
from pathlib import Path
from typing import Dict, List, Optional

from agentlang.logger import get_logger

from app.mcp.config.models import MCPConfigSource, MCPServerConfig, MCPServerType
from app.path_manager import PathManager
from app.utils.async_file_utils import async_try_read_json, async_write_json

logger = get_logger(__name__)

# 存储文件的 schema 版本。仅在结构发生不兼容变更时递增。
_STORE_VERSION = 1

# 参与 diff 判断的字段。与 app/mcp/config/loader._is_config_changed 保持一致。
_DIFF_FIELDS = ("type", "command", "args", "env", "url", "headers", "token", "server_options", "description", "allowed_tools")


class UpsertChangeType(StrEnum):
    """upsert_many 返回的变更类型。"""
    ADDED = "added"
    CHANGED = "changed"
    UNCHANGED = "unchanged"


@dataclass
class ChatMcpStoreEntry:
    """存储中的一条服务器记录，包含配置本体与来源/时间戳等元数据。"""
    config: MCPServerConfig
    source: MCPConfigSource
    added_at: str
    updated_at: str

    def to_dict(self) -> dict:
        return {
            "config": self.config.model_dump(mode="json", exclude_none=True),
            "meta": {
                "source": self.source.value if isinstance(self.source, MCPConfigSource) else str(self.source),
                "added_at": self.added_at,
                "updated_at": self.updated_at,
            },
        }

    @classmethod
    def from_dict(cls, raw: dict) -> Optional["ChatMcpStoreEntry"]:
        """从 JSON 反序列化一条记录；任何字段异常都返回 None 由上层过滤。"""
        try:
            config_raw = raw.get("config") or {}
            meta_raw = raw.get("meta") or {}
            # type 字段可能是字符串，需要还原成枚举
            if "type" in config_raw and isinstance(config_raw["type"], str):
                try:
                    config_raw["type"] = MCPServerType(config_raw["type"].lower())
                except ValueError:
                    logger.warning(f"ChatMcpStore: 无法识别的 type 字段，跳过: {config_raw.get('name')}")
                    return None
            config = MCPServerConfig(**config_raw)
            source_raw = meta_raw.get("source", MCPConfigSource.UNKNOWN.value)
            try:
                source = MCPConfigSource(source_raw)
            except ValueError:
                source = MCPConfigSource.UNKNOWN
            return cls(
                config=config,
                source=source,
                added_at=str(meta_raw.get("added_at") or _now_iso()),
                updated_at=str(meta_raw.get("updated_at") or _now_iso()),
            )
        except Exception as e:  # noqa: BLE001 - 反序列化失败容忍，打日志并丢弃单条
            logger.warning(f"ChatMcpStore: 反序列化记录失败，丢弃: {e}")
            return None


def _now_iso() -> str:
    """返回 UTC 带时区 ISO 时间字符串，供存储元数据使用（非展示场景）。"""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")


def _is_config_changed(existing: MCPServerConfig, new: MCPServerConfig) -> bool:
    """比对两个配置的关键字段是否有差异。"""
    for field in _DIFF_FIELDS:
        if getattr(existing, field, None) != getattr(new, field, None):
            return True
    return False


class ChatMcpStore:
    """Per-instance 的 MCP 配置存储。

    单例使用：`get_chat_mcp_store()`。内部通过 asyncio.Lock 保证"读-diff-写"的原子性。
    """

    def __init__(self, file_path: Optional[Path] = None) -> None:
        self._file_path_override = file_path
        self._lock = asyncio.Lock()

    @property
    def file_path(self) -> Path:
        if self._file_path_override is not None:
            return self._file_path_override
        return PathManager.get_chat_history_dir() / "mcp_servers.json"

    # ── 读接口 ────────────────────────────────────────────────────────────

    async def load(self) -> Dict[str, ChatMcpStoreEntry]:
        """加载全部记录。文件不存在或损坏时返回空字典。"""
        raw = await async_try_read_json(self.file_path)
        if not raw or not isinstance(raw, dict):
            return {}
        servers_raw = raw.get("mcpServers")
        if not isinstance(servers_raw, dict):
            return {}

        result: Dict[str, ChatMcpStoreEntry] = {}
        for name, entry_raw in servers_raw.items():
            if not isinstance(entry_raw, dict):
                continue
            entry = ChatMcpStoreEntry.from_dict(entry_raw)
            if entry is None:
                continue
            # 以外层 key 为准，修正 config.name 以防不一致
            if entry.config.name != name:
                logger.debug(f"ChatMcpStore: 外层 key({name}) 与 config.name({entry.config.name}) 不一致，以外层 key 为准")
                entry.config.name = name
            result[name] = entry
        return result

    async def list_all(self) -> Dict[str, MCPServerConfig]:
        """返回 {name: MCPServerConfig}，meta 信息对外隐藏。"""
        entries = await self.load()
        return {name: entry.config for name, entry in entries.items()}

    async def get(self, name: str) -> Optional[MCPServerConfig]:
        entries = await self.load()
        entry = entries.get(name)
        return entry.config if entry else None

    # ── 写接口 ────────────────────────────────────────────────────────────

    async def upsert_many(
        self,
        servers: List[MCPServerConfig],
        source: MCPConfigSource,
    ) -> Dict[str, UpsertChangeType]:
        """增量写入一批配置，返回每个服务器的变更类型。

        - 不存在 -> ADDED
        - 存在但关键字段有差异 -> CHANGED
        - 存在且无差异 -> UNCHANGED（不触发写盘）
        """
        if not servers:
            return {}

        async with self._lock:
            entries = await self.load()
            diff: Dict[str, UpsertChangeType] = {}
            now = _now_iso()
            changed_any = False

            for cfg in servers:
                name = cfg.name
                # 统一 source：若调用方未指定且配置本身 source 为 UNKNOWN，按参数 source 写入
                if cfg.source == MCPConfigSource.UNKNOWN:
                    cfg.source = source

                existing = entries.get(name)
                if existing is None:
                    entries[name] = ChatMcpStoreEntry(
                        config=cfg,
                        source=source,
                        added_at=now,
                        updated_at=now,
                    )
                    diff[name] = UpsertChangeType.ADDED
                    changed_any = True
                elif _is_config_changed(existing.config, cfg):
                    entries[name] = ChatMcpStoreEntry(
                        config=cfg,
                        source=source,
                        added_at=existing.added_at,
                        updated_at=now,
                    )
                    diff[name] = UpsertChangeType.CHANGED
                    changed_any = True
                else:
                    diff[name] = UpsertChangeType.UNCHANGED

            if changed_any:
                await self._write(entries)
                logger.info(
                    f"ChatMcpStore: upsert 完成，added={sum(1 for v in diff.values() if v == UpsertChangeType.ADDED)}, "
                    f"changed={sum(1 for v in diff.values() if v == UpsertChangeType.CHANGED)}, "
                    f"unchanged={sum(1 for v in diff.values() if v == UpsertChangeType.UNCHANGED)}"
                )
            else:
                logger.debug("ChatMcpStore: upsert 无实际变更，跳过写盘")
            return diff

    async def remove(self, name: str) -> bool:
        """移除一条配置，返回是否实际发生移除。"""
        async with self._lock:
            entries = await self.load()
            if name not in entries:
                return False
            entries.pop(name, None)
            await self._write(entries)
            logger.info(f"ChatMcpStore: 移除服务器 {name}")
            return True

    async def clear(self) -> None:
        """清空全部配置。主要供测试使用。"""
        async with self._lock:
            await self._write({})

    # ── 内部 ──────────────────────────────────────────────────────────────

    async def _write(self, entries: Dict[str, ChatMcpStoreEntry]) -> None:
        payload = {
            "version": _STORE_VERSION,
            "mcpServers": {
                name: entry.to_dict() for name, entry in entries.items()
            },
        }
        await async_write_json(self.file_path, payload, ensure_ascii=False, indent=2)


# ── 单例 ──────────────────────────────────────────────────────────────────

_global_store: Optional[ChatMcpStore] = None


def get_chat_mcp_store() -> ChatMcpStore:
    """获取进程内单例 ChatMcpStore。"""
    global _global_store
    if _global_store is None:
        _global_store = ChatMcpStore()
    return _global_store
