"""
SDK in-flight 请求注册表。

记录 /api/sdk/tool/call 和 /api/sdk/mcp/call 当前正在执行的 asyncio task，
支持按 agent_context_id + sdk_execution_id 精确取消本轮 Code Mode 发起的所有请求。

设计原则：
- 只存最少必要元数据，不承载业务逻辑
- 单例，主事件循环内使用，无需加锁
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Dict, Optional

from agentlang.logger import get_logger

logger = get_logger(__name__)


@dataclass
class SdkCallEntry:
    """一条 in-flight SDK 请求的元数据"""
    agent_context_id: str
    sdk_execution_id: str
    tool_call_id: str
    call_type: str  # "tool" | "mcp"
    task: asyncio.Task


# 复合键：(agent_context_id, sdk_execution_id, tool_call_id)
_ScopeKey = tuple[str, str, str]


class SdkCallRegistry:
    """全局 SDK 请求注册表，维护 in-flight request task 映射。"""

    _instance: Optional["SdkCallRegistry"] = None

    def __init__(self) -> None:
        self._entries: Dict[_ScopeKey, SdkCallEntry] = {}

    @classmethod
    def get_instance(cls) -> "SdkCallRegistry":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register(self, entry: SdkCallEntry) -> None:
        key = (entry.agent_context_id, entry.sdk_execution_id, entry.tool_call_id)
        self._entries[key] = entry
        logger.debug(
            f"[SdkCallRegistry] registered: {entry.call_type} "
            f"execution={entry.sdk_execution_id[:8]} tool_call={entry.tool_call_id}"
        )

    def unregister(
        self,
        agent_context_id: str,
        sdk_execution_id: str,
        tool_call_id: str,
    ) -> None:
        key = (agent_context_id, sdk_execution_id, tool_call_id)
        removed = self._entries.pop(key, None)
        if removed:
            logger.debug(
                f"[SdkCallRegistry] unregistered: {removed.call_type} "
                f"execution={sdk_execution_id[:8]} tool_call={tool_call_id}"
            )

    def cancel_by_execution(
        self,
        agent_context_id: str,
        sdk_execution_id: str,
    ) -> int:
        """取消指定 execution 下所有 in-flight 请求 task，返回取消数量。"""
        to_cancel = [
            (k, e) for k, e in self._entries.items()
            if e.agent_context_id == agent_context_id
            and e.sdk_execution_id == sdk_execution_id
        ]
        cancelled = 0
        for key, entry in to_cancel:
            if not entry.task.done():
                entry.task.cancel()
                cancelled += 1
            self._entries.pop(key, None)

        if cancelled:
            logger.info(
                f"[SdkCallRegistry] cancelled {cancelled} task(s) for "
                f"execution={sdk_execution_id[:8]} context={agent_context_id[:8]}"
            )
        return cancelled

    def cancel_by_context(self, agent_context_id: str) -> int:
        """取消指定 agent_context 下所有 in-flight 请求 task。"""
        to_cancel = [
            (k, e) for k, e in self._entries.items()
            if e.agent_context_id == agent_context_id
        ]
        cancelled = 0
        for key, entry in to_cancel:
            if not entry.task.done():
                entry.task.cancel()
                cancelled += 1
            self._entries.pop(key, None)

        if cancelled:
            logger.info(
                f"[SdkCallRegistry] cancelled {cancelled} task(s) for "
                f"context={agent_context_id[:8]}"
            )
        return cancelled
