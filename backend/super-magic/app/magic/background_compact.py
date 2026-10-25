# -*- coding: utf-8 -*-
"""
后台上下文压缩：在上下文接近阈值时，fork 一个同类型子 Agent 执行压缩，
主 Agent 继续工作，压缩完成后无感应用。

运行关系：

    父 Agent
      ├─ capture 当前完整快照
      ├─ 继续接收用户消息
      └─ 等待后台结果
             │
             ▼
      同类型压缩 Agent
      ├─ 使用同一套 ChatHistory + session + Horizon
      ├─ 只能调用 compact_chat_history
      └─ 返回摘要与 Skill 建议，不直接修改父 Agent 文件

父 Agent 应用 summary 前还会检查快照前缀的消息数量和 digest。压缩期间追加的新消息
允许保留；如果旧前缀被回滚、前台压缩或其他流程改写，旧 summary 才会被拒绝。
"""

import asyncio
import hashlib
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Optional, Sequence

from agentlang.logger import get_logger
from app.magic.compact_result import CompactResult
from app.magic.compact_user_input_references import format_user_input_reference_block

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext

logger = get_logger(__name__)

# 后台压缩等待超时（秒），超时后回退到前台阻塞压缩
BACKGROUND_COMPACT_WAIT_TIMEOUT = 300


