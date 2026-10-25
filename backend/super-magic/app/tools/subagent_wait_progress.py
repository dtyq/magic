"""wait_for_subagents 的进度卡片：在等谁、谁结束了、还在跑的大概在做什么。

同一张卡片经历三次推送，形状一致，只有 phase 不同：

| 时机 | 来源 | phase |
| 调用开始 | before 钩子 | waiting |
| 等待期间每 3 秒 | PENDING_TOOL_CALL，同一 correlation_id 就地更新 | waiting |
| 调用结束 | get_tool_detail | settled |

进度用「已结束个数 / 总数」：子 Agent 内部没有可量化的进度口径，编造百分比会误导用户。
"""

import asyncio
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from agentlang.context.tool_context import ToolContext
from agentlang.event import EventPairType, get_correlation_manager
from agentlang.event.data import PendingToolCallEventData
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from app.core.entity.message.server_message import (
    DisplayType,
    SubagentItemContent,
    SubagentsContent,
    SubagentsPhase,
    ToolDetail,
)
from app.i18n import i18n
from app.path_manager import PathManager
from app.tools.call_subagent import _display_subject_from_payload
from app.tools.subagent_runtime_models import (
    SubagentQueryStatus,
    SubagentSessionState,
    SubagentStatus,
    utc_now,
)
from app.tools.subagent_runtime_store import SubagentRuntimeStore
from app.tools.subagent_session_manager import SubagentSessionHandle
from app.utils.async_file_utils import async_exists, async_read_json

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext
    from app.tools.core.base_tool import BaseTool

logger = get_logger(__name__)

IN_FLIGHT_STATUSES = frozenset({SubagentStatus.PENDING, SubagentStatus.RUNNING})
# 给父 Agent 的进度快照、pattern 匹配内容的最大字符数
LAST_ACTIVITY_MAX_CHARS = 500

# 快 tick 只看内存里的 handle，不读文件
_PROGRESS_TICK_SECONDS = 3.0
# 慢 tick 才读聊天记录 JSON（需整读），并且只读少数几个运行中的子 Agent
_ACTIVITY_REFRESH_SECONDS = 15.0
_ACTIVITY_MAX_AGENTS = 3
# 卡片里的最近动作和结果只做提示，完整结果由主 Agent 读取后回复用户
_CARD_TEXT_MAX_CHARS = 200


@dataclass
class AgentProgressItem:
    """一个被等待子 Agent 的卡片快照。agent_name 为空表示没找到对应会话。"""

    agent_id: str
    agent_name: str
    label: str
    status: str
    display_name: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    last_activity: Optional[str] = None
    result: Optional[str] = None
    error: Optional[str] = None

    @property
    def is_in_flight(self) -> bool:
        return self.status in IN_FLIGHT_STATUSES

    def apply_state(self, state: SubagentSessionState) -> None:
        self.status = state.status
        self.started_at = state.started_at
        self.finished_at = state.finished_at
        self.result = state.last_result
        self.error = state.last_error
        if not self.is_in_flight:
            self.last_activity = None

    def display_payload(self) -> dict[str, Any]:
        """转成 result_display_label / _build_wait_action 认识的形状。"""
        return {"agent_id": self.agent_id, "agent_name": self.agent_name, "display_name": self.display_name}

    def elapsed_seconds(self) -> Optional[int]:
        if self.started_at is None:
            return None
        end = self.finished_at if not self.is_in_flight and self.finished_at else utc_now()
        return max(0, int((end - self.started_at).total_seconds()))

    def to_content(self) -> SubagentItemContent:
        return SubagentItemContent(
            agent_id=self.agent_id,
            label=self.label,
            status=self.status,
            elapsed_seconds=self.elapsed_seconds(),
            last_activity=_truncate(self.last_activity),
            result=_truncate(self.result),
            error=_truncate(self.error),
        )


def result_display_label(item: dict[str, Any]) -> str:
    """用户看到的子 Agent 名称：任务标签优先，其次 Agent 展示名，最后会话 ID。"""
    task_label = str(item.get("task_label") or "").strip()
    if task_label:
        return task_label

    agent_name = str(item.get("agent_name") or "")
    subject = _display_subject_from_payload(agent_name, item)
    if subject.name:
        return subject.name

    return str(item.get("agent_id") or "")


