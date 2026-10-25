"""主 Agent 正常结束后的记忆提取生命周期服务。"""

from __future__ import annotations

from typing import TYPE_CHECKING

from agentlang.agent.state import AgentState
from agentlang.event.data import AfterMainAgentRunEventData
from agentlang.event.event import Event
from app.service.agent_context_snapshot_service import AgentContextSnapshotService
from app.service.memory.policies.memory_model_input_filter import MemoryModelInputFilter
from app.service.memory.policies.memory_skill_policy import is_memory_maintenance_enabled
from app.service.memory.runtime.extraction.memory_extraction_service import MemoryExtractionService
from app.service.memory.runtime.extraction.memory_extraction_trigger_service import (
    MemoryExtractionTriggerService,
)

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext

class MemoryAfterRunService:
    """判断运行后触发条件，并把完整快照交给记忆提取服务。"""

    def __init__(
        self,
        snapshot_service: AgentContextSnapshotService | None = None,
        extraction_service: MemoryExtractionService | None = None,
        trigger_service: MemoryExtractionTriggerService | None = None,
        input_filter: MemoryModelInputFilter | None = None,
    ) -> None:
        """初始化快照、提取、触发策略和输入过滤依赖。"""
        self._snapshot_service = snapshot_service or AgentContextSnapshotService()
        self._extraction_service = extraction_service or MemoryExtractionService()
        self._trigger_service = trigger_service or MemoryExtractionTriggerService()
        self._input_filter = input_filter or MemoryModelInputFilter()

    async def handle(
        self,
        agent_context: "AgentContext",
        event: Event[AfterMainAgentRunEventData],
    ) -> None:
        """记录正常结束的主任务，并按累计或空闲策略触发提取。"""
        if event.data.agent_state != AgentState.FINISHED.value:
            return
        if not agent_context.is_main_agent_context():
            return
        query = str(event.data.query or "").strip()
        should_count = bool(query) and not self._input_filter.should_skip(query)

        await self._trigger_service.record_finished_task(
            agent_context,
            should_count=should_count,
            trigger=lambda: self._submit_extraction(agent_context),
        )

    async def _submit_extraction(self, agent_context: "AgentContext") -> None:
        """
        捕获当前完整快照，并提交一次独立的后台记忆提取。

        捕获对话、会话配置和 Horizon 的副本；这里只在提交边界判断是否自动运行。
        例：用户刚确认一种报表格式，主 Agent 已结束；后台拿到这段对话后专门检查是否已记住。
        快照复用现有统一服务，不另扫项目文件，也不是再调用一次模型总结对话。
        开关变化很低频：提交前判断一次即可；捕获期间关闭时，放弃这份快照，不再派生任务。
        已有任务占用整理锁时 submit 会按原规则跳过，不在这里变成失败重试。
        """
        snapshot = await self._snapshot_service.capture(agent_context)
        if not is_memory_maintenance_enabled(agent_context):
            return
        self._extraction_service.submit(agent_context, snapshot)
