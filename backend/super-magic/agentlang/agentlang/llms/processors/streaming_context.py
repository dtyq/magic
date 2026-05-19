"""
Streaming Context Module

流式处理上下文模块，定义流式处理的输入上下文和输出结果数据结构。
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional

from openai.types.chat import ChatCompletionChunk
from openai.types.completion_usage import CompletionUsage

from agentlang.interface.context import AgentContextInterface

from .processor_config import ProcessorConfig

# OpenAI finish_reason literal type
FinishReason = Literal["stop", "length", "tool_calls", "content_filter", "function_call"]


@dataclass
class StreamProcessContext:
    """
    流式处理上下文。

    封装流式处理所需的所有上下文信息，包括请求标识、配置和可选的运行时信息。
    """

    # Request identifiers
    request_id: str
    model_id: str
    correlation_id: str

    # Configuration
    processor_config: ProcessorConfig

    # Optional context
    agent_context: Optional[AgentContextInterface] = None

    # Optional runtime info
    http_request_start_time: Optional[float] = None

    # Event control
    enable_llm_response_events: bool = True

    @property
    def should_trigger_events(self) -> bool:
        """Check if reply events should be triggered for the current stream."""
        return self.enable_llm_response_events

    def get_non_human_options(self):
        """Get non-human options from agent context"""
        if self.agent_context:
            return self.agent_context.get_non_human_options()
        return None

    def get_thinking_correlation_id(self) -> Optional[str]:
        """Get thinking correlation ID from agent context"""
        if self.agent_context:
            return self.agent_context.get_thinking_correlation_id()
        return None


@dataclass
class StreamProcessResult:
    """
    流式处理结果。

    封装流式处理的所有输出数据。
    """

    # Collected stream chunks
    collected_chunks: List[ChatCompletionChunk] = field(default_factory=list)

    # Text content
    completion_text: str = ""
    reasoning_content: str = ""

    # Tool calls
    tool_calls: Dict[int, Dict[str, Any]] = field(default_factory=dict)

    # Completion info
    finish_reason: Optional[str] = None
    usage: Optional[CompletionUsage] = None
