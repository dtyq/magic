"""
Streaming Utility Module

流式处理工具模块，提供流式 LLM 响应处理所需的工具类和辅助函数。
管理流式状态并提供发送流式消息的辅助方法。
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional

from openai.types.chat import ChatCompletionChunk
from openai.types.chat.chat_completion_chunk import (
    Choice as ChunkChoice,
    ChoiceDelta,
    ChoiceDeltaToolCall,
    ChoiceDeltaFunctionCall,
)

from agentlang.logger import get_logger
from agentlang.streaming.models import ChunkData, ChunkDelta, ChunkMetadata, ChunkStatus

logger = get_logger(__name__)


@dataclass
class StreamingState:
    """
    流式响应处理的状态管理类。

    封装流式处理过程中所需的所有状态变量，
    使复杂的状态转换更易于追踪和管理。
    """

    # 累积内容
    reasoning_text: str = ""  # 累积的思考内容
    content_text: str = ""    # 累积的回复内容

    # 当前流式输出状态
    current_streaming_type: str = ""              # 当前类型: "reasoning" | "content" | ""(未开始)
    streaming_started: bool = False               # 当前类型的流式是否已开始

    # 事件追踪
    reasoning_reply_started: bool = False  # reasoning 的 before_reply 是否已触发
    content_reply_started: bool = False    # content 的 before_reply 是否已触发
    after_think_sent: bool = False         # AFTER_AGENT_THINK 是否已发送

    # Chunk ID 计数器（用于流式消息标识）
    chunk_id_counter: int = 0

    # 工具调用状态
    tool_call_started: bool = False        # 是否已开始工具调用
    tool_calls: Dict[int, Dict[str, Any]] = field(default_factory=dict)
    tool_id_to_index: Dict[str, int] = field(default_factory=dict)
    last_tool_index: int = -1

    # 父级关联 ID（用于按 Agent 循环周期分组事件）
    parent_correlation_id: Optional[str] = None

    # Chunk 处理状态
    received_chunk_count: int = 0          # 已接收的 chunk 数量
    first_chunk_received: bool = False     # 是否接收到首个 chunk
    content_completion_sent: bool = False  # 是否已发送 content 完成消息（状态2）
    finish_reason_received: bool = False   # 是否已收到 finish_reason

    # Chunk 异常检测
    empty_chunk_count: int = 0             # 连续空 chunk 计数
    invalid_chunk_count: int = 0           # 无效 chunk 计数
    last_content_time: float = 0.0         # 上次收到有效内容的时间

    # 延迟监控统计
    max_chunk_interval: float = 0.0        # chunk 之间的最大间隔时间
    slow_chunk_count: int = 0              # 慢 chunk 数量 (> SLOW_CHUNK_THRESHOLD)
    very_slow_chunk_count: int = 0         # 严重慢 chunk 数量 (> VERY_SLOW_CHUNK_THRESHOLD)

    def increment_chunk_id(self) -> int:
        """递增并返回下一个 chunk ID"""
        self.chunk_id_counter += 1
        return self.chunk_id_counter

    def increment_chunk_count(self) -> int:
        """递增并返回已接收的 chunk 数量"""
        self.received_chunk_count += 1
        if not self.first_chunk_received:
            self.first_chunk_received = True
        return self.received_chunk_count

    # 空 chunk 最大数量阈值
    MAX_EMPTY_CHUNK_COUNT: int = 3

    # 无效 chunk 最大数量阈值
    MAX_INVALID_CHUNK_COUNT: int = 10

    def record_valid_content(self, current_time: float) -> None:
        """记录收到有效内容，重置空 chunk 计数"""
        self.empty_chunk_count = 0
        self.last_content_time = current_time

    def record_empty_chunk(self) -> None:
        """记录空 chunk"""
        self.empty_chunk_count += 1

    def is_max_empty_chunk_reached(self) -> bool:
        """检查是否已达到空 chunk 最大数量"""
        return self.empty_chunk_count >= self.MAX_EMPTY_CHUNK_COUNT

    def has_received_chunks(self) -> bool:
        """检查是否已接收到任何有效 chunk"""
        return self.received_chunk_count > 0

    def record_invalid_chunk(self) -> None:
        """记录无效 chunk"""
        self.invalid_chunk_count += 1

    def reset_invalid_chunk_count(self) -> None:
        """重置无效 chunk 计数"""
        self.invalid_chunk_count = 0

    def is_max_invalid_chunk_reached(self) -> bool:
        """检查是否已达到无效 chunk 最大数量"""
        return self.invalid_chunk_count >= self.MAX_INVALID_CHUNK_COUNT

    def update_chunk_interval_stats(self, interval: float, slow_threshold: float, very_slow_threshold: float) -> None:
        """更新 chunk 间隔统计"""
        if interval > self.max_chunk_interval:
            self.max_chunk_interval = interval
        if interval > very_slow_threshold:
            self.very_slow_chunk_count += 1
        elif interval > slow_threshold:
            self.slow_chunk_count += 1

    def is_in_reasoning_phase(self) -> bool:
        """检查当前是否在思考阶段（正在输出思考内容）"""
        return self.current_streaming_type == "reasoning"

    def is_in_content_phase(self) -> bool:
        """检查当前是否在回复阶段（正在输出回复内容）"""
        return self.current_streaming_type == "content"


class StreamingHelper:
    """
    流式操作辅助类。

    提供发送流式消息和管理流式状态的静态方法。
    """

    @staticmethod
    def normalize_chunk_choice(chunk: ChatCompletionChunk) -> Optional[ChunkChoice]:
        """
        将 chunk choices 规范化为标准 OpenAI 格式。

        将非标准的 dict 格式转换为标准的 ChunkChoice 对象格式。

        Args:
            chunk: 流式响应的原始数据块

        Returns:
            标准格式的 ChunkChoice 对象，如果 choices 为空或无效则返回 None
        """
        if not chunk.choices:
            return None

        # 标准格式：choices 是列表
        if isinstance(chunk.choices, list) and len(chunk.choices) > 0:
            return chunk.choices[0]

        # 非标准格式：choices 是字典，需要转换为标准 ChunkChoice 对象
        if isinstance(chunk.choices, dict):
            choice_dict = chunk.choices
            delta_dict = choice_dict.get('delta', {})

            # 构造 tool_calls
            tool_calls = None
            if delta_dict.get('tool_calls'):
                tool_calls = []
                for tc in delta_dict['tool_calls']:
                    func_data = tc.get('function', {})
                    tool_call = ChoiceDeltaToolCall(
                        index=tc.get('index', 0),
                        id=tc.get('id'),
                        type=tc.get('type', 'function'),
                        function=ChoiceDeltaFunctionCall(
                            name=func_data.get('name'),
                            arguments=func_data.get('arguments', '')
                        ) if func_data else None
                    )
                    tool_calls.append(tool_call)

            # 构造 ChoiceDelta
            delta = ChoiceDelta(
                content=delta_dict.get('content'),
                tool_calls=tool_calls,
                role=delta_dict.get('role')
            )

            # 动态添加 reasoning_content（如果存在）
            if 'reasoning_content' in delta_dict:
                setattr(delta, 'reasoning_content', delta_dict['reasoning_content'])

            # 构造 ChunkChoice
            normalized_choice = ChunkChoice(
                index=choice_dict.get('index', 0),
                delta=delta,
                finish_reason=choice_dict.get('finish_reason'),
                logprobs=choice_dict.get('logprobs')
            )

            return normalized_choice

        # 未知格式
        logger.warning(f"未知的 chunk choices 格式: {type(chunk.choices)}")
        return None

    @staticmethod
    async def send_stream_start(
        streaming_driver,
        request_id: str,
        model_id: str,
        correlation_id: str,
        parent_correlation_id: Optional[str],
        content_type: str,
        chunk_id: int
    ) -> bool:
        """
        发送流式开始消息 (status=0)

        Args:
            streaming_driver: 流式驱动实例
            request_id: 请求 ID
            model_id: 模型 ID
            correlation_id: 本次流的关联 ID
            parent_correlation_id: 父级关联 ID（Agent 循环周期分组标识）
            content_type: 内容类型 ("reasoning" | "content")
            chunk_id: 本条消息的 chunk ID

        Returns:
            bool: 推送是否成功
        """
        if not streaming_driver:
            return False

        try:
            chunk_data = ChunkData(
                request_id=request_id,
                chunk_id=chunk_id,
                content="",  # 开始消息内容为空
                delta=ChunkDelta(
                    status=ChunkStatus.START,
                    finish_reason=None
                ),
                timestamp=datetime.now(),
                is_final=False,
                metadata=ChunkMetadata(
                    correlation_id=correlation_id,
                    model_id=model_id,
                    parent_correlation_id=parent_correlation_id,
                    content_type=content_type
                )
            )

            await streaming_driver.push(chunk_data)
            logger.debug(
                f"[{request_id}] 流式开始消息推送成功 "
                f"(chunk_id={chunk_id}, content_type={content_type}, "
                f"correlation_id={correlation_id}, parent_correlation_id={parent_correlation_id})"
            )
            return True

        except Exception as e:
            logger.warning(f"[{request_id}] 流式开始消息推送失败: {e}")
            return False

    @staticmethod
    async def send_stream_chunk(
        streaming_driver,
        request_id: str,
        model_id: str,
        correlation_id: str,
        parent_correlation_id: Optional[str],
        content_type: str,
        content: str,
        chunk_id: int
    ) -> bool:
        """
        发送流式中消息 (status=1)

        Args:
            streaming_driver: 流式驱动实例
            request_id: 请求 ID
            model_id: 模型 ID
            correlation_id: 本次流的关联 ID
            parent_correlation_id: 父级关联 ID（Agent 循环周期分组标识）
            content_type: 内容类型 ("reasoning" | "content")
            content: 要发送的内容
            chunk_id: 本条消息的 chunk ID

        Returns:
            bool: 推送是否成功
        """
        if not streaming_driver:
            return False

        try:
            chunk_data = ChunkData(
                request_id=request_id,
                chunk_id=chunk_id,
                content=content,
                delta=ChunkDelta(
                    status=ChunkStatus.STREAMING,
                    finish_reason=None
                ),
                timestamp=datetime.now(),
                is_final=False,
                metadata=ChunkMetadata(
                    correlation_id=correlation_id,
                    model_id=model_id,
                    parent_correlation_id=parent_correlation_id,
                    content_type=content_type
                )
            )

            await streaming_driver.push(chunk_data)
            logger.debug(
                f"[{request_id}] 流式消息推送成功 "
                f"(chunk_id={chunk_id}, content_len={len(content)}, content_type={content_type})"
            )
            return True

        except Exception as e:
            logger.debug(f"[{request_id}] 流式消息推送失败: {e}")
            return False

    @staticmethod
    async def send_stream_end(
        streaming_driver,
        request_id: str,
        model_id: str,
        correlation_id: str,
        parent_correlation_id: Optional[str],
        content_type: str,
        full_content: str,
        chunk_id: int,
        finish_reason: Optional[str] = None,
        include_full_content: bool = True
    ) -> bool:
        """
        发送流式结束消息 (status=2)

        Args:
            streaming_driver: 流式驱动实例
            request_id: 请求 ID
            model_id: 模型 ID
            correlation_id: 本次流的关联 ID
            parent_correlation_id: 父级关联 ID（Agent 循环周期分组标识）
            content_type: 内容类型 ("reasoning" | "content")
            full_content: 完整的累积内容
            chunk_id: 本条消息的 chunk ID
            finish_reason: 完成原因（可选）
            include_full_content: 是否在结束消息中包含完整内容

        Returns:
            bool: 推送是否成功
        """
        if not streaming_driver:
            return False

        try:
            chunk_data = ChunkData(
                request_id=request_id,
                chunk_id=chunk_id,
                content=full_content if include_full_content else "",
                delta=ChunkDelta(
                    status=ChunkStatus.END,
                    finish_reason=finish_reason
                ),
                timestamp=datetime.now(),
                is_final=True,
                metadata=ChunkMetadata(
                    correlation_id=correlation_id,
                    model_id=model_id,
                    parent_correlation_id=parent_correlation_id,
                    content_type=content_type
                )
            )

            await streaming_driver.push(chunk_data)
            logger.info(
                f"[{request_id}] 流式结束消息推送成功 "
                f"(chunk_id={chunk_id}, content_len={len(full_content)}, content_type={content_type}, "
                f"correlation_id={correlation_id}, parent_correlation_id={parent_correlation_id})"
            )
            return True

        except Exception as e:
            logger.warning(f"[{request_id}] 流式结束消息推送失败: {e}")
            return False

    @staticmethod
    async def end_current_stream(
        streaming_driver,
        state: StreamingState,
        request_id: str,
        model_id: str,
        correlation_id: str,
        finish_reason: Optional[str] = None,
        include_full_content: bool = True
    ) -> bool:
        """
        结束当前正在进行的流式输出。

        如果有正在进行的流式输出，发送结束消息并重置流式状态。

        Args:
            streaming_driver: 流式驱动实例
            state: 当前流式状态
            request_id: 请求 ID
            model_id: 模型 ID
            correlation_id: 本次流的关联 ID
            finish_reason: 完成原因（可选）
            include_full_content: 是否在结束消息中包含完整内容（默认 True）

        Returns:
            bool: 是否结束了流（如果有活跃的流返回 True）
        """
        if not state.streaming_started or not state.current_streaming_type:
            return False

        # 根据当前类型确定完整内容
        if state.current_streaming_type == "reasoning":
            full_content = state.reasoning_text
        else:
            full_content = state.content_text

        # 发送结束消息
        chunk_id = state.increment_chunk_id()
        success = await StreamingHelper.send_stream_end(
            streaming_driver=streaming_driver,
            request_id=request_id,
            model_id=model_id,
            correlation_id=correlation_id,
            parent_correlation_id=state.parent_correlation_id,
            content_type=state.current_streaming_type,
            full_content=full_content,
            chunk_id=chunk_id,
            finish_reason=finish_reason,
            include_full_content=include_full_content
        )

        # 重置流式状态
        state.streaming_started = False
        state.current_streaming_type = ""

        return success

    @staticmethod
    async def start_new_stream(
        streaming_driver,
        state: StreamingState,
        request_id: str,
        model_id: str,
        correlation_id: str,
        content_type: str
    ) -> bool:
        """
        为指定的内容类型开始新的流式输出。

        Args:
            streaming_driver: 流式驱动实例
            state: 当前流式状态
            request_id: 请求 ID
            model_id: 模型 ID
            correlation_id: 本次流的关联 ID
            content_type: 内容类型 ("reasoning" | "content")

        Returns:
            bool: 是否成功开始流式输出
        """
        chunk_id = state.increment_chunk_id()
        success = await StreamingHelper.send_stream_start(
            streaming_driver=streaming_driver,
            request_id=request_id,
            model_id=model_id,
            correlation_id=correlation_id,
            parent_correlation_id=state.parent_correlation_id,
            content_type=content_type,
            chunk_id=chunk_id
        )

        if success:
            state.streaming_started = True
            state.current_streaming_type = content_type

        return success

    @staticmethod
    async def switch_stream_type(
        streaming_driver,
        state: StreamingState,
        request_id: str,
        model_id: str,
        correlation_id: str,
        new_content_type: str
    ) -> bool:
        """
        从当前流式类型切换到新的类型。

        该方法会结束当前流（如果有）并开始新的流。

        Args:
            streaming_driver: 流式驱动实例
            state: 当前流式状态
            request_id: 请求 ID
            model_id: 模型 ID
            correlation_id: 本次流的关联 ID
            new_content_type: 新的内容类型 ("reasoning" | "content")

        Returns:
            bool: 切换是否成功
        """
        # 如果有当前流，先结束它
        if state.streaming_started and state.current_streaming_type:
            await StreamingHelper.end_current_stream(
                streaming_driver=streaming_driver,
                state=state,
                request_id=request_id,
                model_id=model_id,
                correlation_id=correlation_id
            )

        # 开始新的流
        return await StreamingHelper.start_new_stream(
            streaming_driver=streaming_driver,
            state=state,
            request_id=request_id,
            model_id=model_id,
            correlation_id=correlation_id,
            content_type=new_content_type
        )

    @staticmethod
    async def apply_chunk_delay(
        non_human_options: Any,
        chunk_count: int,
        request_id: str
    ) -> None:
        """
        在 LLM chunk 之间注入随机延迟（用于非人类限流）

        Args:
            non_human_options: 非人类限流配置对象
            chunk_count: 当前 chunk 序号
            request_id: 请求 ID
        """
        if not non_human_options or not non_human_options.has_chunk_delay():
            return

        try:
            # 获取随机延迟时间（配置类内部已实现随机计算）
            delay_seconds = non_human_options.get_chunk_delay()
            if delay_seconds is None:
                return

            logger.debug(
                f"[{request_id}] [非人类限流] Chunk #{chunk_count} 延迟: {delay_seconds:.2f}秒"
            )

            await asyncio.sleep(delay_seconds)

        except Exception as e:
            logger.error(f"[{request_id}] 注入 chunk 延迟失败: {e}")
            # 失败不影响主流程
