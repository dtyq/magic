"""
批量 tool_calls 的跨事件暂存状态值对象。

当 LLM 一次返回多个 tool_calls 时，需要在 after_agent_reply → before_tool_call 之间
暂存 content / reasoning / tool_calls 等数据，保证前端只看到一条 assistant 消息。
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple


@dataclass
class PendingReplyState:
    """批量 tool_calls 的跨事件暂存状态"""

    content: str = ""
    reasoning: str = ""
    correlation_id: Optional[str] = None
    message_id: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None

    # 批量工具调用计数
    batch_remaining: int = 0
    batch_subsequent_ids: Optional[Set[str]] = None
    batch_main_correlation_id: Optional[str] = None

    def consume_for_first_tool_call(self) -> Optional[Tuple[str, str, List[Dict[str, Any]], Optional[str]]]:
        """
        由第一个 before_tool_call 消费暂存数据。

        Returns:
            (content, reasoning, tool_calls, message_id) 或 None（无暂存数据时）
        """
        if not self.tool_calls:
            return None

        result = (self.content, self.reasoning, self.tool_calls, self.message_id)

        # 保留 correlation_id 和 batch 相关字段，清空已消费的数据
        self.content = ""
        self.reasoning = ""
        self.tool_calls = None
        self.message_id = None

        return result

    def should_skip_tool_call(self) -> bool:
        """
        同批次后续 before_tool_call 是否应跳过（不发 assistant 消息）。

        如果应跳过，自动递减 batch_remaining。
        """
        if self.batch_remaining > 0:
            self.batch_remaining -= 1
            return True
        return False

    def resolve_effective_correlation_id(self, tool_call_id: str, original: Optional[str]) -> Optional[str]:
        """
        解析 after_tool_call / pending_tool_call 实际应使用的 correlation_id。

        同一批次的工具调用统一使用批次主 correlation_id，
        让前端能关联到同一条 assistant 消息。
        """
        if (
            self.batch_main_correlation_id
            and self.batch_subsequent_ids
            and tool_call_id in self.batch_subsequent_ids
        ):
            return self.batch_main_correlation_id
        return original

    def reset(self):
        """重置所有状态"""
        self.content = ""
        self.reasoning = ""
        self.correlation_id = None
        self.message_id = None
        self.tool_calls = None
        self.batch_remaining = 0
        self.batch_subsequent_ids = None
        self.batch_main_correlation_id = None