async def load_progress_items(agent_ids: list[str]) -> list[AgentProgressItem]:
    """按 agent_ids 顺序读取卡片快照；一次目录扫描，每个会话读一次小文件。"""
    states_by_id = await SubagentRuntimeStore.find_states_by_agent_ids(agent_ids)
    items: list[AgentProgressItem] = []
    for agent_id in agent_ids:
        states = states_by_id[agent_id]
        if len(states) != 1:
            status = SubagentQueryStatus.NOT_FOUND if not states else SubagentQueryStatus.AMBIGUOUS
            items.append(AgentProgressItem(agent_id=agent_id, agent_name="", label=agent_id, status=status))
            continue
        items.append(progress_item_from_state(agent_id, states[0]))
    return items


def progress_item_from_state(agent_id: str, state: SubagentSessionState) -> AgentProgressItem:
    item = AgentProgressItem(
        agent_id=agent_id,
        agent_name=state.agent_name,
        label=result_display_label({
            "agent_id": agent_id,
            "agent_name": state.agent_name,
            "task_label": state.task_label,
            "display_name": state.display_name,
        }),
        status=state.status,
        display_name=state.display_name,
    )
    item.apply_state(state)
    return item


def build_progress_detail(
    items: list[AgentProgressItem],
    elapsed_seconds: int,
    phase: SubagentsPhase,
) -> Optional[ToolDetail]:
    if not items:
        return None
    progress, indeterminate = _calculate_progress(items)
    return ToolDetail(
        type=DisplayType.SUBAGENTS,
        data=SubagentsContent(
            progress=progress,
            indeterminate=indeterminate,
            message=build_progress_message(items),
            total_agents=len(items),
            finished_agents=sum(1 for item in items if not item.is_in_flight),
            elapsed_seconds=elapsed_seconds,
            phase=phase,
            agents=[item.to_content() for item in items],
        ),
    )


def build_progress_message(items: list[AgentProgressItem]) -> str:
    """收起态头部的一句话，也是卡片 remark。名单放在展开列表里，这里不重复。"""
    in_flight = sum(1 for item in items if item.is_in_flight)
    finished = len(items) - in_flight
    if len(items) == 1:
        key = "wait_for_subagents.progress_single" if in_flight else "wait_for_subagents.progress_single_finished"
        return i18n.translate(key, category="tool.messages", label=items[0].label)
    if not in_flight:
        return i18n.translate("wait_for_subagents.progress_all_finished", category="tool.messages", total=len(items))
    return i18n.translate(
        "wait_for_subagents.progress_multi",
        category="tool.messages",
        total=len(items),
        finished=finished,
        running=in_flight,
    )


def build_stopping_message(items: list[AgentProgressItem]) -> str:
    if len(items) == 1:
        return i18n.translate("wait_for_subagents.stopping_single", category="tool.messages", label=items[0].label)
    return i18n.translate("wait_for_subagents.stopping_multi", category="tool.messages", total=len(items))


def start_progress_reporting(
    tool: "BaseTool",
    tool_context: ToolContext,
    action: str,
    items: list[AgentProgressItem],
    handles: dict[str, SubagentSessionHandle],
) -> Optional[asyncio.Task]:
    """启动等待期间的卡片刷新任务；调用方必须在 finally 里交给 stop_progress_reporting。"""
    agent_context = tool_context.get_extension("agent_context")
    if agent_context is None or not items:
        return None
    correlation_id = _resolve_correlation_id(tool_context, agent_context)
    return asyncio.create_task(
        _report_progress(tool, tool_context, agent_context, correlation_id, action, items, handles)
    )


async def stop_progress_reporting(task: Optional[asyncio.Task]) -> None:
    """取消并等它真正退出，避免工具结束后还有一条进度事件盖掉结果卡片。"""
    if task is None:
        return
    task.cancel()
    # gather + return_exceptions 只吞掉刷新任务自己的取消；外层被取消时照常向上抛
    await asyncio.gather(task, return_exceptions=True)


async def get_last_assistant_message(agent_name: str, agent_id: str) -> Optional[str]:
    """从子 Agent 的聊天历史文件中读取最后一条有内容的 assistant 消息，用于超时时的进度快照。"""
    chat_file = PathManager.get_subagent_chat_history_dir(agent_name, agent_id) / f"{agent_name}<{agent_id}>.json"
    try:
        if not await async_exists(chat_file):
            return None
        data = await async_read_json(chat_file)
        if not isinstance(data, list):
            return None
        for msg in reversed(data):
            if not isinstance(msg, dict) or msg.get("role") != "assistant":
                continue
            content = msg.get("content")
            if content and isinstance(content, str) and content.strip():
                content = content.strip()
                if len(content) > LAST_ACTIVITY_MAX_CHARS:
                    content = content[:LAST_ACTIVITY_MAX_CHARS] + "..."
                return content
    except Exception:
        pass
    return None