@dataclass
class BackgroundCompactState:
    """后台压缩状态机

    生命周期: idle → running → completed/failed → applied → idle

    `snapshot_message_count + snapshot_digest` 标识“压缩 Agent 实际看到的历史前缀”。
    新追加的消息位于这个前缀之后，可以原样接回 summary；如果前缀本身被回滚或其他
    压缩流程改写，digest 才会不一致，此时旧 summary 必须丢弃。

    forked subagent 调用 `compact_chat_history` 的 summary 参数就是压缩摘要；普通
    Agent 的返回文本不能替代它，因为普通返回可能只是解释“我已经压缩完成”。
    """
    # 后台任务引用（asyncio.Task 包装了压缩 Agent 调用）
    _task: asyncio.Task[CompactResult | None] | None = field(default=None, repr=False)

    # 本次后台压缩的唯一 generation，用于区分不同快照
    generation: str = ""

    # 快照时的消息数量（用于确定哪些是压缩后新增的消息）
    snapshot_message_count: int = 0

    # 快照前缀的语义指纹，用于应用前确认父历史未被其他流程改写
    snapshot_digest: str = ""

    # 任务启动时间
    started_at: float = 0.0

    # 最近一次失败的快照，用于避免历史未变化时反复重试同一份后台压缩
    last_failure_generation: str = ""
    last_failure_snapshot_message_count: int = 0
    last_failure_snapshot_digest: str = ""

    @property
    def is_idle(self) -> bool:
        return self._task is None

    @property
    def is_running(self) -> bool:
        return self._task is not None and not self._task.done()

    @property
    def is_completed(self) -> bool:
        return self._task is not None and self._task.done()

    @property
    def elapsed_seconds(self) -> float:
        if self.started_at <= 0:
            return 0.0
        return time.time() - self.started_at

    def get_result(self) -> CompactResult | None:
        """获取压缩结果（仅在 is_completed 时有效）

        返回 forked subagent 调用 compact_chat_history 时捕获的摘要与 Skill 建议，
        失败或取消时返回 None。
        """
        task = self._task
        if task is None or not task.done():
            return None
        try:
            result = task.result()
            if not isinstance(result, CompactResult) or not result.summary.strip():
                logger.warning("后台压缩没有捕获到有效的 compact_chat_history 结果")
                return None
            return result
        except (asyncio.CancelledError, Exception) as e:
            logger.warning(f"后台压缩任务异常: {e}")
            return None

    def cancel(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            logger.info("后台压缩任务已取消")

    def reset(self) -> None:
        self.cancel()
        self._task = None
        self.generation = ""
        self.snapshot_message_count = 0
        self.snapshot_digest = ""
        self.started_at = 0.0

    def mark_failed(self) -> None:
        self.last_failure_generation = self.generation
        self.last_failure_snapshot_message_count = self.snapshot_message_count
        self.last_failure_snapshot_digest = self.snapshot_digest

    def is_failed_snapshot(self, snapshot_message_count: int, snapshot_digest: str) -> bool:
        return (
            snapshot_message_count == self.last_failure_snapshot_message_count
            and snapshot_digest == self.last_failure_snapshot_digest
        )


def build_messages_digest(messages: Sequence[object]) -> str:
    semantic_messages = [_message_digest_payload(message) for message in messages]
    payload = json.dumps(semantic_messages, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _message_digest_payload(message: object) -> dict[str, object]:
    payload = {
        "role": getattr(message, "role", ""),
        "content": getattr(message, "content", ""),
        "show_in_ui": getattr(message, "show_in_ui", True),
    }
    if hasattr(message, "source") and getattr(message, "source") is not None:
        payload["source"] = getattr(message, "source")
    if hasattr(message, "system") and getattr(message, "system") is not None:
        payload["system"] = getattr(message, "system")
    if hasattr(message, "tool_call_id") and getattr(message, "tool_call_id") is not None:
        payload["tool_call_id"] = getattr(message, "tool_call_id")
    tool_calls = getattr(message, "tool_calls", None)
    if tool_calls:
        payload["tool_calls"] = [
            {
                "id": getattr(tool_call, "id", None),
                "name": getattr(getattr(tool_call, "function", None), "name", None),
                "arguments": getattr(getattr(tool_call, "function", None), "arguments", None),
            }
            for tool_call in tool_calls
        ]
    return payload


async def start_background_compact(
    state: BackgroundCompactState,
    agent_context: "AgentContext",
    compact_instruction: str,
    model_id: Optional[str] = None,
) -> None:
    """通过 fork 子 Agent 启动后台压缩。

    fork 出一个同类型子 Agent（继承完整对话历史），
    让它调用 compact_chat_history，并捕获摘要与 Skill 建议作为压缩结果。
    """
    if state.is_running:
        logger.warning("后台压缩任务已在运行中，跳过重复启动")
        return

    state.reset()
    from app.service.agent_context_snapshot_service import AgentContextSnapshotService

    context_snapshot = await AgentContextSnapshotService().capture(agent_context)
    snapshot_messages = context_snapshot.messages
    snapshot_message_count = len(snapshot_messages)
    snapshot_digest = build_messages_digest(snapshot_messages)
    if state.is_failed_snapshot(snapshot_message_count, snapshot_digest):
        logger.info("后台压缩快照与上次失败快照相同，跳过重复启动")
        return

    user_input_reference_block = format_user_input_reference_block(snapshot_messages)

    generation = uuid.uuid4().hex
    state.generation = generation
    state.snapshot_message_count = snapshot_message_count
    state.snapshot_digest = snapshot_digest
    state.started_at = time.time()

    compact_prompt = (
        "The conversation context is too long and must be compacted now.\n"
        "Call the `compact_chat_history` tool immediately with the complete summary.\n"
        "Do not call any other tool. Do not ask clarifying questions.\n"
        "The summary must cover the conversation before this compaction request.\n\n"
        f"{user_input_reference_block}\n\n"
        f"{compact_instruction}"
    )

    parent_context_id = getattr(agent_context, "context_id", "") or "unknown-parent"
    target = agent_context.get_agent_target()
    if target is None:
        raise RuntimeError("Background compact source has no AgentTarget")

    from app.service.agent_session_id_service import AgentSessionIdService
    # 后台压缩也是一次独立 Agent 执行。多次或并发压缩必须得到不同的会话 ID，
    # 否则固定的 `bg-compact-*` 名称会让两次压缩互相覆盖上下文文件。
    agent_id = await AgentSessionIdService.allocate(
        target.agent_name,
        f"bg-compact-{parent_context_id}-{generation[:12]}",
    )

    from app.path_manager import PathManager
    from app.service.agent_runner import (
        IsolatedAgentModelRequest,
        IsolatedAgentRunRequest,
        run_compaction_agent,
    )
    from app.utils.runtime_storage import (
        RuntimeEvictionPolicy,
        ensure_runtime_directory,
        evict_runtime_directories,
        get_runtime_config_int,
        trigger_opportunistic_cleanup,
    )

    temporary_dir = await ensure_runtime_directory(
        PathManager.get_background_compact_dir() / f"{target.agent_name}<{agent_id}>"
    )
    trigger_opportunistic_cleanup(
        "background_compact",
        lambda: evict_runtime_directories(
            PathManager.get_background_compact_dir(),
            policy=RuntimeEvictionPolicy(
                max_age_seconds=get_runtime_config_int(
                    "runtime_cleanup.background_compact.max_age_days",
                    minimum=1,
                )
                * 24
                * 60
                * 60,
            ),
            protected_paths=frozenset({temporary_dir}),
        ),
    )

    compact_task = asyncio.create_task(
        run_compaction_agent(IsolatedAgentRunRequest(
            target=target,
            agent_id=agent_id,
            prompt=compact_prompt,
            parent_context=agent_context,
            models=IsolatedAgentModelRequest(text_model_id=model_id),
            snapshot=context_snapshot,
            chat_history_dir=temporary_dir,
        ))
    )
    state._task = compact_task

    async def _cancel_background_compact() -> None:
        task = compact_task
        if not task.done():
            task.cancel()
            logger.info("后台压缩任务已取消")
        try:
            await asyncio.wait_for(asyncio.shield(task), timeout=10.0)
        except asyncio.TimeoutError:
            logger.warning("Timed out waiting for background compact task cancellation")
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning(f"Background compact task ended during cleanup: {exc}")
        finally:
            if state._task is task:
                state.reset()

    agent_context.register_run_cleanup(
        f"background_compact:{agent_id}",
        _cancel_background_compact,
    )

    logger.info(
        f"后台压缩 fork 子 Agent 已启动: "
        f"agent_name={target.agent_name}, agent_id={agent_id}, "
        f"snapshot_messages={state.snapshot_message_count}"
    )
