"""
Chunk Processor Module

流式 Chunk 处理模块，负责解析和处理单个流式数据块。
"""

from dataclasses import dataclass
from typing import Optional

from openai.types.chat import ChatCompletionChunk

from agentlang.logger import get_logger

from .streaming_util import StreamingState, StreamingHelper

logger = get_logger(__name__)

# 上游可能用的"思考内容"字段别名（按优先级排列），首个非 None 字段被采纳
# - reasoning_content: DeepSeek / 早期 Kimi
# - reasoning: 部分 Kimi/OpenRouter 上游
REASONING_FIELD_ALIASES: tuple[str, ...] = (
    "reasoning_content",
    "reasoning",
)


def _extract_reasoning_text(delta_or_dict) -> Optional[str]:
    """从 delta 对象或 dict 中按别名顺序提取 reasoning 文本，找不到返回 None"""
    if isinstance(delta_or_dict, dict):
        for name in REASONING_FIELD_ALIASES:
            value = delta_or_dict.get(name)
            if value is not None:
                return value
        return None
    for name in REASONING_FIELD_ALIASES:
        value = getattr(delta_or_dict, name, None)
        if value is not None:
            return value
    return None


@dataclass
class ChunkProcessResult:
    """
    Chunk 处理结果。

    封装处理单个 chunk 后需要返回给调用方的信息。
    工具调用相关的状态直接在 StreamingState 中修改，不在此返回。
    """

    # 提取的文本内容
    text: str = ""

    # 文本类型: "reasoning" | "content" | None
    text_type: Optional[str] = None

    # 是否包含工具调用
    has_tool_call: bool = False

    # 完成原因（如果有）
    finish_reason: Optional[str] = None


class ChunkProcessor:
    """
    流式 Chunk 处理器。

    负责解析单个流式数据块，提取文本内容、工具调用等信息，
    并更新 StreamingState 中的相关状态。
    """

    @staticmethod
    def process(chunk: ChatCompletionChunk, state: StreamingState, current_finish_reason: Optional[str] = None) -> ChunkProcessResult:
        """
        处理单个流式数据块。

        解析 chunk 内容，更新 state 中的工具调用状态，返回处理结果。

        注意：tool_call.index 不可信，完全基于 tool_id 来管理索引。

        Args:
            chunk: 流式数据块
            state: 流式状态对象（工具调用相关字段会被直接修改）
            current_finish_reason: 当前的完成原因（用于更新）

        Returns:
            ChunkProcessResult: 处理结果
        """
        result = ChunkProcessResult()
        result.finish_reason = current_finish_reason

        # 首先规范化 chunk 格式
        choice = StreamingHelper.normalize_chunk_choice(chunk)
        if not choice:
            return result

        # 处理文本内容（优先处理 reasoning，其次处理 content）
        # 不同上游用不同字段名传递思考内容，统一通过 REASONING_FIELD_ALIASES 兜底
        reasoning_content = _extract_reasoning_text(choice.delta)
        if reasoning_content is not None:
            result.text = reasoning_content
            result.text_type = "reasoning"
        elif choice.delta.content is not None:
            result.text = choice.delta.content
            result.text_type = "content"

        # 处理工具调用
        if choice.delta.tool_calls:
            result.has_tool_call = True
            for tool_call in choice.delta.tool_calls:
                ChunkProcessor._process_tool_call(tool_call, state)

        # 获取结束原因
        if choice.finish_reason:
            result.finish_reason = choice.finish_reason

        return result

    @staticmethod
    def _process_tool_call(tool_call, state: StreamingState) -> None:
        """
        处理单个工具调用。

        标准流式格式：
        - 第一个 chunk: id 有值（如 "call_xxx"），创建新工具
        - 后续 chunk: id 为空字符串 "" 或 None，累积参数到最后一个工具

        Args:
            tool_call: 工具调用对象
            state: 流式状态对象
        """
        tool_call_id: str = tool_call.id
        # tool_call.index 不可信，完全忽略它

        if tool_call_id:
            # 有 ID = 新工具开始
            if tool_call_id not in state.tool_id_to_index:
                # 新工具，分配新索引
                new_index = len(state.tool_calls)
                state.tool_id_to_index[tool_call_id] = new_index

                # 获取初始参数（第一个 chunk 可能就包含部分 arguments）
                initial_arguments = ""
                if tool_call.function and tool_call.function.arguments:
                    initial_arguments = tool_call.function.arguments

                state.tool_calls[new_index] = {
                    "id": tool_call_id,
                    "type": tool_call.type or "function",
                    "function": {
                        "name": tool_call.function.name if tool_call.function else None,
                        "arguments": initial_arguments
                    }
                }
                state.last_tool_index = new_index
                logger.debug(f"Create new tool call: id={tool_call_id}, index={new_index}, name={tool_call.function.name if tool_call.function else None}")
            else:
                # 已存在的工具 ID，更新 last_tool_index 并追加参数
                state.last_tool_index = state.tool_id_to_index[tool_call_id]
                # 有些LLM在后续chunk中仍然携带tool_call_id，需要继续追加arguments
                if tool_call.function and tool_call.function.arguments:
                    state.tool_calls[state.last_tool_index]["function"]["arguments"] += tool_call.function.arguments
                    logger.debug(f"Append arguments to existing tool call: id={tool_call_id}, index={state.last_tool_index}, args_len={len(tool_call.function.arguments)}")
        else:
            # 无 ID = 累积参数到最后一个工具
            if state.last_tool_index >= 0 and tool_call.function and tool_call.function.arguments:
                state.tool_calls[state.last_tool_index]["function"]["arguments"] += tool_call.function.arguments