async def _report_progress(
    tool: "BaseTool",
    tool_context: ToolContext,
    agent_context: "AgentContext",
    correlation_id: str,
    action: str,
    items: list[AgentProgressItem],
    handles: dict[str, SubagentSessionHandle],
) -> None:
    loop = asyncio.get_running_loop()
    started = loop.time()
    # 首个 tick 就补一次最近动作，用户不用等 15 秒才看到子 Agent 在做什么
    last_activity_refresh = started - _ACTIVITY_REFRESH_SECONDS
    while True:
        await asyncio.sleep(_PROGRESS_TICK_SECONDS)
        await _sync_finished_items(items, handles)
        now = loop.time()
        if now - last_activity_refresh >= _ACTIVITY_REFRESH_SECONDS:
            last_activity_refresh = now
            await _refresh_last_activities(items)
        detail = build_progress_detail(items, int(now - started), SubagentsPhase.WAITING)
        if detail is not None:
            await _dispatch_progress_event(tool, tool_context, agent_context, correlation_id, action, detail)


async def _sync_finished_items(
    items: list[AgentProgressItem],
    handles: dict[str, SubagentSessionHandle],
) -> None:
    """handle 停了才读一次会话状态，拿到真实的完成／失败和结束时间；仍在跑的不碰磁盘。"""
    for item in items:
        handle = handles.get(item.agent_id)
        if handle is None or not item.is_in_flight or handle.is_running():
            continue
        try:
            state = await SubagentRuntimeStore.load_state(item.agent_name, item.agent_id)
        except Exception as exc:
            logger.warning("读取子 Agent 状态失败，进度卡片暂不更新该项: %s", exc)
            continue
        if state.status in IN_FLIGHT_STATUSES:
            # 任务刚停、状态还没写盘：下一个 tick 再读
            continue
        item.apply_state(state)


async def _refresh_last_activities(items: list[AgentProgressItem]) -> None:
    """为前几个运行中的子 Agent 读取最近一条消息。

    并列显示几十条「最近动作」对用户没有阅读价值，却要整读几十份聊天记录，所以只取前几个。
    """
    in_flight = [item for item in items if item.is_in_flight and item.agent_name]
    for item in in_flight[:_ACTIVITY_MAX_AGENTS]:
        activity = await get_last_assistant_message(item.agent_name, item.agent_id)
        if activity:
            item.last_activity = _truncate(" ".join(activity.split()))


async def _dispatch_progress_event(
    tool: "BaseTool",
    tool_context: ToolContext,
    agent_context: "AgentContext",
    correlation_id: str,
    action: str,
    detail: ToolDetail,
) -> None:
    try:
        event_data = PendingToolCallEventData(
            tool_context=tool_context,
            tool_name="wait_for_subagents",
            arguments={
                "name": "wait_for_subagents",
                "correlation_id": correlation_id,
                "action": action,
                "detail": detail.model_dump(mode="json"),
                "status": SubagentStatus.RUNNING.value,
            },
            tool_instance=tool,
            correlation_id=correlation_id,
        )
        agent_context.update_activity_time()
        await agent_context.dispatch_event(EventType.PENDING_TOOL_CALL, event_data)
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.warning("发送子 Agent 等待进度事件失败: %s", exc)


def _calculate_progress(items: list[AgentProgressItem]) -> tuple[int, bool]:
    """返回 (百分比, 是否不确定态)。只等一个时只有 0% 和 100%，进度条没意义，改用不确定态。"""
    finished = sum(1 for item in items if not item.is_in_flight)
    if len(items) == 1:
        return (100, False) if finished else (0, True)
    return int(finished * 100 / len(items)), False


def _resolve_correlation_id(tool_context: ToolContext, agent_context: "AgentContext") -> str:
    """与 before / after 卡片使用同一个 correlation_id，前端才会就地更新同一张卡片。"""
    correlation_id = get_correlation_manager().get_active_correlation_id(
        EventPairType.TOOL_CALL,
        agent_context.context_id,
    )
    return correlation_id or tool_context.tool_call_id or str(uuid.uuid4())


def _truncate(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    text = text.strip()
    if len(text) > _CARD_TEXT_MAX_CHARS:
        return text[:_CARD_TEXT_MAX_CHARS] + "..."
    return text
